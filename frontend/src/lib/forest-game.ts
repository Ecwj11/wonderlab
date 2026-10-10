import { numberRoundAnswer, type PublicScene } from '@wonderlab/shared';

export type ForestRound = Extract<PublicScene, { type: 'NUMBER_GAME' }>['rounds'][number];
export type ForestRect = { x: number; y: number; width: number; height: number };
export type ForestBlock = {
  id: string;
  x: number;
  y: number;
  color: 'blue' | 'gold';
  value: number;
};
export type ForestLevel = {
  width: number;
  height: number;
  platforms: ForestRect[];
  blocks: ForestBlock[];
  bridge: { x: number; y: number; width: number };
  doorX: number;
  target: number;
  round: ForestRound;
};
export type ForestState = {
  x: number;
  y: number;
  vy: number;
  onGround: boolean;
  facing: 1 | -1;
  collected: string[];
  removed: number;
  bridgeBuilt: boolean;
  won: boolean;
  jumpHeld: boolean;
  falls: number;
  moving: boolean;
  walkDistance: number;
};
export type ForestInput = { direction: -1 | 0 | 1; jump: boolean };
export const FOREST_PLAYER = { width: 48, height: 64 } as const;

// Hold each view still. Hysteresis prevents small reversals from flipping sections.
export function forestCamera(
  previous: number,
  playerX: number,
  worldWidth: number,
  viewWidth: number,
) {
  const maximum = Math.max(0, worldWidth - viewWidth);
  const current = Math.max(0, Math.min(previous, maximum));
  if (!maximum) return 0;
  const center = playerX + FOREST_PLAYER.width / 2;
  const step = viewWidth * 0.65;
  if (center < current || center > current + viewWidth)
    return Math.max(
      0,
      Math.min(maximum, Math.floor(Math.max(0, center - viewWidth * 0.2) / step) * step),
    );
  if (center > current + viewWidth * 0.85) return Math.min(maximum, current + step);
  if (center < current + viewWidth * 0.1) return Math.max(0, current - step);
  return current;
}

// A trusted level supports every bounded schema-v1 operand without AI-authored geometry.
const locations = [
  [195, 480],
  [290, 375],
  [360, 375],
  [480, 295],
  [550, 295],
  [600, 295],
  [435, 480],
  [710, 375],
  [770, 480],
  [145, 480],
] as const;
export function createForestLevel(round: ForestRound): ForestLevel {
  const chunks = (value: number) =>
    value === 0
      ? [0]
      : String(value)
          .split('')
          .map((digit, index, digits) => Number(digit) * 10 ** (digits.length - index - 1))
          .filter(Boolean);
  const values = round.blockMode === 'VALUES';
  const blocks: Pick<ForestBlock, 'color' | 'value'>[] = values
    ? [
        ...chunks(round.left).map((value) => ({ color: 'blue' as const, value })),
        ...chunks(round.right).map((value) => ({ color: 'gold' as const, value })),
      ]
    : [
        ...Array.from({ length: round.left }, () => ({ color: 'blue' as const, value: 1 })),
        ...(round.operation === 'ADD'
          ? Array.from({ length: round.right }, () => ({ color: 'gold' as const, value: 1 }))
          : []),
      ];
  return {
    width: 1600,
    height: 640,
    round,
    platforms: [
      { x: 0, y: 520, width: 820, height: 120 },
      { x: 250, y: 410, width: 160, height: 55 },
      { x: 450, y: 330, width: 175, height: 55 },
      { x: 675, y: 410, width: 145, height: 55 },
      { x: 1140, y: 520, width: 460, height: 120 },
    ],
    blocks: blocks.map((block, index) => {
      const [x, y] = locations[index % locations.length];
      return {
        id: round.id + '-block-' + index,
        x: x + (blocks.length > 10 ? (index < 10 ? -18 : 18) : 0),
        y,
        ...block,
      };
    }),
    bridge: { x: 820, y: 520, width: 320 },
    doorX: 1450,
    target: numberRoundAnswer(round),
  };
}
export function createForestState(): ForestState {
  return {
    x: 80,
    y: 456,
    vy: 0,
    onGround: true,
    facing: 1,
    collected: [],
    removed: 0,
    bridgeBuilt: false,
    won: false,
    jumpHeld: false,
    falls: 0,
    moving: false,
    walkDistance: 0,
  };
}
const allCollected = (state: ForestState, level: ForestLevel) =>
  state.collected.length === level.blocks.length &&
  new Set(state.collected).size === level.blocks.length &&
  level.blocks.every((block) => state.collected.includes(block.id));
export function buildForestBridge(
  state: ForestState,
  value: number,
  level: ForestLevel,
): ForestState {
  if (
    state.won ||
    state.bridgeBuilt ||
    !allCollected(state, level) ||
    value !== level.target ||
    (level.round.operation === 'SUBTRACT' &&
      level.round.blockMode !== 'VALUES' &&
      state.removed !== level.round.right)
  )
    return state;
  return { ...state, bridgeBuilt: true };
}
export function takeForestBlock(state: ForestState, level: ForestLevel): ForestState {
  if (
    state.won ||
    state.bridgeBuilt ||
    level.round.operation !== 'SUBTRACT' ||
    level.round.blockMode === 'VALUES' ||
    !allCollected(state, level) ||
    state.removed >= level.round.right
  )
    return state;
  return { ...state, removed: state.removed + 1 };
}
export function stepForest(
  state: ForestState,
  input: ForestInput,
  seconds: number,
  level: ForestLevel,
): ForestState {
  if (state.won || !Number.isFinite(seconds) || seconds <= 0) return state;
  const dt = Math.min(seconds, 1 / 30);
  let vy = state.vy;
  if (input.jump && !state.jumpHeld && state.onGround) vy = -740;
  vy += 1900 * dt;
  const x = Math.max(
    0,
    Math.min(level.width - FOREST_PLAYER.width, state.x + input.direction * 330 * dt),
  );
  let y = state.y + vy * dt;
  let onGround = false;
  const surfaces = state.bridgeBuilt
    ? [...level.platforms, { ...level.bridge, height: 24 }]
    : level.platforms;
  if (vy >= 0) {
    for (const surface of surfaces) {
      if (
        x + FOREST_PLAYER.width > surface.x &&
        x < surface.x + surface.width &&
        state.y + FOREST_PLAYER.height <= surface.y + 0.5 &&
        y + FOREST_PLAYER.height >= surface.y
      ) {
        y = surface.y - FOREST_PLAYER.height;
        vy = 0;
        onGround = true;
      }
    }
  }
  if (y > level.height + 100) {
    return {
      ...createForestState(),
      collected: state.collected,
      removed: state.removed,
      bridgeBuilt: state.bridgeBuilt,
      jumpHeld: input.jump,
      falls: state.falls + 1,
    };
  }
  const collected = [...state.collected];
  for (const block of level.blocks) {
    if (
      !collected.includes(block.id) &&
      x < block.x + 17 &&
      x + FOREST_PLAYER.width > block.x - 17 &&
      y < block.y + 17 &&
      y + FOREST_PLAYER.height > block.y - 17
    )
      collected.push(block.id);
  }
  const won =
    state.bridgeBuilt &&
    allCollected({ ...state, collected }, level) &&
    x + FOREST_PLAYER.width >= level.doorX &&
    x <= level.doorX + 100 &&
    onGround &&
    y + FOREST_PLAYER.height >= 500;
  return {
    ...state,
    x,
    y,
    vy,
    onGround,
    collected,
    won,
    facing: input.direction || state.facing,
    jumpHeld: input.jump,
    moving: Math.abs(x - state.x) > 0.001,
    walkDistance: state.walkDistance + (state.onGround && onGround ? Math.abs(x - state.x) : 0),
  };
}
