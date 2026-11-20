export function clamp(val, min, max) {
  return val < min ? min : val > max ? max : val;
}

export function clampInt(val, min, max, fallback) {
  const n = parseInt(val, 10);
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function randRange(min, max) {
  return min + Math.random() * (max - min);
}

export function angleDiff(target, current) {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

export function lerpAngle(a, b, t) {
  return a + angleDiff(b, a) * t;
}

export function dampFactor(factorAt60Fps, dt) {
  return Math.pow(factorAt60Fps, dt * 60);
}
