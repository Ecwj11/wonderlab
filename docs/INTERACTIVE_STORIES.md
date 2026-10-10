# 3D narrated Chinese stories

The first sample, **小雨的种子：3D有声故事**, is an original Chinese reading activity for Primary 1–3. It is public in the library, under General / Chinese, with stable ID `81000000-0000-4000-8000-000000000001`. It does not reproduce a school textbook or claim curriculum coverage.

## Play

Children explicitly start narration, or choose to read themselves. Eight steps alternate Chinese reading with walking to a person or location, finding objects, vocabulary and comprehension. Narration includes the task prompt. The actual media `ended` event unlocks the task; the child can also choose “读好了，开始互动”. A server-confirmed arrival or correct answer shows success feedback for 900 ms, then automatically opens and narrates the next paragraph. Explicit self-reading mode advances the text without playing audio; skipping one paragraph does not disable narration for subsequent paragraphs. Wrong choices receive feedback and can be retried without advancing.

“暂停自动继续” stops the success countdown; “故事继续” provides an immediate next-page action or resumes after a pause. Pause, lost focus, hidden tabs, replay/reset and unmount cancel pending advancement. A correct response arriving after pause stays on the completed task until explicitly continued. Replaying the current narration delays advancement until its real media end. The final task stops at the ending, with the normal completion button saving progress and awarding XP.

Three.js WebGL renders a school garden with a fixed orthographic camera, low-poly scenery and a walking character. Click a sign or object to walk to it; the task is submitted only on arrival. Arrow keys / WASD and mobile direction buttons move the character; E / Space interacts with a nearby target. The camera stays fixed while walking. Resize preserves the scene; hiding the page or leaving focus pauses narration and stops movement. A WebGL fallback exposes equivalent target buttons when rendering is unavailable.

The Chinese text remains below the game. Voice volume and speed are adjustable. Narration ducks existing background music to 20% of its chosen volume, then restores it without changing that preference. Sound effects have separate controls. Initial load and refresh never autoplay. Reset, Restart and Practice again explicitly replay from the first page while keeping reward protection.

A large written task bar sits above the 3D scene. It always shows the current prompt, then changes from listening to “现在轮到你”. Wrong-answer hints, the next-story button, pause/resume instructions and question choices appear there, so a child can see what to do while looking at the world. Choices stay disabled until the interaction is unlocked; no private answer key is exposed.

## Content and server authority

`INTERACTIVE_STORY` is an additive scene type in schema version 1. `world: "SCHOOL_GARDEN"` selects trusted bundled geometry. Each step has `id`, `title`, `text`, `narrationSrc` and a task (`MEET`, `MOVE`, `FIND`, `QUESTION`). Choices have `id`, `label`, and optional known world `target`; world tasks require unique targets, while questions omit targets. Private `correctChoiceId`, `successText` and `retryText` are removed from public definitions. The shared Zod contract validates before saving and rendering. Only bounded plain text and same-origin MP3 paths are accepted; generated HTML, models and executable code are never rendered.

- `POST /lessons/:id/story/check` accepts `{lessonVersion, sceneId, stepId, choiceId}`. It checks version, all normal account/family/grade access and earlier successful steps. Response: `{stepId, choiceId, correct, feedback}`. Wrong choices are retriable; correct choices persist before feedback.
- `GET /lessons/:id/story/state?sceneId=…&lessonVersion=…` returns ordered `{answers: [{stepId, choiceId}]}`. Refresh resumes at the next unfinished page, without autoplay.
- Completion uses the normal progress endpoint with `result: {storyAnswers: [{stepId, choiceId}]}`. Every unique correct step must match a persisted receipt. A `viewed` flag or guessed client completion cannot earn XP. Existing gamification awards 50 completion XP once and family Stars; individual story tasks add no quiz XP.

Migration `012_story_choices.sql` stores successful choices relationally by user, lesson, version, scene and step. Binary scene/step/choice key collation matches case-sensitive schema IDs. User/lesson/version deletion cascades. New lesson versions invalidate old receipts through the current-version guard. Replay keeps receipts and does not repeat the completion award.

The world supports Xiaoyu, Amin, Teacher, Garden, Pond, Classroom, Seeds, Watering Can, Book, Ball, Shovel and Sun. New worlds need trusted renderers and explicit schema changes. This release contains one fully narrated authored story. Ordinary AI generation retains the existing 2D game pipeline; automatic creation of new voice assets is a future adapter, not a fallback to sample audio.

## Assets and maintenance

Fixture: `backend/src/db/content/chinese-garden-story.json`. Eight real MP3s: `frontend/public/audio/stories/garden/`. Revision 2 replaces the original system voice with Mandarin neural synthesis: Xiaoxiao narrates, Xiaoyi voices Xiaoyu and Yunxi voices Amin; teacher dialogue has a separate pacing profile. Dialogue is attributed explicitly, all original words and task prompts are preserved, and short pauses separate speakers and the task. Output uses constant attenuation only, with no post-generation pitch or tempo manipulation. `PROVENANCE.json` records exact segment transcripts, voice/rate/pitch settings, provider/version, UTC generation time, SHA-256 hashes, durations and decoded peaks. No licensing claim is invented.

Regenerate with `python3 scripts/generate-story-neural-audio.py` (requires Python `edge-tts`, network access and ffmpeg/ffprobe). The original `node scripts/generate-story-audio.mjs` command delegates to that generator. [The provider client](https://github.com/rany2/edge-tts) supports voice/rate/pitch controls but does not accept custom emotional SSML; no unsupported cheerful-style request is fabricated. Every page is generated and checked before publishing the replacement set. The deployed website uses local same-origin MP3s and never contacts the synthesis service. Assess provider voice usage terms before commercial distribution.

```sh
npm run db:migrate -w backend
npm run db:seed-story -w backend -- --dry-run
npm run db:seed-story -w backend
```

The seed skips an existing stable ID, preserving edits and progress. It creates no AI jobs and uses no MockAIProvider. `--owner-email=…` selects an active teacher/admin owner. Production-mode seed writes are blocked; maintenance is explicit.

Checks cover schema redaction, navigation, narration races, music ducking, ordered receipts, stale versions, access controls, spoofed completion and seed idempotency. Opt-in browser test: `E2E_BASE_URL=http://localhost:7777 E2E_STORY=1 npx playwright test scripts/e2e/story.spec.ts`. It plays actual audio faster for test time without synthesizing an `ended` event and walks the real rendered world.

Local verification on 2026-10-09: TypeScript, ESLint, production build and 198 tests across 23 files passed. The two browser checks passed against port 7777: complete story with real WebGL/audio, automatic narration after walking and correct answers, wrong-answer retry, refresh resume, late successful response after pause, countdown pause/reset cancellation, self-reading advancement, retained listening mode after skipping a paragraph, 50 XP exactly once, practice/reset and mobile layout; and demo child library access with music duck/pause/restore across navigation. The new regression failed against the manual-next implementation before the fix. Main migration applied; first seed created one lesson and rerun skipped it. Temporary verification accounts were removed.
