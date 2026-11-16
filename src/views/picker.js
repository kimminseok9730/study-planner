import { h, openSheet, closeSheet } from '../ui.js'
import { contentFields } from './editors.js'
import { blockTitle } from './day.js'
import { toMin, clock } from '../time.js'

// "What are you doing?" — one tap on today's plan, or 기타 with a small form.
export function openPicker(ctx, { title, onPick, date = ctx.date }) {
  const nowMin = ctx.nowMin()
  const plans = ctx.allPlans.filter((p) => p.date === date).sort((a, b) => toMin(a.start) - toMin(b.start))
  const list = h('div', { class: 'pick' })
  for (const p of plans) {
    const { title: t, sub } = blockTitle(ctx, p)
    const isNow = date === ctx.today() && toMin(p.start) <= nowMin && nowMin < toMin(p.end)
    list.append(h('button', { type: 'button', class: 'line' + (isNow ? ' now' : ''), style: { '--c': ctx.colorOf(p) }, onClick: () => {
      closeSheet()
      onPick({ planId: p.id, kind: p.kind, courseId: p.courseId, labels: p.labels, text: p.text, subjectId: p.subjectId })
    } }, h('span', { class: 'box' }, isNow ? '▶' : ''), h('span', { class: 'tag hl', style: { '--c': ctx.colorOf(p) } }),
    h('span', { class: 'what' }, h('span', {}, t), sub && h('small', {}, sub)), h('span', { class: 'when' }, `${clock(p.start)}–${clock(p.end)}`)))
  }
  if (!plans.length) list.append(h('p', { class: 'muted' }, '오늘 계획이 없어요. 아래 기타로 골라 주세요.'))

  const other = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } })
  const err = h('p', { class: 'err', role: 'alert' })
  const showOther = () => {
    const content = contentFields(ctx, {})
    other.replaceChildren(content.el, err, h('div', { class: 'actions' }, h('button', { type: 'button', class: 'primary', onClick: () => {
      const c = content.read()
      if (typeof c === 'string') return (err.textContent = c)
      closeSheet()
      onPick({ planId: null, ...c })
    } }, '선택')))
  }
  other.append(h('button', { type: 'button', class: 'line add', onClick: showOther }, '＋ 계획에 없던 것'))
  openSheet(title, [list, other])
}
