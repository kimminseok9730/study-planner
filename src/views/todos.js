// TO DO tab: deadlines and things to get done, apart from the hour-by-hour day page.
import { h, openSheet, closeSheet, field, dangerButton, toast } from '../ui.js'
import { groupTodos, dueLabel, validateTodo, monthGrid, completeTodo, repeatLabel, firstOccurrence } from '../todos.js'
import { guessSubject } from '../model.js'
import { subjectButtons } from './courses.js'
import { openPlanEditor } from './editors.js'
import { nextSlot } from './day.js'
import { openSettings } from './settings.js'

const WD = ['일', '월', '화', '수', '목', '금', '토']
const short = (date) => { const [, m, d] = date.split('-').map(Number); return `${m}.${String(d).padStart(2, '0')} ${WD[new Date(date + 'T00:00').getDay()]}` }
const SHOW_DONE = 30
const MAX_IN_CELL = 3

// TO DO preferences, kept in settings.
export function todoPrefs(ctx) {
  const s = ctx.settings
  return { weekStart: s.weekStart ?? 0, showDone: s.todoShowDone ?? true, urgentDays: s.todoUrgentDays ?? 0 }
}

// Calendar state lives for the session: which month is shown, and the day picked on it.
let month = null
let picked = null
let pop = false // animate the month title once after a change
const calm = () => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches
const shiftMonth = (date, n) => { const [y, m] = date.split('-').map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01` }

// One month sheet. `interactive` is false for the page lying underneath while one is turned.
function sheet(ctx, m, today, weekStart, interactive, onPick) {
  const weeks = monthGrid(m, ctx.todos, weekStart)
  const order = Array.from({ length: 7 }, (_, i) => (i + weekStart) % 7)
  return h('div', { class: 'cal', 'aria-hidden': interactive ? null : 'true' },
    order.map((i) => h('span', { class: 'wd' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '') }, WD[i])),
    weeks.flat().map((c) => {
      const n = Number(c.date.slice(8))
      const open = c.items.filter((t) => !t.done && !t.ghost).length
      return h(interactive ? 'button' : 'div', {
        class: 'day' + (c.inMonth ? '' : ' out') + (c.date === today ? ' today' : '') + (interactive && c.date === picked ? ' picked' : ''),
        ...(interactive ? { 'aria-label': `${short(c.date)}${open ? `, 할 일 ${open}개` : ''}`, 'aria-pressed': String(c.date === picked), onClick: () => onPick(c.date) } : {}) },
        h('span', { class: 'n' }, n),
        c.items.slice(0, MAX_IN_CELL).map((t) => h('span', { class: 'ev hl' + (t.done ? ' done' : '') + (t.ghost ? ' ghost' : ''), style: { '--c': ctx.subjectById(t.subjectId).color } }, t.repeat ? `↻ ${t.title}` : t.title)),
        c.items.length > MAX_IN_CELL && h('span', { class: 'more' }, `+${c.items.length - MAX_IN_CELL}`))
    }))
}

// Month calendar with a page you can peel off sideways, like tearing a sheet off a desk calendar.
function renderCalendar(ctx, today, redraw) {
  month ||= today
  const { weekStart } = todoPrefs(ctx)
  const grid = sheet(ctx, month, today, weekStart, true, (d) => { picked = picked === d ? null : d; redraw() })
  const wrap = h('div', { class: 'calwrap' }, grid)
  const title = h('b', { class: 'mono' + (pop ? ' pop' : '') }, `${month.slice(0, 4)}.${month.slice(5, 7)}`)
  pop = false
  const peel = peeler(wrap, grid, (dir) => sheet(ctx, shiftMonth(month, dir), today, weekStart, false), (dir) => { month = shiftMonth(month, dir); pop = true; redraw() })
  return h('section', { class: 'calbox' },
    h('h3', { class: 'sec' }, h('span', {}, 'CALENDAR'), h('span', {}, '옆으로 밀어서 넘기기 · 날짜를 누르면 그날 것만')),
    h('div', { class: 'statnav' },
      h('button', { class: 'ghost icon', 'aria-label': '이전 달', onClick: () => peel.turn(-1) }, '‹'),
      title,
      h('button', { class: 'ghost icon', 'aria-label': '다음 달', onClick: () => peel.turn(1) }, '›'),
      month.slice(0, 7) !== today.slice(0, 7) && h('button', { class: 'ghost', onClick: () => { month = today; pop = true; redraw() } }, '이번 달')),
    wrap)
}

// Page curl. Moving a finger by p pixels lifts the page edge: the fold sits p/2 in from the edge,
// the lifted part lies folded back over the page (the flap), and the next month shows underneath.
function peeler(wrap, grid, makeUnder, commit) {
  let under = null, flap = null, shade = null, dir = 0, busy = false
  const W = () => wrap.clientWidth || 1
  const setup = (d) => {
    if (dir === d) return
    dir = d
    under?.remove()
    under = makeUnder(d); under.classList.add('under')
    flap ||= h('div', { class: 'flap' })
    shade ||= h('div', { class: 'fold-shade' })
    wrap.prepend(under)
    wrap.append(flap, shade)
    wrap.dataset.dir = d > 0 ? 'next' : 'prev'
  }
  const draw = (p) => {
    const w = W()
    p = Math.max(0, Math.min(p, 2 * w + 60))
    const fold = p / 2
    const lift = Math.min(1, p / w)
    if (dir > 0) {
      grid.style.clipPath = `inset(-20px ${fold}px -20px -20px)`
      flap.style.left = `${w - p}px`
    } else {
      grid.style.clipPath = `inset(-20px -20px -20px ${fold}px)`
      flap.style.left = `${fold}px`
    }
    flap.style.width = `${fold}px`
    shade.style.left = dir > 0 ? `${w - fold}px` : `${fold - 46}px`
    // the flap bulges a little more as it lifts: rounder outer edge, stronger shadow
    flap.style.setProperty('--lift', lift.toFixed(3))
    shade.style.opacity = String(Math.min(1, p / 60) * (1 - Math.max(0, lift - 0.7) / 0.3))
    flap.style.opacity = p > 1 ? '1' : '0'
  }
  const clear = () => {
    grid.style.clipPath = ''
    under?.remove(); flap?.remove(); shade?.remove()
    under = flap = shade = null; dir = 0
    delete wrap.dataset.dir
  }
  // Tween p with requestAnimationFrame; a timer makes sure the end state lands even if frames stall.
  const tween = (from, to, ms, ease, then) => {
    const t0 = performance.now()
    let finished = false
    const finish = () => { if (finished) return; finished = true; draw(to); then() }
    const step = (now) => {
      if (finished) return
      const k = Math.min(1, (now - t0) / ms)
      draw(from + (to - from) * ease(k))
      k < 1 ? requestAnimationFrame(step) : finish()
    }
    requestAnimationFrame(step)
    setTimeout(finish, ms + 120)
  }
  const out = (k) => 1 - Math.pow(1 - k, 3)
  const inOut = (k) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2)
  const finishTurn = (from, ms, ease) => {
    busy = true
    const d = dir
    navigator.vibrate?.(8)
    tween(from, 2 * W() + 60, ms, ease, () => commit(d)) // the redraw replaces this sheet with the one underneath
  }

  // drag
  let start = null, mode = null, p = 0, lastX = 0, lastT = 0, speed = 0, dragged = false, lastDx = 0
  grid.addEventListener('pointerdown', (e) => {
    if (busy || e.button > 0) return
    start = { x: e.clientX, y: e.clientY, id: e.pointerId }; mode = null; p = 0; speed = 0; dragged = false
    lastX = e.clientX; lastT = e.timeStamp
  })
  grid.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return
    const x = e.clientX - start.x, y = e.clientY - start.y
    if (!mode) {
      if (Math.abs(x) < 8 && Math.abs(y) < 8) return
      mode = Math.abs(x) > Math.abs(y) ? 'x' : 'y'
      if (mode === 'y') { start = null; return } // up and down scrolls the page as usual
      try { grid.setPointerCapture(e.pointerId) } catch {}
    }
    dragged = true; lastDx = x
    if (e.timeStamp > lastT) speed = (e.clientX - lastX) / (e.timeStamp - lastT)
    lastX = e.clientX; lastT = e.timeStamp
    if (calm()) return
    setup(x < 0 ? 1 : -1)
    p = Math.abs(x) * 1.15
    draw(p)
  })
  const end = () => {
    if (!start) return
    const wasX = mode === 'x'
    start = null; mode = null
    if (!wasX) return
    const flick = Math.abs(speed) > 0.45
    if (calm()) { if (Math.abs(lastDx) > 60 || flick) commit(lastDx < 0 ? 1 : -1); return }
    if (dir && (p > W() * 0.3 || (flick && Math.sign(speed) === -dir))) return finishTurn(p, 340, out)
    if (dir) tween(p, 0, 260, out, clear)
  }
  grid.addEventListener('pointerup', end)
  grid.addEventListener('pointercancel', end)
  // A drag is not a tap on a day.
  grid.addEventListener('click', (e) => { if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false } }, true)

  return {
    turn(d) {
      if (busy) return
      if (calm()) return commit(d)
      setup(d)
      finishTurn(0, 560, inOut)
    },
  }
}

export function renderTodos(ctx) {
  const today = ctx.today()
  const prefs = todoPrefs(ctx)
  const title = h('input', { type: 'text', id: 'todo-new', placeholder: '물리 수행평가 보고서', 'aria-label': '할 일', maxLength: 80 })
  const due = h('input', { type: 'date', id: 'todo-due', 'aria-label': '마감 날짜', value: picked || '' })
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
    if (t.done) await ctx.store.put('todos', { ...t, done: false, doneAt: undefined })
    else {
      const out = completeTodo(t, today, new Date().toISOString())
      for (const x of out) await ctx.store.put('todos', x)
      if (t.repeat && out[1]?.due) toast(`다음은 ${short(out[1].due)}`)
    }
    await ctx.refresh()
  }
  const row = (t) => h('div', { class: 'todo' + (t.done ? ' done' : '') + (!t.done && t.due && t.due < today ? ' late' : '') },
    h('button', { class: 'box', 'aria-label': t.done ? `${t.title} 다시 하기` : `${t.title} 끝냄`, 'aria-pressed': String(t.done), onClick: () => toggle(t) }, t.done ? '○' : ''),
    h('span', { class: 'tag hl', style: { '--c': ctx.subjectById(t.subjectId).color } }),
    h('button', { class: 'what', onClick: () => openTodo(ctx, t) }, h('span', {}, t.title),
      t.repeat && h('small', { class: 'rep' }, `↻ ${repeatLabel(t.repeat)}`), t.note && h('small', {}, t.note)),
    h('span', { class: 'when' }, t.due ? h('b', {}, t.done ? '' : dueLabel(t.due, today)) : '', t.due ? ` ${short(t.due)}` : ''))

  const redraw = () => ctx.refresh()
  const visible = prefs.showDone ? ctx.todos : ctx.todos.filter((t) => !t.done)
  const shown = picked ? visible.filter((t) => t.due === picked) : visible
  const groups = picked
    ? [{ key: 'picked', label: short(picked), items: shown.slice().sort((a, b) => Number(a.done) - Number(b.done)) }].filter((g) => g.items.length)
    : groupTodos(shown, today)
  const sections = groups.map((g) => {
    const items = g.key === 'done' ? g.items.slice(0, SHOW_DONE) : g.items
    return h('section', {},
      h('h3', { class: 'sec' }, h('span', {}, g.label), h('span', {}, `${g.items.length}개`)),
      h('div', {}, items.map(row)))
  })

  const empty = picked ? `${short(picked)}까지 해야 하는 일이 없어요. 위에 적으면 이 날짜로 들어가요.` : '해야 하는 일을 적고 마감 날짜를 고르면, 급한 순서로 정리돼요. 날짜는 비워 둬도 돼요.'
  const list = h('div', { class: 'todos' },
    h('section', {},
      h('h3', { class: 'sec' }, h('span', {}, 'TO DO'),
        h('span', {}, '수행평가 · 시험 · 숙제 · 매주 할 일', h('button', { class: 'ghost icon sm', 'aria-label': 'TO DO 설정', onClick: () => openTodoSettings(ctx) }, '⚙︎'))),
      h('div', { class: 'todoadd' }, title, due, h('button', { type: 'button', class: 'primary', onClick: add }, '추가')),
      h('p', { class: 'muted hint' }, '매주 · 매일 반복하려면 추가한 뒤 눌러서 "반복"을 고르세요.'),
      err),
    picked && h('button', { class: 'line add', onClick: () => { picked = null; redraw() } }, `← 전체 목록 보기 (지금은 ${short(picked)}만)`),
    sections.length ? sections : h('p', { class: 'muted' }, empty))
  return h('div', { class: 'todopage' }, list, renderCalendar(ctx, today, redraw))
}

// Repeat picker: none / every day / every week on some weekdays / every month on a date.
function repeatFields(init, dueValue) {
  let every = init?.every || 'none'
  let days = init?.days?.length ? [...init.days] : [new Date((dueValue() || new Date().toISOString().slice(0, 10)) + 'T00:00').getDay()]
  const dayNum = h('input', { type: 'number', id: 't-mday', min: '1', max: '31', inputMode: 'numeric', value: init?.day || Number((dueValue() || '').slice(8)) || 1, 'aria-label': '매달 며칠' })
  const el = h('div', { class: 'field' })
  const draw = () => el.replaceChildren(
    h('span', {}, '반복'),
    h('div', { class: 'seg' }, [['none', '안 함'], ['day', '매일'], ['week', '매주'], ['month', '매달']].map(([k, t]) =>
      h('button', { type: 'button', 'aria-pressed': String(every === k), onClick: () => { every = k; draw() } }, t))),
    every === 'week' && h('div', { class: 'subj days', style: { marginTop: '8px' } }, WD.map((w, i) => h('button', { type: 'button', 'aria-pressed': String(days.includes(i)),
      onClick: () => { days = days.includes(i) ? days.filter((x) => x !== i) : [...days, i]; draw() } }, w))),
    every === 'month' && h('div', { class: 'seg range', style: { marginTop: '8px', maxWidth: '200px' } }, h('span', {}, '매달'), dayNum, h('span', {}, '일')))
  draw()
  return {
    el,
    get() {
      if (every === 'none') return null
      if (every === 'day') return { every }
      if (every === 'week') return { every, days: [...days].sort() }
      return { every, day: Math.min(31, Math.max(1, Math.floor(Number(dayNum.value)) || 1)) }
    },
  }
}

function openTodo(ctx, todo) {
  const title = h('input', { type: 'text', id: 't-title', value: todo.title, maxLength: 80 })
  const due = h('input', { type: 'date', id: 't-due', value: todo.due || '' })
  const note = h('input', { type: 'text', id: 't-note', value: todo.note || '', placeholder: '3쪽 이상, 실험 사진 넣기', maxLength: 120 })
  const subject = subjectButtons(ctx, todo.subjectId)
  const repeat = todo.done ? null : repeatFields(todo.repeat, () => due.value)
  const err = h('p', { class: 'err', role: 'alert' })
  const read = () => {
    const t = { ...todo, title: title.value.trim(), due: due.value || null, note: note.value.trim(), subjectId: subject.get() }
    const r = repeat?.get()
    if (r) {
      t.repeat = r
      // a repeating todo always has a date: the first one from the date given (or today) that fits the rule
      if (r.every !== 'week' || r.days.length) t.due = firstOccurrence(r, t.due || ctx.today())
    } else delete t.repeat
    return t
  }
  const save = async () => {
    const t = read()
    const bad = validateTodo(t)
    if (bad) { err.textContent = bad; return false }
    await ctx.store.put('todos', t)
    return true
  }
  openSheet('TO DO', [
    field('할 일', title),
    h('div', { class: 'row2' }, field(repeat ? '날짜 (반복이면 첫 날짜)' : '마감 날짜 (비워도 돼요)', due), field('메모', note)),
    repeat?.el,
    h('div', { class: 'field' }, h('span', {}, '과목'), subject.el),
    err,
    h('div', { class: 'actions' },
      dangerButton(todo.repeat ? '반복 전체 삭제' : '삭제', async () => { await ctx.store.remove('todos', todo.id); closeSheet(); await ctx.refresh() }),
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

function openTodoSettings(ctx) {
  const p = todoPrefs(ctx)
  const set = async (patch) => { await ctx.store.saveSettings(patch); await ctx.refresh(); openTodoSettings(ctx) }
  const seg = (options, cur, onPick) => h('div', { class: 'seg' }, options.map(([v, t]) => h('button', { type: 'button', 'aria-pressed': String(v === cur), onClick: () => onPick(v) }, t)))
  const repeating = ctx.todos.filter((t) => t.repeat)
  openSheet('TO DO 설정', [
    h('div', { class: 'field' }, h('span', {}, '달력 첫 요일'), seg([[0, '일요일'], [1, '월요일']], p.weekStart, (v) => set({ weekStart: v }))),
    h('div', { class: 'field' }, h('span', {}, '끝낸 일'), seg([[true, '목록에 보이기'], [false, '숨기기']], p.showDone, (v) => set({ todoShowDone: v }))),
    h('div', { class: 'field' }, h('span', {}, '탭의 빨간 숫자'), seg([[0, '오늘까지'], [3, '3일 안'], [7, '7일 안']], p.urgentDays, (v) => set({ todoUrgentDays: v }))),
    h('h3', { class: 'sec' }, h('span', {}, '반복하는 일'), h('span', {}, `${repeating.length}개`)),
    repeating.length
      ? h('div', {}, repeating.map((t) => h('button', { class: 'line', onClick: () => openTodo(ctx, t) },
        h('span', { class: 'box' }, '↻'), h('span', { class: 'tag hl', style: { '--c': ctx.subjectById(t.subjectId).color } }),
        h('span', { class: 'what' }, h('span', {}, t.title), h('small', {}, repeatLabel(t.repeat))),
        h('span', { class: 'when' }, t.due ? `다음 ${short(t.due)}` : ''))))
      : h('p', { class: 'muted' }, '할 일을 눌러서 "반복"을 고르면 여기 모여요.'),
    h('div', { class: 'actions', style: { justifyContent: 'flex-start' } }, h('button', { type: 'button', class: 'ghost', onClick: () => openSettings(ctx) }, '앱 전체 설정 (D-day · 과목 색 · 백업) →')),
  ])
}
