// Pure time helpers. Times are 'HH:MM' strings ('24:00' allowed as an end), dates are local 'YYYY-MM-DD'.

export const SLOT = 30

export function toMin(hhmm) {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export function toHHMM(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function slots(dayStart, dayEnd) {
  const out = []
  for (let t = toMin(dayStart); t < toMin(dayEnd); t += SLOT) out.push(toHHMM(t))
  return out
}

export function duration(start, end) {
  return toMin(end) - toMin(start)
}

export function validateBlock(block, others) {
  const s = toMin(block.start)
  const e = toMin(block.end)
  if (e <= s) return '끝 시간이 시작 시간보다 늦어야 해요'
  for (const o of others) {
    if (block.id && o.id === block.id) continue
    if (s < toMin(o.end) && toMin(o.start) < e) return '다른 블록과 시간이 겹쳐요'
  }
  return null
}

const pad = (n) => String(n).padStart(2, '0')

export function localDate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Turn a timer run into a block on the start date, clipped to the day end. Returns null if under a minute.
export function clipTimerToDay(startedAt, now, dayEnd) {
  const date = localDate(startedAt)
  const startMin = startedAt.getHours() * 60 + startedAt.getMinutes()
  const dayEndMs = new Date(startedAt.getFullYear(), startedAt.getMonth(), startedAt.getDate()).getTime() + toMin(dayEnd) * 60000
  const endMs = Math.min(now.getTime(), dayEndMs)
  const minutes = Math.floor(endMs / 60000) - Math.floor(startedAt.getTime() / 60000)
  if (minutes < 1) return null
  const endMin = Math.min(startMin + minutes, toMin(dayEnd))
  if (endMin <= startMin) return null
  return { date, start: toHHMM(startMin), end: toHHMM(endMin), minutes: endMin - startMin }
}

// When the app wakes up on a new day, move a view that was showing "today" to the new today.
export function rollDate(viewDate, lastToday, nowToday) {
  return viewDate === lastToday && lastToday !== nowToday ? nowToday : viewDate
}

// 'D-367' before, 'D-DAY' on, 'D+2' after.
export function dday(target, today) {
  const d = (s) => { const [y, m, dd] = s.split('-').map(Number); return Date.UTC(y, m - 1, dd) }
  const n = Math.round((d(target) - d(today)) / 86400000)
  return n > 0 ? `D-${n}` : n === 0 ? 'D-DAY' : `D+${-n}`
}
