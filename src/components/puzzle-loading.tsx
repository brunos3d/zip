"use client";

import React from "react";

/**
 * Animated loading overlay shown while a puzzle is being generated.
 * Renders a small grid with cells that light up in a snaking path pattern.
 */
export default function PuzzleLoading() {
  const size = 4;
  // Snake path through 4x4 grid
  const snakePath: number[] = [];
  for (let y = 0; y < size; y++) {
    if (y % 2 === 0) {
      for (let x = 0; x < size; x++) snakePath.push(y * size + x);
    } else {
      for (let x = size - 1; x >= 0; x--) snakePath.push(y * size + x);
    }
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 w-full animate-fade-in">
      <div
        className="grid gap-1.5"
        style={{
          gridTemplateColumns: `repeat(${size}, 1fr)`,
          width: `${size * 40 + (size - 1) * 6}px`,
        }}
      >
        {Array.from({ length: size * size }, (_, i) => {
          const order = snakePath.indexOf(i);
          return (
            <div
              key={i}
              className="w-10 h-10 rounded-lg"
              style={{
                backgroundColor: "#e5e7eb",
                animation: `cell-fill 2.4s ease-in-out infinite`,
                animationDelay: `${order * 0.12}s`,
              }}
            />
          );
        })}
      </div>
      <p className="text-sm text-gray-400 font-medium tracking-wide">
        Generating puzzle…
      </p>

      <style>{`
        @keyframes cell-fill {
          0%, 100% { background-color: #e5e7eb; transform: scale(1); }
          8%, 20% { background-color: #3b82f6; transform: scale(1.08); }
          40% { background-color: #e5e7eb; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fade-in 0.15s ease-out;
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
