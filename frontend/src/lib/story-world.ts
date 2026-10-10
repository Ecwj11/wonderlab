export type WorldPoint = { x: number; z: number };
export const WORLD_ENTITIES = {
  XIAOYU: { label: '小雨', x: -1, z: 1.2, y: 2 },
  AMIN: { label: '阿明', x: -3.4, z: 1.1, y: 2 },
  TEACHER: { label: '老师', x: -0.5, z: -0.8, y: 2.2 },
  GARDEN: { label: '小花园', x: 3.2, z: 2, y: 1.2 },
  POND: { label: '池塘', x: 3.5, z: -2, y: 0.7 },
  CLASSROOM: { label: '教室', x: -2.7, z: -2, y: 3.2 },
  SEEDS: { label: '种子', x: 1.6, z: 3.7, y: 0.8 },
  WATERING_CAN: { label: '水壶', x: 4.7, z: 0.2, y: 0.9 },
  BOOK: { label: '故事书', x: -2.5, z: -0.1, y: 0.8 },
  BALL: { label: '皮球', x: -4, z: 2.8, y: 0.7 },
  SHOVEL: { label: '小铲子', x: 0.8, z: 3.1, y: 1.1 },
  SUN: { label: '太阳', x: -4.7, z: -2.9, y: 5.3 },
} as const;
export type WorldEntity = keyof typeof WORLD_ENTITIES;
export const APPROACH: Record<WorldEntity, WorldPoint> = {
  XIAOYU: { x: -1, z: 1.2 },
  AMIN: { x: -2.7, z: 1.1 },
  TEACHER: { x: -0.1, z: 0 },
  GARDEN: { x: 0.9, z: 1.8 },
  POND: { x: 3.5, z: -0.4 },
  CLASSROOM: { x: -2.7, z: 0.4 },
  SEEDS: { x: 1.6, z: 3.9 },
  WATERING_CAN: { x: 4.7, z: 0.4 },
  BOOK: { x: -2.5, z: 0.4 },
  BALL: { x: -3.5, z: 2.8 },
  SHOVEL: { x: 0.5, z: 3.1 },
  SUN: { x: -5.3, z: -0.2 },
};
export function isWorldEntity(id: string): id is WorldEntity {
  return Object.prototype.hasOwnProperty.call(WORLD_ENTITIES, id);
}
export function walkable(p: WorldPoint): boolean {
  if (p.x < -5.8 || p.x > 5.8 || p.z < -3.8 || p.z > 3.95) return false;
  return ![
    [-4.9, -0.7, -3.8, -0.55], // school walls
    [1.9, 5.1, -3.5, -0.8], // pond bank
    [1.3, 5.3, 0.8, 3.45], // fenced planting beds
  ].some(
    ([left, right, back, front]) => p.x >= left && p.x <= right && p.z >= back && p.z <= front,
  );
}
/** Four-way routing keeps every segment on walkable ground, including tight corners. */
export function worldPath(from: WorldPoint, to: WorldPoint): WorldPoint[] {
  const nodes: WorldPoint[] = [];
  for (let x = -5.5; x <= 5.5; x += 0.5)
    for (let z = -3.5; z <= 3.5; z += 0.5) {
      if (walkable({ x, z })) nodes.push({ x, z });
    }
  const distance = (a: WorldPoint, b: WorldPoint) => Math.hypot(a.x - b.x, a.z - b.z);
  const clear = (a: WorldPoint, b: WorldPoint) => {
    for (let i = 0; i <= 10; i++) {
      const t = i / 10;
      if (!walkable({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })) return false;
    }
    return true;
  };
  const nearest = (point: WorldPoint) => {
    const reachable = walkable(point) ? nodes.filter((node) => clear(point, node)) : nodes;
    return (reachable.length ? reachable : nodes).reduce((a, b) =>
      distance(a, point) < distance(b, point) ? a : b,
    );
  };
  const start = nearest(from),
    end = nearest(to);
  const key = (point: WorldPoint) => `${point.x},${point.z}`;
  const grid = new Map(nodes.map((point) => [key(point), point]));
  const parent = new Map<string, string | null>([[key(start), null]]),
    queue = [start];
  for (let i = 0; i < queue.length && !parent.has(key(end)); i++) {
    const p = queue[i];
    for (const [dx, dz] of [
      [0.5, 0],
      [-0.5, 0],
      [0, 0.5],
      [0, -0.5],
    ]) {
      const next = grid.get(key({ x: p.x + dx, z: p.z + dz }));
      if (next && !parent.has(key(next))) {
        parent.set(key(next), key(p));
        queue.push(next);
      }
    }
  }
  if (!parent.has(key(end))) return [];
  const path: WorldPoint[] = [];
  for (let cursor: string | null = key(end); cursor; cursor = parent.get(cursor) ?? null)
    path.unshift(grid.get(cursor)!);
  if (clear(end, to) && distance(end, to) < 0.7) path.push(to);
  return path;
}
