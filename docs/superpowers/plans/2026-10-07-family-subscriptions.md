# Family accounts implementation plan

**Goal:** One family workspace per parent, distinct logins, backend-enforced child controls, editable plans, subscription activation and per-parent trials.

**Architecture:** Extend existing MySQL/JWT/REST modules. Family membership scopes content; individual user IDs scope learning progress. The Next server proxy handles every new auth token envelope in HTTP-only cookies. Initial paid activation is admin-managed.

**Spec:** `docs/FAMILY_SUBSCRIPTIONS.md`.

## Work boundaries

- Coordinator: shared contracts, proxy auth routes, role-specific login component/pages, session redirects, learning access guard, integration, browser tests and documentation.
- Backend: migration 008, family/plan/subscription services and routes, auth extensions, transactional quotas and private lesson access, server heartbeat enforcement, seed accounts, isolated integration tests.
- Parent/admin UI: parent shell/dashboard/children/billing components; admin family/plan/subscription components. Consume shared contracts; no auth/proxy/backend edits.

## Tasks

1. Define the response/input interfaces in shared/family.ts and optional account metadata on User; build shared package. Ownership: coordinator.
2. Write failing backend integration tests against real isolated MySQL for portal login, family ownership, controls, entitlement, admin override and paid activation. Implement migration/services/router and integrate existing auth/lesson/job services. Run the focused suite and typecheck. Ownership: backend.
3. Build parent/admin forms and tables using real API endpoints with loading, validation, success/error and empty states. Read frontend/AGENTS.md and bundled Next docs. Parent children edits apply individually; passcode reset is a separate explicit form. Ownership: UI.
4. Extend Next proxy's auth-route allowlist; use dedicated admin/parent/child login pages while retaining legacy login. Ensure admin/parent login pages render outside protected shell. Scope SessionProvider redirects and learner access guard. Ownership: coordinator.
5. Review permissions, trial boundaries, quota races, cancellation and refresh invalidation. Fix concrete findings; run workspace TypeScript/lint/tests and production builds. Apply additive migration, seed only family demos (do not replace or mock existing lessons), restart runtime.
6. Play browser flow with disposable parent/child accounts; verify admin trial setting, subscription request/activation, child learning access and parent pause. Verify existing maths/student/admin workflows. Update docs and show finished parent portal.

No provider switch, live charge, database reset, arbitrary generated code or automatic paid access from a plan selection. No commits requested. Existing sample lessons and standalone accounts remain available.
