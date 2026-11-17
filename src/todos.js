// TO DO tab: things with a deadline (수행평가, 시험, 숙제) or no date at all.

const days = (a, b) => {
  const d = (s) => { const [y, m, dd] = s.split('-').map(Number); return Date.UTC(y, m - 1, dd) }
  return Math.round((d(a) - d(b)) / 86400000)
}

const GROUPS = [['late', '지난 것'], ['today', '오늘'], ['week', '7일 안'], ['later', '나중'], ['none', '날짜 없음'], ['done', '끝낸 것']]

function groupOf(t, today) {
  if (t.done) return 'done'
  if (!t.due) return 'none'
  const n = days(t.due, today)
  return n < 0 ? 'late' : n === 0 ? 'today' : n <= 7 ? 'week' : 'later'
}

// Groups in reading order, empty ones left out. Open items by deadline, finished ones newest first.
export function groupTodos(todos, today) {
  const by = new Map(GROUPS.map(([k]) => [k, []]))
  for (const t of todos) by.get(groupOf(t, today)).push(t)
  for (const [k, items] of by) {
    if (k === 'done') items.sort((a, b) => ((a.doneAt || '') < (b.doneAt || '') ? 1 : -1))
    else items.sort((a, b) => ((a.due || '') + (a.createdAt || '') < (b.due || '') + (b.createdAt || '') ? -1 : 1))
  }
  return GROUPS.map(([key, label]) => ({ key, label, items: by.get(key) })).filter((g) => g.items.length)
}

export function dueLabel(due, today) {
  if (!due) return ''
  const n = days(due, today)
  return n > 0 ? `D-${n}` : n === 0 ? '오늘' : `${-n}일 지남`
}

// Open items due within `within` days of today (or already late): the number shown on the tab.
export function urgentCount(todos, today, within = 0) {
  return todos.filter((t) => !t.done && t.due && days(t.due, today) <= within).length
}

export function validateTodo(t) {
  if (!t.title || !t.title.trim()) return '할 일을 적어 주세요'
  if (t.due) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t.due)
    const d = m && new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    if (!d || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return '날짜를 다시 골라 주세요'
  }
  if (t.repeat?.every === 'week' && !t.repeat.days?.length) return '반복할 요일을 하나 이상 골라 주세요'
  return null
}

// ── Repeating todos: { every: 'day' } | { every: 'week', days: [0–6] } | { every: 'month', day: 1–31 } ──

const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d) }
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const addDays = (s, n) => { const d = parse(s); return iso(new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)) }

function matches(repeat, date) {
  const d = parse(date)
  if (repeat.every === 'day') return true
  if (repeat.every === 'week') return (repeat.days || []).includes(d.getDay())
  if (repeat.every === 'month') {
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
    return d.getDate() === Math.min(repeat.day, last) // 31일 in a 30-day month falls on the 30th
  }
  return false
}

// First date on or after `from` that the rule lands on.
export function firstOccurrence(repeat, from) {
  for (let i = 0, d = from; i < 400; i++, d = addDays(d, 1)) if (matches(repeat, d)) return d
  return null
}
export const nextOccurrence = (repeat, after) => firstOccurrence(repeat, addDays(after, 1))

const WD = ['일', '월', '화', '수', '목', '금', '토']
export function repeatLabel(repeat) {
  if (!repeat) return ''
  if (repeat.every === 'day') return '매일'
  if (repeat.every === 'month') return `매달 ${repeat.day}일`
  const ds = [...(repeat.days || [])].sort()
  if (ds.join() === '1,2,3,4,5') return '평일마다'
  if (ds.join() === '0,6') return '주말마다'
  return `매주 ${ds.map((i) => WD[i]).join('·')}`
}

// Ticking a todo off. A repeating one leaves a finished copy behind and moves on to its next date.
export function completeTodo(t, today, now) {
  if (!t.repeat) return [{ ...t, done: true, doneAt: now }]
  const copy = { title: t.title, due: t.due, done: true, doneAt: now, subjectId: t.subjectId, note: t.note || '', fromRepeat: t.id, createdAt: now }
  let next = nextOccurrence(t.repeat, t.due || today)
  if (next && next < today) next = firstOccurrence(t.repeat, today)
  return [copy, { ...t, due: next }]
}

// Calendar rows for the month holding `date`: whole weeks starting on `weekStart` (0 = Sunday).
// Each cell carries the todos due that day; repeating todos also show their coming dates as ghosts.
export function monthGrid(date, todos, weekStart = 0) {
  const [y, m] = date.split('-').map(Number)
  const first = new Date(y, m - 1, 1)
  const last = new Date(y, m, 0)
  const lead = (first.getDay() - weekStart + 7) % 7
  const weeks = []
  for (let d = new Date(y, m - 1, 1 - lead); d <= last; ) {
    const week = []
    for (let i = 0; i < 7; i++, d = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)) {
      const key = iso(d)
      const real = todos.filter((t) => t.due === key)
      const ghosts = todos.filter((t) => t.repeat && !t.done && t.due && key > t.due && matches(t.repeat, key)).map((t) => ({ ...t, ghost: true }))
      const rank = (t) => (t.done ? 2 : t.ghost ? 1 : 0)
      week.push({ date: key, inMonth: d.getMonth() === m - 1, items: [...real, ...ghosts].sort((a, b) => rank(a) - rank(b)) })
    }
    weeks.push(week)
  }
  return weeks
}
