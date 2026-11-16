import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toMin, toHHMM, slots, duration, validateBlock, clipTimerToDay, localDate } from '../src/time.js'

test('slots', () => { assert.deepEqual(slots('06:00', '08:00'), ['06:00', '06:30', '07:00', '07:30']) })
test('24:00 end', () => { assert.equal(toMin('24:00'), 1440); assert.equal(duration('23:30', '24:00'), 30) })
test('toHHMM', () => { assert.equal(toHHMM(605), '10:05'); assert.equal(toHHMM(1440), '24:00') })
test('end<=start rejected', () => { assert.equal(validateBlock({ start: '10:00', end: '10:00' }, []), '끝 시간이 시작 시간보다 늦어야 해요') })
test('overlap rejected', () => { assert.equal(validateBlock({ id: 'b', start: '10:00', end: '11:00' }, [{ id: 'a', start: '10:30', end: '12:00' }]), '다른 블록과 시간이 겹쳐요') })
test('touching blocks ok', () => { assert.equal(validateBlock({ id: 'b', start: '10:00', end: '11:00' }, [{ id: 'a', start: '11:00', end: '12:00' }]), null) })
test('self not overlap', () => { assert.equal(validateBlock({ id: 'a', start: '10:00', end: '11:00' }, [{ id: 'a', start: '10:00', end: '11:00' }]), null) })
test('timer across midnight clipped to day end', () => {
  const r = clipTimerToDay(new Date(2026, 10, 16, 23, 10), new Date(2026, 10, 17, 1, 0), '24:00')
  assert.deepEqual(r, { date: '2026-11-16', start: '23:10', end: '24:00', minutes: 50 })
})
test('timer same day', () => {
  const r = clipTimerToDay(new Date(2026, 10, 16, 18, 5, 30), new Date(2026, 10, 16, 19, 20, 10), '24:00')
  assert.deepEqual(r, { date: '2026-11-16', start: '18:05', end: '19:20', minutes: 75 })
})
test('timer under 1 minute → null', () => { assert.equal(clipTimerToDay(new Date(2026, 10, 16, 9, 0, 0), new Date(2026, 10, 16, 9, 0, 40), '24:00'), null) })
test('timer after an early day end is still kept up to midnight', () => {
  assert.deepEqual(clipTimerToDay(new Date(2026, 10, 16, 23, 30), new Date(2026, 10, 16, 23, 50), '23:00'), { date: '2026-11-16', start: '23:30', end: '23:50', minutes: 20 })
})
test('localDate', () => { assert.equal(localDate(new Date(2026, 0, 5, 23, 59)), '2026-01-05') })

import { rollDate } from '../src/time.js'
test('rollDate moves a stale "today" view forward, keeps other days', () => {
  assert.equal(rollDate('2026-11-16', '2026-11-16', '2026-11-17'), '2026-11-17')
  assert.equal(rollDate('2026-11-10', '2026-11-16', '2026-11-17'), '2026-11-10')
  assert.equal(rollDate('2026-11-16', '2026-11-16', '2026-11-16'), '2026-11-16')
})

import { studyDate, studyNowMin, clock } from '../src/time.js'
test('study day runs past midnight: 01:30 belongs to the previous date', () => {
  assert.equal(studyDate(new Date(2026, 10, 17, 1, 30), '26:00'), '2026-11-16')
  assert.equal(studyNowMin(new Date(2026, 10, 17, 1, 30), '26:00'), 1530)
  assert.equal(studyDate(new Date(2026, 10, 17, 2, 0), '26:00'), '2026-11-17')
  assert.equal(studyNowMin(new Date(2026, 10, 17, 4, 10), '26:00'), 250)
  assert.equal(studyDate(new Date(2026, 10, 17, 1, 30), '24:00'), '2026-11-17')
})
test('clock shows times after midnight as 00–02', () => {
  assert.equal(clock('25:30'), '01:30'); assert.equal(clock('24:00'), '00:00'); assert.equal(clock('18:10'), '18:10')
})
test('timer across midnight stays on the study date when the day ends at 02:00', () => {
  assert.deepEqual(clipTimerToDay(new Date(2026, 10, 16, 23, 10), new Date(2026, 10, 17, 1, 0), '26:00'), { date: '2026-11-16', start: '23:10', end: '25:00', minutes: 110 })
  assert.deepEqual(clipTimerToDay(new Date(2026, 10, 17, 0, 30), new Date(2026, 10, 17, 1, 15), '26:00'), { date: '2026-11-16', start: '24:30', end: '25:15', minutes: 45 })
  assert.deepEqual(clipTimerToDay(new Date(2026, 10, 17, 1, 30), new Date(2026, 10, 17, 5, 0), '26:00'), { date: '2026-11-16', start: '25:30', end: '26:00', minutes: 30 })
})
