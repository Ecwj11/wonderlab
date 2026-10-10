# Database

MySQL 8, utf8mb4, InnoDB, UTC timestamps. UUID IDs avoid leaking sequential account IDs. Parameterized mysql2 queries and relational columns support filtering/reporting. JSON is reserved for versioned lesson definitions and small activity payloads.

Core: users, roles, user_roles, refresh_tokens, subjects; lessons reference owners/subjects, expose visibility and lifecycle status; lesson_versions store validated JSON; lesson_scenes index the version's scenes; generation_jobs record input, provider, tokens, cost, status, progress, steps, attempts and timestamps. Quiz answer keys only occur in private lesson_versions.

Learning: lesson_progress and scene_progress have unique user/lesson and user/scene keys; quiz_attempts/quiz_answers preserve first submitted responses; user_xp_transactions have unique user/reward_key keys; achievements/user_achievements and learning_streaks hold earned milestones.

Family prizes: migration `009_family_rewards.sql` adds `family_reward_settings`, `family_rewards`, `child_star_wallets`, `reward_redemptions` and `child_star_transactions`. Stars are separate from XP, with atomic balances, unique earning/request/refund keys, immutable request snapshots and one pending request per child/prize. See [reward storage and rules](REWARDS.md).

Assets/operations: uploaded_files, lesson_assets, ai_usage and system_settings. Foreign keys use appropriate cascades, while job/usage references can become null when their parent is removed. Search indexes cover lesson owner/status, public subject/language, jobs status/created time, refresh expiry and progress user/update time.

Apply backend/migrations/001_initial.sql using npm run db:migrate. Migrations are recorded in schema_migrations. Seed with npm run db:seed only in development. Seed writes three users, five subjects and demo definitions. Seeds never overwrite an existing password or earned progress. DATABASE_URL is backend-only.

XP awards and completion run in one transaction with the user's row locked. A completed quiz returns its original result on replay; best score remains reportable and award keys prevent farming. Streak dates use each user's configured IANA timezone (default Asia/Kuala_Lumpur); one activity per local calendar day increments the streak.

## Additional migrations

`012_story_choices.sql` adds successful narrated-story task receipts. A unique user/lesson/version/scene/step index preserves resume and prevents duplicates; binary scene/step/choice collation matches schema IDs. Foreign keys cascade with users and lesson versions. Progress requires every correct saved receipt before awarding existing idempotent XP/Stars. See [interactive stories](INTERACTIVE_STORIES.md).

`002_daily_learning.sql` adds scene duration and production-safe reference data (roles, subjects, achievements). `003_quiz_choices.sql` persists each first choice with a unique user/lesson/definition-version/scene/question key. `004_current_generation.sql` links a lesson to its active job; historical failures cannot fail a newer regeneration. Run all ordered migrations through `npm run db:migrate` rather than applying only the initial file.

Definition version (1, 2, … for a regenerated lesson) is independent of `lessonSchemaVersion: 1` (the renderer contract). Progress requires the active definition version. The migrations rely on one deployment migration runner because MySQL DDL commits independently; do not launch concurrent migration processes.

`005_generation_agents.sql` adds relational, attempt-scoped task records for analysis, planning, scene generation, quiz generation and validation. Tasks retain their status, usage and timestamps, with indexes for job/attempt/status. `006_ui_language.sql` adds `users.ui_language` (`en`, `zh`, `en-zh`) for each account's student interface preference. Site-wide student templates are stored separately as a validated ID in `system_settings` under `appearance`; the default is `playground` when no setting exists.

`007_codex_bridge.sql` adds `codex_bridge_requests`, linked to generation jobs, attempts and agent tasks. Relational status/lease/claim ownership columns support exclusive session-agent consumption; JSON payload/schema/result columns carry only scoped provider operations. Claim tokens and original material stay in the local trusted operator bridge and are not exposed by browser polling routes. See [Codex session jobs](CODEX_SESSION_JOBS.md).

## Family subscriptions

`008_families.sql` adds `subscription_plans`, `families`, `family_children`, `family_subscriptions` and `child_daily_usage`, plus indexed `generation_jobs.family_id`. Unique `families.parent_id` enforces one workspace per parent; unique family/username identifies child login. Existing users and lessons remain intact. Plans store integer MYR cents and relational child/credit/trial limits. Activated subscriptions snapshot plan name, price and limits. Trial limits are snapshotted on family creation. Subscription and trial expiry are checked on each protected request.

Family locks serialize child creation, subscription activation and generation reservations. Individual progress/XP tables continue to use child user IDs. Daily lesson allowance uses server-timed, serialized heartbeat accounting and a local date; child users cannot edit their accounting timezone. Passcodes use bcrypt; resetting a passcode revokes refresh sessions and invalidates existing access credentials.
