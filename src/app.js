import { openStore } from './store.js'
import { localDate, rollDate } from './time.js'
import { renderDay } from './views/day.js'
import { renderCourses } from './views/courses.js'
import { renderBacklog } from './views/backlog.js'
import { renderTimerBar } from './views/timer.js'
import { h } from './ui.js'

const root = document.getElementById('app')
const timerRoot = document.getElementById('timer')

const ctx = {
  store: null,
  date: localDate(new Date()),
  settings: null,
  courses: [],
  plans: [],   // plans for ctx.date
  actuals: [], // actuals for ctx.date
  allPlans: [],
  allActuals: [],
  courseById(id) { return ctx.courses.find((c) => c.id === id) },
  setDate(d) { ctx.date = d; return ctx.refresh() },
  async refresh() {
    const s = ctx.store
    ;[ctx.settings, ctx.courses, ctx.allPlans, ctx.allActuals] = await Promise.all([s.getSettings(), s.getAll('courses'), s.getAll('plans'), s.getAll('actuals')])
    ctx.courses.sort((a, b) => a.name.localeCompare(b.name, 'ko'))
    ctx.plans = ctx.allPlans.filter((p) => p.date === ctx.date)
    ctx.actuals = ctx.allActuals.filter((a) => a.date === ctx.date)
    render()
  },
}

function render() {
  const coursesPanel = h('section', { class: 'panel' })
  const backlogPanel = h('section', { class: 'panel' })
  const dayEl = renderDay(ctx)
  renderCourses(coursesPanel, ctx)
  const hasBacklog = renderBacklog(backlogPanel, ctx)
  root.replaceChildren(...dayEl.top, h('div', { class: 'main' }, dayEl.grid, h('div', { class: 'side' }, coursesPanel, hasBacklog && backlogPanel)))
  renderTimerBar(timerRoot, ctx)
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
  let lastToday = localDate(new Date())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return
    const nowToday = localDate(new Date())
    ctx.date = rollDate(ctx.date, lastToday, nowToday)
    lastToday = nowToday
    ctx.refresh()
  })
  // Ask Safari not to evict this app's data.
  navigator.storage?.persist?.().catch(() => {})
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) navigator.serviceWorker.register('sw.js').catch(() => {})
}

boot()
