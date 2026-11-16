import { h } from '../ui.js'
import { backlog, formatLabels } from '../model.js'
import { localDate, slots, toMin, toHHMM } from '../time.js'
import { openPlanEditor } from './editors.js'

function firstFreeSlot(ctx) {
  const { dayStart, dayEnd } = ctx.settings
  const now = new Date()
  const from = ctx.date === localDate(now) ? now.getHours() * 60 + now.getMinutes() : 0
  for (const t of slots(dayStart, dayEnd)) {
    const s = toMin(t)
    if (s + 30 <= from) continue
    if (!ctx.plans.some((p) => s < toMin(p.end) && toMin(p.start) < s + 60)) return { start: t, end: toHHMM(Math.min(s + 60, toMin(dayEnd))) }
  }
  return { start: dayStart, end: toHHMM(toMin(dayStart) + 60) }
}

// Returns false when there is nothing to show.
export function renderBacklog(root, ctx) {
  const items = backlog(ctx.allPlans, ctx.courses, ctx.allActuals, localDate(new Date()))
  if (!items.length) return false
  const list = h('div', { class: 'list' })
  for (const it of items) {
    const title = it.kind === 'lecture' ? ctx.courseById(it.courseId)?.name : it.text
    const sub = it.kind === 'lecture' ? formatLabels(it.labels) : ''
    list.append(h('button', { class: 'backlog-item', onClick: () => openPlanEditor(ctx, { ...firstFreeSlot(ctx), kind: it.kind, courseId: it.courseId, labels: it.labels, text: it.text, fromPlanId: it.fromPlanId }) },
      h('span', {}, h('b', {}, title), sub ? ` · ${sub}` : ''), h('span', { class: 'muted' }, '계획에 넣기')))
  }
  root.replaceChildren(h('h2', {}, '밀린 것', h('span', { class: 'muted' }, `${items.length}개`)), list)
  return true
}
