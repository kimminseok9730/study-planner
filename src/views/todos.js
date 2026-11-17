// TO DO tab: deadlines and things to get done, apart from the hour-by-hour day page.
import { h, openSheet, closeSheet, field, dangerButton } from '../ui.js'
import { groupTodos, dueLabel, validateTodo } from '../todos.js'
import { guessSubject } from '../model.js'
import { subjectButtons } from './courses.js'
import { openPlanEditor } from './editors.js'
import { nextSlot } from './day.js'

const WD = ['일', '월', '화', '수', '목', '금', '토']
const short = (date) => { const [, m, d] = date.split('-').map(Number); return `${m}.${String(d).padStart(2, '0')} ${WD[new Date(date + 'T00:00').getDay()]}` }
const SHOW_DONE = 30

export function renderTodos(ctx) {
  const today = ctx.today()
  const title = h('input', { type: 'text', id: 'todo-new', placeholder: '물리 수행평가 보고서', 'aria-label': '할 일', maxLength: 80 })
  const due = h('input', { type: 'date', id: 'todo-due', 'aria-label': '마감 날짜' })
  const err = h('p', { class: 'err', role: 'alert' })
  const add = async () => {
    const t = { title: title.value.trim(), due: due.value || null, done: false, subjectId: guessSubject(title.value), note: '', createdAt: new Date().toISOString() }
    const bad = validateTodo(t)
    if (bad) return (err.textContent = bad)
    await ctx.store.put('todos', t)
    await ctx.refresh()
    document.getElementById('todo-new')?.focus()
  }
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) add() })

  const toggle = async (t) => {
    await ctx.store.put('todos', { ...t, done: !t.done, doneAt: t.done ? undefined : new Date().toISOString() })
    await ctx.refresh()
  }
  const row = (t) => h('div', { class: 'todo' + (t.done ? ' done' : '') + (!t.done && t.due && t.due < today ? ' late' : '') },
    h('button', { class: 'box', 'aria-label': t.done ? `${t.title} 다시 하기` : `${t.title} 끝냄`, 'aria-pressed': String(t.done), onClick: () => toggle(t) }, t.done ? '○' : ''),
    h('span', { class: 'tag hl', style: { '--c': ctx.subjectById(t.subjectId).color } }),
    h('button', { class: 'what', onClick: () => openTodo(ctx, t) }, h('span', {}, t.title), t.note && h('small', {}, t.note)),
    h('span', { class: 'when' }, t.due ? h('b', {}, t.done ? '' : dueLabel(t.due, today)) : '', t.due ? ` ${short(t.due)}` : ''))

  const groups = groupTodos(ctx.todos, today)
  const sections = groups.map((g) => {
    const items = g.key === 'done' ? g.items.slice(0, SHOW_DONE) : g.items
    return h('section', {},
      h('h3', { class: 'sec' }, h('span', {}, g.label), h('span', {}, `${g.items.length}개`)),
      h('div', {}, items.map(row)))
  })

  return h('div', { class: 'todos' },
    h('section', {},
      h('h3', { class: 'sec' }, h('span', {}, 'TO DO'), h('span', {}, '수행평가 · 시험 · 숙제처럼 해야 하는 것')),
      h('div', { class: 'todoadd' }, title, due, h('button', { type: 'button', class: 'primary', onClick: add }, '추가')),
      err),
    sections.length ? sections : h('p', { class: 'muted' }, '해야 하는 일을 적고 마감 날짜를 고르면, 급한 순서로 정리돼요. 날짜는 비워 둬도 돼요.'))
}

function openTodo(ctx, todo) {
  const title = h('input', { type: 'text', id: 't-title', value: todo.title, maxLength: 80 })
  const due = h('input', { type: 'date', id: 't-due', value: todo.due || '' })
  const note = h('input', { type: 'text', id: 't-note', value: todo.note || '', placeholder: '3쪽 이상, 실험 사진 넣기', maxLength: 120 })
  const subject = subjectButtons(ctx, todo.subjectId)
  const err = h('p', { class: 'err', role: 'alert' })
  const read = () => ({ ...todo, title: title.value.trim(), due: due.value || null, note: note.value.trim(), subjectId: subject.get() })
  const save = async () => {
    const t = read()
    const bad = validateTodo(t)
    if (bad) { err.textContent = bad; return false }
    await ctx.store.put('todos', t)
    return true
  }
  openSheet('TO DO', [
    field('할 일', title),
    h('div', { class: 'row2' }, field('마감 날짜 (비워도 돼요)', due), field('메모', note)),
    h('div', { class: 'field' }, h('span', {}, '과목'), subject.el),
    err,
    h('div', { class: 'actions' },
      dangerButton('삭제', async () => { await ctx.store.remove('todos', todo.id); closeSheet(); await ctx.refresh() }),
      h('span', { class: 'spacer' }),
      !todo.done && h('button', { type: 'button', onClick: async () => {
        if (!(await save())) return
        const t = read()
        closeSheet(); ctx.tab = 'day'; await ctx.setDate(ctx.today())
        openPlanEditor(ctx, { ...nextSlot(ctx), kind: 'text', text: t.title, subjectId: t.subjectId })
      } }, '오늘 계획에 넣기'),
      h('button', { type: 'button', class: 'primary', onClick: async () => { if (await save()) { closeSheet(); await ctx.refresh() } } }, '저장')),
  ])
}
