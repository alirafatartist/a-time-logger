# Time Logger (web)
Vanilla ES modules + Firebase Auth/Firestore + Chart.js. Arabic (RTL) / English (LTR).
## Run
1. Firebase console → project `a-time-logger`: enable **Authentication** (Email/Password, optional Google) and **Firestore**.
2. `js/config.js` already holds your web config (a web API key is public; `firestore.rules` is what protects data). Add your domain under Auth → Authorized domains.
3. `firebase deploy --only firestore:rules` (publishes `firestore.rules`).
4. Serve over HTTP (modules need it): `npx serve .` or `firebase init hosting` (public dir `.`) then `firebase deploy --only hosting`.
5. Tests: `node --test test/util.test.mjs`
## Data model (all under `users/{uid}`)
`activities/{id}` {name,icon,color,parentId,order,archived,description} · `timeEntries/{startTs}` {activityId,start,end,note} (ms timestamps; id = start ⇒ retries never duplicate) · `tracking/current` {activityId,start} · `goals/{id}` {name,activityId,period,target(min)} · `settings/preferences`.
## Rules of calculation
- Entries are canonical; the running timer is `now − start` (no per-second writes) and counts as a live entry.
- Entries never overlap (manual inserts are rejected if they do); switching activity closes the previous entry at the same instant.
- Each entry belongs to one activity; a parent's total = its own + descendants' entries, each counted once. Chart/stats use top-level subtrees, so no double counting.
- Untracked = elapsed time (up to now) in the period not covered by the union of entries.
- Deleting a type with history archives it instead; its children move up one level.
## Known limitations (not built yet)
Pause/resume, custom date range & previous/next presets beyond ±offset, drag-and-drop, searchable icon picker (emoji text field instead), streak/frequency/session-count goals (only time goals per day/week/month), goal reminders, browser notifications/PWA, appearance settings beyond language/theme/week start, pagination (loads latest 3000 entries), skeleton loaders, full tracking-settings parity with the Android app, UI tests. Native Android notification-bar controls and home-screen widgets cannot be reproduced by a web page.
## Redesign notes
- Design system in `css/style.css` (dark/light/system themes; the theme lives in `settings/preferences`, so it syncs live to every open session).
- `js/templates.js`: flat template library (no forced parents); add several at once, or ✎ to customise one first. Template ids are deterministic, so re-adding never duplicates.
- Icons: Lucide library, emoji, or an uploaded image. Images are cropped to 96×96 WebP and stored inside the activity document (limit 30 KB in `firestore.rules`), so they persist and sync everywhere without Firebase Storage.
- Redeploy the rules: `firebase deploy --only firestore:rules`.
## Compact grids and entry dialog
Activities and Types are icon tiles (icon above name, auto-fill grid; ▸ badge drills into sub-activities). On Time, the + button opens a Time / Type / Details dialog; clicking an existing entry opens the same dialog marked "Recorded". New entries use the start timestamp as their id and are rejected if they overlap an existing entry, so retries never duplicate.
## Sessions (Running / Paused / Completed)
`users/{uid}/sessions/{id}` = {activityId,status,note,intervals:[{s,e|null}]}. Tracked time = sum of intervals, so paused time is excluded; resuming appends an interval to the same session (no duplicate). Starting another activity pauses the running one at that instant. Manual entries are completed sessions (start/end date+time, may span midnight). Time page rows are derived from intervals. Legacy `tracking/current` timers are migrated automatically. Concurrent edits to the same session are last-write-wins.
