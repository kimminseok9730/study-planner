import { test } from 'node:test'
import assert from 'node:assert/strict'
import { weekDates, monthDates, shiftPeriod, dayRows, summarize, streak, lecturesDone } from '../src/stats.js'

const courses = [{ id: 'c1', name: '수학', subjectId: 'math', lectures: [
  { label: '1', order: 1, done: true, doneAt: new Date(2026, 10, 16, 20).toISOString() },
  { label: '2', order: 2, done: true, doneAt: new Date(2026, 10, 18, 1).toISOString() }, // 새벽 1시 → 17일 공부
  { label: '3', order: 3, done: true }, // 날짜 모름
  { label: '4', order: 4, done: false },
] }]
const plans = [
  { id: 'p1', date: '2026-11-16', start: '18:00', end: '19:00', kind: 'text', text: '기출', subjectId: 'kor' },
  { id: 'p2', date: '2026-11-17', start: '18:00', end: '20:00', kind: 'text', text: '단어', subjectId: 'eng' },
]
const actuals = [
  { id: 'a1', date: '2026-11-16', start: '18:00', end: '19:00', minutes: 60, kind: 'text', planId: 'p1' },
  { id: 'a2', date: '2026-11-16', start: '20:00', end: '20:50', minutes: 50, kind: 'lecture', courseId: 'c1', labels: ['1'] },
  { id: 'a3', date: '2026-11-17', start: '18:00', end: '18:30', minutes: 30, kind: 'text', planId: 'p2' },
  { id: 'a4', date: '2026-11-19', start: '10:00', end: '10:20', minutes: 20, kind: 'text', text: '복습' },
]

test('weekDates runs Monday to Sunday', () => {
  assert.deepEqual(weekDates('2026-11-18'), ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22'])
  assert.equal(weekDates('2026-11-22')[0], '2026-11-16') // Sunday belongs to the week that started Monday
  assert.equal(weekDates('2026-11-16')[0], '2026-11-16')
})
test('monthDates covers the whole month', () => {
  const m = monthDates('2026-02-10')
  assert.equal(m.length, 28); assert.equal(m[0], '2026-02-01'); assert.equal(m.at(-1), '2026-02-28')
  assert.equal(monthDates('2026-11-30').length, 30)
})
test('shiftPeriod moves by a week or a month', () => {
  assert.equal(shiftPeriod('2026-11-18', 'week', -1), '2026-11-11')
  assert.equal(shiftPeriod('2026-01-31', 'month', 1), '2026-02-01')
  assert.equal(shiftPeriod('2026-01-15', 'month', -1), '2025-12-01')
})
test('dayRows: minutes, subject parts and achievement per day', () => {
  const rows = dayRows(['2026-11-16', '2026-11-17', '2026-11-18'], actuals, plans, courses)
  assert.equal(rows[0].minutes, 110)
  assert.deepEqual(rows[0].parts, [{ subjectId: 'kor', minutes: 60 }, { subjectId: 'math', minutes: 50 }])
  assert.equal(rows[0].percent, 100)
  assert.equal(rows[1].minutes, 30); assert.equal(rows[1].percent, 25)
  assert.deepEqual(rows[2], { date: '2026-11-18', minutes: 0, parts: [], percent: null })
})
test('summarize: total, average over studied days, best day, mean achievement', () => {
  const s = summarize(dayRows(weekDates('2026-11-18'), actuals, plans, courses))
  assert.equal(s.total, 160); assert.equal(s.studiedDays, 3); assert.equal(s.avg, 53)
  assert.deepEqual(s.best, { date: '2026-11-16', minutes: 110 })
  assert.equal(s.percent, 63) // (100 + 25) / 2
  assert.deepEqual(s.subjects, [{ subjectId: 'kor', minutes: 60 }, { subjectId: 'math', minutes: 50 }, { subjectId: 'eng', minutes: 30 }, { subjectId: 'etc', minutes: 20 }])
  const empty = summarize(dayRows(['2026-12-01'], actuals, plans, courses))
  assert.deepEqual(empty, { total: 0, studiedDays: 0, avg: 0, best: null, percent: null, subjects: [] })
})
test('streak counts back from today, or from yesterday when today is still empty', () => {
  assert.equal(streak(actuals, '2026-11-17'), 2)
  assert.equal(streak(actuals, '2026-11-18'), 2) // nothing yet today, yesterday still counts
  assert.equal(streak(actuals, '2026-11-19'), 1) // 18th was missed
  assert.equal(streak(actuals, '2026-11-21'), 0)
  assert.equal(streak([], '2026-11-17'), 0)
})
test('lecturesDone counts by study day, so 1am belongs to the day before', () => {
  assert.equal(lecturesDone(courses, ['2026-11-16'], '26:00'), 1)
  assert.equal(lecturesDone(courses, ['2026-11-17'], '26:00'), 1)
  assert.equal(lecturesDone(courses, ['2026-11-18'], '26:00'), 0)
  assert.equal(lecturesDone(courses, weekDates('2026-11-18'), '26:00'), 2)
})
