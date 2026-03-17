"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { useRouter } from "next/navigation";
import {
  Difficulty,
  Point,
  parseSeed,
  DIFFICULTY_CONFIG,
} from "@/engine/types";
import { generatePuzzle } from "@/engine/puzzle-generator";
import {
  createGameState,
  handleCellEnter as applyEnter,
  handleDragStart as applyDragStart,
  resetGame,
  requestHint as applyHint,
  revealSolution as applyReveal,
  generateShareText,
  GameState,
} from "@/state/game-store";
import { dateSeed } from "@/engine/grid-utils";

const VALID_DIFFICULTIES = new Set<string>(Object.keys(DIFFICULTY_CONFIG));
function isValidDifficulty(d: string): d is Difficulty {
  return VALID_DIFFICULTIES.has(d);
}

interface GameContextValue {
  // Core state
  difficulty: Difficulty;
  gameState: GameState | null;
  generating: boolean;

  // UI animation state
  checkpointReached: Point | null;
  puzzleSolvedAnim: boolean;
  hintCell: Point | null;
  remainingCellsPing: Point[] | null;
  shareTooltip: string | null;

  // Actions
  handleCellEnter: (cell: Point) => void;
  handleDragStart: (cell: Point) => void;
  handleDragEnd: () => void;
  handleLongPress: (cell: Point) => void;
  handleReset: () => void;
  handleNewPuzzle: () => void;
  handleDifficultyChange: (d: Difficulty) => void;
  handleHint: () => void;
  handleRevealSolution: () => void;
  handleShare: () => void;
  handleShareChallenge: () => void;

  // Canvas refs
  canvasWrapperRef: React.RefObject<HTMLDivElement | null>;
}

const GameContext = createContext<GameContextValue | null>(null);

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
}

interface GameProviderProps {
  difficulty: string;
  seed: string;
  children: React.ReactNode;
}

export function GameProvider({
  difficulty: diffProp,
  seed: seedProp,
  children,
}: GameProviderProps) {
  const router = useRouter();
  const diff: Difficulty = isValidDifficulty(diffProp) ? diffProp : "easy";

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [readySeed, setReadySeed] = useState<string | null>(null);
  const generating = readySeed !== seedProp;
  const [checkpointReached, setCheckpointReached] = useState<Point | null>(
    null,
  );
  const [puzzleSolvedAnim, setPuzzleSolvedAnim] = useState(false);
  const [hintCell, setHintCell] = useState<Point | null>(null);
  const [remainingCellsPing, setRemainingCellsPing] = useState<Point[] | null>(
    null,
  );
  const [shareTooltip, setShareTooltip] = useState<string | null>(null);
  const [canvasVisible, setCanvasVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);

  // Detect canvas visibility
  useEffect(() => {
    const el = canvasWrapperRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setCanvasVisible(entry.isIntersecting),
      { threshold: 1.0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Generate puzzle from props (deferred so loading animation paints first)
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const timer = setTimeout(() => {
      setPuzzleSolvedAnim(false);
      setCheckpointReached(null);
      setHintCell(null);
      const puzzle = generatePuzzle(diff, seedProp);
      setGameState(createGameState(puzzle, diff));
      setReadySeed(seedProp);
    }, 50);
    return () => clearTimeout(timer);
  }, [diff, seedProp]);

  // Timer
  const hasGameState = gameState != null;
  const solved = gameState?.solved ?? false;
  const revealingSolution = gameState?.revealingSolution ?? false;

  useEffect(() => {
    if (!hasGameState || solved || revealingSolution) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    if (canvasVisible && !timerRef.current) {
      timerRef.current = setInterval(() => {
        setGameState((prev) =>
          prev ? { ...prev, timer: prev.timer + 1 } : prev,
        );
      }, 1000);
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [canvasVisible, hasGameState, solved, revealingSolution]);

  // Reveal animation
  const revealActive = gameState?.revealingSolution ?? false;
  const pathLen = gameState?.path.length ?? 0;
  const solutionLen = gameState?.solutionPath.length ?? 0;

  useEffect(() => {
    if (!revealActive || pathLen >= solutionLen) return;
    const timer = setTimeout(() => {
      setGameState((prev) => {
        if (!prev) return prev;
        const nextIdx = prev.path.length;
        if (nextIdx >= prev.solutionPath.length) return prev;
        const nextCell = prev.solutionPath[nextIdx];
        const gridCell = prev.grid[nextCell.y][nextCell.x];
        const newPath = [...prev.path, nextCell];
        const lastCp =
          gridCell.number !== undefined
            ? gridCell.number
            : prev.lastCheckpointNumber;
        return {
          ...prev,
          path: newPath,
          lastCheckpointNumber: lastCp,
          solved: newPath.length === prev.totalCells,
        };
      });
    }, 80);
    return () => clearTimeout(timer);
  }, [revealActive, pathLen, solutionLen]);

  // Completion anim for reveal
  const showRevealComplete =
    (gameState?.solved && gameState?.revealingSolution) ?? false;
  useEffect(() => {
    if (showRevealComplete && !puzzleSolvedAnim) {
      const raf = requestAnimationFrame(() => setPuzzleSolvedAnim(true));
      return () => cancelAnimationFrame(raf);
    }
  }, [showRevealComplete, puzzleSolvedAnim]);

  // ─── Actions ───

  const handleCellEnter = useCallback((cell: Point) => {
    setGameState((prev) => {
      if (!prev || prev.solved || prev.revealingSolution) return prev;
      const update = applyEnter(prev, cell);
      if (update.checkpointReached)
        setCheckpointReached({ ...update.checkpointReached });
      if (update.puzzleSolved) setPuzzleSolvedAnim(true);
      if (update.allCheckpointsReached)
        setRemainingCellsPing([...update.allCheckpointsReached]);
      return update.state;
    });
  }, []);

  const handleDragStart = useCallback((cell: Point) => {
    setGameState((prev) => {
      if (!prev || prev.solved || prev.revealingSolution) return prev;
      const update = applyDragStart(prev, cell);
      if (update.checkpointReached)
        setCheckpointReached({ ...update.checkpointReached });
      if (update.puzzleSolved) setPuzzleSolvedAnim(true);
      if (update.allCheckpointsReached)
        setRemainingCellsPing([...update.allCheckpointsReached]);
      return update.state;
    });
  }, []);

  const handleDragEnd = useCallback(() => {}, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleLongPress = useCallback((_cell: Point) => {
    setGameState((prev) => {
      if (!prev || prev.solved || prev.hintsRemaining <= 0) return prev;
      const update = applyHint(prev);
      if (update.hintCell) setHintCell({ ...update.hintCell });
      return update.state;
    });
  }, []);

  const handleReset = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setPuzzleSolvedAnim(false);
    setCheckpointReached(null);
    setHintCell(null);
    setGameState((prev) => (prev ? resetGame(prev) : prev));
    if (canvasVisible) {
      timerRef.current = setInterval(() => {
        setGameState((prev) =>
          prev ? { ...prev, timer: prev.timer + 1 } : prev,
        );
      }, 1000);
    }
  }, [canvasVisible]);

  const handleNewPuzzle = useCallback(() => {
    const num = Math.floor(Math.random() * 999999) + 1;
    router.push(`/${diff}/${num}`);
  }, [diff, router]);

  const handleDifficultyChange = useCallback(
    (d: Difficulty) => {
      router.push(`/${d}/${dateSeed()}`);
    },
    [router],
  );

  const handleHint = useCallback(() => {
    setGameState((prev) => {
      if (!prev) return prev;
      const update = applyHint(prev);
      if (update.hintCell) setHintCell({ ...update.hintCell });
      return update.state;
    });
  }, []);

  const handleRevealSolution = useCallback(() => {
    setGameState((prev) => (prev ? applyReveal(prev) : prev));
  }, []);

  const handleShare = useCallback(() => {
    if (!gameState) return;
    const text = generateShareText(gameState);
    if (!text) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setShareTooltip("Copied!");
        setTimeout(() => setShareTooltip(null), 2000);
      });
    }
  }, [gameState]);

  const handleShareChallenge = useCallback(() => {
    if (!gameState) return;
    const { number: seedNum } = parseSeed(gameState.seed);
    const fullUrl = `${window.location.origin}/${diff}/${seedNum}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullUrl).then(() => {
        setShareTooltip("Link copied!");
        setTimeout(() => setShareTooltip(null), 2000);
      });
    }
  }, [gameState, diff]);

  const value: GameContextValue = {
    difficulty: diff,
    gameState,
    generating,
    checkpointReached,
    puzzleSolvedAnim,
    hintCell,
    remainingCellsPing,
    shareTooltip,
    handleCellEnter,
    handleDragStart,
    handleDragEnd,
    handleLongPress,
    handleReset,
    handleNewPuzzle,
    handleDifficultyChange,
    handleHint,
    handleRevealSolution,
    handleShare,
    handleShareChallenge,
    canvasWrapperRef,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}
