// Thin IndexedDB wrapper. All data stays on this device.

const DEFAULT_SETTINGS = { dayStart: '04:00', dayEnd: '26:00', lastBackupAt: null, timer: null, subjects: null, dday: null, memos: {} }
const LISTS = ['courses', 'plans', 'actuals', 'photos']

const req = (r) => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error) })
const done = (tx) => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); tx.onabort = () => rej(tx.error || new Error('aborted')) })
const newId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2))

export async function openStore(name = 'study-planner') {
  const open = indexedDB.open(name, 2)
  open.onupgradeneeded = (e) => {
    const db = open.result
    if (e.oldVersion < 1) {
      db.createObjectStore('courses', { keyPath: 'id' })
      db.createObjectStore('plans', { keyPath: 'id' }).createIndex('date', 'date')
      db.createObjectStore('actuals', { keyPath: 'id' }).createIndex('date', 'date')
      db.createObjectStore('settings')
    }
    // v2: photos of the day's study
    if (e.oldVersion < 2) db.createObjectStore('photos', { keyPath: 'id' }).createIndex('date', 'date')
  }
  const db = await req(open)
  const store = (s, mode = 'readonly') => db.transaction(s, mode).objectStore(s)

  const api = {
    getAll: (s) => req(store(s).getAll()),
    getByDate: (s, date) => req(store(s).index('date').getAll(date)),
    async put(s, obj) {
      const o = obj.id ? obj : { ...obj, id: newId() }
      await req(store(s, 'readwrite').put(o))
      return o
    },
    remove: (s, id) => req(store(s, 'readwrite').delete(id)),
    async getSettings() {
      const v = await req(store('settings').get('main'))
      return { ...DEFAULT_SETTINGS, ...(v || {}) }
    },
    async saveSettings(patch) {
      const cur = await api.getSettings()
      const next = { ...cur, ...patch }
      await req(store('settings', 'readwrite').put(next, 'main'))
      return next
    },
    async replaceAll(data) {
      const tx = db.transaction([...LISTS, 'settings'], 'readwrite')
      const finished = done(tx)
      try {
        for (const s of LISTS) {
          const os = tx.objectStore(s)
          os.clear()
          for (const item of data[s] || []) os.put(item) // throws on missing id → abort
        }
        tx.objectStore('settings').put({ ...DEFAULT_SETTINGS, ...data.settings }, 'main')
      } catch (e) {
        tx.abort()
        await finished.catch(() => {})
        throw e
      }
      await finished
    },
    async exportAll() {
      const [courses, plans, actuals, photos, settings] = await Promise.all([...LISTS.map(api.getAll), api.getSettings()])
      return { courses, plans, actuals, photos, settings }
    },
  }
  return api
}
