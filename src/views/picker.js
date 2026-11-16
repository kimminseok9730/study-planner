import { h, openSheet, closeSheet } from '../ui.js'
import { contentFields } from './editors.js'
import { blockTitle } from './day.js'
import { toMin } from '../time.js'

// "What are you doing?" — one tap on today's plan, or 기타 with a small form.
export function openPicker(ctx, { title, onPick }) {
  const now = new Date()
  const nowMin = now.getHours() * 60 + now.getMinutes()
  const plans = ctx.plans.slice().sort((a, b) => toMin(a.start) - toMin(b.start))
  const list = h('div', { class: 'pick' })
  for (const p of plans) {
    const { title: t, sub } = blockTitle(ctx, p)
    const isNow = toMin(p.start) <= nowMin && nowMin < toMin(p.end)
    list.append(h('button', { type: 'button', class: isNow ? 'primary' : '', onClick: () => {
      closeSheet()
      onPick({ planId: p.id, kind: p.kind, courseId: p.courseId, labels: p.labels, text: p.text })
    } }, h('span', {}, h('b', {}, t), sub ? ` · ${sub}` : ''), h('span', { class: isNow ? '' : 'muted' }, `${p.start}–${p.end}`)))
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
  other.append(h('button', { type: 'button', class: 'add', onClick: showOther }, '기타 (계획에 없던 것)'))
  openSheet(title, [list, other])
}
