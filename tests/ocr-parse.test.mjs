import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { parseLectureText, mergeLectureLists, guessCourseName, guessTotal } from '../src/ocr-parse.js'

const fx = (n) => readFileSync(new URL(`./fixtures/${n}.txt`, import.meta.url), 'utf8')

test('basic forms', () => {
  const r = parseLectureText('수능 수학 개념 완성\n1강 집합과 명제\n제2강 함수\n3. 수열\n25:13\n4) 극한')
  assert.deepEqual(r.map((x) => x.label), ['1', '2', '3', '4'])
  assert.equal(r[0].title, '집합과 명제')
})
test('ambiguous', () => {
  const r = parseLectureText('OT 오리엔테이션\n1-2강 지수\n보충강 문제풀이')
  assert.deepEqual(r.map((x) => [x.label, x.ambiguous]), [['OT', true], ['1-2', true], ['보충1', true]])
})
test('duration and 完 stripped from title', () => {
  const r = parseLectureText('32강 Lecture 11. 수열의 귀납적 정의 (5) 完 83분')
  assert.deepEqual(r.map((x) => [x.label, x.title]), [['32', 'Lecture 11. 수열의 귀납적 정의 (5)']])
})
test('merge dedupes overlapping screenshots', () => {
  const a = parseLectureText('1강 A\n2강 B\n3강 C'), b = parseLectureText('3강 C\n4강 D')
  assert.deepEqual(mergeLectureLists([a, b]).map((x) => x.label), ['1', '2', '3', '4'])
})
test('course name guess', () => {
  assert.equal(guessCourseName('수능 수학 개념 완성\n1강 집합'), '수능 수학 개념 완성')
  assert.equal(guessCourseName(fx('mimac-course')), 'Starting Block 수학 I')
})
test('total guess', () => {
  assert.equal(guessTotal('강좌구성 32강 / 완강'), 32)
  assert.equal(guessTotal('없음'), null)
})

test('real 마이맥 OCR: first screen', () => {
  const r = parseLectureText(fx('mimac-list-1'))
  assert.deepEqual(r.map((x) => x.label), ['OT', ...Array.from({ length: 15 }, (_, i) => String(i + 1))])
  assert.equal(r[4].title, 'Lecture 03. 지수함수와 로그함수의 그래프 (2)')
  // misread labels (1%, 2Z) are repaired and flagged
  assert.equal(r.find((x) => x.label === '1').guessed, true)
  assert.equal(r.find((x) => x.label === '2').guessed, true)
  assert.equal(r.find((x) => x.label === '3').guessed, false)
  assert.ok(!r.some((x) => /월요일/.test(x.title)))
})
test('real 마이맥 OCR: second screen and merge to 33 rows', () => {
  const r2 = parseLectureText(fx('mimac-list-2'))
  assert.deepEqual(r2.map((x) => x.label), Array.from({ length: 16 }, (_, i) => String(i + 17)))
  assert.equal(r2.at(-1).title, 'Lecture 11. 수열의 귀납적 정의와 수학적 귀납법 (5)')
  const all = mergeLectureLists([parseLectureText(fx('mimac-list-1')), r2])
  assert.equal(all.length, 32) // OT + 1..15 + 17..32 (16강 not captured)
})
test('course page yields no lectures', () => {
  assert.deepEqual(parseLectureText(fx('mimac-course')), [])
})
