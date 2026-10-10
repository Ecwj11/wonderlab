# Wonderlab architecture

Don't just read it. Experience it.

## Scope and sequence

The first deliverable is a complete login → dashboard → paste fractions → durable generation job → interactive pizza → quiz → XP → completion flow. Then Malaysia Independence and Human Heart use the same validated engine. Supporting lesson management, library, progress and administration use real stored data. Advanced classrooms, automatic voice generation and multiplayer are future extensions, not empty pages.

## Structure

```
frontend/   Next.js App Router, same-origin API proxy, student/admin UI, interaction registry
backend/    Express REST API, authentication, MySQL repository, durable job worker, AI/storage adapters
shared/     Version 1 Zod schemas, inferred TypeScript definitions, safe presentation metadata
docs/       Architecture, database, lesson schema, API, delivery plan
scripts/    Local infrastructure and end-to-end verification
```

## Boundaries

Browser → /api/* → Next.js route handler → BACKEND_INTERNAL_URL → Express → MySQL 8.
The backend URL is server-only. The proxy preserves methods, query parameters, content type and authorization; it translates tokens to HTTP-only same-origin cookies and refreshes access tokens. Mutations require a same-origin Origin header when using browser cookies. The backend also accepts bearer tokens for REST clients. Access JWTs last 15 minutes; hashed rotating refresh tokens last seven days. Sessions are checked against current account status and roles on each request.

## Lessons

An authored Chinese story now uses `INTERACTIVE_STORY`: bundled Three.js 3D school garden, actual Mandarin MP3 narration, walking/finding and comprehension tasks. Content remains safe JSON; world geometry and interaction are trusted components. Ordered server receipts support resume and completion, and narration ducks music without changing its selected volume. See [3D narrated stories](INTERACTIVE_STORIES.md).

AI produces content, never HTML or React. Shared strict discriminated Zod schemas cap strings, collection lengths and numeric ranges. The API validates before persisting; the frontend validates before rendering. A registry selects a trusted component for each supported interaction. Quiz answers remain server-side until the corresponding first choice is persisted and checked. The server calculates scores and completion; client-supplied XP is never accepted. Completion and XP are committed transactionally and keyed to prevent replay rewards.

Generation now targets playable games: Codex plans start with NUMBER_GAME (2D forest platform missions: move, jump, collect operand blocks, solve arithmetic to build a bridge and physically reach an exit) or MATCHING (semantic 2D adventures for science, history, geography and general learning; memory cards for mathematics). A mission has an action, win condition, feedback and replay. Text, timelines, diagrams and optional quizzes support the game. The server verifies all mission answers or matched pair identities before recording completion. Local game coins never replace the XP ledger. Existing lesson versions retain their validated JSON and scene identities; the registry renders NUMBER_GAME with the new trusted forest engine, preserving recorded progress. Level geometry and physics remain application code rather than AI output. See [2D Number Forest](2D_NUMBER_FOREST.md) and [2D subject adventures](2D_SUBJECT_ADVENTURES.md).

## Jobs

POST /lessons/generate returns 202 immediately. A MySQL-backed worker claims pending jobs with row locks and SKIP LOCKED. After extraction, an analyst and planner produce a bounded lesson plan. Independent content and quiz specialists work on scoped scenes, with at most two specialists running in parallel. A deterministic validator checks the assembled definition before atomic publication. Relational agent task records track status, usage and attempt ownership; administrators inspect them in job details. Progress is polled. Stale jobs are retried after restart, with a bounded retry count and attempt fencing. Jobs are independent of request lifetimes; local API startup runs a worker. JOB_WORKER_ENABLED=false allows separate worker processes. Redis can replace the queue through its interface without changing lesson generation. See [multi-agent generation](MULTI_AGENT_GENERATION.md).

## Providers and uploads

CodexSessionProvider uses the current Codex session's subagents through the validated local request bridge; it requires active session consumers and no external API key. The current development runtime uses this provider. MockAIProvider remains an explicit fixture/demo provider for offline tests and seeds. OpenAI, Anthropic and Gemini adapters share the same AIProvider contract. Keys and provider selection are backend-only. Uploads use magic-byte and extension checks, 10 MiB limits and random storage names. PDFs are extracted locally; image OCR uses a local OCR adapter. LocalStorageProvider can be replaced with object storage through StorageProvider.

## Visual design

Administrators choose one of three student templates: a bright learning playground, space adventure or warm clay discovery. A trusted registry provides bundled transparent mascot artwork, copy and scoped palettes; templates preserve lesson content and progress. Authorized preview URLs affect only the viewing administrator. Nunito is bundled locally for rounded headings and larger body type. Colored subject tiles and real learning statistics accompany the artwork. Lesson cards and primary controls use rounded borders and tactile shadows. Student styles are scoped to `.app-shell` and `.login-page`; admin retains Plus Jakarta Sans and its professional layout. The sidebar becomes a drawer at 760px, cards stack on mobile and reduced-motion preferences disable decorative movement. No external image or font service is required at runtime. See [templates](TEMPLATES.md).

Students independently choose English, Simplified Chinese or both languages through an authenticated per-account preference. Explicit React localization components render curated interface translations; bilingual labels stack English above Chinese. Generated lesson content keeps its selected lesson language. Switching interface language or template never regenerates educational content or resets progress. See [interface languages](LOCALIZATION.md).

My Lessons uses prominent text status headers (Preparing, Ready to play, In progress, Completed, Could not prepare), with distinct colors and clear actions. Identical decorative cover images have been removed. Cards use actual lesson metadata and progress; covers should only be introduced with a genuine generated game image, not an inferred subject icon. Visible preparing lessons refresh automatically. The student READY filter means ready and unstarted; admin READY retains the publishing status meaning.

## Operations

Docker Compose runs Next.js, Express, MySQL 8 and optional Redis. Migration/seed commands are explicit and idempotent; no production demo seeding. Health endpoints do not leak credentials. Production requires strong JWT secrets, HTTPS cookies and database credentials. Structured errors contain a request ID. Unit/integration tests cover invalid JSON, ownership, refresh rotation, durable jobs, server scoring and duplicate reward protection; browser checks cover the complete vertical slice.

## Current design limits

The first release targets a single region with MySQL as the source of truth. AI provider responses require review for educational accuracy; schemas guarantee structure, not truth. Cost reports reflect provider usage when available. Billing, school tenancy, moderation workflows and external asset generation are deliberately outside this slice.

## Concurrency and session hardening

Access expiry also renews `GET /auth/me`; simultaneous renewals in one Next.js process share a short in-flight refresh result. Multiple Next.js replicas need a shared refresh coordinator (or sticky routing) to avoid racing token rotation. This deployment targets one Next.js instance initially.

Authenticated API limits use cryptographically verified JWT subjects, so every student behind the server proxy gets a separate budget. Login/register limits use normalized account hashes; anonymous requests share an IP budget. The backend does not blindly trust forwarded addresses. Multiple API replicas should replace the in-memory limiter with a Redis-backed store.

A lesson records its current generation job. Each claimed worker increments an attempt fence; heartbeats, completion and failure only apply while that attempt owns the lease. Progress/check/submit transactions lock the user and lesson, require READY status and the current definition version. Regeneration clears progress and quiz choices under those locks. Checked quiz choices are persisted before revealing correctness; reloads cannot change the graded first response.

OCR uses a disposable child process, including initialization and language download, so the 60-second timeout kills all work. PNG and JPEG dimensions are bounded before decoding. Storage and extraction are separate interfaces; queue, provider, storage and content contracts prepare later Redis, S3/OSS and DOCX adapters without implementing unused infrastructure.

`APP_ORIGIN` is the configured browser-facing origin. The proxy checks it for cookie mutations even when the standalone server listens on an internal container address. Set it to the public HTTPS domain at the ingress.

## Family workspace and billing

Families are an account ownership boundary within the shared platform: a unique parent owns one family, child accounts have individual learning state, and private lessons and generation credits are shared. `family.ts` centralizes entitlement, trial expiry, plan snapshots, subject restrictions and server-timed parental allowance checks. Paid access requires admin activation; choosing a plan creates a pending request. No checkout provider or automatic billing runs in this release. Distinct `/admin/login`, `/parent/login` and `/child/login` routes all pass through the server-only Next API proxy. See [family design](FAMILY_SUBSCRIPTIONS.md).
