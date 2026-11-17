import 'fake-indexeddb/auto'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupTodos, dueLabel, urgentCount, validateTodo, monthGrid } from '../src/todos.js'
import { openStore } from '../src/store.js'
import { makeBackup, parseBackup } from '../src/backup.js'

const today = '2026-11-17'
const todos = [
  { id: 'a', title: '물리 수행평가', due: '2026-11-20', done: false },
  { id: 'b', title: '영어 단어 시험', due: '2026-11-17', done: false },
  { id: 'c', title: '국어 독후감', due: '2026-11-15', done: false },
  { id: 'd', title: '기말고사', due: '2026-12-08', done: false },
  { id: 'e', title: '문제집 사기', due: null, done: false },
  { id: 'f', title: '수학 숙제', due: '2026-11-16', done: true, doneAt: '2026-11-16T10:00:00.000Z' },
  { id: 'g', title: '화학 실험 보고서', due: '2026-11-18', done: false },
  { id: 'h', title: '옛날 숙제', due: '2026-11-10', done: true, doneAt: '2026-11-10T10:00:00.000Z' },
  { id: 'i', title: '일주일 뒤', due: '2026-11-24', done: false },
]

test('groupTodos: overdue, today, within 7 days, later, no date, done — each sorted', () => {
  const g = groupTodos(todos, today)
  assert.deepEqual(g.map((x) => [x.key, x.items.map((t) => t.id)]), [
    ['late', ['c']],
    ['today', ['b']],
    ['week', ['g', 'a', 'i']],
    ['later', ['d']],
    ['none', ['e']],
    ['done', ['f', 'h']], // most recently finished first
  ])
  assert.equal(g[0].label, '지난 것')
})
test('groupTodos leaves out empty groups', () => {
  assert.deepEqual(groupTodos([todos[4]], today).map((x) => x.key), ['none'])
  assert.deepEqual(groupTodos([], today), [])
})
test('dueLabel', () => {
  assert.equal(dueLabel('2026-11-20', today), 'D-3')
  assert.equal(dueLabel('2026-11-17', today), '오늘')
  assert.equal(dueLabel('2026-11-15', today), '2일 지남')
  assert.equal(dueLabel(null, today), '')
})
test('urgentCount: not done and due today or earlier', () => {
  assert.equal(urgentCount(todos, today), 2)
  assert.equal(urgentCount([], today), 0)
})
test('validateTodo', () => {
  assert.equal(validateTodo({ title: '  ', due: null }), '할 일을 적어 주세요')
  assert.equal(validateTodo({ title: '숙제', due: '2026-13-40' }), '날짜를 다시 골라 주세요')
  assert.equal(validateTodo({ title: '숙제', due: null }), null)
  assert.equal(validateTodo({ title: '숙제', due: '2026-11-20' }), null)
})

test('todos are stored, exported and restored; old backups have none', async () => {
  const s = await openStore('todo-db')
  const t = await s.put('todos', { title: '물리 수행평가', due: '2026-11-20', done: false, subjectId: 'sci' })
  const all = await s.exportAll()
  assert.deepEqual(all.todos, [t])
  const now = new Date(2026, 10, 17)
  const r = parseBackup(JSON.stringify(makeBackup(all, now)))
  assert.deepEqual(r.data.todos, [t])
  const { todos: _drop, ...old } = all
  assert.deepEqual(parseBackup(JSON.stringify(makeBackup(old, now))).data.todos, [])
  assert.equal(parseBackup(JSON.stringify(makeBackup({ ...all, todos: [{ id: 'x', done: false }] }, now))).ok, false)
  await s.replaceAll({ courses: [], plans: [], actuals: [], settings: {} })
  assert.deepEqual(await s.getAll('todos'), [])
})

test('monthGrid: whole weeks from Sunday, days outside the month marked, todos on their due date', () => {
  const g = monthGrid('2026-11-17', todos)
  assert.equal(g.length, 5) // Nov 2026: Sun 1st … Mon 30th
  assert.ok(g.every((w) => w.length === 7))
  assert.deepEqual(g[0][0], { date: '2026-11-01', inMonth: true, items: [] })
  assert.equal(g[4][1].date, '2026-11-30')
  assert.deepEqual(g[4][2], { date: '2026-12-01', inMonth: false, items: [] })
  const day = (d) => g.flat().find((c) => c.date === d)
  assert.deepEqual(day('2026-11-20').items.map((t) => t.id), ['a'])
  assert.deepEqual(day('2026-11-16').items.map((t) => t.id), ['f']) // finished ones stay on the calendar
  const feb = monthGrid('2026-02-10', [])
  assert.equal(feb.length, 4); assert.equal(feb[0][0].date, '2026-02-01'); assert.equal(feb[3][6].date, '2026-02-28')
  const aug = monthGrid('2026-08-05', [])
  assert.equal(aug.length, 6); assert.equal(aug[0][0].date, '2026-07-26'); assert.equal(aug[0][6].date, '2026-08-01')
})
test('monthGrid puts open items before finished ones within a day', () => {
  const two = [{ id: 'x', title: 'a', due: '2026-11-05', done: true }, { id: 'y', title: 'b', due: '2026-11-05', done: false }]
  assert.deepEqual(monthGrid('2026-11-01', two).flat().find((c) => c.date === '2026-11-05').items.map((t) => t.id), ['y', 'x'])
})
