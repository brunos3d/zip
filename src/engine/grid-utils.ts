import { Cell, Point, GridConfig } from "@/engine/types";

export function createEmptyGrid(config: GridConfig): Cell[][] {
  const grid: Cell[][] = [];
  for (let y = 0; y < config.rows; y++) {
    grid[y] = [];
    for (let x = 0; x < config.cols; x++) {
      grid[y][x] = { x, y };
    }
  }
  return grid;
}

export function isAdjacent(a: Point, b: Point): boolean {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y);
  return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}

export function pointEquals(a: Point, b: Point): boolean {
  return a.x === b.x && a.y === b.y;
}

export function pointKey(p: Point): string {
  return `${p.x},${p.y}`;
}

/** Canonical key for an edge wall between two adjacent cells */
export function edgeWallKey(a: Point, b: Point): string {
  const ka = pointKey(a);
  const kb = pointKey(b);
  return ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
}

/** Check if two cells are adjacent AND not separated by an edge wall */
export function isAdjacentPassable(
  a: Point,
  b: Point,
  edgeWalls?: Set<string>,
): boolean {
  if (!isAdjacent(a, b)) return false;
  if (edgeWalls && edgeWalls.has(edgeWallKey(a, b))) return false;
  return true;
}

export function isInBounds(p: Point, config: GridConfig): boolean {
  return p.x >= 0 && p.x < config.cols && p.y >= 0 && p.y < config.rows;
}

/**
 * Get traversable neighbors of a point, respecting walls and grid bounds.
 */
export function getNeighbors(
  p: Point,
  config: GridConfig,
  grid?: Cell[][],
  edgeWalls?: Set<string>,
): Point[] {
  const dirs: Point[] = [
    { x: 0, y: -1 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
  ];
  return dirs
    .map((d) => ({ x: p.x + d.x, y: p.y + d.y }))
    .filter((n) => {
      if (!isInBounds(n, config)) return false;
      if (grid && grid[n.y][n.x].wall) return false;
      if (edgeWalls && edgeWalls.has(edgeWallKey(p, n))) return false;
      return true;
    });
}

export function shuffleArray<T>(arr: T[], rng: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Seeded PRNG (mulberry32) */
export function createRng(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Convert a string seed like "easy-042" to a numeric hash */
export function seedToNumber(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    hash = ((hash << 5) - hash + ch) | 0;
  }
  return Math.abs(hash);
}

export function dateSeed(date: Date = new Date()): number {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  return y * 10000 + m * 100 + d;
}
