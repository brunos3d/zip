"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import { Difficulty, Point, parseSeed } from "@/engine/types";
import {
  generatePuzzle,
  getDailyPuzzle,
  getRandomPuzzle,
} from "@/engine/puzzle-generator";
import {
  createGameState,
  handleCellEnter,
  handleDragStart,
  resetGame,
  requestHint,
  revealSolution,
  generateShareText,
  generateChallengeUrl,
  GameState,
} from "@/state/game-store";
import GameCanvas from "@/components/game-canvas";
import TopBar from "@/components/top-bar";
import Controls from "@/components/controls";

function initFromUrl(): { difficulty: Difficulty; state: GameState } | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const seedParam = params.get("seed");
  if (!seedParam) return null;
  try {
    const { difficulty } = parseSeed(seedParam);
    const puzzle = generatePuzzle(difficulty, seedParam);
    return { difficulty, state: createGameState(puzzle, difficulty) };
  } catch {
    return null;
  }
}

export default function ZipGame() {
  const [difficulty, setDifficulty] = useState<Difficulty>(() => {
    const fromUrl = initFromUrl();
    return fromUrl ? fromUrl.difficulty : "easy";
  });
  const [gameState, setGameState] = useState<GameState>(() => {
    const fromUrl = initFromUrl();
    if (fromUrl) return fromUrl.state;
    const puzzle = getDailyPuzzle("easy");
    return createGameState(puzzle, "easy");
  });
  const [checkpointReached, setCheckpointReached] = useState<Point | null>(
    null,
  );
  const [puzzleSolvedAnim, setPuzzleSolvedAnim] = useState(false);
  const [hintCell, setHintCell] = useState<Point | null>(null);
  const [remainingCellsPing, setRemainingCellsPing] = useState<Point[] | null>(
    null,
  );
  const [shareTooltip, setShareTooltip] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasWrapperRef = useRef<HTMLDivElement>(null);
  const [canvasVisible, setCanvasVisible] = useState(false);

  // Detect when the GameCanvas wrapper is fully visible
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

  // Timer: starts when canvas is visible, stops when solved/revealing
  useEffect(() => {
    if (gameState.solved || gameState.revealingSolution) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    if (canvasVisible && !timerRef.current) {
      timerRef.current = setInterval(() => {
        setGameState((prev) => ({ ...prev, timer: prev.timer + 1 }));
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [canvasVisible, gameState.solved, gameState.revealingSolution]);

  const handleCellEnterCb = useCallback(
    (cell: Point) => {
      if (gameState.solved || gameState.revealingSolution) return;
      setGameState((prev) => {
        const update = handleCellEnter(prev, cell);
        if (update.checkpointReached) {
          setCheckpointReached({ ...update.checkpointReached });
        }
        if (update.puzzleSolved) {
          setPuzzleSolvedAnim(true);
        }
        if (update.allCheckpointsReached) {
          setRemainingCellsPing([...update.allCheckpointsReached]);
        }
        return update.state;
      });
    },
    [gameState.solved, gameState.revealingSolution],
  );

  const handleDragStartCb = useCallback(
    (cell: Point) => {
      if (gameState.solved || gameState.revealingSolution) return;
      setGameState((prev) => {
        const update = handleDragStart(prev, cell);
        if (update.checkpointReached) {
          setCheckpointReached({ ...update.checkpointReached });
        }
        if (update.puzzleSolved) {
          setPuzzleSolvedAnim(true);
        }
        if (update.allCheckpointsReached) {
          setRemainingCellsPing([...update.allCheckpointsReached]);
        }
        return update.state;
      });
    },
    [gameState.solved, gameState.revealingSolution],
  );

  const handleDragEndCb = useCallback(() => {}, []);

  const handleLongPressCb = useCallback(() => {
    if (gameState.solved || gameState.hintsRemaining <= 0) return;
    setGameState((prev) => {
      const update = requestHint(prev);
      if (update.hintCell) {
        setHintCell({ ...update.hintCell });
      }
      return update.state;
    });
  }, [gameState.solved, gameState.hintsRemaining]);

  const handleReset = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setPuzzleSolvedAnim(false);
    setCheckpointReached(null);
    setHintCell(null);
    setGameState((prev) => resetGame(prev));
  }, []);

  const handleNewPuzzle = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setPuzzleSolvedAnim(false);
    setCheckpointReached(null);
    setHintCell(null);
    const puzzle = getRandomPuzzle(difficulty);
    setGameState(createGameState(puzzle, difficulty));
  }, [difficulty]);

  const handleDifficultyChange = useCallback((d: Difficulty) => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setDifficulty(d);
    setPuzzleSolvedAnim(false);
    setCheckpointReached(null);
    setHintCell(null);
    const puzzle = getDailyPuzzle(d);
    setGameState(createGameState(puzzle, d));
  }, []);

  const handleHint = useCallback(() => {
    setGameState((prev) => {
      const update = requestHint(prev);
      if (update.hintCell) {
        setHintCell({ ...update.hintCell });
      }
      return update.state;
    });
  }, []);

  const handleRevealSolution = useCallback(() => {
    setGameState((prev) => revealSolution(prev));
  }, []);

  const handleShare = useCallback(() => {
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
    const relUrl = generateChallengeUrl(gameState);
    const fullUrl = `${window.location.origin}${window.location.pathname}${relUrl}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(fullUrl).then(() => {
        setShareTooltip("Link copied!");
        setTimeout(() => setShareTooltip(null), 2000);
      });
    }
  }, [gameState]);

  // Reveal solution animation: step through solution path
  const revealActive = gameState.revealingSolution;
  const pathLen = gameState.path.length;
  const solutionLen = gameState.solutionPath.length;

  useEffect(() => {
    if (!revealActive || pathLen >= solutionLen) return;

    const timer = setTimeout(() => {
      setGameState((prev) => {
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

  // Derive completion anim for reveal
  const showRevealComplete = gameState.solved && gameState.revealingSolution;
  useEffect(() => {
    if (showRevealComplete && !puzzleSolvedAnim) {
      // Use requestAnimationFrame to avoid synchronous setState in effect
      const raf = requestAnimationFrame(() => setPuzzleSolvedAnim(true));
      return () => cancelAnimationFrame(raf);
    }
  }, [showRevealComplete, puzzleSolvedAnim]);

  return (
    <div className="flex flex-col items-center min-h-dvh bg-[#F8F9FA] select-none">
      <TopBar
        timer={gameState.timer}
        moves={gameState.moves}
        difficulty={difficulty}
        seed={gameState.seed}
        onReset={handleReset}
        onNewPuzzle={handleNewPuzzle}
      />

      <Controls
        difficulty={difficulty}
        onDifficultyChange={handleDifficultyChange}
        onHint={handleHint}
        onShare={handleShare}
        onRevealSolution={handleRevealSolution}
        onShareChallenge={handleShareChallenge}
        hintsRemaining={gameState.hintsRemaining}
        solved={gameState.solved}
        revealingSolution={gameState.revealingSolution}
        shareTooltip={shareTooltip}
      />

      {/* Progress indicator */}
      <div className="w-full max-w-150 mx-auto px-4 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${(gameState.path.length / gameState.totalCells) * 100}%`,
              }}
            />
          </div>
          <span className="text-xs text-gray-400 font-mono tabular-nums min-w-16 text-right">
            {gameState.path.length}/{gameState.totalCells}
          </span>
        </div>
      </div>

      {/* Completion banner */}
      {gameState.solved && (
        <div className="w-full max-w-150 mx-auto px-4 pb-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
            <p className="text-emerald-800 font-semibold text-lg">
              Puzzle Complete!
            </p>
            <p className="text-emerald-600 text-sm mt-0.5">
              {gameState.revealingSolution
                ? "Solution revealed"
                : `Solved in ${gameState.moves} moves`}
            </p>
          </div>
        </div>
      )}

      <div ref={canvasWrapperRef} className="flex-1 flex w-full">
        <GameCanvas
          gameState={gameState}
          onCellEnter={handleCellEnterCb}
          onDragStart={handleDragStartCb}
          onDragEnd={handleDragEndCb}
          onLongPress={handleLongPressCb}
          checkpointReached={checkpointReached}
          puzzleSolved={puzzleSolvedAnim}
          hintCell={hintCell}
          remainingCellsPing={remainingCellsPing}
        />
      </div>
    </div>
  );
}
