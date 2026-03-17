import {
  Point,
  Cell,
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
import { solve } from "@/engine/puzzle-solver";

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

  // Only add edge walls if the puzzle has multiple solutions without them
  const edgeWalls = generateEdgeWallsIfNeeded(
    path,
    grid,
    config,
    difficulty,
    rng,
  );

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

/**
 * Check if a puzzle is uniquely solvable, and if not, add edge walls
 * incrementally until it becomes unique (or we run out of candidates).
 */
function generateEdgeWallsIfNeeded(
  path: Point[],
  grid: Cell[][],
  config: GridConfig,
  difficulty: Difficulty,
  rng: () => number,
): Set<string> {
  const totalCells = config.cols * config.rows;
  // Budget: short time limits and capped iterations to avoid freezing
  const solveTime = totalCells <= 49 ? 300 : 150;
  const maxAddAttempts = Math.min(totalCells, 40);
  const maxPruneAttempts = 20;

  // First: check if already unique without any walls
  const noWalls = new Set<string>();
  const result = solve(
    grid,
    config,
    { maxSolutions: 2, timeLimit: solveTime },
    noWalls,
  );
  if (result.isUnique) {
    return noWalls; // No walls needed
  }

  // Collect all non-path edges as wall candidates
  const pathEdges = new Set<string>();
  for (let i = 1; i < path.length; i++) {
    pathEdges.add(edgeWallKey(path[i - 1], path[i]));
  }

  const candidates: string[] = [];
  for (let y = 0; y < config.rows; y++) {
    for (let x = 0; x < config.cols; x++) {
      const p: Point = { x, y };
      if (x + 1 < config.cols) {
        const key = edgeWallKey(p, { x: x + 1, y });
        if (!pathEdges.has(key)) candidates.push(key);
      }
      if (y + 1 < config.rows) {
        const key = edgeWallKey(p, { x, y: y + 1 });
        if (!pathEdges.has(key)) candidates.push(key);
      }
    }
  }

  const shuffled = shuffleArray(candidates, rng);
  const edgeWalls = new Set<string>();

  // Add walls one at a time until the puzzle is unique (capped)
  let added = 0;
  for (const wall of shuffled) {
    if (added >= maxAddAttempts) break;
    edgeWalls.add(wall);
    added++;
    const check = solve(
      grid,
      config,
      { maxSolutions: 2, timeLimit: solveTime },
      edgeWalls,
    );
    if (check.isUnique) {
      break;
    }
  }

  // Pruning pass: try removing each wall — keep only those truly needed (capped)
  const wallList = shuffleArray([...edgeWalls], rng);
  let pruned = 0;
  for (const wall of wallList) {
    if (pruned >= maxPruneAttempts) break;
    edgeWalls.delete(wall);
    pruned++;
    const check = solve(
      grid,
      config,
      { maxSolutions: 2, timeLimit: solveTime },
      edgeWalls,
    );
    if (!check.isUnique) {
      edgeWalls.add(wall); // wall is essential, keep it
    }
  }

  return edgeWalls;
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
