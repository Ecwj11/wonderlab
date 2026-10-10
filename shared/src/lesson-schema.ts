import { z } from 'zod';
export const subjects = ['MATHEMATICS', 'SCIENCE', 'HISTORY', 'GEOGRAPHY', 'GENERAL'] as const;
export const languages = ['English', 'Bahasa Melayu', 'Chinese'] as const;
export const subjectSchema = z.enum(subjects);
export const languageSchema = z.enum(languages);
const text = (max = 2000) => z.string().trim().min(1).max(max);
const key = z.string().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const base = { id: key, title: text(180), explanation: text(), instructions: text().optional() };
const optionSchema = z.strictObject({ id: key, label: text(300) });
export const questionSchema = z
  .strictObject({
    id: key,
    prompt: text(500),
    options: z.array(optionSchema).min(2).max(6),
    correctOptionId: key,
    explanation: text(1000),
  })
  .superRefine((q, ctx) => {
    if (new Set(q.options.map((o) => o.id)).size !== q.options.length)
      ctx.addIssue({ code: 'custom', message: 'Choice IDs must be unique' });
    if (!q.options.some((o) => o.id === q.correctOptionId))
      ctx.addIssue({ code: 'custom', message: 'Answer must match a choice' });
  });
const quizBase = z
  .strictObject({
    ...base,
    type: z.literal('QUIZ'),
    questions: z.array(questionSchema).min(1).max(12),
  })
  .superRefine((s, ctx) => {
    if (new Set(s.questions.map((q) => q.id)).size !== s.questions.length)
      ctx.addIssue({ code: 'custom', message: 'Question IDs must be unique' });
  });
const publicQuestionSchema = z.strictObject({
  id: key,
  prompt: text(500),
  options: z.array(optionSchema).min(2).max(6),
});
export const publicQuizSchema = z.strictObject({
  ...base,
  type: z.literal('QUIZ'),
  questions: z.array(publicQuestionSchema).min(1).max(12),
});
export const fractionSchema = z
  .strictObject({
    ...base,
    type: z.literal('FRACTION_PIZZA'),
    parts: z.number().int().min(2).max(8),
    target: z.number().int().min(1).max(7),
  })
  .superRefine((s, ctx) => {
    if (s.target >= s.parts)
      ctx.addIssue({ code: 'custom', message: 'Target must be less than the whole' });
  });
const event = z.strictObject({
  id: key,
  year: z.number().int().min(1).max(2200),
  title: text(180),
  description: text(),
  location: text(160),
  people: z.array(text(100)).max(8),
});
export const timelineSchema = z
  .strictObject({ ...base, type: z.literal('TIMELINE'), events: z.array(event).min(2).max(15) })
  .superRefine((s, ctx) => {
    if (new Set(s.events.map((e) => e.id)).size !== s.events.length)
      ctx.addIssue({ code: 'custom', message: 'Event IDs must be unique' });
    if (s.events.some((e, i) => i > 0 && e.year < s.events[i - 1].year))
      ctx.addIssue({ code: 'custom', message: 'Timeline must be chronological' });
  });
const diagramFields = {
  ...base,
  diagram: z.enum(['HEART', 'SOLAR_SYSTEM', 'PLANT']),
  parts: z
    .array(z.strictObject({ id: key, label: text(100), description: text(1000) }))
    .min(2)
    .max(10),
};
const uniqueParts = (s: { parts: { id: string }[] }, ctx: z.RefinementCtx) => {
  if (new Set(s.parts.map((p) => p.id)).size !== s.parts.length)
    ctx.addIssue({ code: 'custom', message: 'Part IDs must be unique' });
};
export const diagramSchema = z
  .strictObject({ ...diagramFields, type: z.literal('INTERACTIVE_DIAGRAM') })
  .superRefine(uniqueParts);
export const animationSchema = z
  .strictObject({ ...diagramFields, type: z.literal('ANIMATION') })
  .superRefine(uniqueParts);
export const storySchema = z.strictObject({
  ...base,
  type: z.literal('STORY'),
  paragraphs: z.array(text()).min(1).max(10),
});
export const storyWorldTargets = [
  'XIAOYU',
  'AMIN',
  'TEACHER',
  'GARDEN',
  'POND',
  'CLASSROOM',
  'SEEDS',
  'WATERING_CAN',
  'BOOK',
  'BALL',
  'SHOVEL',
  'SUN',
] as const;
export const storyWorldTargetSchema = z.enum(storyWorldTargets);
const storyChoiceSchema = z.strictObject({
  id: key,
  label: text(300),
  target: storyWorldTargetSchema.optional(),
});
const publicStoryTaskFields = {
  type: z.enum(['MEET', 'MOVE', 'FIND', 'QUESTION']),
  prompt: text(500),
  choices: z.array(storyChoiceSchema).min(2).max(4),
};
function validateStoryChoices(
  task: { type: string; choices: { id: string; target?: string }[] },
  ctx: z.RefinementCtx,
) {
  if (new Set(task.choices.map((choice) => choice.id)).size !== task.choices.length)
    ctx.addIssue({ code: 'custom', message: 'Story choice IDs must be unique' });
  if (task.type === 'QUESTION') {
    if (task.choices.some((choice) => choice.target !== undefined))
      ctx.addIssue({ code: 'custom', message: 'Question choices must omit world targets' });
  } else {
    if (task.choices.some((choice) => choice.target === undefined))
      ctx.addIssue({ code: 'custom', message: 'World choices require a target' });
    if (new Set(task.choices.map((choice) => choice.target)).size !== task.choices.length)
      ctx.addIssue({ code: 'custom', message: 'World targets must be unique within a task' });
  }
}
export const publicStoryTaskSchema = z
  .strictObject(publicStoryTaskFields)
  .superRefine(validateStoryChoices);
export const storyTaskSchema = z
  .strictObject({
    ...publicStoryTaskFields,
    correctChoiceId: key,
    successText: text(1000),
    retryText: text(1000),
  })
  .superRefine((task, ctx) => {
    validateStoryChoices(task, ctx);
    if (!task.choices.some((choice) => choice.id === task.correctChoiceId))
      ctx.addIssue({ code: 'custom', message: 'Story answer must match a choice' });
  });
const storyStepFields = {
  id: key,
  title: text(180),
  text: text(),
  narrationSrc: z
    .string()
    .max(200)
    .regex(
      /^\/audio\/stories\/[a-z0-9]+(?:-[a-z0-9]+)*\/[a-z0-9]+(?:-[a-z0-9]+)*\.mp3$/,
      'Narration must be a local /audio/stories/<slug>/<step>.mp3 path',
    ),
};
const interactiveStoryFields = {
  ...base,
  type: z.literal('INTERACTIVE_STORY'),
  world: z.literal('SCHOOL_GARDEN'),
};
function uniqueStorySteps(scene: { steps: { id: string }[] }, ctx: z.RefinementCtx) {
  if (new Set(scene.steps.map((step) => step.id)).size !== scene.steps.length)
    ctx.addIssue({ code: 'custom', message: 'Story step IDs must be unique' });
}
export const interactiveStorySchema = z
  .strictObject({
    ...interactiveStoryFields,
    steps: z
      .array(z.strictObject({ ...storyStepFields, task: storyTaskSchema }))
      .min(2)
      .max(12),
  })
  .superRefine(uniqueStorySteps);
export const publicInteractiveStorySchema = z
  .strictObject({
    ...interactiveStoryFields,
    steps: z
      .array(z.strictObject({ ...storyStepFields, task: publicStoryTaskSchema }))
      .min(2)
      .max(12),
  })
  .superRefine(uniqueStorySteps);
export type StoryWorldTarget = z.infer<typeof storyWorldTargetSchema>;
export type InteractiveStory = z.infer<typeof interactiveStorySchema>;
export type PublicInteractiveStory = z.infer<typeof publicInteractiveStorySchema>;
export interface StoryAnswer {
  stepId: string;
  choiceId: string;
}
export interface StoryCheckResult extends StoryAnswer {
  correct: boolean;
  feedback: string;
}
export interface StoryState {
  answers: StoryAnswer[];
}
export const flashcardSchema = z
  .strictObject({
    ...base,
    type: z.literal('FLASHCARD'),
    cards: z
      .array(z.strictObject({ id: key, front: text(500), back: text() }))
      .min(1)
      .max(12),
  })
  .superRefine((s, ctx) => {
    if (new Set(s.cards.map((c) => c.id)).size !== s.cards.length)
      ctx.addIssue({ code: 'custom', message: 'Card IDs must be unique' });
  });
export const numberGameSchema = z
  .strictObject({
    ...base,
    type: z.literal('NUMBER_GAME'),
    rounds: z
      .array(
        z.strictObject({
          id: key,
          left: z.number().int().min(0).max(10000),
          right: z.number().int().min(0).max(10000),
          operation: z.enum(['ADD', 'SUBTRACT', 'MULTIPLY', 'DIVIDE']),
          blockMode: z.enum(['UNITS', 'VALUES']).optional(),
        }),
      )
      .min(2)
      .max(8),
  })
  .superRefine((scene, ctx) => {
    if (new Set(scene.rounds.map((round) => round.id)).size !== scene.rounds.length)
      ctx.addIssue({ code: 'custom', message: 'Mission IDs must be unique' });
    if (scene.rounds.some((round) => round.operation === 'SUBTRACT' && round.right > round.left))
      ctx.addIssue({ code: 'custom', message: 'Subtraction must leave a nonnegative number' });
    for (const round of scene.rounds) {
      if (
        round.blockMode !== 'VALUES' &&
        (round.left > 10 || round.right > 10 || !['ADD', 'SUBTRACT'].includes(round.operation))
      )
        ctx.addIssue({
          code: 'custom',
          message: 'Unit blocks support addition/subtraction operands up to 10',
        });
      const answer = numberRoundAnswer(round);
      if (!Number.isInteger(answer) || answer < 0 || answer > 10000)
        ctx.addIssue({
          code: 'custom',
          message: 'Round must have a whole-number answer within 10000',
        });
    }
  });
export function numberRoundAnswer(round: {
  left: number;
  right: number;
  operation: 'ADD' | 'SUBTRACT' | 'MULTIPLY' | 'DIVIDE';
}) {
  switch (round.operation) {
    case 'ADD':
      return round.left + round.right;
    case 'SUBTRACT':
      return round.left - round.right;
    case 'MULTIPLY':
      return round.left * round.right;
    case 'DIVIDE':
      return round.left / round.right;
  }
}
export const matchingSchema = z
  .strictObject({
    ...base,
    type: z.literal('MATCHING'),
    gameStyle: z.enum(['MEMORY', 'ADVENTURE']).optional(),
    pairs: z
      .array(z.strictObject({ id: key, left: text(180), right: text(180) }))
      .min(2)
      .max(8),
  })
  .superRefine((scene, ctx) => {
    if (new Set(scene.pairs.map((pair) => pair.id)).size !== scene.pairs.length)
      ctx.addIssue({ code: 'custom', message: 'Pair IDs must be unique' });
    for (const face of ['left', 'right'] as const)
      if (
        new Set(scene.pairs.map((pair) => pair[face].toLocaleLowerCase())).size !==
        scene.pairs.length
      )
        ctx.addIssue({ code: 'custom', message: 'Matching faces must be unambiguous' });
  });
const scenes = [
  numberGameSchema,
  matchingSchema,
  fractionSchema,
  timelineSchema,
  diagramSchema,
  animationSchema,
  storySchema,
  flashcardSchema,
] as const;
export const sceneSchema = z.discriminatedUnion('type', [
  ...scenes,
  quizBase,
  interactiveStorySchema,
]);
export const publicSceneSchema = z.discriminatedUnion('type', [
  ...scenes,
  publicQuizSchema,
  publicInteractiveStorySchema,
]);
const lessonFields = {
  lessonSchemaVersion: z.literal(1),
  title: text(180),
  subject: subjectSchema,
  language: languageSchema,
  objectives: z.array(text(300)).min(1).max(8),
};
export const lessonSchema = z
  .strictObject({ ...lessonFields, scenes: z.array(sceneSchema).min(1).max(20) })
  .superRefine((l, ctx) => {
    if (new Set(l.scenes.map((s) => s.id)).size !== l.scenes.length)
      ctx.addIssue({ code: 'custom', message: 'Scene IDs must be unique' });
  });
export const publicLessonSchema = z
  .strictObject({ ...lessonFields, scenes: z.array(publicSceneSchema).min(1).max(20) })
  .superRefine((l, ctx) => {
    if (new Set(l.scenes.map((s) => s.id)).size !== l.scenes.length)
      ctx.addIssue({ code: 'custom', message: 'Scene IDs must be unique' });
  });
export type LessonDefinition = z.infer<typeof lessonSchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type PublicLesson = z.infer<typeof publicLessonSchema>;
export type PublicScene = z.infer<typeof publicSceneSchema>;
export type Subject = z.infer<typeof subjectSchema>;
export type Language = z.infer<typeof languageSchema>;
export function publicDefinition(definition: LessonDefinition): PublicLesson {
  return publicLessonSchema.parse({
    ...definition,
    scenes: definition.scenes.map((scene) =>
      scene.type === 'QUIZ'
        ? {
            ...scene,
            questions: scene.questions.map(
              ({ correctOptionId: _answer, explanation: _explanation, ...q }) => q,
            ),
          }
        : scene.type === 'INTERACTIVE_STORY'
          ? {
              ...scene,
              steps: scene.steps.map((step) => {
                const {
                  correctChoiceId: _answer,
                  successText: _success,
                  retryText: _retry,
                  ...task
                } = step.task;
                return { ...step, task };
              }),
            }
          : scene,
    ),
  });
}
export const generateLessonSchema = z.strictObject({
  title: text(180),
  subject: subjectSchema,
  language: languageSchema.default('English'),
  schoolLevel: text(64).default('Primary school'),
  content: text(40000),
  inputType: z.enum(['TEXT', 'TOPIC', 'PDF', 'IMAGE']).default('TEXT'),
  uploadId: z.string().uuid().optional(),
});
export type GenerateInput = z.infer<typeof generateLessonSchema>;
export const subjectLabels: Record<Subject, string> = {
  MATHEMATICS: 'Mathematics',
  SCIENCE: 'Science',
  HISTORY: 'History',
  GEOGRAPHY: 'Geography',
  GENERAL: 'General',
};
