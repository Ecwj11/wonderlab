import { describe, expect, it } from 'vitest';
import { APPROACH, isWorldEntity, walkable, worldPath } from '../src/lib/story-world';

describe('school garden navigation', () => {
  it('routes every story target around school, pond, and garden walls', () => {
    for (const target of Object.values(APPROACH)) {
      expect(walkable(target)).toBe(true);
      const path = worldPath({ x: -1, z: 1.2 }, target);
      expect(path.length).toBeGreaterThan(0);
      expect(path.at(-1)).toEqual(target);
      for (let i = 0; i < path.length; i++) {
        expect(walkable(path[i])).toBe(true);
        if (i)
          for (let t = 0; t <= 1; t += 0.1) {
            expect(
              walkable({
                x: path[i - 1].x * (1 - t) + path[i].x * t,
                z: path[i - 1].z * (1 - t) + path[i].z * t,
              }),
            ).toBe(true);
          }
      }
    }
  });
  it('keeps blocked clicks out of water and buildings', () => {
    for (const target of [
      { x: 3, z: -2 },
      { x: -3, z: -2 },
      { x: 3, z: 2 },
    ]) {
      expect(walkable(target)).toBe(false);
      expect(worldPath({ x: -1, z: 1.2 }, target).every(walkable)).toBe(true);
    }
    expect(isWorldEntity('GARDEN')).toBe(true);
    expect(isWorldEntity('constructor')).toBe(false);
  });
});
