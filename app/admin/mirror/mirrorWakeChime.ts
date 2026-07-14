/** Soft two-tone wake acknowledgment (Web Audio — no asset files). */

let sharedCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctx =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!sharedCtx || sharedCtx.state === "closed") {
    sharedCtx = new Ctx();
  }
  return sharedCtx;
}

function tone(
  ctx: AudioContext,
  frequency: number,
  startAt: number,
  duration: number,
  gainValue: number
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(0.0001, startAt);
  gain.gain.exponentialRampToValueAtTime(gainValue, startAt + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

/** Short ascending chime when the mirror hears its wake phrase. */
export function playMirrorWakeChime(): void {
  const ctx = getAudioContext();
  if (!ctx) return;

  const start = () => {
    const t0 = ctx.currentTime + 0.01;
    tone(ctx, 880, t0, 0.12, 0.08);
    tone(ctx, 1320, t0 + 0.1, 0.18, 0.07);
  };

  if (ctx.state === "suspended") {
    void ctx.resume().then(start).catch(() => {});
    return;
  }
  start();
}
