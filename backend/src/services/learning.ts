import { randomUUID } from 'node:crypto';
import {
  z,
  numberRoundAnswer,
  type User,
  type QuizResult,
  type InteractiveStory,
  type StoryAnswer,
  type StoryCheckResult,
  type StoryState,
} from '@wonderlab/shared';
import { rows, run, transaction, type Db } from '../db/pool.js';
import { lessonAccess, privateDefinition } from './lessons.js';
import { awardXp, completeScene, refreshAchievements } from './gamification.js';
import { ApiError } from '../http.js';
const lessonVersion = z.number().int().min(1).default(1);
async function activeDefinition(user: User, id: string, version: number, db: Db) {
  await rows('SELECT id FROM users WHERE id=? FOR UPDATE', [user.id], db);
  await rows('SELECT id FROM lessons WHERE id=? FOR UPDATE', [id], db);
  const lesson = await lessonAccess(id, user, false, db);
  if (lesson.status !== 'READY')
    throw new ApiError(
      409,
      'LESSON_NOT_READY',
      'This lesson is being regenerated. Reopen it when generation finishes.',
    );
  const [{ currentVersion }] = await rows<{ currentVersion: number }>(
    'SELECT MAX(version) currentVersion FROM lesson_versions WHERE lesson_id=?',
    [id],
    db,
  );
  if (version !== currentVersion)
    throw new ApiError(
      409,
      'LESSON_VERSION_CHANGED',
      'This lesson has been updated. Reopen it to continue with the latest version.',
    );
  return privateDefinition(id, db);
}
const completionInput = z.strictObject({
  lessonVersion,
  sceneId: z.string().max(64),
  result: z.record(z.string(), z.unknown()),
  elapsedSeconds: z.number().int().min(0).max(600).default(0),
});
export async function recordProgress(user: User, id: string, payload: unknown) {
  const input = completionInput.parse(payload);
  return transaction(async (db) => {
    const definition = await activeDefinition(user, id, input.lessonVersion, db);
    const scene = definition.scenes.find((s) => s.id === input.sceneId);
    if (!scene) throw new ApiError(400, 'UNKNOWN_SCENE', 'Choose an existing activity.');
    if (scene.type === 'QUIZ')
      throw new ApiError(400, 'QUIZ_REQUIRED', 'Submit your answers to finish the quiz.');
    const viewed = z.array(z.string()).max(30).optional().parse(input.result.viewedIds) || [];
    let valid = false;
    if (scene.type === 'FRACTION_PIZZA')
      valid = input.result.parts === scene.parts && input.result.selected === scene.target;
    else if (scene.type === 'TIMELINE') valid = scene.events.every((e) => viewed.includes(e.id));
    else if (scene.type === 'INTERACTIVE_DIAGRAM' || scene.type === 'ANIMATION')
      valid = scene.parts.every((p) => viewed.includes(p.id));
    else if (scene.type === 'FLASHCARD') valid = scene.cards.every((c) => viewed.includes(c.id));
    else if (scene.type === 'NUMBER_GAME') {
      const answers = z
        .array(
          z.strictObject({
            roundId: z.string().max(64),
            value: z.number().int().min(0).max(10000),
          }),
        )
        .max(8)
        .safeParse(input.result.roundAnswers);
      valid =
        answers.success &&
        answers.data.length === scene.rounds.length &&
        new Set(answers.data.map((answer) => answer.roundId)).size === scene.rounds.length &&
        scene.rounds.every((round) =>
          answers.data.some(
            (answer) => answer.roundId === round.id && answer.value === numberRoundAnswer(round),
          ),
        );
    } else if (scene.type === 'INTERACTIVE_STORY') {
      const answers = z
        .array(storyAnswerSchema)
        .min(2)
        .max(12)
        .safeParse(input.result.storyAnswers);
      const receipts = await storyReceipts(user.id, id, input.lessonVersion, scene, db);
      valid =
        answers.success &&
        answers.data.length === scene.steps.length &&
        new Set(answers.data.map((answer) => answer.stepId)).size === scene.steps.length &&
        receipts.length === scene.steps.length &&
        scene.steps.every(
          (step) =>
            answers.data.some(
              (answer) =>
                answer.stepId === step.id && answer.choiceId === step.task.correctChoiceId,
            ) &&
            receipts.some(
              (receipt) =>
                receipt.stepId === step.id && receipt.choiceId === step.task.correctChoiceId,
            ),
        );
    } else if (scene.type === 'MATCHING') {
      const matched = z.array(z.string().max(64)).max(8).safeParse(input.result.matchedIds);
      valid =
        matched.success &&
        matched.data.length === scene.pairs.length &&
        new Set(matched.data).size === scene.pairs.length &&
        scene.pairs.every((pair) => matched.data.includes(pair.id));
    } else valid = input.result.viewed === true;
    if (!valid)
      throw new ApiError(400, 'ACTIVITY_INCOMPLETE', 'Finish this activity before moving on.');
    return completeScene(user, id, scene.id, definition, input.elapsedSeconds, db);
  });
}
const storyKey = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const storyAnswerSchema = z.strictObject({ stepId: storyKey, choiceId: storyKey });
const storyCheckInput = z.strictObject({
  lessonVersion: z.number().int().min(1),
  sceneId: storyKey,
  stepId: storyKey,
  choiceId: storyKey,
});
const storyStateInput = z.strictObject({
  lessonVersion: z.coerce.number().int().min(1),
  sceneId: storyKey,
});
async function storyReceipts(
  userId: string,
  id: string,
  version: number,
  scene: InteractiveStory,
  db: Db,
): Promise<StoryAnswer[]> {
  const stored = await rows<StoryAnswer>(
    'SELECT step_key stepId,choice_key choiceId FROM story_choices WHERE user_id=? AND lesson_id=? AND lesson_version=? AND scene_key=?',
    [userId, id, version, scene.id],
    db,
  );
  // Only expose the valid ordered prefix; obsolete or inconsistent receipts cannot unlock a step.
  const answers: StoryAnswer[] = [];
  for (const step of scene.steps) {
    const answer = stored.find(
      (receipt) => receipt.stepId === step.id && receipt.choiceId === step.task.correctChoiceId,
    );
    if (!answer) break;
    answers.push(answer);
  }
  return answers;
}
export async function getStoryState(user: User, id: string, query: unknown): Promise<StoryState> {
  const input = storyStateInput.parse(query);
  return transaction(async (db) => {
    const definition = await activeDefinition(user, id, input.lessonVersion, db);
    const scene = definition.scenes.find((scene) => scene.id === input.sceneId);
    if (scene?.type !== 'INTERACTIVE_STORY')
      throw new ApiError(400, 'UNKNOWN_STORY', 'Choose a story in this lesson.');
    return { answers: await storyReceipts(user.id, id, input.lessonVersion, scene, db) };
  });
}
export async function checkStoryAnswer(
  user: User,
  id: string,
  payload: unknown,
): Promise<StoryCheckResult> {
  const input = storyCheckInput.parse(payload);
  return transaction(async (db) => {
    const definition = await activeDefinition(user, id, input.lessonVersion, db);
    const scene = definition.scenes.find((scene) => scene.id === input.sceneId);
    if (scene?.type !== 'INTERACTIVE_STORY')
      throw new ApiError(400, 'UNKNOWN_STORY', 'Choose a story in this lesson.');
    const stepIndex = scene.steps.findIndex((step) => step.id === input.stepId);
    const step = scene.steps[stepIndex];
    if (!step || !step.task.choices.some((choice) => choice.id === input.choiceId))
      throw new ApiError(400, 'INVALID_ANSWER', 'Choose an available story answer.');
    const receipts = await storyReceipts(user.id, id, input.lessonVersion, scene, db);
    if (receipts.length < stepIndex)
      throw new ApiError(409, 'STORY_STEP_LOCKED', 'Finish the earlier story steps first.');
    const correct = input.choiceId === step.task.correctChoiceId;
    if (correct)
      await run(
        'INSERT IGNORE INTO story_choices(id,user_id,lesson_id,lesson_version,scene_key,step_key,choice_key) VALUES(?,?,?,?,?,?,?)',
        [randomUUID(), user.id, id, input.lessonVersion, scene.id, step.id, input.choiceId],
        db,
      );
    return {
      stepId: step.id,
      choiceId: input.choiceId,
      correct,
      feedback: correct ? step.task.successText : step.task.retryText,
    };
  });
}
const checkInput = z.strictObject({
  lessonVersion,
  sceneId: z.string().max(64),
  questionId: z.string().max(64),
  optionId: z.string().max(64),
});
export async function checkQuizAnswer(user: User, id: string, payload: unknown) {
  const input = checkInput.parse(payload);
  return transaction(async (db) => {
    const definition = await activeDefinition(user, id, input.lessonVersion, db);
    const scene = definition.scenes.find((s) => s.id === input.sceneId);
    if (scene?.type !== 'QUIZ')
      throw new ApiError(400, 'UNKNOWN_QUIZ', 'Choose a quiz in this lesson.');
    const question = scene.questions.find((q) => q.id === input.questionId);
    if (!question || !question.options.some((o) => o.id === input.optionId))
      throw new ApiError(400, 'INVALID_ANSWER', 'Choose an available answer.');
    const [graded] = await rows<{ option_key: string }>(
      'SELECT qa.option_key FROM quiz_answers qa JOIN quiz_attempts a ON a.id=qa.attempt_id WHERE a.user_id=? AND a.lesson_id=? AND a.scene_key=? AND qa.question_key=?',
      [user.id, id, scene.id, question.id],
      db,
    );
    await run(
      'INSERT IGNORE INTO quiz_choices(id,user_id,lesson_id,lesson_version,scene_key,question_key,option_key) VALUES(?,?,?,?,?,?,?)',
      [
        randomUUID(),
        user.id,
        id,
        input.lessonVersion,
        scene.id,
        question.id,
        graded?.option_key || input.optionId,
      ],
      db,
    );
    const [choice] = await rows<{ option_key: string }>(
      'SELECT option_key FROM quiz_choices WHERE user_id=? AND lesson_id=? AND lesson_version=? AND scene_key=? AND question_key=?',
      [user.id, id, input.lessonVersion, scene.id, question.id],
      db,
    );
    return {
      questionId: question.id,
      optionId: choice.option_key,
      correct: question.correctOptionId === choice.option_key,
      correctOptionId: question.correctOptionId,
      explanation: question.explanation,
    };
  });
}
const quizInput = z.strictObject({
  lessonVersion,
  sceneId: z.string().max(64),
  answers: z
    .array(z.strictObject({ questionId: z.string().max(64), optionId: z.string().max(64) }))
    .min(1)
    .max(12),
  elapsedSeconds: z.number().int().min(0).max(600).default(0),
});
export async function submitQuiz(user: User, id: string, payload: unknown): Promise<QuizResult> {
  const input = quizInput.parse(payload);
  return transaction(async (db) => {
    const definition = await activeDefinition(user, id, input.lessonVersion, db);
    const scene = definition.scenes.find((s) => s.id === input.sceneId);
    if (scene?.type !== 'QUIZ')
      throw new ApiError(400, 'UNKNOWN_QUIZ', 'Choose a quiz in this lesson.');
    if (
      input.answers.length !== scene.questions.length ||
      new Set(input.answers.map((a) => a.questionId)).size !== scene.questions.length ||
      !scene.questions.every((q) =>
        input.answers.some(
          (a) => a.questionId === q.id && q.options.some((o) => o.id === a.optionId),
        ),
      )
    )
      throw new ApiError(
        400,
        'INVALID_ANSWERS',
        'Answer every question using an available choice.',
      );
    const [previous] = await rows<{
      id: string;
      score: number;
      correct_answers: number;
      total_questions: number;
      xp_earned: number;
    }>(
      'SELECT * FROM quiz_attempts WHERE user_id=? AND lesson_id=? AND scene_key=?',
      [user.id, id, scene.id],
      db,
    );
    let answers: { questionId: string; optionId: string }[];
    if (previous)
      answers = await rows(
        'SELECT question_key questionId,option_key optionId FROM quiz_answers WHERE attempt_id=?',
        [previous.id],
        db,
      );
    else {
      for (const answer of input.answers)
        await run(
          'INSERT IGNORE INTO quiz_choices(id,user_id,lesson_id,lesson_version,scene_key,question_key,option_key) VALUES(?,?,?,?,?,?,?)',
          [
            randomUUID(),
            user.id,
            id,
            input.lessonVersion,
            scene.id,
            answer.questionId,
            answer.optionId,
          ],
          db,
        );
      answers = await rows(
        'SELECT question_key questionId,option_key optionId FROM quiz_choices WHERE user_id=? AND lesson_id=? AND lesson_version=? AND scene_key=?',
        [user.id, id, input.lessonVersion, scene.id],
        db,
      );
    }
    const feedback = scene.questions.map((q) => ({
      questionId: q.id,
      correct: answers.find((a) => a.questionId === q.id)?.optionId === q.correctOptionId,
      correctOptionId: q.correctOptionId,
      explanation: q.explanation,
    }));
    const correct = feedback.filter((f) => f.correct).length;
    const score = Math.round((correct / scene.questions.length) * 100);
    let xpEarned = 0;
    let lessonCompleted = false;
    if (!previous) {
      xpEarned = await awardXp(
        user.id,
        id,
        `quiz:${id}:${scene.id}`,
        correct * 10 + (score === 100 ? 50 : 0),
        'Quiz answered',
        db,
        { kind: 'QUIZ', correctAnswers: correct, perfect: score === 100 },
      );
      const attempt = randomUUID();
      await run(
        'INSERT INTO quiz_attempts(id,user_id,lesson_id,scene_key,score,correct_answers,total_questions,xp_earned) VALUES(?,?,?,?,?,?,?,?)',
        [attempt, user.id, id, scene.id, score, correct, scene.questions.length, xpEarned],
        db,
      );
      for (const answer of answers)
        await run(
          'INSERT INTO quiz_answers(id,attempt_id,question_key,option_key,is_correct) VALUES(?,?,?,?,?)',
          [
            randomUUID(),
            attempt,
            answer.questionId,
            answer.optionId,
            feedback.find((f) => f.questionId === answer.questionId)!.correct,
          ],
          db,
        );
      const result = await completeScene(user, id, scene.id, definition, input.elapsedSeconds, db);
      xpEarned += result.xpEarned;
      lessonCompleted = result.lessonCompleted;
      await run(
        'UPDATE lesson_progress SET best_score=GREATEST(COALESCE(best_score,0),?) WHERE user_id=? AND lesson_id=?',
        [score, user.id, id],
        db,
      );
      await refreshAchievements(user.id, db);
    } else {
      const [p] = await rows<{ status: string }>(
        'SELECT status FROM lesson_progress WHERE user_id=? AND lesson_id=?',
        [user.id, id],
        db,
      );
      lessonCompleted = p?.status === 'COMPLETED';
    }
    const [{ xp }] = await rows<{ xp: number }>('SELECT xp FROM users WHERE id=?', [user.id], db);
    return {
      score,
      correct,
      total: scene.questions.length,
      xpEarned,
      totalXp: xp,
      lessonCompleted,
      alreadySubmitted: !!previous,
      feedback,
    };
  });
}
