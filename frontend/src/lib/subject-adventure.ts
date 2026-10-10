import type { PublicScene } from '@wonderlab/shared';
import {
  buildForestBridge,
  createForestLevel,
  createForestState,
  stepForest,
  type ForestInput,
  type ForestLevel,
  type ForestState,
} from './forest-game';

type MatchingScene = Extract<PublicScene, { type: 'MATCHING' }>;
export type AdventurePair = MatchingScene['pairs'][number];
export type AdventureLevel = ForestLevel & { pairs: AdventurePair[] };
export type AdventureState = ForestState & { matchedIds: string[]; missionId: string | null };

export function createAdventureLevel(scene: Pick<MatchingScene, 'id' | 'pairs'>): AdventureLevel {
  return {
    ...createForestLevel({ id: scene.id, left: scene.pairs.length, right: 0, operation: 'ADD' }),
    pairs: scene.pairs,
  };
}

export function createAdventureState(): AdventureState {
  return { ...createForestState(), matchedIds: [], missionId: null };
}

export function stepAdventure(
  state: AdventureState,
  input: ForestInput,
  seconds: number,
  level: AdventureLevel,
): AdventureState {
  if (state.missionId || state.won) return state;
  const next = stepForest(state, input, seconds, level);
  const discovered = level.blocks.findIndex(
    (block, index) =>
      next.collected.includes(block.id) && !state.matchedIds.includes(level.pairs[index].id),
  );
  return {
    ...next,
    matchedIds: state.matchedIds,
    missionId: discovered < 0 ? null : level.pairs[discovered].id,
  };
}

export function answerAdventureMission(
  state: AdventureState,
  pairId: string,
  choiceId: string,
  level: AdventureLevel,
): AdventureState {
  const index = level.pairs.findIndex((pair) => pair.id === pairId);
  if (
    state.won ||
    state.missionId !== pairId ||
    index < 0 ||
    choiceId !== pairId ||
    state.matchedIds.includes(pairId) ||
    !state.collected.includes(level.blocks[index].id)
  )
    return state;
  const next = {
    ...state,
    missionId: null,
    matchedIds: [...state.matchedIds, pairId],
    jumpHeld: false,
  };
  if (next.matchedIds.length !== level.pairs.length) return next;
  return { ...next, ...buildForestBridge(next, level.target, level) };
}

// Stable rotation spreads the correct answer across positions, with distinct semantic alternatives.
export function adventureChoices(pairId: string, level: AdventureLevel): AdventurePair[] {
  const index = level.pairs.findIndex((pair) => pair.id === pairId);
  if (index < 0) return [];
  const choices = [level.pairs[index], ...level.pairs.filter((pair) => pair.id !== pairId)].slice(
    0,
    4,
  );
  const offset = (index + 1) % choices.length;
  return [...choices.slice(offset), ...choices.slice(0, offset)];
}

export function adventureResult(state: AdventureState, level: AdventureLevel) {
  return state.won &&
    state.bridgeBuilt &&
    level.pairs.every((pair) => state.matchedIds.includes(pair.id))
    ? { matchedIds: level.pairs.map((pair) => pair.id) }
    : null;
}
