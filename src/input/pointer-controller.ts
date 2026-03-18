import { Point } from "@/engine/types";
import {
  canvasPointToGrid,
  RenderConfig,
  getCanvasSize,
} from "@/render/canvas-renderer";
import { TiltState, untiltPoint } from "@/render/tilt";

export type PointerEventType = "start" | "move" | "end";

export interface PointerCallbacks {
  onCellEnter: (cell: Point) => void;
  onDragStart: (cell: Point) => void;
  onDragEnd: () => void;
  onHover: (cell: Point | null) => void;
  onLongPress: (cell: Point) => void;
}

export class PointerController {
  private canvas: HTMLCanvasElement;
  private rc: RenderConfig;
  private callbacks: PointerCallbacks;
  private isDragging = false;
  private lastCell: Point | null = null;
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressTriggered = false;
  private dpr: number;
  private tiltState: TiltState | null = null;
  /** Cached bounding rect — set on pointer-start, cleared on pointer-end. */
  private cachedRect: DOMRect | null = null;

  constructor(
    canvas: HTMLCanvasElement,
    rc: RenderConfig,
    callbacks: PointerCallbacks,
    dpr: number,
    tiltState?: TiltState | null,
  ) {
    this.canvas = canvas;
    this.rc = rc;
    this.callbacks = callbacks;
    this.dpr = dpr;
    this.tiltState = tiltState ?? null;
    this.attach();
  }

  updateConfig(
    rc: RenderConfig,
    dpr: number,
    tiltState?: TiltState | null,
  ): void {
    this.rc = rc;
    this.dpr = dpr;
    if (tiltState !== undefined) this.tiltState = tiltState ?? null;
  }

  private getCanvasCoords(e: MouseEvent | Touch): { x: number; y: number } {
    const rect = this.cachedRect ?? this.canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  private getCellFromEvent(e: MouseEvent | Touch): Point | null {
    const coords = this.getCanvasCoords(e);
    // Apply inverse tilt transform so grid hit-testing stays accurate
    if (this.tiltState) {
      const size = getCanvasSize(this.rc);
      const cx = size.width / 2;
      const cy = size.height / 2;
      const corrected = untiltPoint(this.tiltState, cx, cy, coords.x, coords.y);
      return canvasPointToGrid(corrected.x, corrected.y, this.rc);
    }
    return canvasPointToGrid(coords.x, coords.y, this.rc);
  }

  private handlePointerStart = (cell: Point | null): void => {
    if (!cell) return;
    this.isDragging = true;
    this.lastCell = cell;
    this.longPressTriggered = false;
    // Cache rect to avoid layout reflow on every touchmove/mousemove
    this.cachedRect = this.canvas.getBoundingClientRect();
    this.callbacks.onDragStart(cell);

    // Start long press timer
    this.longPressTimer = setTimeout(() => {
      if (this.isDragging && cell) {
        this.longPressTriggered = true;
        this.callbacks.onLongPress(cell);
      }
    }, 500);
  };

  private handlePointerMove = (cell: Point | null): void => {
    if (!this.isDragging) {
      this.callbacks.onHover(cell);
      return;
    }

    // Clear long press on move
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }

    if (!cell) return;
    if (
      this.lastCell &&
      cell.x === this.lastCell.x &&
      cell.y === this.lastCell.y
    )
      return;

    this.lastCell = cell;
    this.callbacks.onCellEnter(cell);
  };

  private handlePointerEnd = (): void => {
    this.isDragging = false;
    this.lastCell = null;
    this.cachedRect = null;
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
    this.callbacks.onDragEnd();
  };

  // Mouse events
  private onMouseDown = (e: MouseEvent): void => {
    e.preventDefault();
    this.handlePointerStart(this.getCellFromEvent(e));
  };

  private onMouseMove = (e: MouseEvent): void => {
    this.handlePointerMove(this.getCellFromEvent(e));
  };

  private onMouseUp = (): void => {
    this.handlePointerEnd();
  };

  private onMouseLeave = (): void => {
    this.callbacks.onHover(null);
    if (this.isDragging) this.handlePointerEnd();
  };

  // Touch events
  private onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    if (e.touches.length === 1) {
      this.handlePointerStart(this.getCellFromEvent(e.touches[0]));
    }
  };

  private onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();
    if (e.touches.length === 1) {
      this.handlePointerMove(this.getCellFromEvent(e.touches[0]));
    }
  };

  private onTouchEnd = (e: TouchEvent): void => {
    e.preventDefault();
    this.handlePointerEnd();
  };

  private attach(): void {
    this.canvas.addEventListener("mousedown", this.onMouseDown);
    this.canvas.addEventListener("mousemove", this.onMouseMove);
    this.canvas.addEventListener("mouseup", this.onMouseUp);
    this.canvas.addEventListener("mouseleave", this.onMouseLeave);
    this.canvas.addEventListener("touchstart", this.onTouchStart, {
      passive: false,
    });
    this.canvas.addEventListener("touchmove", this.onTouchMove, {
      passive: false,
    });
    this.canvas.addEventListener("touchend", this.onTouchEnd, {
      passive: false,
    });
    this.canvas.addEventListener("touchcancel", this.onTouchEnd, {
      passive: false,
    });
  }

  detach(): void {
    this.canvas.removeEventListener("mousedown", this.onMouseDown);
    this.canvas.removeEventListener("mousemove", this.onMouseMove);
    this.canvas.removeEventListener("mouseup", this.onMouseUp);
    this.canvas.removeEventListener("mouseleave", this.onMouseLeave);
    this.canvas.removeEventListener("touchstart", this.onTouchStart);
    this.canvas.removeEventListener("touchmove", this.onTouchMove);
    this.canvas.removeEventListener("touchend", this.onTouchEnd);
    this.canvas.removeEventListener("touchcancel", this.onTouchEnd);

    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
    }
  }
}
