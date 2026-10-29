import { useState, useRef, useEffect, useCallback } from 'react'
import { Plus, Search, Trash2, Package, Eye, Edit2, X, ChevronDown, RotateCcw, Layers, Box, DollarSign, Info, Image as ImageIcon, CheckCircle, XCircle, ChevronLeft, ChevronRight, Download, Lock, Users, Globe, Upload, Ban } from 'lucide-react'
import usePermissions from '../hooks/usePermissions'
import { useAuth } from '../context/AuthContext'
import { productApi } from '../api/productApi'
import BulkUploadProducts from '../components/BulkUploadProducts'
import { companyApi } from '../api/companyApi'
import { MODULES } from '../config/permissions'
import {
  fieldsForType, matchCategoryType, labelForType, humanizeKey,
  CATEGORY_DEFAULT_UNIT, PRODUCT_FIELD_SCHEMA, PRODUCT_TYPES, shortLabelForType,
} from '../config/productFieldSchema'

const PAGE_SIZE = 10

// â”€â”€ Constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const SIZES = [
  '300x300','300x450','300x600','400x400','450x900',
  '600x600','600x1200','800x800','800x1600',
  '1000x1000','1200x1200','1200x2400','800x2400','1200x1800','400x1200','300x900','300x1200','75x300','75x150','200x200',
]
// Calculate Sqft/Box from a tile size string (e.g. "300x300", in mm) and pcs per box.
// 1 sq ft = 304.8mm x 304.8mm, so tile area (sqft) = (W/304.8) * (H/304.8).
function calcSqftPerBox(size, pcsPerBox) {
  if (!size) return ''
  const m = String(size).toLowerCase().match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/)
  const pcs = parseFloat(pcsPerBox)
  if (!m || !pcs || pcs <= 0) return ''
  const w = parseFloat(m[1]), h = parseFloat(m[2])
  if (!w || !h) return ''
  const tileSqft = (w / 304.8) * (h / 304.8)
  return (tileSqft * pcs).toFixed(2)
}

const FINISHES   = ['Glossy','Matte','Satin','Anti-Skid','Polished','Rustic','Textured','Natural']
const SURFACES   = ['Polished','Unpolished','Matt','Glossy','Rough','Structured']
const GRADES     = ['Grade A','Grade B','Grade C','First Quality','Second Quality','Commercial']
const TILE_TYPES = ['All','Floor Tile','Wall Tile','Floor & Wall','Outdoor','Pool Tile','Mosaic','Subway']
const AREAS      = ['All','Living Room','Bedroom','Bathroom','Kitchen','Outdoor','Commercial','Swimming Pool']
const ANTI_SKIDS = ['R9','R10','R11','R12','Non Slip','Normal']
const ORIGINS    = ['India','Italy','Spain','China','Portugal','Brazil','Turkey','UAE']
const UNITS      = ['Sq Ft','Sq Mtr','Piece','Box','Nos']
const GST_OPTS   = ['0','5','12','18','28']
const SALE_MODES = ['Box Only','Sq.Ft Only','Piece Only','Box + Sq.Ft']
const SALE_TYPES = ['Regular Sale','B2B Sale','Export Sale','Project Sale']
const PROD_TYPES = ['Regular Product','Premium Product','Economy Product','Exclusive Product']

const IMG_BASE = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace('/api', '')
  : 'https://ezyenquiry-backend.onrender.com'

function creatorTypeOf(product = {}) {
  if (product.created_by_type) return product.created_by_type

  const creatorRole = String(product.created_by?.role || '').toLowerCase()
  if (creatorRole.includes('retail')) return 'Retailer'
  if (creatorRole.includes('whole')) return 'Wholesaler'
  if (creatorRole.includes('admin')) return 'Admin'

  const companyType = String(product.company_id?.biz_type || '').toLowerCase()
  if (companyType.includes('retail')) return 'Retailer'
  if (companyType.includes('whole')) return 'Wholesaler'

  // RPD is a reliable RetailerApp legacy prefix. PRD is shared by Admin and
  // Wholesaler creation flows, so it must never be used to infer Admin.
  if (String(product.code || '').toUpperCase().startsWith('RPD-')) return 'Retailer'
  return 'Unknown'
}

function creatorLabelOf(product = {}) {
  const type = creatorTypeOf(product)
  const name = String(product.created_by?.name || '').trim()
  return name ? `${type} · ${name}` : type
}

const EMPTY_FORM = {
  code:'', name:'', alias:'', description:'', hsn_code:'',
  brand_id:'', category_id:'', sub_category_id:'',
  unit:'Box', gst_percent:'18',
  size:'', finish:'', color:'', surface:'', thickness:'', grade:'',
  tile_type:'', application:'', anti_skid:'', origin:'', manufacturer:'', barcode:'',
  design:'', collection:'', pcs_per_box:'', sqft_per_box:'', weight_per_box:'',
  purchase_rate:'', landing_cost:'', mrp:'', retail_rate:'', wholesale_rate:'',
  retail_discount:'', wholesale_discount:'',
  status:'Active', sales_type:'Regular Sale', product_type:'Regular Product',
  new_arrival: false, featured: false,
  min_stock_level:'', reorder_level:'',
  explicit_product_type: '',
  attributes: {},
}

function imgUrl(p) {
  if (!p) return null
  if (p.startsWith('http')) return p
  return `${IMG_BASE}${p}`
}

// â”€â”€ Generate & print full product details sheet â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function downloadProduct(p) {
  const fmtP = (v) => {
    const n = parseFloat(v) || 0
    return n > 0 ? `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null
  }
  const v = (x) => (x && String(x).trim()) ? String(x).trim() : null

  const row = (label, value) => value
    ? `<tr><td class="lbl">${label}</td><td class="val">${value}</td></tr>`
    : ''

  const priceCard = (label, value) => {
    const n = parseFloat(value) || 0
    if (n <= 0) return ''
    return `<div class="price-card"><div class="pc-label">${label}</div><div class="pc-value">₹${n.toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2})}</div></div>`
  }

  const chip = (label, value) => v(value)
    ? `<div class="chip"><div class="chip-label">${label}</div><div class="chip-value">${value}</div></div>`
    : ''

  const flag = (label, on) =>
    `<div class="flag ${on ? 'flag-on' : 'flag-off'}">${on ? 'âœ“' : 'âœ—'} ${label}</div>`

  const imgTags = (p.image_urls || []).filter(Boolean).slice(0, 6).map(u =>
    `<img src="${imgUrl(u)}" class="prod-img" alt="product" />`
  ).join('')

  // Determine product type for section labels & field names
  const effCatType = p.category_type || matchCategoryType(p.category_name || p.category_id?.name) || 'other'
  const isStoneProduct = ['granite','marble','stone_block'].includes(effCatType)
  const isTileProduct  = ['tiles'].includes(effCatType)
  const isBlockProduct = ['stone_block'].includes(effCatType)

  const specSectionTitle = (() => {
    if (effCatType === 'granite')     return 'Granite Specifications'
    if (effCatType === 'marble')      return 'Marble Specifications'
    if (effCatType === 'stone_block') return 'Stone Block Specifications'
    if (effCatType === 'tiles')       return 'Tile Specifications'
    if (effCatType === 'sanitaryware')return 'Sanitaryware Specifications'
    if (effCatType === 'blocks')      return 'Block Specifications'
    if (effCatType === 'non_sanitary')return 'Item Specifications'
    return 'Product Specifications'
  })()

  const sizeLabel = isBlockProduct ? 'Block Size'
                  : isStoneProduct ? 'Slab / Tile Size'
                  : 'Tile Size'
  const typeLabel = isBlockProduct ? 'Stone Type'
                  : isStoneProduct ? 'Product Form'
                  : 'Tile Type'
  const packUnit  = isStoneProduct ? 'Crate' : 'Box'

  const attrLabel = (key) => {
    for (const list of Object.values(PRODUCT_FIELD_SCHEMA)) {
      const def = list.find(f => f.key === key)
      if (def) return def.unit ? `${def.label} (${def.unit})` : def.label
    }
    return humanizeKey(key)
  }

  const attrChips = (() => {
    if (!p.attributes || typeof p.attributes !== 'object') return ''
    const entries = Object.entries(p.attributes).filter(([, val]) => v(val))
    if (entries.length === 0) return ''
    const sectionTitle = `${labelForType(p.category_type || matchCategoryType(p.category_name || p.category_id?.name))} Specifications`
    const chipsHtml = entries.map(([key, val]) => chip(attrLabel(key), String(val))).join('')
    return `<div class="section">
  <div class="section-title">${sectionTitle}</div>
  <div class="chips">${chipsHtml}</div>
</div>`
  })()

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<title>Product - ${p.name || 'Details'}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #1a2540; background: #fff; padding: 32px 40px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #FD5C02; padding-bottom: 14px; margin-bottom: 22px; }
  .header-left h1 { font-size: 20px; font-weight: 800; color: #01152D; }
  .header-left .code { font-size: 12px; font-family: monospace; color: #FD5C02; font-weight: 700; margin-top: 3px; background: #FFF3EC; padding: 2px 10px; border-radius: 5px; display: inline-block; }
  .header-right { text-align: right; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; }
  .badge-active { background: #ECFDF5; color: #059669; }
  .badge-inactive { background: #F1F5F9; color: #64748B; }
  .print-date { font-size: 11px; color: #64748B; margin-top: 4px; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; color: #FD5C02; border-bottom: 1px solid #E2E8F0; padding-bottom: 5px; margin-bottom: 10px; }
  table { width: 100%; border-collapse: collapse; }
  .lbl { width: 180px; padding: 6px 8px; font-size: 12px; color: #64748B; font-weight: 600; vertical-align: top; border-bottom: 1px solid #F1F5F9; }
  .val { padding: 6px 8px; font-size: 13px; color: #1a2540; font-weight: 500; border-bottom: 1px solid #F1F5F9; }
  .chips { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 8px; padding: 7px 12px; min-width: 130px; }
  .chip-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #64748B; margin-bottom: 2px; }
  .chip-value { font-size: 13px; font-weight: 700; color: #1a2540; }
  .price-grid { display: flex; flex-wrap: wrap; gap: 10px; }
  .price-card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 10px 14px; min-width: 150px; text-align: center; }
  .price-card:first-child { background: #FFF3EC; border-color: #FD5C02; }
  .pc-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #64748B; margin-bottom: 4px; }
  .price-card:first-child .pc-label { color: #FD5C02; }
  .pc-value { font-size: 17px; font-weight: 800; color: #1a2540; }
  .price-card:first-child .pc-value { color: #FD5C02; }
  .flags { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 6px; }
  .flag { padding: 5px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .flag-on  { background: #ECFDF5; color: #059669; }
  .flag-off { background: #F1F5F9; color: #94A3B8; }
  .img-row { display: flex; gap: 10px; flex-wrap: wrap; }
  .prod-img { width: 120px; height: 120px; object-fit: cover; border-radius: 10px; border: 1px solid #E2E8F0; }
  .footer { margin-top: 32px; border-top: 1px solid #E2E8F0; padding-top: 10px; font-size: 11px; color: #94A3B8; display: flex; justify-content: space-between; }
  @media print { body { padding: 20px; } }
</style>
</head>
<body>

<div class="header">
  <div class="header-left">
    <h1>${v(p.name) || 'Product Details'}</h1>
    ${v(p.code) ? `<span class="code">${p.code}</span>` : ''}
    ${v(p.alias) ? `<div style="font-size:12px;color:#64748B;margin-top:4px;">Alias: ${p.alias}</div>` : ''}
  </div>
  <div class="header-right">
    <span class="badge ${p.is_active !== false ? 'badge-active' : 'badge-inactive'}">${p.is_active !== false ? 'Active' : 'Inactive'}</span>
    <div class="print-date">Printed: ${new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}</div>
  </div>
</div>

<!-- Basic Information -->
<div class="section">
  <div class="section-title">Basic Information</div>
  <table>
    ${row('Brand',          v(p.brand_name)       || v(p.brand_id?.name))}
    ${row('Category',       v(p.category_name)    || v(p.category_id?.name))}
    ${row('Sub-Category',   v(p.sub_category_name)|| v(p.sub_category_id?.name))}
    ${row('Unit',           v(p.unit))}
    ${row('GST %',          p.gst_percent ? p.gst_percent + '%' : null)}
    ${row('HSN Code',       v(p.hsn_code))}
    ${row('Description',    v(p.description))}
    ${row('Product Type',   v(p.product_type))}
    ${row('Sales Type',     v(p.sales_type))}
  </table>
</div>

<!-- Product Specifications (column fields) -->
${(v(p.size)||v(p.finish)||v(p.color)||v(p.surface)||v(p.thickness)||v(p.grade)||v(p.tile_type)||v(p.application)||v(p.anti_skid)||v(p.origin)||v(p.manufacturer)||v(p.barcode)) ? `
<div class="section">
  <div class="section-title">${specSectionTitle}</div>
  <div class="chips">
    ${chip(sizeLabel,      p.size ? p.size.toUpperCase() + ' MM' : null)}
    ${chip('Finish',       p.finish)}
    ${chip('Colour',       p.color)}
    ${chip('Surface',      p.surface)}
    ${chip('Thickness',    p.thickness)}
    ${chip('Grade',        p.grade)}
    ${chip(typeLabel,      p.tile_type)}
    ${chip('Application',  p.application)}
    ${chip('Anti Skid',    p.anti_skid)}
    ${chip('Origin',       p.origin)}
    ${chip('Manufacturer', p.manufacturer)}
    ${chip('Barcode',      p.barcode)}
  </div>
</div>` : ''}

${attrChips}

<!-- Packing -->
${(v(p.design)||v(p.collection)||v(p.pcs_per_box)||v(p.sqft_per_box)||v(p.weight_per_box)) ? `
<div class="section">
  <div class="section-title">${isStoneProduct ? 'Packing &amp; Details' : 'Packing &amp; Collection'}</div>
  <div class="chips">
    ${chip('Design',            p.design)}
    ${chip('Collection',        p.collection)}
    ${chip('Pcs / ' + packUnit,    p.pcs_per_box    ? String(p.pcs_per_box) : null)}
    ${chip('Sqft / ' + packUnit,   p.sqft_per_box   ? parseFloat(p.sqft_per_box).toFixed(2) + ' Sq.Ft' : null)}
    ${chip('Weight / ' + packUnit, p.weight_per_box ? parseFloat(p.weight_per_box).toFixed(2) + ' Kg'   : null)}
  </div>
</div>` : ''}

<!-- Sales & Product Type -->
${(v(p.sales_type) || v(p.product_type)) ? `
<div class="section">
  <div class="section-title">Sales &amp; Product Type</div>
  <div class="chips">
    ${chip('Sales Type',   p.sales_type)}
    ${chip('Product Type', p.product_type)}
  </div>
</div>` : ''}

<!-- Pricing -->
<div class="section">
  <div class="section-title">Pricing</div>
  <div class="price-grid">
    ${priceCard('MRP',             p.mrp)}
    ${priceCard('Retail Rate',     p.retail_price  || p.retail_rate)}
    ${priceCard('Dealer Rate',     p.dealer_price  || p.dealer_rate)}
    ${priceCard('Wholesale Rate',  p.wholesale_rate)}
    ${priceCard('Project Rate',    p.project_rate)}
    ${priceCard('Purchase Rate',   p.purchase_price || p.purchase_rate)}
    ${priceCard('Landing Cost',    p.landing_cost)}
    ${priceCard('Min Selling Rate',p.min_selling_rate)}
  </div>
  ${(parseFloat(p.min_stock_level)>0||parseFloat(p.reorder_level)>0) ? `
  <table style="margin-top:10px;max-width:400px;">
    ${row('Min Stock Level', v(p.min_stock_level))}
    ${row('Reorder Level',   v(p.reorder_level))}
  </table>` : ''}
</div>

<!-- Flags -->
<div class="section">
  <div class="section-title">Product Flags</div>
  <div class="flags">
    ${flag('New Arrival',    !!p.new_arrival)}
    ${flag('Featured',       !!p.featured)}
  </div>
</div>

<!-- Images -->
${(p.image_urls||[]).filter(Boolean).length > 0 ? `
<div class="section">
  <div class="section-title">Product Images</div>
  <div class="img-row">${imgTags}</div>
</div>` : ''}

<div class="footer">
  <span>Product Code: ${v(p.code) || '-'} &nbsp;|&nbsp; Brand: ${v(p.brand_name) || '-'} &nbsp;|&nbsp; Category: ${v(p.category_name) || '-'}</span>
  <span>${p.created_at ? 'Created: ' + new Date(p.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}) : ''}</span>
</div>

<script>window.onload = () => { window.print(); }<\/script>
</body>
</html>`

  // Download as .html file — no new tab, no print popup
  const blob = new Blob([html], { type: 'text/html' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = "Product_" + (p.code || '') + "_" + (p.name || 'product').replace(/[^a-z0-9]/gi, '_').toLowerCase() + ".html"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

// â”€â”€ Searchable Dropdown Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SearchableSelect({ label, required, placeholder, value, onChange, options, disabled, onCreate, createLabel = 'Add', onDelete }) {
  const [open, setOpen]   = useState(false)
  const [q, setQ]         = useState('')
  const [creating, setCreating] = useState(false)
  const ref               = useRef()

  const selected = options.find(o => o.value === value)
  const filtered = options.filter(o =>
    (o.label || '').toLowerCase().includes(q.toLowerCase())
  )

  // Show an inline "+ Add" row when the typed text doesn't already exist.
  const trimmed = q.trim()
  const existsExact = options.some(o => (o.label || '').trim().toLowerCase() === trimmed.toLowerCase())
  const canCreate = !!onCreate && trimmed.length > 0 && !existsExact

  // Close on outside click
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const pick = (val) => { onChange(val); setOpen(false); setQ('') }

  const handleCreate = async () => {
    if (!canCreate || creating) return
    setCreating(true)
    try {
      const newVal = await onCreate(trimmed)
      if (newVal) pick(newVal)
      else { setOpen(false); setQ('') }
    } finally {
      setCreating(false)
    }
  }

  return (
    <div ref={ref} style={{ position:'relative' }}>
      {label && (
        <label className="form-label">
          {label}{required && <span style={{ color:'var(--danger)' }}> *</span>}
        </label>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={() => { if (!disabled) { setOpen(o => !o); setQ('') } }}
        style={{
          width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'8px 11px', border:'1px solid var(--border)', borderRadius:7,
          background: disabled ? 'var(--bg)' : 'var(--surface)',
          fontSize:13, color: selected ? 'var(--text)' : 'var(--text-muted)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          outline:'none', transition:'border-color .15s',
          ...(open && { borderColor:'#FD5C02', boxShadow:'0 0 0 3px rgba(253,92,2,.12)' }),
        }}
      >
        <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, textAlign:'left' }}>
          {selected ? selected.label : (placeholder || `Search ${label || ''}...`)}
        </span>
        <ChevronDown size={14} style={{ flexShrink:0, marginLeft:6, color:'var(--text-muted)',
          transform: open ? 'rotate(180deg)' : 'none', transition:'transform .15s' }} />
      </button>
      {open && (
        <div style={{
          position:'absolute', top:'100%', left:0, right:0, zIndex:999, marginTop:2,
          background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8,
          boxShadow:'0 8px 24px rgba(0,0,0,.12)', overflow:'hidden',
        }}>
          <div style={{ padding:'8px 8px 4px' }}>
            <input
              autoFocus
              className="form-control"
              style={{ fontSize:12, padding:'6px 9px' }}
              placeholder="Type to search..."
              value={q}
              onChange={e => setQ(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div style={{ maxHeight:200, overflowY:'auto' }}>
            <div
              style={{ padding:'7px 14px', fontSize:13, color:'var(--text-muted)', cursor:'pointer' }}
              onMouseDown={() => pick('')}
            >— None —</div>
            {filtered.length === 0 && !canCreate && (
              <div style={{ padding:'10px 14px', fontSize:12, color:'var(--text-muted)' }}>
                {onCreate ? 'Type a name above, then click “+ Add” to create it' : 'No results'}
              </div>
            )}
            {filtered.map(o => (
              <div
                key={o.value}
                onMouseDown={() => pick(o.value)}
                style={{
                  padding:'7px 14px', fontSize:13, cursor:'pointer',
                  background: o.value === value ? 'var(--primary-light)' : 'transparent',
                  color: o.value === value ? 'var(--primary)' : 'var(--text)',
                  fontWeight: o.value === value ? 600 : 400,
                  display:'flex', alignItems:'center', justifyContent:'space-between', gap:8,
                }}
                onMouseEnter={e => { if (o.value !== value) e.currentTarget.style.background='var(--bg)' }}
                onMouseLeave={e => { if (o.value !== value) e.currentTarget.style.background='transparent' }}
              >
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{o.label}</span>
                {onDelete && (
                  <button
                    type="button"
                    title="Delete"
                    aria-label={`Delete ${o.label}`}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(o.value, o.label) }}
                    style={{
                      display:'flex', alignItems:'center', justifyContent:'center',
                      width:22, height:22, flexShrink:0, padding:0,
                      background:'transparent', border:'none', borderRadius:5,
                      color:'var(--text-muted)', cursor:'pointer',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.background='#fef2f2'; e.currentTarget.style.color='#dc2626' }}
                    onMouseLeave={e => { e.currentTarget.style.background='transparent'; e.currentTarget.style.color='var(--text-muted)' }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
            {canCreate && (
              <div
                onMouseDown={(e) => { e.preventDefault(); handleCreate() }}
                style={{
                  padding:'9px 14px', fontSize:13, cursor: creating ? 'wait' : 'pointer',
                  borderTop:'1px solid var(--border)', color:'var(--primary)', fontWeight:600,
                  display:'flex', alignItems:'center', gap:6, background:'var(--primary-light)',
                }}
              >
                <Plus size={14} />
                {creating ? 'Adding…' : <>{createLabel} “{trimmed}”</>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// â”€â”€ Custom-option store (persists admin-added dropdown values) â”€â”€
// Options the admin adds for a spec field are saved per field key in
// localStorage so they survive reloads without a backend change.
const CUSTOM_OPTS_KEY = 'pm_custom_field_options_v1'
function loadCustomOptions() {
  try { return JSON.parse(localStorage.getItem(CUSTOM_OPTS_KEY)) || {} }
  catch { return {} }
}
function saveCustomOptions(map) {
  try { localStorage.setItem(CUSTOM_OPTS_KEY, JSON.stringify(map)) } catch { /* ignore quota */ }
}

// â”€â”€ Editable searchable dropdown (add + delete custom options) â”€â”€
// Same UX as SearchableSelect, plus:
//   • an "Add new" row to append a custom value
//   • a delete (Ã—) icon on custom (admin-added) options
// `fieldKey` scopes the persisted custom options.
function EditableSelect({ label, required, placeholder, value, onChange, baseOptions = [], fieldKey }) {
  const [open, setOpen] = useState(false)
  const [q, setQ]       = useState('')
  const [adding, setAdding] = useState('')
  const [custom, setCustom] = useState(() => loadCustomOptions()[fieldKey] || [])
  const ref = useRef()

  // Merge base (schema) options with admin-added custom ones (deduped).
  const baseValues = baseOptions.map(o => (typeof o === 'string' ? o : o.value))
  const merged = [
    ...baseOptions.map(o => (typeof o === 'string' ? { value: o, label: o, custom: false } : { ...o, custom: false })),
    ...custom.filter(c => !baseValues.includes(c)).map(c => ({ value: c, label: c, custom: true })),
  ]
  // Ensure the current value is always present/selectable.
  if (value && !merged.some(o => o.value === value)) merged.unshift({ value, label: value, custom: false })

  const filtered = merged.filter(o => (o.label || '').toLowerCase().includes(q.toLowerCase()))
  const selected = merged.find(o => o.value === value)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const persist = (nextCustom) => {
    setCustom(nextCustom)
    const map = loadCustomOptions()
    map[fieldKey] = nextCustom
    saveCustomOptions(map)
  }

  const addOption = () => {
    const val = adding.trim()
    if (!val) return
    if (!custom.includes(val) && !baseValues.includes(val)) persist([...custom, val])
    onChange(val)
    setAdding(''); setOpen(false); setQ('')
  }

  const deleteOption = (val, e) => {
    e.stopPropagation()
    persist(custom.filter(c => c !== val))
    if (value === val) onChange('')
  }

  const pick = (val) => { onChange(val); setOpen(false); setQ('') }

  return (
    <div ref={ref} style={{ position:'relative' }}>
      {label && (
        <label className="form-label">
          {label}{required && <span style={{ color:'var(--danger)' }}> *</span>}
        </label>
      )}
      <button
        type="button"
        onClick={() => { setOpen(o => !o); setQ('') }}
        style={{
          width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between',
          padding:'8px 11px', border:'1px solid var(--border)', borderRadius:7,
          background:'var(--surface)', fontSize:13,
          color: selected ? 'var(--text)' : 'var(--text-muted)', cursor:'pointer',
          outline:'none', transition:'border-color .15s',
          ...(open && { borderColor:'#FD5C02', boxShadow:'0 0 0 3px rgba(253,92,2,.12)' }),
        }}
      >
        <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1, textAlign:'left' }}>
          {selected ? selected.label : (placeholder || `Select ${label || ''}...`)}
        </span>
        <ChevronDown size={14} style={{ flexShrink:0, marginLeft:6, color:'var(--text-muted)',
          transform: open ? 'rotate(180deg)' : 'none', transition:'transform .15s' }} />
      </button>
      {open && (
        <div style={{
          position:'absolute', top:'100%', left:0, right:0, zIndex:999, marginTop:2,
          background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8,
          boxShadow:'0 8px 24px rgba(0,0,0,.12)', overflow:'hidden',
        }}>
          <div style={{ padding:'8px 8px 4px' }}>
            <input
              autoFocus className="form-control" style={{ fontSize:12, padding:'6px 9px' }}
              placeholder="Type to search..." value={q}
              onChange={e => setQ(e.target.value)} onClick={e => e.stopPropagation()}
            />
          </div>
          <div style={{ maxHeight:180, overflowY:'auto' }}>
            <div style={{ padding:'7px 14px', fontSize:13, color:'var(--text-muted)', cursor:'pointer' }}
              onMouseDown={() => pick('')}>"” None "”</div>
            {filtered.length === 0 && (
              <div style={{ padding:'10px 14px', fontSize:12, color:'var(--text-muted)' }}>No results</div>
            )}
            {filtered.map(o => (
              <div key={o.value}
                onMouseDown={() => pick(o.value)}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between', gap:6,
                  padding:'7px 10px 7px 14px', fontSize:13, cursor:'pointer',
                  background: o.value === value ? 'var(--primary-light)' : 'transparent',
                  color: o.value === value ? 'var(--primary)' : 'var(--text)',
                  fontWeight: o.value === value ? 600 : 400,
                }}
                onMouseEnter={e => { if (o.value !== value) e.currentTarget.style.background='var(--bg)' }}
                onMouseLeave={e => { if (o.value !== value) e.currentTarget.style.background='transparent' }}
              >
                <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{o.label}</span>
                {o.custom && (
                  <span title="Delete this option" onMouseDown={(e) => deleteOption(o.value, e)}
                    style={{ flexShrink:0, display:'inline-flex', alignItems:'center', justifyContent:'center',
                      width:18, height:18, borderRadius:4, color:'var(--danger)' }}>
                    <Trash2 size={12}/>
                  </span>
                )}
              </div>
            ))}
          </div>
          {/* Add new option */}
          <div style={{ display:'flex', gap:6, padding:8, borderTop:'1px solid var(--border)', background:'var(--bg)' }}
            onMouseDown={e => e.stopPropagation()}>
            <input
              className="form-control" style={{ fontSize:12, padding:'6px 9px', flex:1 }}
              placeholder="Add new option..." value={adding}
              onChange={e => setAdding(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOption() } }}
              onClick={e => e.stopPropagation()}
            />
            <button type="button" className="btn btn-primary btn-sm" style={{ padding:'4px 10px' }}
              onClick={addOption} disabled={!adding.trim()}>
              <Plus size={13}/>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// â”€â”€ Simple dropdown (native select styled) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function SelectField({ label, required, value, onChange, options, placeholder, disabled }) {
  return (
    <div>
      {label && (
        <label className="form-label">
          {label}{required && <span style={{ color:'var(--danger)' }}> *</span>}
        </label>
      )}
      <div style={{ position:'relative' }}>
        <select
          disabled={disabled}
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            width:'100%', padding:'8px 32px 8px 11px',
            border:'1px solid var(--border)', borderRadius:7,
            background: disabled ? 'var(--bg)' : 'var(--surface)',
            fontSize:13, color: value ? 'var(--text)' : 'var(--text-muted)',
            appearance:'none', cursor: disabled ? 'not-allowed' : 'pointer',
            outline:'none',
          }}
          onFocus={e => { e.target.style.borderColor='#FD5C02'; e.target.style.boxShadow='0 0 0 3px rgba(253,92,2,.12)' }}
          onBlur={e => { e.target.style.borderColor='var(--border)'; e.target.style.boxShadow='none' }}
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.map(o => (
            <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value}>
              {typeof o === 'string' ? o : o.label}
            </option>
          ))}
        </select>
        <ChevronDown size={14} style={{
          position:'absolute', right:10, top:'50%', transform:'translateY(-50%)',
          color:'var(--text-muted)', pointerEvents:'none',
        }} />
      </div>
    </div>
  )
}

// â”€â”€ Toggle Switch â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function Toggle({ label, checked, onChange }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {label && <label className="form-label" style={{ marginBottom:0 }}>{label}</label>}
      <button
        type="button"
        onClick={() => onChange(!checked)}
        style={{
          width:44, height:24, borderRadius:12, border:'none', cursor:'pointer',
          background: checked ? '#FD5C02' : 'var(--border)',
          position:'relative', transition:'background .2s', flexShrink:0,
        }}
      >
        <span style={{
          position:'absolute', top:2,
          left: checked ? 22 : 2,
          width:20, height:20, borderRadius:'50%',
          background:'#fff', boxShadow:'0 1px 3px rgba(0,0,0,.2)',
          transition:'left .2s',
        }} />
      </button>
    </div>
  )
}

// â”€â”€ Image Picker â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ImagePicker({ existingUrls = [], onFilesChange, onRemoveExisting, resetKey, initialFiles = [] }) {
  const inputRef = useRef()
  const [previews, setPreviews] = useState(() =>
    initialFiles.map(f => ({ file: f, url: typeof f === 'string' ? f : (f ? URL.createObjectURL(f) : '') }))
  )

  useEffect(() => {
    previews.forEach(p => { try { URL.revokeObjectURL(p.url) } catch {} })
    setPreviews([])
  }, [resetKey])

  useEffect(() => () => {
    previews.forEach(p => { try { URL.revokeObjectURL(p.url) } catch {} })
  }, [])

  const handlePick = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const added = files.map(f => ({ file: f, url: URL.createObjectURL(f) }))
    setPreviews(prev => {
      const all = [...prev, ...added]
      onFilesChange(all.map(p => p.file))
      return all
    })
    e.target.value = ''
  }
  const removeNew = (idx) => {
    setPreviews(prev => {
      const target = prev[idx]
      if (target) { try { URL.revokeObjectURL(target.url) } catch {} }
      const u = prev.filter((_, i) => i !== idx)
      onFilesChange(u.map(p => p.file))
      return u
    })
  }
  return (
    <div>
      <label className="form-label">Product Images</label>
      <p style={{ fontSize:11, color:'var(--text-muted)', marginBottom:8 }}>
        Upload product images (JPG, PNG, WEBP). Max 5MB each, up to 10 images.
      </p>
      <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
        {existingUrls.map((url, i) => (
          <div key={`ex-${i}`} style={{ position:'relative', width:80, height:80 }}>
            <img src={imgUrl(url)} alt="product" loading="lazy"
              onError={(e) => { e.currentTarget.style.opacity = '0.3' }}
              style={{ width:80, height:80, objectFit:'cover', borderRadius:8, border:'1px solid var(--border)', background:'var(--bg)' }} />
            <button type="button" onClick={() => onRemoveExisting(i)}
              style={{ position:'absolute', top:-6, right:-6, background:'var(--danger)', border:'none', borderRadius:'50%', width:20, height:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', padding:0 }}>
              <X style={{ width:11 }} />
            </button>
          </div>
        ))}
        {previews.map((p, i) => (
          <div key={`new-${i}-${p.url.length}`} style={{ position:'relative', width:80, height:80 }}>
            <img src={p.url} alt="preview" loading="lazy"
              style={{ width:80, height:80, objectFit:'cover', borderRadius:8, border:'2px dashed var(--primary)', background:'var(--bg)' }} />
            <button type="button" onClick={() => removeNew(i)}
              style={{ position:'absolute', top:-6, right:-6, background:'var(--danger)', border:'none', borderRadius:'50%', width:20, height:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', padding:0 }}>
              <X style={{ width:11 }} />
            </button>
          </div>
        ))}
        <button type="button" onClick={() => inputRef.current?.click()}
          style={{ width:80, height:80, border:'2px dashed var(--border)', borderRadius:8, background:'var(--bg)', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:4, color:'var(--text-muted)' }}>
          <Plus style={{ width:22 }} />
          <span style={{ fontSize:11 }}>Add</span>
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple style={{ display:'none' }} onChange={handlePick} />
    </div>
  )
}

// â”€â”€ Section Header inside form â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function FormSection({ title }) {
  return (
    <div style={{ margin:'20px 0 14px', borderBottom:'2px solid var(--border)', paddingBottom:6 }}>
      <span style={{ fontSize:12, fontWeight:700, letterSpacing:'.06em', textTransform:'uppercase', color:'var(--text-muted)' }}>
        {title}
      </span>
    </div>
  )
}

// â”€â”€ Price Input â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function PriceInput({ label, required, value, onChange, placeholder }) {
  return (
    <div>
      {label && (
        <label className="form-label">
          {label}{required && <span style={{ color:'var(--danger)' }}> *</span>}
        </label>
      )}
      <div style={{ position:'relative' }}>
        <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', fontSize:13, color:'var(--text-muted)', pointerEvents:'none' }}>₹</span>
        <input
          type="number" min="0" step="0.01"
          className="form-control"
          style={{ paddingLeft:24 }}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder || '0.00'}
        />
      </div>
    </div>
  )
}


// ── Price + Discount combo input (compact) ────────────────────
// Single row: the amount field with a small % input beside it.
// Enter a % (off MRP) and the amount auto-fills; the computed
// amount is shown as a tiny hint below.
function PriceDiscountInput({ label, required, priceValue, onPriceChange, discountValue, onDiscountChange, baseMrp, placeholder }) {
  const mrp      = parseFloat(baseMrp) || 0
  const discount = parseFloat(discountValue) || 0
  const computed = mrp > 0 && discount > 0 ? mrp * (1 - discount / 100) : null

  return (
    <div>
      {label && (
        <label className="form-label">
          {label}{required && <span style={{ color:'var(--danger)' }}> *</span>}
        </label>
      )}
      <div style={{ display:'flex', gap:6, alignItems:'stretch' }}>
        {/* % first */}
        <div style={{ position:'relative', width:74, flexShrink:0 }}>
          <input
            type="number" min="0" max="100" step="0.01"
            className="form-control no-spin"
            style={{ paddingRight:22, paddingLeft:10, background:'var(--bg)' }}
            value={discountValue}
            onChange={e => onDiscountChange(e.target.value)}
            placeholder="0"
            title="Discount % off MRP"
          />
          <span style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', fontSize:12, color:'var(--text-muted)', pointerEvents:'none' }}>%</span>
        </div>
        {/* Amount beside it */}
        <div style={{ position:'relative', flex:1, minWidth:0 }}>
          <span style={{ position:'absolute', left:9, top:'50%', transform:'translateY(-50%)', fontSize:13, color:'var(--text-muted)', pointerEvents:'none' }}>&#8377;</span>
          <input
            type="number" min="0" step="0.01"
            className="form-control"
            style={{ paddingLeft:22 }}
            value={priceValue}
            onChange={e => onPriceChange(e.target.value)}
            placeholder={placeholder || '0.00'}
          />
        </div>
      </div>
      {computed > 0 && (
        <div style={{ fontSize:10, color:'var(--primary)', marginTop:2, fontWeight:600 }}>
          = &#8377;{computed.toFixed(2)} @ {discount}% off MRP
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// PRODUCT FORM MODAL
// ══════════════════════════════════════════════════════════════
function ProductFormModal({ editProduct, brands, categories, subCategories, warehouses = [], onSave, onClose, saving, onCreateCategory, onCreateBrand, onCreateSubCategory, onDeleteCategory, onDeleteBrand, onDeleteSubCategory }) {
  const [form, setForm]         = useState(() => {
    if (!editProduct) return EMPTY_FORM
    const explicitType =
      editProduct.category_type && PRODUCT_FIELD_SCHEMA[editProduct.category_type]
        ? editProduct.category_type
        : matchCategoryType(
            editProduct.category_id?.name || editProduct.category_name,
            editProduct.sub_category_id?.name || editProduct.sub_category_name,
          )
    return {
      code:              editProduct.code              || '',
      name:              editProduct.name              || '',
      alias:             editProduct.alias             || '',
      description:       editProduct.description       || '',
      hsn_code:          editProduct.hsn_code          || '',
      brand_id:          editProduct.brand_id?._id     || editProduct.brand_id     || '',
      category_id:       editProduct.category_id?._id  || editProduct.category_id  || '',
      sub_category_id:   editProduct.sub_category_id?._id || editProduct.sub_category_id || '',
      unit:              editProduct.unit              || 'Box',
      gst_percent:       String(editProduct.gst_percent ?? '18'),
      size:              editProduct.size              || '',
      finish:            editProduct.finish            || '',
      color:             editProduct.color             || '',
      surface:           editProduct.surface           || '',
      thickness:         editProduct.thickness         || '',
      grade:             editProduct.grade             || '',
      tile_type:         editProduct.tile_type         || '',
      application:       editProduct.application       || '',
      anti_skid:         editProduct.anti_skid         || '',
      origin:            editProduct.origin            || '',
      manufacturer:      editProduct.manufacturer      || '',
      barcode:           editProduct.barcode           || '',
      design:            editProduct.design            || '',
      collection:        editProduct.collection        || '',
      pcs_per_box:       editProduct.pcs_per_box       || '',
      sqft_per_box:      editProduct.sqft_per_box      || '',
      weight_per_box:    editProduct.weight_per_box    || '',
      purchase_rate:     editProduct.purchase_price    || editProduct.purchase_rate || '',
      landing_cost:      editProduct.landing_cost      || '',
      mrp:               editProduct.mrp               || '',
      retail_rate:       editProduct.retail_price      || editProduct.retail_rate  || '',
      wholesale_rate:    editProduct.wholesale_rate    || '',
      retail_discount:   editProduct.retail_discount   || '',
      wholesale_discount:editProduct.wholesale_discount|| '',
      status:            editProduct.is_active !== false ? 'Active' : 'Inactive',
      sales_type:        editProduct.sales_type        || 'Regular Sale',
      product_type:      editProduct.product_type      || 'Regular Product',
      new_arrival:       !!editProduct.new_arrival,
      featured:          !!editProduct.featured,
      min_stock_level:   editProduct.min_stock_level != null ? String(editProduct.min_stock_level) : '',
      reorder_level:     editProduct.reorder_level   != null ? String(editProduct.reorder_level)   : '',
      explicit_product_type: explicitType,
      attributes:        (editProduct.attributes && typeof editProduct.attributes === 'object') ? { ...editProduct.attributes } : {},
    }
  })
  const [errors, setErrors]     = useState({})
  const [imageFiles, setImageFiles]         = useState([])
  const [existingImages, setExistingImages] = useState(() => editProduct?.image_urls || [])
  const [imgResetKey, setImgResetKey]       = useState(0)
  // Admin-defined extra specifications (label + value) beyond the schema fields.
  const [customSpecs, setCustomSpecs]       = useState([])

  // Filter subcategories based on selected category
  const filteredSubs = subCategories.filter(s => {
    const pid = s.parent_id?.toString() || s.category_id?.toString()
    return pid === form.category_id
  })

  // Resolve the selected category / sub-category names, then infer the
  // category "type" that decides which dynamic fields to show.
  // If the user explicitly picked a product type, that wins over inference.
  const selectedCatName = (() => {
    const c = categories.find(x => String(x._id || x.id) === String(form.category_id))
    return c?.name || editProduct?.category_id?.name || editProduct?.category_name || ''
  })()
  const selectedSubName = (() => {
    const s = subCategories.find(x => String(x._id || x.id) === String(form.sub_category_id))
    return s?.name || editProduct?.sub_category_id?.name || editProduct?.sub_category_name || ''
  })()
  const inferredType = matchCategoryType(selectedCatName, selectedSubName)
  const categoryType = form.explicit_product_type || inferredType
  const dynamicFields = fieldsForType(categoryType)

  // ── Natural Stone Block auto-computation helpers ─────────────────
  // CBM (m³) = L(mm) × W(mm) × H(mm) ÷ 1e9
  const cbmFromMm = (l, w, h) => {
    const a = parseFloat(l), b = parseFloat(w), c = parseFloat(h)
    if (!(a > 0 && b > 0 && c > 0)) return ''
    return ((a * b * c) / 1e9).toFixed(4)
  }
  // Tons = CBM × Density(kg/m³) ÷ 1000   (density default 2700 for stone)
  const tonsFromCbmAndDensity = (cbm, density) => {
    const v = parseFloat(cbm), d = parseFloat(density) || 2700
    if (!(v > 0)) return ''
    return ((v * d) / 1000).toFixed(3)
  }

  // A category must be picked before the spec fields are meaningful.
  const categoryChosen = !!form.category_id

  // Gate: the rest of the form only appears once Category, Sub-Category and Brand
  // are chosen. Sub-Category is only required when the picked category actually
  // has sub-categories defined.
  const categoryHasSubs = !!form.category_id && filteredSubs.length > 0
  // Sub-category is required only when the category actually has sub-categories.
  // Exception: when EDITING an existing product that was saved WITHOUT a
  // sub-category, don't block the form — otherwise such products can never be
  // edited (the "Preview & Save" button stays disabled forever).
  const subCategorySatisfied =
    !categoryHasSubs ||
    !!form.sub_category_id ||
    (!!editProduct && !editProduct.sub_category_id)
  const selectionComplete =
    !!editProduct ||   // editing: always show full form immediately
    (
      !!form.explicit_product_type &&
      !!form.category_id &&
      !!form.brand_id &&
      subCategorySatisfied
    )

  // Set a dynamic field's value. Column-backed fields live on form[key];
  // attributes-backed fields live on form.attributes[key].
  // For stone_block fields, auto-compute CBM & tonnage when dims/density change.
  // NOTE: categoryType is read INSIDE the setForm updater callback to avoid a
  // stale-closure infinite re-render (setForm always runs against latest state).
  const setDynamic = useCallback((field, val) => {
    if (field.storeIn === 'attributes') {
      setForm(f => {
        const explicitType = f.explicit_product_type
        const catName = (() => {
          try {
            const c = categories.find(x => String(x._id || x.id) === String(f.category_id))
            return c?.name || ''
          } catch { return '' }
        })()
        const subName = (() => {
          try {
            const s = subCategories.find(x => String(x._id || x.id) === String(f.sub_category_id))
            return s?.name || ''
          } catch { return '' }
        })()
        const ct = explicitType || matchCategoryType(catName, subName)
        const attrs = { ...(f.attributes || {}), [field.key]: val }
        // ── stone_block auto-compute ──────────────────────────────
        if (ct === 'stone_block') {
          const grossCbm = cbmFromMm(
            attrs.gross_length_mm ?? f.attributes?.gross_length_mm,
            attrs.gross_width_mm  ?? f.attributes?.gross_width_mm,
            attrs.gross_height_mm ?? f.attributes?.gross_height_mm,
          )
          if (grossCbm !== '') attrs.gross_cbm = grossCbm
          const netCbm = cbmFromMm(
            attrs.net_length_mm ?? f.attributes?.net_length_mm,
            attrs.net_width_mm  ?? f.attributes?.net_width_mm,
            attrs.net_height_mm ?? f.attributes?.net_height_mm,
          )
          if (netCbm !== '') attrs.net_cbm = netCbm
          const density = attrs.density ?? f.attributes?.density
          if (grossCbm !== '') {
            const gw = tonsFromCbmAndDensity(grossCbm, density)
            if (gw !== '') attrs.gross_weight_tons = gw
          }
          if (netCbm !== '') {
            const nw = tonsFromCbmAndDensity(netCbm, density)
            if (nw !== '') attrs.net_weight_tons = nw
          }
          // If only density changes, re-compute weights using existing CBMs
          if (field.key === 'density') {
            const existingGrossCbm = grossCbm !== '' ? grossCbm : (attrs.gross_cbm ?? f.attributes?.gross_cbm)
            const existingNetCbm   = netCbm   !== '' ? netCbm   : (attrs.net_cbm   ?? f.attributes?.net_cbm)
            const gw2 = tonsFromCbmAndDensity(existingGrossCbm, density)
            const nw2 = tonsFromCbmAndDensity(existingNetCbm, density)
            if (gw2 !== '') attrs.gross_weight_tons = gw2
            if (nw2 !== '') attrs.net_weight_tons   = nw2
          }
        }
        // ── tiles auto-compute: Area / piece + sqft / pallet ───
        if (ct === 'tiles') {
          const lmm = parseFloat(attrs.piece_length_mm ?? f.attributes?.piece_length_mm)
          const wmm = parseFloat(attrs.piece_width_mm  ?? f.attributes?.piece_width_mm)
          if (lmm > 0 && wmm > 0) {
            attrs.area_per_piece_sqft = ((lmm / 304.8) * (wmm / 304.8)).toFixed(3)
          }
          const bpp = parseFloat(attrs.boxes_per_pallet ?? f.attributes?.boxes_per_pallet)
          const spb = parseFloat(f.sqft_per_box)
          if (bpp > 0 && spb > 0) {
            attrs.sqft_per_pallet = (bpp * spb).toFixed(2)
          }
        }
        // ── granite + marble auto-compute ────────────────────────
        if (ct === 'granite' || ct === 'marble') {
          const lmm = parseFloat(attrs.length_mm ?? f.attributes?.length_mm)
          const wmm = parseFloat(attrs.width_mm  ?? f.attributes?.width_mm)
          if (lmm > 0 && wmm > 0) {
            attrs.area_per_piece = ((lmm / 304.8) * (wmm / 304.8)).toFixed(3)
          }
          const ppp = parseFloat(attrs.pcs_per_crate ?? f.attributes?.pcs_per_crate)
          const app = parseFloat(attrs.area_per_piece ?? f.attributes?.area_per_piece)
          if (ppp > 0 && app > 0) {
            attrs.sqft_per_crate = (ppp * app).toFixed(2)
          }
          const tkStr = (f.thickness || '').toString()
          const tk = parseFloat(tkStr) || 0
          const density = parseFloat(attrs.density ?? f.attributes?.density) || 2700
          if (ppp > 0 && app > 0 && tk > 0) {
            const volM3PerPiece = (app * 0.092903) * (tk / 1000)
            attrs.weight_per_crate = (ppp * volM3PerPiece * density).toFixed(1)
          }
        }
        return { ...f, attributes: attrs }
      })
    } else {
      setForm(f => {
        const next = { ...f, [field.key]: val }
        if (field.key === 'size' || field.key === 'pcs_per_box') {
          next.sqft_per_box = calcSqftPerBox(next.size, next.pcs_per_box)
        }
        return next
      })
    }
  }, [categories, subCategories])

  const getDynamic = (field) =>
    field.storeIn === 'attributes'
      ? (form.attributes?.[field.key] ?? '')
      : (form[field.key] ?? '')

  // Populate form on edit
  useEffect(() => {
    if (editProduct) {
      const explicitType =
        editProduct.category_type && PRODUCT_FIELD_SCHEMA[editProduct.category_type]
          ? editProduct.category_type
          : matchCategoryType(
              editProduct.category_id?.name || editProduct.category_name,
              editProduct.sub_category_id?.name || editProduct.sub_category_name,
            )
      setForm({
        code:              editProduct.code              || '',
        name:              editProduct.name              || '',
        alias:             editProduct.alias             || '',
        description:       editProduct.description       || '',
        hsn_code:          editProduct.hsn_code          || '',
        brand_id:          editProduct.brand_id?._id     || editProduct.brand_id     || '',
        category_id:       editProduct.category_id?._id  || editProduct.category_id  || '',
        sub_category_id:   editProduct.sub_category_id?._id || editProduct.sub_category_id || '',
        unit:              editProduct.unit              || 'Box',
        gst_percent:       String(editProduct.gst_percent ?? '18'),
        size:              editProduct.size              || '',
        finish:            editProduct.finish            || '',
        color:             editProduct.color             || '',
        surface:           editProduct.surface           || '',
        thickness:         editProduct.thickness         || '',
        grade:             editProduct.grade             || '',
        tile_type:         editProduct.tile_type         || '',
        application:       editProduct.application       || '',
        anti_skid:         editProduct.anti_skid         || '',
        origin:            editProduct.origin            || '',
        manufacturer:      editProduct.manufacturer      || '',
        barcode:           editProduct.barcode           || '',
        design:            editProduct.design            || '',
        collection:        editProduct.collection        || '',
        pcs_per_box:       editProduct.pcs_per_box       || '',
        sqft_per_box:      editProduct.sqft_per_box      || '',
        weight_per_box:    editProduct.weight_per_box    || '',
        purchase_rate:     editProduct.purchase_price    || editProduct.purchase_rate || '',
        landing_cost:      editProduct.landing_cost      || '',
        mrp:               editProduct.mrp               || '',
        retail_rate:       editProduct.retail_price      || editProduct.retail_rate  || '',
        wholesale_rate:    editProduct.wholesale_rate    || '',
        retail_discount:   editProduct.retail_discount   || '',
        wholesale_discount:editProduct.wholesale_discount|| '',
        status:            editProduct.is_active !== false ? 'Active' : 'Inactive',
        sales_type:        editProduct.sales_type        || 'Regular Sale',
        product_type:      editProduct.product_type      || 'Regular Product',
        new_arrival:       !!editProduct.new_arrival,
        featured:          !!editProduct.featured,
        min_stock_level:   editProduct.min_stock_level != null ? String(editProduct.min_stock_level) : '',
        reorder_level:     editProduct.reorder_level   != null ? String(editProduct.reorder_level)   : '',
        explicit_product_type: explicitType,
        attributes:        (editProduct.attributes && typeof editProduct.attributes === 'object') ? { ...editProduct.attributes } : {},
      })
      setExistingImages(editProduct.image_urls || [])
      const attrs = (editProduct.attributes && typeof editProduct.attributes === 'object') ? editProduct.attributes : {}
      const schemaKeys = new Set(fieldsForType(explicitType).map(f => f.key))
      setCustomSpecs(
        Object.entries(attrs)
          .filter(([k]) => !schemaKeys.has(k))
          .map(([k, v]) => ({ label: humanizeKey(k), value: String(v ?? '') }))
      )
    } else {
      setForm(EMPTY_FORM)
      setExistingImages([])
      setCustomSpecs([])
    }
    setErrors({})
    setImageFiles([])
    setImgResetKey(k => k + 1)
  }, [editProduct?._id || editProduct?.id])

  const set = useCallback((field, val) => setForm(f => {
    const next = { ...f, [field]: val }
    // Auto-calculate Sqft/Box when tile size or pcs/box changes.
    // Always overwrite (including clearing) so a stale value is never left behind.
    if (field === 'size' || field === 'pcs_per_box') {
      next.sqft_per_box = calcSqftPerBox(next.size, next.pcs_per_box)
    }
    // Auto-calculate rates from MRP + discount %.
    const RATE_DISCOUNTS = {
      retail_rate:    'retail_discount',
      wholesale_rate: 'wholesale_discount',
    }
    const applyDiscount = (rateField, discField) => {
      const mrp  = parseFloat(next.mrp)
      const disc = parseFloat(next[discField])
      if (mrp > 0 && disc >= 0 && next[discField] !== '' && next[discField] != null) {
        next[rateField] = (mrp * (1 - disc / 100)).toFixed(2)
      }
    }
    // When a discount field changes, recompute its own rate.
    for (const [rateField, discField] of Object.entries(RATE_DISCOUNTS)) {
      if (field === discField) applyDiscount(rateField, discField)
    }
    // When MRP changes, recompute every rate that has a discount % set.
    if (field === 'mrp') {
      for (const [rateField, discField] of Object.entries(RATE_DISCOUNTS)) {
        applyDiscount(rateField, discField)
      }
    }
    return next
  }), [])

  const validate = () => {
    const e = {}
    if (!form.name.trim()) e.name = 'Product name is required'
    if (!form.brand_id)    e.brand_id = 'Brand is required'
    if (!form.category_id) e.category_id = 'Category is required'
    if (categoryHasSubs && !form.sub_category_id && !(editProduct && !editProduct.sub_category_id)) {
      e.sub_category_id = 'Sub-category is required'
    }
    if (!form.unit)        e.unit = 'Unit is required'
    if (!form.explicit_product_type) e.explicit_product_type = 'Product Type is required'

    // Required category-specific fields.
    dynamicFields.forEach(f => {
      if (!f.required) return
      const val = getDynamic(f)
      if (val === '' || val == null) e[`dyn_${f.key}`] = `${f.label} is required`
    })

    const minStock = form.min_stock_level
    if (minStock !== '' && minStock !== null && minStock !== undefined) {
      if (!Number.isFinite(Number(minStock)) || Number(minStock) < 0) {
        e.min_stock_level = 'Enter a valid number (0 or more)'
      }
    }
    const reorder = form.reorder_level
    if (reorder !== '' && reorder !== null && reorder !== undefined) {
      if (!Number.isFinite(Number(reorder)) || Number(reorder) < 0) {
        e.reorder_level = 'Enter a valid number (0 or more)'
      }
    }
    return e
  }

  // Collect the attributes-backed dynamic fields for the current category type,
  // plus any admin-added custom specifications. Empty values are dropped.
  const buildAttributesPayload = () => {
    const out = {}
    dynamicFields.forEach(f => {
      if (f.storeIn !== 'attributes') return
      const raw = form.attributes?.[f.key]
      if (raw === '' || raw == null) return
      out[f.key] = f.type === 'number' ? (parseFloat(raw) || 0) : raw
    })
    // Custom specs — label becomes a snake_case key.
    customSpecs.forEach(({ label, value }) => {
      const key = String(label || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
      if (!key || value === '' || value == null) return
      out[key] = value
    })
    return out
  }

  const handleSave = async () => {
    const e = validate()
    if (Object.keys(e).length) {
      setErrors(e)
      // Surface the block instead of failing silently. Show which required
      // fields are missing and jump to the first one so the user can fix it.
      const msgs = Object.values(e)
      try {
        const firstKey = Object.keys(e)[0]
        const el = document.querySelector(`[name="${firstKey}"]`) ||
                   document.getElementById(`field-${firstKey}`)
        if (el && el.scrollIntoView) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      } catch { /* ignore */ }
      alert('Please complete these required fields:\n\n• ' + msgs.join('\n• '))
      return
    }

    // Build a plain object - productApi.create / productApi.update handle FormData internally
    // when imageFiles is present. Field name 'file' matches multer's uploadImages middleware.
    const payload = {
      name:            form.name.trim(),
      alias:           form.alias.trim(),
      brand_id:        form.brand_id        || null,
      category_id:     form.category_id     || null,
      sub_category_id: form.sub_category_id || null,
      unit:            form.unit,
      gst_percent:     parseFloat(form.gst_percent) || 18,
      description:     form.description,
      hsn_code:        form.hsn_code,
      size:            form.size,
      finish:          form.finish,
      color:           form.color,
      surface:         form.surface,
      thickness:       form.thickness,
      grade:           form.grade,
      tile_type:       form.tile_type,
      application:     form.application,
      anti_skid:       form.anti_skid,
      origin:          form.origin,
      manufacturer:    form.manufacturer,
      barcode:         form.barcode,
      design:          form.design,
      collection:      form.collection,
      pcs_per_box:     form.pcs_per_box    ? parseFloat(form.pcs_per_box)     : null,
      sqft_per_box:    form.sqft_per_box   ? parseFloat(form.sqft_per_box)    : null,
      weight_per_box:  form.weight_per_box ? parseFloat(form.weight_per_box)  : null,
      purchase_price:  parseFloat(form.purchase_rate)    || 0,
      mrp:             parseFloat(form.mrp)              || 0,
      min_stock_level: form.min_stock_level !== '' && form.min_stock_level != null ? parseFloat(form.min_stock_level) : null,
      reorder_level:   form.reorder_level   !== '' && form.reorder_level   != null ? parseFloat(form.reorder_level)   : null,
      is_active:       form.status === 'Active',
      sales_type:      form.sales_type,
      product_type:    form.product_type,
      new_arrival:     form.new_arrival,
      featured:        form.featured,
      category_type:   form.explicit_product_type || categoryType,
      attributes:      buildAttributesPayload(),
      image_urls:      existingImages,
      imageFiles:      imageFiles,
    }

    if (!editProduct) {
      if (form.code.trim()) payload.code = form.code.trim()
    }

    await onSave(payload)
  }

  // Ensure the currently-saved category/brand ref stays selectable in edit mode.
  const withCurrentReference = (opts, reference, current) => {
    const value = String(current || reference?._id || reference?.id || '').trim()
    if (!value || opts.some(option => String(option.value) === value)) return opts
    const label = typeof reference === 'object' && reference?.name ? reference.name : value
    return [{ value, label }, ...opts]
  }

  const brandOpts = withCurrentReference(
    brands.map(b => ({ value: b._id || b.id, label: b.name })),
    editProduct?.brand_id,
    form.brand_id
  )
  const catOpts = withCurrentReference(
    categories.filter(c => !c.parent_id).map(c => ({ value: c._id || c.id, label: c.name })),
    editProduct?.category_id,
    form.category_id
  )
  const subCatOpts = withCurrentReference(
    filteredSubs.map(s => ({ value: s._id || s.id, label: s.name })),
    editProduct?.sub_category_id,
    form.sub_category_id
  )
  // (Category-specific spec option lists are now generated dynamically from
  // productFieldSchema; the old static option variables were removed.)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        style={{ maxWidth: 1200, width: '96vw', maxHeight: '96vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header" style={{ position:'sticky', top:0, background:'var(--surface)', zIndex:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <Package size={18} style={{ color:'var(--primary)' }} />
            <span className="modal-title">{editProduct ? 'Edit Product' : 'Add New Product'}</span>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn btn-secondary btn-sm" type="button"
              onClick={() => { setForm(EMPTY_FORM); setErrors({}); setImgResetKey(k=>k+1); setImageFiles([]); setExistingImages([]); setCustomSpecs([]) }}>
              Clear Form
            </button>
            <button className="modal-close" onClick={onClose}><X size={16} /></button>
          </div>
        </div>

        <div className="modal-body" style={{ padding:'24px 28px' }}>

          {/* â”€â”€ STEP 1: PRODUCT TYPE + CATEGORY â†’ SUB-CATEGORY â†’ BRAND (required first) â”€â”€ */}
          <FormSection title="Step 1 · Select Product Type, Category, Sub-Category & Brand" />
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:16 }}>
            {/* Product Type */}
            <div>
              <SelectField
                label="Product Type" required
                placeholder="Choose a product type"
                value={form.explicit_product_type}
                onChange={v => {
                  setForm(f => ({
                    ...f,
                    explicit_product_type: v,
                    // Preselect a sensible default unit for this product type (only when adding / not editing).
                    unit: editProduct ? f.unit : (CATEGORY_DEFAULT_UNIT[v] || f.unit),
                  }))
                }}
                options={PRODUCT_TYPES}
              />
              {errors.explicit_product_type && <span className="form-error">{errors.explicit_product_type}</span>}
              {form.explicit_product_type && (
                <div style={{ fontSize:11, color:'var(--primary)', marginTop:4, fontWeight:600 }}>
                  Form will show {shortLabelForType(form.explicit_product_type)}-specific fields
                </div>
              )}
            </div>
            {/* Category */}
            <div>
              <SearchableSelect
                label="Category" required
                placeholder="Search categories..."
                value={form.category_id}
                onChange={v => {
                  const c = categories.find(x => String(x._id || x.id) === String(v))
                  const t = matchCategoryType(c?.name)
                  setForm(f => ({
                    ...f,
                    category_id: v,
                    sub_category_id: '',
                    // If user hasn't manually picked a product type, auto-suggest from category name.
                    explicit_product_type: f.explicit_product_type || t,
                    unit: editProduct ? f.unit : (CATEGORY_DEFAULT_UNIT[f.explicit_product_type || t] || f.unit),
                  }))
                }}
                options={catOpts}
                onCreate={onCreateCategory}
                createLabel="Add category"
                onDelete={onDeleteCategory
                  ? async (id) => {
                      const ok = await onDeleteCategory(id)
                      if (ok && String(form.category_id) === String(id)) {
                        setForm(f => ({ ...f, category_id: '', sub_category_id: '' }))
                      }
                    }
                  : undefined}
              />
              {errors.category_id && <span className="form-error">{errors.category_id}</span>}
            </div>
            {/* Subcategory */}
            <div>
              <SearchableSelect
                label={`Sub-Category${categoryHasSubs ? ' *' : ''}`}
                placeholder={form.category_id ? 'Search or add subcategory...' : 'Select a category first'}
                value={form.sub_category_id}
                onChange={v => set('sub_category_id', v)}
                options={subCatOpts}
                disabled={!form.category_id}
                onCreate={form.category_id && onCreateSubCategory
                  ? (name) => onCreateSubCategory(name, form.category_id)
                  : undefined}
                createLabel="Add sub-category"
                onDelete={onDeleteSubCategory
                  ? async (id) => {
                      const ok = await onDeleteSubCategory(id)
                      if (ok && String(form.sub_category_id) === String(id)) {
                        setForm(f => ({ ...f, sub_category_id: '' }))
                      }
                    }
                  : undefined}
              />
              {errors.sub_category_id && <span className="form-error">{errors.sub_category_id}</span>}
            </div>
            {/* Brand */}
            <div>
              <SearchableSelect
                label="Brand" required
                placeholder="Search brands..."
                value={form.brand_id}
                onChange={v => set('brand_id', v)}
                options={brandOpts}
                onCreate={onCreateBrand}
                createLabel="Add brand"
                onDelete={onDeleteBrand
                  ? async (id) => {
                      const ok = await onDeleteBrand(id)
                      if (ok && String(form.brand_id) === String(id)) {
                        setForm(f => ({ ...f, brand_id: '' }))
                      }
                    }
                  : undefined}
              />
              {errors.brand_id && <span className="form-error">{errors.brand_id}</span>}
            </div>
          </div>

          {!selectionComplete && !editProduct && (
            <div style={{
              marginTop:16, padding:'16px 18px', background:'var(--bg)',
              border:'1px dashed var(--border)', borderRadius:8, fontSize:13, color:'var(--text-muted)',
            }}>
              Please select <strong>Product Type</strong>, <strong>Category</strong>{categoryHasSubs ? <>, <strong>Sub-Category</strong></> : ''} and <strong>Brand</strong> to continue adding the product details.
            </div>
          )}

          {selectionComplete && (<>

          {/* â”€â”€ STEP 2: PRODUCT DETAILS â”€â”€ */}
          <FormSection title="Step 2 · Product Details" />
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginTop:0 }}>
            <div>
              <label className="form-label">Product Code</label>
              <input className="form-control" placeholder="Will be auto-generated if left empty"
                value={form.code} onChange={e => set('code', e.target.value)} disabled={!!editProduct} />
            </div>
            {/*Product Name*/}
            <div>
              <label className="form-label">Product Name <span style={{ color:'var(--danger)' }}>*</span></label>
              <input className={`form-control${errors.name ? ' error' : ''}`} placeholder="Enter product name"
                value={form.name} onChange={e => set('name', e.target.value)} />
              {errors.name && <span className="form-error">{errors.name}</span>}
            </div>
            {/* HSN Code */}
            <div>
              <label className="form-label">HSN Code</label>
              <input className="form-control" placeholder="Enter HSN code (optional)"
                value={form.hsn_code} onChange={e => set('hsn_code', e.target.value)} />
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr 1fr 1fr', gap:14, marginTop:14 }}>
            {/* Alias */}
            <div>
              <label className="form-label">Alias Name (optional)</label>
              <input className="form-control" placeholder="Enter alias / alternate name"
                value={form.alias} onChange={e => set('alias', e.target.value)} />
            </div>
            {/* Description */}
            <div>
              <label className="form-label">Description</label>
              <input className="form-control" placeholder="Enter product description"
                value={form.description} onChange={e => set('description', e.target.value)} />
            </div>
            {/* Unit */}
            <div>
              <SelectField
                label="Unit" required
                value={form.unit}
                onChange={v => set('unit', v)}
                options={UNITS}
              />
              {errors.unit && <span className="form-error">{errors.unit}</span>}
            </div>
            {/* GST % */}
            <SelectField
              label="GST %"
              value={form.gst_percent}
              onChange={v => set('gst_percent', v)}
              options={GST_OPTS.map(g => ({ value: g, label: g + '%' }))}
            />
          </div>

          {/* â”€â”€ DYNAMIC CATEGORY-SPECIFIC SPECIFICATIONS â”€â”€ */}
          <FormSection title={categoryChosen ? `${labelForType(categoryType)} Specifications` : 'Specifications'} />
          {!categoryChosen ? (
            <div style={{
              padding:'16px 18px', background:'var(--bg)', border:'1px dashed var(--border)',
              borderRadius:8, fontSize:13, color:'var(--text-muted)',
            }}>
              Select a <strong>Category</strong> above to load the relevant specification fields for this product.
            </div>
          ) : (
            <>
              <div style={{ fontSize:12, color:'var(--text-muted)', marginBottom:10 }}>
                Fields below are tailored to <strong>{labelForType(categoryType)}</strong>. Required fields are marked *.
              </div>

              {(() => {
                // ── Group fields by their `section` property and render ──
                //    a FormSection heading whenever the section changes.
                //    Fields without a section property are placed at the start.
                const groups = []
                let currentSection = null
                let currentFields = []
                dynamicFields.forEach(f => {
                  const section = f.section || null
                  if (section !== currentSection) {
                    if (currentFields.length > 0 || currentSection != null) {
                      groups.push({ section: currentSection, fields: currentFields })
                    }
                    currentSection = section
                    currentFields = [f]
                  } else {
                    currentFields.push(f)
                  }
                })
                if (currentFields.length > 0 || currentSection != null) {
                  groups.push({ section: currentSection, fields: currentFields })
                }
                return groups.map((group, gi) => (
                  <div key={gi} style={{ marginBottom: gi < groups.length - 1 ? 4 : 0 }}>
                    {group.section && (
                      <FormSection title={group.section} />
                    )}
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
                      {group.fields.map(f => {
                        const val = getDynamic(f)
                        const errKey = `dyn_${f.key}`
                        if (f.type !== 'number') {
                          return (
                            <div key={f.key}>
                              <EditableSelect
                                label={f.label + (f.required ? ' *' : '')}
                                placeholder={f.placeholder || f.label}
                                value={val}
                                onChange={v => setDynamic(f, v)}
                                baseOptions={f.options || []}
                                fieldKey={`${categoryType}.${f.key}`}
                              />
                              {errors[errKey] && <span className="form-error">{errors[errKey]}</span>}
                            </div>
                          )
                        }
                        return (
                          <div key={f.key}>
                            <label className="form-label">
                              {f.label}{f.required && <span style={{ color:'var(--danger)' }}> *</span>}
                              {f.unit && <span style={{ fontWeight:400, color:'var(--text-muted)', fontSize:11 }}> ({f.unit})</span>}
                            </label>
                            <input
                              className={`form-control${errors[errKey] ? ' error' : ''}`}
                              type="number"
                              min="0"
                              step="any"
                              placeholder={f.placeholder || f.label}
                              value={val}
                              onChange={e => setDynamic(f, e.target.value)}
                            />
                            {errors[errKey] && <span className="form-error">{errors[errKey]}</span>}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))
              })()}

              {/* Common trade identifiers, shown for every category */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:14, marginTop:14 }}>
                <div>
                  <label className="form-label">Manufacturer</label>
                  <input className="form-control" placeholder="If different from brand" value={form.manufacturer} onChange={e=>set('manufacturer',e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Barcode / EAN</label>
                  <input className="form-control" placeholder="Barcode/EAN" value={form.barcode} onChange={e=>set('barcode',e.target.value)} />
                </div>
              </div>

              {/* â”€â”€ ADMIN-ADDED CUSTOM SPECIFICATIONS â”€â”€ */}
              <div style={{ marginTop:18 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>Additional Specifications</span>
                  <button type="button" className="btn btn-secondary btn-sm" style={{ gap:6 }}
                    onClick={() => setCustomSpecs(list => [...list, { label:'', value:'' }])}>
                    <Plus size={13}/> Add Specification
                  </button>
                </div>
                {customSpecs.length === 0 ? (
                  <div style={{ fontSize:12, color:'var(--text-muted)' }}>
                    Need a field that isn't listed above? Click <strong>Add Specification</strong> to add your own (e.g. Batch No, Shade, Warranty).
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {customSpecs.map((spec, idx) => (
                      <div key={idx} style={{ display:'grid', gridTemplateColumns:'1fr 1fr auto', gap:10, alignItems:'center' }}>
                        <input className="form-control" placeholder="Specification name (e.g. Shade)"
                          value={spec.label}
                          onChange={e => setCustomSpecs(list => list.map((s,i) => i===idx ? { ...s, label:e.target.value } : s))} />
                        <input className="form-control" placeholder="Value (e.g. Dark)"
                          value={spec.value}
                          onChange={e => setCustomSpecs(list => list.map((s,i) => i===idx ? { ...s, value:e.target.value } : s))} />
                        <button type="button" title="Remove specification"
                          className="btn btn-ghost btn-xs" style={{ color:'var(--danger)' }}
                          onClick={() => setCustomSpecs(list => list.filter((_,i) => i!==idx))}>
                          <Trash2 size={14}/>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* PRICING */}
          <FormSection title="Pricing" />
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:16 }}>
            <PriceInput label="Purchase Rate"   value={form.purchase_rate}   onChange={v=>set('purchase_rate',v)} />
            <PriceInput label="MRP"             value={form.mrp}             onChange={v=>set('mrp',v)} />
          </div>

          </>)}

          {/* â”€â”€ IMAGES â”€â”€ Always rendered OUTSIDE selectionComplete gate so preview state survives re-renders */}
          <FormSection title="Product Images" />
          <ImagePicker
            existingUrls={existingImages}
            onFilesChange={setImageFiles}
            onRemoveExisting={idx => setExistingImages(p => p.filter((_,i)=>i!==idx))}
            resetKey={imgResetKey}
            initialFiles={imageFiles}
          />

        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ position:'sticky', bottom:0, background:'var(--surface)', zIndex:10 }}>
          <button className="btn btn-secondary" type="button" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" type="button" disabled={saving || !selectionComplete} onClick={handleSave}
            style={{ minWidth:120 }} title={!selectionComplete ? 'Select Product Type, Category, Sub-Category and Brand first' : ''}>
            {saving ? 'Saving...' : 'Preview & Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// PRODUCT DETAIL VIEW MODAL
// ══════════════════════════════════════════════════════════════
// PRODUCT DETAIL VIEW MODAL — clean full-detail layout
// ══════════════════════════════════════════════════════════════
function ProductViewModal({ product: p, loading, onClose, onEdit, canEdit, canExport }) {
  const [imgIdx, setImgIdx] = useState(0)
  if (!p) return null

  const images = (p.image_urls || []).filter(Boolean)
  const v   = (x) => (x && String(x).trim()) ? String(x).trim() : null
  const fmtN = (n) => {
    const num = parseFloat(n) || 0
    return num > 0 ? `₹${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : null
  }
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' }) : null

  // Determine product type for section labels & field names
  const effCatType = p.category_type || matchCategoryType(p.category_name || p.category_id?.name) || 'other'
  const isStoneProduct = ['granite','marble','stone_block'].includes(effCatType)
  const isTileProduct  = ['tiles'].includes(effCatType)
  const isBlockProduct = ['stone_block'].includes(effCatType)

  // Spec section title, icon, and labels based on product type
  const specSectionTitle = (() => {
    if (effCatType === 'granite')     return { icon:'🪨', title:'Granite Specifications' }
    if (effCatType === 'marble')      return { icon:'💠', title:'Marble Specifications' }
    if (effCatType === 'stone_block') return { icon:'🧱', title:'Stone Block Specifications' }
    if (effCatType === 'tiles')       return { icon:'🔲', title:'Tile Specifications' }
    if (effCatType === 'sanitaryware')return { icon:'🚿', title:'Sanitaryware Specifications' }
    if (effCatType === 'blocks')      return { icon:'🧱', title:'Block Specifications' }
    if (effCatType === 'non_sanitary')return { icon:'🛠️', title:'Item Specifications' }
    return { icon:'📋', title:'Product Specifications' }
  })()

  // Size label varies by product type
  const sizeLabel = isBlockProduct ? 'Block Size'
                  : isStoneProduct ? 'Slab / Tile Size'
                  : 'Tile Size'
  const typeLabel = isBlockProduct ? 'Stone Type'
                  : isStoneProduct ? 'Product Form'
                  : 'Tile Type'
  // Packing unit: crate for stone, box for tiles
  const packUnit = isStoneProduct ? 'Crate' : 'Box'

  // Map an attribute key to a friendly label using the schema, with a unit suffix
  // when defined; falls back to a humanized key.
  const attrLabel = (key) => {
    for (const list of Object.values(PRODUCT_FIELD_SCHEMA)) {
      const def = list.find(f => f.key === key)
      if (def) return def.unit ? `${def.label} (${def.unit})` : def.label
    }
    return humanizeKey(key)
  }

  // ── helpers ──
  const SectionTitle = ({ icon, title }) => (
    <div style={{ display:'flex', alignItems:'center', gap:7, padding:'14px 0 8px', borderBottom:'2px solid var(--border)', marginBottom:12 }}>
      <span style={{ fontSize:14 }}>{icon}</span>
      <span style={{ fontSize:12, fontWeight:800, textTransform:'uppercase', letterSpacing:'.07em', color:'var(--text-muted)' }}>{title}</span>
    </div>
  )

  const Field = ({ label, value, mono, highlight, showEmpty }) => {
    const has = !!v(value)
    if (!has && !showEmpty) return null
    return (
      <div style={{ minWidth:0 }}>
        <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--text-muted)', marginBottom:3 }}>{label}</div>
        <div style={{
          fontSize: highlight ? 14 : 13,
          fontWeight: highlight ? 700 : 500,
          color: has ? 'var(--text)' : 'var(--text-light)',
          fontFamily: mono ? 'monospace' : 'inherit',
          wordBreak: 'break-word',
        }}>{has ? value : '—'}</div>
      </div>
    )
  }

  const PriceBox = ({ label, value, primary }) => {
    const txt = fmtN(value)
    if (!txt) return null
    return (
      <div style={{
        background: primary ? '#FFF3EC' : 'var(--bg)',
        border: `1px solid ${primary ? '#FD5C02' : 'var(--border)'}`,
        borderRadius: 10, padding:'12px 14px', textAlign:'center',
      }}>
        <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color: primary ? '#FD5C02' : 'var(--text-muted)', marginBottom:4 }}>{label}</div>
        <div style={{ fontSize:17, fontWeight:800, color: primary ? '#FD5C02' : 'var(--text)' }}>{txt}</div>
      </div>
    )
  }

  const Flag = ({ label, on }) => (
    <div style={{ display:'flex', alignItems:'center', gap:6 }}>
      <div style={{ width:16, height:16, borderRadius:'50%', background: on ? 'var(--success)' : 'var(--border)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <span style={{ fontSize:9, color:'#fff', fontWeight:800 }}>{on ? '✓' : '✗'}</span>
      </div>
      <span style={{ fontSize:12, color: on ? 'var(--text)' : 'var(--text-muted)', fontWeight: on ? 600 : 400 }}>{label}</span>
    </div>
  )

  // pricing array — only show non-zero
  const prices = [
    { label:'MRP',            value: p.mrp,                                primary: true },
    { label:'Purchase Rate',  value: p.purchase_price || p.purchase_rate },
  ].filter(x => (parseFloat(x.value) || 0) > 0)

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:900, width:'100%', maxHeight:'92vh', overflowY:'auto' }}
        onClick={e => e.stopPropagation()}>

        {/* ── Sticky Header ── */}
        <div className="modal-header" style={{ position:'sticky', top:0, background:'var(--surface)', zIndex:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0, flex:1 }}>
            <Package size={18} style={{ color:'var(--primary)', flexShrink:0 }}/>
            <div style={{ minWidth:0 }}>
              <div style={{ fontSize:15, fontWeight:800, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
              {p.code && (
                <span style={{ fontSize:11, fontFamily:'monospace', color:'var(--primary)', background:'rgba(253,92,2,.08)', padding:'1px 8px', borderRadius:5 }}>{p.code}</span>
              )}
            </div>
          </div>
          <div style={{ display:'flex', gap:7, flexShrink:0 }}>
            {canExport && (
              <button className="btn btn-sm" onClick={() => downloadProduct(p)}
                style={{ background:'var(--info)', color:'#fff', gap:5 }}>
                <Download size={13}/> Download
              </button>
            )}
            {canEdit && (
              <button className="btn btn-sm btn-secondary" onClick={() => onEdit(p)} style={{ gap:5 }}>
                <Edit2 size={13}/> Edit
              </button>
            )}
            <button className="modal-close" onClick={onClose}><X size={16}/></button>
          </div>
        </div>
        {/* Loading bar — shows while fetching full data */}
        {loading && (
          <div style={{ height:3, background:'var(--border)', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', height:'100%', width:'40%', background:'var(--primary)',
              animation:'slideBar 1s ease-in-out infinite alternate',
              borderRadius:2 }}/>
          </div>
        )}
        <style>{`@keyframes slideBar{from{left:-40%}to{left:100%}}`}</style>

        <div className="modal-body" style={{ padding:'20px 22px' }}>
          {/* ── Top: Image + Basic Info side by side ── */}
          <div style={{ display:'grid', gridTemplateColumns:'200px 1fr', gap:20, marginBottom:4 }}>

            {/* Image Gallery */}
            <div>
              <div style={{
                width:'100%', aspectRatio:'1/1', borderRadius:10,
                background:'var(--bg)', border:'1px solid var(--border)',
                overflow:'hidden', position:'relative',
              }}>
                {images.length > 0
                  ? <img src={imgUrl(images[imgIdx])} alt={p.name}
                      style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                  : <div style={{ width:'100%', height:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'var(--text-muted)', gap:6 }}>
                      <Package size={36} style={{ opacity:.2 }}/>
                      <span style={{ fontSize:11 }}>No image</span>
                    </div>
                }
                {images.length > 1 && (
                  <>
                    <button onClick={() => setImgIdx(i => (i-1+images.length)%images.length)}
                      style={{ position:'absolute', left:4, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,.4)', border:'none', borderRadius:'50%', width:24, height:24, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <ChevronLeft size={13}/>
                    </button>
                    <button onClick={() => setImgIdx(i => (i+1)%images.length)}
                      style={{ position:'absolute', right:4, top:'50%', transform:'translateY(-50%)', background:'rgba(0,0,0,.4)', border:'none', borderRadius:'50%', width:24, height:24, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <ChevronRight size={13}/>
                    </button>
                    <div style={{ position:'absolute', bottom:5, left:'50%', transform:'translateX(-50%)', display:'flex', gap:4 }}>
                      {images.map((_,i) => (
                        <div key={i} onClick={() => setImgIdx(i)} style={{ width:6, height:6, borderRadius:'50%', background: i===imgIdx ? '#FD5C02' : 'rgba(255,255,255,.6)', cursor:'pointer' }}/>
                      ))}
                    </div>
                  </>
                )}
              </div>
              {/* Thumbnails */}
              {images.length > 1 && (
                <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginTop:7 }}>
                  {images.map((u,i) => (
                    <img key={i} src={imgUrl(u)} alt="" onClick={() => setImgIdx(i)}
                      style={{ width:40, height:40, objectFit:'cover', borderRadius:6, cursor:'pointer',
                        border: `2px solid ${i===imgIdx ? '#FD5C02' : 'var(--border)'}` }}/>
                  ))}
                </div>
              )}
              {/* Status badge */}
              <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:6 }}>
                <span className={`badge ${p.is_active !== false ? 'badge-green' : 'badge-gray'}`} style={{ alignSelf:'flex-start' }}>
                  {p.is_active !== false ? '● Active' : '● Inactive'}
                </span>
                {v(p.product_type) && <span className="badge badge-blue" style={{ alignSelf:'flex-start', fontSize:11 }}>{p.product_type}</span>}
                {v(p.sales_type)   && <span className="badge badge-purple" style={{ alignSelf:'flex-start', fontSize:11 }}>{p.sales_type}</span>}
              </div>
            </div>

            {/* Basic Info grid */}
            <div>
              <SectionTitle icon="📋" title="Basic Information" />
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px 16px' }}>
                <Field label="Product Code"  value={v(p.code)}                                       mono highlight showEmpty />
                <Field label="Product Name"  value={v(p.name)}                                       highlight showEmpty />
                <Field label="Alias"         value={v(p.alias)} showEmpty />
                <Field label="Owner Company" value={v(p.company_id?.name)} />
                <Field label="Company Type"  value={v(p.company_id?.biz_type)} />
                <Field label="Added By"      value={creatorLabelOf(p)} highlight />
                <Field label="Brand"         value={v(p.brand_name)    || v(p.brand_id?.name)} showEmpty />
                <Field label="Category"      value={v(p.category_name) || v(p.category_id?.name)} showEmpty />
                <Field label="Sub-Category"  value={v(p.sub_category_name) || v(p.sub_category_id?.name)} showEmpty />
                <Field label="Unit"          value={v(p.unit)} showEmpty />
                <Field label="GST %"         value={p.gst_percent != null ? `${p.gst_percent}%` : null} showEmpty />
                <Field label="HSN Code"      value={v(p.hsn_code)} showEmpty />
              </div>
              {v(p.description) && (
                <div style={{ marginTop:10 }}>
                  <div style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'.06em', color:'var(--text-muted)', marginBottom:3 }}>Description</div>
                  <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.5, background:'var(--bg)', padding:'8px 12px', borderRadius:7, border:'1px solid var(--border)' }}>{p.description}</div>
                </div>
              )}
            </div>
          </div>

          {/* ── Product Type-Specific Specifications from columns ── */}
          {(v(p.size)||v(p.finish)||v(p.color)||v(p.surface)||v(p.thickness)||v(p.grade)||v(p.tile_type)||v(p.application)||v(p.anti_skid)||v(p.origin)||v(p.manufacturer)||v(p.barcode)) && (
            <div>
              <SectionTitle icon={specSectionTitle.icon} title={specSectionTitle.title} />
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px 16px' }}>
                <Field label={sizeLabel}       value={p.size ? p.size.toUpperCase()+' MM' : null} />
                <Field label="Finish"          value={v(p.finish)} />
                <Field label="Colour"          value={v(p.color)} />
                <Field label="Surface"         value={v(p.surface)} />
                <Field label="Thickness"       value={v(p.thickness)} />
                <Field label="Grade"           value={v(p.grade)} />
                <Field label={typeLabel}       value={v(p.tile_type)} />
                <Field label="Application"     value={v(p.application)} />
                <Field label="Anti Skid"       value={v(p.anti_skid)} />
                <Field label="Origin"          value={v(p.origin)} />
                <Field label="Manufacturer"    value={v(p.manufacturer)} />
                <Field label="Barcode / EAN"   value={v(p.barcode)} />
              </div>
            </div>
          )}

          {/* ── Packing & Collection ── */}
          {(v(p.design)||v(p.collection)||v(p.pcs_per_box)||v(p.sqft_per_box)||v(p.weight_per_box)) && (
            <div>
              <SectionTitle icon="📦" title={isStoneProduct ? `Packing & Details` : `Packing & Collection`} />
              <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'10px 16px' }}>
                <Field label="Design"                 value={v(p.design)} />
                <Field label="Collection"             value={v(p.collection)} />
                <Field label={`Pcs / ${packUnit}`}    value={p.pcs_per_box    ? String(p.pcs_per_box)                                    : null} />
                <Field label={`Sqft / ${packUnit}`}   value={p.sqft_per_box   ? `${parseFloat(p.sqft_per_box).toFixed(2)} Sq.Ft`          : null} />
                <Field label={`Weight / ${packUnit}`} value={p.weight_per_box ? `${parseFloat(p.weight_per_box).toFixed(2)} Kg`           : null} />
              </div>
            </div>
          )}

          {/* ── Additional (category-specific) Specifications from attributes ── */}
          {p.attributes && typeof p.attributes === 'object' && Object.keys(p.attributes).filter(k => v(p.attributes[k])).length > 0 && (
            <div>
              <SectionTitle icon="🧩" title={`${labelForType(p.category_type || matchCategoryType(p.category_name || p.category_id?.name))} Specifications`} />
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px 16px' }}>
                {Object.entries(p.attributes)
                  .filter(([, val]) => v(val))
                  .map(([key, val]) => (
                    <Field key={key} label={attrLabel(key)} value={String(val)} />
                  ))}
              </div>
            </div>
          )}

          {/* ── Pricing ── */}
          {prices.length > 0 && (
            <div>
              <SectionTitle icon="₹" title="Pricing" />
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10 }}>
                {prices.map(px => <PriceBox key={px.label} label={px.label} value={px.value} primary={px.primary}/>)}
              </div>
              {(parseFloat(p.min_stock_level)>0 || parseFloat(p.reorder_level)>0) && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px 16px', marginTop:12 }}>
                  {parseFloat(p.min_stock_level)>0 && <Field label="Min Stock Level" value={String(p.min_stock_level)}/>}
                  {parseFloat(p.reorder_level)>0    && <Field label="Reorder Level"   value={String(p.reorder_level)}/>}
                </div>
              )}
            </div>
          )}

          {/* ── Timestamps ── */}
          {(p.created_at || p.updated_at) && (
            <div style={{ marginTop:14, paddingTop:10, borderTop:'1px solid var(--border)', display:'flex', gap:20 }}>
              {fmtDate(p.created_at) && <span style={{ fontSize:11, color:'var(--text-muted)' }}>Created: {fmtDate(p.created_at)}</span>}
              {fmtDate(p.updated_at) && <span style={{ fontSize:11, color:'var(--text-muted)' }}>Updated: {fmtDate(p.updated_at)}</span>}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="modal-footer" style={{ position:'sticky', bottom:0, background:'var(--surface)', zIndex:10 }}>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
          {canExport && (
            <button className="btn btn-sm" onClick={() => downloadProduct(p)}
              style={{ background:'var(--info)', color:'#fff', gap:5 }}>
              <Download size={13}/> Download Sheet
            </button>
          )}
          {canEdit && (
            <button className="btn btn-primary" onClick={() => onEdit(p)}>
              <Edit2 size={13}/> Edit Product
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function RecycleBinModal({ onClose, onRestored, canRestore }) {
  const [items,   setItems]   = useState([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [busy,    setBusy]    = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await productApi.getRecycleBin({ search })
      const data = res?.data
      setItems(Array.isArray(data) ? data : Array.isArray(res) ? res : [])
    } catch { setItems([]) }
    finally { setLoading(false) }
  }, [search])

  useEffect(() => { load() }, [load])

  const handleRestore = async (id) => {
    if (!canRestore) return
    setBusy(id)
    try {
      await productApi.restore(id)
      setItems(p => p.filter(x => (x._id || x.id) !== id))
      onRestored()
    } catch (e) { alert('Restore failed: ' + (e?.message || 'Error')) }
    finally { setBusy(null) }
  }

  const fmtDate = (d) => d
    ? new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
    : '—'

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:720, width:'100%', maxHeight:'88vh', overflowY:'auto' }}
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="modal-header" style={{ position:'sticky', top:0, background:'var(--surface)', zIndex:10 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <Trash2 size={16} style={{ color:'var(--danger)' }}/>
            <span className="modal-title">Recycle Bin</span>
            <span style={{ fontSize:11, color:'var(--text-muted)', background:'var(--bg)', padding:'2px 8px', borderRadius:10 }}>
              {items.length} item{items.length !== 1 ? 's' : ''}
            </span>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16}/></button>
        </div>

        <div className="modal-body">
          {/* Search */}
          <div className="search-bar" style={{ marginBottom:14 }}>
            <Search size={14}/>
            <input placeholder="Search deleted products…" value={search}
              onChange={e => setSearch(e.target.value)}/>
          </div>

          {loading && (
            <div style={{ textAlign:'center', padding:40 }}><div className="spinner"/></div>
          )}

          {!loading && items.length === 0 && (
            <div className="empty-state" style={{ padding:'40px 20px' }}>
              <div className="empty-state-icon">🗑️</div>
              <h3>Recycle Bin is empty</h3>
              <p>Deleted products will appear here and can be restored.</p>
            </div>
          )}

          {!loading && items.length > 0 && (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {items.map(p => {
                const id     = p._id || p.id
                const isBusy = busy === id
                const thumb  = (p.image_urls || []).filter(Boolean)[0]
                return (
                  <div key={id} style={{
                    display:'flex', alignItems:'center', gap:12,
                    padding:'12px 14px', background:'var(--bg)',
                    borderRadius:10, border:'1px solid var(--border)',
                  }}>
                    {/* Thumbnail */}
                    {thumb
                      ? <img src={imgUrl(thumb)} alt="" style={{ width:48, height:48, borderRadius:7, objectFit:'cover', flexShrink:0, border:'1px solid var(--border)' }}/>
                      : <div style={{ width:48, height:48, borderRadius:7, background:'var(--border)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <Package size={18} style={{ color:'var(--text-muted)' }}/>
                        </div>
                    }

                    {/* Info */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontWeight:700, fontSize:13 }}>{p.name}</div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2, display:'flex', gap:8, flexWrap:'wrap' }}>
                        {p.code         && <span style={{ fontFamily:'monospace', color:'var(--primary)' }}>{p.code}</span>}
                        {p.brand_name   && <span>{p.brand_name}</span>}
                        {p.category_name && <span>{p.category_name}</span>}
                        {p.size         && <span>{p.size.toUpperCase()}</span>}
                        {p.finish       && <span>{p.finish}</span>}
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                        Deleted: {fmtDate(p.deleted_at)}
                      </div>
                    </div>

                    {/* Actions */}
                    {canRestore && (
                      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                        <button
                          className="btn btn-sm"
                          disabled={isBusy}
                          onClick={() => handleRestore(id)}
                          style={{ background:'var(--success)', color:'#fff', fontSize:12, gap:5 }}
                        >
                          <RotateCcw size={12}/> {isBusy ? '…' : 'Restore'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="modal-footer" style={{ position:'sticky', bottom:0, background:'var(--surface)', zIndex:10 }}>
          <span style={{ fontSize:12, color:'var(--text-muted)', flex:1 }}>
            Restore a deleted product to return it to the products list
          </span>
          <button className="btn btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// BULK ACCESS MODAL — assign visibility for multiple products at once
// ══════════════════════════════════════════════════════════════
function BulkAccessModal({ productIds, products, onClose, onSaved, onError }) {
  const [companies,     setCompanies]     = useState([])
  const [loading,       setLoading]       = useState(true)
  const [saving,        setSaving]        = useState(false)
  const [search,        setSearch]        = useState('')
  const [sharedWithAll, setSharedWithAll] = useState(true)
  const [selected,      setSelected]      = useState(new Set())

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const res  = await companyApi.list({ limit: 500 })
        const list = res?.data?.companies || res?.companies || []
        const eligible = list.filter(c => {
          const t = String(c.biz_type || '').toLowerCase()
          return t.includes('wholesaler') || t.includes('retailer') || t.includes('wholesale')
        })
        if (alive) setCompanies(eligible)
      } catch (e) {
        if (alive) onError?.(e?.response?.data?.message || 'Failed to load companies.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [onError])

  const toggle = (code) => {
    const upper = String(code || '').trim().toUpperCase()
    if (!upper) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(upper)) next.delete(upper)
      else next.add(upper)
      return next
    })
  }

  const filtered = companies.filter(c => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return (
      String(c.company_code || '').toLowerCase().includes(q) ||
      String(c.name || '').toLowerCase().includes(q)
    )
  })

  const save = async () => {
    setSaving(true)
    try {
      const payload = {
        shared_with_all:       sharedWithAll,
        allowed_company_codes: sharedWithAll ? [] : Array.from(selected),
      }
      // Update all selected products one by one
      await Promise.all(productIds.map(id => productApi.updateAccess(id, payload)))
      onSaved?.()
    } catch (e) {
      onError?.(e?.response?.data?.message || 'Failed to update access.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth:600, width:'100%' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:'50%', background:'#EFF6FF', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Lock size={18} style={{ color:'#3B82F6' }}/>
            </div>
            <div>
              <span className="modal-title">Bulk Access Control</span>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                Applying to {productIds.length} product{productIds.length !== 1 ? 's' : ''}
                {products.length <= 5 && products.length > 0
                  ? ': ' + products.map(p => p.name).join(', ')
                  : ''}
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16}/></button>
        </div>

        <div className="modal-body" style={{ paddingTop:14 }}>
          {/* Visibility mode */}
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
            <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', padding:'10px 12px', border:`1px solid ${sharedWithAll ? '#3B82F6' : 'var(--border)'}`, borderRadius:8, background: sharedWithAll ? '#EFF6FF' : 'var(--card)' }}>
              <input type="radio" name="bulk_access_mode" checked={sharedWithAll} onChange={() => setSharedWithAll(true)} style={{ marginTop:2 }}/>
              <span>
                <span style={{ fontSize:13, fontWeight:700, color:'var(--text)', display:'flex', alignItems:'center', gap:6 }}>
                  <Globe size={14} style={{ color:'#3B82F6' }}/> Visible to everyone
                </span>
                <span style={{ display:'block', fontSize:11, color:'var(--text-muted)' }}>All registered wholesalers and retailers can see these products.</span>
              </span>
            </label>
            <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', padding:'10px 12px', border:`1px solid ${!sharedWithAll ? '#7C3AED' : 'var(--border)'}`, borderRadius:8, background: !sharedWithAll ? '#F5F3FF' : 'var(--card)' }}>
              <input type="radio" name="bulk_access_mode" checked={!sharedWithAll} onChange={() => setSharedWithAll(false)} style={{ marginTop:2 }}/>
              <span>
                <span style={{ fontSize:13, fontWeight:700, color:'var(--text)', display:'flex', alignItems:'center', gap:6 }}>
                  <Lock size={14} style={{ color:'#7C3AED' }}/> Only selected companies
                </span>
                <span style={{ display:'block', fontSize:11, color:'var(--text-muted)' }}>Only companies you pick below can see these products.</span>
              </span>
            </label>
          </div>

          {/* Company picker — only when restricted mode */}
          {!sharedWithAll && (
            <>
              <div style={{ position:'relative', marginBottom:10 }}>
                <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
                <input
                  className="form-input"
                  placeholder="Search companies by name or code…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ paddingLeft:32 }}
                />
              </div>

              {loading ? (
                <div style={{ textAlign:'center', padding:'20px 0', color:'var(--text-muted)', fontSize:13 }}>Loading companies…</div>
              ) : filtered.length === 0 ? (
                <div style={{ textAlign:'center', padding:'20px 0', color:'var(--text-muted)', fontSize:13 }}>No companies found.</div>
              ) : (
                <div style={{ maxHeight:300, overflowY:'auto', border:'1px solid var(--border)', borderRadius:8 }}>
                  {filtered.map(c => {
                    const code = String(c.company_code || '').toUpperCase()
                    const isSelected = selected.has(code)
                    return (
                      <label
                        key={c._id || c.id}
                        style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', cursor:'pointer', borderBottom:'1px solid var(--border)', background: isSelected ? '#F5F3FF' : 'transparent' }}
                      >
                        <input type="checkbox" checked={isSelected} onChange={() => toggle(code)} />
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:'var(--text)' }}>{c.name}</div>
                          <div style={{ fontSize:11, color:'var(--text-muted)', display:'flex', gap:8 }}>
                            <span>{c.company_code}</span>
                            <span style={{ color:'#7C3AED' }}>{c.biz_type}</span>
                          </div>
                        </div>
                        {isSelected && <CheckCircle size={16} style={{ color:'#7C3AED', flexShrink:0 }}/>}
                      </label>
                    )
                  })}
                </div>
              )}

              {selected.size > 0 && (
                <div style={{ marginTop:8, fontSize:12, color:'#7C3AED', fontWeight:600 }}>
                  {selected.size} company{selected.size !== 1 ? ' companies' : ''} selected
                </div>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving || (!sharedWithAll && selected.size === 0)}>
            {saving ? 'Saving…' : `Apply to ${productIds.length} Product${productIds.length !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// PRODUCT ACCESS MODAL — assign product visibility by company code
// ══════════════════════════════════════════════════════════════
function ProductAccessModal({ product, onClose, onSaved, onError }) {
  const [companies, setCompanies] = useState([])
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [search, setSearch]       = useState('')
  const [sharedWithAll, setSharedWithAll] = useState(product?.shared_with_all !== false)
  // Set of allowed company codes (UPPERCASE).
  const [selected, setSelected]   = useState(() => {
    const codes = Array.isArray(product?.allowed_company_codes) ? product.allowed_company_codes : []
    return new Set(codes.map(c => String(c || '').trim().toUpperCase()).filter(Boolean))
  })

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        // Only wholesalers/retailers can be granted access.
        const res = await companyApi.list({ limit: 500 })
        const list = res?.data?.companies || res?.companies || []
        const eligible = list.filter(c => {
          const t = String(c.biz_type || '').toLowerCase()
          return t.includes('wholesaler') || t.includes('retailer')
        })
        if (alive) setCompanies(eligible)
      } catch (e) {
        if (alive) onError?.(e?.response?.data?.message || 'Failed to load companies.')
      } finally {
        if (alive) setLoading(false)
      }
    })()
    return () => { alive = false }
  }, [onError])

  const toggle = (code) => {
    const upper = String(code || '').trim().toUpperCase()
    if (!upper) return
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(upper)) next.delete(upper)
      else next.add(upper)
      return next
    })
  }

  const filtered = companies.filter(c => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return (
      String(c.company_code || '').toLowerCase().includes(q) ||
      String(c.name || '').toLowerCase().includes(q) ||
      String(c.biz_type || '').toLowerCase().includes(q)
    )
  })

  const save = async () => {
    setSaving(true)
    try {
      await productApi.updateAccess(product._id || product.id, {
        shared_with_all: sharedWithAll,
        allowed_company_codes: sharedWithAll ? [] : Array.from(selected),
      })
      onSaved?.()
    } catch (e) {
      onError?.(e?.response?.data?.message || 'Failed to update access.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560, width:'100%' }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:'50%', background:'#EFF6FF', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Lock size={18} style={{ color:'#3B82F6' }}/>
            </div>
            <div>
              <span className="modal-title">Manage Product Access</span>
              <div style={{ fontSize:11, color:'var(--text-muted)' }}>
                {product?.name} {product?.code ? `· ${product.code}` : ''}
              </div>
            </div>
          </div>
          <button className="modal-close" onClick={onClose}><X size={16}/></button>
        </div>

        <div className="modal-body" style={{ paddingTop:14 }}>
          {/* Visibility mode */}
          <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:14 }}>
            <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', padding:'10px 12px', border:`1px solid ${sharedWithAll ? '#3B82F6' : 'var(--border)'}`, borderRadius:8, background: sharedWithAll ? '#EFF6FF' : '#fff' }}>
              <input type="radio" name="access_mode" checked={sharedWithAll} onChange={() => setSharedWithAll(true)} style={{ marginTop:2 }}/>
              <span style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                <Globe size={16} style={{ color:'#3B82F6', marginTop:1 }}/>
                <span>
                  <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>Visible to everyone</span>
                  <span style={{ display:'block', fontSize:11, color:'var(--text-muted)' }}>All wholesalers and retailers can see this product.</span>
                </span>
              </span>
            </label>
            <label style={{ display:'flex', alignItems:'flex-start', gap:10, cursor:'pointer', padding:'10px 12px', border:`1px solid ${!sharedWithAll ? '#3B82F6' : 'var(--border)'}`, borderRadius:8, background: !sharedWithAll ? '#EFF6FF' : '#fff' }}>
              <input type="radio" name="access_mode" checked={!sharedWithAll} onChange={() => setSharedWithAll(false)} style={{ marginTop:2 }}/>
              <span style={{ display:'flex', gap:8, alignItems:'flex-start' }}>
                <Users size={16} style={{ color:'#3B82F6', marginTop:1 }}/>
                <span>
                  <span style={{ fontSize:13, fontWeight:700, color:'var(--text)' }}>Only selected companies</span>
                  <span style={{ display:'block', fontSize:11, color:'var(--text-muted)' }}>Only companies whose unique code you select below can see this product.</span>
                </span>
              </span>
            </label>
          </div>

          {!sharedWithAll && (
            <>
              <div style={{ position:'relative', marginBottom:10 }}>
                <Search size={14} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text-muted)' }}/>
                <input
                  className="input"
                  placeholder="Search by code, name or type…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ paddingLeft:30, width:'100%' }}
                />
              </div>

              <div style={{ fontSize:11, color:'var(--text-muted)', marginBottom:6 }}>
                {selected.size} company{selected.size === 1 ? '' : 'ies'} selected
              </div>

              <div style={{ maxHeight:280, overflowY:'auto', border:'1px solid var(--border)', borderRadius:8 }}>
                {loading ? (
                  <div style={{ padding:20, textAlign:'center', fontSize:12, color:'var(--text-muted)' }}>Loading companies…</div>
                ) : filtered.length === 0 ? (
                  <div style={{ padding:20, textAlign:'center', fontSize:12, color:'var(--text-muted)' }}>No wholesalers or retailers found.</div>
                ) : (
                  filtered.map(c => {
                    const code = String(c.company_code || '').trim().toUpperCase()
                    const checked = code && selected.has(code)
                    return (
                      <label key={c._id} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderBottom:'1px solid var(--border)', cursor: code ? 'pointer' : 'not-allowed', background: checked ? '#F0F9FF' : '#fff' }}>
                        <input type="checkbox" checked={!!checked} disabled={!code} onChange={() => toggle(code)}/>
                        <span style={{ flex:1, minWidth:0 }}>
                          <span style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{ fontSize:12, fontWeight:700, color:'var(--text)', fontFamily:'monospace' }}>{code || '— no code —'}</span>
                            <span style={{ fontSize:10, padding:'1px 6px', borderRadius:4, background:'#F1F5F9', color:'#475569', fontWeight:700 }}>{c.biz_type}</span>
                          </span>
                          <span style={{ display:'block', fontSize:11, color:'var(--text-muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{c.name}</span>
                        </span>
                      </label>
                    )
                  })
                )}
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save Access'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════
export default function ProductManagement({
  products = [], categories = [], subCategories = [], brands = [], warehouses = [],
  addProduct, updateProduct, loadingData,
  addCategory, addBrand, addSubCategory,
  deleteCategory, deleteBrand, deleteSubCategory,
  fetchAll,
  // mode: 'admin' (default) shows only Admin-created products.
  //       'external' shows only Wholesaler/Retailer-created products (read-only view).
  mode = 'admin',
}) {
  const { canPerform } = usePermissions()
  const { user } = useAuth()
  const isSuperAdmin = user?.role === 'Super Admin'
  const mayCreate = canPerform(MODULES.PRODUCTS, 'create')
  const mayEdit = canPerform(MODULES.PRODUCTS, 'edit')
  const mayViewDeleted = canPerform(MODULES.PRODUCTS, 'view_deleted')
  const mayRestore = canPerform(MODULES.PRODUCTS, 'restore')
  const mayExport = canPerform(MODULES.PRODUCTS, 'export')

  const [search,       setSearch]       = useState('')
  const [page,         setPage]         = useState(1)
  const [filterBrand,  setFilterBrand]  = useState('')
  const [filterCat,    setFilterCat]    = useState('')
  const [filterSubCat, setFilterSubCat] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterSize,   setFilterSize]   = useState('')
  const [filterFinish, setFilterFinish] = useState('')
  const [filterType,   setFilterType]   = useState('')
  const [filterApp,    setFilterApp]    = useState('')
  const [showModal,    setShowModal]    = useState(false)
  const [editItem,     setEditItem]     = useState(null)
  const [viewItem,     setViewItem]     = useState(null)
  const [viewLoading,  setViewLoading]  = useState(false)
  const [showBin,      setShowBin]      = useState(false)
  const [showBulk,     setShowBulk]     = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [toast,        setToast]        = useState({ msg:'', type:'success' })
  const [adminProducts, setAdminProducts] = useState(null)
  const [adminLoading,  setAdminLoading]  = useState(false)
  const [adminError,    setAdminError]    = useState('')
  const [editTaxonomy,  setEditTaxonomy]  = useState(null)
  const [accessTarget,  setAccessTarget]  = useState(null)  // product whose access is being managed
  const [selectedIds,   setSelectedIds]   = useState(new Set())  // bulk selection
  const [showBulkAccess, setShowBulkAccess] = useState(false)

  const loadAdminProducts = useCallback(async () => {
    if (!isSuperAdmin) {
      setAdminProducts(null)
      setAdminError('')
      return
    }
    setAdminLoading(true)
    setAdminError('')
    try {
      const allProducts = []
      let page = 1
      let hasNext = false
      do {
        const response = await productApi.listAll({ page, limit: 500 })
        const payload = response?.data || response
        allProducts.push(...(Array.isArray(payload?.products) ? payload.products : []))
        hasNext = payload?.pagination?.hasNext === true
        page += 1
      } while (hasNext)
      setAdminProducts(allProducts)
    } catch (error) {
      console.error('[Products] Failed to load Super Admin catalogue:', error)
      const message = error?.response?.data?.message || error?.message || 'Could not load the Super Admin product catalogue.'
      setAdminError(message)
    } finally {
      setAdminLoading(false)
    }
  }, [isSuperAdmin])

  useEffect(() => { loadAdminProducts() }, [loadAdminProducts])

  const rawCatalog = isSuperAdmin
    ? (Array.isArray(adminProducts) ? adminProducts : [])
    : products
  // Split the catalogue by who created each product:
  //   'admin'    → Admin-created products only (this is the main Products page)
  //   'external' → Wholesaler / Retailer app products only (separate page)
  const catalogProducts = rawCatalog.filter(p => {
    const t = creatorTypeOf(p)
    const isExternal = t === 'Wholesaler' || t === 'Retailer'
    return mode === 'external' ? isExternal : !isExternal
  })
  const productTableLoading = isSuperAdmin ? adminLoading : loadingData
  const currentCompanyId = user?.company_id?._id || user?.company_id || ''
  const isOwnedProduct = (product) => {
    if (!isSuperAdmin) return true
    const ownerCompanyId = product?.company_id?._id || product?.company_id || ''
    return Boolean(currentCompanyId) && String(ownerCompanyId) === String(currentCompanyId)
  }
  const canManageProduct = (product) => isSuperAdmin || isOwnedProduct(product)

  const fire = (msg, type = 'success') => {
    setToast({ msg, type })
    setTimeout(() => setToast({ msg:'', type:'success' }), 3200)
  }

  const topLevelCats = categories.filter(c => !c.parent_id)

  const filteredSubs = subCategories.filter(s => {
    const pid = s.parent_id?.toString() || s.category_id?.toString()
    return pid === filterCat
  })

  // unique values for dynamic filter dropdowns
  const uniqueSizes  = [...new Set(catalogProducts.map(p => p.size).filter(Boolean))].sort()
  const uniqueFinish = [...new Set(catalogProducts.map(p => p.finish).filter(Boolean))].sort()
  const uniqueTypes  = [...new Set(catalogProducts.map(p => p.tile_type).filter(Boolean))].sort()
  const uniqueApps   = [...new Set(catalogProducts.map(p => p.application).filter(Boolean))].sort()

  const activeFilters = [filterBrand, filterCat, filterSubCat, filterStatus,
    filterSize, filterFinish, filterType, filterApp].filter(Boolean).length

  const clearAll = () => {
    setSearch(''); setFilterBrand(''); setFilterCat(''); setFilterSubCat('')
    setFilterStatus(''); setFilterSize(''); setFilterFinish('')
    setFilterType(''); setFilterApp('')
  }

  const filtered = catalogProducts.filter(p => {
    const q = search.toLowerCase()
    const owner = p.company_id && typeof p.company_id === 'object' && (p.company_id.name || p.company_id.company_code)
      ? p.company_id
      : null
    if (q && !((p.name||'').toLowerCase().includes(q) ||
               (p.code||'').toLowerCase().includes(q) ||
               (p.brand_name||p.brand_id?.name||'').toLowerCase().includes(q) ||
               (p.category_name||p.category_id?.name||'').toLowerCase().includes(q) ||
               (owner?.name||'').toLowerCase().includes(q) ||
               (owner?.company_code||'').toLowerCase().includes(q))) return false
    const bid = p.brand_id?._id    || p.brand_id    || ''
    const cid = p.category_id?._id || p.category_id || ''
    const sid = p.sub_category_id?._id || p.sub_category_id || ''
    if (filterBrand  && bid !== filterBrand)  return false
    if (filterCat    && cid !== filterCat)    return false
    if (filterSubCat && sid !== filterSubCat) return false
    if (filterStatus === 'active' && p.is_active === false) return false
    if (filterStatus === 'discontinued' && p.is_active !== false) return false
    if (filterStatus === 'hidden' && !(p.is_hidden === true || p.hidden === true || p.is_visible === false)) return false
    if (filterSize   && (p.size   ||'').toLowerCase() !== filterSize.toLowerCase())   return false
    if (filterFinish && (p.finish ||'').toLowerCase() !== filterFinish.toLowerCase()) return false
    if (filterType   && (p.tile_type   ||'').toLowerCase() !== filterType.toLowerCase())   return false
    if (filterApp    && (p.application ||'').toLowerCase() !== filterApp.toLowerCase())    return false
    return true
  })

  // ── Pagination (10 rows per page) ──────────────────────────
  const total       = filtered.length
  const totalPages  = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const safePage    = Math.min(page, totalPages)
  const paged       = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  // Reset to the first page whenever the search text or any filter changes,
  // so the user never lands on an out-of-range page after narrowing results.
  useEffect(() => { setPage(1) }, [search, filterBrand, filterCat, filterSubCat, filterStatus, filterSize, filterFinish, filterType, filterApp])

  // ── Bulk "Select All" helpers ──────────────────────────────
  // Selects every product currently shown after filters (across all pages).
  const selectAllRef        = useRef(null)
  const allFilteredIds      = filtered.map(p => p._id || p.id)
  const selectedInFiltered  = allFilteredIds.filter(id => selectedIds.has(id)).length
  const allSelected        = allFilteredIds.length > 0 && selectedInFiltered === allFilteredIds.length
  const someSelected        = selectedInFiltered > 0 && selectedInFiltered < allFilteredIds.length
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected
  }, [someSelected])
  const toggleSelectAll = () => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (allSelected) allFilteredIds.forEach(id => next.delete(id))
      else allFilteredIds.forEach(id => next.add(id))
      return next
    })
  }

  const openAdd = () => {
    if (!mayCreate) return fire('You have view-only access. Product creation is not allowed.', 'error')
    setEditItem(null); setShowModal(true)
  }
  const openEdit = async (p) => {
    if (!mayEdit) return fire('You do not have permission to edit products.', 'error')
    if (!canManageProduct(p)) return fire('You cannot edit this product.', 'error')

    setEditTaxonomy(null)
    if (isSuperAdmin && !isOwnedProduct(p)) {
      const ownerCompanyId = p?.company_id?._id || p?.company_id
      const productId = p?._id || p?.id
      try {
        const response = ownerCompanyId
          ? await productApi.getCompanyTaxonomy(ownerCompanyId)
          : await productApi.getProductTaxonomy(productId)
        const payload = response?.data || response
        setEditTaxonomy({
          brands: Array.isArray(payload?.brands) ? payload.brands : [],
          categories: Array.isArray(payload?.categories) ? payload.categories : [],
          subCategories: Array.isArray(payload?.subCategories) ? payload.subCategories : [],
        })
      } catch (error) {
        const message = error?.response?.data?.message || error?.message || 'Could not load the owner company taxonomy.'
        return fire(message, 'error')
      }
    }

    setEditItem(p); setViewItem(null); setShowModal(true)
  }
  const openRecycleBin = () => {
    if (!mayViewDeleted) return fire('You do not have permission to view deleted products.', 'error')
    setShowBin(true)
  }
  const openView   = async (p) => {
    // Show modal immediately with list data, then fetch full details
    setViewItem(p)
    setViewLoading(true)
    try {
      const id  = p._id || p.id
      const res = await productApi.get(id)
      const full = res?.data || res
      if (full) setViewItem(full)
    } catch { /* keep showing list data on error */ }
    finally { setViewLoading(false) }
  }
  const closeModal = ()  => { setShowModal(false); setEditItem(null); setEditTaxonomy(null) }
  const closeView  = ()  => { setViewItem(null); setViewLoading(false) }

  const handleSave = async (payload) => {
    const requiredActionAllowed = editItem ? mayEdit : mayCreate
    if (!requiredActionAllowed) return fire('You do not have permission for this product action.', 'error')
    if (editItem && !canManageProduct(editItem)) return fire('You cannot edit this product.', 'error')
    setSaving(true)
    try {
      const res = editItem
        ? await updateProduct?.(editItem._id || editItem.id, payload)
        : await addProduct?.(payload)
      if (res?.success === false) { fire(`Error: ${res.message}`, 'error'); return }
      if (isSuperAdmin) await loadAdminProducts()
      fire(editItem ? 'Product updated successfully' : 'Product created successfully')
      closeModal()
    } catch (err) {
      fire(`Error: ${err.message || 'Something went wrong'}`, 'error')
    } finally { setSaving(false) }
  }

  const handleDiscontinue = async (product) => {
    if (!mayEdit) return fire('You do not have permission to discontinue products.', 'error')
    if (!canManageProduct(product)) return fire('You cannot manage this product.', 'error')
    const id = product._id || product.id
    setSaving(true)
    try {
      const result = await updateProduct?.(id, { is_active: false })
      if (result?.success === false) throw new Error(result.message || 'Product update failed')
      if (isSuperAdmin) await loadAdminProducts()
      fire('Product discontinued')
    } catch (err) {
      fire(`Error: ${err.message || 'Could not discontinue product'}`, 'error')
      if (isSuperAdmin) await loadAdminProducts()
    } finally { setSaving(false) }
  }

  const fmtP = (v) => {
    const n = parseFloat(v) || 0
    return n > 0 ? `₹${n.toLocaleString('en-IN', { maximumFractionDigits:2 })}` : '—'
  }

  // inline filter select — polished look
  const FS = ({ val, setVal, opts, ph }) => (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <select
        value={val}
        onChange={e => setVal(e.target.value)}
        style={{
          fontSize: 12,
          padding: '7px 28px 7px 12px',
          border: val ? '1.5px solid #FD5C02' : '1.5px solid var(--border)',
          borderRadius: 8,
          appearance: 'none',
          cursor: 'pointer',
          outline: 'none',
          background: val ? '#FFF3EC' : 'var(--surface)',
          color: val ? '#D94B00' : 'var(--text-muted)',
          fontWeight: val ? 700 : 500,
          minWidth: 110,
          boxShadow: val ? '0 0 0 3px rgba(253,92,2,0.10)' : 'var(--shadow)',
          transition: 'all 0.15s',
        }}
      >
        <option value="" style={{ color: 'var(--text-muted)' }}>{ph}</option>
        {opts.map(o => (
          <option key={typeof o === 'string' ? o : o.value} value={typeof o === 'string' ? o : o.value} style={{ color: 'var(--text)' }}>
            {typeof o === 'string' ? o : o.label}
          </option>
        ))}
      </select>
      <ChevronDown
        size={11}
        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: val ? '#FD5C02' : 'var(--text-muted)' }}
      />
    </div>
  )

  const chipX = (label, onClear) => (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px 3px 10px',
      borderRadius: 20,
      fontSize: 11, fontWeight: 600,
      background: '#FFF3EC',
      color: '#D94B00',
      border: '1px solid #FED7B8',
    }}>
      {label}
      <button
        onClick={onClear}
        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#D94B00', lineHeight: 1, padding: '0 1px', fontSize: 14, display: 'flex', alignItems: 'center' }}
      >×</button>
    </span>
  )

  return (
    <>
      {/* Breadcrumb */}
      <div className="breadcrumb">
        <span>Product Setup</span>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Products</span>
      </div>

      {/* Page Header */}
      <div className="page-header">
        <div className="page-header-left">
          <div className="page-title">{mode === 'external' ? 'Wholesaler / Retailer Products' : 'Product Management'}</div>
          <div className="page-desc">
            {mode === 'external'
              ? 'Products added by wholesalers and retailers from their apps (read-only)'
              : 'Manage your complete product catalogue with pricing and specifications'}
          </div>
        </div>
        <div className="page-header-actions">
          {mode !== 'external' && mayViewDeleted && (
            <button className="btn btn-secondary" onClick={openRecycleBin} style={{ gap:6 }}>
              <Trash2 size={14} style={{ color:'var(--danger)' }}/> Recycle Bin
            </button>
          )}
          {mode !== 'external' && (
            <button className="btn btn-secondary" onClick={() => setShowBulk(true)} style={{ gap:6 }}>
              <Upload size={14}/> Import (Excel / PDF)
            </button>
          )}
          {mode !== 'external' && mayCreate && (
            <button className="btn btn-primary" onClick={openAdd}>
              <Plus size={14}/> New Product
            </button>
          )}
        </div>
      </div>

      {showBulk && (
        <BulkUploadProducts
          onClose={() => setShowBulk(false)}
          onDone={async () => {
            // Refresh product list and close modal once refresh is done.
            if (isSuperAdmin) {
              await loadAdminProducts()
            } else {
              await fetchAll?.()
            }
            setShowBulk(false)
          }}
        />
      )}

      {isSuperAdmin && adminError ? (
        <div style={{
          display:'flex', alignItems:'center', justifyContent:'space-between', gap:12,
          background:'#FEF2F2', color:'#991B1B', border:'1px solid #FECACA',
          borderRadius:10, padding:'11px 14px', marginBottom:16,
        }}>
          <div>
            <div style={{ fontSize:13, fontWeight:800 }}>Could not load all company products</div>
            <div style={{ fontSize:12, marginTop:2 }}>{adminError}</div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={loadAdminProducts} disabled={adminLoading}>
            {adminLoading ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      ) : null}

      {/* Stats */}
      {(() => {
        const STAT_STYLES = {
          all:      { bg: '#EFF6FF', iconBg: '#DBEAFE', iconColor: '#2563EB', textColor: '#1D4ED8', borderColor: '#BFDBFE' },
          active:   { bg: '#ECFDF5', iconBg: '#D1FAE5', iconColor: '#059669', textColor: '#047857', borderColor: '#A7F3D0' },
          discontinued: { bg: '#FEF2F2', iconBg: '#FEE2E2', iconColor: '#DC2626', textColor: '#B91C1C', borderColor: '#FECACA' },
        }
        const stats = [
          { label: 'Total Products', val: catalogProducts.length,                                            type: 'all'      },
          { label: 'Active',         val: catalogProducts.filter(p => p.is_active !== false).length,  type: 'active'   },
          { label: 'Discontinued',   val: catalogProducts.filter(p => p.is_active === false).length,  type: 'discontinued' },
        ]
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
            {stats.map(s => {
              const st = STAT_STYLES[s.type]
              const isSelected = s.type === 'all' ? !filterStatus : filterStatus === s.type
              return (
                <div
                  key={s.label}
                  onClick={() => {
                    if (s.type === 'all') setFilterStatus('')
                    else setFilterStatus(prev => prev === s.type ? '' : s.type)
                    document.querySelector('.table-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  }}
                  style={{
                    background:   isSelected ? st.iconBg : st.bg,
                    border:       `1.5px solid ${isSelected ? st.iconColor : st.borderColor}`,
                    borderRadius: 10,
                    padding:      '13px 15px',
                    cursor:       'pointer',
                    display:      'flex',
                    alignItems:   'center',
                    gap:          11,
                    boxShadow:    isSelected ? `0 0 0 3px ${st.borderColor}` : 'var(--shadow)',
                    transition:   'all 0.15s',
                  }}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 9, flexShrink: 0, background: st.iconBg, border: `1px solid ${st.borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Package size={17} style={{ color: st.iconColor }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: st.textColor, marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: st.textColor, lineHeight: 1 }}>{s.val}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* ── FILTER BAR ── */}
      <div className="card" style={{ marginBottom: 14 }}>
        {/* Top row — search + primary filters */}
        <div style={{ padding: '12px 16px', borderBottom: activeFilters > 0 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>

          {/* Search */}
          <div className="search-bar" style={{ flex: '1 1 200px', maxWidth: 260 }}>
            <Search size={14} />
            <input placeholder="Search name, code…" value={search} onChange={e => setSearch(e.target.value)} />
            {search && (
              <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}>
                <X size={12} />
              </button>
            )}
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 24, background: 'var(--border)', flexShrink: 0 }} />

          {/* Filters label */}
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', flexShrink: 0 }}>Filters:</span>

          <FS val={filterBrand} setVal={setFilterBrand} ph="Brand"
            opts={brands.map(b => ({ value: b._id || b.id, label: b.name }))} />

          <FS val={filterCat} setVal={v => { setFilterCat(v); setFilterSubCat('') }} ph="Category"
            opts={topLevelCats.map(c => ({ value: c._id || c.id, label: c.name }))} />

          {filterCat && (
            <FS val={filterSubCat} setVal={setFilterSubCat} ph="Subcategory"
              opts={filteredSubs.map(s => ({ value: s._id || s.id, label: s.name }))} />
          )}

          <FS val={filterStatus} setVal={setFilterStatus} ph="Status"
            opts={[
              { value: '', label: 'All Products' },
              { value: 'active', label: 'Live Active Product' },
              { value: 'discontinued', label: 'Discontinued Product' },
              { value: 'hidden', label: 'Hidden Product' },
            ]} />

          <FS val={filterSize} setVal={setFilterSize} ph="Tile Size"
            opts={uniqueSizes.map(s => ({ value: s, label: s.toUpperCase() + ' MM' }))} />

          <FS val={filterFinish} setVal={setFilterFinish} ph="Finish"
            opts={uniqueFinish} />

          <FS val={filterType} setVal={setFilterType} ph="Tile Type"
            opts={uniqueTypes} />

          <FS val={filterApp} setVal={setFilterApp} ph="Application"
            opts={uniqueApps} />

          {(search || activeFilters > 0) && (
            <button
              onClick={clearAll}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '6px 12px', borderRadius: 7, fontSize: 12, fontWeight: 600,
                background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA',
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.13s',
              }}
            >
              <RotateCcw size={12} /> Clear {activeFilters > 0 ? `(${activeFilters})` : ''}
            </button>
          )}
        </div>

        {/* Active filter chips */}
        {activeFilters > 0 && (
          <div style={{ padding: '8px 16px', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginRight: 2 }}>Active:</span>
            {filterBrand  && chipX(`Brand: ${brands.find(b => (b._id || b.id) === filterBrand)?.name || filterBrand}`,          () => setFilterBrand(''))}
            {filterCat    && chipX(`Category: ${topLevelCats.find(c => (c._id || c.id) === filterCat)?.name || filterCat}`,     () => { setFilterCat(''); setFilterSubCat('') })}
            {filterSubCat && chipX(`Sub: ${filteredSubs.find(s => (s._id || s.id) === filterSubCat)?.name || filterSubCat}`,    () => setFilterSubCat(''))}
            {filterStatus && chipX(`Status: ${filterStatus}`,   () => setFilterStatus(''))}
            {filterSize   && chipX(`Size: ${filterSize}`,       () => setFilterSize(''))}
            {filterFinish && chipX(`Finish: ${filterFinish}`,   () => setFilterFinish(''))}
            {filterType   && chipX(`Type: ${filterType}`,       () => setFilterType(''))}
            {filterApp    && chipX(`Area: ${filterApp}`,        () => setFilterApp(''))}
          </div>
        )}
      </div>

      {/* ── TABLE CARD ── */}
      <div className="card">
        <div className="card-header" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
          <span className="card-title">
            All Products
            <span style={{ fontSize:12, fontWeight:500, color:'var(--text-muted)', marginLeft:6 }}>
              ({filtered.length}{filtered.length !== catalogProducts.length ? ` of ${catalogProducts.length}` : ''})
            </span>
          </span>
          {/* Select All — selects every product in the current (filtered) list */}
          <label
            style={{
              display:'flex', alignItems:'center', gap:7, cursor:'pointer',
              fontSize:12.5, fontWeight:600, color:'var(--text)', userSelect:'none',
              padding:'5px 10px', border:'1px solid var(--border)', borderRadius:8,
              background: allSelected ? 'var(--primary-light, #FFF3EC)' : 'var(--surface)',
              transition:'background .15s',
            }}
          >
            <input
              ref={selectAllRef}
              type="checkbox"
              title="Select all products"
              aria-label="Select all products"
              checked={allSelected}
              onChange={toggleSelectAll}
              style={{ cursor:'pointer' }}
            />
            Select All{selectedIds.size > 0 ? ` · ${selectedIds.size} selected` : ''}
          </label>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width:36 }}>
                  <input
                    type="checkbox"
                    title="Select all matching products"
                    aria-label="Select all matching products"
                    checked={allSelected}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>#</th>
                <th>Product</th>
                <th>Owner / Added By</th>
                <th>Brand / Category</th>
                <th>Specifications</th>
                <th style={{ textAlign:'center' }}>Packing</th>
                <th style={{ textAlign:'center' }}>Unit / GST</th>
                <th className="col-right">Pricing</th>
                <th>Status</th>
                <th className="col-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {productTableLoading && (
                <tr><td colSpan={11} style={{ textAlign:'center', padding:32 }}>
                  <div className="spinner"/>
                </td></tr>
              )}

              {!productTableLoading && paged.map((p, i) => {
                const id      = p._id || p.id
                const thumb   = (p.image_urls || []).filter(Boolean)[0]
                const owner     = p.company_id && typeof p.company_id === 'object' ? p.company_id : null
                const isOwned   = isOwnedProduct(p)
                const canManage = canManageProduct(p)
                const addedBy   = creatorTypeOf(p)
                const creatorName = String(p.created_by?.name || '').trim()
                const specs = [
                  p.size ? `${p.size.toUpperCase()} MM` : null,
                  p.finish,
                  p.tile_type,
                  p.grade,
                ].filter(Boolean)
                return (
                  <tr key={id} style={{ background: p.is_active === false ? '#FECACA' : selectedIds.has(id) ? 'var(--primary-light, #EFF6FF)' : undefined }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(id)}
                        onChange={e => {
                          setSelectedIds(prev => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(id)
                            else next.delete(id)
                            return next
                          })
                        }}
                      />
                    </td>
                    <td style={{ color:'var(--text-muted)', fontSize:12 }}>{(safePage - 1) * PAGE_SIZE + i + 1}</td>

                    {/* Product — thumbnail + name + code */}
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:10, minWidth:0 }}>
                        {thumb
                          ? <img src={imgUrl(thumb)} alt="" style={{ width:42, height:42, borderRadius:8, objectFit:'cover', border:'1px solid var(--border)', flexShrink:0 }}/>
                          : <div style={{ width:42, height:42, borderRadius:8, background:'var(--bg)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                              <Package size={16} style={{ color:'var(--text-light)' }}/>
                            </div>
                        }
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontWeight:700, fontSize:13, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:220 }}>{p.name}</div>
                          <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:2 }}>
                            <span style={{ fontFamily:'monospace', fontSize:11, fontWeight:800, color:'var(--primary)' }}>{p.code || '—'}</span>
                            {p.collection && <span style={{ fontSize:11, color:'var(--text-muted)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis', maxWidth:120 }}>· {p.collection}</span>}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Owning company and immutable creator attribution */}
                    <td style={{ whiteSpace:'nowrap' }}>
                      <div>
                        <div style={{ fontSize:12.5, fontWeight:700, color:'var(--text)' }}>
                          {owner?.name || 'Own company'}
                        </div>
                        {owner && (
                          <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                            {[owner.company_code, owner.biz_type ? `Owner: ${owner.biz_type}` : ''].filter(Boolean).join(' · ')}
                          </div>
                        )}
                        <span style={{
                          display:'inline-block', marginTop:4, fontSize:9, fontWeight:800,
                          color: addedBy === 'Admin' ? '#1D4ED8' : addedBy === 'Retailer' ? '#047857' : addedBy === 'Wholesaler' ? '#7C3AED' : '#475569',
                          background: addedBy === 'Admin' ? '#DBEAFE' : addedBy === 'Retailer' ? '#D1FAE5' : addedBy === 'Wholesaler' ? '#EDE9FE' : '#E2E8F0',
                          borderRadius:4, padding:'2px 6px',
                        }}>ADDED BY {addedBy.toUpperCase()}</span>
                        {creatorName && (
                          <div style={{ fontSize:10.5, color:'var(--text-muted)', marginTop:3 }} title={p.created_by?.role || ''}>
                            {creatorName}
                          </div>
                        )}
                      </div>
                    </td>

                    {/* Brand / Category */}
                    {(() => {
                      const brandName = p.brand_name || p.brand_id?.name || '—'
                      const catName   = p.category_name || p.category_id?.name || '—'
                      const subName   = p.sub_category_name || p.sub_category_id?.name || ''
                      return (
                        <td style={{ whiteSpace:'nowrap' }}>
                          <div style={{ fontSize:12.5, fontWeight:600, color:'var(--text)' }}>{brandName}</div>
                          <div style={{ fontSize:11.5, color:'var(--text-muted)', marginTop:2 }}>
                            {catName}{subName ? ` › ${subName}` : ''}
                          </div>
                        </td>
                      )
                    })()}

                    {/* Specifications — chips */}
                    <td>
                      {specs.length ? (
                        <div style={{ display:'flex', flexWrap:'wrap', gap:4, maxWidth:230 }}>
                          {specs.map((s, k) => (
                            <span key={k} style={{
                              fontSize:11, fontWeight:600, color:'var(--text-muted)',
                              background:'var(--bg)', border:'1px solid var(--border)',
                              borderRadius:6, padding:'2px 8px', whiteSpace:'nowrap',
                            }}>{s}</span>
                          ))}
                        </div>
                      ) : <span style={{ color:'var(--text-light)', fontSize:12 }}>—</span>}
                    </td>

                    {/* Packing */}
                    <td style={{ textAlign:'center', whiteSpace:'nowrap' }}>
                      {(p.pcs_per_box || p.sqft_per_box) ? (
                        <div>
                          {p.pcs_per_box ? <div style={{ fontSize:12, fontWeight:600 }}>{p.pcs_per_box} pcs</div> : null}
                          {p.sqft_per_box ? <div style={{ fontSize:11, color:'var(--text-muted)' }}>{parseFloat(p.sqft_per_box).toFixed(2)} sqft</div> : null}
                        </div>
                      ) : <span style={{ fontSize:12, color:'var(--text-light)' }}>—</span>}
                    </td>

                    {/* Unit / GST */}
                    <td style={{ textAlign:'center', whiteSpace:'nowrap' }}>
                      <div style={{ fontSize:12, fontWeight:600 }}>{p.unit || '—'}</div>
                      {p.gst_percent != null && (
                        <div style={{ fontSize:11, color:'var(--text-muted)' }}>GST {p.gst_percent}%</div>
                      )}
                    </td>

                    {/* Pricing — MRP + retail/dealer */}
                    <td className="col-right" style={{ whiteSpace:'nowrap' }}>
                      {fmtP(p.mrp) && (
                        <div style={{ fontSize:13, fontWeight:800, color:'#FD5C02' }}>{fmtP(p.mrp)}</div>
                      )}
                      {fmtP(p.purchase_price || p.purchase_rate) && (
                        <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>
                          Purchase: {fmtP(p.purchase_price || p.purchase_rate)}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td>
                      <span style={{
                        display:'inline-flex', alignItems:'center', gap:4,
                        fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:20,
                        background: p.is_active !== false ? '#ECFDF5' : '#FEF2F2',
                        color:      p.is_active !== false ? '#059669' : '#DC2626',
                        border:     `1px solid ${p.is_active !== false ? '#A7F3D0' : '#FECACA'}`,
                      }}>
                        {p.is_active !== false ? <CheckCircle size={10}/> : <XCircle size={10}/>}
                        {p.is_active !== false ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="col-right">
                      <div className="table-actions" style={{ justifyContent:'flex-end' }}>
                        <button className="btn btn-ghost btn-xs" title="View Full Details" onClick={()=>openView(p)} style={{ color:'#059669' }}>
                          <Eye size={13}/>
                        </button>
                        {mode !== 'external' && mayEdit && canManage && (
                          <button className="btn btn-ghost btn-xs" title="Edit" onClick={()=>openEdit(p)} style={{ color:'#3B82F6' }}>
                            <Edit2 size={13}/>
                          </button>
                        )}
                        {mode !== 'external' && isSuperAdmin && addedBy !== 'Wholesaler' && addedBy !== 'Retailer' && (
                          <button
                            className="btn btn-xs"
                            title={p.shared_with_all === false ? `Access restricted to ${(p.allowed_company_codes || []).length} company code(s)` : 'Visible to everyone — click to restrict'}
                            onClick={()=>setAccessTarget(p)}
                            style={{
                              display:'inline-flex', alignItems:'center', gap:4,
                              padding:'3px 8px', borderRadius:6, fontSize:11, fontWeight:700,
                              border:'1px solid ' + (p.shared_with_all === false ? '#7C3AED' : '#CBD5E1'),
                              background: p.shared_with_all === false ? '#7C3AED' : '#F1F5F9',
                              color: p.shared_with_all === false ? '#fff' : '#475569',
                              whiteSpace:'nowrap',
                            }}
                          >
                            <Lock size={12}/>
                            {p.shared_with_all === false ? `Access (${(p.allowed_company_codes || []).length})` : 'Access'}
                          </button>
                        )}
                        {mayExport && (
                          <button className="btn btn-ghost btn-xs" title="Download Product Sheet"
                            style={{ color:'var(--info)' }} onClick={()=>downloadProduct(p)}>
                            <Download size={13}/>
                          </button>
                        )}
                        {mode !== 'external' && mayEdit && canManage && p.is_active !== false && (
                          <button
                            className="btn btn-ghost btn-xs"
                            title="Discontinue product"
                            aria-label={`Discontinue ${p.name}`}
                            disabled={saving}
                            style={{ color:'#DC2626' }}
                            onClick={() => handleDiscontinue(p)}
                          >
                            <Ban size={13}/>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}

              {!productTableLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={10}>
                    <div className="table-empty">
                      <div className="table-empty-icon"><Package style={{ width:20 }}/></div>
                      <div style={{ fontWeight:600, color:'var(--text)' }}>No products found</div>
                      <div style={{ marginTop:3 }}>{(search || activeFilters > 0)
                        ? 'Try adjusting your search or filters.'
                        : mayCreate
                          ? 'Click "New Product" to add your first product.'
                          : 'No products are available for you to view.'
                      }</div>
                      {activeFilters > 0 && (
                        <button className="btn btn-secondary btn-sm" onClick={clearAll} style={{ marginTop:10 }}>
                          Clear Filters
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Bulk selection floating bar ──────────────────────────── */}
        {selectedIds.size > 0 && (
          <div style={{
            position:'fixed', bottom:24, left:'50%', transform:'translateX(-50%)',
            background:'#1E2D4A', color:'#fff', borderRadius:12, padding:'12px 20px',
            display:'flex', alignItems:'center', gap:14, boxShadow:'0 8px 32px rgba(0,0,0,0.35)',
            zIndex:200, minWidth:340,
          }}>
            <div style={{ fontSize:14, fontWeight:700 }}>
              {selectedIds.size} product{selectedIds.size !== 1 ? 's' : ''} selected
            </div>
            {mode !== 'external' && mayEdit && (
              <button
                className="btn btn-sm"
                style={{ background:'#DC2626', color:'#fff', gap:6, fontWeight:700 }}
                disabled={saving}
                onClick={async () => {
                  const selectedProducts = catalogProducts.filter(p => selectedIds.has(p._id || p.id))
                  const toDiscontinue = selectedProducts.filter(p => p.is_active !== false && canManageProduct(p))
                  if (!toDiscontinue.length) return fire('Select an active product you can manage.', 'error')
                  setSaving(true)
                  try {
                    for (const product of toDiscontinue) {
                      const result = await updateProduct?.(product._id || product.id, { is_active: false })
                      if (result?.success === false) throw new Error(result.message || 'Product update failed')
                    }
                    if (isSuperAdmin) await loadAdminProducts()
                    setSelectedIds(new Set())
                    fire(`${toDiscontinue.length} product${toDiscontinue.length === 1 ? '' : 's'} discontinued`)
                  } catch (err) {
                    fire(`Error: ${err.message || 'Could not discontinue products'}`, 'error')
                    if (isSuperAdmin) await loadAdminProducts()
                  } finally { setSaving(false) }
                }}
              >
                {saving ? 'Discontinuing…' : 'Discontinue'}
              </button>
            )}
            <button
              className="btn btn-sm"
              style={{ background:'#F26522', color:'#fff', gap:6, fontWeight:700 }}
              onClick={() => setShowBulkAccess(true)}
            >
              <Lock size={14}/> Manage Access
            </button>
            <button
              className="btn btn-sm btn-ghost"
              style={{ color:'#94a3b8', marginLeft:'auto' }}
              onClick={() => setSelectedIds(new Set())}
            >
              Clear
            </button>
          </div>
        )}
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

      {/* ── MODALS ── */}
      {showModal && (editItem ? mayEdit : mayCreate) && (
        <ProductFormModal
          editProduct={editItem}
          brands={editTaxonomy?.brands || brands}
          categories={editTaxonomy?.categories || categories}
          subCategories={editTaxonomy?.subCategories || subCategories}
          warehouses={warehouses}
          onSave={handleSave}
          onClose={closeModal}
          saving={saving}
          onCreateCategory={async (name) => {
            const code = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 20)
            const r = await addCategory?.({ name: name.trim(), code, is_active: true })
            if (r?.success === false) { alert(r.message || 'Failed to add category'); return null }
            const c = r?.data
            return c ? (c._id || c.id) : null
          }}
          onCreateBrand={async (name) => {
            const code = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 20)
            const r = await addBrand?.({ name: name.trim(), code, is_active: true })
            if (r?.success === false) { alert(r.message || 'Failed to add brand'); return null }
            const b = r?.data
            return b ? (b._id || b.id) : null
          }}
          onCreateSubCategory={async (name, categoryId) => {
            const code = name.trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').slice(0, 20)
            const r = await addSubCategory?.({ name: name.trim(), code, category_id: categoryId, is_active: true })
            if (r?.success === false) { alert(r.message || 'Failed to add sub-category'); return null }
            const s = r?.data
            return s ? (s._id || s.id) : null
          }}
          onDeleteCategory={async (id, name) => {
            if (!window.confirm(`Delete category "${name}"?\nThis will fail if it has sub-categories or products.`)) return false
            const r = await deleteCategory?.(id)
            if (r?.success === false) { alert(r.message || 'Failed to delete category'); return false }
            return true
          }}
          onDeleteBrand={async (id, name) => {
            if (!window.confirm(`Delete brand "${name}"?`)) return false
            const r = await deleteBrand?.(id)
            if (r?.success === false) { alert(r.message || 'Failed to delete brand'); return false }
            return true
          }}
          onDeleteSubCategory={async (id, name) => {
            if (!window.confirm(`Delete sub-category "${name}"?`)) return false
            const r = await deleteSubCategory?.(id)
            if (r?.success === false) { alert(r.message || 'Failed to delete sub-category'); return false }
            return true
          }}
        />
      )}

      {viewItem && (
        <ProductViewModal
          product={viewItem}
          loading={viewLoading}
          onClose={closeView}
          onEdit={(p) => { closeView(); openEdit(p) }}
          canEdit={mayEdit && canManageProduct(viewItem)}
          canExport={mayExport}
        />
      )}

      {accessTarget && (
        <ProductAccessModal
          product={accessTarget}
          onClose={() => setAccessTarget(null)}
          onSaved={async () => {
            setAccessTarget(null)
            fire('Product access updated')
            if (isSuperAdmin) await loadAdminProducts()
          }}
          onError={(msg) => fire(msg, 'error')}
        />
      )}

      {showBulkAccess && (
        <BulkAccessModal
          productIds={Array.from(selectedIds)}
          products={catalogProducts.filter(p => selectedIds.has(p._id || p.id))}
          onClose={() => setShowBulkAccess(false)}
          onSaved={async () => {
            setShowBulkAccess(false)
            setSelectedIds(new Set())
            fire(`Access updated for ${selectedIds.size} product(s)`)
            if (isSuperAdmin) await loadAdminProducts()
          }}
          onError={(msg) => fire(msg, 'error')}
        />
      )}

      {showBin && mayViewDeleted && (
        <RecycleBinModal
          onClose={() => setShowBin(false)}
          onRestored={() => {
            fire('Product restored successfully')
            if (isSuperAdmin) loadAdminProducts()
          }}
          canRestore={mayRestore}
        />
      )}

{/* Toast */}
      {toast.msg && (
        <div
          className={`alert alert-${toast.type === 'error' ? 'danger' : 'success'}`}
          style={{ position:'fixed', bottom:24, right:24, zIndex:9999, boxShadow:'0 4px 16px rgba(0,0,0,.15)', minWidth:280 }}
        >
          {toast.type === 'error' ? '✕ ' : '✓ '}{toast.msg}
        </div>
      )}
    </>
  )
}

