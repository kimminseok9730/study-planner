import { duration } from './time.js'

export function courseProgress(course) {
  const total = course.lectures.length
  const done = course.lectures.filter((l) => l.done).length
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 }
}

export function dayAchievement(plans, actuals, courses) {
  const byId = new Map(courses.map((c) => [c.id, c]))
  let plannedMin = 0
  let achieved = 0
  for (const p of plans) {
    const d = duration(p.start, p.end)
    plannedMin += d
    if (p.kind === 'lecture') {
      const c = byId.get(p.courseId)
      const labels = p.labels || []
      if (!c || !labels.length) continue
      const done = labels.filter((lb) => c.lectures.some((l) => l.label === lb && l.done)).length
      achieved += d * (done / labels.length)
    } else {
      const spent = actuals.filter((a) => a.planId === p.id).reduce((s, a) => s + a.minutes, 0)
      achieved += Math.min(d, spent)
    }
  }
  const actualMin = actuals.reduce((s, a) => s + a.minutes, 0)
  return { plannedMin, actualMin, percent: plannedMin ? Math.round((achieved / plannedMin) * 100) : 0 }
}

// Unfinished work from days before `today`, not yet re-planned.
export function backlog(plans, courses, actuals, today) {
  const byId = new Map(courses.map((c) => [c.id, c]))
  const upcoming = plans.filter((p) => p.date >= today)
  const carried = new Set(plans.map((p) => p.fromPlanId).filter(Boolean))
  const past = plans.filter((p) => p.date < today).sort((a, b) => (a.date + a.start < b.date + b.start ? 1 : -1))
  const seen = new Set()
  const items = []
  for (const p of past) {
    if (p.kind === 'lecture') {
      const c = byId.get(p.courseId)
      if (!c) continue
      const labels = (p.labels || []).filter((lb) => {
        const key = p.courseId + '|' + lb
        if (seen.has(key)) return false
        const lec = c.lectures.find((l) => l.label === lb)
        if (!lec || lec.done) return false
        if (upcoming.some((u) => u.kind === 'lecture' && u.courseId === p.courseId && (u.labels || []).includes(lb))) return false
        seen.add(key)
        return true
      })
      if (labels.length) items.push({ kind: 'lecture', courseId: p.courseId, labels, fromPlanId: p.id })
    } else {
      if (carried.has(p.id)) continue
      if (actuals.some((a) => a.planId === p.id)) continue
      items.push({ kind: 'text', text: p.text, fromPlanId: p.id })
    }
  }
  return items
}

// ['12','13','14'] → '12~14강'; mixed or gapped → '3, 5강'
export function formatLabels(labels) {
  if (!labels || !labels.length) return ''
  const nums = labels.every((l) => /^\d+$/.test(l)) ? labels.map(Number) : null
  if (nums && nums.length > 1 && nums.every((n, i) => i === 0 || n === nums[i - 1] + 1)) return `${nums[0]}~${nums.at(-1)}강`
  return labels.join(', ') + '강'
}

// ── Subjects, plan status, 10-minute time table ──

export const DEFAULT_SUBJECTS = [
  { id: 'kor', name: '국어', color: '#ff9f8a' },
  { id: 'math', name: '수학', color: '#8fb4ff' },
  { id: 'eng', name: '영어', color: '#8fe0b6' },
  { id: 'sci', name: '탐구', color: '#ffd866' },
  { id: 'etc', name: '기타', color: '#d5d1c6' },
]

// Subject of a plan or record: lectures follow their course, text follows itself or its plan.
export function subjectOf(block, courses, plans) {
  if (block.kind === 'lecture') return courses.find((c) => c.id === block.courseId)?.subjectId || 'etc'
  if (block.subjectId) return block.subjectId
  if (block.planId) return plans.find((p) => p.id === block.planId)?.subjectId || 'etc'
  return 'etc'
}

// 'done' ○ · 'partial' △ · 'missed' ✕ · 'todo' (blank)
export function planStatus(plan, actuals, courses, today) {
  const linked = actuals.some((a) => a.planId === plan.id)
  if (plan.kind === 'lecture') {
    const c = courses.find((x) => x.id === plan.courseId)
    const labels = plan.labels || []
    const done = c ? labels.filter((lb) => c.lectures.some((l) => l.label === lb && l.done)).length : 0
    if (labels.length && done === labels.length) return 'done'
    if (done > 0 || linked) return 'partial'
  } else if (linked) return 'done'
  return plan.date < today ? 'missed' : 'todo'
}

// Rows of six 10-minute cells per hour; each cell holds the block that covers most of it, or null.
export function timeTableCells(blocks, dayStart, dayEnd) {
  const min = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m }
  const spans = blocks.map((b) => ({ b, s: min(b.start), e: min(b.end) }))
  const rows = []
  for (let hour = Math.floor(min(dayStart) / 60); hour * 60 < min(dayEnd); hour++) {
    const cells = []
    for (let i = 0; i < 6; i++) {
      const cs = hour * 60 + i * 10, ce = cs + 10
      let best = null, bestOv = 0
      for (const { b, s, e } of spans) {
        const ov = Math.min(e, ce) - Math.max(s, cs)
        if (ov > bestOv) { best = b; bestOv = ov }
      }
      cells.push(best)
    }
    rows.push({ hour, cells })
  }
  return rows
}

export function subjectTotals(actuals, courses, plans) {
  const sum = new Map()
  for (const a of actuals) {
    const id = subjectOf(a, courses, plans)
    sum.set(id, (sum.get(id) || 0) + a.minutes)
  }
  return [...sum].map(([subjectId, minutes]) => ({ subjectId, minutes })).sort((x, y) => y.minutes - x.minutes)
}

export function guessSubject(name) {
  if (/수학|미적|확통|확률|기하|대수/.test(name)) return 'math'
  if (/국어|문학|독서|언매|화작|문법|비문학/.test(name)) return 'kor'
  if (/영어|영문|구문|영단어|English/i.test(name)) return 'eng'
  if (/물리|화학|생명|생물|지구|과학|사회|사문|생윤|윤리|지리|역사|한국사|경제|정법|탐구/.test(name)) return 'sci'
  return 'etc'
}
