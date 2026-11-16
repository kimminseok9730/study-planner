// Turn OCR text of an 인강 lecture list into rows. OCR often misreads the "N강" column
// (e.g. "17%", "2Z", "oT"), so rows are split on wide gaps and odd labels are repaired and flagged.

const STATUS_BAR = /\d+\s*월\s*\d+\s*일|[월화수목금토일]요일/
const LETTERS = /[가-힣A-Za-z]/g

function parseLabel(tok, extraIndex) {
  let m
  if ((m = tok.match(/^제?(\d{1,3})-(\d{1,2})\s*강?$/))) return { label: `${+m[1]}-${+m[2]}`, order: +m[1] + +m[2] / 100, ambiguous: true, guessed: false }
  if ((m = tok.match(/^제?(\d{1,3})\s*강$/))) return { label: String(+m[1]), order: +m[1], ambiguous: false, guessed: false }
  if ((m = tok.match(/^(\d{1,3})[.)]$/))) return { label: String(+m[1]), order: +m[1], ambiguous: false, guessed: false }
  if (/^[oO0][tT]$/.test(tok) || /^오리엔테이션/.test(tok)) return { label: 'OT', order: 0, ambiguous: true, guessed: false }
  if (/보충|특강/.test(tok)) return { label: `보충${extraIndex}`, order: 1000 + extraIndex, ambiguous: true, guessed: false }
  if ((m = tok.match(/^(\d{1,3})[^\d\s가-힣]{1,2}$/))) return { label: String(+m[1]), order: +m[1], ambiguous: false, guessed: true }
  return null
}

function cleanTitle(t) {
  let s = t.trim()
  s = s.replace(/\s*\d+\s*분\s*$/, '')
  s = s.replace(/\s*完\s*$/, '')
  s = s.replace(/(\))\s+\S$/, '$1') // stray glyph after "(5)", usually a misread 完
  if (/^[oO0][tT]$/.test(s)) s = 'OT'
  return s.trim()
}

export function parseLectureText(text) {
  const rows = []
  let extra = 0
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || STATUS_BAR.test(line)) continue
    let tok, title
    const cols = line.split(/\s{3,}/)
    if (cols.length >= 2) [tok, title] = cols
    else {
      const m = line.match(/^(\S+)\s+(.+)$/)
      if (!m) continue
      ;[, tok, title] = m
    }
    const isExtra = /보충|특강/.test(tok)
    const lab = parseLabel(tok, extra + 1)
    if (!lab) continue
    title = cleanTitle(title)
    if (!(title.match(LETTERS) || []).length) continue
    if (isExtra) extra++
    rows.push({ ...lab, title })
  }
  // Repair a guessed number that disagrees with its neighbours (e.g. 5 read between 3 and 5).
  for (let i = 1; i < rows.length - 1; i++) {
    const [p, r, n] = [rows[i - 1], rows[i], rows[i + 1]]
    if (!r.guessed || !/^\d+$/.test(p.label) || !/^\d+$/.test(n.label)) continue
    if (+n.label - +p.label === 2 && +r.label !== +p.label + 1) {
      r.label = String(+p.label + 1)
      r.order = +r.label
    }
  }
  return rows
}

export function mergeLectureLists(lists) {
  const byLabel = new Map()
  for (const row of lists.flat()) {
    const cur = byLabel.get(row.label)
    if (!cur) byLabel.set(row.label, { ...row })
    else {
      if (!cur.title && row.title) cur.title = row.title
      if (cur.guessed && !row.guessed) cur.guessed = false
    }
  }
  return [...byLabel.values()].sort((a, b) => a.order - b.order)
}

export function guessCourseName(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  for (const l of lines) {
    const m = l.match(/^\[[^\]]*\]\s*(.+)$/)
    if (m) return m[1].replace(/\s\|$/, ' I').trim()
  }
  for (const l of lines) {
    if (STATUS_BAR.test(l)) continue
    if (parseLectureText(l).length) continue
    if ((l.match(LETTERS) || []).length >= 4) return l
  }
  return ''
}

export function guessTotal(text) {
  const m = text.match(/강좌\s*구성\s*(\d{1,3})\s*강/) || text.match(/총\s*(\d{1,3})\s*강/)
  return m ? +m[1] : null
}
