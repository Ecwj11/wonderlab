# Lesson schema v1

`MATCHING` optionally accepts `gameStyle: "ADVENTURE" | "MEMORY"` to select a trusted presentation. Omitted values preserve existing defaults: maths uses memory cards, other subjects use the 2D adventure. The Primary 1–3 maths catalogue uses `NUMBER_GAME` with optional per-round `blockMode: "VALUES"` for labelled place-value blocks and all four arithmetic operations. Omitted/`UNITS` mode retains small addition/subtraction counting blocks (operands up to 10); values mode permits operands/results within 10,000, nonnegative subtraction and exact division. See [the catalogue](PRIMARY_MATHS_CATALOGUE.md).

The executable contract is shared/src/lesson-schema.ts. All lesson definitions contain lessonSchemaVersion: 1, title, subject, language, objectives and scenes. TypeScript types are inferred directly from Zod; one source of truth validates the server and player.

Scenes are a discriminated union. Initial renderers: FRACTION_PIZZA (parts/target/instructions), TIMELINE (dated events/locations/people/explanations), INTERACTIVE_DIAGRAM (named parts), ANIMATION (controlled diagram), QUIZ (question/options/correct answer/explanation), STORY and FLASHCARD (safe text panels). The registry adds renderers without changing the pipeline. New scene kinds require a schema addition and renderer; unknown kinds are rejected, never injected into the DOM.

```json
{
  "lessonSchemaVersion": 1,
  "title": "Fractions, one slice at a time",
  "subject": "MATHEMATICS",
  "language": "English",
  "objectives": ["Recognize equal parts", "Identify one quarter"],
  "scenes": [
    {
      "id": "pizza",
      "type": "FRACTION_PIZZA",
      "title": "Build a fraction",
      "explanation": "A fraction describes equal parts of a whole.",
      "instructions": "Divide the pizza into four parts. Select one slice.",
      "parts": 4,
      "target": 1
    }
  ]
}
```

Constraints: 1–20 scenes, 1–8 objectives, 2–8 pizza parts, target less than parts, 2–6 choices per question, bounded strings and no unknown object properties. Scene/question/event/part IDs must be unique. Answers must reference a real choice. Timeline years are sorted. No arbitrary URLs, HTML, scripts or executable code.

Content describes knowledge, presentation is the trusted React renderer, and interaction is validated configuration. The player receives a public projection with correctOptionId omitted. Submission uses {sceneId, answers: [{questionId, optionId}]}; the API looks up its private answer key. Scene completion is verified from submitted interaction results. A final lesson reward requires all interactive scenes and all quizzes to be completed.

Definition version is returned as `lessonVersion` beside lesson metadata. It changes on regeneration while `lessonSchemaVersion` stays 1. Both diagram/animation part IDs and flashcard IDs are unique; public and private schemas enforce the same collection invariants. MAP, DRAG_DROP, PUZZLE and EXPERIMENT still require new schemas and renderers.

## Playable games

`INTERACTIVE_STORY` adds a trusted 3D school garden with 2–12 narrated steps. Each step has `id`, `title`, `text`, a same-origin `/audio/stories/<slug>/<slug>.mp3` `narrationSrc`, and a `MEET`, `MOVE`, `FIND` or `QUESTION` task. World choices reference unique known targets; questions omit targets. Public definitions strip `correctChoiceId`, `successText` and `retryText`. Ordered successful server receipts are required for completion using `storyAnswers`. See [3D Chinese stories](INTERACTIVE_STORIES.md).

New Codex generation plans open with a playable NUMBER_GAME or MATCHING scene. Reading, diagrams and quizzes can support the game. No generated HTML or React is executed. These additive v1 types require deploying the shared contract, backend and frontend together.

- NUMBER_GAME: `rounds: [{id, left, right, operation: "ADD" | "SUBTRACT"}]`, 2–8 unique missions, operands 0–10, no negative subtraction results. The trusted 2D Number Forest renderer supplies movement, jumping, collision, colored collectible blocks, bridge building and a treehouse exit. Children collect both operand groups, choose the correct arithmetic result to unlock the bridge and physically reach the exit. Subtraction collects the starting group and takes away the configured quantity. Every round must be won before completion. Geometry and executable code never come from the AI; game coins remain local practice feedback. Addition answers are derived as left + right; subtraction answers as left - right.
- MATCHING: `pairs: [{id, left, right}]`, 2–8 unique pairs and unique faces on each side, safe text up to 180 characters. For non-mathematics subjects, children move and jump through a trusted 2D world to collect clues (`left`), choose their meanings (`right`), solve every mission, build a bridge and physically reach the exit. Mathematics uses shuffled memory cards. Both submit the same validated `matchedIds`; no schema version change or generated executable code is needed.

Both also contain scene id, title, explanation and optional instructions. Controls support click/touch/keyboard, pause and replay. Game coins and moves are local practice scores; persistent XP is awarded by the existing idempotent backend ledger. Completion submits `{roundAnswers: [{roundId, value}]}` or `{matchedIds: [pairId]}`. The server checks all exact missions or pairs against the current stored definition; a generic viewed flag, partial results, duplicate identities or client-supplied XP cannot complete a game. Memory matching is a practice activity with visible pair content, not a secret graded assessment; quizzes retain server-side answer keys.
