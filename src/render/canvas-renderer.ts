import { Cell, Point, GridConfig, InvalidMoveFeedback } from "@/engine/types";
import { pointKey, createRng, seedToNumber } from "@/engine/grid-utils";
import { AnimationState, easeOutBack } from "@/render/animations";
import { TiltState, TiltConfig, getTiltTransform } from "@/render/tilt";

/** Generate two vibrant HSL colors from a seed string */
function seedToGradientColors(seed: string): [string, string, string] {
  const rng = createRng(seedToNumber(seed));
  const hue1 = Math.floor(rng() * 360);
  // Second hue is 90-180 degrees away for good contrast
  const hue2 = (hue1 + 90 + Math.floor(rng() * 90)) % 360;
  return [
    `hsl(${hue1}, 75%, 55%)`,
    `hsl(${hue2}, 75%, 55%)`,
    `hsla(${hue1}, 75%, 55%, 0.3)`,
  ];
}

/** Parse an HSL string to [h, s, l] numeric values */
function parseHsl(hsl: string): [number, number, number] {
  const m = hsl.match(/hsl[a]?\((\d+),\s*(\d+)%,\s*(\d+)%/);
  if (!m) return [0, 75, 55];
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Lerp between two HSL color strings */
function lerpHsl(a: string, b: string, t: number): string {
  const [h1, s1, l1] = parseHsl(a);
  const [h2, s2, l2] = parseHsl(b);
  // Shortest-arc hue interpolation
  let dh = h2 - h1;
  if (dh > 180) dh -= 360;
  if (dh < -180) dh += 360;
  const h = (((h1 + dh * t) % 360) + 360) % 360;
  const s = s1 + (s2 - s1) * t;
  const l = l1 + (l2 - l1) * t;
  return `hsl(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%)`;
}

/** Cache: avoid recomputing colors every frame */
let gradientCacheSeed = "";
let gradientCacheColors: [string, string, string] = ["", "", ""];

export interface RenderConfig {
  cellSize: number;
  padding: number;
  gridConfig: GridConfig;
}

export interface Theme {
  background: string;
  gridLine: string;
  cellBackground: string;
  cellBackgroundAlt: string;
  wallColor: string;
  numberColor: string;
  numberBackground: string;
  pathColor: string;
  pathGlow: string;
  hoverColor: string;
  checkpointReached: string;
  hintColor: string;
  invalidTarget: string;
  invalidConflict: string;
  textFont: string;
}

export const LIGHT_THEME: Theme = {
  background: "#F8F9FA",
  gridLine: "#DEE2E6",
  cellBackground: "#FFFFFF",
  cellBackgroundAlt: "#F1F3F5",
  wallColor: "#343A40",
  numberColor: "#FFFFFF",
  numberBackground: "#2B2D42",
  pathColor: "#4361EE",
  pathGlow: "rgba(67, 97, 238, 0.3)",
  hoverColor: "rgba(67, 97, 238, 0.15)",
  checkpointReached: "#2EC4B6",
  hintColor: "rgba(255, 183, 3, 0.6)",
  invalidTarget: "rgba(239, 68, 68, 0.5)",
  invalidConflict: "rgba(249, 115, 22, 0.4)",
  textFont: "600 VAR_SIZEpx system-ui, -apple-system, sans-serif",
};

/** Cached off-screen canvas for static grid */
let gridCache: HTMLCanvasElement | null = null;
let gridCacheKey = "";

function getCellCenter(
  x: number,
  y: number,
  rc: RenderConfig,
): { cx: number; cy: number } {
  return {
    cx: rc.padding + x * rc.cellSize + rc.cellSize / 2,
    cy: rc.padding + y * rc.cellSize + rc.cellSize / 2,
  };
}

export function canvasPointToGrid(
  canvasX: number,
  canvasY: number,
  rc: RenderConfig,
): Point | null {
  const x = Math.floor((canvasX - rc.padding) / rc.cellSize);
  const y = Math.floor((canvasY - rc.padding) / rc.cellSize);
  if (x < 0 || x >= rc.gridConfig.cols || y < 0 || y >= rc.gridConfig.rows) {
    return null;
  }
  return { x, y };
}

export function calculateRenderConfig(
  canvasWidth: number,
  gridConfig: GridConfig,
  padding: number = 20,
): RenderConfig {
  const availableWidth = canvasWidth - padding * 2;
  const cellSize = Math.floor(
    availableWidth / Math.max(gridConfig.cols, gridConfig.rows),
  );
  return { cellSize, padding, gridConfig };
}

export function getCanvasSize(rc: RenderConfig): {
  width: number;
  height: number;
} {
  return {
    width: rc.padding * 2 + rc.gridConfig.cols * rc.cellSize,
    height: rc.padding * 2 + rc.gridConfig.rows * rc.cellSize,
  };
}

function drawStaticGrid(
  ctx: CanvasRenderingContext2D,
  grid: Cell[][],
  rc: RenderConfig,
  theme: Theme,
): void {
  const { cellSize, padding, gridConfig } = rc;

  for (let y = 0; y < gridConfig.rows; y++) {
    for (let x = 0; x < gridConfig.cols; x++) {
      const px = padding + x * cellSize;
      const py = padding + y * cellSize;
      const cell = grid[y][x];

      if (cell.wall) {
        ctx.fillStyle = theme.wallColor;
      } else {
        const isAlt = (x + y) % 2 === 1;
        ctx.fillStyle = isAlt ? theme.cellBackgroundAlt : theme.cellBackground;
      }
      ctx.fillRect(px + 1, py + 1, cellSize - 2, cellSize - 2);
    }
  }

  // Grid lines
  ctx.strokeStyle = theme.gridLine;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= gridConfig.cols; x++) {
    const px = padding + x * cellSize;
    ctx.moveTo(px, padding);
    ctx.lineTo(px, padding + gridConfig.rows * cellSize);
  }
  for (let y = 0; y <= gridConfig.rows; y++) {
    const py = padding + y * cellSize;
    ctx.moveTo(padding, py);
    ctx.lineTo(padding + gridConfig.cols * cellSize, py);
  }
  ctx.stroke();
}

/** Draw edge walls as thick black lines between adjacent cells */
function drawEdgeWalls(
  ctx: CanvasRenderingContext2D,
  edgeWalls: Set<string>,
  rc: RenderConfig,
): void {
  const { cellSize, padding } = rc;
  const wallThickness = Math.max(3, cellSize * 0.08);

  ctx.save();

  // Clip to the grid area so walls at the board edge don't extend outside
  const gridW = rc.gridConfig.cols * cellSize;
  const gridH = rc.gridConfig.rows * cellSize;
  ctx.beginPath();
  ctx.rect(padding, padding, gridW, gridH);
  ctx.clip();

  ctx.strokeStyle = "#000000";
  ctx.lineWidth = wallThickness;
  ctx.lineCap = "round";

  for (const key of edgeWalls) {
    const [partA, partB] = key.split("|");
    const [ax, ay] = partA.split(",").map(Number);
    const [bx, by] = partB.split(",").map(Number);

    // Determine which edge this wall is on
    if (ax === bx) {
      // Vertical neighbors — wall is a horizontal line between them
      const topY = Math.max(ay, by);
      const wx = padding + ax * cellSize;
      const wy = padding + topY * cellSize;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx + cellSize, wy);
      ctx.stroke();
    } else {
      // Horizontal neighbors — wall is a vertical line between them
      const leftX = Math.max(ax, bx);
      const wx = padding + leftX * cellSize;
      const wy = padding + ay * cellSize;
      ctx.beginPath();
      ctx.moveTo(wx, wy);
      ctx.lineTo(wx, wy + cellSize);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawNumbers(
  ctx: CanvasRenderingContext2D,
  grid: Cell[][],
  rc: RenderConfig,
  theme: Theme,
  pathSet: Set<string>,
  animState: AnimationState,
): void {
  const { cellSize } = rc;
  const radius = cellSize * 0.35;

  for (let y = 0; y < rc.gridConfig.rows; y++) {
    for (let x = 0; x < rc.gridConfig.cols; x++) {
      const cell = grid[y][x];
      if (cell.number === undefined) continue;

      const { cx, cy } = getCellCenter(x, y, rc);
      const key = pointKey({ x, y });
      const isStartHighlight = cell.number === 1 && pathSet.size === 0;

      // Checkpoint pulse animation
      const pulseProgress = animState.checkpointPulses.get(key);
      let scale = 1;
      if (pulseProgress !== undefined && pulseProgress < 1) {
        scale = 1 + 0.3 * easeOutBack(pulseProgress) * (1 - pulseProgress);
      }

      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(scale, scale);

      // Accent highlight ring for checkpoint 1 before drag starts
      if (isStartHighlight) {
        ctx.beginPath();
        ctx.arc(0, 0, radius + 4, 0, Math.PI * 2);
        ctx.strokeStyle = theme.checkpointReached;
        ctx.lineWidth = 3;
        ctx.shadowColor = theme.checkpointReached;
        ctx.shadowBlur = 10;
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // Circle background — always black
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.fillStyle = "#000000";
      ctx.fill();

      // Number text — always white
      const fontSize = Math.max(12, cellSize * 0.3);
      ctx.font = theme.textFont.replace("VAR_SIZE", String(fontSize));
      ctx.fillStyle = "#FFFFFF";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(cell.number), 0, 1);

      ctx.restore();
    }
  }
}

function getGradientColors(seed: string): [string, string, string] {
  if (seed !== gradientCacheSeed) {
    gradientCacheSeed = seed;
    gradientCacheColors = seedToGradientColors(seed);
  }
  return gradientCacheColors;
}

function drawPath(
  ctx: CanvasRenderingContext2D,
  path: Point[],
  rc: RenderConfig,
  theme: Theme,
  animState: AnimationState,
  totalCells: number,
  seed: string,
): void {
  const [colorA, colorB] = getGradientColors(seed);

  if (path.length < 2) {
    // Draw single dot if path has one cell
    if (path.length === 1) {
      const { cx, cy } = getCellCenter(path[0].x, path[0].y, rc);
      ctx.beginPath();
      ctx.arc(cx, cy, rc.cellSize * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = colorA;
      ctx.fill();
    }
    return;
  }

  const lineWidth = rc.cellSize * 0.35 * 2 + 2;

  // Determine how many segments to draw (for animation)
  const totalSegments = path.length - 1;
  const drawSegments = Math.ceil(totalSegments * animState.pathExtendProgress);

  // Pre-compute segment endpoints for both glow and color passes
  const points: { px: number; py: number }[] = [];
  for (let i = 0; i <= drawSegments; i++) {
    const { cx, cy } = getCellCenter(path[i].x, path[i].y, rc);
    points.push({ px: cx, py: cy });
  }
  // Adjust last point for animation interpolation
  if (
    drawSegments > 0 &&
    drawSegments <= totalSegments &&
    animState.pathExtendProgress < 1
  ) {
    const prev = points[drawSegments - 1];
    const cur = points[drawSegments];
    const frac =
      animState.pathExtendProgress * totalSegments - (drawSegments - 1);
    points[drawSegments] = {
      px: prev.px + (cur.px - prev.px) * frac,
      py: prev.py + (cur.py - prev.py) * frac,
    };
  }

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Draw colored segments (no shadowBlur — the original per-segment shadow was
  // extremely costly on mobile GPUs so we omit the glow entirely)
  ctx.lineWidth = lineWidth;
  for (let i = 1; i <= drawSegments; i++) {
    const prev = points[i - 1];
    const cur = points[i];
    const tPrev = (i - 1) / totalCells;
    const tCur = i / totalCells;

    // Per-segment linear gradient for seamless color transition
    const grad = ctx.createLinearGradient(prev.px, prev.py, cur.px, cur.py);
    grad.addColorStop(0, lerpHsl(colorA, colorB, tPrev));
    grad.addColorStop(1, lerpHsl(colorA, colorB, tCur));

    ctx.beginPath();
    ctx.moveTo(prev.px, prev.py);
    ctx.lineTo(cur.px, cur.py);
    ctx.strokeStyle = grad;
    ctx.stroke();
  }

  // Draw dots at each cell on path with matching gradient color
  for (let i = 0; i <= Math.min(drawSegments, path.length - 1); i++) {
    const { px, py } = points[i];
    const t = i / totalCells;
    ctx.fillStyle = lerpHsl(colorA, colorB, t);
    ctx.beginPath();
    ctx.arc(px, py, lineWidth * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawHoverPreview(
  ctx: CanvasRenderingContext2D,
  hover: Point | null,
  rc: RenderConfig,
  theme: Theme,
  pathSet: Set<string>,
): void {
  if (!hover) return;
  if (pathSet.has(pointKey(hover))) return;

  const { cx, cy } = getCellCenter(hover.x, hover.y, rc);
  const size = rc.cellSize * 0.8;

  ctx.fillStyle = theme.hoverColor;
  ctx.beginPath();
  const r = size * 0.15;
  const half = size / 2;
  ctx.moveTo(cx - half + r, cy - half);
  ctx.arcTo(cx + half, cy - half, cx + half, cy + half, r);
  ctx.arcTo(cx + half, cy + half, cx - half, cy + half, r);
  ctx.arcTo(cx - half, cy + half, cx - half, cy - half, r);
  ctx.arcTo(cx - half, cy - half, cx + half, cy - half, r);
  ctx.fill();
}

function drawHintGlow(
  ctx: CanvasRenderingContext2D,
  animState: AnimationState,
  rc: RenderConfig,
  theme: Theme,
): void {
  if (!animState.hintGlow) return;

  const { cx, cy } = getCellCenter(
    animState.hintGlow.x,
    animState.hintGlow.y,
    rc,
  );
  const progress = animState.hintGlowProgress;
  const alpha = Math.sin(progress * Math.PI) * 0.8;
  const radius = rc.cellSize * 0.4 * (1 + 0.3 * progress);

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = theme.hintColor;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawCompletion(
  ctx: CanvasRenderingContext2D,
  animState: AnimationState,
  canvasWidth: number,
  canvasHeight: number,
): void {
  if (animState.completionProgress < 0) return;

  // Grid highlight sweep
  if (animState.completionProgress < 0.5) {
    const sweepProgress = animState.completionProgress * 2;
    const sweepX = sweepProgress * canvasWidth;

    const gradient = ctx.createLinearGradient(sweepX - 60, 0, sweepX + 60, 0);
    gradient.addColorStop(0, "rgba(46, 196, 182, 0)");
    gradient.addColorStop(0.5, "rgba(46, 196, 182, 0.15)");
    gradient.addColorStop(1, "rgba(46, 196, 182, 0)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
  }

  // Confetti
  for (const p of animState.confetti) {
    const alpha = 1 - p.life / p.maxLife;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    ctx.restore();
  }
}

function drawRemainingCellsPing(
  ctx: CanvasRenderingContext2D,
  animState: AnimationState,
  rc: RenderConfig,
  theme: Theme,
): void {
  for (const cell of animState.remainingCellsPing) {
    if (!cell.started || cell.progress >= 1) continue;
    const { cx, cy } = getCellCenter(cell.point.x, cell.point.y, rc);
    // Pulse: fade in then fade out
    const alpha = Math.sin(cell.progress * Math.PI) * 0.55;
    const scale = 0.8 + cell.progress * 0.2;
    const half = (rc.cellSize * scale) / 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = theme.invalidConflict; // orange
    ctx.fillRect(cx - half + 1, cy - half + 1, half * 2 - 2, half * 2 - 2);
    ctx.restore();
  }
}

function drawInvalidFeedback(
  ctx: CanvasRenderingContext2D,
  feedback: InvalidMoveFeedback | null,
  rc: RenderConfig,
  theme: Theme,
): void {
  if (!feedback) return;
  const elapsed = Date.now() - feedback.timestamp;
  if (elapsed > 600) return;

  const alpha = 1 - elapsed / 600;

  // Red glow on target
  const { cx: tx, cy: ty } = getCellCenter(
    feedback.targetCell.x,
    feedback.targetCell.y,
    rc,
  );
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = theme.invalidTarget;
  ctx.fillRect(
    tx - rc.cellSize / 2 + 1,
    ty - rc.cellSize / 2 + 1,
    rc.cellSize - 2,
    rc.cellSize - 2,
  );
  ctx.restore();

  // Orange glow on conflict
  const { cx: cx2, cy: cy2 } = getCellCenter(
    feedback.conflictCell.x,
    feedback.conflictCell.y,
    rc,
  );
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = theme.invalidConflict;
  ctx.fillRect(
    cx2 - rc.cellSize / 2 + 1,
    cy2 - rc.cellSize / 2 + 1,
    rc.cellSize - 2,
    rc.cellSize - 2,
  );
  ctx.restore();
}

export function render(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  grid: Cell[][],
  path: Point[],
  hoverCell: Point | null,
  rc: RenderConfig,
  theme: Theme,
  animState: AnimationState,
  dpr: number,
  invalidFeedback?: InvalidMoveFeedback | null,
  lastCheckpointNumber?: number,
  tiltState?: TiltState | null,
  tiltConfig?: TiltConfig | null,
  totalCells?: number,
  seed?: string,
  edgeWalls?: Set<string>,
): void {
  const w = canvas.width / dpr;
  const h = canvas.height / dpr;

  ctx.save();
  ctx.scale(dpr, dpr);

  ctx.fillStyle = theme.background;
  ctx.fillRect(0, 0, w, h);

  // Compute centre of the board for the tilt transform
  const boardCx = w / 2;
  const boardCy = h / 2;

  // Draw floating shadow behind the board (before tilt transform)
  if (tiltState && tiltConfig) {
    const gridW = rc.gridConfig.cols * rc.cellSize;
    const gridH = rc.gridConfig.rows * rc.cellSize;
    const sx = rc.padding;
    const sy = rc.padding;
    ctx.save();
    const [a, b, c, d, e, f] = getTiltTransform(tiltState, boardCx, boardCy);
    ctx.transform(a, b, c, d, e, f);
    ctx.shadowColor = `rgba(0,0,0,${tiltConfig.shadowOpacity})`;
    ctx.shadowBlur = tiltConfig.shadowBlur;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = tiltConfig.shadowOffsetY;
    ctx.fillStyle = "rgba(0,0,0,0)";
    // Use a filled rect that matches the grid to cast the shadow
    ctx.fillStyle = `rgba(0,0,0,${tiltConfig.shadowOpacity})`;
    ctx.fillRect(sx, sy, gridW, gridH);
    ctx.restore();
  }

  // Apply skew/tilt transform for all board layers
  if (tiltState) {
    const [a, b, c, d, e, f] = getTiltTransform(tiltState, boardCx, boardCy);
    ctx.transform(a, b, c, d, e, f);
  }

  const pathSet = new Set<string>();
  for (const p of path) {
    pathSet.add(pointKey(p));
  }

  // Layer 1: Static grid (use cache, keyed on grid content for walls)
  const cacheKey = `${rc.cellSize}-${rc.gridConfig.cols}-${rc.gridConfig.rows}`;
  if (gridCacheKey !== cacheKey || !gridCache) {
    gridCache = document.createElement("canvas");
    gridCache.width = w * dpr;
    gridCache.height = h * dpr;
    const gctx = gridCache.getContext("2d")!;
    gctx.scale(dpr, dpr);
    drawStaticGrid(gctx, grid, rc, theme);
    gridCacheKey = cacheKey;
  }
  ctx.drawImage(gridCache, 0, 0, w, h);

  // Layer 1.5: Edge walls are drawn later (after path backgrounds)

  // Layer 2: Hover preview
  drawHoverPreview(ctx, hoverCell, rc, theme, pathSet);

  // Layer 3: Invalid feedback
  drawInvalidFeedback(ctx, invalidFeedback ?? null, rc, theme);

  // Layer 3.5: Remaining cells ping
  drawRemainingCellsPing(ctx, animState, rc, theme);

  // Layer 3.7: Path cell backgrounds
  if (path.length > 0 && seed) {
    const [colorA] = getGradientColors(seed);
    const [h, s, l] = parseHsl(colorA);
    const bgColor = `hsla(${h}, ${s}%, ${l}%, 0.3)`;
    ctx.fillStyle = bgColor;
    for (const p of path) {
      ctx.fillRect(
        rc.padding + p.x * rc.cellSize,
        rc.padding + p.y * rc.cellSize,
        rc.cellSize,
        rc.cellSize,
      );
    }
  }

  // Layer 3.8: Edge walls — drawn after path backgrounds so they appear on top
  if (edgeWalls && edgeWalls.size > 0) {
    drawEdgeWalls(ctx, edgeWalls, rc);
  }

  // Layer 4: Path
  drawPath(ctx, path, rc, theme, animState, totalCells ?? 1, seed ?? "");

  // Layer 5: Hint glow
  drawHintGlow(ctx, animState, rc, theme);

  // Layer 6: Numbers
  drawNumbers(ctx, grid, rc, theme, pathSet, animState);

  // Layer 7: Completion effects (confetti should be in untransformed space)
  // Reset transform for confetti so particles aren't skewed
  if (tiltState) {
    // Undo the tilt (but keep dpr scale)
    ctx.save();
    ctx.resetTransform();
    ctx.scale(dpr, dpr);
    drawCompletion(ctx, animState, w, h);
    ctx.restore();
  } else {
    drawCompletion(ctx, animState, w, h);
  }

  ctx.restore();
}

export function invalidateGridCache(): void {
  gridCache = null;
  gridCacheKey = "";
}
