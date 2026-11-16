// Small DOM helpers: element builder, bottom sheet, toast, time selects.
import { toHHMM, toMin, clock } from './time.js'

export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue
    if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v)
    else if (k === 'class') el.className = v
    else if (k === 'style' && typeof v === 'object') {
      for (const [p, val] of Object.entries(v)) p.startsWith('--') ? el.style.setProperty(p, val) : (el.style[p] = val)
    }
    else if (k in el && typeof v !== 'string') el[k] = v
    else el.setAttribute(k, v === true ? '' : v)
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue
    el.append(c instanceof Node ? c : document.createTextNode(String(c)))
  }
  return el
}

let current = null
export function openSheet(title, body, { onClose } = {}) {
  closeSheet()
  const close = () => closeSheet()
  const sheet = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div', { class: 'sheet-head' }, h('h2', {}, title), h('button', { class: 'ghost icon', 'aria-label': '닫기', onClick: close }, '✕')),
    h('div', { class: 'sheet-body' }, body))
  const backdrop = h('div', { class: 'backdrop', onClick: (e) => { if (e.target === backdrop) close() } }, sheet)
  document.body.append(backdrop)
  document.body.classList.add('sheet-open')
  current = { backdrop, onClose }
  return close
}
export function closeSheet() {
  if (!current) return
  const { backdrop, onClose } = current
  current = null
  backdrop.remove()
  document.body.classList.remove('sheet-open')
  onClose?.()
}

export function toast(msg) {
  const t = h('div', { class: 'toast', role: 'status' }, msg)
  document.body.append(t)
  setTimeout(() => t.remove(), 2600)
}

export function timeSelect(id, from, to, step, value) {
  const sel = h('select', { id })
  const label = (v) => (toMin(v) >= 1440 ? `새벽 ${clock(v)}` : v)
  for (let m = toMin(from); m <= toMin(to); m += step) sel.append(h('option', { value: toHHMM(m) }, label(toHHMM(m))))
  if (value) {
    if (![...sel.options].some((o) => o.value === value)) sel.append(h('option', { value }, label(value)))
    sel.value = value
  }
  return sel
}

export function field(label, control) {
  return h('label', { class: 'field' }, h('span', {}, label), control)
}

// Two-tap delete: first tap arms, second confirms.
export function dangerButton(label, onConfirm) {
  let armed = false
  const b = h('button', { class: 'danger', type: 'button', onClick: () => {
    if (armed) return onConfirm()
    armed = true
    b.textContent = '한 번 더 누르면 삭제돼요'
    setTimeout(() => { armed = false; b.textContent = label }, 3000)
  } }, label)
  return b
}

export function fmtMin(min) {
  const h_ = Math.floor(min / 60), m = min % 60
  if (!h_) return `${m}분`
  return m ? `${h_}시간 ${m}분` : `${h_}시간`
}
