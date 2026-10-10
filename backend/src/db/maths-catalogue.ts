import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { lessonSchema, z } from '@wonderlab/shared';

const operand = z.number().int().min(0).max(10000);
const arithmetic = z.strictObject({ left: operand, right: operand });
const sourceSchema = z.strictObject({
  key: z
    .string()
    .regex(/^p[123]-[a-z0-9-]+$/)
    .max(64),
  grade: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  operation: z.enum(['ADD', 'SUBTRACT', 'MULTIPLY', 'DIVIDE']),
  title: z.string().min(1).max(100),
  focus: z.string().min(1).max(300),
  missions: z.array(arithmetic).length(4),
  quiz: z.array(arithmetic.extend({ context: z.string().min(1).max(500) })).length(3),
});
type Operation = z.infer<typeof sourceSchema>['operation'];
const operations = {
  ADD: { name: 'Addition', symbol: '+' },
  SUBTRACT: { name: 'Subtraction', symbol: '−' },
  MULTIPLY: { name: 'Multiplication', symbol: '×' },
  DIVIDE: { name: 'Division', symbol: '÷' },
};

export function calculateAnswer(operation: Operation, left: number, right: number) {
  if (![left, right].every((value) => Number.isInteger(value) && value >= 0 && value <= 10000))
    throw new Error('Operands must be whole numbers between 0 and 10000');
  const answer =
    operation === 'ADD'
      ? left + right
      : operation === 'SUBTRACT'
        ? left - right
        : operation === 'MULTIPLY'
          ? left * right
          : left / right;
  if (!Number.isInteger(answer) || answer < 0 || answer > 10000)
    throw new Error('Arithmetic must have a nonnegative whole-number answer within 10000');
  return answer;
}

function explanation(operation: Operation, left: number, right: number, answer: number) {
  switch (operation) {
    case 'ADD':
      return `Combine both amounts: ${left} + ${right} = ${answer}.`;
    case 'SUBTRACT':
      return `Take ${right} away from ${left}: ${left} − ${right} = ${answer}. Check: ${answer} + ${right} = ${left}.`;
    case 'MULTIPLY':
      return `Multiply the number of equal groups by the amount in each group: ${left} × ${right} = ${answer}.`;
    case 'DIVIDE':
      return `${left} ÷ ${right} = ${answer}. You can divide by sharing equally or making equal-sized groups. Check: ${right} × ${answer} = ${left}.`;
  }
}

function buildLesson(source: z.infer<typeof sourceSchema>) {
  const operation = operations[source.operation];
  const title = `P${source.grade} ${operation.name}: ${source.title}`;
  const definition = lessonSchema.parse({
    lessonSchemaVersion: 1,
    title,
    subject: 'MATHEMATICS',
    language: 'English',
    objectives: [
      source.focus,
      `Solve ${operation.name.toLowerCase()} problems in everyday Malaysian settings.`,
    ],
    scenes: [
      {
        id: source.key + '-quest',
        type: 'NUMBER_GAME',
        title: source.title,
        explanation: source.focus,
        instructions:
          'Walk and jump to collect the number blocks. Small numbers use counting blocks; larger numbers use labelled place-value blocks. Solve the calculation, build the bridge and reach the treehouse. Complete all four levels.',
        rounds: source.missions.map(({ left, right }, index) => ({
          id: `mission-${index + 1}`,
          left,
          right,
          operation: source.operation,
          ...(left > 10 || right > 10 || !['ADD', 'SUBTRACT'].includes(source.operation)
            ? { blockMode: 'VALUES' }
            : {}),
        })),
      },
      {
        id: source.key + '-quiz',
        type: 'QUIZ',
        title: 'The final treasure challenge',
        explanation: 'Use your new maths skills to solve three everyday problems.',
        instructions: 'Choose one answer. Read the feedback, then try the next question.',
        questions: source.quiz.map(({ left, right, context }, index) => {
          const answer = calculateAnswer(source.operation, left, right);
          const candidates = [
            answer - 1,
            answer + 1,
            answer + 10,
            left + right,
            Math.abs(left - right),
            answer - 10,
            answer + 2,
          ];
          const distractors = [...new Set(candidates)]
            .filter((value) => value >= 0 && value !== answer)
            .slice(0, 3);
          const values = [...distractors];
          const correctIndex = (index + source.grade) % 4;
          values.splice(correctIndex, 0, answer);
          return {
            id: `question-${index + 1}`,
            prompt: context,
            options: values.map((value, choice) => ({
              id: `option-${choice + 1}`,
              label: String(value),
            })),
            correctOptionId: `option-${correctIndex + 1}`,
            explanation: `${explanation(source.operation, left, right, answer)} ${source.focus}`,
          };
        }),
      },
    ],
  });
  return {
    id:
      '70000000-0000-4000-8000-' +
      createHash('sha256').update(source.key).digest('hex').slice(0, 12),
    schoolLevel: `Primary ${source.grade}`,
    source,
    definition,
  };
}

// Source and compiled modules have the same depth; Docker retains backend/src with the catalogue.
export async function loadMathsCatalogue() {
  const sources = (
    await Promise.all(
      [1, 2, 3].map(async (grade) => {
        const content = await readFile(
          new URL(`../../src/db/content/primary-${grade}-maths.json`, import.meta.url),
          'utf8',
        );
        const extra = await readFile(
          new URL(`../../src/db/content/primary-${grade}-maths-extra.json`, import.meta.url),
          'utf8',
        );
        const parsed = [
          ...z.array(sourceSchema).length(20).parse(JSON.parse(content)),
          ...z.array(sourceSchema).length(12).parse(JSON.parse(extra)),
        ];
        if (parsed.some((source) => source.grade !== grade || !source.key.startsWith(`p${grade}-`)))
          throw new Error(`Incorrect grade in Primary ${grade} catalogue`);
        for (const [operation, expected] of [
          ['ADD', 13],
          ['SUBTRACT', 13],
          ['MULTIPLY', 3],
          ['DIVIDE', 3],
        ] as const)
          if (parsed.filter((source) => source.operation === operation).length !== expected)
            throw new Error(`Incorrect ${operation} count for Primary ${grade}`);
        return parsed;
      }),
    )
  ).flat();
  const catalogue = sources.map(buildLesson);
  for (const values of [
    catalogue.map((item) => item.id),
    sources.map((source) => source.key),
    catalogue.map((item) => item.definition.title),
  ])
    if (new Set(values).size !== values.length)
      throw new Error('Duplicate maths catalogue identity');
  return catalogue;
}
