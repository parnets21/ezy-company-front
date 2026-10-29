import { useState, useMemo, Fragment } from 'react'
import { Plus, Search, Download, ShoppingBag, CheckCircle, Trash2, X, PackageCheck, Building2, ArrowRight, ChevronDown, RefreshCw, Warehouse, Eye, Pencil, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const PAGE_SIZE = 10

/* ── API field helpers ── */
const purCode     = p => p.purchase_code  || (p._id ? `PUR-${String(p._id).slice(-6).toUpperCase()}` : (p.id || ''))
const purSupplier = p => p.supplier_name  || p.supplier || ''
const purProduct  = p => p.product_name   || p.product  || ''
const purDate     = p => {
  const raw = p.purchase_date || p.created_at || p.date
  return raw
    ? new Date(raw).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—'
}
const purTotal    = p => p.total_amount   || p.total    || 0
const purAmount   = p => p.amount         || 0
const purGst      = p => p.gst_amount     || p.gst      || 0
const purDelivery = p => p.delivery_number || p.delivery_no || p.docket_number || p.lr_number || '—'
const purInvoice  = p => p.invoice_number  || p.invoice_no  || p.bill_number   || '—'
const purStatus   = p => p.status || 'Pending'
const purWarehouse = (p, warehouses = []) => {
  if (p.warehouse_name) return p.warehouse_name
  if (p.warehouse)      return p.warehouse
  if (p.warehouse_id && warehouses.length > 0) {
    const w = warehouses.find(w => (w._id || w.id) === p.warehouse_id)
    if (w) return w.name
  }
  return '—'
}

/* ── Empty product row ── */
const emptyRow = () => ({ uid: Date.now() + Math.random(), product_id: '', qty: '', rate: '', gstPct: 18, unit: 'Sq Ft' })

export default function PurchaseManagement({ purchases = [], addPurchase, updatePurchase, deletePurchase, updatePurchaseStatus, products = [], suppliers = [], warehouses = [], branches = [] }) {
  const navigate = useNavigate()
  const [search,         setSearch]        = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [statusFilter,   setStatusFilter]  = useState('')
  const [dateFrom,       setDateFrom]      = useState('')
  const [dateTo,         setDateTo]        = useState('')
  const [statFilter,     setStatFilter]    = useState('')
  const [page,           setPage]          = useState(1)
  const [showModal,      setShowModal]     = useState(false)
  const [successMsg,     setSuccessMsg]    = useState('')
  const [saving,         setSaving]        = useState(false)
  const [customSupplier, setCustomSupplier]= useState('')

  /* ── View / Edit / Delete state ── */
  const [viewItem,       setViewItem]      = useState(null)
  const [deleteItem,     setDeleteItem]    = useState(null)
  const [deleteConfirm,  setDeleteConfirm] = useState('')
  const [deleting,       setDeleting]      = useState(false)

  /* ── Edit form state ── */
  const [editItem,       setEditItem]      = useState(null)
  const [editSupplier,   setEditSupplier]  = useState('')
  const [editCustomSup,  setEditCustomSup] = useState('')
  const [editWarehouse,  setEditWarehouse] = useState('')
  const [editDate,       setEditDate]      = useState('')
  const [editInvoice,    setEditInvoice]   = useState('')
  const [editDelivery,   setEditDelivery]  = useState('')
  const [editStatus,     setEditStatus]    = useState('Pending')
  const [editRows,       setEditRows]      = useState([emptyRow()])
  const [editErrors,     setEditErrors]    = useState({})
  const [editSaving,     setEditSaving]    = useState(false)
  const [editBranchId,   setEditBranchId]  = useState('')

  /* ── Form state ── */
  const [supplier,    setSupplier]    = useState('')
  const [warehouseId, setWarehouseId] = useState('')
  const [date,        setDate]        = useState('')
  const [invoiceNo,   setInvoiceNo]   = useState('')
  const [deliveryNo,  setDeliveryNo]  = useState('')
  const [dueDate,     setDueDate]     = useState('')
  const [newStatus,   setNewStatus]   = useState('Pending')
  const [rows,        setRows]        = useState([emptyRow()])
  const [errors,      setErrors]      = useState({})
  const [branchId,    setBranchId]    = useState('')

  /* ── Toast ── */
  const toast = msg => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 5000) }

  /* ── Open / close modal ── */
  const openModal = () => {
    setSupplier(''); setWarehouseId(''); setDate('')
    setInvoiceNo(''); setDeliveryNo(''); setDueDate(''); setNewStatus('Pending')
    setCustomSupplier(''); setRows([emptyRow()]); setErrors({})
    setBranchId('')
    setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setSaving(false) }

  /* ── Open Edit ── */
  const openEdit = (p) => {
    setEditItem(p)
    // Resolve supplier field
    const sup = p.supplier_name || p.supplier || ''
    const knownSup = suppliers.find(s => s.name === sup)
    if (knownSup || suppliers.length === 0) {
      setEditSupplier(sup)
      setEditCustomSup('')
    } else {
      setEditSupplier('__other__')
      setEditCustomSup(sup)
    }
    setEditWarehouse(p.warehouse_id || '')
    setEditDate(p.purchase_date ? p.purchase_date.split('T')[0] : '')
    setEditInvoice(p.invoice_number || p.invoice_no || '')
    setEditDelivery(p.delivery_number || p.delivery_no || p.docket_number || '')
    setEditStatus(p.status || 'Pending')
    // Build edit rows — for a multi-item bill, load all sibling records sharing bill_code.
    // For now load the single item as one editable row (siblings fetched separately if needed).
    setEditRows([{
      uid:        Date.now(),
      product_id: p.product_id || '',
      qty:        String(p.qty  || ''),
      rate:       String(p.rate || ''),
      gstPct:     p.gst_percent || 18,
      unit:       p.unit || 'Sq Ft',
    }])
    setEditErrors({})
    setEditSaving(false)
    setEditBranchId(p.branch_id || '')
  }
  const closeEdit = () => { setEditItem(null); setEditSaving(false) }

  /* ── Product row helpers ── */
  const setRow = (uid, field, value) =>
    setRows(prev => prev.map(r => r.uid === uid ? { ...r, [field]: value } : r))

  const addRow = () => setRows(prev => [...prev, emptyRow()])

  const removeRow = uid => setRows(prev => prev.length > 1 ? prev.filter(r => r.uid !== uid) : prev)

  /* ── Edit row helpers ── */
  const setEditRow = (uid, field, value) =>
    setEditRows(prev => prev.map(r => r.uid === uid ? { ...r, [field]: value } : r))
  const addEditRow = () => setEditRows(prev => [...prev, emptyRow()])
  const removeEditRow = uid => setEditRows(prev => prev.length > 1 ? prev.filter(r => r.uid !== uid) : prev)
  const handleEditProductSelect = (uid, prodId) => {
    const prod = products.find(p => (p._id || p.id) === prodId)
    setEditRows(prev => prev.map(r => r.uid === uid ? {
      ...r,
      product_id: prodId,
      rate: prod ? String(prod.purchase_price || prod.purchase_rate || prod.purchasePrice || prod.landing_cost || '') : '',
      gstPct: prod ? (Number(prod.gst_percent) || 18) : 18,
      unit: prod ? (prod.unit || 'Sq Ft') : 'Sq Ft',
    } : r))
  }

  /* ── Per-row totals ── */
  const rowCalc = (row) => {
    const qty  = Number(row.qty)  || 0
    const rate = Number(row.rate) || 0
    const amt  = qty * rate
    const gst  = Math.round(amt * (Number(row.gstPct) || 0) / 100)
    return { qty, rate, amt, gst, total: amt + gst }
  }

  /* ── Edit grand totals ── */
  const editGrandTotals = useMemo(() => editRows.reduce((acc, r) => {
    const { amt, gst, total } = rowCalc(r)
    return { amt: acc.amt + amt, gst: acc.gst + gst, total: acc.total + total }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, { amt: 0, gst: 0, total: 0 }), [editRows])

  /* ── Handle Edit Save ── */
  const handleEditSave = async () => {
    const errs = {}
    const supplierVal = editSupplier === '__other__' ? editCustomSup.trim() : editSupplier
    if (!supplierVal) errs.supplier = 'Supplier required'
    editRows.forEach((r, i) => {
      if (!r.product_id)                                        errs[`p_${i}`]   = 'Select product'
      if (!r.qty || isNaN(Number(r.qty)) || Number(r.qty) < 1) errs[`qty_${i}`] = 'Valid qty'
      if (!r.rate || isNaN(Number(r.rate)) || Number(r.rate) <= 0) errs[`rate_${i}`] = 'Valid rate'
    })
    if (Object.keys(errs).length) { setEditErrors(errs); return }
    setEditSaving(true)
    try {
      const row = editRows[0]
      const prod = products.find(p => (p._id || p.id) === row.product_id)
      const id = editItem._id || editItem.id
      const result = await updatePurchase?.(id, {
        supplier_name:   supplierVal,
        product_id:      row.product_id,
        product_name:    prod?.name || editItem.product_name || '',
        qty:             Number(row.qty),
        unit:            row.unit || 'Sq Ft',
        rate:            Number(row.rate),
        gst_percent:     Number(row.gstPct),
        invoice_number:  editInvoice,
        delivery_number: editDelivery,
        purchase_date:   editDate || null,
        // NOTE: status is intentionally excluded — use the status dropdown in the table instead
        warehouse_id:    editWarehouse || undefined,
        branch_id:       editBranchId || undefined,
        branch_name:     branches.find(b => (b._id || b.id) === editBranchId)?.name || '',
      })
      if (result?.success === false) {
        setEditErrors({ _global: result.message || 'Update failed. Please try again.' })
      } else {
        toast(`✓ Purchase ${purCode(editItem)} updated successfully.`)
        closeEdit()
      }
    } catch (e) {
      setEditErrors({ _global: 'Failed to update purchase. Please try again.' })
    } finally {
      setEditSaving(false)
    }
  }

  const handleProductSelect = (uid, prodId) => {
    const prod = products.find(p => (p._id || p.id) === prodId)
    setRows(prev => prev.map(r => r.uid === uid ? {
      ...r,
      product_id: prodId,
      rate:    prod ? String(
        prod.purchase_price || prod.purchase_rate ||
        prod.purchasePrice  || prod.landing_cost  || ''
      ) : '',
      gstPct:  prod ? (Number(prod.gst_percent) || 18) : 18,
      unit:    prod ? (prod.unit || 'Sq Ft') : 'Sq Ft',
    } : r))
  }

  /* ── Grand totals ── */
  const grandTotals = useMemo(() => rows.reduce((acc, r) => {
    const { amt, gst, total } = rowCalc(r)
    return { amt: acc.amt + amt, gst: acc.gst + gst, total: acc.total + total }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, { amt: 0, gst: 0, total: 0 }), [rows])

  /* ── Save ── */
  /* ── Save — sends all rows as ONE bill (items[]) in a single API call ── */
  const handleSave = async () => {
    const errs = {}
    const supplierVal = supplier === '__other__' ? customSupplier.trim() : supplier
    if (!supplierVal) errs.supplier = 'Supplier required'

    rows.forEach((r, i) => {
      if (!r.product_id)                                           errs[`p_${i}`]   = 'Select product'
      if (!r.qty || isNaN(Number(r.qty)) || Number(r.qty) < 1)   errs[`qty_${i}`] = 'Valid qty'
      if (!r.rate || isNaN(Number(r.rate)) || Number(r.rate) <= 0) errs[`rate_${i}`] = 'Valid rate'
    })

    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    try {
      const matchedSupplier = suppliers.find(s => s.name === supplierVal)
      const items = rows.map(row => {
        const prod = products.find(p => (p._id || p.id) === row.product_id)
        return {
          product_id:   row.product_id,
          product_code: prod?.code || '',
          product_name: prod?.name || '',
          qty:          Number(row.qty),
          rate:         Number(row.rate),
          unit:         row.unit || 'Sq Ft',
          gst_percent:  row.gstPct,
        }
      })

      await addPurchase?.({
        supplier_id:      matchedSupplier ? (matchedSupplier._id || matchedSupplier.id) : undefined,
        supplier_name:    supplierVal,
        warehouse_id:     warehouseId || undefined,
        branch_id:        branchId || undefined,
        branch_name:      branches.find(b => (b._id || b.id) === branchId)?.name || '',
        purchase_date:    date || new Date().toISOString().split('T')[0],
        invoice_number:   invoiceNo,
        delivery_number:  deliveryNo,
        due_date:         dueDate || undefined,
        items,           // ← all rows as one bill
      })

      toast(`✓ Purchase bill saved! ${rows.length} product(s) added.`)
      closeModal()
    } catch (e) {
      setErrors({ _global: 'Failed to save purchase. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  /* ── Status update — persists to DB via PATCH /purchases/:id/status ── */
  const [statusUpdating, setStatusUpdating] = useState({})   // { [id]: true } while saving

  const getStatus = (p) => purStatus(p)   // always read from server data

  const updateStatus = async (p, val) => {
    const id = p._id || p.id
    if (!id || !val) return
    if (val === purStatus(p)) return                          // no change
    setStatusUpdating(prev => ({ ...prev, [id]: true }))
    try {
      const result = await updatePurchaseStatus?.(id, val)
      if (result?.success === false) {
        toast(`✗ ${result.message || 'Status update failed'}`)
      } else {
        toast(`✓ Status updated to "${val}" for ${purCode(p)}`)
      }
    } catch {
      toast('✗ Status update failed. Please try again.')
    } finally {
      setStatusUpdating(prev => { const n = { ...prev }; delete n[id]; return n })
    }
  }

  /* ── Filtered list ── */
  const filtered = purchases.filter(p => {
    const st = getStatus(p)
    const matchSearch = (
      purSupplier(p).toLowerCase().includes(search.toLowerCase()) ||
      purCode(p).toLowerCase().includes(search.toLowerCase()) ||
      purProduct(p).toLowerCase().includes(search.toLowerCase())
    )
    const matchSupplier = !supplierFilter || purSupplier(p) === supplierFilter
    const matchStatus   = !statusFilter   || st === statusFilter
    const pDate = p.purchase_date ? p.purchase_date.split('T')[0] : ''
    const matchFrom = !dateFrom || pDate >= dateFrom
    const matchTo   = !dateTo   || pDate <= dateTo
    return matchSearch && matchSupplier && matchStatus && matchFrom && matchTo
  })

  // ── Pagination (10 rows per page) ──────────────────────────
  const total       = filtered.length
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage    = Math.min(page, totalPages)
  const paged       = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  /* ── Export — styled HTML document with product details + print ── */
  const handleExport = () => {
    const fmtN = (v) => {
      const n = parseFloat(v) || 0
      return n > 0 ? `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00'
    }

    const grandTotal  = filtered.reduce((a, p) => a + purTotal(p),  0)
    const grandAmount = filtered.reduce((a, p) => a + purAmount(p), 0)
    const grandGst    = filtered.reduce((a, p) => a + purGst(p),    0)
    const grandQty    = filtered.reduce((a, p) => a + (p.qty || 0), 0)

    const statusBadge = (st) => {
      const colors = {
        Pending:   'background:#FFFBEB;color:#D97706;border:1px solid #FDE68A;',
        Approved:  'background:#EFF6FF;color:#2563EB;border:1px solid #BFDBFE;',
        Received:  'background:#ECFDF5;color:#059669;border:1px solid #A7F3D0;',
        Completed: 'background:#F5F3FF;color:#7C3AED;border:1px solid #DDD6FE;',
        Cancelled: 'background:#FEF2F2;color:#DC2626;border:1px solid #FECACA;',
      }
      const s = colors[st] || 'background:#F1F5F9;color:#64748B;border:1px solid #E2E8F0;'
      return `<span style="display:inline-block;padding:2px 10px;border-radius:20px;font-size:10px;font-weight:700;${s}">${st}</span>`
    }

    const prodChip = (label, val) =>
      val ? `<span class="chip"><span class="chip-label">${label}:</span> ${val}</span>` : ''

    const tableRows = filtered.map((p, i) => {
      // Look up full product details from products array
      const prod = products.find(pr => (pr._id || pr.id) === (p.product_id || ''))
      const prodDetails = prod ? [
        prodChip('Code',     prod.code),
        prodChip('Brand',    prod.brand_name  || prod.brand),
        prodChip('Category', prod.category_name || prod.category),
        prodChip('Size',     prod.size ? prod.size.toUpperCase() + ' mm' : ''),
        prodChip('Finish',   prod.finish),
        prodChip('Grade',    prod.grade),
        prodChip('GST',      prod.gst_percent ? prod.gst_percent + '%' : ''),
        prodChip('Unit',     prod.unit),
      ].filter(Boolean).join('') : ''

      return `
      <tr>
        <td style="color:#64748B;">${i + 1}</td>
        <td><span class="id-code">${purCode(p)}</span></td>
        <td style="white-space:nowrap;">${purDate(p)}</td>
        <td><span class="supplier-name">${purSupplier(p)}</span></td>
        <td>
          <div class="prod-name">${purProduct(p)}</div>
          <div class="prod-chips">${prodDetails}</div>
        </td>
        <td class="c">${p.qty || 0}<br/><span style="font-size:9px;color:#64748B;">${p.unit || ''}</span></td>
        <td class="r">${fmtN(p.rate)}</td>
        <td class="r">${fmtN(purAmount(p))}</td>
        <td class="r" style="color:#64748B;">${fmtN(purGst(p))}</td>
        <td class="r" style="font-weight:700;color:#059669;">${fmtN(purTotal(p))}</td>
        <td style="font-family:monospace;font-size:10px;">${purInvoice(p)}</td>
        <td style="font-family:monospace;font-size:10px;">${purDelivery(p)}</td>
        <td class="c">${statusBadge(getStatus(p))}</td>
      </tr>`
    }).join('')

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Purchase Report — ${new Date().toLocaleDateString('en-IN')}</title>
  <style>
    @page { size: A4 landscape; margin: 12mm 10mm; }
    *{ box-sizing:border-box; margin:0; padding:0; }
    body{ font-family:'Segoe UI',Arial,sans-serif; font-size:11px; color:#1a2540; background:#fff; }

    /* ── Screen wrapper ── */
    .screen-wrap{ background:#f4f6fa; padding:32px 40px; min-height:100vh; }
    .wrap{ background:#fff; border-radius:14px; box-shadow:0 4px 24px rgba(0,0,0,.12); overflow:hidden; max-width:1400px; margin:0 auto; }

    /* ── Header ── */
    .hdr{ background:linear-gradient(135deg,#01152D,#02203F); color:#fff; padding:20px 28px; display:flex; justify-content:space-between; align-items:flex-start; }
    .hdr-left h1{ font-size:18px; font-weight:800; margin-bottom:3px; }
    .hdr-left p{ font-size:11px; opacity:.72; }
    .hdr-right{ text-align:right; }
    .hdr-badge{ display:inline-block; padding:3px 12px; background:rgba(253,92,2,.25); border:1px solid #FD5C02; border-radius:20px; font-size:10px; font-weight:700; color:#FFA05C; margin-bottom:5px; }
    .print-btn{ display:inline-flex; align-items:center; gap:5px; margin-top:8px; padding:7px 16px; background:#FD5C02; color:#fff; border:none; border-radius:7px; font-size:12px; font-weight:700; cursor:pointer; }
    .print-btn:hover{ background:#D94B00; }

    /* ── Summary bar ── */
    .summary{ display:grid; grid-template-columns:repeat(4,1fr); border-bottom:2px solid #E2E8F0; }
    .sm{ padding:14px 20px; border-right:1px solid #E2E8F0; }
    .sm:last-child{ border-right:none; }
    .sm-label{ font-size:9px; font-weight:800; text-transform:uppercase; letter-spacing:.07em; color:#64748B; margin-bottom:4px; }
    .sm-val{ font-size:18px; font-weight:800; color:#01152D; }
    .sm-val.orange{ color:#FD5C02; }
    .sm-val.green{ color:#059669; }

    /* ── Table ── */
    .tbl-wrap{ overflow-x:auto; }
    table{ width:100%; border-collapse:collapse; table-layout:fixed; }
    col.c-no    { width:28px; }
    col.c-id    { width:82px; }
    col.c-date  { width:72px; }
    col.c-sup   { width:110px; }
    col.c-prod  { width:200px; }
    col.c-qty   { width:60px; }
    col.c-rate  { width:68px; }
    col.c-amt   { width:74px; }
    col.c-gst   { width:64px; }
    col.c-total { width:80px; }
    col.c-inv   { width:80px; }
    col.c-del   { width:80px; }
    col.c-st    { width:68px; }

    thead tr th{
      background:#F8FAFC;
      font-size:8.5px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:#64748B;
      padding:8px 7px; text-align:left;
      border-bottom:2px solid #CBD5E1;
      border-right:1px solid #E2E8F0;
      white-space:nowrap;
    }
    thead tr th:last-child{ border-right:none; }
    thead tr th.r{ text-align:right; }
    thead tr th.c{ text-align:center; }

    tbody tr{ border-bottom:1px solid #F1F5F9; }
    tbody tr:nth-child(even){ background:#FAFBFF; }
    tbody tr:hover{ background:#F0F6FF; }
    td{ padding:8px 7px; font-size:11px; color:#1a2540; vertical-align:top; border-right:1px solid #F1F5F9; word-wrap:break-word; }
    td:last-child{ border-right:none; }
    td.r{ text-align:right; }
    td.c{ text-align:center; }

    .prod-name{ font-weight:700; font-size:12px; margin-bottom:3px; color:#01152D; }
    .prod-chips{ display:flex; flex-wrap:wrap; gap:2px; margin-top:3px; }
    .chip{ display:inline-block; background:#EFF6FF; border:1px solid #BFDBFE; border-radius:4px; padding:1px 6px; font-size:9px; color:#1D4ED8; white-space:nowrap; }
    .chip-label{ color:#64748B; font-weight:600; }

    .id-code{ font-family:monospace; font-weight:700; color:#FD5C02; font-size:11px; }
    .supplier-name{ font-weight:600; font-size:11px; }

    tfoot td{ padding:10px 7px; font-weight:800; font-size:12px; border-top:2px solid #CBD5E1; background:#F8FAFC; color:#01152D; }
    tfoot td.green{ color:#059669; }
    tfoot td.muted{ color:#64748B; }

    .ftr{ padding:12px 28px; background:#F8FAFC; border-top:1px solid #E2E8F0; font-size:10px; color:#94A3B8; display:flex; justify-content:space-between; }

    /* ── Print overrides ── */
    @media print{
      body{ background:#fff !important; }
      .screen-wrap{ background:#fff !important; padding:0 !important; }
      .wrap{ box-shadow:none !important; border-radius:0 !important; max-width:none !important; }
      .no-print{ display:none !important; }
      thead{ display:table-header-group; }
      tr{ page-break-inside:avoid; }
      .hdr{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      .summary{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      thead tr th{ -webkit-print-color-adjust:exact; print-color-adjust:exact; }
      tbody tr:nth-child(even){ -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    }
  </style>
</head>
<body>
<div class="screen-wrap">
<div class="wrap">

  <!-- Header -->
  <div class="hdr">
    <div class="hdr-left">
      <h1>Purchase Management Report</h1>
      <p>Generated: ${new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'long', year:'numeric' })} &nbsp;·&nbsp; ${filtered.length} Records</p>
    </div>
    <div class="hdr-right">
      <div class="hdr-badge">EzyEnquiry ERP</div>
      <div style="font-size:10px;opacity:.6;margin-top:3px;">Purchase &amp; Inventory Module</div>
      <div class="no-print">
        <button class="print-btn" onclick="window.print()">🖨️ Print / Save as PDF</button>
      </div>
    </div>
  </div>

  <!-- Summary -->
  <div class="summary">
    <div class="sm"><div class="sm-label">Total Records</div><div class="sm-val">${filtered.length}</div></div>
    <div class="sm"><div class="sm-label">Total Quantity</div><div class="sm-val">${grandQty.toLocaleString('en-IN')}</div></div>
    <div class="sm"><div class="sm-label">Amount (excl GST)</div><div class="sm-val orange">${fmtN(grandAmount)}</div></div>
    <div class="sm"><div class="sm-label">Grand Total (incl GST)</div><div class="sm-val green">${fmtN(grandTotal)}</div></div>
  </div>

  <!-- Table -->
  <div class="tbl-wrap">
    <table>
      <colgroup>
        <col class="c-no"/><col class="c-id"/><col class="c-date"/><col class="c-sup"/>
        <col class="c-prod"/><col class="c-qty"/><col class="c-rate"/>
        <col class="c-amt"/><col class="c-gst"/><col class="c-total"/>
        <col class="c-inv"/><col class="c-del"/><col class="c-st"/>
      </colgroup>
      <thead>
        <tr>
          <th>#</th>
          <th>Purchase ID</th>
          <th>Date</th>
          <th>Supplier</th>
          <th>Product &amp; Specifications</th>
          <th class="c">Qty / Unit</th>
          <th class="r">Rate</th>
          <th class="r">Amount</th>
          <th class="r">GST</th>
          <th class="r">Total</th>
          <th>Invoice No.</th>
          <th>Delivery No.</th>
          <th class="c">Status</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
      </tbody>
      <tfoot>
        <tr>
          <td colspan="5" style="text-align:right;font-size:11px;" class="muted">Grand Total</td>
          <td class="c">${grandQty}</td>
          <td class="r muted">—</td>
          <td class="r">${fmtN(grandAmount)}</td>
          <td class="r muted">${fmtN(grandGst)}</td>
          <td class="r green">${fmtN(grandTotal)}</td>
          <td colspan="3"></td>
        </tr>
      </tfoot>
    </table>
  </div>

  <!-- Footer -->
  <div class="ftr">
    <span>EzyEnquiry ERP &nbsp;·&nbsp; Purchase Management &nbsp;·&nbsp; Confidential</span>
    <span>Printed: ${new Date().toLocaleString('en-IN')}</span>
  </div>

</div>
</div>
</body></html>`

    const blob = new Blob([html], { type: 'text/html;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `Purchase_Report_${new Date().toISOString().split('T')[0]}.html`
    a.click()
    URL.revokeObjectURL(url)
    toast(`✓ Exported ${filtered.length} purchase records as HTML report`)
  }

  /* ── Unique suppliers for filter dropdown ── */
  const uniqueSuppliers = [...new Set(purchases.map(p => purSupplier(p)).filter(Boolean))]

  /* ── Stats ── */
  const totalPurchase  = purchases.reduce((a, p) => a + purTotal(p), 0)
  const totalQty       = purchases.reduce((a, p) => a + (p.qty || 0), 0)
  const countPending   = purchases.filter(p => getStatus(p) === 'Pending').length
  const countApproved  = purchases.filter(p => getStatus(p) === 'Approved').length
  const countReceived  = purchases.filter(p => getStatus(p) === 'Received').length
  const countCompleted = purchases.filter(p => getStatus(p) === 'Completed').length
  const countCancelled = purchases.filter(p => getStatus(p) === 'Cancelled').length


  return (
    <>
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <span>Purchase &amp; Inventory</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Purchase Management</span>
      </div>

      {/* Toast */}
      {successMsg && (
        <div className="alert alert-success" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircle style={{ color: 'var(--success)', width: 18, flexShrink: 0 }} />
          <span style={{ fontWeight: 600 }}>{successMsg}</span>
        </div>
      )}

      {/* Stats — colored clickable filter cards */}
      {(() => {
        const STAT_STYLES = {
          total:     { bg: '#EFF6FF', iconBg: '#DBEAFE', iconColor: '#2563EB', textColor: '#1D4ED8', borderColor: '#BFDBFE' },
          Pending:   { bg: '#FFFBEB', iconBg: '#FEF3C7', iconColor: '#D97706', textColor: '#B45309', borderColor: '#FDE68A' },
          Approved:  { bg: '#EFF6FF', iconBg: '#DBEAFE', iconColor: '#2563EB', textColor: '#1D4ED8', borderColor: '#BFDBFE' },
          Received:  { bg: '#ECFDF5', iconBg: '#D1FAE5', iconColor: '#059669', textColor: '#047857', borderColor: '#A7F3D0' },
          Completed: { bg: '#F5F3FF', iconBg: '#EDE9FE', iconColor: '#7C3AED', textColor: '#6D28D9', borderColor: '#DDD6FE' },
          Cancelled: { bg: '#FEF2F2', iconBg: '#FEE2E2', iconColor: '#DC2626', textColor: '#B91C1C', borderColor: '#FECACA' },
        }
        const stats = [
          { label: 'Total Purchase Value', val: `₹${totalPurchase.toLocaleString('en-IN')}`, key: 'total',     filterVal: null          },
          { label: 'Pending',              val: countPending,                                 key: 'Pending',   filterVal: 'Pending'     },
          { label: 'Approved',             val: countApproved,                                key: 'Approved',  filterVal: 'Approved'    },
          { label: 'Received',             val: countReceived,                                key: 'Received',  filterVal: 'Received'    },
          { label: 'Completed',            val: countCompleted,                               key: 'Completed', filterVal: 'Completed'   },
          { label: 'Cancelled',            val: countCancelled,                               key: 'Cancelled', filterVal: 'Cancelled'   },
        ]
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            {stats.map(s => {
              const st       = STAT_STYLES[s.key]
              const isActive = s.filterVal && statusFilter === s.filterVal
              return (
                <div
                  key={s.label}
                  onClick={() => { if (s.filterVal) { setStatusFilter(prev => prev === s.filterVal ? '' : s.filterVal); setPage(1) } }}
                  style={{
                    background:   isActive ? st.iconBg : st.bg,
                    border:       `1.5px solid ${isActive ? st.iconColor : st.borderColor}`,
                    borderRadius: 10,
                    padding:      '13px 15px',
                    cursor:       s.filterVal ? 'pointer' : 'default',
                    display:      'flex',
                    alignItems:   'center',
                    gap:          11,
                    boxShadow:    isActive ? `0 0 0 3px ${st.borderColor}` : 'var(--shadow)',
                    transition:   'all 0.15s',
                  }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 9, flexShrink: 0, background: st.iconBg, border: `1px solid ${st.borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShoppingBag size={17} style={{ color: st.iconColor }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: st.textColor, marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontSize: s.key === 'total' ? 16 : 22, fontWeight: 800, color: st.textColor, lineHeight: 1 }}>{s.val}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* ── Filter Bar — OUTSIDE card, equal-width single row ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 14px' }}>
        {/* Search */}
        <div style={{ flex: 2, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, padding: '0 10px', height: 34 }}>
          <Search size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            style={{ border: 'none', outline: 'none', background: 'transparent', fontSize: 12, width: '100%', color: 'var(--text)' }}
            placeholder="Search ID, supplier, product…"
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>

        {/* Supplier */}
        <select
          className="form-control"
          style={{ flex: 2, minWidth: 0, fontSize: 12, padding: '4px 8px', height: 34 }}
          value={supplierFilter}
          onChange={e => { setSupplierFilter(e.target.value); setPage(1) }}
        >
          <option value="">All Suppliers</option>
          {uniqueSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Status */}
        <select
          className="form-control"
          style={{ flex: 1, minWidth: 0, fontSize: 12, padding: '4px 8px', height: 34 }}
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(1) }}
        >
          <option value="">All Status</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Received">Received</option>
          <option value="Completed">Completed</option>
          <option value="Cancelled">Cancelled</option>
        </select>

        {/* From date */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>From</span>
          <input
            type="date"
            className="form-control"
            style={{ flex: 1, minWidth: 0, fontSize: 12, padding: '4px 6px', height: 34 }}
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(1) }}
          />
        </div>

        {/* To date */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>To</span>
          <input
            type="date"
            className="form-control"
            style={{ flex: 1, minWidth: 0, fontSize: 12, padding: '4px 6px', height: 34 }}
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(1) }}
          />
        </div>

        {/* Reset */}
        {(search || supplierFilter || statusFilter || dateFrom || dateTo) && (
          <button
            className="btn btn-secondary"
            style={{ fontSize: 12, padding: '4px 10px', height: 34, flexShrink: 0, whiteSpace: 'nowrap' }}
            onClick={() => { setSearch(''); setSupplierFilter(''); setStatusFilter(''); setDateFrom(''); setDateTo(''); setPage(1) }}
          >
            <RefreshCw size={12} /> Reset
          </button>
        )}

        <span style={{ fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
          {filtered.length}/{purchases.length}
        </span>
      </div>

      {/* Table card */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Purchase Entries ({filtered.length})</span>
          <div className="header-actions">
            <button className="btn btn-secondary" onClick={handleExport}><Download style={{ width: 15 }} />Export Report</button>
            <button className="btn btn-primary" onClick={openModal}><Plus />New Purchase</button>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ padding: '10px 14px' }}>Purchase ID</th>
                <th style={{ padding: '10px 14px' }}>Date</th>
                <th style={{ padding: '10px 14px' }}>Supplier</th>
                <th style={{ padding: '10px 14px' }}>Branch</th>
                <th style={{ padding: '10px 14px' }}>Warehouse</th>
                <th style={{ padding: '10px 14px' }}>Product</th>
                <th style={{ padding: '10px 14px' }}>Qty</th>
                <th style={{ padding: '10px 14px' }}>Rate</th>
                <th style={{ padding: '10px 14px' }}>Amount</th>
                <th style={{ padding: '10px 14px' }}>GST</th>
                <th style={{ padding: '10px 14px' }}>Total</th>
                <th style={{ padding: '10px 14px' }}>Invoice No.</th>
                <th style={{ padding: '10px 14px' }}>Delivery No.</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Payment</th>
                <th style={{ padding: '10px 14px', textAlign: 'center' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(p => (
                <tr key={p._id || p.id}>
                  <td style={{ padding: '11px 14px', color: 'var(--primary)', fontWeight: 700 }}>{purCode(p)}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12 }}>{purDate(p)}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 600 }}>{purSupplier(p)}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12 }}>
                    {(() => {
                      // First use stored branch_name, then lookup by branch_id, then fallback
                      const bName = p.branch_name
                        || branches.find(b => (b._id || b.id) === (p.branch_id || p.branch))?.name
                        || ''
                      return bName
                        ? <span style={{ fontWeight: 600 }}>{bName}</span>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>
                    })()}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 12 }}>
                    {(() => {
                      const wName = purWarehouse(p, warehouses)
                      return wName !== '—'
                        ? <span style={{ fontWeight: 600, fontSize: 12 }}>{wName}</span>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>
                    })()}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 12 }}>{purProduct(p)}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 700 }}>{(p.qty || 0).toLocaleString()} {p.unit || ''}</td>
                  <td style={{ padding: '11px 14px' }}>₹{(p.rate || 0).toLocaleString('en-IN')}</td>
                  <td style={{ padding: '11px 14px' }}>₹{purAmount(p).toLocaleString('en-IN')}</td>
                  <td style={{ padding: '11px 14px', color: 'var(--text-muted)' }}>₹{purGst(p).toLocaleString('en-IN')}</td>
                  <td style={{ padding: '11px 14px', fontWeight: 700, color: 'var(--primary)' }}>₹{purTotal(p).toLocaleString('en-IN')}</td>
                  <td style={{ padding: '11px 14px', fontSize: 12 }}>
                    {purInvoice(p) !== '—'
                      ? <span style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 7px', fontWeight: 600, fontSize: 11 }}>{purInvoice(p)}</span>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '11px 14px', fontSize: 12 }}>
                    {purDelivery(p) !== '—'
                      ? <span style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 4, padding: '2px 7px', fontWeight: 600, fontSize: 11, color: '#1d4ed8' }}>{purDelivery(p)}</span>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td style={{ padding: '11px 14px', textAlign: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                      {/* View */}
                      <button
                        title="View Details"
                        onClick={() => setViewItem(p)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: 30, height: 30, borderRadius: 6,
                          background: '#eff6ff', border: '1px solid #bfdbfe',
                          color: '#2563eb', cursor: 'pointer',
                        }}
                      >
                        <Eye size={14} />
                      </button>
                      {/* Edit */}
                      <button
                        title="Edit"
                        onClick={() => openEdit(p)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: 30, height: 30, borderRadius: 6,
                          background: '#fefce8', border: '1px solid #fde68a',
                          color: '#d97706', cursor: 'pointer',
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      {/* Delete */}
                      <button
                        title="Delete"
                        onClick={() => { setDeleteItem(p); setDeleteConfirm('') }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: 30, height: 30, borderRadius: 6,
                          background: '#fef2f2', border: '1px solid #fecaca',
                          color: '#dc2626', cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={13} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
                  <ShoppingBag size={32} style={{ opacity: .25, marginBottom: 8, display: 'block', margin: '0 auto 8px' }} />
                  No purchase entries yet
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="pagination">
            <span className="pagination-info">
              {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, total)} of {total}
            </span>
            <button className="pagination-btn" disabled={safePage === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
              <ChevronLeft size={13} />
            </button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const n = totalPages <= 5 ? i + 1 : Math.max(1, Math.min(safePage - 2, totalPages - 4)) + i
              return (
                <button key={n} className={`pagination-btn${n === safePage ? ' active' : ''}`} onClick={() => setPage(n)}>
                  {n}
                </button>
              )
            })}
            <button className="pagination-btn" disabled={safePage === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
              <ChevronRight size={13} />
            </button>
          </div>
        )}
      </div>

      {/* ═══════════ NEW PURCHASE MODAL ═══════════ */}
      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal"
            style={{ maxWidth: 820, width: '96vw' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <PackageCheck style={{ color: 'var(--primary)', width: 20 }} />
                <span className="modal-title">New Purchase Entry</span>
              </div>
              <button className="btn-ghost" onClick={closeModal}><X size={18} /></button>
            </div>

            {/* Body */}
            <div className="modal-body" style={{ padding: '18px 22px' }}>

              {/* Global error */}
              {errors._global && (
                <div className="alert alert-danger" style={{ marginBottom: 14 }}>{errors._global}</div>
              )}

              <div className="alert alert-info" style={{ marginBottom: 16, fontSize: 12, padding: '8px 12px' }}>
                ℹ️ Saving this entry will automatically update inventory stock for each product.
              </div>

              {/* ── Row 1: Supplier + Warehouse ── */}
              <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Supplier / Manufacturer *</label>
                  <select
                    className={`form-control${errors.supplier ? ' error' : ''}`}
                    value={supplier}
                    onChange={e => setSupplier(e.target.value)}
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.length > 0 ? (
                      <>
                        {suppliers.filter(s => s.is_active !== false).map(s => {
                          const sid = s._id || s.id
                          return (
                            <option key={sid} value={s.name}>
                              {s.name}{s.city ? ` — ${s.city}` : ''}
                            </option>
                          )
                        })}
                        <option value="__other__">Other (type below)</option>
                      </>
                    ) : (
                      <>
                        <option value="Kajaria Ceramics Ltd">Kajaria Ceramics Ltd</option>
                        <option value="Somany Ceramics">Somany Ceramics</option>
                        <option value="Johnson Tiles Pvt Ltd">Johnson Tiles Pvt Ltd</option>
                        <option value="Asian Granito Industries Ltd">Asian Granito Industries Ltd</option>
                        <option value="RAK Ceramics India Pvt Ltd">RAK Ceramics India Pvt Ltd</option>
                        <option value="Nitco Tiles Ltd">Nitco Tiles Ltd</option>
                        <option value="Orient Bell Ltd">Orient Bell Ltd</option>
                        <option value="__other__">Other (type below)</option>
                      </>
                    )}
                  </select>
                  {errors.supplier && <div className="form-error">{errors.supplier}</div>}
                  {supplier === '__other__' && (
                    <input
                      className="form-control"
                      style={{ marginTop: 8 }}
                      placeholder="Enter supplier name"
                      value={customSupplier}
                      onChange={e => setCustomSupplier(e.target.value)}
                    />
                  )}
                  {suppliers.length > 0 && (
                    <div style={{ marginTop: 5, fontSize: 11, color: 'var(--text-muted)' }}>
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 11, padding: 0 }}
                        onClick={() => navigate('/purchase-inventory/supplier-management')}
                      >
                        + Add new supplier
                      </button>
                    </div>
                  )}
                </div>

                {/* Warehouse */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Warehouse size={13} style={{ color: 'var(--text-muted)' }} /> Warehouse
                  </label>
                  <select
                    className="form-control"
                    value={warehouseId}
                    onChange={e => setWarehouseId(e.target.value)}
                  >
                    <option value="">Select Warehouse (optional)</option>
                    {warehouses.length > 0 ? (
                      warehouses.filter(w => w.is_active !== false).map(w => {
                        const wid = w._id || w.id
                        return (
                          <option key={wid} value={wid}>
                            {w.name}{w.location ? ` — ${w.location}` : ''}{w.city ? ` (${w.city})` : ''}
                          </option>
                        )
                      })
                    ) : (
                      <option disabled value="">No warehouses found</option>
                    )}
                  </select>
                  {warehouses.length === 0 && (
                    <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                      <button
                        type="button"
                        style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: 11, padding: 0 }}
                        onClick={() => navigate('/purchase-inventory/warehouse-management')}
                      >
                        + Add warehouse first
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* ── Branch ── */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Branch</label>
                <select
                  className="form-control"
                  value={branchId}
                  onChange={e => setBranchId(e.target.value)}
                >
                  <option value="">— Select Branch —</option>
                  {branches.filter(b => b.status !== 'Inactive').map(b => (
                    <option key={b._id || b.id} value={b._id || b.id}>
                      {b.name}{b.code ? ` (${b.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* ── Row 2: Date + Invoice + Delivery (Purchase ID auto-generated) ── */}
              <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 18 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Purchase Date</label>
                  <input className="form-control" type="date" value={date} onChange={e => setDate(e.target.value)} />
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
                    Defaults to today if left blank
                  </div>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Invoice / Bill Number</label>
                  <input
                    className="form-control"
                    placeholder="e.g. INV-2024-001"
                    value={invoiceNo}
                    onChange={e => setInvoiceNo(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Delivery / Docket Number</label>
                  <input
                    className="form-control"
                    placeholder="e.g. DLV-78901 / LR No."
                    value={deliveryNo}
                    onChange={e => setDeliveryNo(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Payment Due Date</label>
                  <input className="form-control" type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>When supplier payment is due</div>
                </div>
              </div>

              {/* ── Products Table ── */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>Products *</span>
                  <button className="btn btn-outline btn-sm" type="button" onClick={addRow}>
                    <Plus size={13} /> Add Product
                  </button>
                </div>

                <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700, tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: 36 }} />
                      <col style={{ width: 'auto' }} />
                      <col style={{ width: 90 }} />
                      <col style={{ width: 100 }} />
                      <col style={{ width: 80 }} />
                      <col style={{ width: 120 }} />
                      <col style={{ width: 110 }} />
                      <col style={{ width: 40 }} />
                    </colgroup>
                    <thead>
                      <tr style={{ background: 'var(--bg)' }}>
                        <th style={thStyle}>#</th>
                        <th style={thStyle}>Product</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Qty</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Rate (₹)</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>GST %</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                        <th style={thStyle}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, i) => {
                        const { amt, gst, total } = rowCalc(row)
                        const prodObj = products.find(p => (p._id || p.id) === row.product_id)
                        return (
                          <Fragment key={row.uid}>
                            <tr style={{ borderBottom: prodObj ? 'none' : '1px solid var(--border)', background: 'var(--surface)' }}>
                              {/* # */}
                              <td style={{ ...tdStyle, verticalAlign: 'middle', color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>{i + 1}</td>

                              {/* Product select */}
                              <td style={{ ...tdStyle, verticalAlign: 'middle', padding: '10px 10px' }}>
                                <select
                                  className={`form-control${errors[`p_${i}`] ? ' error' : ''}`}
                                  style={{ fontSize: 12, padding: '7px 8px', width: '100%' }}
                                  value={row.product_id}
                                  onChange={e => handleProductSelect(row.uid, e.target.value)}
                                >
                                  <option value="">— Select product —</option>
                                  {products.map(p => {
                                    const pid = p._id || p.id
                                    const label = [p.name, p.size && `(${p.size})`, p.finish].filter(Boolean).join(' ')
                                    return <option key={pid} value={pid}>{label}</option>
                                  })}
                                </select>
                                {errors[`p_${i}`] && <div className="form-error" style={{ fontSize: 10 }}>{errors[`p_${i}`]}</div>}
                              </td>

                              {/* Qty */}
                              <td style={{ ...tdStyle, verticalAlign: 'middle', padding: '10px 6px' }}>
                                <input
                                  className={`form-control${errors[`qty_${i}`] ? ' error' : ''}`}
                                  style={{ fontSize: 12, padding: '7px 8px', textAlign: 'right', width: '100%' }}
                                  type="number" min="1" placeholder="0"
                                  value={row.qty}
                                  onChange={e => setRow(row.uid, 'qty', e.target.value)}
                                />
                                {row.unit && <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right', marginTop: 2 }}>{row.unit}</div>}
                                {errors[`qty_${i}`] && <div className="form-error" style={{ fontSize: 10 }}>{errors[`qty_${i}`]}</div>}
                              </td>

                              {/* Rate */}
                              <td style={{ ...tdStyle, verticalAlign: 'middle', padding: '10px 6px' }}>
                                <input
                                  className={`form-control${errors[`rate_${i}`] ? ' error' : ''}`}
                                  style={{ fontSize: 12, padding: '7px 8px', textAlign: 'right', width: '100%' }}
                                  type="number" min="0" step="0.01" placeholder="0.00"
                                  value={row.rate}
                                  onChange={e => setRow(row.uid, 'rate', e.target.value)}
                                />
                                {errors[`rate_${i}`] && <div className="form-error" style={{ fontSize: 10 }}>{errors[`rate_${i}`]}</div>}
                              </td>

                              {/* GST */}
                              <td style={{ ...tdStyle, verticalAlign: 'middle', padding: '10px 6px' }}>
                                <select
                                  className="form-control"
                                  style={{ fontSize: 12, padding: '7px 6px', width: '100%', textAlign: 'center' }}
                                  value={row.gstPct}
                                  onChange={e => setRow(row.uid, 'gstPct', Number(e.target.value))}
                                >
                                  {[0, 5, 12, 18, 28].map(g => <option key={g} value={g}>{g}%</option>)}
                                </select>
                              </td>

                              {/* Amount */}
                              <td style={{ ...tdStyle, verticalAlign: 'middle', textAlign: 'right', padding: '10px 10px' }}>
                                {amt > 0 ? (
                                  <>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>₹{amt.toLocaleString('en-IN')}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>+₹{gst.toLocaleString('en-IN')} GST</div>
                                  </>
                                ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                              </td>

                              {/* Total */}
                              <td style={{ ...tdStyle, verticalAlign: 'middle', textAlign: 'right', padding: '10px 10px', fontWeight: 800, color: total > 0 ? 'var(--primary)' : 'var(--text-muted)', fontSize: total > 0 ? 14 : 12 }}>
                                {total > 0 ? `₹${total.toLocaleString('en-IN')}` : '—'}
                              </td>

                              {/* Remove */}
                              <td style={{ ...tdStyle, verticalAlign: 'middle', textAlign: 'center', padding: '10px 4px' }}>
                                <button
                                  className="btn-ghost"
                                  type="button"
                                  style={{ color: 'var(--danger)', padding: 5 }}
                                  onClick={() => removeRow(row.uid)}
                                  title="Remove"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>

                            {/* Product detail sub-row — spans full width */}
                            {prodObj && (
                              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                                <td colSpan={8} style={{ padding: '6px 14px 10px 50px' }}>
                                  <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))',
                                    gap: '6px 16px',
                                  }}>
                                    {[
                                      { label: 'Brand',      val: prodObj.brand_name    || prodObj.brand },
                                      { label: 'Category',   val: prodObj.category_name || prodObj.category },
                                      { label: 'Sub-Cat',    val: prodObj.sub_category_name || prodObj.sub_category },
                                      { label: 'Size',       val: prodObj.size },
                                      { label: 'Finish',     val: prodObj.finish },
                                      { label: 'Tile Type',  val: prodObj.tile_type },
                                      { label: 'Grade',      val: prodObj.grade },
                                      { label: 'Unit',       val: prodObj.unit },
                                      { label: 'GST',        val: prodObj.gst_percent ? `${prodObj.gst_percent}%` : null },
                                      { label: 'MRP',        val: parseFloat(prodObj.mrp) > 0 ? `₹${parseFloat(prodObj.mrp).toLocaleString('en-IN')}` : null },
                                      { label: 'Retail',     val: parseFloat(prodObj.retail_price  || prodObj.retail_rate)   > 0 ? `₹${parseFloat(prodObj.retail_price  || prodObj.retail_rate ).toLocaleString('en-IN')}` : null },
                                      { label: 'Dealer',     val: parseFloat(prodObj.dealer_price  || prodObj.dealer_rate)   > 0 ? `₹${parseFloat(prodObj.dealer_price  || prodObj.dealer_rate ).toLocaleString('en-IN')}` : null },
                                      { label: 'Purchase ✓', val: parseFloat(prodObj.purchase_price|| prodObj.purchase_rate) > 0 ? `₹${parseFloat(prodObj.purchase_price|| prodObj.purchase_rate).toLocaleString('en-IN')}` : null, highlight: true },
                                      { label: 'Pcs/Box',   val: prodObj.pcs_per_box ? String(prodObj.pcs_per_box) : null },
                                      { label: 'Sqft/Box',  val: prodObj.sqft_per_box ? parseFloat(prodObj.sqft_per_box).toFixed(2) : null },
                                    ].filter(f => f.val).map(f => (
                                      <div key={f.label}>
                                        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted)' }}>{f.label}</div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: f.highlight ? '#059669' : 'var(--text)', marginTop: 1 }}>{f.val}</div>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </tbody>

                    {/* Grand total footer */}
                    {rows.length > 1 && (
                      <tfoot>
                        <tr style={{ background: 'var(--bg)', borderTop: '2px solid var(--border)' }}>
                          <td colSpan={4} style={{ ...tdStyle, fontWeight: 700, fontSize: 12, color: 'var(--text-muted)' }}>
                            Grand Total ({rows.length} products)
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {/* GST summary */}
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>GST</div>
                            <div style={{ fontWeight: 700, fontSize: 12 }}>₹{grandTotals.gst.toLocaleString()}</div>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Amount</div>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>₹{grandTotals.amt.toLocaleString()}</div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>+₹{grandTotals.gst.toLocaleString()} GST</div>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total</div>
                            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--primary)' }}>₹{grandTotals.total.toLocaleString()}</div>
                          </td>
                          <td style={tdStyle}></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>

              {/* Single product summary */}
              {rows.length === 1 && rows[0].qty && rows[0].rate && (() => {
                const { amt, gst, total } = rowCalc(rows[0])
                return (
                  <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', marginTop: 10, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                    {[
                      { label: 'Amount',              val: `₹${amt.toLocaleString()}` },
                      { label: `GST (${rows[0].gstPct}%)`, val: `₹${gst.toLocaleString()}` },
                      { label: 'Total',               val: `₹${total.toLocaleString()}`, bold: true },
                    ].map(item => (
                      <div key={item.label}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 1 }}>{item.label}</div>
                        <div style={{ fontSize: item.bold ? 16 : 14, fontWeight: item.bold ? 800 : 600, color: item.bold ? 'var(--primary)' : 'var(--text)' }}>
                          {item.val}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>

            {/* Footer */}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeModal} disabled={saving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : `Save Purchase${rows.length > 1 ? ` (${rows.length} products)` : ''} & Update Inventory`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ VIEW MODAL ═══════════ */}
      {viewItem && (() => {
        const st = getStatus(viewItem)
        const STATUS_BADGE = {
          Pending:   { bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' },
          Approved:  { bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
          Received:  { bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
          Completed: { bg: '#F5F3FF', color: '#7C3AED', border: '#DDD6FE' },
          Cancelled: { bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
        }
        const statusBadge = STATUS_BADGE[st] || { bg: '#F1F5F9', color: '#64748B', border: '#E2E8F0' }
        const prod = products.find(p => (p._id || p.id) === viewItem.product_id)
        const inv  = purInvoice(viewItem)
        const dlv  = purDelivery(viewItem)
        return (
          <div className="modal-overlay" onClick={() => setViewItem(null)}>
            <div className="modal" style={{ maxWidth: 680, width: '96vw' }} onClick={e => e.stopPropagation()}>

              <div className="modal-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Eye style={{ color: '#2563eb', width: 20 }} />
                  <span className="modal-title">Purchase Details</span>
                </div>
                <button className="btn-ghost" onClick={() => setViewItem(null)}><X size={18} /></button>
              </div>

              <div className="modal-body" style={{ padding: '0', overflowY: 'auto', maxHeight: '80vh' }}>

                {/* ── Top header strip ── */}
                <div style={{ padding: '16px 22px', background: 'var(--bg)', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Purchase ID</div>
                    <div style={{ fontWeight: 800, fontSize: 22, color: 'var(--primary)', lineHeight: 1.2 }}>{purCode(viewItem) || '—'}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{purDate(viewItem)}</div>
                  </div>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: statusBadge.bg, color: statusBadge.color,
                    border: `1.5px solid ${statusBadge.border}`,
                    borderRadius: 20, padding: '6px 16px', fontWeight: 700, fontSize: 14,
                  }}>
                    {st === 'Received' ? '✅' : st === 'Completed' ? '🏁' : '⏳'} {st}
                  </span>
                </div>

                <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                  {/* ── Purchase Info ── */}
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 8 }}>Purchase Info</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 14px' }}>
                      {[
                        { label: 'Supplier',     val: purSupplier(viewItem) || '—' },
                        { label: 'Product',      val: purProduct(viewItem) || prod?.name || '—' },
                        { label: 'Warehouse',    val: purWarehouse(viewItem, warehouses) },
                        { label: 'Purchase Date',val: purDate(viewItem) || '—' },
                        { label: 'Invoice No.',  val: inv !== '—' ? inv : '—' },
                        { label: 'Delivery No.', val: dlv !== '—' ? dlv : '—' },
                      ].map(f => (
                        <div key={f.label} style={{ background: 'var(--bg)', borderRadius: 7, padding: '9px 12px' }}>
                          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 3 }}>{f.label}</div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: f.val === '—' ? 'var(--text-muted)' : 'var(--text)' }}>{f.val}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── Financial Summary ── */}
                  <div style={{ background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)' }}>Financial Summary</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 0 }}>
                      {[
                        { label: 'Quantity', val: `${(viewItem.qty || 0).toLocaleString('en-IN')} ${viewItem.unit || 'Sq Ft'}` },
                        { label: 'Rate / Unit', val: `₹${(viewItem.rate || 0).toLocaleString('en-IN')}` },
                        { label: 'Base Amount', val: `₹${purAmount(viewItem).toLocaleString('en-IN')}` },
                        { label: `GST ${viewItem.gst_percent ? `(${viewItem.gst_percent}%)` : ''}`, val: `₹${purGst(viewItem).toLocaleString('en-IN')}` },
                      ].map((f, i) => (
                        <div key={f.label} style={{ padding: '12px 14px', borderRight: i < 3 ? '1px solid var(--border)' : 'none', textAlign: 'center' }}>
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 5 }}>{f.label}</div>
                          <div style={{ fontSize: 15, fontWeight: 700 }}>{f.val}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: '12px 18px', borderTop: '2px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)' }}>Grand Total (incl. GST)</span>
                      <span style={{ fontSize: 24, fontWeight: 800, color: 'var(--primary)' }}>₹{purTotal(viewItem).toLocaleString('en-IN')}</span>
                    </div>
                  </div>

                  {/* ── Product Details ── */}
                  {prod ? (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--text-muted)', marginBottom: 8 }}>Product Details</div>
                      <div style={{ background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)', overflow: 'hidden' }}>
                        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{prod.name}</span>
                          {prod.code && <span style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px' }}>{prod.code}</span>}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px,1fr))', gap: '8px 14px', padding: '12px 14px' }}>
                          {[
                            { label: 'Brand',       val: prod.brand_name    || prod.brand },
                            { label: 'Category',    val: prod.category_name || prod.category },
                            { label: 'Sub-Category',val: prod.sub_category_name || prod.sub_category },
                            { label: 'Size',        val: prod.size },
                            { label: 'Finish',      val: prod.finish },
                            { label: 'Tile Type',   val: prod.tile_type },
                            { label: 'Grade',       val: prod.grade },
                            { label: 'Unit',        val: prod.unit },
                            { label: 'Pcs / Box',   val: prod.pcs_per_box ? String(prod.pcs_per_box) : null },
                            { label: 'Sqft / Box',  val: prod.sqft_per_box ? parseFloat(prod.sqft_per_box).toFixed(2) : null },
                            { label: 'GST %',       val: prod.gst_percent ? `${prod.gst_percent}%` : null },
                            { label: 'MRP',         val: parseFloat(prod.mrp) > 0 ? `₹${parseFloat(prod.mrp).toLocaleString('en-IN')}` : null },
                            { label: 'Retail Price',val: parseFloat(prod.retail_price  || prod.retail_rate)  > 0 ? `₹${parseFloat(prod.retail_price  || prod.retail_rate ).toLocaleString('en-IN')}` : null },
                            { label: 'Dealer Price',val: parseFloat(prod.dealer_price  || prod.dealer_rate)  > 0 ? `₹${parseFloat(prod.dealer_price  || prod.dealer_rate ).toLocaleString('en-IN')}` : null },
                            { label: 'Purchase Price', val: parseFloat(prod.purchase_price || prod.purchase_rate) > 0 ? `₹${parseFloat(prod.purchase_price || prod.purchase_rate).toLocaleString('en-IN')}` : null, highlight: true },
                          ].filter(f => f.val).map(f => (
                            <div key={f.label}>
                              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted)', marginBottom: 2 }}>{f.label}</div>
                              <div style={{ fontSize: 12, fontWeight: 700, color: f.highlight ? '#059669' : 'var(--text)' }}>{f.val}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : viewItem.product_name || viewItem.product ? (
                    <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', border: '1px solid var(--border)', fontSize: 13 }}>
                      <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>Product: </span>
                      <span style={{ fontWeight: 700 }}>{viewItem.product_name || viewItem.product}</span>
                    </div>
                  ) : null}

                </div>
              </div>

              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setViewItem(null)}>Close</button>
                <button className="btn btn-primary" onClick={() => { openEdit(viewItem); setViewItem(null) }}>
                  <Pencil size={14} /> Edit
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      {/* ═══════════ EDIT MODAL — full form ═══════════ */}
      {editItem && (
        <div className="modal-overlay" onClick={closeEdit}>
          <div className="modal" style={{ maxWidth: 820, width: '96vw' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Pencil style={{ color: '#d97706', width: 20 }} />
                <span className="modal-title">Edit Purchase — {purCode(editItem)}</span>
              </div>
              <button className="btn-ghost" onClick={closeEdit}><X size={18} /></button>
            </div>

            {/* Body */}
            <div className="modal-body" style={{ padding: '18px 22px' }}>
              {editErrors._global && (
                <div className="alert alert-danger" style={{ marginBottom: 14 }}>{editErrors._global}</div>
              )}

              {/* ── Row 1: Supplier + Warehouse ── */}
              <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Supplier / Manufacturer *</label>
                  <select
                    className={`form-control${editErrors.supplier ? ' error' : ''}`}
                    value={editSupplier}
                    onChange={e => setEditSupplier(e.target.value)}
                  >
                    <option value="">Select Supplier</option>
                    {suppliers.length > 0 ? (
                      <>
                        {suppliers.filter(s => s.is_active !== false).map(s => {
                          const sid = s._id || s.id
                          return <option key={sid} value={s.name}>{s.name}{s.city ? ` — ${s.city}` : ''}</option>
                        })}
                        <option value="__other__">Other (type below)</option>
                      </>
                    ) : (
                      <>
                        <option value="Kajaria Ceramics Ltd">Kajaria Ceramics Ltd</option>
                        <option value="Somany Ceramics">Somany Ceramics</option>
                        <option value="Johnson Tiles Pvt Ltd">Johnson Tiles Pvt Ltd</option>
                        <option value="Asian Granito Industries Ltd">Asian Granito Industries Ltd</option>
                        <option value="RAK Ceramics India Pvt Ltd">RAK Ceramics India Pvt Ltd</option>
                        <option value="Nitco Tiles Ltd">Nitco Tiles Ltd</option>
                        <option value="Orient Bell Ltd">Orient Bell Ltd</option>
                        <option value="__other__">Other (type below)</option>
                      </>
                    )}
                  </select>
                  {editErrors.supplier && <div className="form-error">{editErrors.supplier}</div>}
                  {editSupplier === '__other__' && (
                    <input
                      className="form-control"
                      style={{ marginTop: 8 }}
                      placeholder="Enter supplier name"
                      value={editCustomSup}
                      onChange={e => setEditCustomSup(e.target.value)}
                    />
                  )}
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Warehouse size={13} style={{ color: 'var(--text-muted)' }} /> Warehouse
                  </label>
                  <select
                    className="form-control"
                    value={editWarehouse}
                    onChange={e => setEditWarehouse(e.target.value)}
                  >
                    <option value="">Select Warehouse (optional)</option>
                    {warehouses.filter(w => w.is_active !== false).map(w => {
                      const wid = w._id || w.id
                      return (
                        <option key={wid} value={wid}>
                          {w.name}{w.location ? ` — ${w.location}` : ''}{w.city ? ` (${w.city})` : ''}
                        </option>
                      )
                    })}
                  </select>
                </div>
              </div>

              {/* ── Edit Branch ── */}
              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Branch</label>
                <select
                  className="form-control"
                  value={editBranchId}
                  onChange={e => setEditBranchId(e.target.value)}
                >
                  <option value="">— Select Branch —</option>
                  {branches.filter(b => b.status !== 'Inactive').map(b => (
                    <option key={b._id || b.id} value={b._id || b.id}>
                      {b.name}{b.code ? ` (${b.code})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* ── Row 2: Date + Invoice + Delivery (Purchase ID auto-generated) ── */}
              <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: 14, marginBottom: 18 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Purchase Date</label>
                  <input
                    className="form-control"
                    type="date"
                    value={editDate}
                    onChange={e => setEditDate(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Invoice / Bill Number</label>
                  <input
                    className="form-control"
                    placeholder="e.g. INV-2024-001"
                    value={editInvoice}
                    onChange={e => setEditInvoice(e.target.value)}
                  />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Delivery / Docket No.</label>
                  <input
                    className="form-control"
                    placeholder="e.g. DLV-78901 / LR No."
                    value={editDelivery}
                    onChange={e => setEditDelivery(e.target.value)}
                  />
                </div>
              </div>

              {/* ── Products Table ── */}
              <div style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13 }}>Products *</span>
                  <button className="btn btn-outline btn-sm" type="button" onClick={addEditRow}>
                    <Plus size={13} /> Add Product
                  </button>
                </div>

                <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700, tableLayout: 'fixed' }}>
                    <colgroup>
                      <col style={{ width: 36 }} />
                      <col style={{ width: 'auto' }} />
                      <col style={{ width: 90 }} />
                      <col style={{ width: 100 }} />
                      <col style={{ width: 80 }} />
                      <col style={{ width: 120 }} />
                      <col style={{ width: 110 }} />
                      <col style={{ width: 40 }} />
                    </colgroup>
                    <thead>
                      <tr style={{ background: 'var(--bg)' }}>
                        <th style={thStyle}>#</th>
                        <th style={thStyle}>Product</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Qty</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Rate (₹)</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>GST %</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Amount</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Total</th>
                        <th style={thStyle}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editRows.map((row, i) => {
                        const { amt, gst, total } = rowCalc(row)
                        const prodObj = products.find(p => (p._id || p.id) === row.product_id)
                        return (
                          <Fragment key={row.uid}>
                            <tr style={{ borderBottom: prodObj ? 'none' : '1px solid var(--border)', background: 'var(--surface)' }}>
                              <td style={{ ...tdStyle, verticalAlign: 'middle', color: 'var(--text-muted)', fontSize: 12, textAlign: 'center' }}>{i + 1}</td>

                              <td style={{ ...tdStyle, verticalAlign: 'middle', padding: '10px 10px' }}>
                                <select
                                  className={`form-control${editErrors[`p_${i}`] ? ' error' : ''}`}
                                  style={{ fontSize: 12, padding: '7px 8px', width: '100%' }}
                                  value={row.product_id}
                                  onChange={e => handleEditProductSelect(row.uid, e.target.value)}
                                >
                                  <option value="">— Select product —</option>
                                  {products.map(p => {
                                    const pid = p._id || p.id
                                    const label = [p.name, p.size && `(${p.size})`, p.finish].filter(Boolean).join(' ')
                                    return <option key={pid} value={pid}>{label}</option>
                                  })}
                                </select>
                                {editErrors[`p_${i}`] && <div className="form-error" style={{ fontSize: 10 }}>{editErrors[`p_${i}`]}</div>}
                              </td>

                              <td style={{ ...tdStyle, verticalAlign: 'middle', padding: '10px 6px' }}>
                                <input
                                  className={`form-control${editErrors[`qty_${i}`] ? ' error' : ''}`}
                                  style={{ fontSize: 12, padding: '7px 8px', textAlign: 'right', width: '100%' }}
                                  type="number" min="1" placeholder="0"
                                  value={row.qty}
                                  onChange={e => setEditRow(row.uid, 'qty', e.target.value)}
                                />
                                {row.unit && <div style={{ fontSize: 10, color: 'var(--text-muted)', textAlign: 'right', marginTop: 2 }}>{row.unit}</div>}
                                {editErrors[`qty_${i}`] && <div className="form-error" style={{ fontSize: 10 }}>{editErrors[`qty_${i}`]}</div>}
                              </td>

                              <td style={{ ...tdStyle, verticalAlign: 'middle', padding: '10px 6px' }}>
                                <input
                                  className={`form-control${editErrors[`rate_${i}`] ? ' error' : ''}`}
                                  style={{ fontSize: 12, padding: '7px 8px', textAlign: 'right', width: '100%' }}
                                  type="number" min="0" step="0.01" placeholder="0.00"
                                  value={row.rate}
                                  onChange={e => setEditRow(row.uid, 'rate', e.target.value)}
                                />
                                {editErrors[`rate_${i}`] && <div className="form-error" style={{ fontSize: 10 }}>{editErrors[`rate_${i}`]}</div>}
                              </td>

                              <td style={{ ...tdStyle, verticalAlign: 'middle', padding: '10px 6px' }}>
                                <select
                                  className="form-control"
                                  style={{ fontSize: 12, padding: '7px 6px', width: '100%', textAlign: 'center' }}
                                  value={row.gstPct}
                                  onChange={e => setEditRow(row.uid, 'gstPct', Number(e.target.value))}
                                >
                                  {[0, 5, 12, 18, 28].map(g => <option key={g} value={g}>{g}%</option>)}
                                </select>
                              </td>

                              <td style={{ ...tdStyle, verticalAlign: 'middle', textAlign: 'right', padding: '10px 10px' }}>
                                {amt > 0 ? (
                                  <>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>₹{amt.toLocaleString('en-IN')}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>+₹{gst.toLocaleString('en-IN')} GST</div>
                                  </>
                                ) : <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>}
                              </td>

                              <td style={{ ...tdStyle, verticalAlign: 'middle', textAlign: 'right', padding: '10px 10px', fontWeight: 800, color: total > 0 ? 'var(--primary)' : 'var(--text-muted)', fontSize: total > 0 ? 14 : 12 }}>
                                {total > 0 ? `₹${total.toLocaleString('en-IN')}` : '—'}
                              </td>

                              <td style={{ ...tdStyle, verticalAlign: 'middle', textAlign: 'center', padding: '10px 4px' }}>
                                <button
                                  className="btn-ghost"
                                  type="button"
                                  style={{ color: 'var(--danger)', padding: 5 }}
                                  onClick={() => removeEditRow(row.uid)}
                                  title="Remove"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </td>
                            </tr>

                            {prodObj && (
                              <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg)' }}>
                                <td colSpan={8} style={{ padding: '6px 14px 10px 50px' }}>
                                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '6px 16px' }}>
                                    {[
                                      { label: 'Brand',      val: prodObj.brand_name    || prodObj.brand },
                                      { label: 'Category',   val: prodObj.category_name || prodObj.category },
                                      { label: 'Size',       val: prodObj.size },
                                      { label: 'Finish',     val: prodObj.finish },
                                      { label: 'Unit',       val: prodObj.unit },
                                      { label: 'GST',        val: prodObj.gst_percent ? `${prodObj.gst_percent}%` : null },
                                      { label: 'Purchase ✓', val: parseFloat(prodObj.purchase_price || prodObj.purchase_rate) > 0 ? `₹${parseFloat(prodObj.purchase_price || prodObj.purchase_rate).toLocaleString('en-IN')}` : null, highlight: true },
                                    ].filter(f => f.val).map(f => (
                                      <div key={f.label}>
                                        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--text-muted)' }}>{f.label}</div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: f.highlight ? '#059669' : 'var(--text)', marginTop: 1 }}>{f.val}</div>
                                      </div>
                                    ))}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        )
                      })}
                    </tbody>

                    {editRows.length > 1 && (
                      <tfoot>
                        <tr style={{ background: 'var(--bg)', borderTop: '2px solid var(--border)' }}>
                          <td colSpan={4} style={{ ...tdStyle, fontWeight: 700, fontSize: 12, color: 'var(--text-muted)' }}>
                            Grand Total ({editRows.length} products)
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>GST</div>
                            <div style={{ fontWeight: 700, fontSize: 12 }}>₹{editGrandTotals.gst.toLocaleString()}</div>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Amount</div>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>₹{editGrandTotals.amt.toLocaleString()}</div>
                          </td>
                          <td style={{ ...tdStyle, textAlign: 'right' }}>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total</div>
                            <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--primary)' }}>₹{editGrandTotals.total.toLocaleString()}</div>
                          </td>
                          <td style={tdStyle}></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>

                {/* Single product summary */}
                {editRows.length === 1 && editRows[0].qty && editRows[0].rate && (() => {
                  const { amt, gst, total } = rowCalc(editRows[0])
                  return (
                    <div style={{ background: 'var(--bg)', borderRadius: 8, padding: '10px 14px', marginTop: 10, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                      {[
                        { label: 'Amount',                  val: `₹${amt.toLocaleString()}` },
                        { label: `GST (${editRows[0].gstPct}%)`, val: `₹${gst.toLocaleString()}` },
                        { label: 'Total',                   val: `₹${total.toLocaleString()}`, bold: true },
                      ].map(item => (
                        <div key={item.label}>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 1 }}>{item.label}</div>
                          <div style={{ fontSize: item.bold ? 16 : 14, fontWeight: item.bold ? 800 : 600, color: item.bold ? 'var(--primary)' : 'var(--text)' }}>
                            {item.val}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </div>
            </div>

            {/* Footer */}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeEdit} disabled={editSaving}>Cancel</button>
              <button className="btn btn-primary" onClick={handleEditSave} disabled={editSaving}>
                {editSaving ? 'Saving…' : `Update Purchase${editRows.length > 1 ? ` (${editRows.length} products)` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ DELETE CONFIRM MODAL ═══════════ */}
      {deleteItem && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteItem(null)}>
          <div className="modal" style={{ maxWidth: 420, width: '96vw' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle style={{ color: '#dc2626', width: 20 }} />
                <span className="modal-title" style={{ color: '#dc2626' }}>Delete Purchase</span>
              </div>
              <button className="btn-ghost" onClick={() => setDeleteItem(null)} disabled={deleting}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ padding: '24px', textAlign: 'center' }}>
              <div style={{
                width: 60, height: 60, borderRadius: '50%',
                background: '#fef2f2', display: 'flex', alignItems: 'center',
                justifyContent: 'center', margin: '0 auto 16px',
              }}>
                <Trash2 size={26} style={{ color: '#dc2626' }} />
              </div>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>
                Are you sure you want to delete this purchase?
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
                <strong style={{ color: 'var(--text)' }}>{purCode(deleteItem)}</strong>
                {purSupplier(deleteItem) && <span> · {purSupplier(deleteItem)}</span>}
                {purProduct(deleteItem) && <span> · {purProduct(deleteItem)}</span>}
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#fef9c3', color: '#b45309',
                border: '1px solid #fde68a', borderRadius: 6,
                padding: '6px 12px', fontSize: 12, fontWeight: 600, marginTop: 4,
              }}>
                <AlertTriangle size={13} />
                This action cannot be undone
              </div>
            </div>
            <div className="modal-footer" style={{ gap: 10 }}>
              <button
                className="btn btn-secondary"
                style={{ flex: 1 }}
                disabled={deleting}
                onClick={() => setDeleteItem(null)}
              >
                No, Cancel
              </button>
              <button
                className="btn"
                style={{
                  flex: 1, background: deleting ? '#fca5a5' : '#dc2626', color: '#fff',
                  border: 'none', padding: '8px 18px', borderRadius: 6, fontWeight: 700,
                  cursor: deleting ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
                disabled={deleting}
                onClick={async () => {
                  const id = deleteItem._id || deleteItem.id
                  setDeleting(true)
                  const result = await deletePurchase?.(id)
                  setDeleting(false)
                  if (result?.success === false) {
                    toast(`✗ Delete failed: ${result.message || 'Server error'}`)
                  } else {
                    toast(`✓ Purchase ${purCode(deleteItem)} deleted successfully.`)
                    setDeleteItem(null)
                    setDeleteConfirm('')
                  }
                }}
              >
                {deleting ? 'Deleting…' : <><Trash2 size={14} /> Yes, Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ── Table cell styles ── */
const thStyle = {
  padding: '9px 10px',
  textAlign: 'left',
  fontSize: 11,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
  color: 'var(--text-muted)',
  whiteSpace: 'nowrap',
  borderBottom: '1px solid var(--border)',
}

const tdStyle = {
  padding: '10px 10px',
  fontSize: 13,
  verticalAlign: 'top',
}
