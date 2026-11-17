import { h, openSheet, closeSheet, field, dangerButton } from '../ui.js'
import { courseProgress, guessSubject, unitWord, pageItems, courseSchedule, formatLabels } from '../model.js'
import { openImport } from './import.js'
import { photoBox, cropper } from './photo.js'

export const PLATFORMS = { mimac: '대성마이맥', mega: '메가스터디', etc: '기타' }
const WD = ['일', '월', '화', '수', '목', '금', '토']
const TICK_LIMIT = 80 // more items than this: a bar instead of one box per item

// Subject picker buttons. Returns { el, get() }.
export function subjectButtons(ctx, value) {
  let cur = value || 'etc'
  const el = h('div', { class: 'subj' })
  const draw = () => el.replaceChildren(...ctx.subjects.map((s) => h('button', { type: 'button', class: 'hl', style: { '--c': s.color }, 'aria-pressed': String(s.id === cur),
    onClick: () => { cur = s.id; draw() } }, s.name)))
  draw()
  return { el, get: () => cur }
}

const md = (date) => { const [, m, d] = date.split('-').map(Number); return `${m}.${String(d).padStart(2, '0')}` }

// One line about the goal: "하루 3강 · 11.27까지" or why there is no plan.
export function goalText(course, s) {
  if (!s) return ''
  const w = unitWord(course)
  if (s.status === 'finished') return '목표 끝!'
  if (s.status === 'empty') return `${w === '쪽' ? '쪽 범위' : '목록'}를 먼저 채워 주세요`
  if (s.status === 'overdue') return `끝낼 날짜(${md(s.end)})가 지났어요 · 남은 ${s.remaining}${w}`
  return `하루 ${s.perDay}${w} · ${md(s.end)}까지 ${s.daysLeft}일`
}

export function renderCourses(ctx) {
  const today = ctx.today()
  const list = h('div', {})
  for (const c of ctx.courses) {
    const p = courseProgress(c)
    const color = ctx.subjectById(c.subjectId).color
    const sorted = c.lectures.slice().sort((a, b) => a.order - b.order)
    const ticks = sorted.length > TICK_LIMIT
      ? h('div', { class: 'pbar', 'aria-hidden': 'true' }, h('i', { class: 'hl', style: { '--c': color, width: `${p.percent}%` } }))
      : h('div', { class: 'ticks', 'aria-hidden': 'true' }, sorted.map((l) => h('i', l.done ? { class: 'hl', style: { '--c': color } } : {})))
    const meta = [ctx.subjectById(c.subjectId).name, c.teacher, c.kind === 'book' ? '책' : PLATFORMS[c.platform]].filter(Boolean).join(' · ')
    const goal = goalText(c, courseSchedule(c, today, ctx.settings.dayEnd))
    const page = c.unit === 'page'
    const last = page && p.done ? [...sorted].reverse().find((l) => l.done) : null
    list.append(h('button', { class: 'teach', onClick: () => openCourse(ctx, c) },
      photoBox(c),
      h('span', { style: { minWidth: '0' } }, h('b', {}, c.name), h('small', {}, meta), goal && h('small', { class: 'goal' }, goal), ticks),
      h('span', { class: 'frac' }, page ? (last ? `p.${last.label}` : '시작 전') : `${p.done}/${p.total}`, h('small', {}, `${p.percent}%`))))
  }
  if (!ctx.courses.length) list.append(h('p', { class: 'muted' }, '듣는 인강이나 푸는 책을 추가하면 진도가 칠해져요.'))
  list.append(h('button', { class: 'line add', onClick: () => openAdd(ctx) }, '＋ 인강 · 책 추가'))
  return h('section', {}, h('h3', { class: 'sec' }, h('span', {}, 'LECTURE · BOOK'), h('span', {}, '목표 날짜를 정하면 하루 몫을 계산해요')), list)
}

function openAdd(ctx) {
  openSheet('추가', [
    h('h3', { class: 'sec' }, h('span', {}, '인강')),
    h('button', { class: 'primary', onClick: () => openImport(ctx) }, '캡처로 인강 추가 (강의 목록 화면)'),
    h('button', { onClick: () => openCourse(ctx, { name: '', kind: 'lecture', platform: 'mimac', teacher: '', lectures: [] }) }, '인강 직접 입력'),
    h('p', { class: 'muted' }, '캡처는 강의 목록이 보이게 찍어 주세요. 여러 장도 돼요.'),
    h('h3', { class: 'sec' }, h('span', {}, '책')),
    h('div', { class: 'actions', style: { justifyContent: 'flex-start' } },
      h('button', { onClick: () => openCourse(ctx, { name: '', kind: 'book', unit: 'page', teacher: '', lectures: [] }) }, '쪽수로 세는 책'),
      h('button', { onClick: () => openCourse(ctx, { name: '', kind: 'book', unit: 'unit', unitName: '단원', teacher: '', lectures: [] }) }, '단원 · 회차로 세는 책')),
    h('p', { class: 'muted' }, '개념서처럼 쭉 읽는 책은 쪽수, 문제집 · 모의고사처럼 끊어 푸는 책은 단원/회차가 편해요.'),
  ])
}

export function openCourse(ctx, course) {
  const editing = Boolean(course.id)
  const c = structuredClone(course)
  c.kind ||= 'lecture'
  const book = c.kind === 'book'
  const page = book && c.unit === 'page'
  const name = h('input', { type: 'text', id: 'c-name', value: c.name, placeholder: book ? '수능특강 수학 I' : 'Starting Block 수학 I' })
  const platform = h('select', { id: 'c-platform' }, Object.entries(PLATFORMS).map(([v, t]) => h('option', { value: v }, t)))
  platform.value = c.platform || 'etc'
  const teacher = h('input', { type: 'text', id: 'c-teacher', value: c.teacher || '', placeholder: book ? 'EBS' : '김범준' })
  const subject = subjectButtons(ctx, c.subjectId || guessSubject(c.name))
  const unitName = h('select', { id: 'c-unitname' }, ['단원', '회', '챕터', '강', 'Day'].map((u) => h('option', { value: u }, u)))
  unitName.value = c.unitName || '단원'
  const word = () => (book && !page ? unitName.value : unitWord(c))
  const err = h('p', { class: 'err', role: 'alert' })

  // Photo: teacher for 인강, cover for 책
  const photoArea = h('div', {})
  const fileIn = h('input', { type: 'file', id: 'c-photo', accept: 'image/*', style: { display: 'none' } })
  const drawPhoto = () => photoArea.replaceChildren(h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } },
    photoBox({ ...c, teacher: teacher.value, name: name.value }),
    h('div', { class: 'actions', style: { justifyContent: 'flex-start' } },
      h('button', { type: 'button', onClick: () => fileIn.click() }, c.photo ? '사진 바꾸기' : book ? '표지 사진 넣기' : '선생님 사진 넣기'),
      c.photo && h('button', { type: 'button', class: 'ghost', onClick: () => { delete c.photo; drawPhoto() } }, '사진 빼기'))))
  fileIn.addEventListener('change', () => {
    const f = fileIn.files[0]; fileIn.value = ''
    if (!f) return
    photoArea.replaceChildren(cropper(f, (dataUrl) => { if (dataUrl) c.photo = dataUrl; drawPhoto() }))
  })
  drawPhoto()

  // Items: chips for 인강 and 단원 books, a "read up to" box for page books
  const chips = h('div', { class: 'chips' })
  const count = h('span', { class: 'muted' })
  const sorted = () => c.lectures.sort((a, b) => a.order - b.order)
  const drawChips = () => {
    sorted()
    const color = ctx.subjectById(subject.get()).color
    const done = c.lectures.filter((l) => l.done).length
    if (page) {
      const last = [...c.lectures].reverse().find((l) => l.done)
      chips.replaceChildren(h('div', { class: 'pbar big' }, h('i', { class: 'hl', style: { '--c': color, width: `${c.lectures.length ? (done / c.lectures.length) * 100 : 0}%` } })))
      count.textContent = c.lectures.length
        ? `p.${c.lectures[0].label}~${c.lectures.at(-1).label} 중 ${done}쪽 함${last ? ` · 마지막 p.${last.label}` : ''}`
        : '아래에 쪽 범위를 넣어 주세요'
      return
    }
    chips.replaceChildren(...c.lectures.map((l) => h('button', { type: 'button', class: 'chip', style: { '--c': color }, 'aria-pressed': String(l.done), title: l.title || '',
      onClick: () => { l.done = !l.done; l.doneAt = l.done ? new Date().toISOString() : undefined; drawChips(); drawGoal() } }, l.label)))
    count.textContent = `${c.lectures.length}${word()} 중 ${done}${word()} ${book ? '함' : '들음'} · 눌러서 칠하기/지우기`
  }
  subject.el.addEventListener('click', drawChips)
  unitName.addEventListener('change', () => { drawChips(); drawGoal() })

  let fillRow
  if (page) {
    const from = h('input', { type: 'number', id: 'c-from', min: '1', max: '3000', inputMode: 'numeric', value: c.lectures[0]?.label || '1', 'aria-label': '시작 쪽' })
    const to = h('input', { type: 'number', id: 'c-to', min: '1', max: '3000', inputMode: 'numeric', value: c.lectures.at(-1)?.label || '', placeholder: '320', 'aria-label': '끝 쪽' })
    const upto = h('input', { type: 'number', id: 'c-upto', min: '0', max: '3000', inputMode: 'numeric', placeholder: '120', 'aria-label': '여기까지 한 쪽' })
    fillRow = h('div', { class: 'row2' },
      h('div', { class: 'field' }, h('span', {}, '쪽 범위'), h('div', { class: 'seg range' }, from, h('span', {}, '~'), to, h('button', { type: 'button', onClick: () => {
        const a = Math.floor(Number(from.value)), b = Math.floor(Number(to.value))
        if (!(a >= 1 && b >= a && b <= 3000)) return (err.textContent = '쪽 범위를 다시 넣어 주세요 (예: 1 ~ 320)')
        err.textContent = ''; c.lectures = pageItems(a, b, c.lectures); drawChips(); drawGoal()
      } }, '정하기'))),
      h('div', { class: 'field' }, h('span', {}, '여기까지 했어요'), h('div', { class: 'seg range' }, h('span', {}, 'p.'), upto, h('button', { type: 'button', onClick: () => {
        const n = Math.floor(Number(upto.value))
        if (!c.lectures.length) return (err.textContent = '쪽 범위를 먼저 정해 주세요')
        if (!(n >= 0)) return (err.textContent = '쪽 번호를 넣어 주세요')
        err.textContent = ''
        const now = new Date().toISOString()
        c.lectures = c.lectures.map((l) => (Number(l.label) <= n ? (l.done ? l : { ...l, done: true, doneAt: now }) : { label: l.label, order: l.order, done: false }))
        drawChips(); drawGoal()
      } }, '칠하기'))))
  } else {
    const total = h('input', { type: 'number', id: 'c-total', min: '1', max: '300', inputMode: 'numeric', placeholder: book ? '20' : '32' })
    fillRow = h('div', { class: 'field' }, h('span', {}, `총 ${book ? '개수' : '강 수'}로 채우기`), h('div', { class: 'seg' }, total, h('button', { type: 'button', onClick: () => {
      const n = Math.floor(Number(total.value))
      if (!(n >= 1 && n <= 300)) return (err.textContent = '1부터 300 사이 숫자를 넣어 주세요')
      err.textContent = ''
      for (let i = 1; i <= n; i++) if (!c.lectures.some((l) => l.label === String(i))) c.lectures.push({ label: String(i), order: i, done: false })
      drawChips(); drawGoal()
    } }, '채우기')))
  }

  // Goal: finish date + study weekdays → daily share
  const goalEnd = h('input', { type: 'date', id: 'c-goal', value: c.goal?.end || '' })
  let days = c.goal?.days?.length ? [...c.goal.days] : [1, 2, 3, 4, 5, 6]
  const dayBox = h('div', { class: 'subj days' })
  const goalOut = h('p', { class: 'muted', style: { margin: 0 } })
  const currentGoal = () => (goalEnd.value ? { end: goalEnd.value, days: [...days].sort() } : null)
  // Keep when the goal was set while it stays the same; a new or changed goal starts counting from now.
  const stamp = (g) => {
    const same = course.goal && g.end === course.goal.end && g.days.join() === [...(course.goal.days || [])].sort().join()
    return { ...g, setAt: same && course.goal.setAt ? course.goal.setAt : new Date().toISOString() }
  }
  const drawGoal = () => {
    dayBox.replaceChildren(...WD.map((w, i) => h('button', { type: 'button', 'aria-pressed': String(days.includes(i)),
      onClick: () => { days = days.includes(i) ? days.filter((x) => x !== i) : [...days, i]; drawGoal() } }, w)))
    const g = currentGoal()
    if (!g) return (goalOut.textContent = '끝낼 날짜를 고르면 하루에 얼마나 하면 되는지 계산해요.')
    if (!days.length) return (goalOut.textContent = '공부할 요일을 하나 이상 골라 주세요.')
    const probe = { ...c, unitName: book && !page ? unitName.value : c.unitName, goal: stamp(g) }
    const s = courseSchedule(probe, ctx.today(), ctx.settings.dayEnd)
    goalOut.textContent = goalText(probe, s) + (s?.status === 'ok' && s.today.length ? ` · 오늘 ${formatLabels(s.today, probe)}` : '')
  }
  goalEnd.addEventListener('change', drawGoal)
  drawChips(); drawGoal()

  const save = async () => {
    c.name = name.value.trim(); c.teacher = teacher.value.trim(); c.subjectId = !editing && subject.get() === 'etc' ? guessSubject(name.value) : subject.get()
    if (!book) c.platform = platform.value
    if (book && !page) c.unitName = unitName.value
    if (!c.name) return (err.textContent = book ? '책 이름을 적어 주세요' : '강좌 이름을 적어 주세요')
    const g = currentGoal()
    if (g && !days.length) return (err.textContent = '공부할 요일을 하나 이상 골라 주세요')
    if (g) c.goal = stamp(g); else delete c.goal
    await ctx.store.put('courses', c)
    closeSheet(); await ctx.refresh()
  }
  openSheet(book ? (editing ? 'BOOK' : 'NEW BOOK') : (editing ? 'LECTURE' : 'NEW LECTURE'), [
    photoArea, fileIn,
    field(book ? '책 이름' : '강좌 이름', name),
    h('div', { class: 'row2' }, field(book ? '출판사 (안 적어도 돼요)' : '선생님', teacher), book ? (page ? h('span') : field('세는 단위', unitName)) : field('사이트', platform)),
    h('div', { class: 'field' }, h('span', {}, '과목'), subject.el),
    fillRow, count, chips,
    h('h3', { class: 'sec' }, h('span', {}, 'GOAL'), h('span', {}, '목표 날짜와 공부하는 요일')),
    h('div', { class: 'row2' }, field('끝낼 날짜', goalEnd), h('div', { class: 'field' }, h('span', {}, '공부하는 요일'), dayBox)),
    goalOut, err,
    h('div', { class: 'actions' },
      editing && dangerButton(book ? '책 삭제' : '강좌 삭제', async () => { await ctx.store.remove('courses', c.id); closeSheet(); await ctx.refresh() }),
      editing && !book && h('button', { type: 'button', onClick: () => openImport(ctx, c.id) }, '캡처로 강의 추가'),
      h('span', { class: 'spacer' }),
      h('button', { type: 'button', onClick: closeSheet }, '취소'),
      h('button', { type: 'button', class: 'primary', onClick: save }, '저장')),
  ])
}
