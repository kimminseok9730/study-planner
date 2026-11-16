import { test } from 'node:test'
import assert from 'node:assert/strict'
import { courseProgress, dayAchievement, backlog } from '../src/model.js'

const course = (doneLabels) => ({
  id: 'c',
  lectures: ['3', '4', '5'].map((label, i) => ({ label, order: i + 3, done: doneLabels.includes(label) })),
})
const lecPlan = (id, date, labels, extra = {}) => ({ id, date, start: '18:00', end: '19:30', kind: 'lecture', courseId: 'c', labels, ...extra })

test('progress', () => {
  assert.deepEqual(courseProgress({ lectures: [{ done: true }, { done: false }, { done: false }] }), { done: 1, total: 3, percent: 33 })
})
test('progress empty course', () => { assert.deepEqual(courseProgress({ lectures: [] }), { done: 0, total: 0, percent: 0 }) })

test('lecture plan partial', () => {
  assert.equal(dayAchievement([lecPlan('p', '2026-11-16', ['3', '4', '5'])], [], [course(['3', '4'])]).percent, 67)
})
test('text plan capped at duration', () => {
  const p = [{ id: 'p', start: '21:00', end: '22:00', kind: 'text', text: '기출' }]
  assert.deepEqual(dayAchievement(p, [{ planId: 'p', minutes: 90 }], []), { plannedMin: 60, actualMin: 90, percent: 100 })
})
test('unlinked actual counts toward actual time only', () => {
  const p = [{ id: 'p', start: '21:00', end: '22:00', kind: 'text', text: '기출' }]
  assert.deepEqual(dayAchievement(p, [{ planId: null, minutes: 30 }], []), { plannedMin: 60, actualMin: 30, percent: 0 })
})
test('no plans → 0%', () => { assert.equal(dayAchievement([], [{ planId: null, minutes: 30 }], []).percent, 0) })

test('backlog keeps only undone lecture 5', () => {
  assert.deepEqual(backlog([lecPlan('p', '2026-11-15', ['3', '4', '5'])], [course(['3', '4'])], [], '2026-11-16'),
    [{ kind: 'lecture', courseId: 'c', labels: ['5'], fromPlanId: 'p' }])
})
test('backlog drops lecture once replanned today', () => {
  const plans = [lecPlan('p', '2026-11-15', ['3', '4', '5']), lecPlan('q', '2026-11-16', ['5'], { fromPlanId: 'p' })]
  assert.deepEqual(backlog(plans, [course(['3', '4'])], [], '2026-11-16'), [])
})
test('backlog drops done lecture even if planned twice', () => {
  const plans = [lecPlan('p', '2026-11-14', ['5']), lecPlan('q', '2026-11-15', ['5'])]
  assert.deepEqual(backlog(plans, [course(['3', '4', '5'])], [], '2026-11-16'), [])
})
test('same undone lecture from two past plans appears once', () => {
  const plans = [lecPlan('p', '2026-11-14', ['5']), lecPlan('q', '2026-11-15', ['5'])]
  assert.deepEqual(backlog(plans, [course([])], [], '2026-11-16'), [{ kind: 'lecture', courseId: 'c', labels: ['5'], fromPlanId: 'q' }])
})
test('text plan with linked actual not in backlog; without → in backlog', () => {
  const plans = [
    { id: 't1', date: '2026-11-15', start: '21:00', end: '22:00', kind: 'text', text: '기출' },
    { id: 't2', date: '2026-11-15', start: '22:00', end: '23:00', kind: 'text', text: '단어' },
  ]
  assert.deepEqual(backlog(plans, [], [{ planId: 't1', minutes: 40 }], '2026-11-16'), [{ kind: 'text', text: '단어', fromPlanId: 't2' }])
})
test('text plan carried over not in backlog', () => {
  const plans = [
    { id: 't2', date: '2026-11-15', start: '22:00', end: '23:00', kind: 'text', text: '단어' },
    { id: 't3', date: '2026-11-16', start: '22:00', end: '23:00', kind: 'text', text: '단어', fromPlanId: 't2' },
  ]
  assert.deepEqual(backlog(plans, [], [], '2026-11-16'), [])
})
test('plan for deleted course is skipped', () => {
  assert.deepEqual(backlog([lecPlan('p', '2026-11-15', ['5'])], [], [], '2026-11-16'), [])
})

import { formatLabels } from '../src/model.js'
test('formatLabels', () => {
  assert.equal(formatLabels(['12', '13', '14']), '12~14강')
  assert.equal(formatLabels(['7']), '7강')
  assert.equal(formatLabels(['3', '5']), '3, 5강')
  assert.equal(formatLabels(['OT', '1']), 'OT, 1강')
  assert.equal(formatLabels([]), '')
})
