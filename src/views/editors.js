import { h, openSheet, closeSheet, timeSelect, field, dangerButton, toast } from '../ui.js'
import { validateBlock, duration, toMin, toHHMM } from '../time.js'
import { formatLabels, unitWord } from '../model.js'
import { subjectButtons } from './courses.js'

// Lecture chips for one course. Returns { el, get(): string[] }.
export function lectureChips(course, selected = [], { hideDone = false, only = null, color = null } = {}) {
  const sel = new Set(selected)
  const el = h('div', { class: 'chips' })
  for (const l of course.lectures.slice().sort((a, b) => a.order - b.order)) {
    if (only && !only.includes(l.label)) continue
    if (hideDone && l.done && !sel.has(l.label)) continue
    const b = h('button', { type: 'button', class: 'chip' + (l.done ? ' isdone' : ''), style: color ? { '--c': color } : null, 'aria-pressed': String(sel.has(l.label)), title: l.title || '',
      onClick: () => { sel.has(l.label) ? sel.delete(l.label) : sel.add(l.label); b.setAttribute('aria-pressed', String(sel.has(l.label))) } },
    /^\d/.test(l.label) ? (course.unit === 'page' ? `p.${l.label}` : `${l.label}${unitWord(course)}`) : l.label)
    el.append(b)
  }
  if (!el.children.length) el.append(h('span', { class: 'muted' }, `남은 ${unitWord(course)}이 없어요`))
  const order = (lb) => course.lectures.find((l) => l.label === lb)?.order ?? 0
  return { el, get: () => [...sel].sort((a, b) => order(a) - order(b)) }
}

// Page books: "p. 12 ~ 30" instead of hundreds of chips. get() returns labels or an error string.
function pageRange(course, labels = []) {
  const items = course.lectures.slice().sort((a, b) => a.order - b.order)
  const first = items[0] ? Number(items[0].label) : 1
  const last = items.at(-1) ? Number(items.at(-1).label) : 1
  const next = Number(items.find((l) => !l.done)?.label ?? last)
  const from = h('input', { type: 'number', id: 'f-pfrom', inputMode: 'numeric', min: String(first), max: String(last), value: labels[0] || next, 'aria-label': '시작 쪽' })
  const to = h('input', { type: 'number', id: 'f-pto', inputMode: 'numeric', min: String(first), max: String(last), value: labels.at(-1) || Math.min(last, next + 9), 'aria-label': '끝 쪽' })
  const el = items.length
    ? h('div', { class: 'seg range' }, h('span', {}, 'p.'), from, h('span', {}, '~'), to)
    : h('span', { class: 'muted' }, '이 책의 쪽 범위를 먼저 정해 주세요')
  return {
    el,
    get() {
      const a = Math.floor(Number(from.value)), b = Math.floor(Number(to.value))
      if (!items.length) return '이 책의 쪽 범위를 먼저 정해 주세요'
      if (!(a >= first && b >= a && b <= last)) return `p.${first}~${last} 안에서 골라 주세요`
      return items.filter((l) => Number(l.label) >= a && Number(l.label) <= b).map((l) => l.label)
    },
  }
}

// Kind toggle + course/lecture or text inputs. Returns { el, read(): {kind, courseId?, labels?, text?} | string(error) }.
export function contentFields(ctx, init = {}) {
  let kind = init.kind || (ctx.courses.length ? 'lecture' : 'text')
  const seg = h('div', { class: 'seg' })
  const box = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } })
  let chips = null
  const courseSel = h('select', { id: 'f-course' }, ctx.courses.map((c) => h('option', { value: c.id }, c.name)))
  if (init.courseId) courseSel.value = init.courseId
  const textIn = h('input', { type: 'text', id: 'f-text', placeholder: '기출 풀이 수학 20문제', value: init.text || '' })
  const drawChips = (labels) => {
    const c = ctx.courseById(courseSel.value)
    if (c?.unit === 'page') { chips = pageRange(c, labels); return chips.el }
    chips = c ? lectureChips(c, labels, { hideDone: true, color: ctx.subjectById(c.subjectId).color }) : null
    return chips ? chips.el : h('span', { class: 'muted' }, '강좌를 먼저 추가해 주세요')
  }
  const chipBox = h('div')
  const subject = subjectButtons(ctx, init.subjectId || 'etc')
  courseSel.addEventListener('change', () => chipBox.replaceChildren(drawChips([])))
  const draw = () => {
    seg.replaceChildren(
      h('button', { type: 'button', 'aria-pressed': String(kind === 'lecture'), onClick: () => { kind = 'lecture'; draw() } }, '인강 · 책'),
      h('button', { type: 'button', 'aria-pressed': String(kind === 'text'), onClick: () => { kind = 'text'; draw() } }, '할 일'))
    if (kind === 'lecture') {
      if (!ctx.courses.length) { box.replaceChildren(h('p', { class: 'muted' }, '등록된 인강이나 책이 없어요. LECTURE · BOOK에서 먼저 추가해 주세요.')); return }
      chipBox.replaceChildren(drawChips(init.labels || []))
      box.replaceChildren(field('인강 · 책', courseSel), h('div', { class: 'field' }, h('span', {}, '어디를 (눌러서 선택)'), chipBox))
    } else box.replaceChildren(field('할 일', textIn), h('div', { class: 'field' }, h('span', {}, '과목'), subject.el))
  }
  draw()
  return {
    el: h('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } }, seg, box),
    read() {
      if (kind === 'lecture') {
        if (!ctx.courses.length) return '인강이나 책을 먼저 추가해 주세요'
        const labels = chips ? chips.get() : []
        if (typeof labels === 'string') return labels
        if (!labels.length) return '어디를 할지 하나 이상 골라 주세요'
        return { kind, courseId: courseSel.value, labels }
      }
      const text = textIn.value.trim()
      if (!text) return '할 일을 적어 주세요'
      return { kind, text, subjectId: subject.get() }
    },
  }
}

export function openPlanEditor(ctx, init) {
  const editing = Boolean(init.id)
  const { dayStart, dayEnd } = ctx.settings
  const startSel = timeSelect('f-start', dayStart, toHHMM(toMin(dayEnd) - 10), 10, init.start)
  const endSel = timeSelect('f-end', toHHMM(toMin(dayStart) + 10), dayEnd, 10, init.end)
  const content = contentFields(ctx, init)
  const err = h('p', { class: 'err', role: 'alert' })
  const save = async () => {
    const c = content.read()
    if (typeof c === 'string') return (err.textContent = c)
    const plan = { ...(editing ? init : {}), date: init.date || ctx.date, start: startSel.value, end: endSel.value, ...c }
    if (c.kind === 'lecture') { delete plan.text; delete plan.subjectId } else { delete plan.courseId; delete plan.labels }
    if (init.fromPlanId) plan.fromPlanId = init.fromPlanId
    const bad = validateBlock(plan, ctx.allPlans.filter((p) => p.date === plan.date))
    if (bad) return (err.textContent = bad)
    await ctx.store.put('plans', plan)
    closeSheet(); await ctx.refresh()
  }
  openSheet(editing ? 'PLAN 고치기' : 'PLAN 쓰기', [
    h('div', { class: 'row2' }, field('시작', startSel), field('끝', endSel)),
    content.el, err,
    h('div', { class: 'actions' },
      editing && dangerButton('삭제', async () => { await ctx.store.remove('plans', init.id); closeSheet(); await ctx.refresh() }),
      h('span', { class: 'spacer' }),
      h('button', { type: 'button', onClick: closeSheet }, '취소'),
      h('button', { type: 'button', class: 'primary', onClick: save }, '저장')),
  ])
}

// Manual or edited actual block.
export function openActualEditor(ctx, init) {
  const editing = Boolean(init.id)
  const { dayStart, dayEnd } = ctx.settings
  const startSel = timeSelect('f-astart', dayStart, dayEnd, 10, init.start)
  const endSel = timeSelect('f-aend', dayStart, dayEnd, 10, init.end)
  const err = h('p', { class: 'err', role: 'alert' })
  const { title, sub } = describe(ctx, init)
  const save = async () => {
    const a = { ...init, date: init.date || ctx.date, start: startSel.value, end: endSel.value }
    a.minutes = duration(a.start, a.end)
    if (a.minutes <= 0) return (err.textContent = '끝 시간이 시작 시간보다 늦어야 해요')
    const saved = await ctx.store.put('actuals', a)
    closeSheet()
    if (!editing && saved.kind === 'lecture') return confirmLectures(ctx, saved)
    await ctx.refresh()
  }
  openSheet(editing ? '기록 수정' : '한 것 기록', [
    h('p', {}, h('b', {}, title), sub ? ` · ${sub}` : ''),
    h('div', { class: 'row2' }, field('시작', startSel), field('끝', endSel)),
    err,
    h('div', { class: 'actions' },
      editing && dangerButton('삭제', async () => { await ctx.store.remove('actuals', init.id); closeSheet(); await ctx.refresh() }),
      h('span', { class: 'spacer' }),
      h('button', { type: 'button', onClick: closeSheet }, '취소'),
      h('button', { type: 'button', class: 'primary', onClick: save }, '저장')),
  ])
}

function describe(ctx, b) {
  if (b.kind === 'lecture') { const c = ctx.courseById(b.courseId); return { title: c?.name || '강좌', sub: formatLabels(b.labels, c) } }
  return { title: b.text || '할 일', sub: '' }
}

// After a lecture record: planned lectures pre-checked; confirm marks them done.
export function confirmLectures(ctx, actual) {
  const { courseId, labels } = actual
  const course = ctx.courseById(courseId)
  if (!course || !labels?.length) return ctx.refresh()
  const known = labels.filter((lb) => course.lectures.some((l) => l.label === lb))
  const chips = lectureChips(course, known, { only: known, color: ctx.subjectById(course.subjectId).color })
  const apply = async () => {
    const picked = new Set(chips.get())
    const now = new Date().toISOString()
    course.lectures = course.lectures.map((l) => (picked.has(l.label) && !l.done ? { ...l, done: true, doneAt: now } : l))
    await ctx.store.put('courses', course)
    if (actual.id && picked.size) await ctx.store.put('actuals', { ...actual, labels: chips.get() })
    closeSheet()
    toast(picked.size ? `${formatLabels(chips.get(), course)} 완료로 표시했어요` : '기록을 저장했어요')
  }
  const book = course.kind === 'book'
  openSheet(book ? '어디까지 했나요?' : '어디까지 들었나요?', [
    h('p', { class: 'muted' }, `${course.name} · 다 ${book ? '했으면' : '들었으면'} 확인만 누르세요. 못 한 ${unitWord(course)}은 눌러서 빼 주세요.`),
    chips.el,
    h('div', { class: 'actions' }, h('button', { type: 'button', class: 'primary', onClick: apply }, '확인')),
  ], { onClose: () => ctx.refresh() })
}
