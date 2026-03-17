"use client";

import React, { useRef, useEffect, useCallback } from "react";
import { GameState, Point, DIFFICULTY_CONFIG } from "@/engine/types";
import {
  render,
  calculateRenderConfig,
  getCanvasSize,
  invalidateGridCache,
  LIGHT_THEME,
  RenderConfig,
} from "@/render/canvas-renderer";
import {
  AnimationState,
  createAnimationState,
  updateAnimations,
  triggerCheckpointPulse,
  triggerCompletion,
  triggerHintGlow,
  triggerRemainingCellsPing,
} from "@/render/animations";
import { PointerController } from "@/input/pointer-controller";
import {
  TiltState,
  TiltConfig,
  createTiltState,
  getDefaultTiltConfig,
  startTiltAnimation,
  updateTilt,
} from "@/render/tilt";

interface GameCanvasProps {
  gameState: GameState;
  onCellEnter: (cell: Point) => void;
  onDragStart: (cell: Point) => void;
  onDragEnd: () => void;
  onLongPress: (cell: Point) => void;
  checkpointReached: Point | null;
  puzzleSolved: boolean;
  hintCell: Point | null;
  remainingCellsPing: Point[] | null;
}

export default function GameCanvas({
  gameState,
  onCellEnter,
  onDragStart,
  onDragEnd,
  onLongPress,
  checkpointReached,
  puzzleSolved,
  hintCell,
  remainingCellsPing,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<AnimationState>(createAnimationState());
  const controllerRef = useRef<PointerController | null>(null);
  const rafRef = useRef<number>(0);
  const hoverRef = useRef<Point | null>(null);
  const needsDrawRef = useRef(true);
  const rcRef = useRef<RenderConfig | null>(null);
  const lastTimeRef = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Tilt / parallax refs
  const isMobile =
    typeof navigator !== "undefined" &&
    /Mobi|Android/i.test(navigator.userAgent);
  const tiltConfigRef = useRef<TiltConfig>(getDefaultTiltConfig(isMobile));
  const tiltStateRef = useRef<TiltState>(
    createTiltState(getDefaultTiltConfig(isMobile)),
  );

  const interactionDisabled = gameState.solved || gameState.revealingSolution;
  const skewTriggeredRef = useRef(false);

  const config = DIFFICULTY_CONFIG[gameState.difficulty];

  // Calculate canvas sizing
  const getContainerWidth = useCallback(() => {
    if (containerRef.current) {
      return containerRef.current.clientWidth;
    }
    if (typeof window !== "undefined") {
      return Math.min(window.innerWidth - 32, 600);
    }
    return 400;
  }, []);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const containerWidth = getContainerWidth();
    const padding = Math.max(16, containerWidth * 0.04);

    const rc = calculateRenderConfig(containerWidth, config, padding);
    rcRef.current = rc;
    const size = getCanvasSize(rc);

    canvas.style.width = `${size.width}px`;
    canvas.style.height = `${size.height}px`;
    canvas.width = size.width * dpr;
    canvas.height = size.height * dpr;

    invalidateGridCache();
    needsDrawRef.current = true;

    // Setup or update pointer controller
    if (controllerRef.current) {
      controllerRef.current.updateConfig(rc, dpr, null);
    } else {
      controllerRef.current = new PointerController(
        canvas,
        rc,
        {
          onCellEnter,
          onDragStart,
          onDragEnd,
          onHover: (cell) => {
            hoverRef.current = cell;
            needsDrawRef.current = true;
          },
          onLongPress,
        },
        dpr,
        null,
      );
    }
  }, [
    config,
    getContainerWidth,
    onCellEnter,
    onDragStart,
    onDragEnd,
    onLongPress,
  ]);

  // Trigger skew bounce animation when solved
  useEffect(() => {
    if (gameState.solved && !skewTriggeredRef.current) {
      skewTriggeredRef.current = true;
      startTiltAnimation(tiltStateRef.current);
      needsDrawRef.current = true;
    }
    if (!gameState.solved) {
      skewTriggeredRef.current = false;
    }
  }, [gameState.solved]);

  // Clear hover when interactions become disabled
  useEffect(() => {
    if (interactionDisabled) {
      hoverRef.current = null;
      needsDrawRef.current = true;
    }
  }, [interactionDisabled]);

  // Animation trigger: checkpoint
  useEffect(() => {
    if (checkpointReached) {
      triggerCheckpointPulse(animRef.current, checkpointReached);
      needsDrawRef.current = true;
    }
  }, [checkpointReached]);

  // Animation trigger: completion
  useEffect(() => {
    if (puzzleSolved) {
      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = window.devicePixelRatio || 1;
        triggerCompletion(
          animRef.current,
          canvas.width / dpr,
          canvas.height / dpr,
        );
        needsDrawRef.current = true;
      }
    }
  }, [puzzleSolved]);

  // Animation trigger: hint
  useEffect(() => {
    if (hintCell) {
      triggerHintGlow(animRef.current, hintCell);
      needsDrawRef.current = true;
    }
  }, [hintCell]);

  // Animation trigger: remaining cells ping
  useEffect(() => {
    if (remainingCellsPing && remainingCellsPing.length > 0) {
      triggerRemainingCellsPing(animRef.current, remainingCellsPing);
      needsDrawRef.current = true;
    }
  }, [remainingCellsPing]);

  // Path change -> trigger animation & redraw
  useEffect(() => {
    // During reveal, skip partial animation so the line extends seamlessly
    animRef.current.pathExtendProgress = gameState.revealingSolution ? 1 : 0.7;
    needsDrawRef.current = true;
  }, [gameState.path.length, gameState.revealingSolution]);

  // Reset animation state when game resets
  useEffect(() => {
    if (gameState.path.length === 0 && gameState.moves === 0) {
      animRef.current = createAnimationState();
      needsDrawRef.current = true;
    }
  }, [gameState.path.length, gameState.moves]);

  // Render loop
  useEffect(() => {
    setupCanvas();

    const loop = (time: number) => {
      const dt = lastTimeRef.current
        ? (time - lastTimeRef.current) / 1000
        : 1 / 60;
      lastTimeRef.current = time;

      const animNeedsRedraw = updateAnimations(animRef.current, dt);
      if (animNeedsRedraw) needsDrawRef.current = true;

      // Advance skew bounce animation
      if (gameState.solved) {
        const tiltNeedsRedraw = updateTilt(
          tiltStateRef.current,
          tiltConfigRef.current,
          dt,
        );
        if (tiltNeedsRedraw) needsDrawRef.current = true;
      }

      // Sync tilt state to pointer controller based on game state
      const skewActive = gameState.solved;
      if (controllerRef.current) {
        controllerRef.current.updateConfig(
          rcRef.current!,
          window.devicePixelRatio || 1,
          skewActive ? tiltStateRef.current : null,
        );
      }

      if (needsDrawRef.current) {
        const canvas = canvasRef.current;
        const rc = rcRef.current;
        if (canvas && rc) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            const dpr = window.devicePixelRatio || 1;
            render(
              ctx,
              canvas,
              gameState.grid,
              gameState.path,
              hoverRef.current,
              rc,
              LIGHT_THEME,
              animRef.current,
              dpr,
              gameState.invalidFeedback,
              gameState.lastCheckpointNumber,
              gameState.solved ? tiltStateRef.current : null,
              gameState.solved ? tiltConfigRef.current : null,
              gameState.totalCells,
              gameState.seed,
              gameState.edgeWalls,
            );
          }
        }
        needsDrawRef.current = false;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [gameState, setupCanvas]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => {
      setupCanvas();
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setupCanvas]);

  // Cleanup controller
  useEffect(() => {
    return () => {
      controllerRef.current?.detach();
      controllerRef.current = null;
    };
  }, []);

  // Re-create controller when callbacks change
  useEffect(() => {
    if (controllerRef.current) {
      controllerRef.current.detach();
    }
    const canvas = canvasRef.current;
    const rc = rcRef.current;
    if (canvas && rc) {
      const dpr = window.devicePixelRatio || 1;
      controllerRef.current = new PointerController(
        canvas,
        rc,
        {
          onCellEnter,
          onDragStart,
          onDragEnd,
          onHover: (cell) => {
            hoverRef.current = cell;
            needsDrawRef.current = true;
          },
          onLongPress,
        },
        dpr,
        null,
      );
    }
  }, [onCellEnter, onDragStart, onDragEnd, onLongPress]);

  return (
    <div
      ref={containerRef}
      className="flex justify-center w-full max-w-150 mx-auto touch-none"
    >
      <canvas
        ref={canvasRef}
        className="rounded-xl border border-gray-200 cursor-pointer"
        style={{
          touchAction: "none",
          pointerEvents: interactionDisabled ? "none" : "auto",
        }}
      />
    </div>
  );
}
