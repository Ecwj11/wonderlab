# Verification record

Verified locally on 6 October 2026 with Node.js 22.18, MySQL 8.0 and Next.js 16.3.8. The app uses a real isolated MySQL instance, not an in-memory database. The final browser run uses the compiled backend and standalone production Next.js server.

| Check                                                   | Result                                                |
| ------------------------------------------------------- | ----------------------------------------------------- |
| `npm run typecheck`                                     | All three workspaces pass                             |
| `npm run lint`                                          | Pass                                                  |
| `npm test`                                              | 94 checks across eight files pass                     |
| `npm run build`                                         | Shared, backend and optimized Next.js build pass      |
| Browser checks                                          | Ten baseline checks; six current Codex UI checks pass |
| `npm audit` / production audit                          | Zero reported vulnerabilities                         |
| `docker compose --env-file .env.example config --quiet` | Configuration validates                               |

## Browser evidence

1. Manual student login → paste fractions → HTTP 202 job → visible progress → fraction selection → both flashcards → three correct answers → +130 XP → 100% persisted completion. Reload preserves progress and cannot award XP twice. No application request contacts the backend port directly; no page errors occur.
2. Malaysia Independence in Bahasa Melayu → explore all five timeline years → two correct quiz answers → +120 XP and completion.
3. Remove the access cookie while retaining the HTTP-only refresh cookie → `/api/auth/me` succeeds and rotates both session cookies → dashboard reload remains authenticated.
4. Student admin API access is denied; admin login, users table, lesson JSON viewer and Escape dismissal work.
5. Mobile 390×844 and tablet 820×1180 fit the viewport; navigation, create, progress and profile remain usable.
6. Upload a real text-based PDF → extracted source preview → generated playable fractions lesson.
7. Upload a clear PNG of textbook text → actual Tesseract extraction → readable preview. Initial language download and cached execution both worked.
8. Administrator previews each of the three templates without changing the global setting, then applies it. Student dashboard, library, creation form and fraction interaction remain usable under every template; student preview overrides are ignored. The original global template is restored after the check.
9. English, Chinese and stacked bilingual interface choices survive reload, preserve lesson interactions and fit a 390px mobile viewport. An injected preference-save failure rolls back the display and preserves the stored preference. Original preferences are restored after the checks.
10. Generated jobs expose completed analyst, planner, scene, quiz and validator tasks without quiz keys. The admin job inspector displays those records. Desktop bilingual dashboard, Chinese space template and mobile creation page were visually inspected.

Screenshots were visually inspected at desktop dimensions. The dashboard displays an older in-progress lesson independently of recent lessons, recent generated cards, recommendations, real XP/streak/time metrics and subject progress. The fractions player uses keyboard-accessible slice buttons and a trusted renderer.

## Regression coverage

Strict JSON/schema bounds and duplicate IDs; hidden quiz keys; authentication/RBAC and suspension; refresh reuse and transient renewal errors; cookie secrecy and origin validation; private lesson/job ownership; durable asynchronous generation; simulated interrupted leases and stale-worker fencing; regeneration identity/versioning; obsolete progress rejection; persisted first quiz choices; transactional/idempotent XP; disguised/oversized uploads and decoded JPEG limits; OCR initialization timeout termination; provider-shaped responses and unsafe JSON rejection; secure first-super-admin provisioning; older dashboard continuation.

Additional coverage verifies administrator-only template writes, strict appearance IDs, per-account language preference isolation and validation, bounded concurrent generation agents, scoped prompts, partial failure without publication, provider-call heartbeats and task identity fencing. Concurrent recovery of an exhausted third attempt retains known usage and writes exactly one billing record. A Gemini-shaped fixture includes thinking tokens in billable output and verifies the cost estimate.

## Actual Codex session generation

The active development environment now uses `AI_PROVIDER=codex`. Two subagents in the current Codex session consumed real, durable bridge requests through the local CLI. An English addition lesson completed, followed by a novel Chinese photosynthesis lesson titled **植物的阳光厨房** (lesson `36723077-3315-47e0-b2bf-1c4ea95b6390`, job `35052680-a7aa-41a4-88d9-0f6533cfb9c4`). Neither generation used MockAIProvider or an external provider API key.

The photosynthesis job completed its analyst, planner, three scene specialists, quiz specialist and local validator. Its published scenes are STORY, PLANT INTERACTIVE_DIAGRAM, FLASHCARD and QUIZ. Manual production-browser verification explored all four activities, answered eight questions correctly, received **+180 XP**, and confirmed persisted **100% completion** and **100% best score**. Public lesson/job responses hide quiz keys and bridge claim tokens. Task and usage record UI marks Codex telemetry as **Not reported**; dashboard aggregates exclude unreported session usage and identify the excluded records.

Nine isolated MySQL bridge tests verify exclusive claims/token rotation, same-job parallel completions, lease renewal/static failure, superseded attempts/tasks, invalid and unsafe output, adapter waiting, scoped scene identity, timeout fencing and required provider context. Additional tests reject missing external credentials without consuming generation quota or resetting progress, and separate unavailable Codex usage from reported provider totals.

The original ten browser checks ran with the demo provider before this switch. Generation checks are not rerun against the live Codex consumer using the demo suite's short timeouts; the real session generation above verifies that path. Six existing browser UI/session/RBAC checks passed against the current Codex-mode production runtime in 17.0 seconds. The updated plant diagram was visually checked and its root/stem/leaf targets match their descriptions; replay preserves the saved 100% completion.

## Playable games and clear lesson statuses

The Codex subagents regenerated addition lesson `26514cf6-d4f7-464d-b62d-4fa52430c01b` through job `e82c1d4b-c754-4981-b11e-cf6d9c45c621`, producing four NUMBER_GAME missions and three semantic MATCHING pairs. Actual browser play verified keyboard construction, native dragging, locked gates until correct quantities are built, wrong-gate retries, pause/resume, all four victories, concealed memory faces, mismatched pair feedback and all three matches. Finishing persisted 100% completion and +50 XP. A second addition lesson `4614e7d2-c649-4cf7-8f3f-0260ccaf7ba8` is ready to play. Its first pre-deployment attempt encountered the old worker schema during graceful shutdown; regeneration under the new runtime completed normally.

Real session job `7e3fd58a-b4fa-4f3d-b3af-10edfb8f812b` produced a one-scene subtraction game (`6bacdccd-959e-41e9-93b1-af1184107b51`). Browser play verified click/drag take-away, 5−2=3, 4−4=0, victory and replay restoring empty groups and locked gates. My Lessons displayed its actual Preparing state, then automatically changed to Ready to play. Cards contain no decorative covers, and READY filtering excluded the completed addition lesson. English/Chinese stacked statuses and games were visually inspected at 390px with no horizontal overflow; reduced-motion users could still play with keyboard controls.

The final workspace checks passed 94 tests, including strict game schemas, impossible arithmetic, ambiguous pairs, incomplete/duplicate/forged results, server arithmetic, idempotent XP and mutually appropriate ready/progress/completed filtering. Codex bridge tests reject reading-only plans and accept identity-preserving game refinements. Production builds and lint passed. Six browser UI/session/template checks passed with the updated tests (the last RBAC check was rerun separately after adapting its minimum agent count to a legitimate single-scene game). A bilingual mobile filter overflow found during manual verification was fixed and added to the language browser check.

## Unverified deployment work

The local Docker daemon was unavailable, so container builds/runtime were not executed. Compose configuration and the equivalent native standalone production runtime were verified. OpenAI/Anthropic/Gemini adapters were tested with injected provider-shaped responses; no live external keys were configured. Configure HTTPS/public `APP_ORIGIN`, secrets, backups, monitoring, retention and first-admin bootstrap for a hosted deployment. Multi-replica deployments need shared rate-limit and refresh-coordination storage. Future product features and demo language limits are documented in README.

## 2D Number Forest

The registered NUMBER_GAME renderer is now an actual 2D forest platform game, using four bundled original artwork files. `npm run check` passed 103 tests, including real walking/jumping routes that collect every block and reach the exit for maximum addition, maximum subtraction and zero operands. Workspace TypeScript, lint and the production build passed. An independent reviewer simulated every valid operand pair at 30/60/120 FPS (561 routes, no reachability failures) and identified pause/focus recovery issues; these were corrected and added to browser coverage.

The forest browser tests use private copies of already generated Codex lessons, preserving original lesson IDs, versions and progress. The addition copy completed all four physical missions and its semantic matching scene, persisted 100% and +50 XP, and awarded zero additional XP on repeat submission. The subtraction copy completed 5−2 and 4−4=0, replayed successfully, and passed start-screen window blur, pause immobility, HUD resume/hint focus, entering/exiting fullscreen with immediate keyboard movement, held-pointer movement, native Chromium touch input and 390px stacked bilingual checks with reduced motion enabled. Phone counting controls were moved above the world to keep the explorer visible. Test copies were deleted after verification. Source IDs are explicitly supplied to the optional forest suite; no mock generation was used.

Six existing browser checks for interface languages, token renewal, RBAC/JSON inspection, mobile/tablet navigation and admin templates also passed against the Codex-mode production runtime. Assets and the finished desktop/phone stages were inspected visually.

After the final fullscreen focus fix, workspace checks again passed all 103 tests and the frontend production build succeeded. The targeted forest control/subtraction/mobile suite passed in 22.6 seconds. The existing in-app lesson tab was refreshed and visibly shows the playable Number Forest.

### Walking animation and stationary camera

The explorer now uses a four-frame walking atlas. Browser observation recorded frames 0, 1, 2 and 3 during grounded travel while the desktop viewBox remained `0 0 1600 640`. Idle stops stepping and pause freezes movement. Two added engine tests cover actual travel, blocked movement, jumping, stationary camera sections, edge transitions, hysteresis and spawn recovery. The inventory now sits above the world at every width; its bottom was confirmed equal to the world's top at a 798px-wide stage, avoiding the full-map overlap identified in review.

Final `npm run check` passed TypeScript, lint and all 105 tests. The frontend production build passed. Both real-content forest browser tests passed in 1.1 minutes: four addition missions plus matching saved 100% completion and +50 XP exactly once; subtraction, replay, pause, HUD focus, fullscreen, native touch and 390px bilingual play also passed. The SVG visibility assertion measures the clipped walking frame using its screen transform, rather than the full atlas bounding box. Test copies were deleted, original lesson progress remained untouched, and the existing in-app lesson tab was refreshed and opened for play. No mock generation was used.

### Reduced-motion walking regression

The user's in-app browser reports reduced motion. The original renderer froze footsteps for that preference, so the legs stayed still while the character moved. Earlier browser coverage changed the preference after the renderer had mounted, which failed to reproduce this initial-preference behavior. The updated regression sets reduced motion before navigation and asserts that walking frames change: it failed against the old build with frame 1 unchanged, then passed after removing the reduced-motion gate from essential footsteps. Decorative motion remains disabled and the camera stays fixed.

Fresh TypeScript, lint, all 105 tests and the frontend production build passed. The targeted browser suite passed in 22.7 seconds, including initial reduced-motion walking, subtraction, pause, fullscreen, native touch and bilingual mobile play. Manual observation with reduced motion enabled recorded changing sprite frames and the unchanged desktop viewBox. The user's existing lesson tab was refreshed with the corrected build.

## 2D adventures for other subjects

Non-mathematics MATCHING now renders four illustrated worlds: a science garden, Malaysian heritage town, Malaysian geography expedition and school kindness quest. Real movement and jumping collect clues; semantic missions retry wrong meanings. All missions are required to build a bridge, and physical exit arrival is required before the renderer emits its existing matchedIds result. Mathematics retains its forest game and supplementary memory board. No generated code or schema version change was introduced.

Fresh workspace checks passed TypeScript, ESLint and all **109 tests** in ten files. Both backend and frontend production builds passed. Four adapter tests verify physical pickup, wrong-answer retries, mission freezing, fall recovery, unique choices, a complete eight-clue route, bridge gating and exit completion. Prompt regression tests failed against the former card instructions, then passed with the new subject-aware mechanics.

Production browser checks played all four subject worlds using temporary private copies of real Codex-generated lessons. Each completed six missions, retried a wrong answer, closed/reopened a pending mission, kept the desktop viewBox fixed, physically reached the exit, dismissed victory and navigated by keyboard to Next discovery. Science then explored its supporting plant diagram, persisted 100% completion and +50 XP, and a repeated submission awarded zero XP. The separate reduced-motion/mobile check passed in 3.9 seconds: multiple grounded walking frames, start-screen blur, paused immobility, hint/resume focus, fullscreen, 390px stacked bilingual text, no page overflow, native touch movement and touch cancellation. Test synchronization was corrected to answer missions discovered during landing and to wait for responsive layout after viewport changes.

Both existing real-content mathematics forest checks also passed (44.3 and 21.5 seconds), covering full addition/matching completion, idempotent XP, subtraction including zero, pause, fullscreen, touch and bilingual mobile play. All verification copies were deleted; original six non-math samples remain unstarted at 0%. XP earned on disposable verification copies is recorded normally in the admin account ledger.

Five real Codex regeneration jobs completed and preserved PUBLIC visibility at lesson version 2; GENERAL retains its original real-authored version because the daily quota rejected regeneration, and uses the renderer's trusted adventure instructions. A separate student session confirmed all six samples are discoverable in Library, accessible with HTTP 200, and do not expose quiz answer keys. Content review preserved the documented Malaysian historical/geographical distinctions. Four backgrounds were inspected and their unchanged provenance documented. Independent review found a victory keyboard trap, which was fixed with Continue learning and Escape dismissal and verified in browser play. The existing in-app tab now shows the playable Merdeka world.

## Family accounts and admin-managed subscriptions — 2026-10-07

Implemented separate `/admin/login`, `/parent/login` and `/child/login`; one parent owns one family and one shared entitlement. Migration 008 was applied to the existing local database, and the dedicated family seed added parent/child demos without changing sample lessons or the active Codex provider. Default Starter/Family prices are editable examples; no online payments or recurring charges are executed.

Workspace TypeScript, ESLint and all **128 tests in 12 files** passed. Backend and Next.js production builds passed. Thirteen real-MySQL family scenarios cover portal role separation, family isolation, child limits, passcode access/refresh invalidation, admin trial expiry/override, unpaid requests, paid snapshots/cancellation, subject and upload restrictions, private family lesson sharing with individual progress, duplication without AI credit consumption, concurrent generation/regeneration quotas, time limits, rapid/multiple-tab heartbeats, orphan children and independent family locks. Additional proxy tests confirm all four portal credential endpoints strip tokens from JSON and set HTTP-only cookies, and failed child login is not retried with another account’s refresh session.

Independent review exposed and resolved: child timezone allowance resets; fractional heartbeat time loss; stale MySQL repeatable-read regeneration credit counts; ignored admin subscription status filters; passcode reset access-token lifetime; unrelated-family locking; and orphan child fallback to legacy access. Shared update-schema regression coverage prevents pausing a child from resetting other parental controls.

The production browser family flow passed: parent registers → creates child → requests a plan → admin sets trial to zero → access expires without the pending request granting access → admin activates a paid period → child signs in → creation permission blocks the create page → public Library is accessible → child starts a Malaysian history 2D game and moves the mascot → parent pauses learning → the open game is removed by the next heartbeat → lesson API returns 403. Three existing language/template browser tests also passed, including language-save recovery, en/zh/bilingual persistence and admin template selection. No AI generation was requested during these browser checks. Temporary family test records were deleted.

Desktop parent dashboard, child controls, subscription management, all three mobile login screens and bilingual parent screens were inspected. Parent mobile layouts have no horizontal overflow at 390px. Screenshots are in `frontend/artifacts/parent-*.png`, `family-*.png` and `*-login-mobile.png`. Demo parent language was restored to English after inspection. Parents control daily lesson-screen allowance; this is server-timed session accounting rather than an OS-level device restriction. Pauses and expiry hide an already-open lesson at the next 15-second UI check; backend progress/quiz/generation requests enforce access immediately.

Final bilingual polish scopes stacked English/Chinese layout and language metadata to the parent shell, matching the child portal. Frontend TypeScript, full lint and the production frontend build passed after this visual change; browser computed style confirmed `flex-direction: column` and no 390px page overflow. The targeted family browser flow passed again against the final functional build in 22.7 seconds. Production API/Next servers were restarted with the updated builds at ports 4000/3000, still using `AI_PROVIDER=codex`.

## Demo credential update — 2026-10-07

At the user’s request, all five local demo accounts now use `qwer1234!`, including the WONDER01/alex child passcode. Seed defaults, development demo login shortcuts, README and affected test fixtures were updated consistently. Existing demo password hashes were changed transactionally, refresh sessions revoked, and existing lessons/progress preserved. All five live API logins returned HTTP 200. `npm run check` passed TypeScript, ESLint and all 128 tests; the backend build passed.
