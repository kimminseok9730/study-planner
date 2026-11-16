const APP = 'study-planner'
const VERSION = 1
const KEYS = ['courses', 'plans', 'actuals']

// A running timer is never carried in a backup: restoring it later would create a huge block.
export function makeBackup(data, now) {
  return { app: APP, version: VERSION, exportedAt: now.toISOString(), ...data, settings: { ...data.settings, timer: null } }
}

const isStr = (v) => typeof v === 'string' && v.length > 0
const VALID = {
  courses: (c) => isStr(c.name) && Array.isArray(c.lectures) && c.lectures.every((l) => l && isStr(l.label) && typeof l.done === 'boolean'),
  plans: (p) => isStr(p.date) && isStr(p.start) && isStr(p.end) && (p.kind === 'text' || (p.kind === 'lecture' && Array.isArray(p.labels))),
  actuals: (a) => isStr(a.date) && isStr(a.start) && isStr(a.end) && typeof a.minutes === 'number' && (a.kind === 'text' || a.kind === 'lecture'),
}

export function parseBackup(jsonText) {
  let b
  try { b = JSON.parse(jsonText) } catch { return { ok: false, error: '백업 파일을 읽을 수 없어요' } }
  const notOurs = { ok: false, error: '공부 기록장 백업 파일이 아니에요' }
  if (!b || typeof b !== 'object' || b.app !== APP) return notOurs
  if (typeof b.version !== 'number') return notOurs
  if (b.version > VERSION) return { ok: false, error: '더 새로운 버전의 백업이에요' }
  for (const k of KEYS) {
    if (!Array.isArray(b[k])) return notOurs
    if (!b[k].every((x) => x && typeof x.id === 'string' && VALID[k](x))) return notOurs
  }
  if (!b.settings || typeof b.settings !== 'object') return notOurs
  return { ok: true, data: { courses: b.courses, plans: b.plans, actuals: b.actuals, settings: { ...b.settings, timer: null } } }
}

export function needsBackupReminder(lastBackupAt, now) {
  if (!lastBackupAt) return true
  return now.getTime() - new Date(lastBackupAt).getTime() > 7 * 24 * 3600 * 1000
}
