import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeBackup, parseBackup, needsBackupReminder } from '../src/backup.js'

const data = {
  courses: [{ id: 'c', name: '수학', platform: 'mimac', lectures: [{ label: '1', order: 1, done: true }] }],
  plans: [{ id: 'p', date: '2026-11-16', start: '18:00', end: '19:00', kind: 'text', text: '기출' }],
  actuals: [],
  settings: { dayStart: '06:00', dayEnd: '24:00', lastBackupAt: null, timer: null },
}
const now = new Date(2026, 10, 16, 12)

test('round trip', () => {
  const r = parseBackup(JSON.stringify(makeBackup(data, now)))
  assert.equal(r.ok, true)
  assert.deepEqual(r.data, data)
})
test('not json', () => { assert.deepEqual(parseBackup('{'), { ok: false, error: '백업 파일을 읽을 수 없어요' }) })
test('wrong app', () => {
  assert.deepEqual(parseBackup(JSON.stringify({ app: 'x', version: 1 })), { ok: false, error: '공부 기록장 백업 파일이 아니에요' })
})
test('missing arrays', () => {
  const b = makeBackup(data, now); delete b.plans
  assert.deepEqual(parseBackup(JSON.stringify(b)), { ok: false, error: '공부 기록장 백업 파일이 아니에요' })
})
test('items without id rejected', () => {
  const b = makeBackup(data, now); b.courses = [{ name: 'x' }]
  assert.deepEqual(parseBackup(JSON.stringify(b)), { ok: false, error: '공부 기록장 백업 파일이 아니에요' })
})
test('newer version', () => {
  const b = makeBackup(data, now); b.version = 2
  assert.deepEqual(parseBackup(JSON.stringify(b)), { ok: false, error: '더 새로운 버전의 백업이에요' })
})
test('reminder', () => {
  assert.equal(needsBackupReminder(null, now), true)
  assert.equal(needsBackupReminder(new Date(2026, 10, 8, 12).toISOString(), now), true)
  assert.equal(needsBackupReminder(new Date(2026, 10, 10, 12).toISOString(), now), false)
})

test('running timer is not exported or imported', () => {
  const withTimer = { ...data, settings: { ...data.settings, timer: { startedAt: '2026-11-16T09:00:00.000Z', kind: 'text', text: 'x', planId: null } } }
  const b = makeBackup(withTimer, now)
  assert.equal(b.settings.timer, null)
  const old = { ...b, settings: { ...b.settings, timer: { startedAt: 'x' } } }
  assert.equal(parseBackup(JSON.stringify(old)).data.settings.timer, null)
})
test('items missing required fields rejected', () => {
  const bad1 = makeBackup(data, now); bad1.plans = [{ id: 'p', date: '2026-11-16', kind: 'text' }]
  assert.equal(parseBackup(JSON.stringify(bad1)).ok, false)
  const bad2 = makeBackup(data, now); bad2.courses = [{ id: 'c', name: 'x' }]
  assert.equal(parseBackup(JSON.stringify(bad2)).ok, false)
  const bad3 = makeBackup(data, now); bad3.actuals = [{ id: 'a', date: '2026-11-16', start: '09:00', end: '10:00', kind: 'text' }]
  assert.equal(parseBackup(JSON.stringify(bad3)).ok, false)
})
