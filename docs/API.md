# REST API

Narrated stories add `POST /lessons/:id/story/check` (`{lessonVersion, sceneId, stepId, choiceId}` → `{stepId, choiceId, correct, feedback}`) and `GET /lessons/:id/story/state?sceneId=…&lessonVersion=…` (ordered `{answers: [{stepId, choiceId}]}`). Earlier successful steps, current version and all normal access controls are enforced. Complete through `/lessons/:id/progress` with `result.storyAnswers`; every correct answer must match a saved receipt. Browser calls use `/api/*`. See [interactive stories](INTERACTIVE_STORIES.md).

Browser routes use /api followed by these backend paths. JSON errors: {error:{code,message,requestId}}. Lists: {data,page,pageSize,total,totalPages}; pageSize is bounded 1–100. Dates use ISO 8601 UTC. Authentication is required except auth login/register/refresh and health. Ownership or public visibility is checked for reads; writes require ownership. Admin endpoints require ADMIN or SUPER_ADMIN.

| Method | Path                          | Behavior                                                                                |
| ------ | ----------------------------- | --------------------------------------------------------------------------------------- |
| POST   | /auth/register                | name/email/password, student role only                                                  |
| POST   | /auth/login                   | access/refresh tokens, user                                                             |
| POST   | /auth/refresh                 | rotate hashed refresh token                                                             |
| POST   | /auth/logout                  | revoke refresh token                                                                    |
| GET    | /auth/me                      | current profile                                                                         |
| PATCH  | /auth/me                      | update name and timezone                                                                |
| GET    | /dashboard                    | profile, stats, activity and recommendations                                            |
| POST   | /uploads                      | multipart file, validated/extracted upload ID                                           |
| POST   | /lessons/generate             | title, subject, schoolLevel, language, content, inputType, uploadId; 202 lessonId/jobId |
| GET    | /lessons                      | own lessons with subject/status/search filters                                          |
| GET    | /lessons/:id                  | metadata and safe lesson definition                                                     |
| PATCH  | /lessons/:id                  | title/visibility metadata                                                               |
| DELETE | /lessons/:id                  | delete own lesson                                                                       |
| POST   | /lessons/:id/duplicate        | copy public/owned lesson privately                                                      |
| GET    | /lessons/:id/progress         | own progress and completed scenes                                                       |
| POST   | /lessons/:id/progress         | scene ID and validated interaction result                                               |
| POST   | /lessons/:id/quiz/submit      | server scoring, persisted answers, one reward per quiz                                  |
| GET    | /generation-jobs/:id          | job status/progress/step/error                                                          |
| GET    | /library                      | public lessons, subject/language/search filters                                         |
| GET    | /progress                     | XP, scores, time, streak and subject breakdown                                          |
| GET    | /achievements                 | earned and available badges                                                             |
| GET    | /admin/dashboard              | aggregate real counts                                                                   |
| GET    | /admin/users                  | paginated accounts                                                                      |
| GET    | /admin/users/:id              | account and roles                                                                       |
| PATCH  | /admin/users/:id              | status and role; only super admin promotes admins                                       |
| GET    | /admin/lessons                | paginated all lessons                                                                   |
| GET    | /admin/lessons/:id/json       | private validated definition                                                            |
| PATCH  | /admin/lessons/:id            | metadata/publication                                                                    |
| DELETE | /admin/lessons/:id            | deletion                                                                                |
| POST   | /admin/lessons/:id/regenerate | new generation job                                                                      |
| GET    | /admin/generation-jobs        | paginated jobs                                                                          |
| GET    | /admin/config                 | active provider/model without keys                                                      |

The proxy forwards content-type/body/query/auth and disables caching. Login and refresh set HTTP-only, SameSite=Lax cookies; the browser never sees token secrets. Set BACKEND_INTERNAL_URL in frontend/.env.local; never use NEXT_PUBLIC_ for backend configuration. Non-auth backend errors preserve status and safe JSON; unreachable/timeouts return a consistent 502/504.

Additional endpoints: `POST /lessons/:id/regenerate` creates a job for the existing lesson and stores the next definition version. `POST /lessons/:id/quiz/check` persists `{lessonVersion,sceneId,questionId,optionId}` before returning immediate feedback and the persisted `optionId`. `GET /subjects`, `GET /admin/subjects`, `GET /admin/usage`, `GET /admin/settings`, and `PATCH /admin/settings` support the live portal. Settings accept `{dailyGoalMinutes,maxDailyGenerations}` within bounded ranges.

Student presentation: `GET /appearance` reads `{template}`; `GET /admin/appearance` and `PATCH /admin/appearance` let administrators read/save the site default (`playground`, `space` or `clay`). Authenticated `GET /preferences` and `PATCH /preferences` read/save the current account's `{uiLanguage}` (`en`, `zh` or `en-zh`). Neither endpoint accepts arbitrary CSS, markup or an account ID.

Job detail includes `attempt` and the current attempt's `agents`: role, name, assigned scene ID, status, progress, step, provider/model, input/output token counts, estimated cost, safe error and timestamps. Analysis and planning precede bounded parallel scene/quiz tasks, followed by local validation and atomic publication. Existing ownership/admin rules apply. Historical jobs return an empty agent array. See `MULTI_AGENT_GENERATION.md` for the complete contract and recovery rules.

`GET /lessons/:id` returns `lessonVersion` separately from schema version. Progress and quiz requests should include it; omitted values mean definition version 1 for compatibility. Regenerating or obsolete versions return 409. A progress request is `{lessonVersion,sceneId,result,elapsedSeconds}`; quiz submit uses `{lessonVersion,sceneId,answers:[{questionId,optionId}],elapsedSeconds}`. Seconds are bounded 0–600 per scene. Quiz submit always scores stored first choices, preserves the first attempt, and returns `xpEarned:0` on replay. Backend login/refresh JSON contains tokens for REST clients; the browser proxy returns only `{user}` and sets HTTP-only cookies.

Game progress results use `roundAnswers: [{roundId,value}]` for NUMBER_GAME and `matchedIds: [pairId]` for MATCHING. Every configured mission or pair is required; duplicate, missing or incorrect results cannot complete a game. Game coins are local practice feedback and never accepted as XP. Student `GET /lessons?status=READY` returns only ready, unstarted lessons; IN_PROGRESS and COMPLETED match saved learning progress. Admin READY continues to mean generation/publication readiness. The My Lessons UI polls while visible lessons are preparing and shows text statuses without decorative cover thumbnails.

## Families and subscriptions

See the complete [family endpoint contract](FAMILY_SUBSCRIPTIONS.md#api-contract). New portal credential endpoints `/auth/admin/login`, `/auth/parent/login`, `/auth/parent/register` and `/auth/child/login` use the same token envelope internally; the Next proxy returns only `{user}` and sets HTTP-only cookies. `/parent/*` checks family ownership, and `/admin/families`, `/admin/plans`, `/admin/subscriptions` require admin RBAC. Children cannot publish lessons or access billing. Public library and shared family lessons remain subject to allowed subjects, active access and daily allowance. Subscription requests do not activate entitlements.
