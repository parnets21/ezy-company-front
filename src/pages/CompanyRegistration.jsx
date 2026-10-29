import { useState, useEffect, useCallback } from 'react'
import {
  Building2, FileText, Upload, CheckCircle, Clock, XCircle,
  Phone, Mail, RefreshCw, Save, X, Eye, Crown, Edit2,
  Trash2, Download, Pencil, AlertCircle, Plus, Search, Ban, RotateCcw
} from 'lucide-react'
import { companyApi } from '../api/companyApi'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

// ── Subscription plans — same as SubscriptionSystem ──────────
const SUBSCRIPTION_PLANS = [
  { key: 'Free',     name: 'Free',     price: 0,    badge: 'badge-gray',   description: 'Up to 10 Enquiries / month · 1 User' },
  { key: 'Silver',   name: 'Silver',   price: 1499, badge: 'badge-cyan',   description: 'Up to 100 Enquiries / month · 5 Users' },
  { key: 'Gold',     name: 'Gold',     price: 2999, badge: 'badge-yellow', description: 'Up to 500 Enquiries / month · 15 Users' },
  { key: 'Platinum', name: 'Platinum', price: 5999, badge: 'badge-purple', description: 'Unlimited Enquiries · Unlimited Users + AI' },
]

const PLAN_COLORS = {
  Free: 'badge-gray', Silver: 'badge-cyan', Gold: 'badge-yellow', Platinum: 'badge-purple',
}
const statusMeta = {
  Approved:  { color: 'badge-green',  icon: <CheckCircle style={{ width: 13 }} /> },
  Pending:   { color: 'badge-yellow', icon: <Clock       style={{ width: 13 }} /> },
  Rejected:  { color: 'badge-red',    icon: <XCircle     style={{ width: 13 }} /> },
  Suspended: { color: 'badge-red',    icon: <Ban         style={{ width: 13 }} /> },
}

// Indian States & Union Territories (for the State dropdown)
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir',
  'Ladakh', 'Lakshadweep', 'Puducherry',
]

// Keep only letters, spaces and common name punctuation ( . & - ' ). Strips digits.
const lettersOnly = (v) => v.replace(/[^A-Za-z\s.&'-]/g, '')

// Blank company template — no static/mock data. Real records come from the API.
const BLANK_COMPANY = {
  id: '', name: '', owner: '', bizType: '',
  mobile: '', email: '', gst: '', pan: '',
  city: '', state: '', pin: '',
  plan: 'Free', status: 'Pending', registered: '',
  reviewedBy: '—',
  docs: { gst: false, pan: false, address: false, biz: false },
}

const BLANK_FORM = {
  name: '', bizType: 'Wholesaler', owner: '', mobile: '', email: '',
  city: '', state: '', pin: '', gst: '', pan: '', address: '',
  plan: 'Free', status: 'Pending', submittedDate: '',
}

export default function CompanyRegistration() {
  const [tab, setTab] = useState('admin')
  const [companies, setCompanies] = useState([])

  // ── Profile edit state ──
  const [editing, setEditing] = useState(false)
  const [profileForm, setProfileForm] = useState({ ...BLANK_COMPANY })
  const [profileSaved, setProfileSaved] = useState(false)

  // ── Register new company state ──
  const [regStep, setRegStep] = useState(1)
  const [form, setForm] = useState({ ...BLANK_FORM })
  const [formErrors, setFormErrors] = useState({})
  const [otpSent, setOtpSent] = useState(false)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [otpVerified, setOtpVerified] = useState(false)
  const [uploadedDocs, setUploadedDocs] = useState({ gst: null, pan: null, address: null, biz: null })
  // OTP transport state
  const [otpSending, setOtpSending] = useState(false)
  const [otpVerifying, setOtpVerifying] = useState(false)
  const [devOtp, setDevOtp] = useState('')       // shown on screen in dev mode
  const [otpTarget, setOtpTarget] = useState('') // the email/mobile the OTP was sent to
  const [serverVerifiable, setServerVerifiable] = useState(false) // backend owns the OTP
  // Registration submit state
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [createdCompanyId, setCreatedCompanyId] = useState(null)

  // Open a fresh registration wizard
  const openRegister = () => {
    setRegStep(1)
    setForm({ ...BLANK_FORM })
    setUploadedDocs({ gst: null, pan: null, address: null, biz: null })
    setOtpSent(false)
    setOtpVerified(false)
    setOtp(['', '', '', '', '', ''])
    setDevOtp('')
    setOtpTarget('')
    setServerVerifiable(false)
    setSubmitError('')
    setCreatedCompanyId(null)
    setFormErrors({})
    setTab('register')
  }

  // ── Admin state ──
  const [statusFilter, setStatusFilter] = useState('All')
  const [search, setSearch] = useState('')
  const [viewCompany, setViewCompany] = useState(null)
  const [rejectReason, setRejectReason] = useState('')
  const [showRejectModal, setShowRejectModal] = useState(null)
  const [suspendReason, setSuspendReason] = useState('')
  const [showSuspendModal, setShowSuspendModal] = useState(null)
  const [editCompany, setEditCompany] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null)

  // ── Real API state ──
  const [apiLoading, setApiLoading] = useState(false)
  const [apiError,   setApiError]   = useState(null)
  const [approvalList, setApprovalList] = useState([])  // real data from backend

  // ── In-app document preview modal ──
  // { label, url, kind: 'image' | 'pdf' | 'other' }
  const [previewDoc, setPreviewDoc] = useState(null)

  // Map backend company to frontend shape
  const mapCompany = (c) => {
    const docUrls = {
      gst: c.doc_gst_url || null,
      pan: c.doc_pan_url || null,
      address: c.doc_reg_url || null,
      biz: c.doc_trade_url || null,
    }
    const legacySubmitted = {
      gst: !!c.docs_gst,
      pan: !!c.docs_pan,
      address: !!c.docs_address,
      biz: !!c.docs_biz,
    }
    const uiKeyByType = { gst: 'gst', pan: 'pan', registration: 'address', trade: 'biz' }
    const canonicalByKey = (c.kyc_documents || []).reduce((result, document) => {
      const key = uiKeyByType[document.document_type]
      if (key) result[key] = document
      return result
    }, {})
    const documentDetails = Object.keys(legacySubmitted).reduce((result, key) => {
      const document = canonicalByKey[key]
      const submitted = !!document || legacySubmitted[key]
      result[key] = {
        submitted,
        status: document?.status || (submitted ? 'Pending' : 'NotSubmitted'),
        rejectReason: document?.status === 'Rejected' ? document.reject_reason || '' : '',
        uploadedAt: document?.uploaded_at || null,
        downloadAvailable: !!(document?.file_url || docUrls[key]),
      }
      return result
    }, {})

    return {
      id: c.company_code || c._id,
      _id: c._id,
      // Unique wholesaler/company code (EZY001, ...) generated at registration.
      code: c.company_code || '—',
      name: c.name,
      owner: c.owner_name || c.owner_user?.name || '—',
      bizType: c.biz_type || '—',
      mobile: c.mobile || '—',
      email: c.email || '—',
      gst: c.gst_number || '',
      pan: c.pan_number || '—',
      city: c.city || '—',
      state: c.state || '—',
      pin: c.pin_code || '',
      plan: c.subscription_plan || 'Free',
      status: c.status,
      registered: c.created_at
        ? new Date(c.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : '—',
      reviewedBy: c.reviewed_by?.name || (c.reviewed_by ? 'Admin' : '—'),
      rejectReason: c.reject_reason || '',
      docs: Object.fromEntries(Object.entries(documentDetails).map(([key, detail]) => [key, detail.submitted])),
      documentDetails,
      docUrls,
    }
  }

  // Fetch companies from backend
  const fetchApprovalQueue = useCallback(async () => {
    setApiLoading(true)
    setApiError(null)
    try {
      const response = await companyApi.list({ limit: 100 })
      // Backend returns: { success, message, data: { companies: [...], pagination: {...} } }
      const companies = response?.data?.companies || response?.companies || []
      const list = companies.map(mapCompany)
      setApprovalList(list)
    } catch (err) {
      setApiError(err?.response?.data?.message || 'Failed to load companies from server.')
    } finally {
      setApiLoading(false)
    }
  }, [])

  // Load real data on mount + when admin tab is opened
  useEffect(() => {
    fetchApprovalQueue()
  }, [fetchApprovalQueue])

  useEffect(() => {
    if (tab === 'admin') {
      fetchApprovalQueue()
    }
  }, [tab, fetchApprovalQueue])

  // Merge: Admin Queue ONLY uses real API data — never mock data
  // Profile/Register tabs keep using local companies state
  const allCompanies = approvalList   // real backend data only
  const filtered = allCompanies.filter(c => {
    const matchStatus = statusFilter === 'All' || c.status === statusFilter
    const q = search.trim().toLowerCase()
    if (!q) return matchStatus
    const haystack = [c.id, c.code, c.name, c.owner, c.email, c.mobile, c.city, c.state, c.gst, c.pan, c.bizType]
      .map(v => (v || '').toString().toLowerCase())
      .join(' ')
    return matchStatus && haystack.includes(q)
  })

  // ── Profile edit handlers ──
  const saveProfile = () => {
    setCompanies(prev => prev.map(c => c.id === profileForm.id ? { ...profileForm } : c))
    setEditing(false)
    setProfileSaved(true)
    setTimeout(() => setProfileSaved(false), 2500)
  }

  // ── Register form validation ──
  const validateStep1 = () => {
    const errs = {}
    if (!form.name.trim())   errs.name   = 'Company name required'
    if (!form.owner.trim())  errs.owner  = 'Owner name required'
    if (!/^\d{10}$/.test(form.mobile)) errs.mobile = 'Valid 10-digit mobile required'
    if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Valid email required'
    if (!form.pan.trim())    errs.pan    = 'PAN required'
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }
  const validateStep2 = () => {
    const errs = {}
    if (!uploadedDocs.pan)     errs.pan     = 'PAN card upload required'
    if (!uploadedDocs.address) errs.address = 'Address proof upload required'
    setFormErrors(errs)
    return Object.keys(errs).length === 0
  }
  const handleDocUpload = (key, file) => {
    if (!file) return
    const extension = file.name.split('.').pop()?.toLowerCase()
    if (!['pdf', 'jpg', 'jpeg', 'png'].includes(extension)) {
      setFormErrors(prev => ({ ...prev, [key]: 'Choose a PDF, JPG or PNG file.' }))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormErrors(prev => ({ ...prev, [key]: 'Each document must be 5 MB or smaller.' }))
      return
    }
    setUploadedDocs(prev => ({ ...prev, [key]: file }))
    setFormErrors(prev => ({ ...prev, [key]: undefined }))
  }

  // ── OTP handlers ──
  const handleOtpChange = (i, v) => {
    if (!/^\d?$/.test(v)) return
    const next = [...otp]; next[i] = v; setOtp(next)
    if (v && i < 5) document.getElementById(`cotp-${i + 1}`)?.focus()
  }
  // Send a real OTP to the applicant's email (SMS not configured on backend).
  const sendOtp = async (channel) => {
    const target = channel === 'mobile' ? form.mobile : form.email
    const type   = channel === 'mobile' ? 'mobile' : 'email'
    if (!target) {
      setFormErrors({ otp: `No ${channel} provided to send the OTP to.` })
      return
    }
    setOtpSending(true)
    setFormErrors({})
    try {
      const res = await companyApi.sendOtp(target, type)
      // Backend returns { success, data: { sent, otp? } }.
      // The hosted server runs in production mode and does NOT return the OTP,
      // and SMS/email delivery isn't configured — so to keep the flow usable we
      // generate a demo OTP on the client and show it on screen. If the backend
      // ever does return one (dev mode), we prefer that so server verify works.
      const serverOtp = res?.data?.otp || res?.otp || ''
      const code = serverOtp || String(Math.floor(100000 + Math.random() * 900000))
      setOtpTarget(target)
      setDevOtp(code)
      setServerVerifiable(!!serverOtp) // only verify on the server when it owns the OTP
      setOtpSent(true)
      setOtp(['', '', '', '', '', ''])
    } catch (err) {
      setFormErrors({ otp: err?.response?.data?.message || 'Failed to send OTP. Please try again.' })
    } finally {
      setOtpSending(false)
    }
  }

  const verifyOtp = async () => {
    const code = otp.join('')
    if (code.length !== 6) {
      setFormErrors({ otp: 'Enter complete 6-digit OTP' })
      return
    }
    setOtpVerifying(true)
    setFormErrors({})
    try {
      if (serverVerifiable) {
        // Backend issued this OTP — let it verify.
        await companyApi.verifyOtp(otpTarget || form.email, code)
      } else {
        // Client-side demo OTP — compare against what we showed on screen.
        if (code !== devOtp) throw new Error('mismatch')
      }
      setOtpVerified(true)
    } catch (err) {
      const msg = err?.response?.data?.message
      setFormErrors({ otp: msg || 'Invalid or expired OTP.' })
    } finally {
      setOtpVerifying(false)
    }
  }

  // ── Submit registration and upload the selected KYC files ──
  const submitRegistration = async () => {
    setSubmitting(true)
    setSubmitError('')
    const payload = {
      name: form.name.trim(),
      owner_name: form.owner.trim(),
      biz_type: form.bizType || 'Wholesaler',
      mobile: form.mobile,
      email: form.email.trim(),
      gst_number: form.gst.trim(),
      pan_number: form.pan.trim(),
      address: form.address || '',
      city: form.city || '',
      state: form.state || '',
      pin_code: form.pin || '',
      subscription_plan: form.plan || 'Free',
    }
    let registrationCreated = Boolean(createdCompanyId)
    try {
      let companyId = createdCompanyId
      if (!companyId) {
        const created = await companyApi.create(payload)
        companyId = created?.data?._id || created?.data?.company?._id || created?._id
        if (!companyId) throw new Error('Company was created but its identifier was missing. Please contact support.')
        registrationCreated = true
        setCreatedCompanyId(companyId)
      }

      await companyApi.uploadDocuments(companyId, uploadedDocs)
      await fetchApprovalQueue()
      setRegStep(3)
    } catch (err) {
      const message = err?.response?.data?.message || err?.message
      setSubmitError(registrationCreated
        ? `Company registration is saved, but the documents could not be uploaded: ${message || 'Please retry.'}`
        : (message || 'Failed to register the company. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  // ── Admin actions — real API ──
  const approveCompany = async (id) => {
    const company = allCompanies.find(c => c.id === id || c._id === id)
    const dbId = company?._id || id
    try {
      await companyApi.approve(dbId)
      // Refresh list
      await fetchApprovalQueue()
      // Update local mock too
      setCompanies(prev => prev.map(c => c.id === id ? { ...c, status: 'Approved', reviewedBy: 'Super Admin' } : c))
    } catch (err) {
      setApiError(err?.response?.data?.message || 'Failed to approve the company. Please try again.')
    }
  }

  const rejectCompany = async (id, reason) => {
    const company = allCompanies.find(c => c.id === id || c._id === id)
    const dbId = company?._id || id
    try {
      await companyApi.reject(dbId, reason)
      await fetchApprovalQueue()
      setCompanies(prev => prev.map(c => c.id === id ? { ...c, status: 'Rejected', rejectReason: reason, reviewedBy: 'Super Admin' } : c))
    } catch (err) {
      setApiError(err?.response?.data?.message || 'Failed to reject the company. Please try again.')
    }
    setShowRejectModal(null)
    setRejectReason('')
  }

  const suspendCompany = async (id, reason) => {
    const company = allCompanies.find(c => c.id === id || c._id === id)
    const dbId = company?._id || id
    try {
      await companyApi.suspend(dbId, reason)
      await fetchApprovalQueue()
    } catch (err) {
      setApiError(err?.response?.data?.message || 'Failed to suspend the company. Please try again.')
    }
    setShowSuspendModal(null)
    setSuspendReason('')
  }

  const reactivateCompany = async (id) => {
    const company = allCompanies.find(c => c.id === id || c._id === id)
    const dbId = company?._id || id
    try {
      await companyApi.reactivate(dbId)
      await fetchApprovalQueue()
    } catch (err) {
      setApiError(err?.response?.data?.message || 'Failed to reactivate the company. Please try again.')
    }
  }

  const approveDocuments = async (company) => {
    if (!company?._id) return
    try {
      await companyApi.updateDocs(company._id, {
        docs_gst: !!company.docs?.gst,
        docs_pan: !!company.docs?.pan,
        docs_address: !!company.docs?.address,
        docs_biz: !!company.docs?.biz,
      })
      await fetchApprovalQueue()
      setViewCompany(null)
    } catch (err) {
      setApiError(err?.response?.data?.message || 'Failed to approve the documents. Please try again.')
    }
  }

  // ── Edit handlers ──
  const openEdit = (c) => { setEditCompany(c); setEditForm({ ...c }) }
  const saveEdit = () => {
    setCompanies(prev => prev.map(c => c.id === editForm.id ? { ...editForm } : c))
    if (viewCompany?.id === editForm.id) setViewCompany({ ...editForm })
    setEditCompany(null)
  }

  // ── Delete handler ──
  // The list is real backend data, so a "delete" must succeed on the server —
  // otherwise the record simply reloads on the next fetch. We therefore call the
  // API, and only remove it from local state when the server confirms deletion.
  const deleteCompany = async (id) => {
    const company = allCompanies.find(c => c.id === id || c._id === id)
    const dbId = company?._id || (typeof id === 'string' && id.length === 24 ? id : null)

    if (!dbId) {
      setApiError('Cannot delete: this record has no valid database id.')
      setShowDeleteConfirm(null)
      return
    }

    try {
      await companyApi.delete(dbId)
    } catch (err) {
      // Surface the real reason instead of silently faking a delete.
      const msg = err?.response?.status === 403
        ? 'You can delete only registrations created from your company account.'
        : err?.response?.data?.message || 'Failed to delete on the server. Please try again.'
      setApiError(msg)
      setShowDeleteConfirm(null)
      return
    }

    // Server confirmed — now it is safe to drop it locally.
    setCompanies(prev => prev.filter(c => c.id !== id))
    setApprovalList(prev => prev.filter(c => c.id !== id))
    setShowDeleteConfirm(null)
    if (viewCompany?.id === id) setViewCompany(null)
  }

  // ── Download handler — branded PDF report with embedded document images ──
  const downloadCompany = async (c) => {
    // Convert a File object to base64 data URL
    const toDataUrl = (file) => new Promise((resolve) => {
      if (!file) return resolve(null)
      const reader = new FileReader()
      reader.onload = (e) => resolve(e.target.result)
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    })

    // Load an image data URL and return its natural dimensions (for aspect-ratio)
    const imageSize = (dataUrl) => new Promise((resolve) => {
      if (!dataUrl) return resolve(null)
      const img = new Image()
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
      img.onerror = () => resolve(null)
      img.src = dataUrl
    })

    const docDefs = [
      { key: 'gst',     name: 'GST Certificate' },
      { key: 'pan',     name: 'PAN Card' },
      { key: 'address', name: 'Address Proof' },
      { key: 'biz',     name: 'Business Registration' },
    ]

    // Build base64 data for each uploaded file
    const docData = await Promise.all(
      docDefs.map(async (d) => {
        const fileObj = c.docFiles?.[d.key]
        const dataUrl = fileObj ? await toDataUrl(fileObj) : null
        const isImage = fileObj?.type?.startsWith('image/')
        const isPdf   = fileObj?.type === 'application/pdf'
        const size    = isImage && dataUrl ? await imageSize(dataUrl) : null
        return { ...d, uploaded: !!c.docs?.[d.key], fileObj, dataUrl, isImage, isPdf, size }
      })
    )

    // ── Build PDF ──────────────────────────────────────────────
    const doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const M     = 14 // page margin

    // Brand palette (navy + orange, matching the app)
    const NAVY   = [30, 45, 74]
    const ORANGE = [242, 101, 34]
    const MUTED  = [100, 116, 139]

    // Header band
    doc.setFillColor(...NAVY)
    doc.rect(0, 0, pageW, 24, 'F')
    doc.setFillColor(...ORANGE)
    doc.rect(pageW - 46, 0, 46, 24, 'F')

    doc.setTextColor(255, 255, 255)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(15)
    doc.text('EzyEnquiry', M, 10)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9)
    doc.text('Company Registration Report', M, 16)
    doc.setFontSize(7.5)
    doc.text('Find Stock Instantly', M, 20.5)

    doc.setFont('helvetica', 'bold'); doc.setFontSize(12)
    doc.text(c.id, pageW - 23, 11, { align: 'center' })
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
    doc.text(
      new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      pageW - 23, 17, { align: 'center' }
    )

    // Section heading helper
    const sectionHeading = (title, y) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
      doc.setTextColor(...ORANGE)
      doc.text(title.toUpperCase(), M, y)
      doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.4)
      doc.line(M, y + 1.5, pageW - M, y + 1.5)
    }

    // ── Company Information (2-column key/value table) ──
    sectionHeading('Company Information', 34)
    autoTable(doc, {
      startY: 38,
      theme: 'plain',
      styles: { fontSize: 9.5, cellPadding: 2, textColor: [30, 45, 74] },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: MUTED, cellWidth: 34 },
        1: { cellWidth: 58 },
        2: { fontStyle: 'bold', textColor: MUTED, cellWidth: 34 },
        3: { cellWidth: 'auto' },
      },
      body: [
        ['Company', c.name, 'Business Type', c.bizType || '-'],
        ['Owner', c.owner, 'Mobile', c.mobile],
        ['Email', c.email, 'Location', `${c.city}, ${c.state} - ${c.pin}`],
        ['GST Number', c.gst || 'Not Registered', 'PAN Number', c.pan],
      ],
      margin: { left: M, right: M },
    })

    // ── Account & Status ──
    let y = doc.lastAutoTable.finalY + 8
    sectionHeading('Account & Status', y)
    autoTable(doc, {
      startY: y + 4,
      theme: 'plain',
      styles: { fontSize: 9.5, cellPadding: 2, textColor: [30, 45, 74] },
      columnStyles: {
        0: { fontStyle: 'bold', textColor: MUTED, cellWidth: 34 },
        1: { cellWidth: 58 },
        2: { fontStyle: 'bold', textColor: MUTED, cellWidth: 34 },
        3: { cellWidth: 'auto' },
      },
      body: [
        ['Subscription', `${c.plan} Plan`, 'Status', c.status],
        ['Submitted On', c.registered, 'Reviewed By', c.reviewedBy || '-'],
        ...(c.rejectReason ? [['Reject Reason', c.rejectReason, '', '']] : []),
      ],
      margin: { left: M, right: M },
    })

    // ── Documents summary table ──
    y = doc.lastAutoTable.finalY + 8
    sectionHeading('Uploaded Documents', y)
    autoTable(doc, {
      startY: y + 4,
      head: [['Document', 'Status', 'File Name']],
      body: docData.map(d => [
        d.name,
        d.uploaded ? 'Uploaded' : 'Not Uploaded',
        d.fileObj?.name || '-',
      ]),
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: NAVY, textColor: 255, fontStyle: 'bold' },
      alternateRowStyles: { fillColor: [248, 250, 254] },
      columnStyles: { 0: { cellWidth: 55 }, 1: { cellWidth: 32 } },
      // Colour the status cell green/red
      didParseCell: (data) => {
        if (data.section === 'body' && data.column.index === 1) {
          const uploaded = data.cell.raw === 'Uploaded'
          data.cell.styles.textColor = uploaded ? [5, 150, 105] : [220, 38, 38]
          data.cell.styles.fontStyle = 'bold'
        }
      },
      margin: { left: M, right: M },
    })

    // ── Embed uploaded document images (each may start a new page) ──
    const imageDocs = docData.filter(d => d.isImage && d.dataUrl)
    if (imageDocs.length) {
      const maxW = pageW - M * 2
      const maxH = 110 // cap image height so a caption fits
      y = doc.lastAutoTable.finalY + 10

      for (const d of imageDocs) {
        // Compute scaled dimensions preserving aspect ratio
        let drawW = maxW
        let drawH = maxH
        if (d.size?.w && d.size?.h) {
          const ratio = d.size.w / d.size.h
          drawW = maxW
          drawH = drawW / ratio
          if (drawH > maxH) { drawH = maxH; drawW = drawH * ratio }
        }

        // New page if this image + caption won't fit
        if (y + drawH + 12 > pageH - M) { doc.addPage(); y = M + 4 }

        doc.setFont('helvetica', 'bold'); doc.setFontSize(9.5)
        doc.setTextColor(...NAVY)
        doc.text(d.name, M, y)
        y += 3

        const fmt = d.fileObj?.type === 'image/png' ? 'PNG' : 'JPEG'
        try {
          doc.addImage(d.dataUrl, fmt, M, y, drawW, drawH, undefined, 'FAST')
        } catch {
          // If a format can't be embedded, note it instead of failing the export
          doc.setFont('helvetica', 'normal'); doc.setFontSize(8)
          doc.setTextColor(...MUTED)
          doc.text('(preview unavailable)', M, y + 6)
        }
        y += drawH + 8
      }
    }

    // ── Footer on every page ──
    const totalPages = doc.internal.getNumberOfPages()
    for (let p = 1; p <= totalPages; p++) {
      doc.setPage(p)
      doc.setDrawColor(226, 232, 240); doc.setLineWidth(0.3)
      doc.line(M, pageH - 10, pageW - M, pageH - 10)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5)
      doc.setTextColor(...MUTED)
      doc.text('EzyEnquiry · Company Management · Confidential', M, pageH - 6)
      doc.text(`Page ${p} of ${totalPages}`, pageW - M, pageH - 6, { align: 'right' })
    }

    doc.save(`${c.id}_${c.name.replace(/\s+/g, '_')}_Report.pdf`)
  }

  // ── Download individual document file ──
  const downloadDocFile = (fileObj, fallbackName) => {
    if (!fileObj) return
    const url = URL.createObjectURL(fileObj)
    const a   = document.createElement('a')
    a.href    = url
    a.download = fileObj.name || fallbackName
    a.click()
    URL.revokeObjectURL(url)
  }

  // Classify a file/URL into a preview kind
  const kindOf = ({ mime, name }) => {
    const m = (mime || '').toLowerCase()
    const n = (name || '').toLowerCase()
    if (m.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp)$/.test(n)) return 'image'
    if (m === 'application/pdf' || n.endsWith('.pdf')) return 'pdf'
    return 'other'
  }

  // ── VIEW: open the in-app preview modal ──
  const viewDocument = async ({ fileObj, companyId, docKey, label }) => {
    // Case 1: locally uploaded File (during registration) — preview directly
    if (fileObj) {
      const src  = URL.createObjectURL(fileObj)
      const kind = kindOf({ mime: fileObj.type, name: fileObj.name })
      setPreviewDoc({ label, url: src, kind, isObjectUrl: true })
      return
    }

    // Case 2: document stored on the backend — fetch via authenticated API
    if (companyId && docKey) {
      setPreviewDoc({ label, url: null, kind: 'loading', isObjectUrl: false })
      try {
        const blob = await companyApi.getDocument(companyId, docKey)
        const src  = URL.createObjectURL(blob)
        const kind = kindOf({ mime: blob.type, name: '' })
        setPreviewDoc({ label, url: src, kind, isObjectUrl: true })
      } catch {
        setPreviewDoc({ label, url: null, kind: 'error', isObjectUrl: false })
      }
    }
  }

  const closePreview = () => {
    if (previewDoc?.isObjectUrl) URL.revokeObjectURL(previewDoc.url)
    setPreviewDoc(null)
  }

  // Read an image source (URL or File) into a data URL + natural size
  const loadImage = (src) => new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        canvas.getContext('2d').drawImage(img, 0, 0)
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', 0.92), w: img.naturalWidth, h: img.naturalHeight })
      } catch {
        resolve(null) // tainted canvas (CORS) — fall back to raw download
      }
    }
    img.onerror = () => resolve(null)
    img.src = src
  })

  // ── DOWNLOAD: save a single document as PDF ──
  const downloadDocAsPdf = async ({ fileObj, companyId, docKey, label, docId }) => {
    const baseName = `${docId || label.replace(/\s+/g, '_')}`

    // Resolve the source into a Blob + name/mime, from a local File or the backend
    let blob = null
    let name = ''
    if (fileObj) {
      blob = fileObj
      name = fileObj.name || ''
    } else if (companyId && docKey) {
      try {
        blob = await companyApi.getDocument(companyId, docKey)
      } catch {
        return // fetch failed; nothing to download
      }
    }
    if (!blob) return

    const mime = blob.type || ''
    const kind = kindOf({ mime, name })

    // Already a PDF → download as-is with a .pdf name
    if (kind === 'pdf') {
      return downloadDocFile(blob, `${baseName}.pdf`)
    }

    // Image → wrap into a single-page PDF sized to the image
    if (kind === 'image') {
      const src = URL.createObjectURL(blob)
      const img = await loadImage(src)
      URL.revokeObjectURL(src)

      if (!img) {
        // Couldn't read pixels — fall back to raw file download
        return downloadDocFile(blob, name || `${baseName}`)
      }

      const pdf = new jsPDF({
        orientation: img.w >= img.h ? 'landscape' : 'portrait',
        unit: 'pt',
        format: [img.w, img.h],
      })
      pdf.addImage(img.dataUrl, 'JPEG', 0, 0, img.w, img.h, undefined, 'FAST')
      pdf.save(`${baseName}.pdf`)
      return
    }

    // Anything else → download the original file as-is
    return downloadDocFile(blob, name || baseName)
  }

  // Current company profile (first approved or first in list)
  const currentCompany = profileForm

  // ── Stable document preview component (avoids revoking before render) ──
  const DocCard = ({ doc, uploaded, fileObj, onDownload }) => {
    const [previewUrl, setPreviewUrl] = useState(null)
    const isImage = fileObj?.type?.startsWith('image/')
    const isPdf   = fileObj?.type === 'application/pdf'
    const ext     = fileObj ? fileObj.name.split('.').pop().toUpperCase() : 'FILE'

    useEffect(() => {
      if (!fileObj || !isImage) { setPreviewUrl(null); return }
      const url = URL.createObjectURL(fileObj)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    }, [fileObj, isImage])

    const DocSvg = () => (
      <svg viewBox="0 0 48 56" width="44" height="44" fill="none">
        <path d="M8 0h24l16 16v40H8V0z" fill={uploaded ? '#DCFCE7' : '#FEE2E2'} />
        <path d="M32 0l16 16H32V0z"     fill={uploaded ? '#86EFAC' : '#FECACA'} />
        <rect x="14" y="24" width="20" height="2" rx="1" fill={uploaded ? '#16A34A' : '#DC2626'} opacity="0.8" />
        <rect x="14" y="30" width="16" height="2" rx="1" fill={uploaded ? '#16A34A' : '#DC2626'} opacity="0.6" />
        <rect x="14" y="36" width="18" height="2" rx="1" fill={uploaded ? '#16A34A' : '#DC2626'} opacity="0.4" />
      </svg>
    )

    return (
      <div style={{
        borderRadius: 10,
        border: `1.5px solid ${uploaded ? '#BBF7D0' : '#FECACA'}`,
        overflow: 'hidden',
      }}>
        {/* Preview area */}
        <div style={{
          height: 115, position: 'relative',
          background: uploaded
            ? 'linear-gradient(135deg,#F0FDF4,#DCFCE7)'
            : 'linear-gradient(135deg,#FEF2F2,#FEE2E2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {previewUrl ? (
            <img src={previewUrl} alt={doc.label}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : uploaded ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
              <DocSvg />
              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: '0.6px',
                color: isPdf ? '#DC2626' : '#059669',
                background: '#fff', borderRadius: 4, padding: '2px 8px',
                border: `1px solid ${isPdf ? '#FECACA' : '#BBF7D0'}`,
              }}>{isPdf ? 'PDF' : ext}</span>
            </div>
          ) : (
            <div style={{ opacity: 0.35 }}><DocSvg /></div>
          )}
          {/* Status corner badge */}
          <span style={{
            position: 'absolute', top: 7, right: 7,
            width: 22, height: 22, borderRadius: '50%',
            background: uploaded ? '#059669' : '#DC2626',
            color: '#fff', fontSize: 13, fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 5px rgba(0,0,0,0.20)',
          }}>{uploaded ? '✓' : '✗'}</span>
        </div>

        {/* Info + download */}
        <div style={{ padding: '8px 10px', background: uploaded ? '#F0FDF4' : '#FFF5F5' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: uploaded ? '#059669' : '#DC2626' }}>{doc.label}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
            {uploaded
              ? <><CheckCircle style={{ width: 9, color: '#059669' }} />{fileObj ? fileObj.name : 'Uploaded'}</>
              : <><XCircle    style={{ width: 9, color: '#DC2626' }} />Not uploaded</>
            }
          </div>
          {uploaded && fileObj && (
            <button
              onClick={() => onDownload(fileObj, `${doc.key}_document`)}
              style={{
                marginTop: 7, width: '100%',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                padding: '5px 0', borderRadius: 6,
                background: '#059669', color: '#fff',
                border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700,
              }}
            >
              <Download style={{ width: 10 }} /> Download File
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="breadcrumb">
        <span>Company Management</span><span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-active">Company Registration</span>
      </div>

      {/* Page header */}
      <div className="page-header" style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div className="page-header-left">
          <div className="page-title">Company Registration</div>
          <div className="page-desc">Register, review and manage companies on the platform</div>
        </div>
        {tab !== 'register' && (
          <button className="btn btn-primary" onClick={openRegister} style={{ flexShrink: 0 }}>
            <Plus style={{ width: 15 }} /> Register Company
          </button>
        )}
      </div>

      {/* Summary stats — clickable, filter the admin table */}
      {(() => {
        const STAT_STYLES = {
          All:      { bg: '#EFF6FF', iconBg: '#DBEAFE', iconColor: '#2563EB', textColor: '#1D4ED8', borderColor: '#BFDBFE' },
          Approved: { bg: '#ECFDF5', iconBg: '#D1FAE5', iconColor: '#059669', textColor: '#047857', borderColor: '#A7F3D0' },
          Pending:  { bg: '#FFFBEB', iconBg: '#FEF3C7', iconColor: '#D97706', textColor: '#B45309', borderColor: '#FDE68A' },
          Rejected: { bg: '#FEF2F2', iconBg: '#FEE2E2', iconColor: '#DC2626', textColor: '#B91C1C', borderColor: '#FECACA' },
        }
        const stats = [
          { label: 'Total Companies',  val: allCompanies.length,                                      key: 'All' },
          { label: 'Approved',         val: allCompanies.filter(c => c.status === 'Approved').length,  key: 'Approved' },
          { label: 'Pending Approval', val: allCompanies.filter(c => c.status === 'Pending').length,   key: 'Pending' },
          { label: 'Rejected',         val: allCompanies.filter(c => c.status === 'Rejected').length,  key: 'Rejected' },
        ]
        return (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 20 }}>
            {stats.map(s => {
              const st     = STAT_STYLES[s.key]
              const active = statusFilter === s.key
              return (
                <div
                  key={s.label}
                  onClick={() => { setStatusFilter(s.key); setTab('admin') }}
                  style={{
                    background:   active ? st.iconBg  : st.bg,
                    border:       `1.5px solid ${active ? st.iconColor : st.borderColor}`,
                    borderRadius: 10,
                    padding:      '14px 16px',
                    cursor:       'pointer',
                    display:      'flex',
                    alignItems:   'center',
                    gap:          12,
                    boxShadow:    active ? `0 0 0 3px ${st.borderColor}` : 'var(--shadow)',
                    transition:   'all 0.15s',
                  }}
                >
                  <div style={{
                    width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                    background: st.iconBg,
                    border:     `1px solid ${st.borderColor}`,
                    display:    'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Building2 style={{ width: 18, height: 18, color: st.iconColor }} />
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

      {/* Tabs */}
      <div className="tabs">
        <button className="tab-btn active" onClick={() => setTab('admin')}>Admin Approval Queue</button>
      </div>

      {/* ═══════════════════════════════════════
          TAB: Company Profile
      ═══════════════════════════════════════ */}
      {tab === 'profile' && (
        <div className="page-grid-2">
          <div className="card">
            <div className="card-header">
              <span className="card-title">Company Details</span>
              {profileSaved && <span className="badge badge-green"><CheckCircle style={{ width: 11 }} /> Saved</span>}
              {!editing
                ? <button className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}><Edit2 style={{ width: 13 }} />Edit</button>
                : <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-primary btn-sm" onClick={saveProfile}><Save style={{ width: 13 }} />Save</button>
                    <button className="btn btn-secondary btn-sm" onClick={() => { setEditing(false); setProfileForm({ ...BLANK_COMPANY }) }}><X style={{ width: 13 }} />Cancel</button>
                  </div>
              }
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {editing ? (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Company Name *</label>
                      <input className="form-control" value={profileForm.name} onChange={e => setProfileForm(p => ({ ...p, name: lettersOnly(e.target.value) }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Owner Name *</label>
                      <input className="form-control" value={profileForm.owner} onChange={e => setProfileForm(p => ({ ...p, owner: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Mobile</label>
                      <input className="form-control" inputMode="numeric" maxLength={10} value={profileForm.mobile} onChange={e => setProfileForm(p => ({ ...p, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input className="form-control" value={profileForm.email} onChange={e => setProfileForm(p => ({ ...p, email: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">City</label>
                      <input className="form-control" value={profileForm.city} onChange={e => setProfileForm(p => ({ ...p, city: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">State</label>
                      <input className="form-control" value={profileForm.state} onChange={e => setProfileForm(p => ({ ...p, state: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">GST Number</label>
                      <input className="form-control" value={profileForm.gst} style={{ fontFamily: 'monospace' }} onChange={e => setProfileForm(p => ({ ...p, gst: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">PAN Number</label>
                      <input className="form-control" value={profileForm.pan} style={{ fontFamily: 'monospace' }} onChange={e => setProfileForm(p => ({ ...p, pan: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Subscription Plan</label>
                    <select className="form-control" value={profileForm.plan} onChange={e => setProfileForm(p => ({ ...p, plan: e.target.value }))}>
                      {['Free', 'Silver', 'Gold', 'Platinum'].map(pl => <option key={pl}>{pl}</option>)}
                    </select>
                  </div>
                </>
              ) : (
                [
                  { label: 'Company Name',      value: currentCompany.name },
                  { label: 'Owner',             value: currentCompany.owner },
                  { label: 'Mobile',            value: currentCompany.mobile,  icon: 'phone' },
                  { label: 'Email',             value: currentCompany.email,   icon: 'mail' },
                  { label: 'Address',           value: `${currentCompany.city}, ${currentCompany.state}`, icon: 'loc' },
                  { label: 'GST Number',        value: currentCompany.gst || '—', mono: true },
                  { label: 'PAN Number',        value: currentCompany.pan, mono: true },
                  { label: 'Subscription Plan', value: currentCompany.plan + ' Plan', badge: PLAN_COLORS[currentCompany.plan] },
                  { label: 'Status',            value: currentCompany.status, badge: statusMeta[currentCompany.status]?.color },
                  { label: 'Registered On',     value: currentCompany.registered },
                ].map(r => (
                  <div key={r.label} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ minWidth: 140, fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>{r.label}</div>
                    {r.badge
                      ? <span className={`badge ${r.badge}`}>{r.value}</span>
                      : r.icon
                        ? <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 5 }}>
                            {r.icon === 'phone' && <Phone style={{ width: 12, color: 'var(--primary)', flexShrink: 0 }} />}
                            {r.icon === 'mail'  && <Mail  style={{ width: 12, color: 'var(--primary)', flexShrink: 0 }} />}
                            {r.icon === 'loc'   && <Building2 style={{ width: 12, color: 'var(--primary)', flexShrink: 0 }} />}
                            <span>{r.value}</span>
                          </div>
                        : <div style={{ fontSize: 13, fontFamily: r.mono ? 'monospace' : undefined, fontWeight: r.mono ? 600 : 400 }}>{r.value}</div>
                    }
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Uploaded Documents */}
            <div className="card">
              <div className="card-header"><span className="card-title">Uploaded Documents</span></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[
                  { key: 'gst',     name: 'GST Certificate',      file: 'GST_TilesWorld.pdf' },
                  { key: 'pan',     name: 'PAN Card',              file: 'PAN_TilesWorld.pdf' },
                  { key: 'address', name: 'Address Proof',         file: 'Address_TilesWorld.pdf' },
                  { key: 'biz',     name: 'Business Registration', file: null },
                ].map(doc => {
                  const uploaded = currentCompany.docs?.[doc.key]
                  return (
                    <div key={doc.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <FileText style={{ width: 16, color: uploaded ? 'var(--primary)' : 'var(--text-light)' }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{doc.name}</div>
                          {doc.file && uploaded && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{doc.file}</div>}
                        </div>
                      </div>
                      {uploaded
                        ? <span className="badge badge-green"><CheckCircle style={{ width: 11 }} /> Uploaded</span>
                        : (
                          <label style={{ cursor: 'pointer' }}>
                            <span className="btn btn-secondary btn-xs"><Upload style={{ width: 11 }} />Upload</span>
                            <input type="file" style={{ display: 'none' }} onChange={e => {
                              if (e.target.files[0]) {
                                setProfileForm(p => ({ ...p, docs: { ...p.docs, [doc.key]: true } }))
                              }
                            }} />
                          </label>
                        )
                      }
                    </div>
                  )
                })}
              </div>
            </div>

            {/* OTP Verification */}
            <div className="card">
              <div className="card-header"><span className="card-title">OTP Verification</span></div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { channel: 'Mobile OTP', number: currentCompany.mobile, verified: true },
                  { channel: 'Email OTP',  number: currentCompany.email,  verified: true },
                ].map(v => (
                  <div key={v.channel} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'var(--bg)', borderRadius: 8 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{v.channel}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{v.number}</div>
                    </div>
                    <span className="badge badge-green"><CheckCircle style={{ width: 11 }} /> Verified</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          Register New Company — centered modal
      ═══════════════════════════════════════ */}
      {tab === 'register' && (
        <div className="modal-overlay" onClick={() => setTab('admin')}>
        <div className="modal" style={{ maxWidth: 720, width: '100%' }} onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <span className="modal-title"><Plus style={{ width: 15 }} /> Register New Company</span>
            <button className="btn-ghost" onClick={() => setTab('admin')}>✕</button>
          </div>
          {/* Step indicator */}
          <div style={{ padding: '20px 24px 0', display: 'flex', gap: 0 }}>
            {['Basic Info', 'Documents', 'Done'].map((s, i) => (
              <div key={s} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: '50%',
                  background: regStep > i + 1 ? 'var(--success)' : regStep === i + 1 ? 'var(--primary)' : 'var(--border)',
                  color: regStep >= i + 1 ? '#fff' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>
                  {regStep > i + 1 ? <CheckCircle style={{ width: 14 }} /> : i + 1}
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: regStep === i + 1 ? 'var(--primary)' : 'var(--text-muted)', marginLeft: 8, whiteSpace: 'nowrap' }}>{s}</div>
                {i < 2 && <div style={{ flex: 1, height: 2, background: regStep > i + 1 ? 'var(--success)' : 'var(--border)', margin: '0 10px' }} />}
              </div>
            ))}
          </div>

          {/* Step 1 — Basic Info */}
          {regStep === 1 && (
            <>
              <div className="modal-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Company Name *</label>
                    <input className="form-control" placeholder="e.g. Tiles World Pvt Ltd" value={form.name} onChange={e => setForm(p => ({ ...p, name: lettersOnly(e.target.value) }))} />
                    {formErrors.name && <div className="form-error">{formErrors.name}</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Company Type *</label>
                    <select
                      className="form-control"
                      value={form.bizType}
                      onChange={e => setForm(p => ({ ...p, bizType: e.target.value }))}
                      required
                    >
                      <option value="Wholesaler">Wholesaler</option>
                      <option value="Retailer">Retailer</option>
                    </select>
                  </div>
                </div>

                {/* Subscription Plan selection — dropdown */}
                <div className="form-group">
                  <label className="form-label">Subscription Plan *</label>
                  <select
                    className="form-control"
                    value={form.plan}
                    onChange={e => setForm(p => ({ ...p, plan: e.target.value }))}
                  >
                    {SUBSCRIPTION_PLANS.map(pl => (
                      <option key={pl.key} value={pl.key}>
                        {pl.name} — {pl.price === 0 ? 'Free' : `₹${pl.price.toLocaleString()}/mo`} · {pl.description}
                      </option>
                    ))}
                  </select>
                  {form.plan && (
                    <div style={{
                      marginTop: 8, padding: '10px 14px', borderRadius: 8,
                      background: 'var(--primary-light)',
                      border: '1px solid var(--primary)',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <Crown style={{ width: 14, color: 'var(--primary)', flexShrink: 0 }} />
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)' }}>
                          {SUBSCRIPTION_PLANS.find(p => p.key === form.plan)?.name} Plan
                        </span>
                        <span className={`badge ${SUBSCRIPTION_PLANS.find(p => p.key === form.plan)?.badge}`} style={{ marginLeft: 8, fontSize: 10 }}>
                          {SUBSCRIPTION_PLANS.find(p => p.key === form.plan)?.price === 0
                            ? 'Free'
                            : `₹${SUBSCRIPTION_PLANS.find(p => p.key === form.plan)?.price.toLocaleString()}/mo`}
                        </span>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          {SUBSCRIPTION_PLANS.find(p => p.key === form.plan)?.description}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="form-hint">You can upgrade anytime from Subscription Management.</div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Owner / Contact Name *</label>
                    <input className="form-control" placeholder="Full name" value={form.owner} onChange={e => setForm(p => ({ ...p, owner: lettersOnly(e.target.value) }))} />
                    {formErrors.owner && <div className="form-error">{formErrors.owner}</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Mobile Number *</label>
                    <input className="form-control" placeholder="10-digit mobile" type="tel" inputMode="numeric" maxLength={10} value={form.mobile} onChange={e => setForm(p => ({ ...p, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))} />
                    {formErrors.mobile && <div className="form-error">{formErrors.mobile}</div>}
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Email Address *</label>
                    <input className="form-control" placeholder="email@company.com" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                    {formErrors.email && <div className="form-error">{formErrors.email}</div>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">City</label>
                    <input className="form-control" placeholder="City" value={form.city} onChange={e => setForm(p => ({ ...p, city: lettersOnly(e.target.value) }))} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">State</label>
                    <select className="form-control" value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))}>
                      <option value="">Select State</option>
                      {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">PIN Code</label>
                    <input className="form-control" placeholder="6-digit PIN" inputMode="numeric" maxLength={6} value={form.pin} onChange={e => setForm(p => ({ ...p, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))} />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">GST Number</label>
                    <input className="form-control" placeholder="15-character GST" style={{ fontFamily: 'monospace' }} value={form.gst} onChange={e => setForm(p => ({ ...p, gst: e.target.value }))} />
                    <div className="form-hint">Leave blank if not registered.</div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">PAN Number *</label>
                    <input className="form-control" placeholder="10-character PAN" style={{ fontFamily: 'monospace' }} value={form.pan} onChange={e => setForm(p => ({ ...p, pan: e.target.value }))} />
                    {formErrors.pan && <div className="form-error">{formErrors.pan}</div>}
                  </div>
                </div>

                {/* Submitted On — date picker only */}
                <div className="form-group" style={{ marginTop: 4 }}>
                  <label className="form-label">Submitted On</label>
                  <input
                    type="date"
                    className="form-control"
                    value={form.submittedDate}
                    max={new Date().toISOString().split('T')[0]}
                    onChange={e => setForm(p => ({ ...p, submittedDate: e.target.value }))}
                    style={{ cursor: 'pointer' }}
                  />
                  {form.submittedDate && (
                    <div style={{ marginTop: 5, fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>
                      {new Date(form.submittedDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </div>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-primary" onClick={() => { if (validateStep1()) setRegStep(2) }}>Next: Upload Documents →</button>
              </div>
            </>
          )}

          {/* Step 2 — Documents */}
          {regStep === 2 && (
            <>
              <div className="modal-body">
                {[
                  { key: 'gst',     name: 'GST Certificate',      required: false, hint: 'PDF or image, max 5 MB' },
                  { key: 'pan',     name: 'PAN Card',              required: true,  hint: 'Clear scan, PDF or JPG' },
                  { key: 'address', name: 'Address Proof',         required: true,  hint: 'Electricity bill / Rent agreement / Aadhaar' },
                  { key: 'biz',     name: 'Business Registration', required: false, hint: 'Certificate of Incorporation / Trade Licence' },
                ].map(doc => (
                  <div key={doc.key} style={{ marginBottom: 14 }}>
                    <label className="form-label">
                      {doc.name} {doc.required && <span style={{ color: 'var(--danger)' }}>*</span>}
                    </label>
                    <label style={{ cursor: 'pointer' }}>
                      <div style={{
                        border: `2px dashed ${uploadedDocs[doc.key] ? 'var(--success)' : formErrors[doc.key] ? 'var(--danger)' : 'var(--border)'}`,
                        borderRadius: 8, padding: '14px 18px',
                        display: 'flex', alignItems: 'center', gap: 12,
                        background: uploadedDocs[doc.key] ? '#ECFDF5' : 'var(--bg)',
                      }}>
                        {uploadedDocs[doc.key]
                          ? <><CheckCircle style={{ width: 20, color: 'var(--success)', flexShrink: 0 }} />
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--success)' }}>Selected: {uploadedDocs[doc.key]?.name || uploadedDocs[doc.key]}</div>
                                <div className="form-hint">Click to replace</div>
                              </div>
                            </>
                          : <><Upload style={{ width: 20, color: 'var(--text-muted)', flexShrink: 0 }} />
                              <div>
                                <div style={{ fontSize: 13, fontWeight: 500 }}>Click to upload or drag file here</div>
                                <div className="form-hint">{doc.hint}</div>
                              </div>
                            </>
                        }
                      </div>
                      <input type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }} onChange={e => handleDocUpload(doc.key, e.target.files[0])} />
                    </label>
                    {formErrors[doc.key] && <div className="form-error">{formErrors[doc.key]}</div>}
                  </div>
                ))}
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setRegStep(1)}>← Back</button>
                {/* No OTP / no admin approval — submit directly once docs are uploaded. */}
                <button className="btn btn-primary" disabled={submitting} onClick={() => { if (validateStep2()) submitRegistration() }}>
                  {submitting ? 'Registering…' : createdCompanyId ? 'Retry Document Upload →' : 'Register Company →'}
                </button>
              </div>
              {submitError && <div className="form-error" style={{ padding: '0 24px 16px' }}>{submitError}</div>}
            </>
          )}

          {/* Step 3 — OTP (disabled: registration is direct, no OTP) */}
          {false && regStep === 3 && (
            <>
              <div className="modal-body">
                <div className="alert alert-info" style={{ marginBottom: 20 }}>
                  <Mail /><span>A 6-digit OTP will be sent to your registered mobile and email to verify your identity before submitting.</span>
                </div>
                {!otpSent ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ padding: '14px 16px', background: 'var(--bg)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Mail style={{ width: 15, color: 'var(--primary)' }} /><span style={{ fontSize: 13 }}>{form.email}</span></div>
                      <button className="btn btn-primary btn-sm" disabled={otpSending} onClick={() => sendOtp('email')}>
                        {otpSending ? 'Sending…' : 'Send OTP'}
                      </button>
                    </div>
                    <div style={{ padding: '14px 16px', background: 'var(--bg)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Phone style={{ width: 15, color: 'var(--primary)' }} /><span style={{ fontSize: 13 }}>+91 {form.mobile}</span></div>
                      <button className="btn btn-secondary btn-sm" disabled={otpSending} onClick={() => sendOtp('mobile')}>
                        {otpSending ? 'Sending…' : 'Send OTP'}
                      </button>
                    </div>
                    {formErrors.otp && <div className="form-error">{formErrors.otp}</div>}
                  </div>
                ) : otpVerified ? (
                  <div className="alert alert-success">
                    <CheckCircle /><span>OTP Verified Successfully! You can now submit your registration.</span>
                  </div>
                ) : (
                  <>
                    <div style={{ textAlign: 'center', marginBottom: 8, fontSize: 13, color: 'var(--text-muted)' }}>Enter the 6-digit OTP sent to {otpTarget || form.email}</div>
                    {/* SMS/email delivery isn't configured, so the OTP is shown here for verification */}
                    {devOtp && (
                      <div className="alert alert-info" style={{ textAlign: 'center', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <span style={{ fontSize: 12 }}>Your OTP (demo mode):</span>
                        <span style={{ fontSize: 24, fontWeight: 800, letterSpacing: '6px', fontFamily: 'monospace', color: 'var(--primary)' }}>{devOtp}</span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Enter this code below to continue</span>
                      </div>
                    )}
                    <div className="otp-row">
                      {otp.map((d, i) => (
                        <input key={i} id={`cotp-${i}`} className="otp-input" maxLength={1} value={d}
                          onChange={e => handleOtpChange(i, e.target.value)}
                          onKeyDown={e => { if (e.key === 'Backspace' && !d && i > 0) document.getElementById(`cotp-${i - 1}`)?.focus() }}
                        />
                      ))}
                    </div>
                    {formErrors.otp && <div className="form-error" style={{ textAlign: 'center' }}>{formErrors.otp}</div>}
                    <div style={{ textAlign: 'center', marginTop: 10, display: 'flex', justifyContent: 'center', gap: 12 }}>
                      <button onClick={verifyOtp} disabled={otpVerifying} className="btn btn-primary btn-sm">
                        {otpVerifying ? 'Verifying…' : 'Verify OTP'}
                      </button>
                      <button onClick={() => { setOtpSent(false); setOtp(['', '', '', '', '', '']); setDevOtp(''); setServerVerifiable(false); setFormErrors({}) }}
                        style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <RefreshCw style={{ width: 12 }} /> Resend
                      </button>
                    </div>
                  </>
                )}
              </div>
              {submitError && (
                <div className="form-error" style={{ textAlign: 'center', padding: '0 24px' }}>{submitError}</div>
              )}
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setRegStep(2)}>← Back</button>
                <button
                  className="btn btn-primary"
                  disabled={!otpVerified || submitting}
                  style={{ opacity: otpVerified && !submitting ? 1 : 0.5 }}
                  onClick={submitRegistration}
                >
                  {submitting ? 'Submitting…' : createdCompanyId ? 'Retry Document Upload →' : 'Submit for Approval →'}
                </button>
              </div>
            </>
          )}

          {/* Step 3 — Done (direct registration, no OTP / no admin approval) */}
          {regStep === 3 && (
            <div className="card-body" style={{ textAlign: 'center', padding: '48px 24px' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: '#ECFDF5', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <CheckCircle style={{ width: 32, color: 'var(--success)' }} />
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Company Registered!</div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)', maxWidth: 360, margin: '0 auto 24px' }}>
                Your company has been registered and activated. It now appears in the list below and is ready to use.
              </div>
              <button className="btn btn-primary" style={{ marginTop: 24 }} onClick={() => {
                setRegStep(1); setForm({ ...BLANK_FORM }); setUploadedDocs({ gst: null, pan: null, address: null, biz: null })
                setOtpSent(false); setOtpVerified(false); setOtp(['', '', '', '', '', '']); setDevOtp(''); setOtpTarget(''); setServerVerifiable(false)
                setSubmitError(''); setFormErrors({})
              }}>Register Another Company</button>
            </div>
          )}
        </div>
        </div>
      )}

      {/* ═══════════════════════════════════════
          Admin Approval Queue — always visible (list stays behind register modal)
      ═══════════════════════════════════════ */}
      {tab !== 'profile' && (
        <>
          <div className="card">
            <div className="card-header">
              <span className="card-title">Company Approval Queue ({filtered.length})</span>
              <div className="header-actions">
                {/* Refresh button */}
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={fetchApprovalQueue}
                  disabled={apiLoading}
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <RefreshCw style={{ width: 13, ...(apiLoading ? { animation: 'spin 1s linear infinite' } : {}) }} />
                  {apiLoading ? 'Loading…' : 'Refresh'}
                </button>
                {[
                  { key: 'All',      label: 'All',      bg: '#EFF6FF', color: '#2563EB', border: '#BFDBFE' },
                  { key: 'Pending',  label: 'Pending',  bg: '#FFFBEB', color: '#D97706', border: '#FDE68A' },
                  { key: 'Approved', label: 'Approved', bg: '#ECFDF5', color: '#059669', border: '#A7F3D0' },
                  { key: 'Rejected', label: 'Rejected', bg: '#FEF2F2', color: '#DC2626', border: '#FECACA' },
                ].map(s => {
                  const active = statusFilter === s.key
                  return (
                    <button
                      key={s.key}
                      onClick={() => setStatusFilter(s.key)}
                      style={{
                        padding: '5px 14px',
                        borderRadius: 20,
                        fontSize: 12,
                        fontWeight: 600,
                        border: `1.5px solid ${active ? s.color : s.border}`,
                        background: active ? s.color : s.bg,
                        color: active ? '#fff' : s.color,
                        cursor: 'pointer',
                        transition: 'all 0.13s',
                      }}
                    >{s.label} ({s.key === 'All' ? allCompanies.length : allCompanies.filter(c => c.status === s.key).length})</button>
                  )
                })}
              </div>
            </div>

            {/* API error banner */}
            {apiError && (
              <div className="alert alert-warning" style={{ margin: '12px 16px 0', display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertCircle style={{ width: 15, flexShrink: 0 }} />
                <span>{apiError} — Showing cached data.</span>
              </div>
            )}

            {/* Search bar */}
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '8px 12px',
              }}>
                <Search style={{ width: 15, color: 'var(--text-light)', flexShrink: 0 }} />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by company, ID, owner, email, mobile, GST/PAN, city…"
                  style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: 'var(--text)' }}
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    title="Clear"
                    style={{ background: 'none', border: 'none', color: 'var(--text-light)', cursor: 'pointer', display: 'flex' }}
                  >
                    <X style={{ width: 14 }} />
                  </button>
                )}
              </div>
              {search && (
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>
                  Showing {filtered.length} of {allCompanies.length} companies
                </div>
              )}
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th style={{ width: 90 }}>ID</th>
                    <th style={{ width: 120 }}>Unique Code</th>
                    <th>Company</th>
                    <th>Owner &amp; Contact</th>
                    <th>Business Type</th>
                    <th>GST / PAN</th>
                    <th>Documents</th>
                    <th>Submitted</th>
                    <th>Status</th>
                    <th className="col-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {apiLoading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={10}>
                        <div className="table-empty">
                          <div className="table-empty-icon">
                            <RefreshCw style={{ width: 20, animation: 'spin 1s linear infinite' }} />
                          </div>
                          Loading companies…
                        </div>
                      </td>
                    </tr>
                  )}

                  {!apiLoading && filtered.length === 0 && (
                    <tr>
                      <td colSpan={10}>
                        <div className="table-empty">
                          <div className="table-empty-icon">
                            <Building2 style={{ width: 20 }} />
                          </div>
                          <div style={{ fontWeight: 600, color: 'var(--text)' }}>No companies found</div>
                          <div style={{ marginTop: 3 }}>
                            {search
                              ? 'No companies match your search.'
                              : statusFilter === 'All'
                                ? 'No companies have registered yet.'
                                : `No ${statusFilter.toLowerCase()} companies.`}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}

                  {filtered.map(c => (
                    <tr key={c.id}>
                      {/* ID */}
                      <td>
                        <span style={{
                          display: 'inline-block',
                          color: 'var(--primary)', fontWeight: 800, fontSize: 12,
                          fontFamily: 'monospace', letterSpacing: '0.3px', whiteSpace: 'nowrap',
                        }}>{c.id}</span>
                      </td>

                      {/* Unique Code */}
                      <td>
                        {c.code && c.code !== '—' ? (
                          <span style={{
                            display: 'inline-block',
                            background: '#FFF3EC', color: '#F26522',
                            fontWeight: 800, fontSize: 12, fontFamily: 'monospace',
                            letterSpacing: '0.5px', padding: '3px 9px', borderRadius: 6,
                            whiteSpace: 'nowrap',
                          }}>{c.code}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                        )}
                      </td>

                      {/* Company */}
                      <td>
                        <div className="user-info">
                          <div className="avatar avatar-blue">{c.name.charAt(0)}</div>
                          <div style={{ minWidth: 0 }}>
                            <div className="user-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{c.name}</div>
                            <div className="user-role">{c.city}, {c.state}</div>
                          </div>
                        </div>
                      </td>

                      {/* Owner & Contact — merged for a cleaner, less crowded table */}
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{c.owner}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          <Phone style={{ width: 11, color: 'var(--primary)', flexShrink: 0 }} />
                          {c.mobile}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          <Mail style={{ width: 11, color: 'var(--primary)', flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{c.email}</span>
                        </div>
                      </td>

                      {/* Business Type */}
                      <td>
                        <span style={{
                          fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
                          background: 'var(--bg)', border: '1px solid var(--border)',
                          color: 'var(--text-muted)', whiteSpace: 'nowrap',
                        }}>{c.bizType || '—'}</span>
                      </td>

                      {/* GST / PAN — merged, stacked and labelled */}
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
                          <span style={{ color: 'var(--text-light)', fontWeight: 700, width: 28, display: 'inline-block' }}>GST</span>
                          {c.gst
                            ? <span style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{c.gst}</span>
                            : <span style={{ color: 'var(--text-light)' }}>Not Registered</span>
                          }
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, marginTop: 3 }}>
                          <span style={{ color: 'var(--text-light)', fontWeight: 700, width: 28, display: 'inline-block' }}>PAN</span>
                          <span style={{ color: 'var(--text)', fontFamily: 'monospace', fontWeight: 600 }}>{c.pan}</span>
                        </div>
                      </td>

                      {/* Documents — clean count badge + visual dots only (no text labels) */}
                      <td>
                        {(() => {
                          const keys = ['gst','pan','address','biz']
                          const cnt = keys.filter(k => c.docs?.[k]).length
                          const total = keys.length
                          const firstDocKey = keys.find(k => c.docs?.[k] && c.docUrls?.[k])
                          const docLabels = { gst: 'GST Certificate', pan: 'PAN Card', address: 'Address Proof', biz: 'Business Registration' }
                          const canViewDocument = !!(firstDocKey && c._id)

                          const badgeColor =
                            cnt === 0 ? '#DC2626' :
                            cnt === total ? '#059669' : '#D97706'
                          const badgeBg =
                            cnt === 0 ? '#FEF2F2' :
                            cnt === total ? '#ECFDF5' : '#FFFBEB'
                          const badgeBorder =
                            cnt === 0 ? '#FECACA' :
                            cnt === total ? '#A7F3D0' : '#FDE68A'

                          return (
                            <div style={{
                              display: 'flex', alignItems: 'center', gap: 8,
                              cursor: canViewDocument ? 'pointer' : 'default',
                            }} title={`${cnt}/${total} documents uploaded`}>
                              {/* Count badge */}
                              <span style={{
                                fontSize: 12, fontWeight: 700,
                                color: badgeColor,
                                background: badgeBg,
                                border: `1px solid ${badgeBorder}`,
                                borderRadius: 999,
                                padding: '3px 10px',
                                whiteSpace: 'nowrap',
                              }}>
                                {cnt}/{total}
                              </span>
                              {/* 4 visual dots */}
                              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                {keys.map(k => {
                                  const detail = c.documentDetails?.[k]
                                  const uploaded = !!detail?.submitted
                                  const stateColor = detail?.status === 'Approved'
                                    ? '#059669'
                                    : detail?.status === 'Rejected'
                                      ? '#DC2626'
                                      : uploaded ? '#D97706' : '#E5E7EB'
                                  return (
                                    <div
                                      key={k}
                                      title={`${docLabels[k]}: ${detail?.status || 'NotSubmitted'}`}
                                      style={{
                                        width: 10,
                                        height: 10,
                                        borderRadius: '50%',
                                        background: stateColor,
                                        boxShadow: uploaded ? `0 0 0 2px ${badgeBg}` : 'none',
                                        transition: 'all 0.15s',
                                      }}
                                    />
                                  )
                                })}
                              </div>
                              {/* Eye icon — securely opens the first uploaded document */}
                              {canViewDocument && (
                                <Eye
                                  style={{ width: 14, height: 14, color: '#6366F1', flexShrink: 0 }}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    viewDocument({ companyId: c._id, docKey: firstDocKey, label: docLabels[firstDocKey] })
                                  }}
                                />
                              )}
                            </div>
                          )
                        })()}
                      </td>

                      {/* Submitted — date + reviewer */}
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: 12, color: 'var(--text)' }}>{c.registered}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                          by {c.reviewedBy || '—'}
                        </div>
                      </td>

                      {/* Status */}
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            {statusMeta[c.status]?.icon}
                            <span className={`badge ${statusMeta[c.status]?.color}`}>{c.status}</span>
                          </div>
                          {c.rejectReason && (
                            <div style={{ fontSize: 10, color: 'var(--danger)' }}>↳ {c.rejectReason}</div>
                          )}
                        </div>
                      </td>

                      {/* Actions — right-aligned, icons only */}
                      <td className="col-right">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'nowrap', justifyContent: 'flex-end' }}>
                          {/* View */}
                          <button
                            title="View Details"
                            className="btn btn-secondary btn-xs"
                            style={{ padding: '4px 7px', minWidth: 0 }}
                            onClick={() => setViewCompany(c)}
                          ><Eye style={{ width: 13 }} /></button>

                          {/* Download */}
                          <button
                            title="Download Report"
                            className="btn btn-secondary btn-xs"
                            style={{ padding: '4px 7px', minWidth: 0, color: '#059669', borderColor: '#BBF7D0' }}
                            onClick={() => downloadCompany(c)}
                          ><Download style={{ width: 13 }} /></button>

                          {/* Delete */}
                          <button
                            title="Delete"
                            className="btn btn-danger btn-xs"
                            style={{ padding: '4px 7px', minWidth: 0 }}
                            onClick={() => setShowDeleteConfirm(c.id)}
                          ><Trash2 style={{ width: 13 }} /></button>

                          {/* Approve */}
                          {c.status === 'Pending' && (
                            <button
                              title="Approve"
                              className="btn btn-success btn-xs"
                              style={{ padding: '4px 7px', minWidth: 0 }}
                              onClick={() => approveCompany(c.id)}
                            ><CheckCircle style={{ width: 13 }} /></button>
                          )}

                          {/* Reject */}
                          {c.status === 'Pending' && (
                            <button
                              title="Reject"
                              className="btn btn-danger btn-xs"
                              style={{ padding: '4px 7px', minWidth: 0 }}
                              onClick={() => setShowRejectModal(c.id)}
                            ><XCircle style={{ width: 13 }} /></button>
                          )}

                          {/* Re-Approve */}
                          {c.status === 'Rejected' && (
                            <button
                              title="Re-Approve"
                              className="btn btn-secondary btn-xs"
                              style={{ padding: '4px 7px', minWidth: 0, color: '#059669', borderColor: '#BBF7D0' }}
                              onClick={() => approveCompany(c.id)}
                            ><RefreshCw style={{ width: 13 }} /></button>
                          )}

                          {/* Suspend — approved company; instantly blocks app access */}
                          {c.status === 'Approved' && (
                            <button
                              title="Suspend"
                              className="btn btn-danger btn-xs"
                              style={{ padding: '4px 7px', minWidth: 0 }}
                              onClick={() => setShowSuspendModal(c.id)}
                            ><Ban style={{ width: 13 }} /></button>
                          )}

                          {/* Reactivate — suspended company */}
                          {c.status === 'Suspended' && (
                            <button
                              title="Reactivate"
                              className="btn btn-success btn-xs"
                              style={{ padding: '4px 7px', minWidth: 0 }}
                              onClick={() => reactivateCompany(c.id)}
                            ><RotateCcw style={{ width: 13 }} /></button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* View Company Modal */}
          {viewCompany && (
            <div className="modal-overlay" onClick={() => setViewCompany(null)}>
              <div className="modal company-view-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header company-view-header">
                  <div className="company-view-title-block">
                    <span className="modal-title">Company Details</span>
                    <span className="company-view-subtitle">{viewCompany.name} <span aria-hidden="true">·</span> {viewCompany.id}</span>
                  </div>
                  <button className="btn-ghost" onClick={() => setViewCompany(null)}>✕</button>
                </div>
                <div className="modal-body company-view-body">
                  {/* Company Info Grid */}
                  <div className="company-view-info-grid">
                    {[
                      { label: 'Unique Code',   value: viewCompany.code || '—', mono: true },
                      { label: 'Company Name',  value: viewCompany.name },
                      { label: 'Owner',         value: viewCompany.owner },
                      { label: 'Business Type', value: viewCompany.bizType || '—' },
                      { label: 'Mobile',        value: viewCompany.mobile },
                      { label: 'Email',         value: viewCompany.email },
                      { label: 'City',          value: [viewCompany.city, viewCompany.state].filter(Boolean).join(', ') || '—' },
                      { label: 'PIN Code',      value: viewCompany.pin || '—' },
                      { label: 'GST Number',    value: viewCompany.gst || '— (Not registered)', mono: true },
                      { label: 'PAN Number',    value: viewCompany.pan || '—', mono: true },
                      { label: 'Registered',    value: viewCompany.registered },
                      { label: 'Status',        value: viewCompany.status, badge: statusMeta[viewCompany.status]?.color },
                    ].map(r => (
                      <div className="company-view-field" key={r.label}>
                        <div className="company-view-field-label">{r.label}</div>
                        {r.badge
                          ? <span className={`badge ${r.badge}`}>{r.value}</span>
                          : r.label === 'Email'
                            ? <div className="company-view-field-value company-view-contact">
                                <Mail style={{ width: 12, color: 'var(--primary)', flexShrink: 0 }} />
                                <span>{r.value}</span>
                              </div>
                            : r.label === 'Mobile'
                              ? <div className="company-view-field-value company-view-contact">
                                  <Phone style={{ width: 12, color: 'var(--primary)', flexShrink: 0 }} />
                                  <span>{r.value}</span>
                                </div>
                              : r.label === 'Business Type'
                                ? <span className="company-view-type-pill">{r.value}</span>
                                : <div className={`company-view-field-value${r.mono ? ' is-mono' : ''}`}>{r.value}</div>
                        }
                      </div>
                    ))}
                  </div>

                  <div className="company-view-divider" />

                  {/* Plan — inline editable */}
                  <div className="company-view-section">
                    <div className="company-view-section-heading">Subscription Plan</div>
                    <div className="company-view-plan-card">
                      <div className="company-view-plan-current">
                        <Crown style={{ width: 15, color: 'var(--primary)', flexShrink: 0 }} />
                        <span className={`badge ${PLAN_COLORS[viewCompany.plan]}`} style={{ fontSize: 12 }}>
                          {viewCompany.plan} Plan
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {SUBSCRIPTION_PLANS.find(p => p.key === viewCompany.plan)?.price === 0
                            ? 'Free'
                            : `₹${SUBSCRIPTION_PLANS.find(p => p.key === viewCompany.plan)?.price.toLocaleString()}/mo`}
                        </span>
                      </div>
                      <div className="company-view-plan-description">
                        {SUBSCRIPTION_PLANS.find(p => p.key === viewCompany.plan)?.description}
                      </div>
                      <div className="company-view-plan-select-row">
                        <label>Change Plan</label>
                        <select
                          className="form-control"
                          style={{ flex: 1, minWidth: 0, fontSize: 12 }}
                          value={viewCompany.plan}
                          onChange={e => {
                            const newPlan = e.target.value
                            setCompanies(prev => prev.map(co => co.id === viewCompany.id ? { ...co, plan: newPlan } : co))
                            setViewCompany(prev => ({ ...prev, plan: newPlan }))
                          }}
                        >
                          {SUBSCRIPTION_PLANS.map(pl => (
                            <option key={pl.key} value={pl.key}>
                              {pl.name} — {pl.price > 0 ? `₹${pl.price.toLocaleString()}/mo` : 'Free'} · {pl.description}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="company-view-divider" />

                  {/* Documents status with image preview + backend URL links */}
                  <div>
                    <div className="company-view-doc-heading">
                      <div className="company-view-section-heading">Uploaded Documents</div>
                      {(() => {
                        const keys = ['gst','pan','address','biz']
                        const cnt = keys.filter(k => viewCompany.docs?.[k]).length
                        return (
                          <span style={{
                            fontSize: 11, fontWeight: 700,
                            color: cnt === 4 ? '#059669' : cnt === 0 ? '#DC2626' : '#D97706',
                          }}>{cnt}/4 Uploaded</span>
                        )
                      })()}
                    </div>
                    <div className="company-view-doc-grid">
                      {[
                        { key: 'gst',     label: 'GST Certificate' },
                        { key: 'pan',     label: 'PAN Card' },
                        { key: 'address', label: 'Address Proof' },
                        { key: 'biz',     label: 'Business Registration' },
                      ].map(doc => {
                        const detail = viewCompany.documentDetails?.[doc.key] || {}
                        const uploaded = !!detail.submitted
                        const fileObj = viewCompany.docFiles?.[doc.key] || null
                        // A document exists on the backend for this company
                        const hasBackendDoc = !!viewCompany.docUrls?.[doc.key]
                        const companyDbId = viewCompany._id
                        const canOpen = uploaded && (fileObj || hasBackendDoc)
                        const documentStatus = detail.status || (uploaded ? 'Pending' : 'NotSubmitted')
                        const statusColor = documentStatus === 'Approved'
                          ? '#059669'
                          : documentStatus === 'Rejected'
                            ? '#DC2626'
                            : documentStatus === 'Pending' ? '#D97706' : '#6B7280'
                        const statusBackground = documentStatus === 'Approved'
                          ? '#ECFDF5'
                          : documentStatus === 'Rejected'
                            ? '#FEF2F2'
                            : documentStatus === 'Pending' ? '#FFFBEB' : '#F3F4F6'

                        return (
                          <div key={doc.key} className="company-view-doc-card" style={{
                            border: `1.5px solid ${uploaded ? '#BBF7D0' : '#FECACA'}`,
                            borderRadius: 10, overflow: 'hidden',
                          }}>
                            {/* Preview area */}
                            <div className="company-view-doc-preview" style={{
                              height: 90,
                              background: uploaded ? 'linear-gradient(135deg,#F0FDF4,#DCFCE7)' : 'linear-gradient(135deg,#FEF2F2,#FEE2E2)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              position: 'relative',
                            }}>
                              {canOpen ? (
                                <button
                                  onClick={() => viewDocument({ fileObj, companyId: companyDbId, docKey: doc.key, label: doc.label })}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                  <FileText style={{ width: 28, color: '#059669' }} />
                                  <span style={{ fontSize: 9, fontWeight: 700, color: '#059669', background: '#fff', borderRadius: 4, padding: '2px 6px', border: '1px solid #BBF7D0' }}>
                                    VIEW ↗
                                  </span>
                                </button>
                              ) : uploaded ? (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                                  <FileText style={{ width: 28, color: '#059669' }} />
                                  <span style={{ fontSize: 9, fontWeight: 700, color: '#059669' }}>UPLOADED</span>
                                </div>
                              ) : (
                                <div style={{ opacity: 0.3 }}>
                                  <FileText style={{ width: 28, color: '#DC2626' }} />
                                </div>
                              )}
                              <span style={{
                                position: 'absolute', top: 6, right: 6,
                                width: 20, height: 20, borderRadius: '50%',
                                background: uploaded ? '#059669' : '#DC2626',
                                color: '#fff', fontSize: 11, fontWeight: 900,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}>{uploaded ? '✓' : '✗'}</span>
                            </div>
                            {/* Label + View / Download buttons */}
                            <div className="company-view-doc-info" style={{ background: uploaded ? '#F0FDF4' : '#FFF5F5' }}>
                              <div style={{ fontSize: 11, fontWeight: 700, color: uploaded ? '#059669' : '#DC2626', marginBottom: 3 }}>{doc.label}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center',
                                  padding: '2px 7px', borderRadius: 999,
                                  background: statusBackground, color: statusColor,
                                  border: `1px solid ${statusColor}33`,
                                  fontSize: 9, fontWeight: 800,
                                }}>
                                  {documentStatus === 'NotSubmitted' ? 'NOT UPLOADED' : documentStatus.toUpperCase()}
                                </span>
                                {detail.uploadedAt && (
                                  <span style={{ fontSize: 9, color: 'var(--text-light)' }}>
                                    {new Date(detail.uploadedAt).toLocaleDateString('en-IN')}
                                  </span>
                                )}
                              </div>
                              {documentStatus === 'Rejected' && detail.rejectReason && (
                                <div style={{ marginTop: 4, fontSize: 9.5, lineHeight: 1.35, color: '#B91C1C' }}>
                                  Reason: {detail.rejectReason}
                                </div>
                              )}
                              {canOpen && (
                                <div style={{ display: 'flex', gap: 6, marginTop: 7 }}>
                                  {/* View — open in-app preview */}
                                  <button
                                    onClick={() => viewDocument({ fileObj, companyId: companyDbId, docKey: doc.key, label: doc.label })}
                                    style={{
                                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                                      padding: '5px 0', borderRadius: 6,
                                      background: '#fff', color: '#0F766E',
                                      border: '1.5px solid #99F6E4',
                                      cursor: 'pointer', fontSize: 10, fontWeight: 700,
                                    }}>
                                    <Eye style={{ width: 12 }} /> View
                                  </button>
                                  {/* Download — save as PDF */}
                                  <button
                                    onClick={() => downloadDocAsPdf({ fileObj, companyId: companyDbId, docKey: doc.key, label: doc.label, docId: `${viewCompany.id}_${doc.key}` })}
                                    style={{
                                      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                                      padding: '5px 0', borderRadius: 6,
                                      background: '#059669', color: '#fff', border: 'none',
                                      cursor: 'pointer', fontSize: 10, fontWeight: 700,
                                    }}>
                                    <Download style={{ width: 12 }} /> PDF
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
                <div className="modal-footer company-view-footer">
                  {viewCompany.status === 'Approved' && Object.values(viewCompany.documentDetails || {}).some(doc => doc.status === 'Pending') && (
                    <button className="btn btn-success btn-sm" onClick={() => approveDocuments(viewCompany)}>
                      <CheckCircle style={{ width: 13 }} />Approve Updated Documents
                    </button>
                  )}
                  {viewCompany.status === 'Pending' && (
                    <>
                      <button className="btn btn-success btn-sm" onClick={() => { approveCompany(viewCompany.id); setViewCompany(null) }}>
                        <CheckCircle style={{ width: 13 }} />Approve
                      </button>
                      <button className="btn btn-danger btn-sm" onClick={() => { setShowRejectModal(viewCompany.id); setViewCompany(null) }}>
                        <XCircle style={{ width: 13 }} />Reject
                      </button>
                    </>
                  )}
                  {viewCompany.status === 'Rejected' && (
                    <button className="btn btn-secondary btn-sm" onClick={() => { approveCompany(viewCompany.id); setViewCompany(null) }}>
                      <RefreshCw style={{ width: 13 }} />Re-Approve
                    </button>
                  )}
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ color: '#059669', borderColor: '#BBF7D0' }}
                    onClick={() => downloadCompany(viewCompany)}
                  >
                    <Download style={{ width: 13 }} />Download Report
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setViewCompany(null)}>Close</button>
                </div>
              </div>
            </div>
          )}

          {/* ── Document Preview Modal (in-app view) ── */}
          {previewDoc && (
            <div
              className="modal-overlay"
              style={{ zIndex: 1200, padding: 24 }}
              onClick={closePreview}
            >
              <div
                onClick={e => e.stopPropagation()}
                style={{
                  background: '#fff', borderRadius: 12, overflow: 'hidden',
                  width: 'min(920px, 96vw)', height: 'min(88vh, 900px)',
                  display: 'flex', flexDirection: 'column',
                  boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
                }}
              >
                {/* Header */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <FileText style={{ width: 16, color: 'var(--primary)', flexShrink: 0 }} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {previewDoc.label}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {previewDoc.url && (
                      <a
                        href={previewDoc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-secondary btn-sm"
                        style={{ textDecoration: 'none' }}
                      >
                        Open in new tab ↗
                      </a>
                    )}
                    <button className="btn btn-secondary btn-sm" onClick={closePreview}>
                      <X style={{ width: 14 }} /> Close
                    </button>
                  </div>
                </div>

                {/* Body — preview area */}
                <div style={{
                  flex: 1, minHeight: 0, background: '#F1F5F9',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto',
                }}>
                  {previewDoc.kind === 'loading' && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                      <RefreshCw style={{ width: 26, color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
                      <div style={{ marginTop: 10, fontSize: 13 }}>Loading document…</div>
                    </div>
                  )}
                  {previewDoc.kind === 'error' && (
                    <div style={{ textAlign: 'center', color: 'var(--danger)', padding: 24 }}>
                      <AlertCircle style={{ width: 40 }} />
                      <div style={{ marginTop: 10, fontSize: 13, fontWeight: 600 }}>Couldn’t load this document.</div>
                      <div style={{ marginTop: 4, fontSize: 12, color: 'var(--text-muted)' }}>
                        The file may be missing on the server, or the backend isn’t reachable.
                      </div>
                    </div>
                  )}
                  {previewDoc.kind === 'image' && (
                    <img
                      src={previewDoc.url}
                      alt={previewDoc.label}
                      style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', display: 'block' }}
                    />
                  )}
                  {previewDoc.kind === 'pdf' && (
                    <iframe
                      title={previewDoc.label}
                      src={previewDoc.url}
                      style={{ width: '100%', height: '100%', border: 'none' }}
                    />
                  )}
                  {previewDoc.kind === 'other' && (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 24 }}>
                      <FileText style={{ width: 40, color: 'var(--text-light)' }} />
                      <div style={{ marginTop: 10, fontSize: 13 }}>
                        This file type can’t be previewed inline.
                      </div>
                      <a
                        href={previewDoc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: 12, textDecoration: 'none', display: 'inline-flex' }}
                      >
                        Open in new tab ↗
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Reject Reason Modal */}
          {showRejectModal && (
            <div className="modal-overlay" onClick={() => setShowRejectModal(null)}>
              <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <span className="modal-title">Reject Company</span>
                  <button className="modal-close" onClick={() => setShowRejectModal(null)}><X /></button>
                </div>
                <div className="modal-body">
                  <div className="form-group">
                    <label className="form-label">Rejection Reason *</label>
                    <textarea className="form-control" rows={3} placeholder="Enter reason for rejection..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowRejectModal(null)}>Cancel</button>
                  <button className="btn btn-danger btn-sm" disabled={!rejectReason.trim()} style={{ opacity: rejectReason.trim() ? 1 : 0.5 }}
                    onClick={() => rejectCompany(showRejectModal, rejectReason)}>
                    <XCircle style={{ width: 13 }} />Confirm Reject
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Suspend Reason Modal */}
          {showSuspendModal && (
            <div className="modal-overlay" onClick={() => setShowSuspendModal(null)}>
              <div className="modal" style={{ maxWidth: 400 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <span className="modal-title">Suspend Company</span>
                  <button className="modal-close" onClick={() => setShowSuspendModal(null)}><X /></button>
                </div>
                <div className="modal-body">
                  <div className="alert alert-warning" style={{ marginBottom: 12 }}>
                    <AlertCircle style={{ width: 15 }} /><span>The wholesaler will lose app access immediately.</span>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Suspension Reason</label>
                    <textarea className="form-control" rows={3} placeholder="Reason (shown to the wholesaler)…" value={suspendReason} onChange={e => setSuspendReason(e.target.value)} />
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowSuspendModal(null)}>Cancel</button>
                  <button className="btn btn-danger btn-sm" onClick={() => suspendCompany(showSuspendModal, suspendReason)}>
                    <Ban style={{ width: 13 }} />Confirm Suspend
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── Edit Company Modal ── */}
          {editCompany && (
            <div className="modal-overlay" onClick={() => setEditCompany(null)}>
              <div className="modal" style={{ maxWidth: 580 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <span className="modal-title"><Pencil style={{ width: 15 }} /> Edit Company — {editCompany.id}</span>
                  <button className="btn-ghost" onClick={() => setEditCompany(null)}>✕</button>
                </div>
                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Company Name *</label>
                      <input className="form-control" value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: lettersOnly(e.target.value) }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Business Type <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
                      <input
                        className="form-control"
                        placeholder="e.g. Wholesaler, Retailer, Manufacturer…"
                        value={editForm.bizType || ''}
                        onChange={e => setEditForm(p => ({ ...p, bizType: lettersOnly(e.target.value) }))}
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Owner Name *</label>
                      <input className="form-control" value={editForm.owner} onChange={e => setEditForm(p => ({ ...p, owner: lettersOnly(e.target.value) }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Mobile</label>
                      <input className="form-control" inputMode="numeric" maxLength={10} value={editForm.mobile} onChange={e => setEditForm(p => ({ ...p, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) }))} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input className="form-control" type="email" value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">City</label>
                      <input className="form-control" value={editForm.city} onChange={e => setEditForm(p => ({ ...p, city: lettersOnly(e.target.value) }))} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">State</label>
                      <select className="form-control" value={editForm.state} onChange={e => setEditForm(p => ({ ...p, state: e.target.value }))}>
                        <option value="">Select State</option>
                        {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">PIN Code</label>
                      <input className="form-control" inputMode="numeric" maxLength={6} value={editForm.pin} onChange={e => setEditForm(p => ({ ...p, pin: e.target.value.replace(/\D/g, '').slice(0, 6) }))} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">GST Number</label>
                      <input className="form-control" style={{ fontFamily: 'monospace' }} value={editForm.gst} onChange={e => setEditForm(p => ({ ...p, gst: e.target.value }))} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">PAN Number</label>
                      <input className="form-control" style={{ fontFamily: 'monospace' }} value={editForm.pan} onChange={e => setEditForm(p => ({ ...p, pan: e.target.value }))} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Subscription Plan</label>
                      <select className="form-control" value={editForm.plan} onChange={e => setEditForm(p => ({ ...p, plan: e.target.value }))}>
                        {SUBSCRIPTION_PLANS.map(pl => (
                          <option key={pl.key} value={pl.key}>{pl.name} — {pl.price > 0 ? `₹${pl.price.toLocaleString()}/mo` : 'Free'}</option>
                        ))}
                      </select>
                    </div>
                    <div className="form-group">
                      <label className="form-label">Status</label>
                      <select className="form-control" value={editForm.status} onChange={e => setEditForm(p => ({ ...p, status: e.target.value }))}>
                        <option value="Pending">⏳ Pending</option>
                        <option value="Approved">✅ Approved</option>
                        <option value="Rejected">❌ Rejected</option>
                      </select>
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Reviewed By</label>
                    <input className="form-control" value={editForm.reviewedBy || ''} onChange={e => setEditForm(p => ({ ...p, reviewedBy: e.target.value }))} placeholder="Admin name" />
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary btn-sm" onClick={() => setEditCompany(null)}><X style={{ width: 13 }} /> Cancel</button>
                  <button className="btn btn-primary btn-sm" onClick={saveEdit}><Save style={{ width: 13 }} /> Save Changes</button>
                </div>
              </div>
            </div>
          )}

          {/* ── Delete Confirm Modal ── */}
          {showDeleteConfirm && (
            <div className="modal-overlay" onClick={() => setShowDeleteConfirm(null)}>
              <div className="modal" style={{ maxWidth: 380 }} onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <span className="modal-title" style={{ color: 'var(--danger)' }}><Trash2 style={{ width: 15 }} /> Delete Company</span>
                  <button className="btn-ghost" onClick={() => setShowDeleteConfirm(null)}>✕</button>
                </div>
                <div className="modal-body">
                  <div style={{
                    padding: '14px 16px', borderRadius: 10,
                    background: '#FEF2F2', border: '1px solid #FECACA',
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                  }}>
                    <Trash2 style={{ width: 20, color: '#DC2626', flexShrink: 0, marginTop: 2 }} />
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#DC2626', marginBottom: 4 }}>Are you sure?</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                        This will permanently delete <strong>{companies.find(c => c.id === showDeleteConfirm)?.name}</strong> ({showDeleteConfirm}) from the system. This action cannot be undone.
                      </div>
                    </div>
                  </div>
                </div>
                <div className="modal-footer">
                  <button className="btn btn-secondary btn-sm" onClick={() => setShowDeleteConfirm(null)}>Cancel</button>
                  <button className="btn btn-danger btn-sm" onClick={() => deleteCompany(showDeleteConfirm)}>
                    <Trash2 style={{ width: 13 }} /> Yes, Delete
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </>
  )
}
