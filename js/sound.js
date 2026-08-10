// ============================================================
// SOUND — synthesized with Web Audio, no audio files needed.
// ============================================================
let ctx = null;
function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function noiseBurst({ freq = 1200, q = 1.5, duration = 0.08, volume = 0.4 } = {}) {
  const c = getCtx();
  const now = c.currentTime;
  const size = Math.max(1, Math.floor(c.sampleRate * duration));
  const buffer = c.createBuffer(1, size, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

  src.connect(filter).connect(gain).connect(c.destination);
  src.start(now);
  src.stop(now + duration);
}

function tone({ freq = 440, duration = 0.15, volume = 0.2, type = "sine", slideTo = null, delay = 0 } = {}) {
  const c = getCtx();
  const now = c.currentTime + delay;
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.connect(gain).connect(c.destination);
  osc.start(now);
  osc.stop(now + duration);
}

export function playShot() {
  noiseBurst({ freq: 1500, q: 0.8, duration: 0.1, volume: 0.5 });
  tone({ freq: 90, duration: 0.08, volume: 0.35, type: "square", slideTo: 40 });
}

export function playHit() {
  noiseBurst({ freq: 2200, q: 2, duration: 0.12, volume: 0.35 });
  tone({ freq: 200, duration: 0.2, volume: 0.25, type: "sawtooth", slideTo: 60 });
}

export function playEmptyClick() {
  noiseBurst({ freq: 3000, q: 4, duration: 0.02, volume: 0.15 });
}

export function playEscape() {
  tone({ freq: 500, duration: 0.35, volume: 0.2, type: "triangle", slideTo: 150 });
}

export function playRoundStart() {
  const c = getCtx();
  const now = c.currentTime;
  [440, 660].forEach((freq, i) => {
    const osc = c.createOscillator();
    osc.type = "square";
    const gain = c.createGain();
    const start = now + i * 0.09;
    osc.frequency.setValueAtTime(freq, start);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.linearRampToValueAtTime(0.12, start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
    osc.connect(gain).connect(c.destination);
    osc.start(start);
    osc.stop(start + 0.16);
  });
}

export function playGameOver() {
  [300, 250, 180, 120].forEach((freq, i) => {
    tone({ freq, duration: 0.3, volume: 0.22, type: "sawtooth", delay: i * 0.16 });
  });
}
