# Primary 1–3 maths game catalogue

96 public, English-language maths lessons for Malaysian children. Each grade has 32 games: 13 addition, 13 subtraction, three multiplication and three division. These are curated practice collections, not a claim of complete official syllabus coverage.

| Grade     | Addition                                                         | Subtraction                                                     | Multiplication                              | Division                               |
| --------- | ---------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------- | -------------------------------------- |
| Primary 1 | Counting on, making ten, teens, tens, within 100                 | Taking away, counting back, comparison, tens, simple regrouping | Introductory equal groups and skip counting | Equal sharing by 2 and 5               |
| Primary 2 | Place value and regrouping within 1,000                          | Exchanges, zeros, compensation, counting up                     | 2, 3, 5 and 10 tables                       | Exact sharing and grouping             |
| Primary 3 | Four-digit place value, chained regrouping and mental strategies | Exchanges across zeros and thousands                            | 3, 4, 6 and 8 tables                        | Exact division by 3, 4, 6, 7, 8 and 10 |

## Play experience

Every lesson opens with four levels of the **Number Forest block game**: walk, jump, collect blue/gold number blocks, solve calculations, build the bridge and reach the treehouse. Three Malaysian everyday word problems follow, with immediate server-checked feedback. Existing lesson completion, XP and family Stars rules apply. The original public lesson stays in the library; library reuse creates the learner's personal copy.

The catalogue now uses `NUMBER_GAME`, not matching clue missions. Small addition/subtraction operands (up to 10 each) retain the existing one-block-per-unit counting and take-away controls. Other rounds specify `blockMode: "VALUES"`: operands are split into labelled place-value blocks (234 becomes 200, 30, 4). The blue values form the first operand and gold values the second; the student collects both, solves the displayed +/−/×/÷ calculation and chooses the bridge answer. Each operand uses at most five blocks; the bridge renders at most 20 planks regardless of the answer. Multiplication/division use these number values rather than claiming to draw every group or unit. Division must be exact, subtraction nonnegative, and answers within 10,000. The shared schema validates these rules and the server independently calculates every submitted answer. Walking animations and the comfortable stationary camera remain unchanged.

## Authorship and publication

Three Codex session subagents authored the original 60-game collections in `backend/src/db/content/primary-{1,2,3}-maths.json`. The Codex session authored 36 additional games in `primary-{1,2,3}-maths-extra.json`. Every game contains a specific teaching focus, four missions with distinct answers, and three word problems. New batch provenance uses `maths-primary-v2`; original provenance and stable identities remain unchanged. The session reviewed arithmetic, question wording and focus alignment. The catalogue builder validates every source and final lesson before any database write, derives answers and distractors, and removes quiz answer keys from public responses through the existing lesson service.

This is an explicit curated seed import. It does not invoke MockAIProvider, create fictional generation jobs or usage records, change the configured AI provider, or consume a parent's generation allowance.

## Import and rerun

From the repository root, with the database migrated and an active teacher account:

```sh
npm run db:seed-maths -w backend -- --dry-run
npm run db:seed-maths -w backend
# Convert the earlier clue-game catalogue and untouched, unstarted personal copies:
npm run db:seed-maths -w backend -- --upgrade-number-blocks
```

The default owner is `teacher@example.com`; pass `--owner-email=your-teacher@example.com` to choose another active teacher/admin. Stable IDs derive from immutable catalogue keys. Existing IDs are skipped, preserving edited lessons, versions and learner progress. The entire new batch is committed in one transaction. The import does not reset users, passwords, XP, Stars or other lessons. Writes are disabled under `NODE_ENV=production`; use an explicit maintenance environment for controlled imports.

The explicit upgrade only converts schema-valid version-one matching scenes whose provenance and original arithmetic match this catalogue. It publishes a new version, preserves lesson metadata/supporting content, and skips edited versions. Personal copies are only upgraded if they have no learning-progress record. Started personal lessons retain their original activity and progress. The initial conversion updated all 60 public samples and one unstarted child copy.

Open `/app/library?subject=MATHEMATICS`. Search `P1`, `P2`, `P3`, `Addition`, `Subtraction`, `Multiplication` or `Division` to narrow the collection. REST clients can also filter by exact `schoolLevel=Primary 1`, `Primary 2` or `Primary 3`.

## Verification

Catalogue tests audit the 96-game/grade/operation counts, unique identities, schema, every arithmetic answer, quiz distractors, public answer-key redaction and invalid arithmetic. An isolated database test checks imports/reruns/upgrades, preservation of metadata, and server rejection of incorrect large-number/multiplication/division results. The Number Forest engine tests check place-value representations and bridge gating. Run `E2E_BASE_URL=http://localhost:7777 E2E_MATH_BLOCKS=1 npx playwright test scripts/e2e/maths-blocks.spec.ts` to physically play four levels and quizzes for unit addition/subtraction and larger subtraction/multiplication/division. These tests create and remove temporary accounts and personal copies.

## Additional practice batch — 8 October 2026

The 36-game expansion adds 12 games per grade: five addition, five subtraction,
one multiplication and one division. It contributes 144 playable levels and
108 word problems using Malaysian school, market, craft and community settings.
The original 60 public lessons, their versions and existing personal copies
are preserved. The import creates only new stable IDs; a rerun skips all 96.

| Grade     | Additional practice                                                                                                                                      |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Primary 1 | Doubles, near doubles, making ten, whole tens, two-digit addition, zero/all subtraction, teen take-away, crossing a ten, equal groups and sharing by two |
| Primary 2 | Three-digit addition, regrouping ones/tens, crossing hundreds, doubling, exchanges through zero, small differences, five/ten tables and sharing by three |
| Primary 3 | Four-digit addition/subtraction, linked exchanges, crossing thousands, compensation, doubling, zeros, six/eight tables and exact division by seven/eight |

All new practice stays within 100 for Primary 1, 1,000 for Primary 2 and
10,000 for Primary 3. Division has no remainder and subtraction stays
nonnegative. These are practice difficulty bands, not a complete official
syllabus mapping.

To physically play the new batch rather than the original lessons, run:

```sh
E2E_BASE_URL=http://localhost:7777 E2E_MATH_BLOCKS=1 E2E_MATH_EXTRA=1 npx playwright test scripts/e2e/maths-blocks.spec.ts
```
