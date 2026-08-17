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

// ============================================================
// BACKGROUND MUSIC — a looping, generative rock theme. Distorted
// power-chord riff + real drum-kit hits (kick/snare/hihat), more
// "gig in a demon-infested garage" than horror ambience. No audio
// files: everything synthesized and scheduled a phrase ahead so
// the loop stays gapless.
// ============================================================
let musicGain = null;
let musicPlaying = false;
let musicTimer = null;
let musicVolumeTarget = 0.19;
let distortionCurve = null;

function getDistortionCurve() {
  if (!distortionCurve) {
    const amount = 42;
    const n = 256;
    const curve = new Float32Array(n);
    const deg = Math.PI / 180;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }
    distortionCurve = curve;
  }
  return distortionCurve;
}

function getMusicGain() {
  const c = getCtx();
  if (!musicGain) {
    musicGain = c.createGain();
    musicGain.gain.value = 0;
    musicGain.connect(c.destination);
  }
  return musicGain;
}

// E natural minor power-chord roots (root frequency, fifth frequency) —
// the classic rock/metal interval, driven through a soft-clip waveshaper
const CHORD = {
  E2: [82.41, 123.47],
  G2: [98.0, 146.83],
  A2: [110.0, 164.81],
  D3: [146.83, 220.0],
  C3: [130.81, 196.0],
};
const LEAD = { E4: 329.63, G4: 392.0, A4: 440.0, B4: 493.88, D5: 587.33, E5: 659.25 };

const STEP_SECONDS = 0.28;
const STEPS_PER_PHRASE = 16;
const PHRASE_SECONDS = STEP_SECONDS * STEPS_PER_PHRASE;

// the chugging riff, one chord key per 16th-note step (repeats twice per phrase)
const RIFF = ["E2", "E2", "E2", "E2", "G2", "G2", "E2", "E2", "A2", "A2", "E2", "E2", "D3", "C3", "G2", "A2"];
const KICK_STEPS = new Set([0, 3, 6, 8, 11, 14]);
const SNARE_STEPS = new Set([4, 12]);

function scheduleChug(chordKey, startAt, duration, volume = 0.11) {
  const c = getCtx();
  const [root, fifth] = CHORD[chordKey];
  [root, fifth].forEach((freq) => {
    const osc = c.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, startAt);

    const shaper = c.createWaveShaper();
    shaper.curve = getDistortionCurve();
    shaper.oversample = "2x";

    const filter = c.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2000;
    filter.Q.value = 0.7;

    const gain = c.createGain();
    gain.gain.setValueAtTime(volume, startAt);
    gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);

    osc.connect(shaper).connect(filter).connect(gain).connect(getMusicGain());
    osc.start(startAt);
    osc.stop(startAt + duration);
  });
}

function scheduleLeadNote(freq, startAt, duration, volume = 0.05) {
  const c = getCtx();
  const osc = c.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(freq, startAt);

  const shaper = c.createWaveShaper();
  shaper.curve = getDistortionCurve();

  const filter = c.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 3200;

  const gain = c.createGain();
  gain.gain.setValueAtTime(0, startAt);
  gain.gain.linearRampToValueAtTime(volume, startAt + duration * 0.1);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + duration);

  osc.connect(shaper).connect(filter).connect(gain).connect(getMusicGain());
  osc.start(startAt);
  osc.stop(startAt + duration);
}

function scheduleKick(startAt, volume = 0.3) {
  const c = getCtx();
  const osc = c.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(130, startAt);
  osc.frequency.exponentialRampToValueAtTime(42, startAt + 0.11);

  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, startAt);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.16);

  osc.connect(gain).connect(getMusicGain());
  osc.start(startAt);
  osc.stop(startAt + 0.16);
}

function scheduleSnare(startAt, volume = 0.2) {
  const c = getCtx();
  const size = Math.floor(c.sampleRate * 0.14);
  const buffer = c.createBuffer(1, size, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size);

  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1900;
  filter.Q.value = 0.8;

  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, startAt);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.14);

  src.connect(filter).connect(gain).connect(getMusicGain());
  src.start(startAt);
  src.stop(startAt + 0.14);
}

function scheduleHihat(startAt, volume = 0.055) {
  const c = getCtx();
  const size = Math.floor(c.sampleRate * 0.035);
  const buffer = c.createBuffer(1, size, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < size; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / size);

  const src = c.createBufferSource();
  src.buffer = buffer;
  const filter = c.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.value = 7500;

  const gain = c.createGain();
  gain.gain.setValueAtTime(volume, startAt);
  gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.035);

  src.connect(filter).connect(gain).connect(getMusicGain());
  src.start(startAt);
  src.stop(startAt + 0.035);
}

/** Schedules one full phrase starting at `startAt` (an AudioContext time). */
function schedulePhrase(startAt) {
  for (let i = 0; i < STEPS_PER_PHRASE; i++) {
    const t = startAt + i * STEP_SECONDS;
    scheduleChug(RIFF[i], t, STEP_SECONDS * 0.9);
    scheduleHihat(t);
    if (KICK_STEPS.has(i)) scheduleKick(t);
    if (SNARE_STEPS.has(i)) scheduleSnare(t);
  }

  // a sparse lead accent riding on top, once per phrase
  scheduleLeadNote(LEAD.E5, startAt + STEP_SECONDS * 6, STEP_SECONDS * 1.6, 0.045);
  scheduleLeadNote(LEAD.D5, startAt + STEP_SECONDS * 8, STEP_SECONDS * 0.8, 0.04);
  scheduleLeadNote(LEAD.B4, startAt + STEP_SECONDS * 9, STEP_SECONDS * 0.8, 0.04);
  scheduleLeadNote(LEAD.G4, startAt + STEP_SECONDS * 13, STEP_SECONDS * 1.4, 0.045);
}

function musicLoop() {
  if (!musicPlaying) return;
  const c = getCtx();
  schedulePhrase(c.currentTime + 0.05);
  musicTimer = setTimeout(musicLoop, (PHRASE_SECONDS - 0.3) * 1000);
}

export function startMusic() {
  const c = getCtx();
  const gain = getMusicGain();
  if (musicPlaying) return;
  musicPlaying = true;
  gain.gain.cancelScheduledValues(c.currentTime);
  gain.gain.setValueAtTime(gain.gain.value, c.currentTime);
  gain.gain.linearRampToValueAtTime(musicVolumeTarget, c.currentTime + 1.2);
  musicLoop();
}

export function stopMusic() {
  musicPlaying = false;
  if (musicTimer) clearTimeout(musicTimer);
  if (musicGain) {
    const c = getCtx();
    musicGain.gain.cancelScheduledValues(c.currentTime);
    musicGain.gain.setValueAtTime(musicGain.gain.value, c.currentTime);
    musicGain.gain.linearRampToValueAtTime(0, c.currentTime + 0.6);
  }
}

export function toggleMusic() {
  if (musicPlaying) stopMusic();
  else startMusic();
  return musicPlaying;
}

export function isMusicPlaying() {
  return musicPlaying;
}
