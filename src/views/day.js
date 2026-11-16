import { h, fmtMin } from '../ui.js'
import { slots, toMin, toHHMM, localDate, SLOT } from '../time.js'
import { dayAchievement, formatLabels } from '../model.js'
import { needsBackupReminder } from '../backup.js'
import { openPlanEditor, openActualEditor } from './editors.js'
import { openPicker } from './picker.js'
import { openSettings } from './settings.js'

const WD = ['일', '월', '화', '수', '목', '금', '토']

function shiftDate(date, days) {
  const [y, m, d] = date.split('-').map(Number)
  return localDate(new Date(y, m - 1, d + days))
}
function dateLabel(date) {
  const [y, m, d] = date.split('-').map(Number)
  return `${m}월 ${d}일 (${WD[new Date(y, m - 1, d).getDay()]})`
}

export function blockTitle(ctx, b) {
  if (b.kind === 'lecture') {
    const c = ctx.courseById(b.courseId)
    return { title: c ? c.name : '삭제된 강좌', sub: formatLabels(b.labels) }
  }
  return { title: b.text || '할 일', sub: '' }
}

function isMiss(ctx, p, today) {
  const linked = ctx.allActuals.some((a) => a.planId === p.id)
  if (!linked && p.date >= today) return false
  if (p.kind === 'lecture') {
    const c = ctx.courseById(p.courseId)
    if (!c) return false
    return (p.labels || []).some((lb) => !c.lectures.find((l) => l.label === lb)?.done)
  }
  return !linked
}

export function renderDay(ctx) {
  const today = localDate(new Date())
  const { dayStart, dayEnd } = ctx.settings
  const ach = dayAchievement(ctx.plans, ctx.actuals, ctx.courses)

  const top = h('div', { class: 'top' },
    h('div', { class: 'date' },
      h('button', { class: 'ghost icon', 'aria-label': '전날', onClick: () => ctx.setDate(shiftDate(ctx.date, -1)) }, '‹'),
      h('span', {}, dateLabel(ctx.date)),
      h('button', { class: 'ghost icon', 'aria-label': '다음날', onClick: () => ctx.setDate(shiftDate(ctx.date, 1)) }, '›'),
      ctx.date !== today && h('button', { class: 'ghost', onClick: () => ctx.setDate(today) }, '오늘')),
    h('div', { class: 'stats' },
      h('span', {}, '계획 ', h('b', {}, fmtMin(ach.plannedMin))),
      h('span', {}, '실제 ', h('b', {}, fmtMin(ach.actualMin))),
      h('span', {}, '달성 ', h('b', {}, `${ach.percent}%`)),
      h('button', { class: 'ghost icon', 'aria-label': '설정', onClick: () => openSettings(ctx) }, '⚙︎')))

  const out = [top]
  const hasData = ctx.courses.length || ctx.allPlans.length || ctx.allActuals.length
  if (hasData && needsBackupReminder(ctx.settings.lastBackupAt, new Date())) {
    out.push(h('div', { class: 'banner' }, h('span', {}, '일주일 넘게 백업을 안 했어요. 사파리가 오래된 데이터를 지울 수 있어요.'),
      h('button', { onClick: () => openSettings(ctx) }, '백업하기')))
  }

  const rows = slots(dayStart, dayEnd)
  const base = toMin(dayStart)
  const end = toMin(dayEnd)
  const rowSpan = (s, e) => {
    const a = Math.max(0, Math.floor((toMin(s) - base) / SLOT))
    const b = Math.min(rows.length, Math.max(a + 1, Math.ceil((toMin(e) - base) / SLOT)))
    return a < rows.length && toMin(e) > base ? `${a + 1} / ${b + 1}` : null
  }

  const grid = h('div', { class: 'grid', style: { gridTemplateRows: `repeat(${rows.length}, var(--row))` } })
  rows.forEach((t, i) => {
    const half = t.endsWith(':30')
    const r = `${i + 1}`
    const next = toHHMM(Math.min(toMin(t) + SLOT, end))
    grid.append(
      h('div', { class: 'tlabel' + (half ? ' half' : ''), style: { gridRow: r, gridColumn: '1' } }, t),
      h('button', { class: 'cell' + (half ? ' half' : ''), style: { gridRow: r, gridColumn: '2' }, 'aria-label': `${t} 계획 추가`,
        onClick: () => openPlanEditor(ctx, { start: t, end: next }) }),
      h('button', { class: 'cell' + (half ? ' half' : ''), style: { gridRow: r, gridColumn: '3' }, 'aria-label': `${t} 한 것 기록`,
        onClick: () => openPicker(ctx, { title: '무엇을 했나요?', onPick: (choice) => {
          const plan = choice.planId && ctx.plans.find((p) => p.id === choice.planId)
          const s = t
          const e = plan && toMin(plan.end) > toMin(t) ? plan.end : next
          openActualEditor(ctx, { ...choice, start: s, end: e, source: 'manual' })
        } }) }))
  })

  for (const p of ctx.plans) {
    const span = rowSpan(p.start, p.end); if (!span) continue
    const { title, sub } = blockTitle(ctx, p)
    grid.append(h('button', { class: 'blk p' + (isMiss(ctx, p, today) ? ' miss' : ''), style: { gridRow: span, gridColumn: '2' },
      onClick: () => openPlanEditor(ctx, p) }, h('b', {}, title), h('small', {}, [sub, `${p.start}–${p.end}`].filter(Boolean).join(' · '))))
  }
  for (const a of ctx.actuals) {
    const span = rowSpan(a.start, a.end); if (!span) continue
    const { title, sub } = blockTitle(ctx, a)
    grid.append(h('button', { class: 'blk ' + (a.planId ? 'd' : 'o'), style: { gridRow: span, gridColumn: '3' },
      onClick: () => openActualEditor(ctx, a) }, h('b', {}, (a.planId ? '✓ ' : '') + title),
      h('small', {}, [sub, `${a.start}–${a.end}`, a.source === 'timer' ? '타이머' : ''].filter(Boolean).join(' · '))))
  }
  const tm = ctx.settings.timer
  if (tm && localDate(new Date(tm.startedAt)) === ctx.date) {
    const s = new Date(tm.startedAt)
    const st = toHHMM(s.getHours() * 60 + s.getMinutes())
    const now = new Date()
    const en = localDate(now) === ctx.date ? toHHMM(Math.min(now.getHours() * 60 + now.getMinutes() + 1, end)) : dayEnd
    const span = rowSpan(st, en)
    if (span) grid.append(h('div', { class: 'blk running', style: { gridRow: span, gridColumn: '3' } }, h('b', {}, '기록 중…'), h('small', {}, `${st}부터`)))
  }

  const panel = h('section', { class: 'panel' },
    h('h2', {}, '시간표', h('span', { class: 'muted' }, '빈칸을 눌러 추가')),
    h('div', { class: 'heads' }, h('span'), h('span', {}, '계획'), h('span', {}, '실제로 한 것')),
    grid)
  return { top: out, grid: panel }
}
