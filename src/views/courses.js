import { h, openSheet, closeSheet, field, dangerButton } from '../ui.js'
import { courseProgress, guessSubject } from '../model.js'
import { openImport } from './import.js'
import { photoBox, cropper } from './photo.js'

export const PLATFORMS = { mimac: '대성마이맥', mega: '메가스터디', etc: '기타' }

// Subject picker buttons. Returns { el, get() }.
export function subjectButtons(ctx, value) {
  let cur = value || 'etc'
  const el = h('div', { class: 'subj' })
  const draw = () => el.replaceChildren(...ctx.subjects.map((s) => h('button', { type: 'button', class: 'hl', style: { '--c': s.color }, 'aria-pressed': String(s.id === cur),
    onClick: () => { cur = s.id; draw() } }, s.name)))
  draw()
  return { el, get: () => cur }
}

export function renderCourses(ctx) {
  const list = h('div', {})
  for (const c of ctx.courses) {
    const p = courseProgress(c)
    const color = ctx.subjectById(c.subjectId).color
    const ticks = h('div', { class: 'ticks', 'aria-hidden': 'true' }, c.lectures.slice().sort((a, b) => a.order - b.order).map((l) => h('i', l.done ? { class: 'hl', style: { '--c': color } } : {})))
    list.append(h('button', { class: 'teach', onClick: () => openCourse(ctx, c) },
      photoBox(c),
      h('span', { style: { minWidth: '0' } }, h('b', {}, c.name),
        h('small', {}, [ctx.subjectById(c.subjectId).name, c.teacher, PLATFORMS[c.platform]].filter(Boolean).join(' · ')), ticks),
      h('span', { class: 'frac' }, `${p.done}/${p.total}`, h('small', {}, `${p.percent}%`))))
  }
  if (!ctx.courses.length) list.append(h('p', { class: 'muted' }, '듣는 인강을 추가하면 한 강에 한 칸씩 칠해져요.'))
  list.append(h('button', { class: 'line add', onClick: () => openAdd(ctx) }, '＋ 강좌 추가'))
  return h('section', {}, h('h3', { class: 'sec' }, h('span', {}, 'LECTURE'), h('span', {}, '한 칸 = 한 강')), list)
}

function openAdd(ctx) {
  openSheet('강좌 추가', [
    h('button', { class: 'primary', onClick: () => openImport(ctx) }, '캡처로 추가 (강의 목록 화면)'),
    h('button', { onClick: () => openCourse(ctx, { name: '', platform: 'mimac', teacher: '', lectures: [] }) }, '직접 입력'),
    h('p', { class: 'muted' }, '캡처는 강의 목록이 보이게 찍어 주세요. 여러 장도 돼요.'),
  ])
}

export function openCourse(ctx, course) {
  const editing = Boolean(course.id)
  const c = structuredClone(course)
  const name = h('input', { type: 'text', id: 'c-name', value: c.name, placeholder: 'Starting Block 수학 I' })
  const platform = h('select', { id: 'c-platform' }, Object.entries(PLATFORMS).map(([v, t]) => h('option', { value: v }, t)))
  platform.value = c.platform || 'etc'
  const teacher = h('input', { type: 'text', id: 'c-teacher', value: c.teacher || '', placeholder: '김범준' })
  const subject = subjectButtons(ctx, c.subjectId || guessSubject(c.name))
  const total = h('input', { type: 'number', id: 'c-total', min: '1', max: '300', inputMode: 'numeric', placeholder: '32' })
  const chips = h('div', { class: 'chips' })
  const count = h('span', { class: 'muted' })
  const err = h('p', { class: 'err', role: 'alert' })

  // Teacher photo
  const photoArea = h('div', {})
  const fileIn = h('input', { type: 'file', id: 'c-photo', accept: 'image/*', style: { display: 'none' } })
  const drawPhoto = () => photoArea.replaceChildren(h('div', { style: { display: 'flex', gap: '12px', alignItems: 'center' } },
    photoBox({ ...c, teacher: teacher.value, name: name.value }),
    h('div', { class: 'actions', style: { justifyContent: 'flex-start' } },
      h('button', { type: 'button', onClick: () => fileIn.click() }, c.photo ? '사진 바꾸기' : '선생님 사진 넣기'),
      c.photo && h('button', { type: 'button', class: 'ghost', onClick: () => { delete c.photo; drawPhoto() } }, '사진 빼기'))))
  fileIn.addEventListener('change', () => {
    const f = fileIn.files[0]; fileIn.value = ''
    if (!f) return
    photoArea.replaceChildren(cropper(f, (dataUrl) => { if (dataUrl) c.photo = dataUrl; else if (dataUrl === null && !c.photo) err.textContent = ''; drawPhoto() }))
  })
  drawPhoto()

  const drawChips = () => {
    c.lectures.sort((a, b) => a.order - b.order)
    const color = ctx.subjectById(subject.get()).color
    chips.replaceChildren(...c.lectures.map((l) => h('button', { type: 'button', class: 'chip', style: { '--c': color }, 'aria-pressed': String(l.done), title: l.title || '',
      onClick: () => { l.done = !l.done; l.doneAt = l.done ? new Date().toISOString() : undefined; drawChips() } },
    /^\d/.test(l.label) ? l.label : l.label)))
    const done = c.lectures.filter((l) => l.done).length
    count.textContent = `${c.lectures.length}강 중 ${done}강 들음 · 눌러서 칠하기/지우기`
  }
  subject.el.addEventListener('click', drawChips)
  const fill = () => {
    const n = Math.floor(Number(total.value))
    if (!(n >= 1 && n <= 300)) return (err.textContent = '1부터 300 사이 숫자를 넣어 주세요')
    err.textContent = ''
    for (let i = 1; i <= n; i++) if (!c.lectures.some((l) => l.label === String(i))) c.lectures.push({ label: String(i), order: i, done: false })
    drawChips()
  }
  drawChips()
  const save = async () => {
    c.name = name.value.trim(); c.platform = platform.value; c.teacher = teacher.value.trim(); c.subjectId = subject.get()
    if (!c.name) return (err.textContent = '강좌 이름을 적어 주세요')
    await ctx.store.put('courses', c)
    closeSheet(); await ctx.refresh()
  }
  openSheet(editing ? 'LECTURE' : 'NEW LECTURE', [
    photoArea, fileIn,
    field('강좌 이름', name),
    h('div', { class: 'row2' }, field('선생님', teacher), field('사이트', platform)),
    h('div', { class: 'field' }, h('span', {}, '과목'), subject.el),
    h('div', { class: 'field' }, h('span', {}, '총 강 수로 채우기'), h('div', { class: 'seg' }, total, h('button', { type: 'button', onClick: fill }, '채우기'))),
    count, chips, err,
    h('div', { class: 'actions' },
      editing && dangerButton('강좌 삭제', async () => { await ctx.store.remove('courses', c.id); closeSheet(); await ctx.refresh() }),
      editing && h('button', { type: 'button', onClick: () => openImport(ctx, c.id) }, '캡처로 강의 추가'),
      h('span', { class: 'spacer' }),
      h('button', { type: 'button', onClick: closeSheet }, '취소'),
      h('button', { type: 'button', class: 'primary', onClick: save }, '저장')),
  ])
}
