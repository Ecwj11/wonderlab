import { describe, expect, it } from 'vitest';
import * as adventure from '../src/lib/subject-adventure.js';

const pairs = [
  { id: 'root', left: 'Roots', right: 'Absorb water' },
  { id: 'leaf', left: 'Leaves', right: 'Use sunlight' },
];
const scene = { id: 'garden', pairs };

describe('Subject adventure missions', () => {
  it('can collect and solve all eight clues by walking and jumping the real level', () => {
    const many = Array.from({ length: 8 }, (_, index) => ({
      id: `mission-${index}`,
      left: `Clue ${index}`,
      right: `Meaning ${index}`,
    }));
    const level = adventure.createAdventureLevel({ id: 'eight-clues', pairs: many });
    let state = adventure.createAdventureState();
    const frames = (count: number, direction: -1 | 0 | 1, jump = false) => {
      for (let frame = 0; frame < count; frame++) {
        state = adventure.stepAdventure(state, { direction, jump }, 1 / 60, level);
        if (state.missionId)
          state = adventure.answerAdventureMission(state, state.missionId, state.missionId, level);
      }
    };
    frames(124, 1);
    frames(105, -1);
    frames(28, 1, true);
    frames(30, 0);
    frames(7, 1);
    frames(30, 1, true);
    frames(10, 1);
    frames(30, 0);
    frames(27, 1);
    expect(state.matchedIds).toHaveLength(8);
    expect(state.bridgeBuilt).toBe(true);
    expect(adventure.adventureResult(state, level)).toBeNull();
    frames(170, 1);
    expect(state.won).toBe(true);
    expect(adventure.adventureResult(state, level)).toEqual({
      matchedIds: many.map((pair) => pair.id),
    });
  });
  it('requires actual clue pickup before answering and stops at the discovered mission', () => {
    const level = adventure.createAdventureLevel(scene);
    let state = adventure.createAdventureState();
    expect(adventure.answerAdventureMission(state, 'root', 'root', level)).toBe(state);
    for (let frame = 0; frame < 60 && !state.missionId; frame++)
      state = adventure.stepAdventure(state, { direction: 1, jump: false }, 1 / 60, level);
    expect(state.missionId).toBe('root');
    expect(state.x).toBeGreaterThan(120);
    expect(state.matchedIds).toEqual([]);
    expect(adventure.stepAdventure(state, { direction: 1, jump: true }, 1 / 60, level)).toBe(state);
  });

  it('retries wrong meanings, requires every mission, and only wins on physical exit arrival', () => {
    const level = adventure.createAdventureLevel(scene);
    let state = adventure.createAdventureState();
    const walk = (frames: number, jump = false) => {
      for (let frame = 0; frame < frames; frame++)
        state = adventure.stepAdventure(state, { direction: 1, jump }, 1 / 60, level);
    };
    walk(30);
    const wrong = adventure.answerAdventureMission(state, 'root', 'leaf', level);
    expect(wrong.matchedIds).toEqual([]);
    expect(wrong.bridgeBuilt).toBe(false);
    expect(wrong.missionId).toBe('root');
    state = adventure.answerAdventureMission(wrong, 'root', 'root', level);
    expect(state.matchedIds).toEqual(['root']);
    expect(state.bridgeBuilt).toBe(false);
    walk(25, true);
    expect(state.missionId).toBe('leaf');
    state = adventure.answerAdventureMission(state, 'leaf', 'leaf', level);
    expect(state.bridgeBuilt).toBe(true);
    expect(state.won).toBe(false);
    expect(adventure.adventureResult(state, level)).toBeNull();
    walk(260);
    expect(state.won).toBe(true);
    expect(state.x).toBeGreaterThan(1400);
    expect(adventure.adventureResult(state, level)).toEqual({ matchedIds: ['root', 'leaf'] });
    expect(adventure.createAdventureState().matchedIds).toEqual([]);
    expect(adventure.createAdventureState().bridgeBuilt).toBe(false);
  });

  it('supports eight unique clues, meaningful choice order, and preserves solved missions after a fall', () => {
    const many = Array.from({ length: 8 }, (_, index) => ({
      id: `clue-${index}`,
      left: `Clue ${index}`,
      right: `Meaning ${index}`,
    }));
    const level = adventure.createAdventureLevel({ id: 'expedition', pairs: many });
    expect(new Set(level.blocks.map((block) => block.id)).size).toBe(8);
    const positions = many.map((pair) =>
      adventure.adventureChoices(pair.id, level).findIndex((choice) => choice.id === pair.id),
    );
    expect(new Set(positions).size).toBeGreaterThan(1);
    for (const pair of many) {
      const choices = adventure.adventureChoices(pair.id, level);
      expect(new Set(choices.map((choice) => choice.right)).size).toBe(choices.length);
      expect(choices.some((choice) => choice.id === pair.id)).toBe(true);
    }
    let state = adventure.createAdventureState();
    for (let frame = 0; frame < 30; frame++)
      state = adventure.stepAdventure(state, { direction: 1, jump: false }, 1 / 60, level);
    state = adventure.answerAdventureMission(state, 'clue-0', 'clue-0', level);
    for (let frame = 0; frame < 240; frame++) {
      state = adventure.stepAdventure(state, { direction: 1, jump: false }, 1 / 60, level);
      if (state.missionId)
        state = adventure.answerAdventureMission(state, state.missionId, state.missionId, level);
      if (state.falls) break;
    }
    expect(state.falls).toBe(1);
    expect(state.matchedIds).toContain('clue-0');
    expect(state.bridgeBuilt).toBe(false);
    expect(state.won).toBe(false);
  });
});
