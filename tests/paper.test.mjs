import { test } from 'node:test'
import assert from 'node:assert/strict'
import { subjectOf, planStatus, timeTableCells, subjectTotals, guessSubject, DEFAULT_SUBJECTS } from '../src/model.js'
import { dday } from '../src/time.js'

const courses = [{ id: 'c', subjectId: 'math', lectures: [{ label: '1', done: true }, { label: '2', done: false }, { label: '3', done: false }] }]
const lec = (labels, extra = {}) => ({ id: 'p', date: '2026-11-16', start: '18:00', end: '19:00', kind: 'lecture', courseId: 'c', labels, ...extra })

test('default subjects', () => { assert.deepEqual(DEFAULT_SUBJECTS.map((s) => s.id), ['kor', 'math', 'eng', 'sci', 'etc']) })
test('subjectOf', () => {
  assert.equal(subjectOf(lec(['1']), courses, []), 'math')
  assert.equal(subjectOf({ kind: 'text', subjectId: 'eng' }, courses, []), 'eng')
  assert.equal(subjectOf({ kind: 'text', planId: 'p9' }, courses, [{ id: 'p9', kind: 'text', subjectId: 'kor' }]), 'kor')
  assert.equal(subjectOf({ kind: 'text' }, courses, []), 'etc')
  assert.equal(subjectOf({ kind: 'lecture', courseId: 'gone' }, courses, []), 'etc')
})
test('planStatus', () => {
  assert.equal(planStatus(lec(['1']), [], courses, '2026-11-16'), 'done')
  assert.equal(planStatus(lec(['1', '2']), [], courses, '2026-11-16'), 'partial')
  assert.equal(planStatus(lec(['2', '3']), [], courses, '2026-11-16'), 'todo')
  assert.equal(planStatus(lec(['2', '3']), [{ planId: 'p', minutes: 20 }], courses, '2026-11-16'), 'partial')
  assert.equal(planStatus(lec(['2', '3']), [], courses, '2026-11-17'), 'missed')
  const t = { id: 't', date: '2026-11-16', start: '21:00', end: '22:00', kind: 'text', text: 'x' }
  assert.equal(planStatus(t, [{ planId: 't', minutes: 10 }], courses, '2026-11-16'), 'done')
  assert.equal(planStatus(t, [], courses, '2026-11-16'), 'todo')
  assert.equal(planStatus(t, [], courses, '2026-11-17'), 'missed')
})
test('timeTableCells: 10-minute cells take the block with most overlap', () => {
  const a = { id: 'a', start: '18:05', end: '18:32' }, b = { id: 'b', start: '18:32', end: '19:00' }
  const rows = timeTableCells([a, b], '18:00', '20:00')
  assert.deepEqual(rows.map((r) => r.hour), [18, 19])
  assert.deepEqual(rows[0].cells.map((c) => c?.id ?? null), ['a', 'a', 'a', 'b', 'b', 'b'])
  assert.deepEqual(rows[1].cells, [null, null, null, null, null, null])
})
test('timeTableCells: half-hour day start still shows whole hours', () => {
  assert.deepEqual(timeTableCells([], '06:30', '08:00').map((r) => r.hour), [6, 7])
})
test('subjectTotals sorted by minutes', () => {
  const acts = [{ kind: 'lecture', courseId: 'c', minutes: 90 }, { kind: 'text', subjectId: 'eng', minutes: 30 }, { kind: 'text', minutes: 100 }]
  assert.deepEqual(subjectTotals(acts, courses, []), [{ subjectId: 'etc', minutes: 100 }, { subjectId: 'math', minutes: 90 }, { subjectId: 'eng', minutes: 30 }])
})
test('guessSubject', () => {
  assert.equal(guessSubject('Starting Block 수학 I'), 'math')
  assert.equal(guessSubject('물리학1 개념완성'), 'sci')
  assert.equal(guessSubject('독서 기본'), 'kor')
  assert.equal(guessSubject('영어 구문'), 'eng')
  assert.equal(guessSubject('뭔가'), 'etc')
})
test('dday', () => {
  assert.equal(dday('2027-11-18', '2026-11-16'), 'D-367')
  assert.equal(dday('2026-11-16', '2026-11-16'), 'D-DAY')
  assert.equal(dday('2026-11-14', '2026-11-16'), 'D+2')
})
