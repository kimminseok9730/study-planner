import { h, toast } from '../ui.js'
import { clipTimerToDay } from '../time.js'
import { formatLabels } from '../model.js'
import { openPicker } from './picker.js'
import { confirmLectures } from './editors.js'
import { photoBox } from './photo.js'

let tick = null

function label(ctx, t) {
  if (t.kind === 'lecture') { const c = ctx.courseById(t.courseId); return `${c?.name || '강좌'} ${formatLabels(t.labels, c)}` }
  return t.text || '공부'
}
const pad = (n) => String(n).padStart(2, '0')
function elapsed(startedAt) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000))
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`
}

export async function startTimer(ctx, choice) {
  await ctx.store.saveSettings({ timer: { startedAt: new Date().toISOString(), ...choice } })
  await ctx.refresh()
}

let stopping = false
export async function stopTimer(ctx) {
  if (stopping) return null
  stopping = true
  try {
    const t = (await ctx.store.getSettings()).timer
    if (!t) { await ctx.refresh(); return null }
    await ctx.store.saveSettings({ timer: null })
    const block = clipTimerToDay(new Date(t.startedAt), new Date(), ctx.settings.dayEnd)
    if (!block) { toast('1분 미만이라 저장하지 않았어요'); await ctx.refresh(); return null }
    const { startedAt, ...choice } = t
    const actual = await ctx.store.put('actuals', { ...choice, ...block, source: 'timer' })
    if (actual.kind === 'lecture') confirmLectures(ctx, actual)
    else { toast('기록을 저장했어요'); await ctx.refresh() }
    return actual
  } finally {
    stopping = false
  }
}

export function renderTimerBar(root, ctx) {
  clearInterval(tick)
  const t = ctx.settings.timer
  if (!t) {
    root.replaceChildren(h('div', { class: 'inner' },
      h('span', { class: 'muted' }, '공부를 시작할 때 누르세요'),
      h('button', { class: 'primary', onClick: () => openPicker(ctx, { title: '무엇을 공부하나요?', date: ctx.today(), onPick: (c) => startTimer(ctx, c) }) }, '▶ 공부 시작')))
    return
  }
  const clock = h('span', { class: 'clock hl', style: { '--c': ctx.colorOf(t), padding: '0 6px' } }, elapsed(t.startedAt))
  root.replaceChildren(h('div', { class: 'inner' },
    h('span', { class: 'what' },
      t.kind === 'lecture' ? photoBox(ctx.courseById(t.courseId), true) : h('span', { class: 'tag hl', style: { '--c': ctx.colorOf(t) } }),
      h('span', { class: 't' }, label(ctx, t))),
    h('span', { class: 'right' }, clock,
      h('button', { class: 'primary', onClick: () => stopTimer(ctx) }, '■ 정지'))))
  tick = setInterval(() => { clock.textContent = elapsed(t.startedAt) }, 1000)
}
