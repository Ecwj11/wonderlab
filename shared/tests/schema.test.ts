import { describe, expect, it } from 'vitest';
import { lessonSchema, numberGameSchema, matchingSchema } from '../src/lesson-schema.js';
const lesson = {
  lessonSchemaVersion: 1,
  title: 'Fractions',
  subject: 'MATHEMATICS',
  language: 'English',
  objectives: ['Identify a quarter'],
  scenes: [
    {
      id: 'pizza',
      type: 'FRACTION_PIZZA',
      title: 'Slice a pizza',
      explanation: 'Equal parts of a whole.',
      instructions: 'Choose one of four equal slices.',
      parts: 4,
      target: 1,
    },
  ],
};
describe('Versioned lesson contract', () => {
  it('accepts safe structured fractions', () =>
    expect(lessonSchema.safeParse(lesson).success).toBe(true));
  it('rejects arbitrary generated code', () =>
    expect(
      lessonSchema.safeParse({
        ...lesson,
        scenes: [{ ...lesson.scenes[0], type: 'HTML', html: '<script>alert(1)</script>' }],
      }).success,
    ).toBe(false));
  it('rejects target bigger than the whole', () =>
    expect(
      lessonSchema.safeParse({ ...lesson, scenes: [{ ...lesson.scenes[0], target: 5 }] }).success,
    ).toBe(false));
  it('rejects duplicate scene IDs', () =>
    expect(
      lessonSchema.safeParse({ ...lesson, scenes: [lesson.scenes[0], lesson.scenes[0]] }).success,
    ).toBe(false));
  it('rejects unsupported schema versions', () =>
    expect(lessonSchema.safeParse({ ...lesson, lessonSchemaVersion: 2 }).success).toBe(false));
  it('rejects answer keys that do not match choices', () =>
    expect(
      lessonSchema.safeParse({
        ...lesson,
        scenes: [
          {
            id: 'quiz',
            type: 'QUIZ',
            title: 'Quiz',
            explanation: 'Review',
            questions: [
              {
                id: 'q1',
                prompt: 'Quarter?',
                options: [
                  { id: 'a', label: '1/4' },
                  { id: 'b', label: '1/2' },
                ],
                correctOptionId: 'c',
                explanation: 'One of four.',
              },
            ],
          },
        ],
      }).success,
    ).toBe(false));
});
it('rejects duplicate diagram part IDs', () => {
  const scene = {
    id: 'diagram',
    type: 'INTERACTIVE_DIAGRAM',
    diagram: 'HEART',
    title: 'Heart',
    explanation: 'Explore',
    parts: [
      { id: 'same', label: 'Left', description: 'Left part' },
      { id: 'same', label: 'Right', description: 'Right part' },
    ],
  };
  expect(lessonSchema.safeParse({ ...lesson, scenes: [scene] }).success).toBe(false);
});
it('rejects duplicate flashcard IDs', () => {
  const card = { id: 'same', front: 'What?', back: 'An answer' };
  expect(
    lessonSchema.safeParse({
      ...lesson,
      scenes: [
        {
          id: 'cards',
          type: 'FLASHCARD',
          title: 'Cards',
          explanation: 'Explore',
          cards: [card, card],
        },
      ],
    }).success,
  ).toBe(false);
});
describe('Playable game definitions', () => {
  const game = {
    id: 'blocks',
    type: 'NUMBER_GAME',
    title: 'Treasure blocks',
    explanation: 'Build each sum',
    rounds: [
      { id: 'r1', left: 2, right: 3, operation: 'ADD' },
      { id: 'r2', left: 7, right: 2, operation: 'SUBTRACT' },
    ],
  };
  it('accepts bounded addition and subtraction missions', () =>
    expect(numberGameSchema.safeParse(game).success).toBe(true));
  it('accepts value blocks for larger arithmetic and exact multiplication/division', () => {
    expect(
      numberGameSchema.safeParse({
        ...game,
        rounds: [
          { id: 'a', left: 250, right: 475, operation: 'ADD', blockMode: 'VALUES' },
          { id: 'b', left: 48, right: 6, operation: 'DIVIDE', blockMode: 'VALUES' },
          { id: 'c', left: 7, right: 8, operation: 'MULTIPLY', blockMode: 'VALUES' },
        ],
      }).success,
    ).toBe(true);
    for (const round of [
      { left: 7, right: 0, operation: 'DIVIDE' },
      { left: 7, right: 2, operation: 'DIVIDE' },
      { left: 9999, right: 9, operation: 'MULTIPLY' },
    ])
      expect(
        numberGameSchema.safeParse({
          ...game,
          rounds: [game.rounds[0], { id: 'v', blockMode: 'VALUES', ...round }],
        }).success,
      ).toBe(false);
  });
  it.each([
    [{ id: 'r1', left: 2, right: 3, operation: 'SUBTRACT' }, game.rounds[1]],
    [{ id: 'r1', left: 11, right: 2, operation: 'ADD' }, game.rounds[1]],
    [game.rounds[0], game.rounds[0]],
  ])('rejects impossible, oversized or duplicated missions', (rounds) =>
    expect(numberGameSchema.safeParse({ ...game, rounds }).success).toBe(false),
  );
  const pairs = [
    { id: 'p1', left: '2 + 3', right: '5' },
    { id: 'p2', left: '1 + 2', right: '3' },
  ];
  it('accepts safe semantic memory pairs', () =>
    expect(
      matchingSchema.safeParse({
        id: 'pairs',
        type: 'MATCHING',
        title: 'Match',
        explanation: 'Find pairs',
        pairs,
      }).success,
    ).toBe(true));
  it('allows a trusted adventure presentation without permitting arbitrary game code', () => {
    const scene = {
      id: 'pairs',
      type: 'MATCHING',
      title: 'Maths quest',
      explanation: 'Solve sums',
      pairs,
    };
    expect(matchingSchema.safeParse({ ...scene, gameStyle: 'ADVENTURE' }).success).toBe(true);
    expect(matchingSchema.safeParse({ ...scene, gameStyle: 'MEMORY' }).success).toBe(true);
    expect(matchingSchema.safeParse({ ...scene, gameStyle: '<script>' }).success).toBe(false);
  });
  it('rejects ambiguous matching faces and repeated identities', () => {
    for (const invalid of [
      [pairs[0], pairs[0]],
      [pairs[0], { ...pairs[1], right: '5' }],
    ])
      expect(
        matchingSchema.safeParse({
          id: 'pairs',
          type: 'MATCHING',
          title: 'Match',
          explanation: 'Find pairs',
          pairs: invalid,
        }).success,
      ).toBe(false);
  });
});
