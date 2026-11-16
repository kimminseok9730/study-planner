import { h } from '../ui.js'
import { toMin, toHHMM, localDate, dday, clock, studyDate } from '../time.js'
import { dayAchievement, formatLabels, planStatus, timeTableCells, subjectTotals } from '../model.js'
import { needsBackupReminder } from '../backup.js'
import { openPlanEditor, openActualEditor } from './editors.js'
import { openPicker } from './picker.js'
import { openSettings } from './settings.js'

const WD = ['일', '월', '화', '수', '목', '금', '토']
const MARK = { done: '○', partial: '△', missed: '✕', todo: '' }

function shiftDate(date, days) {
  const [y, m, d] = date.split('-').map(Number)
  return localDate(new Date(y, m - 1, d + days))
}
const hm = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`

export function blockTitle(ctx, b) {
  if (b.kind === 'lecture') {
    const c = ctx.courseById(b.courseId)
    return { title: c ? c.name : '삭제된 강좌', sub: formatLabels(b.labels) }
  }
  return { title: b.text || '할 일', sub: '' }
}

export function renderHead(ctx) {
  const today = ctx.today()
  const [, m, d] = ctx.date.split('-').map(Number)
  const wd = WD[new Date(ctx.date + 'T00:00').getDay()]
  const ach = dayAchievement(ctx.plans, ctx.actuals, ctx.courses)
  const dd = ctx.settings.dday
  const memo = h('input', { type: 'text', id: 'memo', value: ctx.settings.memos?.[ctx.date] || '', placeholder: '오늘 한 줄', 'aria-label': '메모',
    onChange: async () => { await ctx.store.saveSettings({ memos: { ...(ctx.settings.memos || {}), [ctx.date]: memo.value.trim() } }); ctx.settings.memos = { ...(ctx.settings.memos || {}), [ctx.date]: memo.value.trim() } } })

  const head = h('div', { class: 'head' },
    h('div', { class: 'datecell' },
      h('button', { class: 'ghost icon', 'aria-label': '전날', onClick: () => ctx.setDate(shiftDate(ctx.date, -1)) }, '‹'),
      h('span', {}, h('small', {}, 'DATE'), h('br'), h('b', {}, `${m}.${String(d).padStart(2, '0')}`), ` ${wd}`),
      h('button', { class: 'ghost icon', 'aria-label': '다음날', onClick: () => ctx.setDate(shiftDate(ctx.date, 1)) }, '›'),
      ctx.date !== today && h('button', { class: 'ghost', onClick: () => ctx.setDate(today) }, '오늘')),
    h('div', {}, h('small', {}, dd?.label ? dd.label.toUpperCase() : 'D-DAY'),
      h('button', { class: 'cellbtn', 'aria-label': 'D-day 설정', onClick: () => openSettings(ctx) }, dd?.date ? dday(dd.date, today) : '설정')),
    h('div', {}, h('small', {}, 'TOTAL'), h('b', {}, hm(ach.actualMin))),
    h('div', {}, h('small', {}, `달성 · 계획 ${hm(ach.plannedMin)}`), h('b', {}, `${ach.percent}%`)),
    h('div', { class: 'memo' }, h('small', {}, 'MEMO'), memo),
    h('div', {}, h('button', { class: 'ghost icon', 'aria-label': '설정', onClick: () => openSettings(ctx) }, '⚙︎')))

  const out = [head]
  const hasData = ctx.courses.length || ctx.allPlans.length || ctx.allActuals.length
  if (hasData && needsBackupReminder(ctx.settings.lastBackupAt, new Date())) {
    out.push(h('div', { class: 'banner' }, h('span', {}, '일주일 넘게 백업을 안 했어요. 사파리가 오래된 데이터를 지울 수 있어요.'),
      h('button', { onClick: () => openSettings(ctx) }, '백업하기')))
  }
  return out
}

export function renderPlans(ctx) {
  const today = ctx.today()
  const plans = ctx.plans.slice().sort((a, b) => toMin(a.start) - toMin(b.start))
  const list = h('div', {})
  for (const p of plans) {
    const st = planStatus(p, ctx.allActuals, ctx.courses, today)
    const { title, sub } = blockTitle(ctx, p)
    list.append(h('button', { class: `line ${st}`, onClick: () => openPlanEditor(ctx, p) },
      h('span', { class: 'box', 'aria-label': { done: '다 함', partial: '덜 함', missed: '못 함', todo: '아직' }[st] }, MARK[st]),
      h('span', { class: 'tag hl', style: { '--c': ctx.colorOf(p) } }),
      h('span', { class: 'what' }, h('span', {}, title), sub && h('small', {}, sub)),
      h('span', { class: 'when' }, `${clock(p.start)}–${clock(p.end)}`)))
  }
  list.append(h('button', { class: 'line add', onClick: () => openPlanEditor(ctx, nextSlot(ctx)) }, '＋ 계획 쓰기'))
  return h('section', {}, h('h3', { class: 'sec' }, h('span', {}, 'PLAN'), h('span', {}, '○ 다 함 · △ 덜 함 · ✕ 못 함')), list)
}

// A free hour after the last plan (or from now, on today).
export function nextSlot(ctx) {
  const { dayStart, dayEnd } = ctx.settings
  let s = Math.max(toMin(dayStart), ...ctx.plans.map((p) => toMin(p.end)))
  if (ctx.date === ctx.today() && !ctx.plans.length) s = Math.max(s, Math.ceil(ctx.nowMin() / 30) * 30)
  s = Math.min(s, toMin(dayEnd) - 30)
  return { start: toHHMM(s), end: toHHMM(Math.min(s + 60, toMin(dayEnd))) }
}

export function renderTimeTable(ctx) {
  const { dayStart, dayEnd } = ctx.settings
  const done = timeTableCells(ctx.actuals, dayStart, dayEnd)
  const planned = timeTableCells(ctx.plans, dayStart, dayEnd)
  const tm = ctx.settings.timer
  const tmStart = tm && new Date(tm.startedAt)
  const running = tm && studyDate(tmStart, dayEnd) === ctx.date
    ? { s: Math.floor((tmStart - new Date(ctx.date + 'T00:00')) / 60000), e: ctx.today() === ctx.date ? ctx.nowMin() + 1 : toMin(dayEnd), c: ctx.colorOf(tm) }
    : null

  const tt = h('div', { class: 'tt' })
  done.forEach((row, r) => {
    tt.append(h('span', { class: 'hr' }, String(row.hour % 24).padStart(2, '0')))
    row.cells.forEach((a, i) => {
      const startMin = row.hour * 60 + i * 10
      const t = toHHMM(startMin)
      const shown = clock(t)
      const p = planned[r].cells[i]
      const isRun = !a && running && startMin < running.e && startMin + 10 > running.s
      const style = {}
      if (a) style['--c'] = ctx.colorOf(a)
      if (isRun) style['--c'] = running.c
      if (p) style['--pc'] = ctx.colorOf(p)
      const label = a ? `${shown} ${blockTitle(ctx, a).title}` : `${shown} 한 것 기록`
      tt.append(h('button', { class: 'cell' + (i === 5 ? ' c6' : '') + (p && !a && !isRun ? ' planned' : '') + (isRun ? ' running' : ''), style, 'aria-label': label,
        onClick: () => {
          if (a) return openActualEditor(ctx, a)
          openPicker(ctx, { title: '무엇을 했나요?', onPick: (choice) => {
            const plan = choice.planId && ctx.plans.find((x) => x.id === choice.planId)
            const end = plan && toMin(plan.end) > startMin ? plan.end : toHHMM(Math.min(startMin + 30, toMin(dayEnd)))
            openActualEditor(ctx, { ...choice, start: t, end, source: 'manual' })
          } })
        } }))
    })
  })

  const totals = subjectTotals(ctx.actuals, ctx.courses, ctx.allPlans)
  const legend = h('div', { class: 'totals' }, totals.map(({ subjectId, minutes }) => {
    const s = ctx.subjectById(subjectId)
    return h('span', {}, h('i', { class: 'hl', style: { '--c': s.color } }), `${s.name} `, h('b', {}, hm(minutes)))
  }))
  if (!totals.length) legend.append(h('span', { class: 'muted' }, '빈칸을 누르거나 아래에서 타이머를 켜면 과목 색으로 칠해져요.'))

  return h('section', {},
    h('h3', { class: 'sec' }, h('span', {}, 'TIME TABLE'), h('span', {}, '한 칸 = 10분 · 빗금 = 계획 · 칠한 칸 = 한 것')),
    h('div', { class: 'tthead' }, h('span'), ...[10, 20, 30, 40, 50, 60].map((n) => h('span', {}, n))),
    tt, legend)
}
