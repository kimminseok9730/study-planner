import 'fake-indexeddb/auto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openStore } from '../src/store.js'
import { makeBackup, parseBackup } from '../src/backup.js'

let n = 0
const fresh = () => openStore(`ph${n++}`)

test('photos are kept per date and travel with export and replaceAll', async () => {
  const s = await fresh()
  const ph = await s.put('photos', { date: '2026-11-16', data: 'data:image/jpeg;base64,AAAA', note: '수학 노트' })
  await s.put('photos', { date: '2026-11-17', data: 'data:image/jpeg;base64,BBBB' })
  assert.deepEqual((await s.getByDate('photos', '2026-11-16')).map((x) => x.id), [ph.id])
  const all = await s.exportAll()
  assert.equal(all.photos.length, 2)
  const t = await fresh()
  await t.replaceAll({ ...all, photos: all.photos.slice(0, 1) })
  assert.equal((await t.getAll('photos')).length, 1)
  await t.replaceAll({ courses: [], plans: [], actuals: [], settings: {} }) // old backup without photos
  assert.equal((await t.getAll('photos')).length, 0)
})

test('a database made before photos existed gains the photos store and keeps its data', async () => {
  const name = `old${n++}`
  await new Promise((res, rej) => {
    const r = indexedDB.open(name, 1)
    r.onupgradeneeded = () => {
      const db = r.result
      db.createObjectStore('courses', { keyPath: 'id' })
      db.createObjectStore('plans', { keyPath: 'id' }).createIndex('date', 'date')
      db.createObjectStore('actuals', { keyPath: 'id' }).createIndex('date', 'date')
      db.createObjectStore('settings')
    }
    r.onsuccess = () => {
      const db = r.result
      const tx = db.transaction('courses', 'readwrite')
      tx.objectStore('courses').put({ id: 'c', name: '수학', lectures: [] })
      tx.oncomplete = () => { db.close(); res() }
    }
    r.onerror = () => rej(r.error)
  })
  const s = await openStore(name)
  assert.equal((await s.getAll('courses')).length, 1)
  await s.put('photos', { date: '2026-11-16', data: 'data:image/jpeg;base64,AAAA' })
  assert.equal((await s.getAll('photos')).length, 1)
})

test('backup: photos kept when valid, empty for old backups, rejected when not an image', () => {
  const data = { courses: [], plans: [], actuals: [], settings: { dayStart: '04:00', dayEnd: '26:00' } }
  const now = new Date(2026, 10, 16, 12)
  const photo = { id: 'ph', date: '2026-11-16', data: 'data:image/jpeg;base64,AAAA' }
  const withPhoto = parseBackup(JSON.stringify(makeBackup({ ...data, photos: [photo] }, now)))
  assert.deepEqual(withPhoto.data.photos, [photo])
  assert.deepEqual(parseBackup(JSON.stringify(makeBackup(data, now))).data.photos, [])
  const bad = parseBackup(JSON.stringify(makeBackup({ ...data, photos: [{ ...photo, data: 'javascript:alert(1)' }] }, now)))
  assert.equal(bad.ok, false)
})
