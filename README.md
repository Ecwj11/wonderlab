# Wonderlab

**Don’t just read it. Experience it.**

A full-stack learning portal that turns textbook material into validated, interactive lessons. The complete first slice runs without external AI: sign in → paste fractions → watch generation → select pizza slices → explore flashcards → answer a quiz → receive XP → see persisted completion. Malaysia Independence uses an interactive timeline through the same engine. Heart and solar-system diagrams demonstrate the reusable registry.

Students can switch the interface between English, 中文 and stacked English + 中文; their choice is saved per account. Administrators select or privately preview playground, space and clay templates in `/admin/settings`. Generation jobs coordinate an analyst, planner, scene/quiz specialists and a deterministic validator; `/admin/generation-jobs` shows each task's status and usage. See [languages](docs/LOCALIZATION.md), [templates](docs/TEMPLATES.md) and [generation agents](docs/MULTI_AGENT_GENERATION.md).

## Run locally

Requires Node.js 22+, npm, and MySQL 8. From the repository root:

```sh
npm ci
npm run build -w shared
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
# Set DATABASE_URL for your MySQL instance in backend/.env.
npm run db:migrate
npm run db:seed
npm run dev
```

Open [localhost:3000](http://localhost:3000). On this Mac, `./scripts/local-mysql.sh start` starts an isolated development database at port 3307 using Homebrew MySQL 8.0. Its local-only credentials match `backend/.env.example`; it does not alter another MySQL instance. `./scripts/local-mysql.sh stop` stops that instance. `.local/` and environment files are ignored by Git.

Add the [96 Primary 1–3 maths games](docs/PRIMARY_MATHS_CATALOGUE.md) with `npm run db:seed-maths -w backend` after the initial seed. This separate, repeatable import publishes 39 addition, 39 subtraction, nine multiplication and nine division adventures without resetting existing lessons or accounts.

Add **小雨的种子：3D有声故事** with `npm run db:seed-story -w backend`. This original Chinese Primary 1–3 sample combines a real 3D school garden, Mandarin narration, walking/finding tasks and comprehension questions. It appears in Library under General / Chinese. See [controls, schema, audio provenance and maintenance](docs/INTERACTIVE_STORIES.md).

Development seed accounts all use **`qwer1234!`**:

| Email               | Role    |
| ------------------- | ------- |
| student@example.com | Student |
| teacher@example.com | Teacher |
| admin@example.com   | Admin   |
| parent@example.com  | Parent  |

Family demo: `/parent/login` uses `parent@example.com / qwer1234!`; `/child/login` uses family code **WONDER01**, username **alex**, passcode **qwer1234!**. `/admin/login` uses the admin account above. Run `npx tsx backend/src/db/family-seed.ts` after migrations to add these accounts without changing existing lessons.

Demo passwords and seeding are for development only. Production refuses demo seeding. Start the existing development seed before testing a production build locally.

## What works

- Student dashboard, generation from pasted text/topic/PDF/image, durable job progress, lesson filters/actions, public library duplication, progress charts, achievements, challenges and editable profile.
- Trusted React interaction registry: fractions, timeline, diagrams, animated diagrams, quizzes, flashcards and guided stories. No generated HTML or React.
- Transactional XP, levels, per-local-day streaks, verified scene completion, first-answer quiz scoring and replay protection. Fractions with a perfect quiz earn 130 XP; the history lesson earns 120 XP.
- Separate admin portal with live metrics, account status/role management, lesson publication/metadata/JSON inspection/regeneration, job inspection, subjects, provider configuration status, usage and persisted learning settings.
- JWT authentication, rotating refresh tokens in HTTP-only browser cookies, RBAC, bounded validation, rate limits, parameterized SQL and uploads with signature/dimension checks.
- Codex session generation now opens with a playable game: NUMBER_GAME is a 2D forest platform game with movement, jumping, collectible number blocks, arithmetic bridges and treehouse exits; MATCHING offers illustrated 2D clue adventures for science, history, geography and general learning, with memory cards retained for mathematics. Both support pause, keyboard/touch interaction, local coins and replay; the server validates completion and awards XP once. Mock remains an explicit fixture/demo provider, alongside OpenAI, Anthropic and Gemini adapters.

## Family subscriptions

One parent owns one family workspace. Children have separate accounts, progress and XP, and share private family lessons and generation credits. Parents can pause learning, reset passcodes, allow subjects, permit lesson creation and set a daily lesson time allowance.

Admin pages `/admin/families`, `/admin/plans` and `/admin/subscriptions` manage MYR plans, individual family trials (0–365 days from today), dated paid activation and cancellation. Parents request a plan from `/parent/billing`; requests remain pending until an administrator activates them. This release uses **admin-managed activation** and does not collect payments or automatically charge renewals. Seed prices are editable examples, not published pricing.

See [family architecture and API](docs/FAMILY_SUBSCRIPTIONS.md). Existing standalone learner accounts retain their access.

## Architecture

```text
Browser → /api/* → Next.js server proxy → Express API → MySQL 8
                                            ↕
                                  durable generation worker
                                            ↕
                                AI / extraction / storage adapters
```

`BACKEND_INTERNAL_URL` only exists on the Next.js server. Never set a `NEXT_PUBLIC_` backend address. Tokens are removed from proxy JSON responses and stored as HTTP-only same-origin cookies. All application requests in the browser use `/api/*`.

The root is an npm workspace with `frontend/`, `backend/`, `shared/` and `docs/`. See [architecture](docs/ARCHITECTURE.md), [database](docs/DATABASE.md), [lesson contract](docs/LESSON_SCHEMA.md), [API](docs/API.md) and [content sources](docs/CONTENT_SOURCES.md).

## Verification

```sh
npm run check       # TypeScript, ESLint, unit and actual-MySQL integration tests
npm run build       # Shared package, backend and production Next.js build
npm run test:e2e    # Playwright against the running app at localhost:3000
npm audit
```

Integration tests use a separate database whose name must end in `_test`. Default: `wonderlab_test` on the isolated local MySQL. Override with `TEST_DATABASE_URL`. Tests clear its generation jobs and non-demo student lessons, seed accounts and create additional test records; never point them at real data. Browser tests use the development seed and create real lessons. Set `E2E_BASE_URL` to change the running app URL. Chromium must be installed (`npx playwright install chromium`).

To run a production build locally after building, use `npm start -w backend` and `npm start -w frontend` in separate terminals. Set `NODE_ENV=production`, a random 32+ character `JWT_SECRET`, `DATABASE_URL` and `BACKEND_INTERNAL_URL` and the browser-facing `APP_ORIGIN`; production cookies require HTTPS (localhost browsers support secure cookies for local testing).

## Docker

```sh
cp .env.example .env
# Set random database passwords and JWT_SECRET; use URL-safe database passwords.
docker compose up --build -d
# Optional Redis infrastructure:
docker compose --profile redis up -d
```

Compose starts MySQL, a one-time migration service, the internal backend and Next.js on port 3000. It deliberately does not seed demonstration accounts. Configure HTTPS at the ingress and set `APP_ORIGIN` to the exact public origin (for example `https://learn.your-school.example`) before deployment. This keeps browser-origin validation independent of internal container addresses. Data and uploaded files use named volumes. Redis is prepared as optional infrastructure; the implemented queue and persistence remain MySQL-backed.

For a separate worker, set `JOB_WORKER_ENABLED=false` on the API and run `npm run worker -w backend` from the built repository, or `node dist/worker.js` in the backend image. Claims use `SKIP LOCKED`; five-minute leases recover interrupted work up to three attempts. Attempt fencing prevents a resumed old worker from overwriting a replacement. Lesson regeneration preserves the lesson ID, stores another version and clears old progress while preserving the XP ledger.

## Parent-created family lessons

Parents create courses at `/parent/create` and manage the shared collection at `/parent/lessons`. Children find them in My lessons. Child creation controls are temporarily hidden and generation/upload/regeneration APIs reject child accounts, including accounts with old generation permission. See [family access and controls](docs/FAMILY_SUBSCRIPTIONS.md).

## Family prizes and Stars

Parents manage real-world prizes at `/parent/rewards`: set a star cost, offer a prize to all children or one child, and configure Stars earned for completed lessons, correct quiz answers and perfect quizzes. Children use `/app/rewards` to view their balance, request prizes and track requests. Stars are separate from XP and levels. Requests reserve Stars; cancellation or a parent's decline returns them once. Mark given records delivery. See [reward rules, storage and API](docs/REWARDS.md).

## AI and uploads

Set `AI_PROVIDER=mock|codex|openai|anthropic|gemini`. External providers use the relevant backend-only key; missing credentials reject generation before creating a job or resetting progress. `codex` delegates scoped requests to explicitly running local Codex session subagents, without external API keys or MockAIProvider. It requires an active session consumer and does not launch Codex automatically; see [session job operation](docs/CODEX_SESSION_JOBS.md). `AI_MODEL` overrides external adapter defaults. Restart the backend after changes. Configure `AI_INPUT_COST_PER_MILLION` and `AI_OUTPUT_COST_PER_MILLION` for external provider cost estimates; their default zero means pricing is unconfigured, not that real calls are free. Codex session usage is unavailable and displayed as **Not reported**. Provider adapters validate generated JSON before saving. Real-key calls require separate provider smoke tests.

Uploads support text-based PDF up to 30 pages, PNG/JPEG up to 16 megapixels, 10 MB per file and 40,000 extracted characters. Image OCR runs in an isolated process with a 60-second hard timeout and a two-extraction concurrency limit. Tesseract downloads language data on first use, so initial OCR needs network access or a populated OCR cache. Scanned PDFs should be supplied as page images. Local storage is private; the interface allows an S3/OSS implementation later. Uploaded originals are retained; configure retention and backup policies before hosting student data.

## Operational scope

This is the fully implemented first product slice and supporting portals, with production builds and deployment scaffolding. A live deployment still needs HTTPS, backups, monitoring, secret rotation, shared/distributed rate-limit storage for multiple API replicas, upload retention, school-specific privacy/consent policy and review of generated educational content. The default API rate limits are per authenticated user; sign-in limits are per account. The backend is internal and does not blindly trust incoming forwarded IP headers.

Teacher classrooms, assignments, online checkout and automatic recurring payments, school tenancy, narration, external image generation, multiplayer and leaderboards are future extensions. Admin password reset and a content moderation workflow are also not implemented. No placeholder navigation pages are used for these extensions.

## First production administrator

After migrations, provision the first super administrator from a trusted operator terminal. The command accepts a new email and a password of at least 14 characters. It hashes the password and refuses to run once any super administrator exists.

```sh
export BOOTSTRAP_ADMIN_EMAIL=operator@your-school.example
export BOOTSTRAP_ADMIN_NAME='School administrator'
read -r -s -p 'New admin password: ' BOOTSTRAP_ADMIN_PASSWORD
export BOOTSTRAP_ADMIN_PASSWORD
# Docker (secret passes through environment, not command arguments):
docker compose exec -e BOOTSTRAP_ADMIN_EMAIL -e BOOTSTRAP_ADMIN_NAME -e BOOTSTRAP_ADMIN_PASSWORD backend node dist/db/bootstrap-admin.js
# Or from the built backend workspace:
# node backend/dist/db/bootstrap-admin.js
unset BOOTSTRAP_ADMIN_PASSWORD
```

The hidden-password `read` example uses Bash. Sign in with the newly created account and manage subsequent roles through the admin portal. This procedure does not create or enable development demo accounts.

The curated mock fractions lesson supports English, Bahasa Melayu and Chinese; the history demo supports English and Bahasa Melayu, and the heart demo currently uses English. Generic mock lessons preserve the supplied source language rather than translating it. Connected providers receive the requested language and school level.

The 2D forest uses bundled original artwork and the existing validated lesson rounds. See [game design and controls](docs/2D_NUMBER_FOREST.md) and [asset provenance](docs/FOREST_ASSETS.md).
