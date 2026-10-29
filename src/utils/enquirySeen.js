/**
 * utils/enquirySeen.js
 *
 * Device-local "last seen" tracker for enquiries — web twin of the retailer /
 * wholesaler apps' AsyncStorage version, using localStorage.
 *
 * The backend does not track per-user read state, so to show a green "new
 * activity" dot on the Sent tab we remember — in THIS browser — the
 * `updated_at` we had already seen for each enquiry. When the list later shows
 * an enquiry whose `updated_at` is NEWER than what we stored, something changed
 * since we last opened it (a reply, a message, a cancel, a status move — all of
 * those bump `updated_at`), so we flag it.
 *
 * Storage shape: a single JSON object keyed by enquiry id →
 *   { "<enquiryId>": "<ISO updated_at we last saw>" }
 */

const KEY = 'crm_enquiry_seen'

function readMap() {
  try {
    const raw = localStorage.getItem(KEY)
    const map = raw ? JSON.parse(raw) : {}
    return map && typeof map === 'object' ? map : {}
  } catch {
    return {}
  }
}

function writeMap(map) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    /* non-fatal — the dot is a convenience, not critical state */
  }
}

const TOLERANCE_MS = 2000

export const enquirySeen = {
  /** Return the whole { id: lastSeenISO } map. */
  getAll: readMap,

  /**
   * Mark an enquiry (and, for a grouped broadcast, all its sibling ids) as seen
   * at a given timestamp. Pass the group's member ids via `extraIds` so opening
   * one broadcast clears the dot even though the list keys off the first id.
   */
  markSeen(enquiryId, updatedAt, extraIds = []) {
    if (!enquiryId && (!extraIds || extraIds.length === 0)) return
    const map = readMap()
    const stamp = updatedAt || new Date().toISOString()
    const ids = [enquiryId, ...(Array.isArray(extraIds) ? extraIds : [])].filter(Boolean)
    for (const id of ids) map[String(id)] = stamp
    writeMap(map)
  },

  /**
   * Has `enquiry` changed since we last saw it?
   *   • never seen before  → NEW only if it already carries activity
   *   • seen before        → NEW if its `updated_at` is newer (past a small
   *                          tolerance that absorbs sub-second rounding)
   */
  isNew(enquiry, seenMap) {
    if (!enquiry) return false
    const id = String(enquiry._id || enquiry.id || '')
    if (!id) return false
    const seenISO = seenMap?.[id]
    const updatedISO = enquiry.updated_at || enquiry.updatedAt || enquiry.created_at
    if (!updatedISO) return false

    if (!seenISO) return hasActivity(enquiry)
    return new Date(updatedISO).getTime() > new Date(seenISO).getTime() + TOLERANCE_MS
  },
}

// Any signal that a counterparty acted: a reply/negotiation/confirm/cancel
// status, a quoted price, or an availability figure.
function hasActivity(e) {
  return ['Replied', 'Confirmed', 'Cancelled'].includes(e.status)
    || !!String(e.distributor_reply || '').trim()
    || e.offered_price != null
    || e.available_quantity != null
}

export default enquirySeen
