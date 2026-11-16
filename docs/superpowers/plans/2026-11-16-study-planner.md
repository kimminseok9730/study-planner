# 공부 기록장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An iPad Safari home-screen web app that plans the day in 30-minute slots, records what was actually done (timer or manual), tracks 인강 course progress, and imports course lecture lists from screenshots via free on-device OCR.

**Architecture:** Static files, no build step, ES modules. Pure logic (time math, progress, achievement, backlog, OCR text parsing, backup validation) lives in small modules tested with Node's built-in test runner. A thin IndexedDB store and DOM view modules sit on top. A service worker caches the app shell for offline use. Hosted on GitHub Pages.

**Tech Stack:** HTML/CSS/vanilla JS (ES modules), IndexedDB, Service Worker + Web App Manifest, Tesseract.js 5.1.1 (`kor` traineddata, loaded from jsDelivr), Node 24 `node --test` for unit tests.

**Spec:** `docs/superpowers/specs/2026-11-16-study-planner-design.md` (mockup: https://claude.ai/artifact/WwKzxLqFuDLbBQ9GqxJULp)

## Global Constraints

- UI language: Korean. Layout targets iPad landscape; stacks to one column under 700px width.
- Zero cost: no paid APIs, no server, no accounts. Data only in the device's IndexedDB.
- Time grid: 30-minute slots, default range `06:00`–`24:00`, configurable in settings. Timer records exact minutes.
- OCR results are never saved without the confirm/edit screen.
- Frequent actions (timer start/stop, lecture done) take one or two taps.
- Dates are local `YYYY-MM-DD` strings; times are `HH:MM` strings (`24:00` allowed as end).
- Backup reminder appears when last export is older than 7 days.
- All code under `study-planner/`. Tests: `node --test tests/` from `study-planner/`.

## Review Focus

1. A timer left running across midnight or for hours (app closed): on reopen it shows correct elapsed time; on stop, the actual block is saved on the start date, clipped to the day end, never a negative or zero-length block. → test in Task 1 (`clipTimerToDay`).
2. OCR text with noise (page numbers, durations like `25:13`, duplicated lines across two screenshots): parser must not count durations as lectures and merge must not double-count. → tests in Task 4.
3. A lecture planned twice (carried over, then done): progress counts it once; backlog drops it once done. → tests in Task 2.
4. Importing a malformed or older backup file: rejected with a Korean message, existing data untouched. → test in Task 3.
5. Plan blocks with end ≤ start or overlapping blocks in the same column: rejected on save with a message. → test in Task 1 (`validateBlock`).

---

## File Structure

```
study-planner/
  index.html               app shell, loads src/app.js as module
  styles.css               tokens (light/dark), layout from the mockup
  manifest.webmanifest     name "공부 기록장", display standalone, icons
  sw.js                    cache-first app shell, versioned cache name
  icons/icon-192.png, icon-512.png, apple-touch-icon.png
  src/time.js              pure: time/slot math, block validation, timer clipping
  src/model.js             pure: course progress, achievement, backlog
  src/backup.js            pure: export payload, import validation
  src/ocr-parse.js         pure: OCR text → lecture list, merging
  src/store.js             IndexedDB wrapper (courses, plans, actuals, settings)
  src/ocr.js               Tesseract.js wrapper (lazy-loaded)
  src/views/day.js         header summary + plan/actual grid
  src/views/courses.js     course list, progress bars, lecture checklist
  src/views/picker.js      "what are you doing" sheet (today's plans + 기타)
  src/views/timer.js       floating timer bar
  src/views/import.js      screenshot import + confirm/edit screen
  src/views/backlog.js     밀린 것 tray
  src/views/settings.js    day range, backup export/import
  src/app.js               boot, routing between views, SW registration
  tests/*.test.mjs
```

### Data shapes (shared by all tasks)

```js
Course  = { id, name, platform: 'mimac'|'mega'|'etc', teacher?: string,
            lectures: [{ label: string /* '1','12','1-2','OT' */, order: number, title?: string, done: boolean, doneAt?: string }] }
            // total lectures = lectures.length
Plan    = { id, date, start, end, kind: 'lecture'|'text',
            courseId?, labels?: string[] /* lecture labels */, text?, fromPlanId?: string }
Actual  = { id, date, start, end, minutes: number, planId: string|null,
            kind: 'lecture'|'text', courseId?, labels?, text?, source: 'timer'|'manual' }
Timer   = { startedAt: ISO string, planId: string|null, kind, courseId?, labels?, text? }   // stored in settings.timer
Settings= { dayStart: '06:00', dayEnd: '24:00', lastBackupAt: ISO|null, timer: Timer|null }
```

---

### Task 1: Project setup and time math

**Files:**
- Create: `study-planner/package.json` (`{"type":"module","scripts":{"test":"node --test tests/"}}`), `.gitignore`, `src/time.js`
- Test: `tests/time.test.mjs`

**Interfaces:**
- Produces: `toMin(hhmm: string): number`, `toHHMM(min: number): string`, `slots(dayStart, dayEnd): string[]` (every 30 min, start inclusive, end exclusive), `duration(start, end): number`, `validateBlock(block, others: Block[]): string|null` (Korean error or null), `clipTimerToDay(startedAt: Date, now: Date, dayEnd: string): {date, start, end, minutes}|null`, `localDate(d: Date): string`.

- [ ] **Step 1: `git init` in `study-planner/`, add package.json and .gitignore**
- [ ] **Step 2: Write failing tests**

```js
test('slots', () => { assert.deepEqual(slots('06:00','08:00'), ['06:00','06:30','07:00','07:30']) })
test('24:00 end', () => { assert.equal(toMin('24:00'), 1440); assert.equal(duration('23:30','24:00'), 30) })
test('end<=start rejected', () => { assert.equal(validateBlock({start:'10:00',end:'10:00'}, []), '끝 시간이 시작 시간보다 늦어야 해요') })
test('overlap rejected', () => { assert.equal(validateBlock({id:'b',start:'10:00',end:'11:00'}, [{id:'a',start:'10:30',end:'12:00'}]), '다른 블록과 시간이 겹쳐요') })
test('self not overlap', () => { assert.equal(validateBlock({id:'a',start:'10:00',end:'11:00'}, [{id:'a',start:'10:00',end:'11:00'}]), null) })
test('timer across midnight clipped to day end', () => {
  const r = clipTimerToDay(new Date(2026,10,16,23,10), new Date(2026,10,17,1,0), '24:00')
  assert.deepEqual(r, { date:'2026-11-16', start:'23:10', end:'24:00', minutes:50 })
})
test('timer under 1 minute → null', () => { assert.equal(clipTimerToDay(new Date(2026,10,16,9,0,0), new Date(2026,10,16,9,0,40), '24:00'), null) })
```

- [ ] **Step 3: Run `npm test` — expect FAIL (module not found)**
- [ ] **Step 4: Implement `src/time.js`**
- [ ] **Step 5: Run `npm test` — expect PASS**
- [ ] **Step 6: Commit `feat: time math`**

### Task 2: Progress, achievement, backlog

**Files:** Create `src/model.js`; Test `tests/model.test.mjs`

**Interfaces:**
- Consumes: `duration` from `src/time.js`.
- Produces:
  - `courseProgress(course): {done: number, total: number, percent: number /* integer 0-100 */}`
  - `dayAchievement(plans: Plan[], actuals: Actual[], courses: Course[]): {plannedMin, actualMin, percent}` — per plan: lecture plan contributes `duration × (done labels / planned labels)` (done = course lecture `done`); text plan contributes `min(duration, Σ minutes of actuals with planId === plan.id)`. `actualMin` = Σ all actuals' minutes. `percent` integer, 0 when no plans.
  - `backlog(plans: Plan[], courses: Course[], today: string): BacklogItem[]` where `BacklogItem = {kind:'lecture', courseId, labels: string[], fromPlanId} | {kind:'text', text, fromPlanId}`. Only plans with `date < today`. Lecture item: labels that are **not done and not in any plan dated `>= today`**. Text item: no actual linked and no other plan has `fromPlanId === plan.id`. Empty lecture items dropped.

- [ ] **Step 1: Write failing tests**

```js
test('progress', () => { assert.deepEqual(courseProgress({lectures:[{done:true},{done:false},{done:false}]}), {done:1,total:3,percent:33}) })
test('lecture plan partial', () => {
  const c = {id:'c', lectures:[{label:'3',done:true},{label:'4',done:true},{label:'5',done:false}]}
  const p = [{id:'p',date:'2026-11-16',start:'18:00',end:'19:30',kind:'lecture',courseId:'c',labels:['3','4','5']}]
  assert.equal(dayAchievement(p, [], [c]).percent, 67)
})
test('text plan capped at duration', () => {
  const p = [{id:'p',start:'21:00',end:'22:00',kind:'text',text:'기출'}]
  const a = [{planId:'p',minutes:90}]
  assert.deepEqual(dayAchievement(p, a, []), {plannedMin:60, actualMin:90, percent:100})
})
test('backlog keeps only undone lecture 5', () => { /* plan 3~5 on 11-15, 3,4 done, today 11-16 → [{kind:'lecture',courseId:'c',labels:['5'],fromPlanId:'p'}] */ })
test('backlog drops lecture once replanned today', () => { /* add plan dated 11-16 with labels ['5'] → [] */ })
test('backlog drops done lecture even if planned twice', () => { /* label 5 done → [] */ })
test('text plan with linked actual not in backlog', () => {})
```

- [ ] **Step 2: Run — FAIL. Step 3: Implement. Step 4: Run — PASS.**
- [ ] **Step 5: Commit `feat: progress, achievement, backlog`**

### Task 3: Backup export/import validation

**Files:** Create `src/backup.js`; Test `tests/backup.test.mjs`

**Interfaces:**
- Produces: `makeBackup(data: {courses, plans, actuals, settings}, now: Date): {app:'study-planner', version:1, exportedAt, ...data}`; `parseBackup(jsonText: string): {ok:true, data} | {ok:false, error: string}`; `needsBackupReminder(lastBackupAt: string|null, now: Date): boolean` (true when null or > 7 days).

- [ ] **Step 1: Failing tests** — round trip `parseBackup(JSON.stringify(makeBackup(d, now))).data` deep-equals `d`; `parseBackup('{')` → `{ok:false, error:'백업 파일을 읽을 수 없어요'}`; wrong `app` or missing arrays → `{ok:false, error:'공부 기록장 백업 파일이 아니에요'}`; `version > 1` → `{ok:false, error:'더 새로운 버전의 백업이에요'}`; reminder true at 8 days, false at 6.
- [ ] **Step 2–4: FAIL → implement → PASS**
- [ ] **Step 5: Commit `feat: backup format`**

### Task 4: OCR text parsing

**Files:** Create `src/ocr-parse.js`; Test `tests/ocr-parse.test.mjs`

**Interfaces:**
- Produces: `parseLectureText(text: string): ParsedLecture[]` with `ParsedLecture = {label: string, order: number, title: string, ambiguous: boolean}`; `mergeLectureLists(lists: ParsedLecture[][]): ParsedLecture[]` (dedupe by `label`, keep first non-empty title, sort by `order`); `guessCourseName(text: string): string` (first non-lecture line with ≥ 4 Hangul/Latin chars, trimmed, else `''`).
- Recognized lecture line forms: `12강 제목`, `제12강 제목`, `12. 제목`, `12) 제목`, `1-2강 제목` (ambiguous), lines containing `OT`, `오리엔테이션`, `보충`, `특강` (ambiguous, label = that word or `OT`). `order` for `a-b` = `a + b/100`; for OT = 0; for 보충/특강 = 1000+index.
- Not lectures: pure durations (`25:13`, `1:02:45`), lines that are only digits, percentages.

- [ ] **Step 1: Failing tests**

```js
test('basic forms', () => {
  const r = parseLectureText('수능 수학 개념 완성\n1강 집합과 명제\n제2강 함수\n3. 수열\n25:13\n4) 극한')
  assert.deepEqual(r.map(x=>x.label), ['1','2','3','4'])
  assert.equal(r[0].title, '집합과 명제')
})
test('ambiguous', () => {
  const r = parseLectureText('OT 오리엔테이션\n1-2강 지수\n보충강 문제풀이')
  assert.deepEqual(r.map(x=>[x.label,x.ambiguous]), [['OT',true],['1-2',true],['보충1',true]])
})
test('merge dedupes overlapping screenshots', () => {
  const a = parseLectureText('1강 A\n2강 B\n3강 C'), b = parseLectureText('3강 C\n4강 D')
  assert.deepEqual(mergeLectureLists([a,b]).map(x=>x.label), ['1','2','3','4'])
})
test('course name guess', () => { assert.equal(guessCourseName('수능 수학 개념 완성\n1강 집합'), '수능 수학 개념 완성') })
```

- [ ] **Step 2–4: FAIL → implement → PASS**
- [ ] **Step 5: Commit `feat: OCR text parsing`**
- Note: after the user sends real 마이맥/메가스터디 screenshots, add their OCR output as fixture tests and adjust patterns (separate follow-up commit).

### Task 5: IndexedDB store

**Files:** Create `src/store.js`; Test `tests/store.test.mjs` (uses `fake-indexeddb@6.0.0` as a devDependency, imported via `fake-indexeddb/auto`)

**Interfaces:**
- Produces (all async): `openStore(name='study-planner')`, `getAll(storeName)`, `getByDate(storeName /* 'plans'|'actuals' */, date)`, `put(storeName, obj)` (assigns `id` via `crypto.randomUUID()` when missing, returns obj), `remove(storeName, id)`, `getSettings(): Settings` (defaults when empty), `saveSettings(patch)`, `replaceAll(data)` (single transaction; on error nothing changes), `exportAll(): {courses, plans, actuals, settings}`.
- Object stores: `courses`, `plans` (index `date`), `actuals` (index `date`), `settings` (single key `'main'`).

- [ ] **Step 1: Failing tests** — put/getByDate round trip; `getSettings()` returns `{dayStart:'06:00', dayEnd:'24:00', lastBackupAt:null, timer:null}` on empty DB; `replaceAll` with a bad object (missing `id` in `courses`) rejects and previous data still readable.
- [ ] **Step 2–4: FAIL → implement → PASS**
- [ ] **Step 5: Commit `feat: IndexedDB store`**

### Task 6: App shell, styles, day view

**Files:** Create `index.html`, `styles.css`, `src/app.js`, `src/views/day.js`

**Interfaces:**
- Consumes: store, `slots`, `duration`, `validateBlock`, `dayAchievement`, `courseProgress`.
- Produces: `renderDay(root: HTMLElement, date: string, ctx)` where `ctx = {store, courses, refresh(): Promise<void>, openPicker(opts), openPlanEditor(opts)}`; `app.js` exports nothing, owns `ctx` and `refresh`.

- [ ] **Step 1:** Port mockup layout/tokens (light + dark) into `styles.css`; `index.html` with `<meta name="apple-mobile-web-app-capable" content="yes">`, viewport, manifest link, apple-touch-icon.
- [ ] **Step 2:** Day view: header (‹ date ›, 계획/실제/달성 from `dayAchievement`), grid of `slots(dayStart, dayEnd)` rows with two columns. Blocks span rows by duration. Tapping an empty 계획 cell opens a plan editor (start/end selects in 30-min steps, kind 강의/할 일, course + lecture checkboxes or text). Saving calls `validateBlock` against same-column blocks and shows the error inline. Tapping a plan block offers 수정 / 삭제. Missed-lecture blocks (linked actual saved but some planned labels undone) get the orange outline.
- [ ] **Step 3:** Open via a local static server (`npx serve@14.2.4 .`) in the browser pane at iPad landscape (1180×820); add a plan, reload, confirm it persists; check dark mode.
- [ ] **Step 4: Commit `feat: day view`**

### Task 7: Recording — picker, manual entry, timer, lecture done

**Files:** Create `src/views/picker.js`, `src/views/timer.js`; Modify `src/views/day.js`, `src/app.js`

**Interfaces:**
- Consumes: `clipTimerToDay`, `localDate`, `toHHMM`, store, `settings.timer`.
- Produces: `openPicker({date, onPick(choice)})` where `choice = {planId, kind, courseId?, labels?, text?}` (tapping a today's plan returns it with `planId`; "기타" returns `planId:null` after a course/text form); `startTimer(choice)`, `stopTimer(): Promise<Actual|null>`, `renderTimerBar(root)` (shows label and live `HH:MM:SS` from `startedAt`, 정지 button).
- `confirmLectures({courseId, labels})`: sheet listing planned labels pre-checked; 확인 marks checked ones `done:true, doneAt` on the course.

- [ ] **Step 1:** Floating 시작 button → picker → `startTimer` (2 taps for a planned item). Timer state saved to settings so it survives reload.
- [ ] **Step 2:** 정지 → `clipTimerToDay` → save `Actual{source:'timer'}` (null → toast "1분 미만이라 저장하지 않았어요") → if lecture kind, `confirmLectures`.
- [ ] **Step 3:** Tapping an empty 실제 cell → picker → time editor (prefilled with the tapped slot and the plan's end) → save `Actual{source:'manual'}` → `confirmLectures` if lecture.
- [ ] **Step 4:** Verify in browser pane: start timer, reload page, timer still counting; stop; block appears; lecture checklist marks progress; header percent updates.
- [ ] **Step 5: Commit `feat: recording with timer and manual entry`**

### Task 8: Courses, backlog, settings/backup

**Files:** Create `src/views/courses.js`, `src/views/backlog.js`, `src/views/settings.js`; Modify `src/app.js`

**Interfaces:**
- Consumes: `courseProgress`, `backlog`, `makeBackup`, `parseBackup`, `needsBackupReminder`, store `exportAll`/`replaceAll`.
- Produces: `renderCourses(root, ctx)`, `renderBacklog(root, ctx)`, `renderSettings(root, ctx)`.

- [ ] **Step 1:** Courses panel: progress bar per course (`n / total강`, %, 남은 n강); tap → lecture checklist (toggle done), edit name/platform/teacher, add lectures by "총 n강" quick fill (labels `1..n`), delete course with in-page confirm. 강좌 추가 offers 직접 입력 / 캡처로 추가 (Task 9).
- [ ] **Step 2:** 밀린 것 tray under courses: items from `backlog(...)`; tapping one opens the plan editor for the current day prefilled with its kind/course/labels/text and `fromPlanId`.
- [ ] **Step 3:** Settings: day start/end selects; 백업 내보내기 builds `makeBackup`, offers it via a Blob download link (`study-planner-YYYY-MM-DD.json`) and sets `lastBackupAt`; 백업 불러오기 file input → `parseBackup` → in-page confirm → `replaceAll`. Quiet banner on day view when `needsBackupReminder`.
- [ ] **Step 4:** Browser check: export, delete a course, import, course is back.
- [ ] **Step 5: Commit `feat: courses, backlog, backup`**

### Task 9: Screenshot import

**Files:** Create `src/ocr.js`, `src/views/import.js`; Modify `src/views/courses.js`

**Interfaces:**
- Consumes: `parseLectureText`, `mergeLectureLists`, `guessCourseName`.
- Produces: `recognize(files: File[], onProgress(p: number)): Promise<string[]>` (lazy `import('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.esm.min.js')`, worker lang `kor+eng`, terminates worker after); `openImport(ctx)`.

- [ ] **Step 1:** Import screen: pick one or more images (`<input type=file accept=image/* multiple>`), progress bar, then confirm screen: editable course name (prefilled `guessCourseName`), platform select, table of lectures (label, title editable, include checkbox; ambiguous rows unchecked by default and marked), add/remove rows. 저장 creates the Course. Nothing is written before 저장.
- [ ] **Step 2:** If an existing course is chosen as target, merged lectures are appended (skip labels already present, keep their `done`).
- [ ] **Step 3:** Browser check with a generated sample image (text "1강 집합과 명제 / 2강 함수 / 25:13"); confirm parsed rows, save, progress shows 0/2.
- [ ] **Step 4: Commit `feat: screenshot import`**

### Task 10: PWA and deploy

**Files:** Create `manifest.webmanifest`, `sw.js`, `icons/*`; Modify `index.html`, `src/app.js`

- [ ] **Step 1:** Manifest (`name` "공부 기록장", `short_name` "공부기록", `display` standalone, `start_url` "./", theme colors from tokens). Icons 192/512/180 generated as simple PNGs (Node script, not shipped).
- [ ] **Step 2:** `sw.js` caches app shell files under `cache-v1`; network-first for `index.html`, cache-first for the rest; Tesseract assets cached at runtime after first use.
- [ ] **Step 3:** Browser check: load, go offline (devtools/network off), reload → app works.
- [ ] **Step 4:** Commit `feat: PWA`. **Ask the user before** creating the public GitHub repo `study-planner` and enabling Pages (`gh repo create`, push, `gh api` Pages enable). Then give them the URL and the 사파리 → 공유 → 홈 화면에 추가 steps.
