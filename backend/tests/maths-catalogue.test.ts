import { describe, expect, it } from 'vitest';
import { lessonSchema, publicDefinition, numberRoundAnswer } from '@wonderlab/shared';
import { loadMathsCatalogue, calculateAnswer } from '../src/db/maths-catalogue.js';

describe('Primary 1–3 curated maths games', () => {
  it('contains 96 unique games with more addition and subtraction at each grade', async () => {
    const catalogue = await loadMathsCatalogue();
    expect(catalogue).toHaveLength(96);
    expect(new Set(catalogue.map((item) => item.id)).size).toBe(96);
    expect(new Set(catalogue.map((item) => item.definition.title)).size).toBe(96);
    for (const grade of [1, 2, 3]) {
      const games = catalogue.filter((item) => item.source.grade === grade);
      expect(games).toHaveLength(32);
      for (const [operation, count] of [
        ['ADD', 13],
        ['SUBTRACT', 13],
        ['MULTIPLY', 3],
        ['DIVIDE', 3],
      ])
        expect(games.filter((item) => item.source.operation === operation)).toHaveLength(count);
    }
  });

  it('publishes unambiguous playable missions and independently checked quiz answers', async () => {
    for (const item of await loadMathsCatalogue()) {
      const valid = lessonSchema.parse(item.definition);
      const game = valid.scenes[0];
      const quiz = valid.scenes[1];
      expect(game.type).toBe('NUMBER_GAME');
      expect(quiz.type).toBe('QUIZ');
      if (game.type !== 'NUMBER_GAME' || quiz.type !== 'QUIZ') throw new Error('Missing game/quiz');
      expect(game.rounds).toHaveLength(4);
      expect(quiz.questions).toHaveLength(3);
      const independent = (left: number, right: number) => {
        switch (item.source.operation) {
          case 'ADD':
            return left + right;
          case 'SUBTRACT':
            return left - right;
          case 'MULTIPLY':
            return left * right;
          case 'DIVIDE':
            return left / right;
        }
      };
      for (const [i, mission] of item.source.missions.entries())
        expect(numberRoundAnswer(game.rounds[i])).toBe(independent(mission.left, mission.right));
      for (const [i, question] of quiz.questions.entries()) {
        const operands = item.source.quiz[i];
        const correct = question.options.find((option) => option.id === question.correctOptionId)!;
        expect(Number(correct.label)).toBe(independent(operands.left, operands.right));
        expect(new Set(question.options.map((option) => option.label)).size).toBe(4);
        expect(question.explanation).toContain(String(independent(operands.left, operands.right)));
      }
      const publicQuiz = publicDefinition(valid).scenes[1];
      expect(JSON.stringify(publicQuiz)).not.toContain('correctOptionId');
    }
  });

  it('adds 36 fresh Primary 1–3 games with distinct missions and grade-appropriate arithmetic', async () => {
    const catalogue = await loadMathsCatalogue();
    const extra = catalogue.filter((item) => item.source.key.includes('-extra-'));
    expect(extra).toHaveLength(36);
    const signatures = catalogue.map((item) =>
      JSON.stringify([item.source.grade, item.source.operation, item.source.missions]),
    );
    expect(new Set(signatures).size).toBe(catalogue.length);
    for (const item of extra) {
      const { grade, operation, missions, quiz } = item.source;
      const limit = { 1: 100, 2: 1000, 3: 10000 }[grade];
      expect(
        new Set(missions.map(({ left, right }) => calculateAnswer(operation, left, right))).size,
      ).toBe(4);
      for (const { left, right } of [...missions, ...quiz]) {
        expect(Math.max(left, right, calculateAnswer(operation, left, right))).toBeLessThanOrEqual(
          limit,
        );
        if (operation === 'DIVIDE') expect(left % right).toBe(0);
      }
    }
  });

  it('rejects arithmetic that cannot be represented as nonnegative whole-number practice', () => {
    expect(() => calculateAnswer('DIVIDE', 6, 0)).toThrow();
    expect(() => calculateAnswer('DIVIDE', 7, 2)).toThrow();
    expect(() => calculateAnswer('SUBTRACT', 2, 4)).toThrow();
    expect(() => calculateAnswer('ADD', -1, 4)).toThrow();
  });
});
