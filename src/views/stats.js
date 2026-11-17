// STATS: week or month at a glance — time per day, per subject, achievement, streak.
import { h, openSheet, closeSheet } from '../ui.js'
import { weekDates, monthDates, shiftPeriod, dayRows, summarize, streak, lecturesDone } from '../stats.js'

const WD = ['일', '월', '화', '수', '목', '금', '토']
const hm = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`
const md = (date) => { const [, m, d] = date.split('-').map(Number); return `${m}.${String(d).padStart(2, '0')}` }
const wd = (date) => WD[new Date(date + 'T00:00').getDay()]

export function openStats(ctx) {
  let mode = 'week'
  let anchor = ctx.date
  const body = h('div', { class: 'stats' })
  const datesOf = (a) => (mode === 'week' ? weekDates(a) : monthDates(a))
  const rowsOf = (a) => dayRows(datesOf(a), ctx.allActuals, ctx.allPlans, ctx.courses)

  const draw = () => {
    const today = ctx.today()
    const dates = datesOf(anchor)
    const rows = rowsOf(anchor)
    const sum = summarize(rows)
    const prev = summarize(rowsOf(shiftPeriod(anchor, mode, -1)))
    const title = mode === 'week' ? `${md(dates[0])} – ${md(dates[6])}` : `${dates[0].slice(0, 4)}.${dates[0].slice(5, 7)}`
    const word = mode === 'week' ? '지난주' : '지난달'
    const diff = sum.total - prev.total
    const compare = !sum.total && !prev.total ? '' : diff === 0 ? `${word}와 같아요` : `${word}보다 ${hm(Math.abs(diff))} ${diff > 0 ? '더' : '덜'} 했어요`

    const nav = h('div', { class: 'statnav' },
      h('div', { class: 'seg' },
        h('button', { type: 'button', 'aria-pressed': String(mode === 'week'), onClick: () => { mode = 'week'; draw() } }, '주'),
        h('button', { type: 'button', 'aria-pressed': String(mode === 'month'), onClick: () => { mode = 'month'; draw() } }, '월')),
      h('button', { class: 'ghost icon', 'aria-label': mode === 'week' ? '이전 주' : '이전 달', onClick: () => { anchor = shiftPeriod(anchor, mode, -1); draw() } }, '‹'),
      h('b', { class: 'mono' }, title),
      h('button', { class: 'ghost icon', 'aria-label': mode === 'week' ? '다음 주' : '다음 달', disabled: dates.at(-1) >= today, onClick: () => { anchor = shiftPeriod(anchor, mode, 1); draw() } }, '›'))

    const cell = (label, value, sub) => h('div', {}, h('small', {}, label), h('b', {}, value), sub && h('span', { class: 'muted' }, sub))
    const nums = h('div', { class: 'head nums' },
      cell('TOTAL', hm(sum.total)),
      cell('하루 평균', hm(sum.avg), `${sum.studiedDays}일 공부`),
      cell('달성', sum.percent == null ? '–' : `${sum.percent}%`),
      cell('들은 강의', `${lecturesDone(ctx.courses, dates, ctx.settings.dayEnd)}강`),
      cell('연속', `${streak(ctx.allActuals, today)}일`))

    // One bar per day, stacked in subject colours. Tap a bar to open that day.
    const top = Math.max(60, ...rows.map((r) => r.minutes))
    const chart = h('div', { class: 'bars' + (mode === 'month' ? ' month' : ''), style: { gridTemplateColumns: `repeat(${rows.length}, minmax(0, 1fr))` } },
      rows.map((r) => {
        const d = Number(r.date.slice(8))
        const label = mode === 'week' ? wd(r.date) : (d === 1 || d % 5 === 0 ? String(d) : '')
        return h('button', { class: 'bar' + (r.date === today ? ' today' : ''), 'aria-label': `${md(r.date)} ${wd(r.date)} ${hm(r.minutes)}`, disabled: r.date > today,
          onClick: () => { closeSheet(); ctx.setDate(r.date) } },
          h('span', { class: 'v' }, mode === 'week' && r.minutes ? hm(r.minutes) : ''),
          h('span', { class: 'stack', style: { height: `${(r.minutes / top) * 100}%` } },
            r.parts.map((p) => h('i', { class: 'hl', style: { '--c': ctx.subjectById(p.subjectId).color, flexGrow: String(p.minutes) } }))),
          h('span', { class: 'd' }, label))
      }))

    const subjects = h('div', {}, sum.subjects.map((s) => {
      const sub = ctx.subjectById(s.subjectId)
      const pct = Math.round((s.minutes / sum.total) * 100)
      return h('div', { class: 'subjbar' },
        h('span', {}, sub.name),
        h('span', { class: 'track' }, h('i', { class: 'hl', style: { '--c': sub.color, width: `${pct}%` } })),
        h('b', {}, hm(s.minutes)), h('small', {}, `${pct}%`))
    }))

    body.replaceChildren(nav, nums,
      compare && h('p', { class: 'muted' }, compare + (sum.best ? ` · 가장 많이 한 날 ${md(sum.best.date)} ${wd(sum.best.date)} ${hm(sum.best.minutes)}` : '')),
      h('h3', { class: 'sec' }, h('span', {}, 'DAILY'), h('span', {}, `막대를 누르면 그날로 · 맨 위 = ${hm(top)}`)),
      chart,
      h('h3', { class: 'sec' }, h('span', {}, 'SUBJECT'), h('span', {}, '과목별 시간')),
      sum.total ? subjects : h('p', { class: 'muted' }, '이 기간에는 기록이 없어요.'))
  }
  draw()
  openSheet('STATS', [body])
}
