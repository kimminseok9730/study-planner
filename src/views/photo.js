import { h } from '../ui.js'

const W = 162, H = 204 // saved size, 증명사진 비율

// Teacher photo box: the picture, or the first two letters of the name.
export function photoBox(course, small = false) {
  const el = h('span', { class: 'photo' + (small ? ' sm' : '') })
  if (course?.photo) el.append(h('img', { src: course.photo, alt: course.teacher ? `${course.teacher} 선생님` : '선생님 사진' }))
  else el.append((course?.teacher || course?.name || '?').trim().slice(0, 2))
  return el
}

// Inline cropper: drag to move, slider to zoom. Calls onDone(dataURL) or onDone(null) when cancelled.
export function cropper(file, onDone) {
  const canvas = h('canvas', { width: W * 2, height: H * 2, 'aria-label': '사진 위치 맞추기' })
  const g = canvas.getContext('2d')
  const zoom = h('input', { type: 'range', id: 'crop-zoom', min: '1', max: '6', step: '0.01', value: '1', 'aria-label': '확대' })
  const img = new Image()
  let scale = 1, base = 1, ox = 0, oy = 0
  const draw = () => {
    const s = base * scale
    const w = img.width * s, hgt = img.height * s
    ox = Math.min(0, Math.max(canvas.width - w, ox))
    oy = Math.min(0, Math.max(canvas.height - hgt, oy))
    g.fillStyle = '#fff'; g.fillRect(0, 0, canvas.width, canvas.height)
    g.drawImage(img, ox, oy, w, hgt)
  }
  const url = URL.createObjectURL(file)
  img.onload = () => {
    base = Math.max(canvas.width / img.width, canvas.height / img.height)
    ox = (canvas.width - img.width * base) / 2; oy = (canvas.height - img.height * base) / 2
    draw()
  }
  img.onerror = () => { URL.revokeObjectURL(url); onDone(null) }
  img.src = url
  zoom.addEventListener('input', () => {
    const cx = canvas.width / 2, cy = canvas.height / 2
    const before = base * scale
    scale = Number(zoom.value)
    const k = (base * scale) / before
    ox = cx - (cx - ox) * k; oy = cy - (cy - oy) * k
    draw()
  })
  let drag = null
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId) })
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return
    const r = canvas.width / canvas.getBoundingClientRect().width
    ox += (e.clientX - drag.x) * r; oy += (e.clientY - drag.y) * r
    drag = { x: e.clientX, y: e.clientY }
    draw()
  })
  canvas.addEventListener('pointerup', () => { drag = null })
  canvas.addEventListener('pointercancel', () => { drag = null })
  const finish = (ok) => {
    URL.revokeObjectURL(url)
    if (!ok) return onDone(null)
    const out = h('canvas', { width: W, height: H })
    out.getContext('2d').drawImage(canvas, 0, 0, W, H)
    onDone(out.toDataURL('image/jpeg', 0.85))
  }
  return h('div', { class: 'crop' }, canvas,
    h('div', { class: 'side' },
      h('span', { class: 'muted' }, '사진을 끌어서 얼굴을 네모 안에 맞추고, 아래 막대로 확대하세요. 강좌 정보 캡처를 그대로 써도 돼요.'),
      zoom,
      h('div', { class: 'actions', style: { justifyContent: 'flex-start' } },
        h('button', { type: 'button', class: 'primary', onClick: () => finish(true) }, '이 모양으로'),
        h('button', { type: 'button', onClick: () => finish(false) }, '취소'))))
}
