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
