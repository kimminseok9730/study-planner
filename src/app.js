import { openStore } from './store.js'
import { rollDate, studyDate, studyNowMin } from './time.js'
import { DEFAULT_SUBJECTS, subjectOf, guessSubject } from './model.js'
import { renderHead, renderPlans, renderTimeTable } from './views/day.js'
import { renderCourses } from './views/courses.js'
import { renderBacklog } from './views/backlog.js'
import { renderPhotos } from './views/dayphoto.js'
import { renderTodos, todoPrefs } from './views/todos.js'
import { renderQuota } from './views/quota.js'
import { urgentCount } from './todos.js'
import { renderTimerBar } from './views/timer.js'
import { h } from './ui.js'

const root = document.getElementById('app')
const timerRoot = document.getElementById('timer')

const ctx = {
  store: null,
  date: null,
  settings: null,
  subjects: DEFAULT_SUBJECTS,
  courses: [],
  plans: [],   // plans for ctx.date
  actuals: [], // actuals for ctx.date
  photos: [],  // photos for ctx.date
  todos: [],
  tab: 'day',  // 'day' | 'todo'
  allPlans: [],
  allActuals: [],
  courseById(id) { return ctx.courses.find((c) => c.id === id) },
  subjectById(id) { return ctx.subjects.find((s) => s.id === id) || ctx.subjects.find((s) => s.id === 'etc') || ctx.subjects[0] },
  // Highlighter colour of a plan or record.
  colorOf(block) { return ctx.subjectById(subjectOf(block, ctx.courses, ctx.allPlans)).color },
  // The study day runs past midnight, so 01:00 still counts as "today".
  today() { return studyDate(new Date(), ctx.settings?.dayEnd || '26:00') },
  nowMin() { return studyNowMin(new Date(), ctx.settings?.dayEnd || '26:00') },
  setDate(d) { ctx.date = d; return ctx.refresh() },
  async refresh() {
    const s = ctx.store
    ;[ctx.settings, ctx.courses, ctx.allPlans, ctx.allActuals, ctx.todos] = await Promise.all([s.getSettings(), s.getAll('courses'), s.getAll('plans'), s.getAll('actuals'), s.getAll('todos')])
    // One-time move to the 04:00–02:00 study day.
    if (!ctx.settings.rangeV2) ctx.settings = await s.saveSettings({ dayStart: '04:00', dayEnd: '26:00', rangeV2: true })
    ctx.date ||= ctx.today()
    ctx.subjects = ctx.settings.subjects?.length ? ctx.settings.subjects : DEFAULT_SUBJECTS
    // Courses saved before subjects existed get a subject guessed from their name.
    for (const c of ctx.courses) c.subjectId ||= guessSubject(c.name)
    ctx.courses.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    ctx.plans = ctx.allPlans.filter((p) => p.date === ctx.date)
    ctx.actuals = ctx.allActuals.filter((a) => a.date === ctx.date)
    ctx.photos = (await s.getByDate('photos', ctx.date)).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
    render()
  },
}

function render() {
  const keepFocus = document.activeElement?.id === 'memo'
  const urgent = urgentCount(ctx.todos, ctx.today(), todoPrefs(ctx).urgentDays)
  const tab = (id, label, extra) => h('button', { role: 'tab', 'aria-selected': String(ctx.tab === id), onClick: () => { ctx.tab = id; render(); window.scrollTo(0, 0) } }, label, extra)
  const tabs = h('div', { class: 'tabs', role: 'tablist' }, tab('day', 'DAILY'), tab('todo', 'TO DO', urgent ? h('i', { 'aria-label': `급한 것 ${urgent}개` }, urgent) : null))
  if (ctx.tab === 'todo') {
    root.replaceChildren(h('div', { class: 'page' }, tabs, renderTodos(ctx)))
  } else {
    const left = h('div', { class: 'col' }, renderQuota(ctx), renderPlans(ctx), renderBacklog(ctx), renderPhotos(ctx), renderCourses(ctx))
    const right = h('div', { class: 'col' }, renderTimeTable(ctx))
    root.replaceChildren(h('div', { class: 'page' }, tabs, ...renderHead(ctx), h('div', { class: 'cols' }, left, right)))
  }
  renderTimerBar(timerRoot, ctx)
  if (keepFocus) document.getElementById('memo')?.focus()
}

async function boot() {
  try {
    ctx.store = await openStore()
    await ctx.refresh()
  } catch (e) {
    root.replaceChildren(h('p', {}, '저장소를 열 수 없어요. 사파리 개인정보 보호 모드가 켜져 있으면 끄고 다시 열어 주세요.'))
    console.error(e)
    return
  }
  // iPad keeps the app suspended overnight: a view left on "today" moves to the new today.
  let lastToday = ctx.today()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    const nowToday = ctx.today()
    ctx.date = rollDate(ctx.date, lastToday, nowToday)
    lastToday = nowToday
    ctx.refresh()
  })
  // Ask Safari not to evict this app's data.
  navigator.storage?.persist?.().catch(() => {})
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) watchForUpdates()
}

// A home-screen app on iPad is resumed, not reopened, so it never looks for a new version by itself.
// Look every time the app comes to the front, and reload once the new version has taken over.
function watchForUpdates() {
  const sw = navigator.serviceWorker
  const hadVersion = Boolean(sw.controller) // false on the very first visit: nothing to replace
  let waiting = false
  const reloadIfIdle = () => {
    if (!waiting || document.body.classList.contains('sheet-open')) return // never throw away a half-filled form
    waiting = false
    location.reload()
  }
  sw.addEventListener('controllerchange', () => { if (hadVersion) { waiting = true; reloadIfIdle() } })
  sw.register('sw.js').then((reg) => {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return
      reg.update().catch(() => {})
      reloadIfIdle()
    })
  }).catch(() => {})
}

boot()
