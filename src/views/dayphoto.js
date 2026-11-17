// PHOTO: pictures of the day's study (notes, desk, a solved page), kept on this device.
import { h, openSheet, closeSheet, field, dangerButton, toast } from '../ui.js'

const MAX = 1200 // longest side saved, keeps each photo around 100–200KB

// Shrinks a picked image to a JPEG data URL.
export function shrink(file) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, MAX / Math.max(img.width, img.height))
      const c = h('canvas', { width: Math.round(img.width * k), height: Math.round(img.height * k) })
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      res(c.toDataURL('image/jpeg', 0.72))
    }
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('not an image')) }
    img.src = url
  })
}

export function renderPhotos(ctx) {
  const input = h('input', { type: 'file', id: 'day-photo', accept: 'image/*', multiple: true, style: { display: 'none' } })
  input.addEventListener('change', async () => {
    const files = [...input.files]; input.value = ''
    let failed = 0
    for (const f of files) {
      try { await ctx.store.put('photos', { date: ctx.date, data: await shrink(f), note: '', createdAt: new Date().toISOString() }) } catch { failed++ }
    }
    if (failed) toast(`사진 ${failed}장은 넣지 못했어요`)
    await ctx.refresh()
  })
  const grid = h('div', { class: 'shots' },
    ctx.photos.map((p) => h('button', { class: 'shot', 'aria-label': p.note || '사진 크게 보기', onClick: () => openPhoto(ctx, p) },
      h('img', { src: p.data, alt: p.note || '' }), p.note && h('span', {}, p.note))),
    h('button', { class: 'shot add', onClick: () => input.click() }, '＋ 사진'))
  return h('section', {},
    h('h3', { class: 'sec' }, h('span', {}, 'PHOTO'), h('span', {}, ctx.photos.length ? `${ctx.photos.length}장` : '오늘 공부한 것을 찍어 두기')),
    grid, input)
}

function openPhoto(ctx, photo) {
  const note = h('input', { type: 'text', id: 'ph-note', value: photo.note || '', placeholder: '수학 오답 노트', maxLength: 60 })
  const save = async () => {
    if (note.value.trim() !== (photo.note || '')) await ctx.store.put('photos', { ...photo, note: note.value.trim() })
    closeSheet(); await ctx.refresh()
  }
  openSheet('PHOTO', [
    h('img', { class: 'bigshot', src: photo.data, alt: photo.note || '공부 사진' }),
    field('한 줄 설명', note),
    h('div', { class: 'actions' },
      dangerButton('사진 삭제', async () => { await ctx.store.remove('photos', photo.id); closeSheet(); await ctx.refresh() }),
      h('span', { class: 'spacer' }),
      h('button', { type: 'button', class: 'primary', onClick: save }, '저장')),
  ])
}
