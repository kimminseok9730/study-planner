import { h, openSheet, closeSheet, field, timeSelect, toast } from '../ui.js'
import { makeBackup, parseBackup } from '../backup.js'
import { localDate } from '../time.js'

export function openSettings(ctx) {
  const s = ctx.settings
  const start = timeSelect('s-start', '00:00', '12:00', 60, s.dayStart)
  const end = timeSelect('s-end', '13:00', '24:00', 60, s.dayEnd)
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
    const json = JSON.stringify(makeBackup(data, new Date()), null, 1)
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
      h('span', {}, `강좌 ${r.data.courses.length}개, 계획 ${r.data.plans.length}개, 기록 ${r.data.actuals.length}개로 지금 데이터를 바꿀까요?`),
      h('button', { class: 'danger', onClick: async () => {
        await ctx.store.replaceAll(r.data)
        closeSheet(); toast('백업을 불러왔어요'); await ctx.refresh()
      } }, '바꾸기')))
  })

  const last = s.lastBackupAt ? new Date(s.lastBackupAt).toLocaleString('ko-KR') : '아직 없음'
  openSheet('설정', [
    h('div', { class: 'row2' }, field('시간표 시작', start), field('시간표 끝', end)),
    h('h3', { style: { margin: '8px 0 0', fontSize: '15px' } }, '백업'),
    h('p', { class: 'muted' }, `데이터는 이 아이패드에만 있어요. 홈 화면 앱과 사파리 탭은 데이터가 따로라서, 늘 홈 화면 아이콘으로 여세요. 가끔 내보내서 파일 앱에 보관하세요. 마지막 백업: ${last}`),
    h('div', { class: 'actions', style: { justifyContent: 'flex-start' } }, exportBtn, h('button', { onClick: () => file.click() }, '백업 불러오기'), file),
    confirmBox, msg,
  ])
}
