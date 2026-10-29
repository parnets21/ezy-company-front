/**
 * stoneApi.js — Stone measurement "My Sheets" persistence.
 *
 * Stored locally in the browser (localStorage), scoped to the logged-in user,
 * so the Tools calculator works fully offline / without any backend endpoint.
 *
 * A "sheet" shape:
 * {
 *   id: string,
 *   product: 'granite' | 'marble' | 'block' | 'italian',
 *   name: string,          // e.g. "Kajria"
 *   party: string,         // customer / party name
 *   date: string,          // ISO date (yyyy-mm-dd)
 *   inputUnit: string,     // 'inch'
 *   outputUnit: string,    // 'feet'
 *   rows: [{ length, width }],
 *   total: number,         // sum area in outputUnit²
 *   createdAt: string,
 *   updatedAt: string,
 * }
 */

const KEY = 'ezy-stone-sheets'

function currentUserId() {
  try {
    const u = JSON.parse(localStorage.getItem('user') || '{}')
    return u?.id || u?._id || u?.email || 'guest'
  } catch {
    return 'guest'
  }
}

function readAll() {
  try {
    const map = JSON.parse(localStorage.getItem(KEY) || '{}')
    return map[currentUserId()] || []
  } catch {
    return []
  }
}

function writeAll(list) {
  let map = {}
  try { map = JSON.parse(localStorage.getItem(KEY) || '{}') } catch { map = {} }
  map[currentUserId()] = list
  localStorage.setItem(KEY, JSON.stringify(map))
}

const uid = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

export const stoneApi = {
  /** All sheets for the current user, newest first. */
  list() {
    return readAll().sort(
      (a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0),
    )
  },

  /** One sheet by id. */
  get(id) {
    return readAll().find(s => s.id === id) || null
  },

  /** Create a new sheet, returns the saved record. */
  create(data) {
    const now = new Date().toISOString()
    const sheet = { id: uid(), createdAt: now, updatedAt: now, ...data }
    const list = readAll()
    list.push(sheet)
    writeAll(list)
    return sheet
  },

  /** Update an existing sheet. */
  update(id, data) {
    const list = readAll()
    const i = list.findIndex(s => s.id === id)
    if (i === -1) return null
    list[i] = { ...list[i], ...data, updatedAt: new Date().toISOString() }
    writeAll(list)
    return list[i]
  },

  /** Delete a sheet. */
  remove(id) {
    writeAll(readAll().filter(s => s.id !== id))
    return true
  },
}
