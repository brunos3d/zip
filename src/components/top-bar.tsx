"use client";

import React from "react";
import { DIFFICULTY_CONFIG } from "@/engine/types";

interface TopBarProps {
  timer: number;
  moves: number;
  difficulty: string;
  seed: string;
  onReset: () => void;
  onNewPuzzle: () => void;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function TopBar({
  timer,
  moves,
  difficulty,
  seed,
  onReset,
  onNewPuzzle,
}: TopBarProps) {
  const config =
    DIFFICULTY_CONFIG[difficulty as keyof typeof DIFFICULTY_CONFIG];
  const gridLabel = config ? `${config.cols}×${config.rows}` : "";

  return (
    <div className="w-full max-w-150 mx-auto flex items-center justify-between px-4 py-3">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Zip</h1>
        <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full uppercase">
          {difficulty} {gridLabel}
        </span>
        <span className="text-xs font-mono text-gray-400">{seed}</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 text-sm text-gray-600">
          <div className="flex items-center gap-1">
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            <span className="font-mono tabular-nums">{formatTime(timer)}</span>
          </div>
          <div className="w-px h-4 bg-gray-200" />
          <div className="flex items-center gap-1">
            <span className="font-mono tabular-nums">{moves}</span>
            <span className="text-gray-400 text-xs">moves</span>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onReset}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
            title="Reset puzzle"
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
          </button>
          <button
            onClick={onNewPuzzle}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
            title="New puzzle"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
