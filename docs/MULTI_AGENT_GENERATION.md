# Multi-agent lesson generation

Generation runs in the durable MySQL worker, independently of the HTTP request. `POST /lessons/generate` still returns `202` with a job ID; clients poll the existing authenticated `GET /generation-jobs/:id`. The main application can handle other requests while provider tasks await their results. External provider adapters use independent scoped AI conversations. With `AI_PROVIDER=codex`, explicitly running subagents in the current local Codex session consume durable requests and author the same educational JSON through a trusted local bridge. See [session execution](CODEX_SESSION_JOBS.md) for its lifetime and operating limits.

Codex plans must begin with a playable NUMBER_GAME or MATCHING scene and contain at most six scenes. A single game is a complete valid plan; quizzes are optional. Scene specialists refine missions or semantic pairs while preserving scene identity. The renderer supplies trusted control instructions rather than relying on generated prose to invent controls. Existing reading/diagram/timeline lessons remain compatible; mock fixtures are not subject to the new Codex game-first guard.

## Roles and shared content

1. **Learning analyst** identifies the topic family, objectives and concepts.
2. **Lesson planner** makes one complete, schema-validated initial draft, with at most six scenes. This draft is the shared plan, not the published lesson.
3. **Scene specialists** receive one scene, its assigned identity/type, the learning objectives, key concepts and sibling scene titles/types. Each calls `regenerateScene` in a separate provider instance with a scoped content-specialist prompt. They do not generate repeated whole lessons.
4. **Quiz specialists** receive planned quiz scenes with a distinct assessment prompt and the same shared context. Quiz answers remain server-side.
5. **Lesson validator** runs locally, validates all scene identities and the assembled versioned lesson schema, and permits atomic publication only after every task succeeds. Its provider is `local`, model `lesson-schema-v1`, and usage is zero.

Scene and quiz tasks execute in batches of at most **two simultaneous provider calls per job**. Failed batches await all settled results, dispatch no subsequent batches, and cancel pending tasks. There is no partial lesson publication. Analyst and planner calls are sequential. Current mock lessons remain playable for fractions, Malaysia independence and the heart; generic content uses story/flashcard scenes without inventing automatically graded factual questions. Mock specialists process their own scene drafts, and incur no external usage.

## API and persistence

Migration `005_generation_agents.sql` adds relational `generation_agent_tasks`, indexed by job, attempt and status. Task rows store the role, friendly name, assigned scene ID, status/progress/step, provider/model, input/output token counts, estimated cost, safe error and timestamps. They do not store provider keys, raw source or output in the polling DTO.

Job detail adds `attempt` and `agents`. Each agent exposes:

```ts
{
  id: string;
  attempt: number;
  role: 'ANALYST' | 'PLANNER' | 'SCENE_SPECIALIST' | 'QUIZ_SPECIALIST' | 'VALIDATOR';
  name: string;
  sceneId: string | null;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number;
  step: string;
  provider: string;
  model: string | null;
  tokensInput: number;
  tokensOutput: number;
  estimatedCost: number;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}
```

Only current-attempt task rows are returned, ordered by their place in the shared plan. Historical attempts remain in MySQL for diagnosis. Existing jobs created before this feature return an empty `agents` array. Owners and admins can read their authorized jobs; no source text or quiz answers are included. A pending job has attempt `0` and no agents until a worker claims it.

## Lease, recovery and cost

The worker refreshes its job heartbeat every 15 seconds throughout long provider requests, in addition to phase updates. Every task insertion/update is fenced by the job's claimed attempt and `PROCESSING` status. Atomic publication locks the job and verifies the same attempt before saving the lesson. A late result from a replaced worker cannot change the new attempt or publish a lesson.

When the existing five-minute stale lease recovery claims an interrupted job, it cancels active tasks in the abandoned attempt and creates new task rows under the next attempt. At most three attempts are allowed. Completed task rows from prior attempts are preserved.

If the third attempt expires, recovery atomically marks the job failed, sets its completion time, sums all known task usage, and inserts one guarded usage record under the job lock. Concurrent recovery workers cannot duplicate that terminal record.

HTTP adapters expose usage snapshots. Analyst/planner costs use deltas on their shared coordinator instance; each specialist uses its own independent instance. The validator consumes no provider tokens. Terminal job and `ai_usage` totals sum persisted task usage across all attempts once, including known usage on failed attempts. Provider pricing remains environment-configured and estimates are stored at six decimal places. Billing for a request that was sent but whose response was lost during a process crash cannot be recovered from the local database; external provider usage is authoritative in that case.

Gemini billable output includes both candidate tokens and `thoughtsTokenCount`, following [Google's token accounting documentation](https://ai.google.dev/gemini-api/docs/generate-content/thinking#pricing). No thinking text is saved or exposed by the job API.

## Verification and limitations

MySQL integration tests cover task visibility/privacy, two-task concurrency, all-settled failure, atomic publication, identity validation, stale attempt fences, heartbeat during blocked provider calls, and usage counted once. Adapter-shaped tests cover distinct role prompts and aggregated usage for OpenAI, Anthropic and Gemini. Real external provider credentials are not configured in the local development environment, so live provider responses remain unverified. The orchestration supports one environment-selected provider for all AI roles today; the task boundaries permit future per-role model routing without exposing executable code or coupling generation to frontend components.
