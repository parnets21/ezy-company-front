import { useEffect, useRef, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { enquiryApi } from '../api'
import { enquirySeen } from '../utils/enquirySeen'
import { Plus, Search, Eye, ArrowRight, ArrowRightLeft, MessageCircle, CheckCircle, X, LayoutList, Sparkles, ScanEye, Reply, Handshake, BadgeCheck, Ban, Package, Trash2, Edit2, Send, DollarSign, Box, Truck, FileText, Clock, CheckCircle2, MapPin, Phone, Mail, Calendar } from 'lucide-react'

// ── API field helpers (backend snake_case → frontend) ─────────
const eid         = e => e._id            || e.id           || ''
const enqCode     = e => e.enq_code       || e.id           || ''
const enqRetailer = e => e.retailer_name  || e.retailer     || ''
const enqMobile   = e => e.retailer_mobile|| e.mobile       || ''
const enqEmail    = e => e.retailer_email || e.email        || ''
const enqProduct  = e => e.product_name   || e.product      || ''
const enqPrice    = e => +(e.offered_price   || e.offeredPrice  || 0)
const enqDate     = e => e.created_at
  ? new Date(e.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  : (e.date || '')
const enqReply    = e => e.distributor_reply || e.distributorReply || ''
const enqNote     = e => e.negotiation_note  || e.negotiationNote  || ''
// A recipient answers a broadcast with "how much can you supply, and when" —
// not just prose. Both are set by the reply form in the retailer/wholesaler app.
const enqAvail    = e => (e.available_quantity ?? e.availableQuantity ?? null)
const enqTimeline = e => e.delivery_timeline || e.deliveryTimeline || ''
const enqAudience = e => e.broadcast_audience || ''
// Every admin enquiry goes to all retailers AND all wholesalers.
const BROADCAST_AUDIENCE = 'both'
// On a broadcast row `company_id` is the RECIPIENT and `retailer_name` is the
// SENDER. So for a broadcast THIS company sent, the meaningful party is the
// recipient — without this the "Retailer" column prints the admin's own name
// back at them.
const enqIsSentBroadcast = (e, user) =>
  !!e.broadcast_owner_company_id &&
  !!user?.company_id &&
  String(e.broadcast_owner_company_id) === String(user.company_id)
const enqParty = (e, user) =>
  enqIsSentBroadcast(e, user) ? (e.company_id?.name || '—') : (e.retailer_name || e.retailer || '')

// Sent vs Received. The backend tags each row with `direction`, but if a running
// API pre-dates that field EVERY row would fall through to 'received' and the
// whole list would look like it had been received. So fall back to deriving it
// the same way the server does, from the two ownership ids.
const directionOf = (e, user) => {
  if (e.direction) return e.direction
  const me = user?.company_id ? String(user.company_id) : null
  if (!me) return 'received'
  if (e.broadcast_owner_company_id && String(e.broadcast_owner_company_id) === me) return 'sent'
  if (!e.buyer_company_id && String(e.company_id?._id || e.company_id) === me) return 'sent'
  return 'received'
}

// One broadcast = ONE table row.
// A broadcast is N sibling enquiries sharing an `enq_code` (one per recipient),
// so without grouping the Sent tab shows N near-identical rows for a single
// action — which reads as "it created it many times". Group them and summarise:
// how many recipients, how many replied, the best quote so far, and the
// furthest-along status.
const STATUS_RANK = { Cancelled: 0, New: 1, Viewed: 2, Replied: 3, Confirmed: 5 }

function rowHasReplied(r) {
  return ['Replied', 'Confirmed'].includes(r.status)
    || !!String(r.distributor_reply || '').trim()
    || r.offered_price != null
    || r.available_quantity != null
}

function groupBroadcasts(rows) {
  const byCode = new Map()
  for (const r of rows) {
    const key = r.enq_code || eid(r)
    if (!byCode.has(key)) byCode.set(key, [])
    byCode.get(key).push(r)
  }
  return [...byCode.values()].map(members => {
    if (members.length === 1) return members[0]
    // Furthest-along status wins; Cancelled ranks lowest so one cancelled
    // recipient cannot mask real activity elsewhere in the broadcast.
    const status = members
      .map(m => m.status)
      .sort((a, b) => (STATUS_RANK[b] ?? 1) - (STATUS_RANK[a] ?? 1))[0]
    const prices = members.map(m => +(m.offered_price || 0)).filter(Boolean)
    // The group's "last activity" is the NEWEST updated_at across every sibling
    // row — so the green dot lights up when ANY recipient acts, not just the
    // first member we spread below.
    const latestUpdated = members
      .map(m => m.updated_at || m.updatedAt || m.created_at)
      .filter(Boolean)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
    return {
      ...members[0],
      __group: true,
      __count: members.length,
      __replied: members.filter(rowHasReplied).length,
      __ids: members.map(eid),
      status,
      offered_price: prices.length ? Math.min(...prices) : null,
      updated_at: latestUpdated || members[0].updated_at,
    }
  })
}


// The spec fields are stored INSIDE `remarks` as "Category: …" / "Size: …"
// lines (the Enquiry schema has no columns for them — see the backend's
// composeSpecRemarks). Parse them back so Edit shows the real values instead of
// dumping the whole block into Notes and leaving every spec field blank.
// Returns null when the text is free-form, so the caller can keep it verbatim.
//
// The text may be either newline-separated OR a single line ("the user typed
// it all in one go"), so we don't split on \n — we scan for label positions
// across the whole string and let each label's value run up to the next label
// or end of text.
const SPEC_LABEL_TO_KEY = {
  Category:    'category',
  Brand:       'brand',
  Size:        'size',
  Finish:      'finish',
  Colour:      'color',
  Color:       'color',
  Material:    'material',
  Surface:     'surface',
  Grade:       'grade',
  Thickness:   'thickness',
  'Tile Type': 'tile_type',
  Details:     'details',
  Notes:       'remarks',
}
// Order matters: longer labels first so "Tile Type" wins over any "Tile".
const SPEC_LABELS = Object.keys(SPEC_LABEL_TO_KEY)
  .sort((a, b) => b.length - a.length)
  .map(l => l.replace(' ', '\\s+'))
  .join('|')
const SPEC_LABEL_RE = new RegExp(`\\b(${SPEC_LABELS})\\s*:\\s*`, 'g')
function parseSpecRemarks(raw) {
  const text = String(raw || '').trim()
  if (!text) return null
  SPEC_LABEL_RE.lastIndex = 0
  const matches = []
  let m
  while ((m = SPEC_LABEL_RE.exec(text)) !== null) {
    matches.push({ label: m[1].replace(/\s+/g, ' '), valueStart: m.index + m[0].length })
  }
  if (matches.length === 0) return null
  const out = {}
  let matched = false
  for (let i = 0; i < matches.length; i++) {
    const cur  = matches[i]
    const next = matches[i + 1]
    const value = text.slice(cur.valueStart, next ? next.start : text.length).trim()
    const key   = SPEC_LABEL_TO_KEY[cur.label]
    if (key !== undefined && !out[key]) {
      out[key] = value
      matched  = true
    }
  }
  return matched ? out : null
}

// Numbered section header, mirroring the retailer app's enquiry form (orange
// step badge + title + hint). Declared at MODULE level on purpose: defining it
// inside the component would re-create it on every render and reset its state.
const StepHeader = ({ n, title, hint }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10, marginTop: 4 }}>
    <div style={{
      width: 24, height: 24, borderRadius: 12, background: '#F4500A', color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 12, fontWeight: 700, flexShrink: 0,
    }}>{n}</div>
    <div>
      <div style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
      {hint ? <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{hint}</div> : null}
    </div>
  </div>
)

const UNIT_OPTIONS = ['Boxes', 'Sq Ft', 'Sq Mtr', 'Pieces', 'Pallets']
const enqOrderId   = e => e.order_id || e.orderId || null
const enqOrderCode = e => e.order_code || (e.order_id && typeof e.order_id === 'object' ? e.order_id.order_code : '') || ''
const enqRemarks  = e => e.remarks || ''

const STATUS_FLOW = ['New', 'Viewed', 'Replied', 'Confirmed', 'Cancelled']

const STATUS_META = {
  New:         { color: 'badge-blue',   label: 'New',         dot: '#3B82F6' },
  Viewed:      { color: 'badge-cyan',   label: 'Viewed',      dot: '#06B6D4' },
  Replied:     { color: 'badge-yellow', label: 'Replied',     dot: '#F59E0B' },
  Confirmed:   { color: 'badge-green',  label: 'Confirmed',   dot: '#10B981' },
  Cancelled:   { color: 'badge-red',    label: 'Cancelled',   dot: '#EF4444' },
}

const NEXT_STATUSES = {
  New:         ['Viewed', 'Cancelled'],
  Viewed:      ['Replied', 'Cancelled'],
  Replied:     ['Confirmed', 'Cancelled'],
  Confirmed:   [],
  Cancelled:   [],
}

// ── Role helpers ──────────────────────────────────────────────
const WHOLESALER_ROLES = ['Wholesaler', 'Manager', 'Company Owner', 'Super Admin', 'Sales Executive']
const RETAILER_ROLES   = ['Retailer']

export default function EnquiryManagement({
  enquiries = [], inventory = [], orders = [], branches = [],
  addEnquiry, updateEnquiry, deleteEnquiry, convertEnquiryToOrder,
}) {
  const { user } = useAuth()
  const userRole  = user?.role || 'Manager'
  const isRetailer    = RETAILER_ROLES.includes(userRole)
  const isWholesaler  = WHOLESALER_ROLES.includes(userRole)

  const branchNames = branches.map(b => b.name || b).filter(Boolean)
  const [search,        setSearch]       = useState('')
  const [statusFilter,  setStatusFilter] = useState('All')
  // 'received' = addressed TO this company (we owe a reply)
  // 'sent'     = raised BY this company (we are waiting on answers)
  const [dirTab,        setDirTab]       = useState('received')
  // Browser-local "last seen" map { enquiryId: ISO } — drives the green "new
  // activity" dot on the Sent tab and its rows. Reloaded whenever the enquiries
  // prop changes so a dot clears after the operator opens the enquiry.
  const [seenMap,       setSeenMap]      = useState(() => enquirySeen.getAll())
  // Keyed by enquiry id so the panel never shows the PREVIOUS enquiry's roster
  // while the new one loads — and so nothing has to be reset synchronously
  // inside the effect (which trips react-hooks/set-state-in-effect).
  const [replyState,    setReplyState]    = useState({ id: null, data: null })
  const [selected,      setSelected]     = useState(null)
  const [showNewModal,  setShowNewModal] = useState(false)
  const [messageModal,  setMessageModal] = useState({ visible: false, seller: null, sellerId: null })
  const [replyModal,    setReplyModal]   = useState({ visible: false, seller: null, sellerId: null })
  const [modalSending,  setModalSending] = useState(false)
  const [messageText,   setMessageText]  = useState('')
  const [modalReplyForm,setModalReplyForm]= useState({ rate: '', available_qty: '', timeline: '', remarks: '' })
  const [replyHistory,  setReplyHistory] = useState([])   // all replies ever sent for selected enquiry
  const [editEnquiry,   setEditEnquiry]  = useState(null)   // enquiry being edited
  const [deleteConfirm, setDeleteConfirm]= useState(null)   // { id, code }
  const [deleting,      setDeleting]     = useState(false)
  const [replyText,     setReplyText]    = useState('')
  const [negText,       setNegText]      = useState('')
  const [offerPrice,    setOfferPrice]   = useState('')
  const [availableQty,  setAvailableQty] = useState('')
  const [deliveryTimeline, setDeliveryTimeline] = useState('')
  const [orderBranch,   setOrderBranch]  = useState('')
  // ── Conversation thread (operator view of buyer ↔ seller messages) ──
  // Keyed by enquiry id so the panel never shows the previous enquiry's
  // thread while the new one is loading.
  const [threadState, setThreadState]   = useState({ id: null, data: null })
  const [threadLoading, setThreadLoading] = useState(false)
  const [threadText,   setThreadText]   = useState('')
  const [threadSending, setThreadSending] = useState(false)
  const [successMsg,    setSuccessMsg]   = useState('')
  const [saving,        setSaving]       = useState(false)
  // Refs for the Reply / Negotiate action row. The buttons below the
  // conversation thread use these to focus the textarea or scroll the
  // negotiation form into view.
  const msgInputRef = useRef(null)
  const negTextRef  = useRef(null)
  // ── New Enquiry form ──────────────────────────────────────────
  // Mirrors the retailer app's form: plain-text product details, no catalogue
  // dropdown and no sender-side price. `product_id` is no longer collected —
  // the backend composes the spec fields into `remarks`.
  const EMPTY_FORM = { retailer: '', mobile: '', email: '', product: '',
    category: '', brand: '', size: '', finish: '', color: '',
    material: '', surface: '', grade: '', thickness: '', tile_type: '',
    details: '',
    qty: '', unit: 'Sq Ft', location: '', remarks: '' }
  const [newForm,   setNewForm]  = useState(EMPTY_FORM)
  const [enqErrors, setEnqErrors]= useState({})
  // An admin enquiry always reaches EVERYONE — there is no audience picker
  // (removed on request: "why this send to i dont want that"). Each recipient
  // answers on its own copy with availability + price, and those replies land
  // back in this list.
  const isEditing = !!editEnquiry

  const toast = (msg) => { setSuccessMsg(msg); setTimeout(() => setSuccessMsg(''), 4000) }

  // ── Reply roster for the selected enquiry ─────────────────────
  // A broadcast is N sibling rows sharing one enq_code, so the panel fetches the
  // whole roster in one call instead of making the user hop between rows.
  // We fetch for EVERY opened enquiry (not only ones we sent) so the admin's
  // Received view also shows the reply cards — mirroring the wholesaler app,
  // which renders the Replies section whenever any reply exists. The backend
  // scopes the roster per-recipient, so this never leaks other parties' replies.
  // `selectedId` (not `selected`) is the dependency: the object identity changes
  // on every reply we send, which would refetch needlessly.
  const selectedId    = selected ? eid(selected) : null
  const wantsReplies  = !!selectedId

  useEffect(() => {
    if (!wantsReplies) return undefined
    let alive = true
    enquiryApi.replies(selectedId)
      .then(res => { if (alive) setReplyState({ id: selectedId, data: res?.data || res || null }) })
      .catch(() => { if (alive) setReplyState({ id: selectedId, data: null }) })
    return () => { alive = false }
  }, [selectedId, wantsReplies])

  // Derived — no setState in the effect body at all.
  const replies        = wantsReplies && replyState.id === selectedId ? replyState.data : null
  const repliesLoading = wantsReplies && replyState.id !== selectedId

  // ── Conversation thread (buyer ↔ seller messages + operator notes) ──
  // The chat thread is keyed by whichever row is active: a specific seller's
  // row when a reply card opened the chat (messageModal.sellerId), otherwise the
  // selected anchor. This keeps each seller's conversation separate.
  const activeThreadId  = messageModal.sellerId || selectedId
  const messages        = activeThreadId && threadState.id === activeThreadId ? threadState.data : null
  const messagesLoading = !!activeThreadId && threadState.id !== activeThreadId

  const loadMessages = (id) => {
    if (!id) return
    setThreadLoading(true)
    enquiryApi.listMessages(id)
      .then(res => {
        const list = res?.messages ?? res?.data?.messages ?? res?.data ?? []
        setThreadState({ id, data: Array.isArray(list) ? list : [] })
      })
      .catch(() => { if (id === selectedId) setThreadState({ id, data: [] }) })
      .finally(() => setThreadLoading(false))
  }

  useEffect(() => {
    if (!selectedId) return undefined
    loadMessages(selectedId)
    setThreadText('')
    return undefined
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  // ── Sent / Received split ─────────────────────────────────────
  // The backend tags every row with `direction` (see enquiryController
  // .listEnquiries). Splitting here rather than in two API calls keeps the
  // status pills and the badge counts consistent with the visible tab.
  const dirFiltered = enquiries.filter(e => directionOf(e, user) === dirTab)

  // The SENT tab is grouped by `enq_code`, so one broadcast is one row. The
  // RECEIVED tab is NOT grouped — each row there is individually addressed to
  // this company and needs its own reply.
  const dirRows = dirTab === 'sent' ? groupBroadcasts(dirFiltered) : dirFiltered

  // Does the SENT tab have any unseen activity? Group the sent broadcasts and
  // ask the seen-tracker if any one changed since it was last opened — drives
  // the green notification dot on the "Sent" tab button.
  const sentHasNewActivity = groupBroadcasts(enquiries.filter(e => directionOf(e, user) === 'sent'))
    .some(e => enquirySeen.isNew(e, seenMap))

  // ── Filtered list ─────────────────────────────────────────────
  const filtered = dirRows.filter(e =>
    (statusFilter === 'All' || e.status === statusFilter) &&
    (
      enqRetailer(e).toLowerCase().includes(search.toLowerCase()) ||
      enqCode(e).toLowerCase().includes(search.toLowerCase()) ||
      enqProduct(e).toLowerCase().includes(search.toLowerCase()) ||
      (e.location || '').toLowerCase().includes(search.toLowerCase())
    )
  )

  // ── Open detail panel ─────────────────────────────────────────
  const openDetail = (e) => {
    setSelected(e)
    setReplyText(enqReply(e))
    setNegText(enqNote(e))
    setOfferPrice(enqPrice(e) ? String(enqPrice(e)) : '')
    setAvailableQty(e.available_quantity != null ? String(e.available_quantity) : '')
    setDeliveryTimeline(e.delivery_timeline || '')
    
    // Auto-advance to Viewed only if Wholesaler/Manager opens a New enquiry
    if (e.status === 'New' && isWholesaler) {
      updateEnquiry?.(eid(e), { status: 'Viewed' })
      setSelected({ ...e, status: 'Viewed' })
    }

    // Mark this enquiry (and every sibling of a grouped broadcast) as SEEN at
    // its latest activity time, then refresh the local map so the green dot on
    // the Sent tab / row clears immediately. If a reply later bumps
    // `updated_at`, the dot returns on the next list refresh.
    enquirySeen.markSeen(eid(e), e.updated_at || e.updatedAt, e.__ids || [])
    setSeenMap(enquirySeen.getAll())

    // Load the conversation thread if needed
    loadMessages(eid(e))
  }

  // ── Update status + reply ────────────────────────────────────
  const handleUpdate = async (newStatus) => {
    setSaving(true)
    const payload = { status: newStatus }
    if (replyText.trim())       payload.distributor_reply  = replyText.trim()
    if (negText.trim())         payload.negotiation_note   = negText.trim()
    if (offerPrice)             payload.offered_price      = parseFloat(offerPrice)
    if (availableQty)           payload.available_quantity = parseFloat(availableQty)
    if (deliveryTimeline.trim()) payload.delivery_timeline = deliveryTimeline.trim()
    const result = await updateEnquiry?.(eid(selected), payload)
    setSaving(false)
    const updated = result?.data || { ...selected, ...payload }
    setSelected(updated)
    toast(`✓ Enquiry ${enqCode(selected)} → ${newStatus}`)
  }

  // ── Send a message into the conversation thread ─────────────
  // The operator's note lands on the enquiry as `sender_side: 'admin'`, both
  // parties get notified, and the new message is appended to the in-memory
  // thread without a full refetch.
  const handleSendThreadMessage = async () => {
    const text = threadText.trim()
    if (!text || threadSending || !selectedId) return
    setThreadSending(true)
    const clientId = `c${Date.now()}`
    const optimistic = {
      id: `tmp-${clientId}`,
      message: text,
      sender_side: 'admin',
      sender: { name: user?.name || 'Operator' },
      client_message_id: clientId,
      created_at: new Date().toISOString(),
      __pending: true,
    }
    setThreadState(prev => prev.id === selectedId
      ? { id: selectedId, data: [...(prev.data || []), optimistic] }
      : prev
    )
    setThreadText('')
    try {
      await enquiryApi.sendMessage(selectedId, text, clientId)
      // Refresh the canonical thread (server now knows the message).
      loadMessages(selectedId)
    } catch (err) {
      toast(`Could not send message: ${err.response?.data?.message || err.message}`)
      // Roll back the optimistic entry.
      setThreadState(prev => prev.id === selectedId
        ? { id: selectedId, data: (prev.data || []).filter(m => m.id !== optimistic.id) }
        : prev
      )
    } finally {
      setThreadSending(false)
    }
  }

  // ── Convert Confirmed → Order ─────────────────────────────────
  const handleConvertToOrder = async () => {
    setSaving(true)
    const agreedRate = offerPrice ? parseFloat(offerPrice) : enqPrice(selected)
    const result = await convertEnquiryToOrder?.(selected, agreedRate, {
      branch_name: orderBranch || '',
    })
    setSaving(false)
    if (result?.success === false) { toast(`Error: ${result.message}`); return }

    const orderData  = result?.data || {}
    const orderCode  = orderData.order_code || ''
    const total      = orderData.total_amount || 0
    const orderId    = orderData._id || orderData.id || ''
    const isExisting = result?.alreadyExists

    // Update the selected enquiry state to reflect the new order ref
    setSelected(prev => ({
      ...prev,
      order_id:   orderId,
      order_code: orderCode,
    }))
    setOrderBranch('')

    if (isExisting) {
      toast(`Order ${orderCode} already exists for this enquiry.`)
    } else {
      toast(`✓ Order ${orderCode} created! Total ₹${total.toLocaleString()} (incl. GST)`)
    }
  }

  // ── Submit New Enquiry ────────────────────────────────────────
  const handleNewEnquiry = async () => {
    const errs = {}
    // Retailer name/mobile are only present while EDITING an existing enquiry.
    if (isEditing) {
      if (!newForm.retailer.trim()) errs.retailer = 'Retailer name required'
      if (!newForm.mobile.trim() || !/^\d{10}$/.test(newForm.mobile)) errs.mobile = 'Valid 10-digit mobile required'
    }
    if (!newForm.product.trim()) errs.product = 'Enter the product name'
    if (!newForm.qty || isNaN(newForm.qty) || +newForm.qty < 1) errs.qty = 'Valid quantity required'
    if (Object.keys(errs).length) { setEnqErrors(errs); return }

    setSaving(true)

    // The same spec set the retailer app's form collects. The backend composes
    // them into the enquiry's `remarks`, which is what the recipients see and
    // what shows in this list.
    const specs = {
      product_name: newForm.product.trim(),
      category:     newForm.category || '',
      brand:        newForm.brand    || '',
      size:         newForm.size     || '',
      finish:       newForm.finish   || '',
      colour:       newForm.color    || '',
      material:     newForm.material || '',
      surface:      newForm.surface  || '',
      grade:        newForm.grade    || '',
      thickness:    newForm.thickness|| '',
      tile_type:    newForm.tile_type|| '',
      details:      newForm.details  || '',
      qty:          Number(newForm.qty),
      unit:         newForm.unit,
      location:     newForm.location.trim(),
      remarks:      newForm.remarks.trim(),
    }

    if (isEditing) {
      // ── Update an existing enquiry. Never re-broadcasts. ──
      const result = await updateEnquiry?.(eid(editEnquiry), {
        retailer_name:   newForm.retailer.trim(),
        retailer_mobile: newForm.mobile.trim(),
        retailer_email:  newForm.email.trim(),
        ...specs,
      })
      setSaving(false)
      if (result?.success === false) { toast(`Error: ${result.message}`); return }
      toast(`✓ Enquiry ${enqCode(editEnquiry)} updated`)
    } else {
      // ── Broadcast: ONE enquiry → every company in the audience. ──
      // `product_id` is deliberately NOT sent — a catalogue id belongs to the
      // SENDER, so a wholesaler replying with an offer would fail its ownership
      // check. The product NAME carries instead.
      const result = await addEnquiry?.({ broadcast: true, audience: BROADCAST_AUDIENCE, ...specs })
      setSaving(false)
      if (result?.success === false) { toast(`Error: ${result.message}`); return }
      toast('✓ Enquiry sent to all retailers and wholesalers')
    }

    setShowNewModal(false)
    setEditEnquiry(null)
    setNewForm(EMPTY_FORM)
    setEnqErrors({})
  }

  // ── Delete Enquiry ────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteConfirm) return
    setDeleting(true)
    const result = await deleteEnquiry?.(deleteConfirm.id)
    setDeleting(false)
    if (result?.success === false) {
      toast(`Error: ${result.message}`)
    } else {
      toast(`✓ Enquiry ${deleteConfirm.code} deleted`)
      setDeleteConfirm(null)
      if (selected && eid(selected) === deleteConfirm.id) setSelected(null)
    }
  }

  // ── Open Edit modal ───────────────────────────────────────────
  const openEdit = (e) => {
    const raw    = enqRemarks(e)
    const parsed = parseSpecRemarks(raw)
    setEditEnquiry(e)
    // Spread EMPTY_FORM first so every controlled input has a string value —
    // openEdit used to omit the spec keys entirely, which would flip those
    // inputs from controlled to uncontrolled on the first keystroke.
    setNewForm({
      ...EMPTY_FORM,
      retailer: enqRetailer(e),
      mobile:   enqMobile(e),
      email:    enqEmail(e),
      product:  enqProduct(e),
      qty:      String(e.qty || ''),
      unit:     e.unit || 'Sq Ft',
      location: e.location || '',
      ...(parsed || {}),
      // Nothing parsed → the whole text is a free-form note; parsed → only the
      // "Notes:" line belongs in Notes.
      remarks: parsed ? (parsed.remarks || '') : raw,
    })
    setEnqErrors({})
    setShowNewModal(true)
  }

  // ── Status flow progress bar ──────────────────────────────────
  const FlowBar = ({ current }) => {
    const activeIdx = STATUS_FLOW.indexOf(current)
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
        {STATUS_FLOW.map((s, i) => {
          const done    = activeIdx > i
          const active  = activeIdx === i
          const meta    = STATUS_META[s]
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 5,
                padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                background: active ? meta.dot : done ? '#d1fae5' : 'var(--bg)',
                color: active ? '#fff' : done ? '#065f46' : 'var(--text-muted)',
                border: active ? `2px solid ${meta.dot}` : '2px solid transparent',
                transition: 'all .2s',
              }}>
                {done && <CheckCircle style={{ width: 11 }} />}
                {s}
              </div>
              {i < STATUS_FLOW.length - 1 && (
                <div style={{ width: 20, height: 2, background: done ? '#10B981' : 'var(--border)', flexShrink: 0 }} />
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      <div className="breadcrumb">
        <span>Marketplace</span><span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Enquiry Management</span>
      </div>

      {/* Toast */}
      {successMsg && (
        <div className="alert alert-info" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <CheckCircle style={{ color: 'var(--success)', width: 18, flexShrink: 0 }} />
          <span style={{ fontWeight: 600 }}>{successMsg}</span>
        </div>
      )}

      {/* ── Status summary cards ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 10, marginBottom: 24, width: '100%' }}>
        {[
          { label: 'All',         count: enquiries.length,                                        dot: '#6366F1', Icon: LayoutList,  bg: 'linear-gradient(135deg,#6366f110 0%,#818cf818 100%)' },
          { label: 'New',         count: dirRows.filter(e => e.status === 'New').length,         dot: '#3B82F6', Icon: Sparkles,     bg: 'linear-gradient(135deg,#3b82f610 0%,#60a5fa18 100%)' },
          { label: 'Viewed',      count: dirRows.filter(e => e.status === 'Viewed').length,      dot: '#06B6D4', Icon: ScanEye,      bg: 'linear-gradient(135deg,#06b6d410 0%,#22d3ee18 100%)' },
          { label: 'Replied',     count: dirRows.filter(e => e.status === 'Replied').length,     dot: '#F59E0B', Icon: Reply,        bg: 'linear-gradient(135deg,#f59e0b10 0%,#fbbf2418 100%)' },
          { label: 'Confirmed',   count: dirRows.filter(e => e.status === 'Confirmed').length,   dot: '#10B981', Icon: BadgeCheck,   bg: 'linear-gradient(135deg,#10b98110 0%,#34d39918 100%)' },
          { label: 'Cancelled',   count: dirRows.filter(e => e.status === 'Cancelled').length,   dot: '#EF4444', Icon: Ban,          bg: 'linear-gradient(135deg,#ef444410 0%,#f8717118 100%)' },
        ].map(({ label, count, dot, Icon, bg }) => {
          const active = statusFilter === label
          return (
            <div
              key={label}
              onClick={() => setStatusFilter(active ? 'All' : label)}
              style={{
                padding: '14px 10px 12px',
                borderRadius: 12,
                cursor: 'pointer',
                textAlign: 'center',
                background: active ? `${dot}22` : bg,
                border: active ? `2px solid ${dot}` : `1.5px solid ${dot}28`,
                boxShadow: active ? `0 4px 14px ${dot}28` : '0 1px 4px rgba(0,0,0,0.05)',
                transition: 'all .18s ease',
                transform: active ? 'translateY(-2px) scale(1.02)' : 'translateY(0) scale(1)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                background: dot, borderRadius: '12px 12px 0 0', opacity: active ? 1 : 0.45,
              }} />
              <div style={{
                width: 34, height: 34, borderRadius: 10, margin: '0 auto 8px',
                background: active ? `${dot}25` : `${dot}15`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon style={{ width: 16, height: 16, color: dot, strokeWidth: 2 }} />
              </div>
              <div style={{
                fontSize: 24, fontWeight: 800, lineHeight: 1,
                color: active ? dot : 'var(--text)',
                marginBottom: 5,
              }}>{count}</div>
              <div style={{
                fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
                color: active ? dot : 'var(--text-muted)',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>{label}</div>
            </div>
          )
        })}
      </div>

      {/* ── Sent / Received tabs ─────────────────────────────────
          Two lists, not one: what this company ASKED (and is waiting on
          answers for) versus what it was ASKED (and owes a reply on). */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 4 }}>
        {[
          { key: 'received', label: 'Received', hint: 'Sent to us — we reply' },
          { key: 'sent',     label: 'Sent',     hint: 'We asked — they reply' },
        ].map(t => {
          const active = dirTab === t.key
          // For 'sent', count grouped broadcasts (1 broadcast = 1), not raw sibling rows
          const rawDir = enquiries.filter(e => directionOf(e, user) === t.key)
          const n = t.key === 'sent' ? groupBroadcasts(rawDir).length : rawDir.length
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => setDirTab(t.key)}
              title={t.hint}
              style={{
                position: 'relative',
                padding: '9px 18px', borderRadius: 10, cursor: 'pointer',
                fontSize: 13, fontWeight: 700,
                border: `1.5px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
                background: active ? 'var(--primary-light, #fff3ee)' : 'var(--bg)',
                color: active ? 'var(--primary)' : 'var(--text-muted)',
              }}
            >
              {t.label} ({n})
              {/* Green notification dot — only on the Sent tab, only when some
                  sent broadcast has unseen activity. Clears per-enquiry on open. */}
              {t.key === 'sent' && sentHasNewActivity && (
                <span style={{
                  position: 'absolute', top: 6, right: 8,
                  width: 9, height: 9, borderRadius: 5,
                  background: '#10b981', border: '1.5px solid #fff',
                }} />
              )}
            </button>
          )
        })}
      </div>

      {/* ── Main table ─────────────────────────────────────────── */}
      <div className="card" style={{ width: '100%' }}>
        <div className="card-header">
          <span className="card-title">
            {isRetailer ? 'My Enquiries' : 'Enquiries'} ({filtered.length})
          </span>
          <div className="header-actions">
            <div className="search-bar">
              <Search />
              <input
                placeholder="Search ID, retailer, product, location…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <select className="form-control" style={{ width: 150 }} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="All">All Status</option>
              {STATUS_FLOW.map(s => <option key={s}>{s}</option>)}
            </select>
            {/* Only Retailers / Sales staff can raise new enquiries */}
            {!isRetailer || userRole === 'Retailer' ? (
              <button className="btn btn-primary" onClick={() => { setShowNewModal(true); setNewForm(EMPTY_FORM); setEnqErrors({}) }}>
                <Plus />New Enquiry
              </button>
            ) : null}
            {/* Wholesalers see a role badge instead */}
            {userRole === 'Wholesaler' && (
              <span className="badge badge-blue" style={{ fontSize: 11, padding: '6px 12px' }}>
                Wholesaler View
              </span>
            )}
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Enq. ID</th><th>{dirTab === 'sent' ? 'Product' : 'From'}</th><th>Qty</th><th>Location</th><th>Offered ₹</th><th>Date</th>
                <th>Status</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(e => {
                const isNewActivity = enquirySeen.isNew(e, seenMap)
                return (
                <tr key={eid(e)}>
                  <td style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 12 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {/* Green "new activity" dot — a reply/message/cancel/status
                          change since this enquiry was last opened in this browser. */}
                      {isNewActivity && (
                        <span style={{ width: 8, height: 8, borderRadius: 4, background: '#10b981', flexShrink: 0 }} />
                      )}
                      {enqCode(e)}
                      {isNewActivity && (
                        <span style={{
                          fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: '#fff',
                          background: '#10b981', borderRadius: 6, padding: '1px 5px',
                        }}>NEW</span>
                      )}
                    </span>
                  </td>
                  <td>
                    {/* Sent tab: show product as primary label (not "N recipients") */}
                    <div className="user-name" style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {dirTab === 'sent' ? enqProduct(e) : (e.__group ? `${e.__count} recipients` : enqParty(e, user))}
                    </div>
                    {dirTab === 'sent'
                      ? (e.__replied > 0
                          ? <div style={{ fontSize: 11, color: '#10b981', fontWeight: 700, marginTop: 2 }}>
                              {e.__replied} {e.__replied === 1 ? 'reply' : 'replies'} received
                            </div>
                          : null)
                      : <div className="user-role">
                          {e.__group
                            ? `${e.__replied} of ${e.__count} replied`
                            : (enqIsSentBroadcast(e, user) ? 'Recipient' : enqMobile(e))}
                        </div>
                    }
                  </td>
                  <td style={{ fontWeight: 600 }}>{e.qty} {e.unit}</td>
                  <td style={{ fontSize: 12 }}>{e.location}</td>
                  <td style={{ fontWeight: 600, color: 'var(--success)' }}>
                    {e.__group
                      ? (e.offered_price ? `from ₹${Number(e.offered_price).toLocaleString()}` : '—')
                      : (enqPrice(e) ? `₹${enqPrice(e).toLocaleString()}` : '—')}
                  </td>
                  <td style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {enqDate(e)}
                    {/* Availability is the other half of a broadcast reply, so
                        surface it in the row too — otherwise you have to open
                        each one to see who can actually supply. */}
                    {!e.__group && enqAvail(e) != null && (
                      <div style={{ color: 'var(--success)', fontWeight: 700, marginTop: 2 }}>
                        Avail: {enqAvail(e)}
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${STATUS_META[e.status]?.color || 'badge-gray'}`}>{e.status}</span>
                  </td>
                  <td>
                    <div className="table-actions">
                      {/* View button — everyone can view */}
                      <button className="btn btn-ghost btn-xs" title="View Details" onClick={() => openDetail(e)}>
                        <Eye style={{ width: 13 }} />
                      </button>
                      {/* Edit button */}
                      <button className="btn btn-ghost btn-xs" title="Edit Enquiry" onClick={() => openEdit(e)}>
                        <Edit2 style={{ width: 13 }} />
                      </button>
                      {/* Delete button */}
                      <button className="btn btn-ghost btn-xs" title="Delete Enquiry"
                        style={{ color: 'var(--danger)' }}
                        onClick={() => setDeleteConfirm({ id: eid(e), code: enqCode(e) })}>
                        <Trash2 style={{ width: 13 }} />
                      </button>
                      {/* Wholesaler-only: quick reply button for Viewed enquiries.
                          Only on RECEIVED rows — a wholesaler replies to what was
                          sent TO it. On its own SENT enquiry there is nobody to
                          reply to until a recipient responds, so the button is
                          hidden there (the detail panel shows the same rule). */}
                      {isWholesaler && e.status === 'Viewed' && directionOf(e, user) !== 'sent' && (
                        <button className="btn btn-primary btn-xs" title="Send Reply" onClick={() => openDetail(e)}>
                          <MessageCircle style={{ width: 13 }} />Reply
                        </button>
                      )}
                      {/* Wholesaler-only: convert confirmed to order */}
                      {isWholesaler && e.status === 'Confirmed' && !enqOrderId(e) && (
                        <button className="btn btn-primary btn-xs" title="Convert to Order" onClick={() => openDetail(e)}>
                          <ArrowRight style={{ width: 13 }} />Order
                        </button>
                      )}
                      {enqOrderId(e) && (
                        <span className="badge badge-green" style={{ fontSize: 10 }}
                          title={enqOrderCode(e) ? `Order: ${enqOrderCode(e)}` : 'Order created'}>
                          ✓ {enqOrderCode(e) || 'Ordered'}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>
                    No quotations found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          DETAIL / WHOLESALER REPLY MODAL  (Day 13)
          Flow: New → Viewed → Replied → Negotiation → Confirmed → Cancelled
      ══════════════════════════════════════════════════════ */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="modal-header">
              <span className="modal-title">Enquiry Details · {enqCode(selected)}</span>
              <button className="btn-ghost" onClick={() => setSelected(null)}><X style={{ width: 16 }} /></button>
            </div>

            <div className="modal-body" style={{ padding: 20 }}>
              
              {/* ━━━ ENQUIRY DETAIL CARD ━━━ */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: 20 }}>

                {/* Top bar: Enquiry code + status */}
                <div style={{
                  background: 'linear-gradient(90deg, #f97316 0%, #fb923c 100%)',
                  padding: '12px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}>
                  <div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>Enquiry Code</div>
                    <div style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>{enqCode(selected)}</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)' }}>{enqDate(selected)}</span>
                    <span className={`badge ${STATUS_META[selected.status]?.color || 'badge-gray'}`}>
                      {selected.status}
                    </span>
                  </div>
                </div>

                {/* Section 1: Who sent it */}
                <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0', background: '#fff' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
                    Sent By
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', flexWrap: 'wrap', gap: 8 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#0f172a' }}>{enqRetailer(selected) || '—'}</div>
                      <div style={{ fontSize: 12, color: '#64748b', marginTop: 3, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                        {enqMobile(selected) && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Phone style={{ width: 11 }} />{enqMobile(selected)}</span>}
                        {enqEmail(selected) && <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}><Mail style={{ width: 11 }} />{enqEmail(selected)}</span>}
                      </div>
                      {selected.location && (
                        <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 3 }}><MapPin style={{ width: 11 }} />{selected.location}</div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Section 2: What they want */}
                <div style={{ padding: '14px 16px', background: '#fafafa' }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>
                    Enquiry Details
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: selected.remarks ? 12 : 0 }}>
                    <div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3 }}>Product</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{enqProduct(selected) || '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3 }}>Quantity</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>{selected.qty} {selected.unit || 'Sq Ft'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3 }}>Budget</div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                        {enqPrice(selected) ? `₹${Number(enqPrice(selected)).toLocaleString()}` : 'Flexible'}
                      </div>
                    </div>
                  </div>

                  {/* Spec details (Category, Brand, Size, etc.) parsed from remarks */}
                  {selected.remarks ? (
                    <div style={{ paddingTop: 12, borderTop: '1px solid #e2e8f0' }}>
                      <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>Specifications</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 16px' }}>
                        {selected.remarks.split('\n').filter(l => l.includes(':')).map((line, i) => {
                          const [label, ...rest] = line.split(':')
                          return (
                            <div key={i} style={{ fontSize: 12, color: '#334155' }}>
                              <span style={{ color: '#94a3b8' }}>{label.trim()}: </span>
                              <span style={{ fontWeight: 600 }}>{rest.join(':').trim()}</span>
                            </div>
                          )
                        })}
                        {/* Fallback: show full remarks if no colon lines */}
                        {!selected.remarks.includes(':') && (
                          <div style={{ fontSize: 12, color: '#334155', gridColumn: '1/-1' }}>{selected.remarks}</div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>

              </div>

              {/* -- SELLER ROSTER (replied + awaiting) -- */}
              {wantsReplies && (
                <div style={{ marginBottom: 20 }}>
                  {repliesLoading && (
                    <div style={{ textAlign: 'center', padding: 20, color: '#64748b', fontSize: 13 }}>Loading…</div>
                  )}
                  {replies && (
                    <>
                      {replies.replied && replies.replied.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#10b981', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <CheckCircle style={{ width: 13 }} /> Replied ({replies.replied.length})
                          </div>
                          {/* One CARD per replier — each with its OWN Message /
                              Reply / Cancel buttons, matching the wholesaler app. */}
                          {replies.replied.map((r) => {
                            const seller = r.company || {}
                            const isCancelled = selected.status === 'Cancelled'
                            const isConfirmed = selected.status === 'Confirmed'
                            const canAct    = !isCancelled
                            const canCancel = !isCancelled && !isConfirmed
                            return (
                              <div key={String(r.id)} style={{ border: '1px solid #e2e8f0', borderRadius: 10, padding: 14, marginBottom: 10, background: '#fff' }}>
                                {/* Header: who replied */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: 10, borderBottom: '1px solid #f1f5f9', marginBottom: 10 }}>
                                  <div>
                                    <div style={{ fontSize: 14, fontWeight: 700, color: '#1e293b', marginBottom: 4 }}>{seller.name || 'Unknown'}</div>
                                    {seller.mobile && <div style={{ fontSize: 11.5, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}><Phone style={{ width: 11 }} />{seller.mobile}</div>}
                                    {seller.email && <div style={{ fontSize: 11.5, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 2 }}><Mail style={{ width: 11 }} />{seller.email}</div>}
                                    {(seller.city || seller.state) && <div style={{ fontSize: 11.5, color: '#64748b', display: 'flex', alignItems: 'center', gap: 4 }}><MapPin style={{ width: 11 }} />{[seller.city, seller.state].filter(Boolean).join(', ')}</div>}
                                  </div>
                                  {r.status && <span className={`badge ${STATUS_META[r.status]?.color || 'badge-gray'}`} style={{ fontSize: 10 }}>{r.status}</span>}
                                </div>
                                {/* Offer line */}
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18, paddingBottom: 10, borderBottom: '1px solid #f1f5f9', marginBottom: 10 }}>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <DollarSign style={{ width: 13, color: '#10b981' }} />
                                    <span style={{ fontSize: 15, fontWeight: 800, color: '#10b981' }}>{Number(r.offered_price || 0).toLocaleString()}</span>
                                  </div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Box style={{ width: 12, color: '#64748b' }} />
                                    <span style={{ fontSize: 12.5, color: '#64748b' }}>Avail: {r.available_quantity || 0} {selected.unit || ''}</span>
                                  </div>
                                  {r.delivery_timeline && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <Truck style={{ width: 12, color: '#64748b' }} />
                                      <span style={{ fontSize: 12.5, color: '#64748b' }}>{r.delivery_timeline}</span>
                                    </div>
                                  )}
                                </div>
                                {/* Their message */}
                                {r.message && (
                                  <div style={{ background: '#f8fafc', borderRadius: 8, padding: '8px 10px', marginBottom: 10, fontSize: 12.5, color: '#334155' }}>
                                    {r.message}
                                  </div>
                                )}
                                {/* Per-card actions: Message / Reply / Cancel —
                                    each targets THIS seller's own enquiry row
                                    (r.id), so the chat/history shown is only the
                                    Admin ↔ this-seller conversation, never other
                                    recipients'. */}
                                <div style={{ display: 'flex', gap: 8 }}>
                                  <button className="btn" disabled={!canAct}
                                    style={{ flex: 1, background: canAct ? '#f97316' : 'transparent', color: canAct ? '#fff' : '#f97316', fontWeight: 700, padding: '9px', fontSize: 12.5, borderRadius: 8, border: '2px solid #f97316', cursor: canAct ? 'pointer' : 'not-allowed', opacity: canAct ? 1 : 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                                    onClick={() => {
                                      if (!canAct) return
                                      setReplyModal({ visible: false, seller: null, sellerId: null })
                                      const willOpen = !(messageModal.visible && messageModal.sellerId === r.id)
                                      if (willOpen) loadMessages(r.id)
                                      setMessageModal({ visible: willOpen, seller, sellerId: r.id })
                                    }}>
                                    <MessageCircle style={{ width: 13 }} />Message
                                  </button>
                                  <button className="btn" disabled={!canAct}
                                    style={{ flex: 1, background: canAct ? '#f97316' : 'transparent', color: canAct ? '#fff' : '#f97316', fontWeight: 700, padding: '9px', fontSize: 12.5, borderRadius: 8, border: '2px solid #f97316', cursor: canAct ? 'pointer' : 'not-allowed', opacity: canAct ? 1 : 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                                    onClick={() => {
                                      if (!canAct) return
                                      setMessageModal({ visible: false, seller: null, sellerId: null })
                                      const willOpen = !(replyModal.visible && replyModal.sellerId === r.id)
                                      if (willOpen) {
                                        setModalReplyForm({ rate: '', available_qty: '', timeline: '', remarks: '' })
                                        setReplyHistory([])
                                        enquiryApi.listReplyHistory(r.id)
                                          .then(h => setReplyHistory(h?.data?.replies || h?.replies || []))
                                          .catch(() => setReplyHistory([]))
                                      }
                                      setReplyModal({ visible: willOpen, seller, sellerId: r.id })
                                    }}>
                                    <Reply style={{ width: 13 }} />Reply
                                  </button>
                                  <button className="btn" disabled={!canCancel}
                                    style={{ flex: 1, background: canCancel ? '#ef4444' : 'transparent', color: canCancel ? '#fff' : '#ef4444', fontWeight: 700, padding: '9px', fontSize: 12.5, borderRadius: 8, border: '2px solid #ef4444', cursor: canCancel ? 'pointer' : 'not-allowed', opacity: canCancel ? 1 : 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}
                                    onClick={() => {
                                      if (!canCancel) return
                                      if (window.confirm(`Cancel this reply from ${seller.name || 'this seller'}? This cannot be undone.`)) {
                                        updateEnquiry?.(r.id, { status: 'Cancelled' })
                                      }
                                    }}>
                                    <Ban style={{ width: 13 }} />{isCancelled ? 'Cancelled' : isConfirmed ? 'Confirmed' : 'Cancel'}
                                  </button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                      {!replies.replied?.length && null}
                    </>
                  )}
                </div>
              )}

              {/* ── ACTION BUTTONS ── */}
              {(() => {
                const isCancelled = selected.status === 'Cancelled'
                const isConfirmed = selected.status === 'Confirmed'
                // Anyone can cancel — but not if already cancelled or confirmed
                const canCancel = !isCancelled && !isConfirmed
                // Message and Reply are blocked on cancelled enquiries
                const canAct = !isCancelled

                // ── SENT-enquiry gate ────────────────────────────────────────
                // This panel is the SENDER's view. Message / Reply / Cancel all
                // act on ONE reply thread, so they only make sense once a
                // recipient has actually answered. Before the first reply the
                // sender should just read the enquiry — showing "Reply"/"Cancel"
                // there implies it was addressed to them, and a Cancel would
                // wipe a broadcast nobody has responded to yet.
                const isSentEnquiry = directionOf(selected, user) === 'sent'
                // `replies` is null until the roster loads; treat "loading" as
                // "not yet known" but DO NOT hide everything forever.
                const hasAnyReply   = !!(replies?.replied?.length)
                // Mirror the wholesaler app: the shared Message/Reply/Cancel row
                // shows ONLY when there are no reply cards. The moment reply
                // cards exist (either direction), THEY carry the per-replier
                // actions, so the shared row would duplicate them — hide it.
                const showReplyActions = !isSentEnquiry && !hasAnyReply

                // For a sent enquiry with no reply yet, show a quiet note instead
                // of the action row so the panel explains why there is nothing to do.
                if (isSentEnquiry && !hasAnyReply) {
                  return (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: '#f8fafc', border: '1px dashed #cbd5e1',
                      borderRadius: 8, padding: '12px 14px', marginBottom: 16,
                      fontSize: 12.5, color: '#64748b',
                    }}>
                      <Clock style={{ width: 14, flexShrink: 0 }} />
                      <span>
                        Waiting for a reply{replies?.counts?.total ? ` — sent to ${replies.counts.total} recipient${replies.counts.total === 1 ? '' : 's'}` : ''}.
                        Message, Reply and Cancel unlock once someone responds.
                      </span>
                    </div>
                  )
                }

                return (
                  <>
                    {/* Shared Message/Reply/Cancel row — RECEIVED enquiries only.
                        On SENT the per-reply cards above carry their own buttons,
                        but the chat/reply PANELS below still render so those card
                        buttons have somewhere to open. */}
                    {showReplyActions && (
                    <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>

                      {/* MESSAGE */}
                      <button
                        className="btn"
                        disabled={!canAct}
                        style={{
                          flex: 1,
                          background: canAct ? '#f97316' : 'transparent',
                          color: canAct ? '#fff' : '#f97316',
                          fontWeight: 700,
                          padding: '11px',
                          fontSize: 13,
                          borderRadius: 8,
                          border: `2px solid ${canAct ? '#f97316' : '#fdba74'}`,
                          cursor: canAct ? 'pointer' : 'not-allowed',
                          opacity: canAct ? 1 : 0.5,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                        title={isCancelled ? 'Enquiry is cancelled' : ''}
                        onClick={() => {
                          if (!canAct) return
                          setReplyModal({ visible: false, seller: null, sellerId: null })
                          setMessageModal(prev => ({
                            visible: !(prev.visible && prev.sellerId === null),
                            seller: null, sellerId: null,
                          }))
                        }}
                      >
                        <MessageCircle style={{ width: 14 }} />
                        Message
                      </button>

                      {/* REPLY */}
                      <button
                        className="btn"
                        disabled={!canAct}
                        style={{
                          flex: 1,
                          background: canAct ? '#f97316' : 'transparent',
                          color: canAct ? '#fff' : '#f97316',
                          fontWeight: 700,
                          padding: '11px',
                          fontSize: 13,
                          borderRadius: 8,
                          border: `2px solid ${canAct ? '#f97316' : '#fdba74'}`,
                          cursor: canAct ? 'pointer' : 'not-allowed',
                          opacity: canAct ? 1 : 0.5,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                        title={isCancelled ? 'Enquiry is cancelled' : ''}
                        onClick={() => {
                          if (!canAct) return
                          setMessageModal({ visible: false, seller: null, sellerId: null })
                          const willOpen = !(replyModal.visible && replyModal.sellerId === null)
                          if (willOpen) {
                            setModalReplyForm({ rate: '', available_qty: '', timeline: '', remarks: '' })
                            setReplyHistory([])
                            enquiryApi.listReplyHistory(eid(selected))
                              .then(r => setReplyHistory(r?.data?.replies || r?.replies || []))
                              .catch(() => setReplyHistory([]))
                          }
                          setReplyModal(prev => ({
                            visible: !(prev.visible && prev.sellerId === null),
                            seller: null, sellerId: null,
                          }))
                        }}
                      >
                        <Reply style={{ width: 14 }} />
                        Reply
                      </button>

                      {/* CANCEL */}
                      <button
                        className="btn"
                        disabled={!canCancel}
                        title={isCancelled ? 'Already cancelled' : isConfirmed ? 'Already confirmed' : 'Cancel this enquiry'}
                        style={{
                          flex: 1,
                          background: canCancel ? '#ef4444' : 'transparent',
                          color: canCancel ? '#fff' : '#ef4444',
                          fontWeight: 700,
                          padding: '11px',
                          fontSize: 13,
                          borderRadius: 8,
                          border: '2px solid #ef4444',
                          cursor: canCancel ? 'pointer' : 'not-allowed',
                          opacity: canCancel ? 1 : 0.5,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        }}
                        onClick={() => {
                          if (!canCancel) return
                          if (window.confirm(`Cancel enquiry ${enqCode(selected)}? This cannot be undone.`)) {
                            handleUpdate('Cancelled')
                          }
                        }}
                      >
                        <Ban style={{ width: 14 }} />
                        {isCancelled ? 'Cancelled' : isConfirmed ? 'Confirmed' : 'Cancel'}
                      </button>
                    </div>
                    )}

                    {/* CHAT PANEL — opens below the buttons for EITHER the shared
                        received-row thread (sellerId === null) OR a specific
                        seller's thread (sellerId === r.id). */}
                    {messageModal.visible && (
                      <div style={{
                        background: '#fff',
                        border: '2px solid #f97316',
                        borderRadius: 10,
                        overflow: 'hidden',
                        marginBottom: 16,
                      }}>
                        {/* Chat header */}
                        <div style={{
                          background: '#f97316',
                          padding: '10px 14px',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}>
                          <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>
                            💬 Chat with {messageModal.seller?.name || enqRetailer(selected) || 'Enquiry Creator'}
                          </div>
                          <button
                            style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}
                            onClick={() => setMessageModal({ visible: false, seller: null, sellerId: null })}
                          >✕</button>
                        </div>

                        {/* Chat bubbles */}
                        <div style={{
                          height: 260,
                          overflowY: 'auto',
                          padding: '12px 14px',
                          background: '#f8fafc',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                        }}>
                          {messagesLoading && (
                            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, marginTop: 20 }}>Loading…</div>
                          )}
                          {!messagesLoading && (!messages || messages.length === 0) && (
                            <div style={{ textAlign: 'center', color: '#94a3b8', fontSize: 12, marginTop: 40 }}>
                              No messages yet. Start the conversation.
                            </div>
                          )}
                          {messages && messages.map((m, i) => {
                            // "Mine" = sent by me (this logged-in user) OR by any admin/operator
                            const myUserId = user?._id || user?.id || ''
                            const msgSenderId = m.sender?.id ? String(m.sender.id) : ''
                            const isMe = (myUserId && msgSenderId && myUserId === msgSenderId)
                              || m.sender_side === 'admin'
                              || m.__pending === true
                            const time = m.created_at
                              ? new Date(m.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
                              : ''
                            const date = m.created_at
                              ? new Date(m.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
                              : ''
                            const senderName = isMe
                              ? (m.sender?.name || user?.name || 'You')
                              : (m.sender?.name || enqRetailer(selected) || (m.sender_side === 'seller' ? 'Seller' : 'Retailer'))

                            // Detect structured reply message (starts with 💰)
                            const isReplyCard = m.message?.startsWith('💰 Rate:')

                            return (
                              <div key={m.id || i} style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: isMe ? 'flex-end' : 'flex-start',
                              }}>
                                <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 3, paddingLeft: 4, paddingRight: 4 }}>
                                  {senderName}
                                </div>
                                {isReplyCard ? (
                                  /* Styled reply card */
                                  <div style={{
                                    maxWidth: '80%',
                                    background: isMe ? '#fff8f0' : '#f8fafc',
                                    border: `2px solid ${isMe ? '#f97316' : '#e2e8f0'}`,
                                    borderRadius: isMe ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
                                    padding: '10px 13px',
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                                    opacity: m.__pending ? 0.7 : 1,
                                  }}>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: '#f97316', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                      📋 Quote Reply
                                    </div>
                                    {m.message.split('\n').map((line, li) => (
                                      <div key={li} style={{ fontSize: 12, color: '#1e293b', marginBottom: 2, lineHeight: 1.4 }}>{line}</div>
                                    ))}
                                  </div>
                                ) : (
                                  /* Plain text bubble */
                                  <div style={{
                                    maxWidth: '75%',
                                    background: isMe ? '#f97316' : '#fff',
                                    color: isMe ? '#fff' : '#1e293b',
                                    padding: '9px 13px',
                                    borderRadius: isMe ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                                    fontSize: 13,
                                    lineHeight: 1.4,
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                                    border: isMe ? 'none' : '1px solid #e2e8f0',
                                    wordBreak: 'break-word',
                                    opacity: m.__pending ? 0.7 : 1,
                                  }}>
                                    {m.message}
                                  </div>
                                )}
                                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3, paddingLeft: 4, paddingRight: 4 }}>
                                  {date} {time}{m.__pending ? ' · sending…' : ''}
                                </div>
                              </div>
                            )
                          })}
                        </div>

                        {/* Input row */}
                        <div style={{
                          padding: '10px 12px',
                          borderTop: '1px solid #e2e8f0',
                          display: 'flex',
                          gap: 8,
                          background: '#fff',
                        }}>
                          <textarea
                            className="form-control"
                            style={{ flex: 1, fontSize: 13, resize: 'none', height: 40, lineHeight: '24px', padding: '8px 10px' }}
                            placeholder="Type a message…"
                            value={messageText}
                            onChange={e => setMessageText(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault()
                                e.target.closest('form')?.requestSubmit?.() || document.getElementById('chat-send-btn')?.click()
                              }
                            }}
                          />
                          <button
                            id="chat-send-btn"
                            className="btn btn-primary"
                            style={{ padding: '0 16px', fontWeight: 700, flexShrink: 0 }}
                            disabled={modalSending || !messageText.trim()}
                            onClick={async () => {
                              const text = messageText.trim()
                              if (!text) return
                              setModalSending(true)
                              // Optimistic bubble
                              const optimistic = {
                                id: `tmp-${Date.now()}`,
                                message: text,
                                sender_side: 'admin',
                                sender: { name: user?.name || 'You' },
                                created_at: new Date().toISOString(),
                                __pending: true,
                              }
                              setThreadState(prev => ({
                                ...prev,
                                data: [...(prev.data || []), optimistic],
                              }))
                              setMessageText('')
                              // Target the specific seller's row when a seller
                              // card opened this chat; otherwise the anchor row.
                              const targetRowId = messageModal.sellerId || eid(selected)
                              try {
                                const clientId = `c${Date.now()}`
                                await enquiryApi.sendMessage(targetRowId, text, clientId)
                                // Reload full thread so all messages show with correct sender_side
                                loadMessages(targetRowId)
                                toast('✓ Message sent')
                              } catch {
                                // Remove optimistic on failure
                                setThreadState(prev => ({
                                  ...prev,
                                  data: prev.data.filter(m => m.id !== optimistic.id),
                                }))
                                toast('✗ Failed to send message')
                                setMessageText(text)
                              } finally {
                                setModalSending(false)
                              }
                            }}
                          >
                            <Send style={{ width: 15 }} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* REPLY FORM — opens below the buttons for EITHER the shared
                        received-row (sellerId === null) OR a specific seller's
                        row (sellerId === r.id). */}
                    {replyModal.visible && (
                      <div style={{ background: '#fff', border: '2px solid #f97316', borderRadius: 10, overflow: 'hidden', marginBottom: 16 }}>

                        {/* Header */}
                        <div style={{ background: '#f97316', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>↩️ Reply to {replyModal.seller?.name || enqRetailer(selected) || 'Enquiry Creator'}</div>
                          <button style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16 }} onClick={() => setReplyModal({ visible: false, seller: null, sellerId: null })}>✕</button>
                        </div>

                        {/* ── Reply History ── */}
                        {replyHistory.length > 0 && (
                          <div style={{ background: '#fafafa', borderBottom: '1px solid #e2e8f0', padding: '10px 14px', maxHeight: 220, overflowY: 'auto' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Clock style={{ width: 12 }} /> Reply History ({replyHistory.length})
                            </div>
                            {replyHistory.map((h, i) => (
                              <div key={h.id || i} style={{
                                background: '#fff',
                                border: `1px solid ${i === replyHistory.length - 1 ? '#86efac' : '#e2e8f0'}`,
                                borderRadius: 8,
                                padding: '8px 12px',
                                marginBottom: 6,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                              }}>
                                <div>
                                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 3, alignItems: 'center' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <DollarSign style={{ width: 12, color: '#f97316' }} />
                                      <span style={{ fontSize: 14, fontWeight: 800, color: '#f97316' }}>
                                        {Number(h.offered_price).toLocaleString('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })}
                                      </span>
                                    </span>
                                    {h.available_quantity != null && (
                                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748b' }}>
                                        <Box style={{ width: 11 }} /> {h.available_quantity} {h.unit || ''}
                                      </span>
                                    )}
                                    {h.delivery_timeline && (
                                      <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#64748b' }}>
                                        <Truck style={{ width: 11 }} /> {h.delivery_timeline}
                                      </span>
                                    )}
                                  </div>
                                  {h.remarks && <div style={{ fontSize: 11, color: '#94a3b8', fontStyle: 'italic' }}>"{h.remarks}"</div>}
                                  <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                                    <Clock style={{ width: 9 }} />
                                    {h.sender_name || 'Admin'} &middot; {h.created_at ? new Date(h.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                                  </div>
                                </div>
                                {i === replyHistory.length - 1 && (
                                  <span style={{ fontSize: 10, background: '#dcfce7', color: '#16a34a', padding: '2px 8px', borderRadius: 10, fontWeight: 600, whiteSpace: 'nowrap', marginLeft: 8, display: 'flex', alignItems: 'center', gap: 3 }}>
                                    <CheckCircle2 style={{ width: 9 }} /> Latest
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}

                        {/* ── New Reply Form ── */}
                        <div style={{ padding: 14 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            {replyHistory.length > 0 ? 'Send New Reply' : 'Send Reply'}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Rate (₹) *</label>
                              <input type="number" className="form-control" placeholder="e.g. 150"
                                value={modalReplyForm.rate}
                                onChange={e => setModalReplyForm({ ...modalReplyForm, rate: e.target.value })}
                                style={{ fontSize: 13 }} />
                            </div>
                            <div>
                              <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Available Qty</label>
                              <input type="number" className="form-control" placeholder="e.g. 1000"
                                value={modalReplyForm.available_qty}
                                onChange={e => setModalReplyForm({ ...modalReplyForm, available_qty: e.target.value })}
                                style={{ fontSize: 13 }} />
                            </div>
                          </div>
                          <div style={{ marginBottom: 10 }}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Delivery Timeline</label>
                            <input className="form-control" placeholder="e.g. 3-5 business days"
                              value={modalReplyForm.timeline}
                              onChange={e => setModalReplyForm({ ...modalReplyForm, timeline: e.target.value })}
                              style={{ fontSize: 13 }} />
                          </div>
                          <div style={{ marginBottom: 12 }}>
                            <label style={{ fontSize: 11, fontWeight: 600, color: '#64748b', display: 'block', marginBottom: 4 }}>Message / Remarks</label>
                            <textarea className="form-control" rows={2} placeholder="Any additional details..."
                              value={modalReplyForm.remarks}
                              onChange={e => setModalReplyForm({ ...modalReplyForm, remarks: e.target.value })}
                              style={{ fontSize: 13 }} />
                          </div>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              className="btn btn-primary"
                              style={{ flex: 1, fontWeight: 700 }}
                              disabled={modalSending || !modalReplyForm.rate}
                              onClick={async () => {
                                if (!modalReplyForm.rate) return
                                setModalSending(true)
                                try {
                                  const payload = {
                                    offered_price:      parseFloat(modalReplyForm.rate),
                                    available_quantity: modalReplyForm.available_qty ? parseFloat(modalReplyForm.available_qty) : undefined,
                                    delivery_timeline:  modalReplyForm.timeline.trim(),
                                    remarks:            modalReplyForm.remarks.trim(),
                                    unit:               selected.unit || '',
                                  }
                                  // Target the specific seller's row when a reply
                                  // card opened this form; otherwise the anchor row.
                                  const targetRowId = replyModal.sellerId || eid(selected)
                                  // Save to history (creates new record, never overwrites)
                                  const saved = await enquiryApi.createReplyHistory(targetRowId, payload)
                                  const newEntry = saved?.data || saved
                                  setReplyHistory(prev => [...prev, newEntry])
                                  // Also update enquiry status on that same row
                                  await updateEnquiry?.(targetRowId, { status: 'Replied', offered_price: payload.offered_price, available_quantity: payload.available_quantity, delivery_timeline: payload.delivery_timeline, distributor_reply: payload.remarks })
                                  setSelected(prev => ({ ...prev, status: 'Replied', offered_price: payload.offered_price }))
                                  toast(`✓ Reply #${replyHistory.length + 1} sent — ₹${Number(payload.offered_price).toLocaleString()}`)
                                  setModalReplyForm({ rate: '', available_qty: '', timeline: '', remarks: '' })
                                } catch {
                                  toast('✗ Failed to send reply')
                                } finally {
                                  setModalSending(false)
                                }
                              }}
                            >
                              <Send style={{ width: 13, marginRight: 6 }} />
                              {modalSending ? 'Sending…' : `Send Reply${replyHistory.length > 0 ? ` #${replyHistory.length + 1}` : ''}`}
                            </button>
                            <button className="btn btn-secondary" onClick={() => setReplyModal({ visible: false, seller: null, sellerId: null })}>Close</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )
              })()}

            </div>

            {/* Footer */}
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelected(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          NEW ENQUIRY MODAL  (Day 12 — Retailer Enquiry Form)
      ══════════════════════════════════════════════════════ */}
      {showNewModal && (
        <div className="modal-overlay" onClick={() => setShowNewModal(false)}>
          <div className="modal" style={{ maxWidth: 640, borderRadius: 18, overflow: 'hidden', padding: 0 }} onClick={e => e.stopPropagation()}>

            {/* ── Orange navbar header (mirrors the retailer app) ── */}
            <div style={{
              background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
              padding: '18px 22px 16px',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Decorative circles */}
              <div style={{ position: 'absolute', top: -30, right: -30, width: 100, height: 100, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
              <div style={{ position: 'absolute', bottom: -20, right: 60, width: 60, height: 60, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#fff', marginBottom: 2 }}>
                    {editEnquiry ? `Edit Enquiry` : 'New Enquiry'}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)' }}>
                    {editEnquiry ? `Editing ${enqCode(editEnquiry)}` : 'Type the product details and send'}
                  </div>
                </div>
                <button
                  style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: '#fff', display: 'flex', alignItems: 'center' }}
                  onClick={() => { setShowNewModal(false); setEditEnquiry(null) }}
                ><X style={{ width: 16 }} /></button>
              </div>
            </div>

            <div className="modal-body" style={{ padding: '20px 22px', maxHeight: '70vh', overflowY: 'auto' }}>

              {/* Edit-only: Retailer details */}
              {isEditing && (
                <div style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 16px', marginBottom: 18, border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 12 }}>Retailer Details</div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Retailer Name *</label>
                      <input className={`form-control${enqErrors.retailer ? ' input-error' : ''}`}
                        placeholder="e.g. Ramesh Tiles Store"
                        value={newForm.retailer}
                        onChange={e => setNewForm(f => ({ ...f, retailer: e.target.value }))} />
                      {enqErrors.retailer && <div className="form-error">{enqErrors.retailer}</div>}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Mobile *</label>
                      <input className={`form-control${enqErrors.mobile ? ' input-error' : ''}`}
                        placeholder="10-digit mobile" maxLength={10}
                        value={newForm.mobile} inputMode="numeric"
                        onChange={e => setNewForm(f => ({ ...f, mobile: e.target.value.replace(/\D/g,'').slice(0, 10) }))} />
                      {enqErrors.mobile && <div className="form-error">{enqErrors.mobile}</div>}
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Email</label>
                    <input className="form-control" placeholder="retailer@example.com"
                      value={newForm.email}
                      onChange={e => setNewForm(f => ({ ...f, email: e.target.value }))} />
                  </div>
                </div>
              )}

              {/* ── Section 1: Product Details ── */}
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 14, overflow: 'hidden' }}>
                {/* Section header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ width: 24, height: 24, borderRadius: 12, background: '#F4500A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>1</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>Product details</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Just type what you need — no codes required.</div>
                  </div>
                </div>
                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Product name *</label>
                    <input className={`form-control${enqErrors.product ? ' input-error' : ''}`}
                      placeholder="e.g. Vitrified floor tile"
                      value={newForm.product}
                      onChange={e => setNewForm(f => ({ ...f, product: e.target.value }))} />
                    {enqErrors.product && <div className="form-error">{enqErrors.product}</div>}
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Category</label>
                    <input className="form-control" placeholder="e.g. Floor tiles, Wall tiles, Sanitaryware"
                      value={newForm.category}
                      onChange={e => setNewForm(f => ({ ...f, category: e.target.value }))} />
                  </div>
                  <div className="form-row" style={{ marginBottom: 0 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Brand</label>
                      <input className="form-control" placeholder="e.g. Kajaria"
                        value={newForm.brand}
                        onChange={e => setNewForm(f => ({ ...f, brand: e.target.value }))} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Size</label>
                      <input className="form-control" placeholder="e.g. 600 x 600 mm"
                        value={newForm.size}
                        onChange={e => setNewForm(f => ({ ...f, size: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-row" style={{ marginBottom: 0 }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Finish</label>
                      <input className="form-control" placeholder="e.g. Glossy"
                        value={newForm.finish}
                        onChange={e => setNewForm(f => ({ ...f, finish: e.target.value }))} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Colour</label>
                      <input className="form-control" placeholder="e.g. Ivory"
                        value={newForm.color}
                        onChange={e => setNewForm(f => ({ ...f, color: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Grade</label>
                    <input className="form-control" placeholder="e.g. A"
                      value={newForm.grade}
                      onChange={e => setNewForm(f => ({ ...f, grade: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">More details</label>
                    <textarea className="form-control" rows={2}
                      placeholder="e.g. Anti-skid surface, matte look, branded packing"
                      value={newForm.details}
                      onChange={e => setNewForm(f => ({ ...f, details: e.target.value }))} />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Anything else the seller should know.</div>
                  </div>
                </div>
              </div>

              {/* ── Section 2: Requirement ── */}
              <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e2e8f0', marginBottom: 14, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid #f1f5f9' }}>
                  <div style={{ width: 24, height: 24, borderRadius: 12, background: '#F4500A', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>2</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>Your requirement</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Quantity is required — the rest helps the seller quote faster.</div>
                  </div>
                </div>
                <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Quantity *</label>
                    <input className={`form-control${enqErrors.qty ? ' input-error' : ''}`}
                      type="number" min={1} placeholder="e.g. 500"
                      value={newForm.qty}
                      onChange={e => setNewForm(f => ({ ...f, qty: e.target.value }))} />
                    {enqErrors.qty && <div className="form-error">{enqErrors.qty}</div>}
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Unit</label>
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 2 }}>
                      {UNIT_OPTIONS.map(u => {
                        const active = (newForm.unit || 'Sq Ft') === u
                        return (
                          <button key={u} type="button"
                            onClick={() => setNewForm(f => ({ ...f, unit: u }))}
                            style={{
                              padding: '7px 14px', borderRadius: 20, cursor: 'pointer',
                              fontSize: 13, fontWeight: 600,
                              border: `1.5px solid ${active ? '#F4500A' : 'var(--border)'}`,
                              background: active ? '#FFF3EE' : 'var(--bg)',
                              color: active ? '#F4500A' : 'var(--text-muted)',
                              transition: 'all 0.15s',
                            }}
                          >{u}</button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Delivery location</label>
                    <input className="form-control"
                      placeholder="City, State — e.g. Mumbai, Maharashtra"
                      value={newForm.location}
                      onChange={e => setNewForm(f => ({ ...f, location: e.target.value }))} />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>City / site where you need the material.</div>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Notes</label>
                    <textarea className="form-control" rows={2}
                      placeholder="e.g. Need delivery within 2 weeks"
                      value={newForm.remarks}
                      onChange={e => setNewForm(f => ({ ...f, remarks: e.target.value }))} />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>Optional — delivery timeline or anything else.</div>
                  </div>
                </div>
              </div>

              {/* Info strip — only on new, not edit */}
              {!isEditing && (
                <div style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  background: '#f0fdf4', border: '1px solid #bbf7d0',
                  borderRadius: 10, padding: '10px 14px',
                }}>
                  <span style={{ fontSize: 16 }}>📢</span>
                  <div style={{ fontSize: 12, color: '#166534', lineHeight: 1.5 }}>
                    Goes to every retailer, every wholesaler and the Admin team. Each reply comes back as its own thread so you can compare quotes.
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer" style={{ padding: '14px 22px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => { setShowNewModal(false); setEditEnquiry(null) }}>Cancel</button>
              <button className="btn btn-primary" disabled={saving} onClick={handleNewEnquiry}
                style={{ background: '#F4500A', borderColor: '#F4500A', minWidth: 120 }}>
                {saving
                  ? (editEnquiry ? 'Updating…' : 'Submitting…')
                  : editEnquiry ? 'Update Enquiry' : '📤 Send to All'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ DELETE CONFIRM MODAL ══ */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">Delete Enquiry</span>
              <button className="btn-ghost" onClick={() => setDeleteConfirm(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-danger" style={{ marginBottom: 0 }}>
                <Trash2 style={{ width: 16, flexShrink: 0 }} />
                <span>
                  Delete quotation <strong>{deleteConfirm.code}</strong>?
                  This cannot be undone. Any linked order will remain.
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn btn-danger" disabled={deleting} onClick={handleDelete}>
                {deleting ? 'Deleting…' : 'Delete Enquiry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message and Reply forms are now inline inside the detail modal — no standalone overlays needed */}
    </>
  )
}
