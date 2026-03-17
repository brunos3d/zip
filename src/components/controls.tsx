"use client";

import React from "react";
import { Difficulty } from "@/engine/types";

interface ControlsProps {
  difficulty: Difficulty;
  onDifficultyChange: (d: Difficulty) => void;
  onHint: () => void;
  onReset: () => void;
  onNewPuzzle: () => void;
  onRevealSolution: () => void;
  hintsRemaining: number;
  solved: boolean;
  revealingSolution: boolean;
}

const DIFFICULTIES: { key: Difficulty; label: string }[] = [
  { key: "easy", label: "Easy" },
  { key: "medium", label: "Medium" },
  { key: "hard", label: "Hard" },
  { key: "expert", label: "Expert" },
];

export default function Controls({
  difficulty,
  onDifficultyChange,
  onHint,
  onReset,
  onNewPuzzle,
  onRevealSolution,
  hintsRemaining,
  solved,
  revealingSolution,
}: ControlsProps) {
  return (
    <div className="w-full max-w-150 mx-auto flex flex-col items-center gap-4 px-4 py-3">
      {/* Difficulty selector */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
        {DIFFICULTIES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => onDifficultyChange(key)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              difficulty === key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 flex-wrap justify-center">
        <button
          onClick={onHint}
          disabled={hintsRemaining <= 0 || solved || revealingSolution}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Hint ({hintsRemaining})
        </button>

        <button
          onClick={onRevealSolution}
          disabled={solved || revealingSolution}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 transition-colors text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Reveal
        </button>

        <button
          onClick={onReset}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-50 text-green-700 hover:bg-green-100 transition-colors text-sm font-medium"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M4 4v5h5" />
            <path d="M20 20v-5h-5" />
            <path d="M4 9a9 9 0 0 1 15.28-4.28L20 4" />
            <path d="M20 15a9 9 0 0 1-15.28 4.28L4 20" />
          </svg>
          Restart
        </button>

        <button
          onClick={onNewPuzzle}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors text-sm font-medium"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
          New Puzzle
        </button>
      </div>
    </div>
  );
}
