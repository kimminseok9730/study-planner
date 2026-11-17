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

// Open items due today or already late: the number shown on the tab.
export function urgentCount(todos, today) {
  return todos.filter((t) => !t.done && t.due && t.due <= today).length
}

export function validateTodo(t) {
  if (!t.title || !t.title.trim()) return '할 일을 적어 주세요'
  if (t.due) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(t.due)
    const d = m && new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
    if (!d || d.getMonth() !== Number(m[2]) - 1 || d.getDate() !== Number(m[3])) return '날짜를 다시 골라 주세요'
  }
  return null
}
