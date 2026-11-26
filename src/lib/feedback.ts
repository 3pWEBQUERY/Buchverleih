/**
 * Spürbare Erfolgsmomente (Scan geglückt, Buch im Regal, Übergabe, Rückgabe bestätigt):
 * kurzes Vibrieren auf dem Telefon und ein dezenter Zweiklang. Der Ton ist abschaltbar
 * (Einstellungen → Darstellung) und bleibt bei «Bewegung reduzieren» ebenfalls aus.
 */
const KEY = "lr_sound";

export function soundOn(): boolean {
  try { return localStorage.getItem(KEY) !== "off"; } catch { return true; }
}

export function setSound(on: boolean) {
  try { localStorage.setItem(KEY, on ? "on" : "off"); } catch {}
}

let ctx: AudioContext | null = null;

/** Zweiklang aufwärts (E5 → A5), sehr leise, unter 0,3 s */
function chime() {
  if (!soundOn() || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  ctx ??= new AC();
  const now = ctx.currentTime;
  [659.25, 880].forEach((f, i) => {
    const o = ctx!.createOscillator();
    const g = ctx!.createGain();
    o.type = "sine";
    o.frequency.value = f;
    const t = now + i * 0.09;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.06, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    o.connect(g).connect(ctx!.destination);
    o.start(t);
    o.stop(t + 0.24);
  });
}

export function success() {
  try { navigator.vibrate?.(40); } catch {}
  try { chime(); } catch {}
}
