import { Point } from "@/engine/types";

export interface RemainingCellPing {
  point: Point;
  /** Delay in seconds before this cell starts pinging */
  delay: number;
  /** Progress 0..1 once delay has elapsed */
  progress: number;
  /** Whether the delay has elapsed */
  started: boolean;
}

export interface AnimationState {
  /** Path extension animation progress (0..1) */
  pathExtendProgress: number;
  /** Path erase animation progress (0..1) */
  pathEraseProgress: number;
  /** Checkpoint pulse animations keyed by "x,y" */
  checkpointPulses: Map<string, number>;
  /** Completion animation progress (0..1), -1 = not active */
  completionProgress: number;
  /** Hint glow position */
  hintGlow: Point | null;
  hintGlowProgress: number;
  /** Confetti particles */
  confetti: ConfettiParticle[];
  /** Remaining cells ping (orange delayed sequence) */
  remainingCellsPing: RemainingCellPing[];
  /** Elapsed time tracker for remaining cells animation */
  remainingCellsElapsed: number;
}

export interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  life: number;
  maxLife: number;
  rotation: number;
  rotationSpeed: number;
}

const CONFETTI_COLORS = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#96CEB4",
  "#FFEAA7",
  "#DDA0DD",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E9",
];

export function createAnimationState(): AnimationState {
  return {
    pathExtendProgress: 1,
    pathEraseProgress: 1,
    checkpointPulses: new Map(),
    completionProgress: -1,
    hintGlow: null,
    hintGlowProgress: 0,
    confetti: [],
    remainingCellsPing: [],
    remainingCellsElapsed: 0,
  };
}

export function triggerCheckpointPulse(
  state: AnimationState,
  point: Point,
): void {
  state.checkpointPulses.set(`${point.x},${point.y}`, 0);
}

export function triggerCompletion(
  state: AnimationState,
  canvasWidth: number,
  canvasHeight: number,
): void {
  state.completionProgress = 0;
  // Generate confetti
  state.confetti = [];
  for (let i = 0; i < 100; i++) {
    state.confetti.push({
      x: canvasWidth / 2 + (Math.random() - 0.5) * 100,
      y: canvasHeight / 3,
      vx: (Math.random() - 0.5) * 12,
      vy: -Math.random() * 10 - 5,
      color:
        CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: Math.random() * 8 + 4,
      life: 0,
      maxLife: 120 + Math.random() * 60,
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.3,
    });
  }
}

export function triggerHintGlow(state: AnimationState, point: Point): void {
  state.hintGlow = point;
  state.hintGlowProgress = 0;
}

/**
 * Trigger a delayed-sequence orange ping on remaining (unfilled) cells.
 * Each cell gets a staggered delay so they light up one by one.
 */
export function triggerRemainingCellsPing(
  state: AnimationState,
  cells: Point[],
): void {
  // Scale stagger so the full sequence finishes in ~1s regardless of board size
  const TARGET_DURATION = 1.0; // total cascade duration in seconds
  const stagger = cells.length > 1 ? TARGET_DURATION / cells.length : 0.06;
  state.remainingCellsElapsed = 0;
  state.remainingCellsPing = cells.map((point, i) => ({
    point,
    delay: i * stagger,
    progress: 0,
    started: false,
  }));
}

export function updateAnimations(state: AnimationState, dt: number): boolean {
  let needsRedraw = false;
  const speed = dt * 60; // normalize to ~60fps

  // Path extend
  if (state.pathExtendProgress < 1) {
    state.pathExtendProgress = Math.min(
      1,
      state.pathExtendProgress + 0.15 * speed,
    );
    needsRedraw = true;
  }

  // Path erase
  if (state.pathEraseProgress < 1) {
    state.pathEraseProgress = Math.min(
      1,
      state.pathEraseProgress + 0.15 * speed,
    );
    needsRedraw = true;
  }

  // Checkpoint pulses
  for (const [key, progress] of state.checkpointPulses) {
    if (progress < 1) {
      state.checkpointPulses.set(key, Math.min(1, progress + 0.04 * speed));
      needsRedraw = true;
    } else {
      state.checkpointPulses.delete(key);
    }
  }

  // Completion
  if (state.completionProgress >= 0 && state.completionProgress < 1) {
    state.completionProgress = Math.min(
      1,
      state.completionProgress + 0.01 * speed,
    );
    needsRedraw = true;
  }

  // Hint glow
  if (state.hintGlow) {
    state.hintGlowProgress += 0.03 * speed;
    if (state.hintGlowProgress > 1) {
      state.hintGlow = null;
      state.hintGlowProgress = 0;
    }
    needsRedraw = true;
  }

  // Confetti
  if (state.confetti.length > 0) {
    state.confetti = state.confetti.filter((p) => {
      p.life++;
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.25; // gravity
      p.vx *= 0.99;
      p.rotation += p.rotationSpeed;
      return p.life < p.maxLife;
    });
    needsRedraw = true;
  }

  // Remaining cells ping
  if (state.remainingCellsPing.length > 0) {
    state.remainingCellsElapsed += dt;
    let allDone = true;
    for (const cell of state.remainingCellsPing) {
      if (state.remainingCellsElapsed >= cell.delay) {
        cell.started = true;
        cell.progress = Math.min(1, cell.progress + 0.03 * speed);
      }
      if (cell.progress < 1) allDone = false;
    }
    if (allDone) {
      state.remainingCellsPing = [];
    }
    needsRedraw = true;
  }

  return needsRedraw;
}

export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function easeOutBack(t: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
