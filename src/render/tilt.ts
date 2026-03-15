/** Static skew perspective system for the puzzle board with bounce-in animation. */

export interface TiltConfig {
  /** Base horizontal skew (static perspective). */
  baseSkewX: number;
  /** Base vertical skew (static perspective). */
  baseSkewY: number;
  /** Shadow blur radius in CSS pixels. */
  shadowBlur: number;
  /** Shadow opacity 0..1. */
  shadowOpacity: number;
  /** Shadow Y-offset in CSS pixels. */
  shadowOffsetY: number;
  /** Duration of the bounce-in animation in seconds. */
  animDuration: number;
}

const DESKTOP_DEFAULTS: TiltConfig = {
  baseSkewX: -0.05,
  baseSkewY: 0,
  shadowBlur: 20,
  shadowOpacity: 0.18,
  shadowOffsetY: 8,
  animDuration: 1.2,
};

const MOBILE_DEFAULTS: TiltConfig = {
  baseSkewX: 0.08,
  baseSkewY: 0,
  shadowBlur: 16,
  shadowOpacity: -0.15,
  shadowOffsetY: 6,
  animDuration: 1.2,
};

export function getDefaultTiltConfig(isMobile: boolean): TiltConfig {
  return isMobile ? { ...MOBILE_DEFAULTS } : { ...DESKTOP_DEFAULTS };
}

export interface TiltState {
  /** Current animated skewX value. */
  currentSkewX: number;
  /** Current animated skewY value. */
  currentSkewY: number;
  /** Target skewX (final value). */
  targetSkewX: number;
  /** Target skewY (final value). */
  targetSkewY: number;
  /** Animation progress 0..1 (1 = done). */
  progress: number;
  /** Whether the animation is running. */
  animating: boolean;
}

export function createTiltState(config: TiltConfig): TiltState {
  return {
    currentSkewX: 0,
    currentSkewY: 0,
    targetSkewX: config.baseSkewX,
    targetSkewY: config.baseSkewY,
    progress: 1,
    animating: false,
  };
}

/** Trigger the skew-and-return animation: 0 → skew → 0 with bounce. */
export function startTiltAnimation(state: TiltState): void {
  state.currentSkewX = 0;
  state.currentSkewY = 0;
  state.progress = 0;
  state.animating = true;
}

/**
 * Soft bounce easing — overshoots slightly then settles.
 * Based on a damped spring approximation.
 */
function easeOutBounce(t: number): number {
  const c4 = (2 * Math.PI) / 4.5;
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  return 1 + Math.pow(2, -8 * t) * Math.sin((t * 10 - 0.75) * c4) * -1;
}

/**
 * Envelope that goes 0 → 1 → 0 with a bounce feel.
 * First half: ease into the skew. Second half: ease back out.
 */
function skewEnvelope(t: number): number {
  // Use a sine bell for the overall shape, modulated by the bounce on the way in
  if (t <= 0.5) {
    // 0..0.5 maps to bounce easing 0..1
    return easeOutBounce(t * 2);
  }
  // 0.5..1 maps to smooth ease-out back to 0
  const t2 = (t - 0.5) * 2; // 0..1
  return 1 - t2 * t2; // quadratic ease-in (towards 0)
}

/**
 * Advance the tilt animation by dt seconds.
 * Returns true if a redraw is needed.
 */
export function updateTilt(
  state: TiltState,
  config: TiltConfig,
  dt: number,
): boolean {
  if (!state.animating) return false;

  state.progress += dt / config.animDuration;
  if (state.progress >= 1) {
    state.progress = 1;
    state.animating = false;
    state.currentSkewX = 0;
    state.currentSkewY = 0;
    return true;
  }

  const t = skewEnvelope(state.progress);
  state.currentSkewX = state.targetSkewX * t;
  state.currentSkewY = state.targetSkewY * t;
  return true;
}

/**
 * Build the 6-value 2D affine transform incorporating the skew.
 * Returns [a, b, c, d, e, f] for ctx.transform(a, b, c, d, e, f).
 *
 * The transform is centred on (cx, cy) so the board doesn't drift.
 */
export function getTiltTransform(
  state: TiltState,
  cx: number,
  cy: number,
): [number, number, number, number, number, number] {
  const { currentSkewX, currentSkewY } = state;
  const e = -(currentSkewX * cy);
  const f = -(currentSkewY * cx);
  return [1, currentSkewY, currentSkewX, 1, e, f];
}

/**
 * Get the inverse of the skew transform, for mapping screen coordinates back
 * to untransformed canvas coordinates.
 */
export function getInverseTiltTransform(
  state: TiltState,
  cx: number,
  cy: number,
): [number, number, number, number, number, number] | null {
  const [a, b, c, d, e, f] = getTiltTransform(state, cx, cy);
  const det = a * d - b * c;
  if (Math.abs(det) < 1e-10) return null;
  const invDet = 1 / det;
  return [
    d * invDet,
    -b * invDet,
    -c * invDet,
    a * invDet,
    (b * f - d * e) * invDet,
    (c * e - a * f) * invDet,
  ];
}

/**
 * Apply inverse tilt transform to a point. Converts screen-space canvas
 * coordinates to the untransformed grid coordinate space.
 */
export function untiltPoint(
  state: TiltState,
  cx: number,
  cy: number,
  px: number,
  py: number,
): { x: number; y: number } {
  const inv = getInverseTiltTransform(state, cx, cy);
  if (!inv) return { x: px, y: py };
  const [a, b, c, d, e, f] = inv;
  return {
    x: a * px + c * py + e,
    y: b * px + d * py + f,
  };
}
