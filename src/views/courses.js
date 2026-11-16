import { h, openSheet, closeSheet, field, dangerButton } from '../ui.js'
import { courseProgress } from '../model.js'
import { openImport } from './import.js'

export const PLATFORMS = { mimac: '대성마이맥', mega: '메가스터디', etc: '기타' }

export function renderCourses(root, ctx) {
  const list = h('div', { class: 'list' })
  for (const c of ctx.courses) {
    const p = courseProgress(c)
    list.append(h('button', { class: 'course', onClick: () => openCourse(ctx, c) },
      h('div', { class: 'row' }, h('b', {}, c.name), h('span', {}, `${p.done} / ${p.total}강`)),
      h('div', { class: 'track' }, h('div', { class: 'fill', style: { width: `${p.percent}%` } })),
      h('div', { class: 'row muted' }, h('span', {}, `${PLATFORMS[c.platform] || '기타'}${c.teacher ? ' · ' + c.teacher : ''} · ${p.percent}%`), h('span', {}, `남은 ${p.total - p.done}강`))))
  }
  if (!ctx.courses.length) list.append(h('p', { class: 'muted' }, '듣고 있는 인강을 추가하면 진도율이 여기 보여요.'))
  list.append(h('button', { class: 'add', onClick: () => openAdd(ctx) }, '＋ 강좌 추가'))
  root.replaceChildren(h('h2', {}, '강좌 진도'), list)
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
  const total = h('input', { type: 'number', id: 'c-total', min: '1', max: '300', inputMode: 'numeric', placeholder: '32' })
  const chips = h('div', { class: 'chips' })
  const count = h('span', { class: 'muted' })
  const err = h('p', { class: 'err', role: 'alert' })
  const drawChips = () => {
    c.lectures.sort((a, b) => a.order - b.order)
    chips.replaceChildren(...c.lectures.map((l) => h('button', { type: 'button', class: 'chip isdone', 'aria-pressed': String(l.done), title: l.title || '',
      onClick: () => { l.done = !l.done; l.doneAt = l.done ? new Date().toISOString() : undefined; drawChips() } },
    /^\d/.test(l.label) ? `${l.label}강` : l.label)))
    const done = c.lectures.filter((l) => l.done).length
    count.textContent = `${c.lectures.length}강 중 ${done}강 들음 · 눌러서 들음/안 들음 바꾸기`
  }
  const fill = () => {
    const n = Math.floor(Number(total.value))
    if (!(n >= 1 && n <= 300)) return (err.textContent = '1부터 300 사이 숫자를 넣어 주세요')
    err.textContent = ''
    for (let i = 1; i <= n; i++) if (!c.lectures.some((l) => l.label === String(i))) c.lectures.push({ label: String(i), order: i, done: false })
    drawChips()
  }
  drawChips()
  const save = async () => {
    c.name = name.value.trim(); c.platform = platform.value; c.teacher = teacher.value.trim()
    if (!c.name) return (err.textContent = '강좌 이름을 적어 주세요')
    await ctx.store.put('courses', c)
    closeSheet(); await ctx.refresh()
  }
  openSheet(editing ? '강좌' : '강좌 직접 입력', [
    field('강좌 이름', name),
    h('div', { class: 'row2' }, field('사이트', platform), field('선생님 (선택)', teacher)),
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
