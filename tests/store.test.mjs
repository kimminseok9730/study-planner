import 'fake-indexeddb/auto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { openStore } from '../src/store.js'

let n = 0
const fresh = () => openStore(`t${n++}`)

test('put and getByDate', async () => {
  const s = await fresh()
  const p = await s.put('plans', { date: '2026-11-16', start: '18:00', end: '19:00', kind: 'text', text: 'x' })
  assert.equal(typeof p.id, 'string')
  await s.put('plans', { date: '2026-11-17', start: '18:00', end: '19:00', kind: 'text', text: 'y' })
  const got = await s.getByDate('plans', '2026-11-16')
  assert.deepEqual(got.map((x) => x.text), ['x'])
})
test('remove', async () => {
  const s = await fresh()
  const c = await s.put('courses', { name: 'a', platform: 'etc', lectures: [] })
  await s.remove('courses', c.id)
  assert.deepEqual(await s.getAll('courses'), [])
})
test('default settings and patch', async () => {
  const s = await fresh()
  assert.deepEqual(await s.getSettings(), { dayStart: '06:00', dayEnd: '24:00', lastBackupAt: null, timer: null })
  await s.saveSettings({ dayEnd: '23:00' })
  assert.equal((await s.getSettings()).dayEnd, '23:00')
  assert.equal((await s.getSettings()).dayStart, '06:00')
})
test('replaceAll is atomic', async () => {
  const s = await fresh()
  await s.put('courses', { id: 'keep', name: 'a', platform: 'etc', lectures: [] })
  await assert.rejects(s.replaceAll({ courses: [{ name: 'no id' }], plans: [], actuals: [], settings: {} }))
  assert.deepEqual((await s.getAll('courses')).map((c) => c.id), ['keep'])
})
test('replaceAll and exportAll round trip', async () => {
  const s = await fresh()
  const data = { courses: [{ id: 'c', name: 'a', platform: 'etc', lectures: [] }], plans: [], actuals: [], settings: { dayStart: '07:00', dayEnd: '24:00', lastBackupAt: null, timer: null } }
  await s.replaceAll(data)
  assert.deepEqual(await s.exportAll(), data)
})
