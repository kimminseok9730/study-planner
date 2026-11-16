import { h, openSheet, closeSheet, field, toast } from '../ui.js'
import { recognize } from '../ocr.js'
import { parseLectureText, mergeLectureLists, guessCourseName, guessTotal } from '../ocr-parse.js'
import { guessSubject } from '../model.js'
import { subjectButtons } from './courses.js'

const PLATFORM_NAMES = { mimac: '대성마이맥', mega: '메가스터디', etc: '기타' }

function guessPlatform(text) {
  if (/MIM[A-Z]C|마이맥|대성/i.test(text)) return 'mimac'
  if (/MEGA|메가/i.test(text)) return 'mega'
  return 'etc'
}
function orderOf(label, i) {
  if (/^\d+$/.test(label)) return +label
  const m = label.match(/^(\d+)-(\d+)$/)
  if (m) return +m[1] + +m[2] / 100
  if (label === 'OT') return 0
  return 1000 + i
}

export function openImport(ctx, targetId = null) {
  const files = h('input', { type: 'file', id: 'i-files', accept: 'image/*', multiple: true })
  const bar = h('div')
  const progress = h('div', { class: 'progress', hidden: true }, bar)
  const status = h('p', { class: 'muted' }, '강의 목록이 보이는 캡처를 골라 주세요. 강좌 정보 화면을 같이 넣으면 이름도 읽어 와요.')
  const err = h('p', { class: 'err', role: 'alert' })
  const go = h('button', { class: 'primary', onClick: async () => {
    const list = [...files.files]
    if (!list.length) return (err.textContent = '캡처를 하나 이상 골라 주세요')
    err.textContent = ''; go.disabled = true; progress.hidden = false
    status.textContent = '글자를 읽는 중이에요. 처음에는 한국어 데이터를 내려받느라 조금 걸려요.'
    try {
      const texts = await recognize(list, (p) => { bar.style.width = `${Math.round(p * 100)}%` })
      showConfirm(ctx, texts, targetId)
    } catch (e) {
      console.error(e)
      go.disabled = false; progress.hidden = true
      err.textContent = '글자를 읽지 못했어요. 인터넷 연결을 확인하고 다시 해 주세요.'
    }
  } }, '읽기')
  const target = targetId && ctx.courseById(targetId)
  openSheet(target ? `${target.name}에 강의 추가` : '캡처로 강좌 추가', [field('캡처 (여러 장 가능)', files), status, progress, err, h('div', { class: 'actions' }, go)])
}

function showConfirm(ctx, texts, targetId) {
  const all = texts.join('\n')
  const rows = mergeLectureLists(texts.map(parseLectureText)).map((r) => ({ ...r, include: !r.ambiguous }))
  const target = targetId && ctx.courseById(targetId)
  const name = h('input', { type: 'text', id: 'i-name', value: target?.name || guessCourseName(all) })
  const platform = h('select', { id: 'i-platform' }, Object.entries(PLATFORM_NAMES).map(([v, t]) => h('option', { value: v }, t)))
  platform.value = target?.platform || guessPlatform(all)
  const teacher = h('input', { type: 'text', id: 'i-teacher', value: target?.teacher || '' })
  const subject = subjectButtons(ctx, target?.subjectId || guessSubject(name.value))
  const body = h('tbody')
  const notes = h('p', { class: 'muted' })
  const err = h('p', { class: 'err', role: 'alert' })

  const drawNotes = () => {
    const nums = rows.filter((r) => r.include && /^\d+$/.test(r.label.trim())).map((r) => +r.label)
    const msgs = [`${rows.filter((r) => r.include).length}개 강의를 저장해요.`]
    if (nums.length) {
      const set = new Set(nums), missing = []
      for (let n = Math.min(...nums); n <= Math.max(...nums); n++) if (!set.has(n)) missing.push(n)
      if (missing.length) msgs.push(`${missing.slice(0, 8).join(', ')}강이 안 보여요. 캡처를 더 넣거나 줄을 추가해 주세요.`)
    }
    const total = guessTotal(all)
    if (total) msgs.push(`강좌 정보에는 총 ${total}강이라고 나와요.`)
    if (rows.some((r) => r.guessed || r.ambiguous)) msgs.push('노란 줄은 잘못 읽었을 수 있으니 확인해 주세요.')
    notes.textContent = msgs.join(' ')
  }
  const drawRows = () => {
    body.replaceChildren(...rows.map((r, i) => {
      const cb = h('input', { type: 'checkbox', checked: r.include, 'aria-label': '포함', onChange: () => { r.include = cb.checked; drawNotes() } })
      return h('tr', { class: r.guessed || r.ambiguous ? 'flag' : '' },
        h('td', { class: 'c' }, cb),
        h('td', { class: 'n' }, h('input', { type: 'text', value: r.label, 'aria-label': '강 번호', onInput: (e) => { r.label = e.target.value; drawNotes() } })),
        h('td', {}, h('input', { type: 'text', value: r.title, 'aria-label': '강의 제목', onInput: (e) => { r.title = e.target.value } })))
    }))
    drawNotes()
  }
  drawRows()

  const save = async () => {
    const picked = rows.filter((r) => r.include && r.label.trim())
    if (!picked.length) return (err.textContent = '저장할 강의가 없어요')
    const seen = new Set()
    const lectures = []
    picked.forEach((r, i) => {
      const label = r.label.trim().replace(/강$/, '')
      if (seen.has(label)) return
      seen.add(label)
      lectures.push({ label, order: orderOf(label, i), title: r.title.trim() || undefined, done: false })
    })
    if (target) {
      const have = new Set(target.lectures.map((l) => l.label))
      const added = lectures.filter((l) => !have.has(l.label))
      target.lectures.push(...added)
      await ctx.store.put('courses', target)
      toast(`${added.length}개 강의를 추가했어요`)
    } else {
      const n = name.value.trim()
      if (!n) return (err.textContent = '강좌 이름을 적어 주세요')
      await ctx.store.put('courses', { name: n, platform: platform.value, teacher: teacher.value.trim(), subjectId: subject.get(), lectures })
      toast(`${n} 강좌를 추가했어요`)
    }
    closeSheet(); await ctx.refresh()
  }

  openSheet('읽은 결과 확인', [
    !target && field('강좌 이름', name),
    !target && h('div', { class: 'row2' }, field('선생님', teacher), field('사이트', platform)),
    !target && h('div', { class: 'field' }, h('span', {}, '과목'), subject.el),
    notes,
    h('div', { class: 'tablewrap' }, h('table', { class: 'lec' }, body)),
    h('button', { type: 'button', class: 'line add', onClick: () => { rows.push({ label: '', title: '', order: 9999, include: true }); drawRows() } }, '＋ 줄 추가'),
    err,
    h('div', { class: 'actions' }, h('button', { type: 'button', onClick: closeSheet }, '취소'), h('button', { type: 'button', class: 'primary', onClick: save }, '저장')),
  ])
}
