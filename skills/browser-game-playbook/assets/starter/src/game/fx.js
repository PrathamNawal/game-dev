// Tiny helpers for haptics and reduced-motion detection.
export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

let hapticsOn = true;
export function setHaptics(on) { hapticsOn = !!on; }
export function vibrate(ms) {
  if (!hapticsOn) return;
  try { if (navigator.vibrate) navigator.vibrate(ms); } catch { /* unsupported */ }
}
