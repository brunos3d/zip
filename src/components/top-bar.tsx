"use client";

import React from "react";
import { DIFFICULTY_CONFIG } from "@/engine/types";

interface TopBarProps {
  timer: number;
  moves: number;
  difficulty: string;
  seed: string;
  onShareChallenge: () => void;
  shareTooltip: string | null;
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
  onShareChallenge,
  shareTooltip,
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

        <div className="relative">
          <button
            onClick={onShareChallenge}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors text-gray-500 hover:text-gray-700"
            title="Copy challenge link"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
          {shareTooltip && (
            <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-xs px-3 py-1.5 rounded-lg whitespace-nowrap shadow-lg">
              {shareTooltip}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full w-2 h-2 bg-gray-900 rotate-45 mb-[-4px]" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
