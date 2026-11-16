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

// A study day can run past midnight (dayEnd '26:00' = 02:00 next morning). Times after midnight are
// stored on the day they belong to as '24:30', '25:10', … and shown with clock().
export function studyDate(now, dayEnd) {
  const over = toMin(dayEnd) - 1440
  const nowMin = now.getHours() * 60 + now.getMinutes()
  if (over > 0 && nowMin < over) return localDate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  return localDate(now)
}

// Minutes since the study date's midnight (can exceed 1440).
export function studyNowMin(now, dayEnd) {
  const nowMin = now.getHours() * 60 + now.getMinutes()
  return studyDate(now, dayEnd) === localDate(now) ? nowMin : nowMin + 1440
}

// '25:30' → '01:30' for display.
export function clock(hhmm) {
  return toHHMM(toMin(hhmm) % 1440)
}

// Turn a timer run into a block on its study date, clipped to the day end (never earlier than midnight,
// so late study is not dropped). Returns null if under a minute.
export function clipTimerToDay(startedAt, now, dayEnd) {
  const date = studyDate(startedAt, dayEnd)
  const [y, m, d] = date.split('-').map(Number)
  const base = new Date(y, m - 1, d).getTime()
  const startMin = Math.floor((startedAt.getTime() - base) / 60000)
  const limit = Math.max(toMin(dayEnd), 1440)
  const endMin = Math.min(Math.floor((now.getTime() - base) / 60000), limit)
  if (endMin - startMin < 1) return null
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
