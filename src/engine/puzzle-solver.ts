import { Point, Cell, GridConfig } from "@/engine/types";
import { getNeighbors, pointKey, pointEquals } from "@/engine/grid-utils";

interface SolverOptions {
  maxSolutions?: number;
  timeLimit?: number;
}

interface SolverResult {
  solutions: Point[][];
  isUnique: boolean;
  explored: number;
}

/**
 * Backtracking solver that respects strictly-increasing numbered-cell ordering.
 *
 * Rule: as we walk the path, any numbered cell we step on must have a number
 * strictly greater than the number of the *previous* numbered cell we stepped on.
 * The path must also visit numbered cells in increasing order (we can't skip a
 * lower number and hit a higher one first).
 */
export function solve(
  grid: Cell[][],
  config: GridConfig,
  options: SolverOptions = {},
  edgeWalls?: Set<string>,
): SolverResult {
  const { maxSolutions = 1, timeLimit = 5000 } = options;
  const startTime = Date.now();

  // Count traversable (non-wall) cells
  let totalTraversable = 0;
  const sortedCheckpoints: { number: number; point: Point }[] = [];

  for (let y = 0; y < config.rows; y++) {
    for (let x = 0; x < config.cols; x++) {
      const cell = grid[y][x];
      if (cell.wall) continue;
      totalTraversable++;
      if (cell.number !== undefined) {
        sortedCheckpoints.push({ number: cell.number, point: { x, y } });
      }
    }
  }

  sortedCheckpoints.sort((a, b) => a.number - b.number);

  // Must start at cell numbered 1
  const startCp = sortedCheckpoints.find((c) => c.number === 1);
  if (!startCp) return { solutions: [], isUnique: false, explored: 0 };

  const solutions: Point[][] = [];
  let explored = 0;
  const visited = new Set<string>();
  const path: Point[] = [];

  /** BFS connectivity check: all unvisited non-wall cells reachable from current */
  function checkConnectivity(current: Point): boolean {
    const unvisitedCount = totalTraversable - visited.size;
    if (unvisitedCount === 0) return true;

    const reachable = new Set<string>();
    const queue: Point[] = [];

    for (const n of getNeighbors(current, config, grid, edgeWalls)) {
      const k = pointKey(n);
      if (!visited.has(k)) {
        reachable.add(k);
        queue.push(n);
      }
    }

    while (queue.length > 0) {
      const p = queue.shift()!;
      for (const n of getNeighbors(p, config, grid, edgeWalls)) {
        const k = pointKey(n);
        if (!visited.has(k) && !reachable.has(k)) {
          reachable.add(k);
          queue.push(n);
        }
      }
    }

    return reachable.size === unvisitedCount;
  }

  function backtrack(
    current: Point,
    lastNumber: number,
    cpIdx: number,
  ): boolean {
    if (Date.now() - startTime > timeLimit) return true;

    explored++;
    path.push(current);
    visited.add(pointKey(current));

    const cell = grid[current.y][current.x];
    const curNumber = cell.number;
    let newLastNumber = lastNumber;
    let newCpIdx = cpIdx;

    if (curNumber !== undefined) {
      newLastNumber = curNumber;
      newCpIdx =
        cpIdx +
        (cpIdx < sortedCheckpoints.length &&
        sortedCheckpoints[cpIdx].number === curNumber
          ? 1
          : 0);
    }

    if (path.length === totalTraversable) {
      // All checkpoints must have been visited
      if (newCpIdx === sortedCheckpoints.length) {
        solutions.push([...path]);
      }
      path.pop();
      visited.delete(pointKey(current));
      return solutions.length >= maxSolutions;
    }

    // Connectivity pruning
    if (path.length < totalTraversable - 1 && !checkConnectivity(current)) {
      path.pop();
      visited.delete(pointKey(current));
      return false;
    }

    // Get unvisited non-wall neighbors
    let neighbors = getNeighbors(current, config, grid, edgeWalls).filter(
      (n) => !visited.has(pointKey(n)),
    );

    // Warnsdorff ordering
    neighbors.sort((a, b) => {
      const da = getNeighbors(a, config, grid, edgeWalls).filter(
        (n) => !visited.has(pointKey(n)),
      ).length;
      const db = getNeighbors(b, config, grid, edgeWalls).filter(
        (n) => !visited.has(pointKey(n)),
      ).length;
      return da - db;
    });

    for (const neighbor of neighbors) {
      const nCell = grid[neighbor.y][neighbor.x];
      if (nCell.number !== undefined) {
        // Strictly increasing: must be > lastNumber encountered
        if (nCell.number <= newLastNumber) continue;
        // Must be the next expected checkpoint in order
        if (
          newCpIdx < sortedCheckpoints.length &&
          nCell.number !== sortedCheckpoints[newCpIdx].number
        ) {
          continue;
        }
      } else {
        // Non-numbered cell: check we don't skip over a required checkpoint
        // If the next checkpoint must appear at a certain path position, ensure it's still reachable
      }

      if (backtrack(neighbor, newLastNumber, newCpIdx)) {
        path.pop();
        visited.delete(pointKey(current));
        return true;
      }
    }

    path.pop();
    visited.delete(pointKey(current));
    return false;
  }

  backtrack(startCp.point, 0, 0);

  return {
    solutions,
    isUnique: solutions.length === 1,
    explored,
  };
}

/**
 * Get a hint: return the next cell in the solution path after the current path.
 */
export function getHint(
  currentPath: Point[],
  solutionPath: Point[],
): Point | null {
  if (currentPath.length >= solutionPath.length) return null;
  return solutionPath[currentPath.length];
}

/**
 * Validate if a user path is correct (matches solution up to current length).
 */
export function validatePartialPath(
  userPath: Point[],
  solutionPath: Point[],
): boolean {
  for (let i = 0; i < userPath.length; i++) {
    if (!pointEquals(userPath[i], solutionPath[i])) return false;
  }
  return true;
}
