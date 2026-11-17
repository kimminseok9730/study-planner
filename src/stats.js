// Numbers for the statistics sheet. Pure functions over stored plans and records.
import { localDate, studyDate } from './time.js'
import { dayAchievement, subjectTotals } from './model.js'

const at = (date, days = 0) => { const [y, m, d] = date.split('-').map(Number); return new Date(y, m - 1, d + days) }

// Monday to Sunday of the week holding `date`.
export function weekDates(date) {
  const back = (at(date).getDay() + 6) % 7
  return Array.from({ length: 7 }, (_, i) => localDate(at(date, i - back)))
}

export function monthDates(date) {
  const [y, m] = date.split('-').map(Number)
  const n = new Date(y, m, 0).getDate()
  return Array.from({ length: n }, (_, i) => localDate(new Date(y, m - 1, i + 1)))
}

// A date inside the period `n` weeks or months away.
export function shiftPeriod(date, mode, n) {
  if (mode === 'week') return localDate(at(date, 7 * n))
  const [y, m] = date.split('-').map(Number)
  return localDate(new Date(y, m - 1 + n, 1))
}

// One row per date: minutes studied, split by subject, and that day's achievement (null without plans).
export function dayRows(dates, actuals, plans, courses) {
  return dates.map((date) => {
    const a = actuals.filter((x) => x.date === date)
    const p = plans.filter((x) => x.date === date)
    return {
      date,
      minutes: a.reduce((s, x) => s + x.minutes, 0),
      parts: subjectTotals(a, courses, plans),
      percent: p.length ? dayAchievement(p, a, courses).percent : null,
    }
  })
}

export function summarize(rows) {
  const studied = rows.filter((r) => r.minutes > 0)
  const total = studied.reduce((s, r) => s + r.minutes, 0)
  const best = studied.reduce((b, r) => (!b || r.minutes > b.minutes ? { date: r.date, minutes: r.minutes } : b), null)
  const planned = rows.filter((r) => r.percent != null)
  const bySubject = new Map()
  for (const r of rows) for (const p of r.parts) bySubject.set(p.subjectId, (bySubject.get(p.subjectId) || 0) + p.minutes)
  return {
    total,
    studiedDays: studied.length,
    avg: studied.length ? Math.round(total / studied.length) : 0,
    best,
    percent: planned.length ? Math.round(planned.reduce((s, r) => s + r.percent, 0) / planned.length) : null,
    subjects: [...bySubject].map(([subjectId, minutes]) => ({ subjectId, minutes })).sort((x, y) => y.minutes - x.minutes),
  }
}

// Days in a row with at least one record. A still-empty today does not break the run.
export function streak(actuals, today) {
  const days = new Set(actuals.filter((a) => a.minutes > 0).map((a) => a.date))
  let d = days.has(today) ? today : localDate(at(today, -1))
  let n = 0
  while (days.has(d)) { n++; d = localDate(at(d, -1)) }
  return n
}

// Lectures ticked off on the given study days.
export function lecturesDone(courses, dates, dayEnd) {
  const set = new Set(dates)
  let n = 0
  for (const c of courses) for (const l of c.lectures) if (l.done && l.doneAt && set.has(studyDate(new Date(l.doneAt), dayEnd))) n++
  return n
}
