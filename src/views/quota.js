// TODAY: each 인강/책 with a goal date gets today's share, worked out from what is left.
import { h } from '../ui.js'
import { courseSchedule, formatLabels, unitWord } from '../model.js'
import { openPlanEditor } from './editors.js'
import { openCourse } from './courses.js'
import { nextSlot } from './day.js'

const md = (date) => { const [, m, d] = date.split('-').map(Number); return `${m}.${String(d).padStart(2, '0')}` }

// Returns null when no course has a goal, or when looking at a day other than today.
export function renderQuota(ctx) {
  const today = ctx.today()
  if (ctx.date !== today) return null
  const rows = []
  for (const c of ctx.courses) {
    const s = courseSchedule(c, today, ctx.settings.dayEnd)
    if (!s || s.status === 'empty' || s.status === 'finished') continue
    const color = ctx.subjectById(c.subjectId).color
    if (s.status === 'overdue') {
      rows.push(h('button', { class: 'line late', onClick: () => openCourse(ctx, c) },
        h('span', { class: 'box' }, '!'), h('span', { class: 'tag hl', style: { '--c': color } }),
        h('span', { class: 'what' }, h('span', {}, c.name), h('small', {}, `남은 ${s.remaining}${unitWord(c)}`)),
        h('span', { class: 'when' }, '끝낼 날짜 다시 정하기')))
      continue
    }
    if (!s.today.length) continue // not a study day for this one
    const left = s.today.filter((lb) => !c.lectures.find((l) => l.label === lb)?.done)
    const planned = ctx.plans.some((p) => p.kind === 'lecture' && p.courseId === c.id && left.length && left.every((lb) => (p.labels || []).includes(lb)))
    const st = !left.length ? 'done' : s.doneToday ? 'partial' : 'todo'
    rows.push(h('button', { class: `line ${st}`, onClick: () => (left.length && !planned ? openPlanEditor(ctx, { ...nextSlot(ctx), kind: 'lecture', courseId: c.id, labels: left }) : openCourse(ctx, c)) },
      h('span', { class: 'box', 'aria-label': { done: '다 함', partial: '덜 함', todo: '아직' }[st] }, { done: '○', partial: '△', todo: '' }[st]),
      h('span', { class: 'tag hl', style: { '--c': color } }),
      h('span', { class: 'what' }, h('span', {}, c.name), h('small', {}, formatLabels(s.today, c))),
      h('span', { class: 'when' }, !left.length ? `${md(s.end)}까지 ${s.daysLeft}일` : planned ? '계획에 있음' : '＋ 계획에 넣기')))
  }
  if (!rows.length) return null
  return h('section', {}, h('h3', { class: 'sec' }, h('span', {}, 'TODAY'), h('span', {}, '오늘 몫 · 목표 날짜까지 남은 걸 나눈 분량')), h('div', {}, rows))
}
