import { describe, expect, it } from 'vitest';

import * as engine from '../src/lib/forest-game.js';
const round = { id: 'addition', left: 3, right: 2, operation: 'ADD' as const };

describe('Number Forest platform gameplay', () => {
  it('represents large operands as bounded labelled place-value blocks for all four operations', () => {
    for (const operation of ['ADD', 'SUBTRACT', 'MULTIPLY', 'DIVIDE'] as const) {
      const level = engine.createForestLevel({
        id: 'value',
        left: 1234,
        right: 2,
        operation,
        blockMode: 'VALUES',
      });
      expect(level.blocks).toHaveLength(5);
      expect(
        level.blocks
          .filter((block) => block.color === 'blue')
          .reduce((sum, block) => sum + block.value, 0),
      ).toBe(1234);
      expect(
        level.blocks
          .filter((block) => block.color === 'gold')
          .reduce((sum, block) => sum + block.value, 0),
      ).toBe(2);
      const collected = {
        ...engine.createForestState(),
        collected: level.blocks.map((block) => block.id),
      };
      const expected =
        operation === 'ADD'
          ? 1236
          : operation === 'SUBTRACT'
            ? 1232
            : operation === 'MULTIPLY'
              ? 2468
              : 617;
      expect(level.target).toBe(expected);
      expect(engine.buildForestBridge(collected, expected + 1, level).bridgeBuilt).toBe(false);
      expect(engine.buildForestBridge(collected, expected, level).bridgeBuilt).toBe(true);
      expect(engine.takeForestBlock(collected, level).removed).toBe(0);
    }
  });
  it('keeps the camera stationary inside a section and only changes at its edges', () => {
    expect(engine.forestCamera(0, 250, 1600, 500)).toBe(0);
    const next = engine.forestCamera(0, 440, 1600, 500);
    expect(next).toBeGreaterThan(0);
    expect(engine.forestCamera(next, 430, 1600, 500)).toBe(next);
    expect(engine.forestCamera(next, 500, 1600, 500)).toBe(next);
    expect(engine.forestCamera(next, 80, 1600, 500)).toBe(0);
    expect(engine.forestCamera(100, 1400, 1600, 1600)).toBe(0);
  });
  it('advances footsteps only for actual grounded movement, stopping at rest and in the air', () => {
    const level = engine.createForestLevel(round);
    const start = engine.createForestState();
    const walking = engine.stepForest(start, { direction: 1, jump: false }, 1 / 30, level);
    expect(walking.walkDistance).toBeGreaterThan(0);
    expect(walking.moving).toBe(true);
    const idle = engine.stepForest(walking, { direction: 0, jump: false }, 1 / 30, level);
    expect(idle.walkDistance).toBe(walking.walkDistance);
    expect(idle.moving).toBe(false);
    const airborne = engine.stepForest(idle, { direction: 1, jump: true }, 1 / 30, level);
    expect(airborne.walkDistance).toBe(idle.walkDistance);
    expect(airborne.moving).toBe(true);
    const boundary = engine.stepForest(
      { ...start, x: 0 },
      { direction: -1, jump: false },
      1 / 30,
      level,
    );
    expect(boundary.moving).toBe(false);
    expect(boundary.walkDistance).toBe(0);
  });
  it('moves on solid ground and starts a jump only once while a key is held', () => {
    const level = engine.createForestLevel(round);
    const start = engine.createForestState();
    const walking = engine.stepForest(start, { direction: 1, jump: false }, 1 / 30, level);
    expect(walking.x).toBeGreaterThan(start.x);
    expect(walking.onGround).toBe(true);
    const jumping = engine.stepForest(walking, { direction: 0, jump: true }, 1 / 30, level);
    expect(jumping.y).toBeLessThan(walking.y);
    expect(jumping.onGround).toBe(false);
    const held = engine.stepForest(jumping, { direction: 0, jump: true }, 1 / 30, level);
    expect(held.vy).toBeGreaterThan(jumping.vy);
  });
  it('collects only blocks touched by the explorer', () => {
    const level = engine.createForestLevel(round);
    const start = engine.createForestState();
    expect(
      engine.stepForest(start, { direction: 0, jump: false }, 1 / 60, level).collected,
    ).toEqual([]);
    const block = level.blocks[0];
    const touched = engine.stepForest(
      { ...start, x: block.x - 15, y: block.y - 40 },
      { direction: 0, jump: false },
      1 / 60,
      level,
    );
    expect(touched.collected).toContain(block.id);
    expect(touched.collected.length).toBeLessThan(level.blocks.length);
  });
  it('keeps the river closed for missing blocks and wrong answers', () => {
    const level = engine.createForestLevel(round);
    const start = engine.createForestState();
    expect(engine.buildForestBridge(start, 5, level).bridgeBuilt).toBe(false);
    const collected = { ...start, collected: level.blocks.map((block) => block.id) };
    expect(engine.buildForestBridge(collected, 4, level).bridgeBuilt).toBe(false);
    expect(engine.buildForestBridge(collected, 5, level).bridgeBuilt).toBe(true);
  });
  it('requires the built bridge and physical arrival at the exit to win', () => {
    const level = engine.createForestLevel(round);
    const start = {
      ...engine.createForestState(),
      collected: level.blocks.map((block) => block.id),
    };
    const built = engine.buildForestBridge(start, 5, level);
    expect(built.won).toBe(false);
    expect(
      engine.stepForest({ ...start, x: level.doorX }, { direction: 0, jump: false }, 1 / 60, level)
        .won,
    ).toBe(false);
    expect(
      engine.stepForest({ ...built, x: level.doorX }, { direction: 0, jump: false }, 1 / 60, level)
        .won,
    ).toBe(true);
    expect(
      engine.stepForest(
        { ...built, x: level.doorX, y: 20, onGround: false },
        { direction: 0, jump: false },
        1 / 60,
        level,
      ).won,
    ).toBe(false);
  });
  it('returns a falling explorer to camp while preserving earned collections', () => {
    const level = engine.createForestLevel(round);
    const start = engine.createForestState();
    const rescued = engine.stepForest(
      { ...start, x: 950, y: 900, collected: [level.blocks[0].id] },
      { direction: 0, jump: false },
      1 / 60,
      level,
    );
    expect(rescued.x).toBe(start.x);
    expect(rescued.y).toBe(start.y);
    expect(rescued.collected).toEqual([level.blocks[0].id]);
    expect(rescued.falls).toBe(1);
  });
  it.each([
    { id: 'empty', left: 0, right: 0, operation: 'ADD' as const },
    { id: 'maximum', left: 10, right: 10, operation: 'ADD' as const },
    { id: 'takeaway', left: 10, right: 10, operation: 'SUBTRACT' as const },
  ])('every block and exit is reachable using real movement: $id', (round) => {
    const level = engine.createForestLevel(round);
    let state = engine.createForestState();
    const moveTo = (x: number, jump = false) => {
      const direction = x > state.x ? 1 : -1;
      state = engine.stepForest(state, { direction, jump }, 1 / 120, level);
      for (let i = 0; i < 500 && Math.abs(x - state.x) > 3; i++)
        state = engine.stepForest(state, { direction, jump: false }, 1 / 120, level);
      expect(Math.abs(x - state.x)).toBeLessThanOrEqual(3);
    };
    const settle = () => {
      for (let i = 0; i < 120; i++)
        state = engine.stepForest(state, { direction: 0, jump: false }, 1 / 120, level);
    };
    // Collect ground blocks, climb each ledge, then cross only the answered bridge.
    moveTo(790);
    moveTo(205);
    moveTo(310, true);
    settle();
    expect(state.y).toBe(410 - engine.FOREST_PLAYER.height);
    moveTo(380);
    moveTo(495, true);
    settle();
    expect(state.y).toBe(330 - engine.FOREST_PLAYER.height);
    moveTo(610);
    moveTo(725);
    settle();
    expect(new Set(state.collected).size).toBe(level.blocks.length);
    for (let i = 0; i < round.right; i++) state = engine.takeForestBlock(state, level);
    state = engine.buildForestBridge(state, level.target, level);
    expect(state.bridgeBuilt).toBe(true);
    for (let i = 0; i < 400 && !state.won; i++)
      state = engine.stepForest(state, { direction: 1, jump: false }, 1 / 120, level);
    expect(state.won).toBe(true);
    expect(state.falls).toBe(0);
  });
  it('subtraction requires the exact takeaway count, including a zero result', () => {
    const level = engine.createForestLevel({
      id: 'zero',
      left: 4,
      right: 4,
      operation: 'SUBTRACT',
    });
    let state = { ...engine.createForestState(), collected: level.blocks.map((block) => block.id) };
    expect(engine.buildForestBridge(state, 0, level).bridgeBuilt).toBe(false);
    for (let i = 0; i < 4; i++) state = engine.takeForestBlock(state, level);
    expect(engine.takeForestBlock(state, level).removed).toBe(4);
    expect(engine.buildForestBridge(state, 0, level).bridgeBuilt).toBe(true);
  });
});
