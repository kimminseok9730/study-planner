import { h, openSheet, closeSheet, field, timeSelect, toast } from '../ui.js'
import { makeBackup, parseBackup } from '../backup.js'
import { localDate } from '../time.js'
import { DEFAULT_SUBJECTS } from '../model.js'

export function openSettings(ctx) {
  const s = ctx.settings
  const start = timeSelect('s-start', '00:00', '12:00', 60, s.dayStart)
  const end = timeSelect('s-end', '13:00', '28:00', 60, s.dayEnd)
  const msg = h('p', { class: 'err', role: 'alert' })
  const saveRange = async () => {
    await ctx.store.saveSettings({ dayStart: start.value, dayEnd: end.value })
    toast('시간표 범위를 바꿨어요'); await ctx.refresh()
  }
  start.addEventListener('change', saveRange)
  end.addEventListener('change', saveRange)

  const exportBtn = h('button', { class: 'primary', onClick: async () => {
    const stamp = new Date().toISOString()
    const data = await ctx.store.exportAll()
    data.settings = { ...data.settings, lastBackupAt: stamp }
    const name = `study-planner-${localDate(new Date())}.json`
    const json = JSON.stringify(makeBackup(data, new Date()))
    const file = new File([json], name, { type: 'application/json' })
    // iPad: the share sheet ("파일에 저장") is the reliable way to keep a file from a home-screen app.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: '공부 기록장 백업' })
      } catch (e) {
        if (e?.name === 'AbortError') return toast('백업을 저장하지 않았어요')
        return (msg.textContent = '공유 화면을 열 수 없어요. 다시 해 주세요.')
      }
    } else {
      const url = URL.createObjectURL(file)
      const a = h('a', { href: url, download: name })
      document.body.append(a); a.click(); a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 10000)
    }
    await ctx.store.saveSettings({ lastBackupAt: stamp })
    toast('백업 파일을 만들었어요. 파일 앱에 보관하세요.'); await ctx.refresh()
  } }, '백업 내보내기')

  const file = h('input', { type: 'file', id: 's-file', accept: 'application/json,.json', style: { display: 'none' } })
  const confirmBox = h('div')
  file.addEventListener('change', async () => {
    const f = file.files[0]; if (!f) return
    const r = parseBackup(await f.text())
    file.value = ''
    if (!r.ok) return (msg.textContent = r.error)
    msg.textContent = ''
    confirmBox.replaceChildren(h('div', { class: 'banner' },
      h('span', {}, `강좌 ${r.data.courses.length}개, 계획 ${r.data.plans.length}개, 기록 ${r.data.actuals.length}개, 사진 ${r.data.photos.length}장으로 지금 데이터를 바꿀까요?`),
      h('button', { class: 'danger', onClick: async () => {
        await ctx.store.replaceAll(r.data)
        closeSheet(); toast('백업을 불러왔어요'); await ctx.refresh()
      } }, '바꾸기')))
  })

  // D-day
  const ddLabel = h('input', { type: 'text', id: 's-ddlabel', value: s.dday?.label || '', placeholder: '수능' })
  const ddDate = h('input', { type: 'date', id: 's-dddate', value: s.dday?.date || '' })
  const saveDday = async () => {
    await ctx.store.saveSettings({ dday: ddDate.value ? { label: ddLabel.value.trim(), date: ddDate.value } : null })
    await ctx.refresh()
  }
  ddLabel.addEventListener('change', saveDday)
  ddDate.addEventListener('change', saveDday)

  // Subjects and highlighter colours
  const subjects = structuredClone(ctx.subjects)
  const subjBox = h('div')
  const saveSubjects = async () => { await ctx.store.saveSettings({ subjects: subjects.filter((x) => x.name.trim()) }); await ctx.refresh() }
  const drawSubjects = () => subjBox.replaceChildren(
    ...subjects.map((sub, i) => {
      const color = h('input', { type: 'color', value: sub.color, 'aria-label': `${sub.name} 색`, onChange: () => { sub.color = color.value; saveSubjects() } })
      const name = h('input', { type: 'text', value: sub.name, 'aria-label': '과목 이름', onChange: () => { sub.name = name.value.trim() || sub.name; saveSubjects() } })
      const used = ctx.courses.some((c) => c.subjectId === sub.id) || ctx.allPlans.some((p) => p.subjectId === sub.id) || ctx.allActuals.some((a) => a.subjectId === sub.id)
      return h('div', { class: 'subjrow' }, color, name,
        sub.id !== 'etc' && !used ? h('button', { type: 'button', class: 'ghost', 'aria-label': `${sub.name} 지우기`, onClick: () => { subjects.splice(i, 1); drawSubjects(); saveSubjects() } }, '✕') : h('span'))
    }),
    h('div', { class: 'actions', style: { justifyContent: 'flex-start', marginTop: '8px' } },
      h('button', { type: 'button', onClick: () => { subjects.push({ id: 's' + Date.now().toString(36), name: '새 과목', color: '#c9b8ff' }); drawSubjects(); saveSubjects() } }, '＋ 과목 추가'),
      h('button', { type: 'button', class: 'ghost', onClick: () => { subjects.splice(0, subjects.length, ...structuredClone(DEFAULT_SUBJECTS), ...subjects.filter((x) => !DEFAULT_SUBJECTS.some((d) => d.id === x.id))); drawSubjects(); saveSubjects() } }, '기본 색으로')))
  drawSubjects()

  const last = s.lastBackupAt ? new Date(s.lastBackupAt).toLocaleString('ko-KR') : '아직 없음'
  openSheet('SETTINGS', [
    h('h3', { class: 'sec' }, h('span', {}, 'D-DAY')),
    h('div', { class: 'row2' }, field('이름', ddLabel), field('날짜', ddDate)),
    h('h3', { class: 'sec' }, h('span', {}, '과목 색'), h('span', {}, '색을 눌러 형광펜 고르기')),
    subjBox,
    h('h3', { class: 'sec' }, h('span', {}, 'TIME TABLE')),
    h('div', { class: 'row2' }, field('공부 시작', start), field('공부 끝', end)),
    h('h3', { class: 'sec' }, h('span', {}, '백업')),
    h('p', { class: 'muted' }, `데이터는 이 아이패드에만 있어요. 홈 화면 앱과 사파리 탭은 데이터가 따로라서, 늘 홈 화면 아이콘으로 여세요. 가끔 내보내서 파일 앱에 보관하세요. 마지막 백업: ${last}`),
    h('div', { class: 'actions', style: { justifyContent: 'flex-start' } }, exportBtn, h('button', { onClick: () => file.click() }, '백업 불러오기'), file),
    confirmBox, msg,
  ])
}
