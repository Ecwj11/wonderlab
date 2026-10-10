# Family accounts and subscriptions

Requested 2026-10-07. One parent owns one family workspace and one shared subscription. Children have individual logins, progress and XP; they share family lessons and generation credits. Existing standalone students, teachers and admins keep their current access.

## Account boundaries

- Admin: `/admin/login` → `/admin`. Manage plans, families, trial expiry and subscriptions. Existing admin API RBAC remains mandatory.
- Parent: `/parent/login` → `/parent`. Email/password registration creates one family atomically; unique parent ownership prevents multiple workspaces. Parents manage only their own children, learning controls and subscription requests.
- Child: `/child/login` → `/app`. Use family code, child username and a hashed passcode (at least six characters). No email required. Child users retain STUDENT role and are identified by their family membership. Parent-issued passcode resets revoke refresh tokens. Children cannot manage billing, public sharing or family settings.
- Legacy `/login` remains compatible. Family child synthetic addresses cannot authenticate through email login. Wrong portal credentials fail before issuing tokens. No caller-supplied roles, user IDs or family IDs are trusted for ownership.

## Plans and entitlement

Plans contain name, description, monthly price in integer MYR cents, child limit, generation limit per billing period, trial days and active state. Start with editable illustrative Starter and Family plans. Plan changes do not retroactively change purchased subscription limits: store activation snapshots. Deactivated plans cannot be newly requested; historical subscriptions remain readable.

New parents receive the default active plan's trial. Admins can set a specific parent's trial to 0–365 days from now; 0 ends the trial immediately. Access expires based on server timestamps, without relying on a cron job. An active paid period takes precedence over trial; expired, cancelled or pending subscriptions do not grant paid access. A plan request during a trial preserves remaining trial access.

Initial billing is admin-managed: parents request a plan, admins activate a dated subscription after arranging payment. Choosing a plan does not claim payment or immediately activate paid access. No card details are collected, no invented transaction succeeds, and no recurring charge is executed. Payment-provider integration is a separate adapter when credentials and checkout requirements are supplied.

## Parent controls

Create child profiles up to the effective plan limit; edit name, school level, avatar, allowed subjects and daily learning allowance (5–240 minutes); pause/resume individual children and reset passcodes. All controls are enforced by backend access checks, not merely hidden navigation. Family suspension or parent suspension blocks child access.

Daily screen allowance counts time on a visible lesson screen using server-timed heartbeats, capped per heartbeat and stored per child/local date. Request bodies do not supply elapsed time. Access is rechecked on heartbeat, lesson reads, progress/quiz submission, uploads and generation. Multiple tabs do not double charge the same elapsed interval. Missing heartbeats do not accumulate unbounded time. Existing gamification learning statistics remain separate from parental screen allowance.

As of 2026-10-08, parents create courses at `/parent/create` and track them at `/parent/lessons`. The same validated form and generation pipeline are reused. Children see these shared courses in `/app/lessons`, with individual progress and subject limits. Parent generation completion returns to Family lessons rather than automatically starting a child game.

Child lesson generation is temporarily disabled. Navigation, dashboard prompts, empty states and child-profile creation permission controls are hidden. `/app/create` redirects children to My lessons and parents to `/parent/create`. Children cannot submit generation, regeneration or upload requests even if an old `can_generate` value is true; `/learning-access` reports `canGenerate:false`. The stored setting remains reserved for a future rollout. Children can continue reusing library courses through the existing learning flow without consuming AI credits. Administrators can repair historical child-owned lessons using the parent's family allowance.

Generation credit consumption is transactional across parent and administrator requests. Accepted generation/regeneration jobs reserve one credit; library replay and duplication do not consume AI credits. A family lock prevents concurrent requests from overspending. Existing system daily generation limit still applies. Generation jobs carry a relational family_id for indexed period reporting. Parent-created lessons are playable by family children; their progress remains individual. Family members cannot access another family's private material.

## API contract

All browser requests use `/api/*`; these are backend paths:

| Method | Path | Result / input |
| --- | --- | --- |
| POST | `/auth/parent/register` | `{name,email,password,familyName}` → token envelope |
| POST | `/auth/parent/login` | `{email,password}` → parent token envelope |
| POST | `/auth/admin/login` | `{email,password}` → admin token envelope |
| POST | `/auth/child/login` | `{familyCode,username,passcode}` → child token envelope |
| GET | `/parent/dashboard` | FamilyDashboard |
| POST | `/parent/children` | ChildCreateInput → FamilyChild |
| PATCH | `/parent/children/:id` | ChildUpdateInput → FamilyChild |
| POST | `/parent/children/:id/passcode` | `{passcode}` → `{ok:true}` |
| GET | `/parent/children/:id/progress` | Own child's ProgressStats |
| GET | `/parent/billing` | FamilyBilling |
| POST | `/parent/subscriptions` | `{planId}` → SubscriptionRequest |
| POST | `/parent/subscriptions/:id/cancel` | Cancel own pending/active subscription |
| GET | `/plans` | Active SubscriptionPlan[] |
| GET | `/learning-access` | LearningAccess (legacy users also supported) |
| POST | `/learning-heartbeat` | No elapsed time input → LearningAccess |
| GET/POST | `/admin/plans` | Paginated plans / PlanInput |
| PATCH | `/admin/plans/:id` | Partial PlanInput |
| GET | `/admin/families` | Paginated AdminFamily[] |
| GET | `/admin/families/:id` | FamilyDashboard |
| PATCH | `/admin/families/:id` | `{status?:'ACTIVE'|'SUSPENDED',trialDays?:number}` |
| GET | `/admin/subscriptions` | Paginated FamilySubscription[] |
| POST | `/admin/subscriptions` | `{familyId,planId,periodDays}` activates paid period |
| PATCH | `/admin/subscriptions/:id` | `{status:'CANCELLED'}` |

Shared response and input types live in `shared/src/family.ts`. Optional `User.accountType` identifies ADMIN/PARENT/CHILD/LEARNER; `User.familyId` is membership metadata, never a caller-authorized scope.

## UI and verification

Parent home shows family code, trial/subscription status, shared usage and child progress. Children page provides real create/edit/pause/reset forms. Billing page shows plans, pending requests, current period and cancellation. Admin Families, Plans and Subscriptions pages use existing professional layout; parent UI is friendly and calm, child UI retains game design and en/zh/bilingual preferences.

Test isolation between families, role-specific logins, trial expiry and admin override, expired/suspended access, generation credit races, subject restrictions, pause/reset, child limit, heartbeat limits and billing requests that do not activate access. Browser test the full flow: parent register → child create → admin trial/plan activation → child login/play → parent pause → child blocked. Use temporary accounts and retain seeded examples. The active AI provider remains Codex; do not enqueue unnecessary live AI jobs during UI verification.

## Per-child lesson grade access — 2026-10-08

On `/parent/children`, each child's create/edit form includes **Allowed lesson grades**. **All grades** is the default for new and existing children. Parents can choose one or more of Primary 1–6 and Secondary 1–5. A child's descriptive **School level** remains independent of this access list; changing it does not silently change lesson permissions.

`ChildCreateInput`, `ChildUpdateInput`, `FamilyChild` and `LearningAccess` expose `allowedSchoolLevels: SchoolGrade[] | null`. `null` means unrestricted grade access; a nonempty unique array selects grades. Empty lists, duplicate grades and unknown grade names are rejected. Omitting the field during a PATCH preserves its current value. Only the owning parent can edit it. Migration `011_child_lesson_grades.sql` adds a nullable JSON column and preserves all existing rows and learning records.

Grade matching uses lesson metadata (`lessons.school_level`), with the same shared matcher for listings and direct access. Exact labels such as `Primary 2` match that grade. Legacy ranges such as `Primary 1–3`, `Primary 4–6` and `Secondary 1–3` are available when **any** grade in the range is selected. Broad `Primary` / `Primary school` labels cover Primary 1–6; equivalent Secondary labels cover Secondary 1–5. Matching ignores letter case and outer whitespace and accepts hyphen/en dash/em dash ranges. Unknown, malformed or out-of-range metadata is hidden and blocked while grade filtering is enabled; it remains available in All grades mode. Range intersection preserves useful older courses without claiming they were authored exclusively for one grade.

Children's Library, My lessons and dashboard recommendations/recent/continue lists omit blocked courses before pagination/counts. Direct lesson reads, duplication, progress reads/submission and quiz checking/submission return HTTP 403 `GRADE_RESTRICTED` for blocked grades. Generation-job reads inherit the lesson access check. An already-open lesson is checked again with the existing 15-second visible-screen heartbeat and hidden when its subject or grade is no longer allowed; backend requests enforce the change immediately. Parent and administrator access is unchanged. Existing subject, subscription/trial, account pause and daily allowance checks still apply; children still cannot generate courses. Previously earned XP/Stars and learning history are retained.

Verification: workspace TypeScript and focused ESLint passed; 20 shared schema/grade and real-MySQL family tests passed. These cover default unrestricted access, range/broad matching, unknown labels, paginated filtering, dashboard filtering, direct reads and all progress/quiz/duplication paths, ownership/self-edit rejection, parent access and unrelated PATCH preservation. Browser coverage is in `scripts/e2e/child-grades.spec.ts`, using a disposable family and lessons, with cleanup after execution.

The focused production-browser test passed on `http://localhost:7777` in 23.5 seconds after the final rebuild. It exercised creating a child with All grades, saving Primary 2 + Secondary 2, checkbox persistence, child library filtering and direct URL rejection, bilingual controls at 390px without overflow, restoring All grades, and hiding an already-open Primary 5 lesson after the parent narrows access to Primary 2. The temporary family and lesson fixtures were deleted. The mobile screenshot is `frontend/artifacts/parent-grades-mobile-bilingual.png`. A regression run against the earlier build reached the last live-access assertion and failed, confirming the heartbeat check closes the identified gap.
