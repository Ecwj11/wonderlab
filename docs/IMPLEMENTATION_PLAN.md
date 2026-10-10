# Wonderlab delivery plan

Goal: a polished, persistent learning platform with a verified fractions vertical slice, followed by Malaysia Independence.
Architecture: Next.js BFF, Express API, MySQL, shared validated JSON contract. Execute natively in the current session as requested; make technical decisions without repeated confirmation.

## Checkpoints

- [x] Foundation: workspace config, executable schema, MySQL migrations and seeds, authentication/refresh/RBAC, same-origin proxy. Check typecheck/lint/tests.
- [x] Vertical slice: dashboard, create form, durable job worker, fraction interaction, private quiz key, transactional XP/completion. Test unknown scenes, malformed input, ownership, refresh reuse, jobs and reward replay; check typecheck/lint/tests.
- [x] Expansion: Malaysia timeline, human-heart diagram, lesson library/filtering/duplication, progress and achievements. Check typecheck/lint/tests.
- [x] Administration and delivery: real metrics and users/lesson/job inspection, AI adapters, storage/extraction, Compose, operational README and browser end-to-end verification. Check typecheck/lint/tests and production build.

## Critical verification

Reject invalid generated definitions and mismatched answer IDs. Reject reading another student's private lessons/jobs. Never award client-selected XP. Replaying submissions must not increase XP. Restart the worker during a pending job and verify recovery. Uploads with disguised extensions must fail. Verify the browser only contacts /api for application data.

Checkpoint 1/2: npm run typecheck, npm run lint and npm test pass. 18 schema/MySQL integration checks. Browser sign-in and dashboard confirmed.

Final checkpoint: TypeScript and ESLint pass; 53 unit/integration/proxy checks pass against MySQL 8; the optimized Next.js/backend build passes. Seven Playwright checks pass against the standalone production server: fractions with XP persistence, Malaysia timeline, session renewal, admin/RBAC, mobile/tablet navigation, PDF extraction and image OCR. Dependency audit reports zero vulnerabilities. Compose configuration validates; Docker container execution and real-key AI calls remain unverified. See VERIFICATION.md for evidence and scope.
