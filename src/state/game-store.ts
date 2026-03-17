import {
  type GameState,
  type InvalidMoveFeedback,
  Difficulty,
  Point,
  PuzzleData,
  DIFFICULTY_CONFIG,
} from "@/engine/types";

export type { GameState };
import { pointKey, pointEquals, isAdjacentPassable } from "@/engine/grid-utils";
import { getHint } from "@/engine/puzzle-solver";

export function createGameState(
  puzzle: PuzzleData,
  difficulty: Difficulty,
): GameState {
  return {
    grid: puzzle.grid,
    path: [],
    checkpoints: puzzle.checkpoints,
    lastCheckpointNumber: 0,
    solved: false,
    timer: 0,
    difficulty,
    totalCells: puzzle.totalCells,
    maxNumber: puzzle.maxNumber,
    hintsRemaining: DIFFICULTY_CONFIG[difficulty].hints,
    moves: 0,
    solutionPath: puzzle.solutionPath,
    seed: puzzle.seed,
    invalidFeedback: null,
    revealingSolution: false,
    edgeWalls: puzzle.edgeWalls,
  };
}

export interface GameUpdate {
  state: GameState;
  checkpointReached?: Point;
  puzzleSolved?: boolean;
  hintCell?: Point;
  pathChanged?: boolean;
  /** All checkpoints connected but unfilled cells remain */
  allCheckpointsReached?: Point[];
}

/**
 * Compute the lastCheckpointNumber by scanning the path from scratch.
 */
function computeLastCheckpoint(path: Point[], grid: Cell[][]): number {
  let last = 0;
  for (const p of path) {
    const n = grid[p.y][p.x].number;
    if (n !== undefined) last = n;
  }
  return last;
}

import { Cell } from "@/engine/types";

export function handleCellEnter(state: GameState, cell: Point): GameUpdate {
  const { path, grid, totalCells } = state;

  // Clear stale invalid feedback (auto-clear after 600ms)
  let cleanState = state;
  if (
    state.invalidFeedback &&
    Date.now() - state.invalidFeedback.timestamp > 600
  ) {
    cleanState = { ...state, invalidFeedback: null };
  }

  // Backtrack: if cell is the second-to-last in path, undo
  if (path.length >= 2) {
    const prevCell = path[path.length - 2];
    if (pointEquals(prevCell, cell)) {
      const newPath = path.slice(0, -1);
      return {
        state: {
          ...cleanState,
          path: newPath,
          lastCheckpointNumber: computeLastCheckpoint(newPath, grid),
          moves: cleanState.moves + 1,
          invalidFeedback: null,
        },
        pathChanged: true,
      };
    }
  }

  // Block forward movement while invalid feedback is active — only backtrack allowed
  if (cleanState.invalidFeedback) return { state: cleanState };

  // Block forward movement when last checkpoint reached but cells remain — only backtrack allowed
  if (
    cleanState.lastCheckpointNumber === cleanState.maxNumber &&
    !cleanState.solved
  ) {
    return { state: cleanState };
  }

  // Path must start from checkpoint 1
  if (path.length === 0) {
    const start = state.checkpoints.get(1);
    if (!start || !pointEquals(cell, start)) return { state: cleanState };
  }

  // Must be adjacent to last cell (and not blocked by edge wall)
  if (path.length > 0) {
    const last = path[path.length - 1];
    if (!isAdjacentPassable(last, cell, state.edgeWalls))
      return { state: cleanState };
  }

  // Can't revisit
  const pathSet = new Set(path.map(pointKey));
  if (pathSet.has(pointKey(cell))) return { state: cleanState };

  // Can't enter wall
  const gridCell = grid[cell.y][cell.x];
  if (gridCell.wall) return { state: cleanState };

  // Strictly-increasing number check
  if (gridCell.number !== undefined) {
    if (gridCell.number <= cleanState.lastCheckpointNumber) {
      // Invalid: number is not strictly greater than last checkpoint
      // Find the conflict cell (the one that had the higher/equal number)
      let conflictCell = cell;
      for (let i = path.length - 1; i >= 0; i--) {
        const n = grid[path[i].y][path[i].x].number;
        if (n !== undefined && n >= gridCell.number) {
          conflictCell = path[i];
          break;
        }
      }
      const feedback: InvalidMoveFeedback = {
        targetCell: cell,
        conflictCell,
        timestamp: Date.now(),
      };
      return {
        state: { ...cleanState, invalidFeedback: feedback },
      };
    }
  }

  const newPath = [...path, cell];
  const newLastCheckpoint =
    gridCell.number !== undefined
      ? gridCell.number
      : cleanState.lastCheckpointNumber;

  const newState: GameState = {
    ...cleanState,
    path: newPath,
    lastCheckpointNumber: newLastCheckpoint,
    moves: cleanState.moves + 1,
    invalidFeedback: null,
  };

  let checkpointReached: Point | undefined;
  let puzzleSolved = false;

  // Pulse the previous checkpoint when moving to the next cell after it
  if (path.length > 0) {
    const prevCell = path[path.length - 1];
    const prevGridCell = grid[prevCell.y][prevCell.x];
    if (prevGridCell.number !== undefined) {
      checkpointReached = prevCell;
    }
  }

  if (newPath.length === totalCells) {
    newState.solved = true;
    puzzleSolved = true;
  }

  // Detect: all checkpoints reached but cells remain unfilled
  let allCheckpointsReached: Point[] | undefined;
  if (
    !puzzleSolved &&
    newLastCheckpoint === state.maxNumber &&
    gridCell.number === state.maxNumber
  ) {
    // Collect unfilled non-wall cells not on the path
    const newPathSet = new Set(newPath.map(pointKey));
    const remaining: Point[] = [];
    for (let y = 0; y < grid.length; y++) {
      for (let x = 0; x < grid[0].length; x++) {
        if (!grid[y][x].wall && !newPathSet.has(pointKey({ x, y }))) {
          remaining.push({ x, y });
        }
      }
    }
    if (remaining.length > 0) {
      allCheckpointsReached = remaining;
    }
  }

  return {
    state: newState,
    checkpointReached,
    puzzleSolved,
    pathChanged: true,
    allCheckpointsReached,
  };
}

export function handleDragStart(state: GameState, cell: Point): GameUpdate {
  const { path, checkpoints, grid } = state;

  if (path.length === 0) {
    const start = checkpoints.get(1);
    if (!start || !pointEquals(cell, start)) return { state };

    const newPath = [cell];
    return {
      state: {
        ...state,
        path: newPath,
        lastCheckpointNumber: 1,
        moves: state.moves + 1,
        invalidFeedback: null,
      },
      pathChanged: true,
    };
  }

  // Resume dragging from last cell
  if (pointEquals(cell, path[path.length - 1])) {
    return { state };
  }

  // Truncate to clicked cell
  const idx = path.findIndex((p) => pointEquals(p, cell));
  if (idx >= 0) {
    const newPath = path.slice(0, idx + 1);
    return {
      state: {
        ...state,
        path: newPath,
        lastCheckpointNumber: computeLastCheckpoint(newPath, grid),
        moves: state.moves + 1,
        invalidFeedback: null,
      },
      pathChanged: true,
    };
  }

  // Extend from end
  if (
    path.length > 0 &&
    isAdjacentPassable(path[path.length - 1], cell, state.edgeWalls)
  ) {
    return handleCellEnter(state, cell);
  }

  return { state };
}

export function resetGame(state: GameState): GameState {
  return {
    ...state,
    path: [],
    lastCheckpointNumber: 0,
    solved: false,
    timer: 0,
    moves: 0,
    hintsRemaining: DIFFICULTY_CONFIG[state.difficulty].hints,
    invalidFeedback: null,
    revealingSolution: false,
  };
}

export function requestHint(state: GameState): GameUpdate {
  if (state.hintsRemaining <= 0 || state.solved) return { state };

  const hint = getHint(state.path, state.solutionPath);
  if (!hint) return { state };

  return {
    state: {
      ...state,
      hintsRemaining: state.hintsRemaining - 1,
    },
    hintCell: hint,
  };
}

export function revealSolution(state: GameState): GameState {
  return {
    ...state,
    revealingSolution: true,
    path: [],
    lastCheckpointNumber: 0,
  };
}

export function generateShareText(state: GameState): string {
  const { difficulty, moves, timer, solved, seed } = state;
  if (!solved) return "";

  const config = DIFFICULTY_CONFIG[difficulty];
  const minutes = Math.floor(timer / 60);
  const seconds = timer % 60;
  const timeStr = `${minutes}:${String(seconds).padStart(2, "0")}`;

  return `Zip ${config.cols}×${config.rows} — ${seed}\nMoves: ${moves} | Time: ${timeStr}`;
}

export function generateChallengeUrl(state: GameState): string {
  const params = new URLSearchParams({
    seed: state.seed,
  });
  if (state.solved) {
    params.set("time", String(state.timer));
  }
  return `?${params.toString()}`;
}
