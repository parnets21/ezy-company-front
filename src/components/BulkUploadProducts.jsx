/**
 * BulkUploadProducts.jsx — Excel → editable preview → bulk create.
 *
 * Flow:
 *   1. User picks an .xlsx/.xls/.csv file.
 *   2. We parse it in the browser (xlsx) and auto-map each column to a product
 *      field (code, name, size, finish, brand, mrp, …). Each row becomes an
 *      editable form row the user can review and correct before saving.
 *   3. On "Save All" we rebuild a clean spreadsheet from the (possibly edited)
 *      rows and POST it to /products/bulk-upload — the backend resolves
 *      brand/category by name and creates products row-by-row.
 *
 * Reusable in both the admin and company web apps (same productApi).
 */
import { useRef, useState, useMemo } from 'react'
import * as XLSX from 'xlsx'
import { X, Upload, Trash2, Loader2, CheckCircle, AlertTriangle, Plus, Search } from 'lucide-react'
import { productApi } from '../api/productApi'

// Target product fields shown as editable columns. `key` is the backend column
// name the bulk-upload importer understands.
const FIELDS = [
  { key: 'code',          label: 'Code' },
  { key: 'name',          label: 'Product Name' },
  { key: 'size',          label: 'Size' },
  { key: 'thickness',     label: 'Thickness' },
  { key: 'finish',        label: 'Finish / Surface' },
  { key: 'application',   label: 'Uses / Application' },
  { key: 'brand',         label: 'Brand' },
  { key: 'category',      label: 'Category' },
  { key: 'pcs_per_box',   label: 'Pcs/Box' },
  { key: 'sqft_per_box',  label: 'Sqft/Box' },
  { key: 'purchase_price',label: 'Purchase (DP/Box)' },
  { key: 'mrp',           label: 'MRP/Box' },
  { key: 'retail_price',  label: 'Retail Rate' },
  { key: 'gst_percent',   label: 'GST %' },
  { key: 'hsn_code',      label: 'HSN' },
]

// Map a spreadsheet header (lowercased) to one of our field keys. Covers the
// BDM sheet headers plus common aliases.
function headerToFieldKey(rawHeader) {
  const h = String(rawHeader || '').trim().toLowerCase().replace(/[\s./_-]+/g, '')
  const table = {
    // code
    bdmcode: 'code', code: 'code', productcode: 'code', sku: 'code', itemcode: 'code',
    // name
    productname: 'name', name: 'name', item: 'name', itemname: 'name', description: 'name',
    // size / dims
    size: 'size', dimensions: 'size', dimension: 'size',
    thickness: 'thickness',
    // finish / surface
    finish: 'finish', surface: 'finish',
    // uses
    uses: 'application', application: 'application', use: 'application',
    // brand / category
    brand: 'brand', company: 'brand',
    category: 'category', producttype: 'category', type: 'category',
    // packaging
    pkg: 'pcs_per_box', pcsperbox: 'pcs_per_box', pcsbox: 'pcs_per_box', piecesperbox: 'pcs_per_box',
    coverage: 'sqft_per_box', sqftperbox: 'sqft_per_box', sqftbox: 'sqft_per_box', area: 'sqft_per_box',
    // prices
    dpbox: 'purchase_price', purchaseprice: 'purchase_price', cost: 'purchase_price', dealerprice: 'purchase_price',
    mrpbox: 'mrp', mrp: 'mrp',
    mrpsqft: 'retail_price', retailrate: 'retail_price', retailprice: 'retail_price', sellingprice: 'retail_price',
    gst: 'gst_percent', gstpercent: 'gst_percent', tax: 'gst_percent',
    hsn: 'hsn_code', hsncode: 'hsn_code',
    // columns we intentionally ignore
    location: '', godown: '', dpsqft: '',
  }
  return table[h] ?? ''
}

// Pull "1 Pcs Pkg" → 1
function parsePcs(val) {
  const m = String(val || '').match(/(\d+)/)
  return m ? m[1] : ''
}

const BTN = { display: 'inline-flex', alignItems: 'center', gap: 6 }

export default function BulkUploadProducts({ onClose, onDone }) {
  const fileRef = useRef(null)
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState([])          // array of field-keyed objects
  const [visibleFieldKeys, setVisibleFieldKeys] = useState(FIELDS.map(f => f.key))
  const [parsing, setParsing] = useState(false)
  const [parseError, setParseError] = useState('')
  const [saving, setSaving] = useState(false)
  const [result, setResult] = useState(null)    // { total, imported, errors }
  const [search, setSearch] = useState('')

  const handleFile = async (file) => {
    if (!file) return
    setParseError(''); setResult(null); setRows([]); setVisibleFieldKeys(FIELDS.map(f => f.key))
    setFileName(file.name)
    setParsing(true)
    try {
      const ext = file.name.split('.').pop().toLowerCase()

      if (ext === 'pdf') {
        // ── PDF: send to backend parser, get rows back ──────────
        const res = await productApi.pdfPreview(file)
        const data = res?.data || res || {}
        const pdfRows = Array.isArray(data.rows) ? data.rows : []
        if (data.warning) setParseError(data.warning)
        if (!pdfRows.length && !data.warning) {
          setParseError('No products could be extracted from this PDF. It may be image-based.')
          return
        }
        // Map PDF rows to our FIELDS format
        const mapped = pdfRows.map(r => {
          const obj = {}
          FIELDS.forEach(f => { obj[f.key] = String(r[f.key] ?? '').trim() })
          // Extra fields from PDF parser that aren't in FIELDS — preserve as description
          if (!obj.description && r.description) obj.description = r.description
          return obj
        })
        setRows(mapped)
        setVisibleFieldKeys(FIELDS.map(f => f.key))
      } else {
        // ── Excel / CSV: parse in-browser ─────────────────────
        const buf = await file.arrayBuffer()
        const wb = XLSX.read(buf, { type: 'array' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const matrix = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
        if (!matrix.length) throw new Error('The spreadsheet is empty.')

        const headerRow = matrix[0]
        const colKeys = headerRow.map(headerToFieldKey)
        const matchedFieldKeys = [...new Set(colKeys.filter(Boolean))]

        const mapped = matrix.slice(1)
          .filter(r => r.some(c => String(c).trim() !== ''))
          .map(r => {
            const obj = {}
            FIELDS.forEach(f => { obj[f.key] = '' })
            colKeys.forEach((key, i) => {
              if (!key) return
              let v = r[i]
              if (key === 'pcs_per_box') v = parsePcs(v)
              obj[key] = v == null ? '' : String(v).trim()
            })
            return obj
          })

        if (!mapped.length) throw new Error('No data rows found below the header.')
        setRows(mapped)
        setVisibleFieldKeys(matchedFieldKeys.length ? matchedFieldKeys : FIELDS.map(f => f.key))
      }
    } catch (e) {
      setParseError(e?.response?.data?.message || e.message || 'Failed to read the file.')
    } finally {
      setParsing(false)
    }
  }

  const updateCell = (idx, key, value) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [key]: value } : r))
  }
  const addRow = () => {
    const blankRow = Object.fromEntries(FIELDS.map(f => [f.key, '']))
    setRows(prev => [...prev, blankRow])
    setSearch('')
  }
  const removeRow = (idx) => setRows(prev => prev.filter((_, i) => i !== idx))

  const visibleFields = FIELDS.filter(f => visibleFieldKeys.includes(f.key))
  const availableFields = FIELDS.filter(f => !visibleFieldKeys.includes(f.key))

  const validRowCount = rows.filter(r => String(r.name).trim()).length

  // Filtered view: keep original indices so edits/removes map to the real row.
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    const indexed = rows.map((row, idx) => ({ row, idx }))
    if (!q) return indexed
    return indexed.filter(({ row }) =>
      FIELDS.some(f => String(row[f.key] ?? '').toLowerCase().includes(q))
    )
  }, [rows, search])

  const handleSave = async () => {
    const payloadRows = rows.filter(r => String(r.name).trim())
    if (!payloadRows.length) {
      setParseError('At least one row must have a Product Name.')
      return
    }
    setSaving(true); setParseError(''); setResult(null)
    try {
      // Rebuild a clean spreadsheet from the edited rows and send it to the
      // existing bulk-upload endpoint (it resolves brand/category by name).
      const headers = FIELDS.map(f => f.key)
      const aoa = [headers, ...payloadRows.map(r => headers.map(h => r[h] ?? ''))]
      const ws = XLSX.utils.aoa_to_sheet(aoa)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Products')
      const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
      const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const file = new File([blob], 'bulk-products.xlsx', { type: blob.type })

      const res = await productApi.bulkUpload(file)
      const data = res?.data || res || {}
      const importedCount = data.imported ?? 0
      const errorCount = (data.errors || []).length

      // If any products were imported, trigger refresh and close.
      // If there were also some errors, show a brief result first.
      if (importedCount > 0 && errorCount === 0) {
        // All good — refresh and close silently.
        await onDone?.()
      } else if (importedCount > 0 && errorCount > 0) {
        // Partial — show result screen with errors, then close after user sees it.
        setResult({ total: data.total ?? payloadRows.length, imported: importedCount, errors: data.errors || [] })
        await onDone?.()   // refresh list in background; modal stays open showing errors
      } else {
        // Nothing imported (all errors)
        setResult({ total: data.total ?? payloadRows.length, imported: 0, errors: data.errors || [] })
      }
    } catch (e) {
      setParseError(e?.response?.data?.message || 'Bulk upload failed. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--card, #fff)', borderRadius: 12, width: '98vw', height: '95vh', maxWidth: '98vw', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--border, #e5e7eb)' }}>
          <div style={{ fontSize: 16, fontWeight: 700 }}>Upload Products from Excel</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflow: 'auto', flex: 1, display: 'flex', flexDirection: 'column' }}>
          {/* Step 1 — pick file */}
          {!rows.length && !result && (
            <div style={{ textAlign: 'center', padding: '28px 16px' }}>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls,.csv,.pdf"
                style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files?.[0])}
              />
              <div
                onClick={() => fileRef.current?.click()}
                style={{ cursor: 'pointer', border: '2px dashed var(--border, #cbd5e1)', borderRadius: 10, padding: '36px 20px', maxWidth: 460, margin: '0 auto' }}
              >
                {parsing
                  ? <><Loader2 className="spin" style={{ width: 28, margin: '0 auto 10px', display: 'block' }} /><div>Reading file… (PDF parsing may take a moment)</div></>
                  : <><Upload style={{ width: 28, margin: '0 auto 10px', display: 'block', color: 'var(--text-muted,#64748b)' }} />
                      <div style={{ fontWeight: 600 }}>Click to choose an Excel, CSV or PDF file</div>
                      <div className="form-hint" style={{ marginTop: 4 }}>.xlsx, .xls, .csv — or a catalogue <strong>.pdf</strong> (text-based)</div>
                    </>
                }
              </div>
              <div className="form-hint" style={{ marginTop: 14, maxWidth: 520, margin: '14px auto 0' }}>
                <strong>Excel/CSV:</strong> Columns auto-matched (BDMCODE→Code, PRODUCT NAME→Name, SURFACE→Finish, BRAND, COVERAGE→Sqft/Box, DP/BOX→Purchase, MRP/BOX→MRP).<br/>
                <strong>PDF catalogues supported:</strong> JK Creanza (Tiles), VARSO MRP, CERA Catalogue (Sanitaryware). Image-only PDFs (BDM Poster, KalingaStone) cannot be auto-parsed — use Excel for those.
              </div>
              {parseError && <div className="form-error" style={{ marginTop: 14 }}>{parseError}</div>}
            </div>
          )}

          {/* Step 2 — editable preview */}
          {rows.length > 0 && !result && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, color: 'var(--text-muted,#64748b)' }}>
                  <strong>{fileName}</strong> — {validRowCount} product{validRowCount !== 1 ? 's' : ''} ready{search.trim() ? ` · showing ${visible.length} match${visible.length !== 1 ? 'es' : ''}` : ''}. Review &amp; edit, then save.
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button className="btn btn-secondary btn-sm" onClick={addRow} disabled={saving} style={BTN}>
                    <Plus size={14} /> Add Row
                  </button>
                  <select
                    className="form-input"
                    aria-label="Add a product column"
                    value=""
                    disabled={saving || availableFields.length === 0}
                    onChange={e => {
                      const key = e.target.value
                      if (key) setVisibleFieldKeys(prev => [...prev, key])
                    }}
                    style={{ width: 170, fontSize: 13 }}
                  >
                    <option value="">＋ Add Column</option>
                    {availableFields.map(field => <option key={field.key} value={field.key}>{field.label}</option>)}
                  </select>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <Search size={14} style={{ position: 'absolute', left: 8, color: 'var(--text-muted,#94a3b8)' }} />
                    <input
                      className="form-input"
                      placeholder="Filter rows (code, name, brand…)"
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      style={{ paddingLeft: 28, fontSize: 13, minWidth: 260 }}
                    />
                  </div>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setRows([]); setFileName(''); setSearch(''); setParseError('') }}>Choose a different file</button>
                </div>
              </div>
              <div style={{ overflow: 'auto', border: '1px solid var(--border,#e5e7eb)', borderRadius: 8, flex: 1, minHeight: 0 }}>
                <table className="table" style={{ fontSize: 12, minWidth: Math.max(700, visibleFields.length * 130) }}>
                  <thead>
                    <tr>
                      <th style={{ width: 34 }}>#</th>
                      {visibleFields.map(f => <th key={f.key} style={{ whiteSpace: 'nowrap' }}>{f.label}</th>)}
                      <th style={{ width: 40 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(({ row, idx }) => (
                      <tr key={idx} style={{ background: String(row.name).trim() ? undefined : '#FEF2F2' }}>
                        <td style={{ color: 'var(--text-muted,#94a3b8)' }}>{idx + 1}</td>
                        {visibleFields.map(f => (
                          <td key={f.key}>
                            <input
                              className="form-input"
                              style={{ fontSize: 12, padding: '4px 6px', minWidth: f.key === 'name' ? 180 : 80 }}
                              value={row[f.key] ?? ''}
                              onChange={e => updateCell(idx, f.key, e.target.value)}
                            />
                          </td>
                        ))}
                        <td>
                          <button className="btn btn-ghost btn-xs" title="Remove row" onClick={() => removeRow(idx)}>
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {parseError && <div className="form-error" style={{ marginTop: 12 }}>{parseError}</div>}
            </>
          )}

          {/* Step 3 — result */}
          {result && (
            <div style={{ padding: '12px 4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <CheckCircle style={{ width: 22, color: 'var(--success,#059669)' }} />
                <div style={{ fontSize: 15, fontWeight: 700 }}>
                  {result.imported} of {result.total} products imported
                </div>
              </div>
              {result.errors?.length > 0 && (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#B45309', fontWeight: 600, marginBottom: 6 }}>
                    <AlertTriangle size={16} /> {result.errors.length} row(s) skipped
                  </div>
                  <div style={{ maxHeight: 200, overflow: 'auto', border: '1px solid var(--border,#e5e7eb)', borderRadius: 8 }}>
                    <table className="table" style={{ fontSize: 12 }}>
                      <thead><tr><th>Row</th><th>Field</th><th>Reason</th></tr></thead>
                      <tbody>
                        {result.errors.map((e, i) => (
                          <tr key={i}><td>{e.row}</td><td>{e.field}</td><td>{e.message}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 20px', borderTop: '1px solid var(--border,#e5e7eb)' }}>
          {result
            ? <button className="btn btn-primary" onClick={onClose}>Done</button>
            : (
              <>
                <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
                {rows.length > 0 && (
                  <button className="btn btn-primary" style={BTN} onClick={handleSave} disabled={saving || !validRowCount}>
                    {saving ? <><Loader2 className="spin" size={15} /> Saving…</> : <><Plus size={15} /> Save {validRowCount} Product{validRowCount !== 1 ? 's' : ''}</>}
                  </button>
                )}
              </>
            )
          }
        </div>
      </div>
      <style>{`.spin{animation:bupspin 1s linear infinite}@keyframes bupspin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
