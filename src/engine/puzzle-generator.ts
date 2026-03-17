import {
  Point,
  GridConfig,
  PuzzleData,
  Difficulty,
  DIFFICULTY_CONFIG,
  buildSeed,
} from "@/engine/types";
import {
  createEmptyGrid,
  getNeighbors,
  pointKey,
  edgeWallKey,
  shuffleArray,
  createRng,
  seedToNumber,
  dateSeed,
} from "@/engine/grid-utils";

/**
 * Generate a Hamiltonian path covering the entire grid using
 * Warnsdorff's heuristic with random tie-breaking.
 * Skips wall cells.
 */
function generateHamiltonianPath(
  config: GridConfig,
  rng: () => number,
  wallSet: Set<string>,
): Point[] | null {
  const totalTraversable = config.cols * config.rows - wallSet.size;
  const visited = new Set<string>();
  const path: Point[] = [];

  // Collect all non-wall cells as potential starts
  const starts: Point[] = [];
  for (let y = 0; y < config.rows; y++) {
    for (let x = 0; x < config.cols; x++) {
      if (!wallSet.has(pointKey({ x, y }))) {
        starts.push({ x, y });
      }
    }
  }
  const shuffledStarts = shuffleArray(starts, rng);

  for (const start of shuffledStarts.slice(
    0,
    Math.min(30, shuffledStarts.length),
  )) {
    visited.clear();
    path.length = 0;
    path.push(start);
    visited.add(pointKey(start));

    let current = start;
    let success = true;

    while (path.length < totalTraversable) {
      const neighbors = getNeighbors(current, config).filter(
        (n) => !visited.has(pointKey(n)) && !wallSet.has(pointKey(n)),
      );

      if (neighbors.length === 0) {
        success = false;
        break;
      }

      // Warnsdorff: pick neighbor with fewest onward moves
      const scored = neighbors.map((n) => ({
        point: n,
        degree: getNeighbors(n, config).filter(
          (nn) => !visited.has(pointKey(nn)) && !wallSet.has(pointKey(nn)),
        ).length,
      }));
      scored.sort((a, b) => a.degree - b.degree);

      const minDegree = scored[0].degree;
      const ties = scored.filter((s) => s.degree === minDegree);
      const chosen = ties[Math.floor(rng() * ties.length)].point;

      path.push(chosen);
      visited.add(pointKey(chosen));
      current = chosen;
    }

    if (success && path.length === totalTraversable) {
      return path;
    }
  }

  return null;
}

/**
 * Place checkpoint numbers along the Hamiltonian path.
 * Number count is based on difficulty config range [min, max].
 * Numbers are sequential: 1, 2, 3, ..., count — always linear and ordered.
 * Checkpoint 1 is always the start cell, checkpoint `count` is always the end.
 */
function placeCheckpoints(
  path: Point[],
  difficulty: Difficulty,
  rng: () => number,
): Map<number, Point> {
  const totalCells = path.length;
  const [minCp, maxCp] = DIFFICULTY_CONFIG[difficulty].checkpoints;

  // Pick a count in [min, max]
  const count = Math.min(
    maxCp,
    Math.max(minCp, minCp + Math.floor(rng() * (maxCp - minCp + 1))),
  );

  // Select path indices for the checkpoints (always includes first and last)
  const selectedIndices: number[] = [0]; // start

  if (count > 2) {
    const intermediateCount = count - 2;
    const spacing = (totalCells - 1) / (intermediateCount + 1);

    const picked: number[] = [];
    for (let i = 1; i <= intermediateCount; i++) {
      const ideal = Math.round(i * spacing);
      const jitter = Math.round((rng() - 0.5) * spacing * 0.4);
      const idx = Math.max(1, Math.min(totalCells - 2, ideal + jitter));
      picked.push(idx);
    }

    // Deduplicate and sort
    const unique = [...new Set(picked)].sort((a, b) => a - b);
    selectedIndices.push(...unique);
  }

  selectedIndices.push(totalCells - 1); // end

  // Assign sequential numbers 1, 2, 3, ... to the selected positions
  const checkpoints = new Map<number, Point>();
  for (let i = 0; i < selectedIndices.length; i++) {
    checkpoints.set(i + 1, path[selectedIndices[i]]);
  }

  return checkpoints;
}

/**
 * Generate a complete puzzle from a seed string.
 */
export function generatePuzzle(
  difficulty: Difficulty,
  seed: string,
): PuzzleData {
  const config = DIFFICULTY_CONFIG[difficulty];
  const numericSeed = seedToNumber(seed);
  const rng = createRng(numericSeed);

  // No walls for now (wall support ready but disabled for reliability)
  const wallSet = new Set<string>();
  const totalTraversable = config.cols * config.rows - wallSet.size;

  let path: Point[] | null = null;
  let attempts = 0;

  while (!path && attempts < 80) {
    path = generateHamiltonianPath(config, rng, wallSet);
    attempts++;
  }

  if (!path) {
    path = generateSnakePath(config);
  }

  const checkpoints = placeCheckpoints(path, difficulty, rng);
  const grid = createEmptyGrid(config);

  // Mark walls
  for (let y = 0; y < config.rows; y++) {
    for (let x = 0; x < config.cols; x++) {
      if (wallSet.has(pointKey({ x, y }))) {
        grid[y][x].wall = true;
      }
    }
  }

  // Place numbers on grid
  for (const [num, point] of checkpoints) {
    grid[point.y][point.x].number = num;
  }

  // Generate edge walls: collect path edges, then wall off some non-path edges
  const edgeWalls = generateEdgeWalls(path, config, difficulty, rng);

  return {
    grid,
    checkpoints,
    solutionPath: path,
    maxNumber: checkpoints.size,
    totalCells: totalTraversable,
    seed,
    edgeWalls,
  };
}

/** Wall density per difficulty — fraction of non-path edges to wall off */
const WALL_DENSITY: Record<Difficulty, number> = {
  easy: 0.15,
  medium: 0.2,
  hard: 0.25,
  expert: 0.3,
};

/**
 * Generate edge walls between adjacent cells.
 * Walls are placed on edges NOT used by the solution path.
 * This constrains alternate routes and helps ensure a unique solution.
 */
function generateEdgeWalls(
  path: Point[],
  config: GridConfig,
  difficulty: Difficulty,
  rng: () => number,
): Set<string> {
  // Collect all edges used by the solution path
  const pathEdges = new Set<string>();
  for (let i = 1; i < path.length; i++) {
    pathEdges.add(edgeWallKey(path[i - 1], path[i]));
  }

  // Collect all possible internal edges in the grid
  const nonPathEdges: string[] = [];
  for (let y = 0; y < config.rows; y++) {
    for (let x = 0; x < config.cols; x++) {
      const p: Point = { x, y };
      // Right neighbor
      if (x + 1 < config.cols) {
        const key = edgeWallKey(p, { x: x + 1, y });
        if (!pathEdges.has(key)) nonPathEdges.push(key);
      }
      // Down neighbor
      if (y + 1 < config.rows) {
        const key = edgeWallKey(p, { x, y: y + 1 });
        if (!pathEdges.has(key)) nonPathEdges.push(key);
      }
    }
  }

  // Shuffle and pick a fraction based on difficulty
  const shuffled = shuffleArray(nonPathEdges, rng);
  const count = Math.floor(shuffled.length * WALL_DENSITY[difficulty]);
  return new Set(shuffled.slice(0, count));
}

/**
 * Fallback: simple snake / boustrophedon path
 */
function generateSnakePath(config: GridConfig): Point[] {
  const path: Point[] = [];
  for (let y = 0; y < config.rows; y++) {
    if (y % 2 === 0) {
      for (let x = 0; x < config.cols; x++) {
        path.push({ x, y });
      }
    } else {
      for (let x = config.cols - 1; x >= 0; x--) {
        path.push({ x, y });
      }
    }
  }
  return path;
}

/**
 * Generate daily puzzle using today's date as seed basis.
 */
export function getDailyPuzzle(difficulty: Difficulty): PuzzleData {
  const dayNumber = dateSeed();
  const seed = buildSeed(difficulty, dayNumber);
  return generatePuzzle(difficulty, seed);
}

/**
 * Generate puzzle from a numeric seed (for "New Puzzle" button).
 */
export function getRandomPuzzle(difficulty: Difficulty): PuzzleData {
  const num = Math.floor(Math.random() * 999999) + 1;
  const seed = buildSeed(difficulty, num);
  return generatePuzzle(difficulty, seed);
}
