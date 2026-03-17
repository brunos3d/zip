"use client";

import React from "react";
import { useGame } from "@/state/game-context";
import GameCanvas from "@/components/game-canvas";
import TopBar from "@/components/top-bar";
import Controls from "@/components/controls";
import PuzzleLoading from "@/components/puzzle-loading";

export default function ZipGame() {
  const {
    difficulty,
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
  } = useGame();

  return (
    <div className="flex flex-col items-center min-h-dvh bg-[#F8F9FA] select-none">
      <TopBar
        timer={gameState?.timer ?? 0}
        moves={gameState?.moves ?? 0}
        difficulty={difficulty}
        seed={gameState?.seed ?? ""}
        onShareChallenge={handleShareChallenge}
        shareTooltip={shareTooltip}
      />

      <Controls
        difficulty={difficulty}
        onDifficultyChange={handleDifficultyChange}
        onHint={handleHint}
        onReset={handleReset}
        onNewPuzzle={handleNewPuzzle}
        onRevealSolution={handleRevealSolution}
        hintsRemaining={gameState?.hintsRemaining ?? 0}
        solved={gameState?.solved ?? false}
        revealingSolution={gameState?.revealingSolution ?? false}
      />

      {/* Progress indicator */}
      <div className="w-full max-w-150 mx-auto px-4 pb-4">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all duration-300 ease-out"
              style={{
                width: `${gameState ? (gameState.path.length / gameState.totalCells) * 100 : 0}%`,
              }}
            />
          </div>
          <span className="text-xs text-gray-400 font-mono tabular-nums min-w-16 text-right">
            {gameState?.path.length ?? 0}/{gameState?.totalCells ?? 0}
          </span>
        </div>
      </div>

      {/* Completion banner */}
      {gameState?.solved && (
        <div className="w-full max-w-150 mx-auto px-4 pb-4">
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-center">
            <p className="text-emerald-800 font-semibold text-lg">
              Puzzle Complete!
            </p>
            <p className="text-emerald-600 text-sm mt-0.5">
              {gameState?.revealingSolution
                ? "Solution revealed"
                : `Solved in ${gameState?.moves ?? 0} moves`}
            </p>
          </div>
        </div>
      )}

      {(!gameState || generating) && <PuzzleLoading />}

      <div
        ref={canvasWrapperRef}
        className={`flex-1 flex w-full${!gameState || generating ? " hidden" : ""}`}
      >
        {gameState && (
          <GameCanvas
            gameState={gameState}
            onCellEnter={handleCellEnter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onLongPress={handleLongPress}
            checkpointReached={checkpointReached}
            puzzleSolved={puzzleSolvedAnim}
            hintCell={hintCell}
            remainingCellsPing={remainingCellsPing}
          />
        )}
      </div>

      {/* Footer */}
      <footer className="w-full py-4 px-4 text-center text-xs text-gray-400 space-y-1">
        <p>
          Created with <span className="text-red-400">❤️</span> by{" "}
          <a
            href="https://brunosilva.io"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-600 transition-colors"
          >
            Bruno Silva
          </a>
        </p>
        <p>
          <a
            href="https://github.com/brunos3d/zip"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 underline hover:text-gray-600 transition-colors"
          >
            ⭐ Star on GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}
