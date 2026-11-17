import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatLabels, unitWord, pageItems, courseSchedule } from '../src/model.js'
import { lecturesDone } from '../src/stats.js'

const lecture = { id: 'l', name: '수학 I', kind: 'lecture', lectures: [] }
const pageBook = { id: 'p', name: '수특 수학', kind: 'book', unit: 'page', lectures: [] }
const unitBook = { id: 'u', name: '마더텅', kind: 'book', unit: 'unit', unitName: '회', lectures: [] }

test('formatLabels speaks the unit of the course', () => {
  assert.equal(formatLabels(['12', '13', '14']), '12~14강') // no course: as before
  assert.equal(formatLabels(['12', '13', '14'], lecture), '12~14강')
  assert.equal(formatLabels(['12', '13', '14'], pageBook), 'p.12~14')
  assert.equal(formatLabels(['7'], pageBook), 'p.7')
  assert.equal(formatLabels(['3', '4'], unitBook), '3~4회')
  assert.equal(formatLabels(['3', '5'], { ...unitBook, unitName: undefined }), '3, 5단원')
  assert.equal(formatLabels([], pageBook), '')
})
test('unitWord', () => {
  assert.equal(unitWord(lecture), '강')
  assert.equal(unitWord({ name: 'old course', lectures: [] }), '강') // saved before books existed
  assert.equal(unitWord(pageBook), '쪽')
  assert.equal(unitWord(unitBook), '회')
  assert.equal(unitWord({ ...unitBook, unitName: '' }), '단원')
})
test('pageItems makes one item per page of a range, keeping pages already there', () => {
  const items = pageItems(5, 8)
  assert.deepEqual(items.map((x) => [x.label, x.order, x.done]), [['5', 5, false], ['6', 6, false], ['7', 7, false], ['8', 8, false]])
  const kept = pageItems(1, 3, [{ label: '2', order: 2, done: true, doneAt: 'x' }])
  assert.deepEqual(kept.map((x) => [x.label, x.done]), [['1', false], ['2', true], ['3', false]])
  assert.deepEqual(pageItems(8, 5), [])
})

// 32 lectures, 1–10 done earlier; today is Tue 2026-11-17, goal Fri 11-27, weekdays only.
const items = (n, doneUpTo, doneAt = '2026-11-10T10:00:00.000Z') =>
  Array.from({ length: n }, (_, i) => ({ label: String(i + 1), order: i + 1, done: i + 1 <= doneUpTo, ...(i + 1 <= doneUpTo ? { doneAt } : {}) }))
const goal = { end: '2026-11-27', days: [1, 2, 3, 4, 5] }

test('courseSchedule spreads what is left over the study days up to the goal', () => {
  const s = courseSchedule({ ...lecture, lectures: items(32, 10), goal }, '2026-11-17', '26:00')
  // 22 left, study days 17,18,19,20,23,24,25,26,27 = 9 → 3 a day
  assert.equal(s.status, 'ok')
  assert.equal(s.daysLeft, 9); assert.equal(s.perDay, 3); assert.equal(s.remaining, 22)
  assert.deepEqual(s.today, ['11', '12', '13']); assert.equal(s.doneToday, 0)
})
test('work done today stays in today\'s share instead of shrinking it', () => {
  const l = items(32, 10)
  l[10] = { ...l[10], done: true, doneAt: new Date(2026, 10, 17, 20).toISOString() } // 11강 tonight
  l[11] = { ...l[11], done: true, doneAt: new Date(2026, 10, 18, 1).toISOString() } // 12강 at 1am: still the 17th
  const s = courseSchedule({ ...lecture, lectures: l, goal }, '2026-11-17', '26:00')
  assert.deepEqual(s.today, ['11', '12', '13']); assert.equal(s.doneToday, 2); assert.equal(s.remaining, 20)
})
test('falling behind raises tomorrow\'s share', () => {
  const s = courseSchedule({ ...lecture, lectures: items(32, 10), goal }, '2026-11-18', '26:00')
  assert.equal(s.daysLeft, 8); assert.equal(s.perDay, 3) // ceil(22/8)
  const late = courseSchedule({ ...lecture, lectures: items(32, 10), goal }, '2026-11-26', '26:00')
  assert.equal(late.daysLeft, 2); assert.equal(late.perDay, 11)
})
test('not a study day: nothing today, next study day named', () => {
  const s = courseSchedule({ ...lecture, lectures: items(32, 10), goal }, '2026-11-21', '26:00') // Saturday
  assert.equal(s.status, 'ok'); assert.deepEqual(s.today, []); assert.equal(s.next, '2026-11-23')
})
test('courseSchedule edge cases', () => {
  assert.equal(courseSchedule({ ...lecture, lectures: items(32, 10) }, '2026-11-17', '26:00'), null) // no goal
  assert.equal(courseSchedule({ ...lecture, lectures: items(32, 32), goal }, '2026-11-17', '26:00').status, 'finished')
  const over = courseSchedule({ ...lecture, lectures: items(32, 10), goal }, '2026-11-28', '26:00')
  assert.equal(over.status, 'overdue'); assert.equal(over.remaining, 22)
  assert.equal(courseSchedule({ ...lecture, lectures: [], goal }, '2026-11-17', '26:00').status, 'empty')
  const pages = courseSchedule({ ...pageBook, lectures: pageItems(1, 90), goal }, '2026-11-17', '26:00')
  assert.equal(pages.perDay, 10); assert.equal(formatLabels(pages.today, pageBook), 'p.1~10')
})
test('lecturesDone leaves page books out', () => {
  const at = new Date(2026, 10, 17, 20).toISOString()
  const c = [{ ...pageBook, lectures: [{ label: '1', order: 1, done: true, doneAt: at }] }, { ...unitBook, lectures: [{ label: '1', order: 1, done: true, doneAt: at }] }]
  assert.equal(lecturesDone(c, ['2026-11-17'], '26:00'), 1)
})

test('progress filled in before the goal was set does not count as today\'s work', () => {
  const setAt = new Date(2026, 10, 17, 9).toISOString()
  const l = items(32, 10, new Date(2026, 10, 17, 8, 59).toISOString()) // marked while setting the course up
  l[10] = { ...l[10], done: true, doneAt: new Date(2026, 10, 17, 20).toISOString() } // real work tonight
  const s = courseSchedule({ ...lecture, lectures: l, goal: { ...goal, setAt } }, '2026-11-17', '26:00')
  assert.deepEqual(s.today, ['11', '12', '13']); assert.equal(s.doneToday, 1)
})
