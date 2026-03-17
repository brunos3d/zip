export interface Cell {
  x: number;
  y: number;
  number?: number;
  wall?: boolean;
}

export interface Point {
  x: number;
  y: number;
}

export type Difficulty = "easy" | "medium" | "hard" | "expert";

export interface GridConfig {
  cols: number;
  rows: number;
}

export const DIFFICULTY_CONFIG: Record<
  Difficulty,
  GridConfig & { checkpoints: [number, number]; hints: number }
> = {
  easy: { cols: 5, rows: 5, checkpoints: [3, 5], hints: 10 },
  medium: { cols: 7, rows: 7, checkpoints: [4, 7], hints: 14 },
  hard: { cols: 9, rows: 9, checkpoints: [6, 14], hints: 18 },
  expert: { cols: 12, rows: 12, checkpoints: [10, 32], hints: 24 },
};

/** Feedback for invalid number ordering during drag */
export interface InvalidMoveFeedback {
  /** Cell the player tried to connect to */
  targetCell: Point;
  /** The previous (higher) checkpoint cell that conflicts */
  conflictCell: Point;
  /** Timestamp to auto-clear */
  timestamp: number;
}

export interface GameState {
  grid: Cell[][];
  path: Point[];
  checkpoints: Map<number, Point>;
  /** The last checkpoint number reached on the current path */
  lastCheckpointNumber: number;
  solved: boolean;
  timer: number;
  difficulty: Difficulty;
  totalCells: number;
  maxNumber: number;
  hintsRemaining: number;
  moves: number;
  solutionPath: Point[];
  seed: string;
  invalidFeedback: InvalidMoveFeedback | null;
  revealingSolution: boolean;
  /** Edge walls between adjacent cells */
  edgeWalls: Set<string>;
}

export interface PuzzleData {
  grid: Cell[][];
  checkpoints: Map<number, Point>;
  solutionPath: Point[];
  maxNumber: number;
  totalCells: number;
  seed: string;
  /** Edge walls between adjacent cells */
  edgeWalls: Set<string>;
}

/** Parse a seed string like "easy-042" */
export function parseSeed(seedStr: string): {
  difficulty: Difficulty;
  number: number;
} {
  const [diff, numStr] = seedStr.split("-");
  return {
    difficulty: diff as Difficulty,
    number: parseInt(numStr, 10) || 1,
  };
}

/** Build a seed string */
export function buildSeed(difficulty: Difficulty, num: number): string {
  return `${difficulty}-${String(num).padStart(3, "0")}`;
}
