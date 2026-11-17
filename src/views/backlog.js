import { h } from '../ui.js'
import { backlog, formatLabels } from '../model.js'
import { openPlanEditor } from './editors.js'
import { nextSlot } from './day.js'

// Unfinished work from earlier days. Returns null when there is none.
export function renderBacklog(ctx) {
  const items = backlog(ctx.allPlans, ctx.courses, ctx.allActuals, ctx.today())
  if (!items.length) return null
  const list = h('div', {})
  for (const it of items) {
    const title = it.kind === 'lecture' ? ctx.courseById(it.courseId)?.name : it.text
    const sub = it.kind === 'lecture' ? formatLabels(it.labels, ctx.courseById(it.courseId)) : ''
    const from = ctx.allPlans.find((p) => p.id === it.fromPlanId)
    list.append(h('button', { class: 'line late', onClick: () => openPlanEditor(ctx, { ...nextSlot(ctx), kind: it.kind, courseId: it.courseId, labels: it.labels, text: it.text, subjectId: from?.subjectId, fromPlanId: it.fromPlanId }) },
      h('span', { class: 'box' }, '→'),
      h('span', { class: 'tag hl', style: { '--c': ctx.colorOf(from || it) } }),
      h('span', { class: 'what' }, h('span', {}, title), sub && h('small', {}, sub)),
      h('span', { class: 'when' }, '계획에 넣기')))
  }
  return h('section', {}, h('h3', { class: 'sec' }, h('span', {}, '밀린 것'), h('span', {}, `${items.length}개`)), list)
}
