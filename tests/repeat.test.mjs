import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextOccurrence, firstOccurrence, repeatLabel, completeTodo, monthGrid, urgentCount } from '../src/todos.js'

const mon = { every: 'week', days: [1] }
test('nextOccurrence: strictly after the given date', () => {
  assert.equal(nextOccurrence({ every: 'day' }, '2026-11-17'), '2026-11-18')
  assert.equal(nextOccurrence(mon, '2026-11-16'), '2026-11-23') // Mon → next Mon
  assert.equal(nextOccurrence(mon, '2026-11-17'), '2026-11-23')
  assert.equal(nextOccurrence({ every: 'week', days: [1, 3] }, '2026-11-16'), '2026-11-18')
  assert.equal(nextOccurrence({ every: 'month', day: 15 }, '2026-11-15'), '2026-12-15')
  assert.equal(nextOccurrence({ every: 'month', day: 31 }, '2026-01-31'), '2026-02-28') // short month: last day
  assert.equal(nextOccurrence({ every: 'month', day: 31 }, '2026-02-28'), '2026-03-31')
})
test('firstOccurrence: on or after the given date', () => {
  assert.equal(firstOccurrence(mon, '2026-11-16'), '2026-11-16')
  assert.equal(firstOccurrence(mon, '2026-11-17'), '2026-11-23')
  assert.equal(firstOccurrence({ every: 'month', day: 5 }, '2026-11-17'), '2026-12-05')
})
test('repeatLabel', () => {
  assert.equal(repeatLabel({ every: 'day' }), '매일')
  assert.equal(repeatLabel({ every: 'week', days: [3, 1] }), '매주 월·수')
  assert.equal(repeatLabel({ every: 'week', days: [1, 2, 3, 4, 5] }), '평일마다')
  assert.equal(repeatLabel({ every: 'month', day: 15 }), '매달 15일')
  assert.equal(repeatLabel(null), '')
})
test('completeTodo: a plain todo is just marked done', () => {
  const t = { id: 'a', title: '숙제', due: '2026-11-17', done: false }
  assert.deepEqual(completeTodo(t, '2026-11-17', 'NOW'), [{ ...t, done: true, doneAt: 'NOW' }])
})
test('completeTodo: a repeating todo leaves a done copy and moves to its next date', () => {
  const t = { id: 'r', title: '영단어 시험', due: '2026-11-16', done: false, repeat: mon, subjectId: 'eng', createdAt: 'C' }
  const [copy, next] = completeTodo(t, '2026-11-16', 'NOW')
  assert.deepEqual(copy, { title: '영단어 시험', due: '2026-11-16', done: true, doneAt: 'NOW', subjectId: 'eng', note: '', fromRepeat: 'r', createdAt: 'NOW' })
  assert.equal(copy.id, undefined)
  assert.deepEqual(next, { ...t, due: '2026-11-23' })
  // finished late, weeks after: jumps to the next date from today, not one already past
  const [, late] = completeTodo({ ...t, due: '2026-11-02' }, '2026-11-17', 'NOW')
  assert.equal(late.due, '2026-11-23')
})
test('monthGrid shows the coming dates of repeating todos as ghosts', () => {
  const r = { id: 'r', title: '영단어', due: '2026-11-16', done: false, repeat: mon }
  const cells = monthGrid('2026-11-01', [r]).flat()
  const on = (d) => cells.find((c) => c.date === d).items
  assert.deepEqual(on('2026-11-16').map((x) => [x.id, Boolean(x.ghost)]), [['r', false]])
  assert.deepEqual(on('2026-11-23').map((x) => [x.id, x.ghost]), [['r', true]])
  assert.deepEqual(on('2026-11-30').map((x) => x.ghost), [true])
  assert.deepEqual(on('2026-11-09'), []) // nothing before the current date
  assert.equal(cells.filter((c) => c.items.length).length, 3)
})
test('monthGrid can start the week on Monday', () => {
  const g = monthGrid('2026-11-17', [], 1)
  assert.equal(g[0][0].date, '2026-10-26')
  assert.equal(g.at(-1)[6].date, '2026-12-06')
})
test('urgentCount can look a few days ahead', () => {
  const ts = [{ due: '2026-11-17', done: false }, { due: '2026-11-19', done: false }, { due: '2026-11-25', done: false }, { due: '2026-11-16', done: true }]
  assert.equal(urgentCount(ts, '2026-11-17'), 1)
  assert.equal(urgentCount(ts, '2026-11-17', 3), 2)
})
