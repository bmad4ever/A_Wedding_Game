// Every sound in the game is synthesised with WebAudio, except the processional fanfare (one small mp3).
import { asset } from './assets.js';
let ctx = null, master, musicBus, sfxBus, noiseBuf, comp;
const S = { baby: null, fanfare: null, musicOn: false, step: 0, nextTime: 0, bpm: 112, flute: null, fireNode: null, motor: null, sprinkler: null, murmur: null, feedback: null, volume: 0.8 };

export function initAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  master = ctx.createGain(); master.gain.value = S.volume;
  master.connect(comp); comp.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.42; musicBus.connect(master);
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  loadFanfare();
}
export function setVolume(v) { S.volume = v; if (master) master.gain.value = v; }
export const now = () => (ctx ? ctx.currentTime : 0);
export const ready = () => !!ctx;

// ---------- primitives ----------
function env(g, t, a, peak, dcy, sus = 0.0001) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + dcy);
}
function osc(type, freq, t, dur, { gain = 0.2, a = 0.005, out = sfxBus, detune = 0, slideTo = null, filter = null } = {}) {
  if (!ctx) return;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t); o.detune.value = detune;
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  env(g, t, a, gain, dur);
  let node = o;
  if (filter) { const f = ctx.createBiquadFilter(); f.type = filter.type || 'lowpass'; f.frequency.value = filter.f; f.Q.value = filter.q || 1; o.connect(f); node = f; }
  node.connect(g); g.connect(out);
  o.start(t); o.stop(t + a + dur + 0.05);
  return o;
}
function noise(t, dur, { gain = 0.3, type = 'bandpass', f = 1000, q = 1, a = 0.005, out = sfxBus, fTo = null } = {}) {
  if (!ctx) return;
  const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
  const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
  if (fTo) fl.frequency.exponentialRampToValueAtTime(fTo, t + dur);
  const g = ctx.createGain(); env(g, t, a, gain, dur);
  s.connect(fl); fl.connect(g); g.connect(out);
  s.start(t, Math.random()); s.stop(t + a + dur + 0.05);
  return { s, fl, g };
}
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------- music: cheesy 112 BPM wedding pop ----------
const CHORDS = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]]; // C G Am F
export function startMusic() {
  if (!ctx || S.musicOn) return;
  S.musicOn = true; S.step = 0; S.nextTime = ctx.currentTime + 0.1; S.startTime = S.nextTime;
  musicBus.gain.cancelScheduledValues(ctx.currentTime);
  musicBus.gain.setValueAtTime(0.42, ctx.currentTime);
}
export function musicDuck(v = 0.15, time = 0.4) { if (ctx) musicBus.gain.linearRampToValueAtTime(v, ctx.currentTime + time); }
export function musicUnduck(time = 0.8) { if (ctx) musicBus.gain.linearRampToValueAtTime(0.42, ctx.currentTime + time); }
export function stopMusic(mode = 'cut') {
  if (!ctx || !S.musicOn) return;
  S.musicOn = false;
  const t = ctx.currentTime;
  if (mode === 'scratch') recordScratch();
  if (mode === 'powerdown') { osc('sawtooth', 220, t, 1.4, { gain: 0.25, slideTo: 25, out: sfxBus, filter: { f: 900 } }); }
  musicBus.gain.cancelScheduledValues(t);
  musicBus.gain.setValueAtTime(0.0, t + 0.02);
  setTimeout(() => { if (!S.musicOn && musicBus) musicBus.gain.setValueAtTime(0.42, ctx.currentTime); }, 1600);
}
function scheduleMusic() {
  const spb = 60 / S.bpm / 4; // sixteenth
  while (S.nextTime < ctx.currentTime + 0.15) {
    const t = S.nextTime, st = S.step % 16, bar = Math.floor(S.step / 16) % 4, ch = CHORDS[bar];
    if (st % 4 === 0) { // kick
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      env(g, t, 0.002, 0.9, 0.18); o.connect(g); g.connect(musicBus); o.start(t); o.stop(t + 0.25);
    }
    if (st === 4 || st === 12) noise(t, 0.12, { gain: 0.35, f: 1800, q: 0.8, out: musicBus });
    if (st % 4 === 2) noise(t, 0.04, { gain: 0.15, type: 'highpass', f: 7000, out: musicBus });
    if (st % 2 === 0) osc('square', mtof(ch[0] - 24 + (st % 8 === 6 ? 12 : 0)), t, spb * 1.6, { gain: 0.13, out: musicBus, filter: { f: 600 } });
    osc('square', mtof(ch[st % 3] + 12 + (st % 6 === 5 ? 12 : 0)), t, spb * 0.8, { gain: 0.035, out: musicBus, filter: { f: 3000 } });
    if (st === 0) for (const n of ch) osc('sawtooth', mtof(n), t, spb * 15, { gain: 0.03, a: 0.15, out: musicBus, detune: (Math.random() - 0.5) * 14, filter: { f: 1400 } });
    if (bar === 3 && st === 14) osc('sine', mtof(84), t, 0.6, { gain: 0.05, out: musicBus }); // twinkle
    S.nextTime += spb; S.step++;
  }
}
export function beatPhase() { // 0..1 within the current beat, for dance-floor lights
  if (!ctx || !S.musicOn) return -1;
  const spb = 60 / S.bpm;
  return (((ctx.currentTime - S.startTime) / spb) % 1 + 1) % 1;
}
export function musicPlaying() { return S.musicOn; }
// continuous beat count since the music started (for the dance-off), or -1 without music
export function beatTime() {
  if (!ctx || !S.musicOn) return -1;
  return (ctx.currentTime - S.startTime) / (60 / S.bpm);
}

// ---------- the processional: a real orchestra, then Reginald ----------
// Mendelssohn's Wedding March, opening fanfare (public-domain recording by the European Archive, via
// Musopen / Wikimedia Commons), trimmed to end on the first C-major cadence. The one sound that isn't synthesised.
const FANFARE_URL = 'assets/audio/wedding_march_fanfare.mp3';
const FANFARE_CUE = 9.9; // seconds in: the orchestra lands on C and fades, and the flute's pickup goes here
let fanfareBuf = null, fanfareLoading = null;
export function loadFanfare() {
  if (!ctx || fanfareBuf || fanfareLoading) return fanfareLoading;
  fanfareLoading = fetch(asset(FANFARE_URL)).then((r) => r.arrayBuffer())
    .then((b) => new Promise((res, rej) => ctx.decodeAudioData(b, res, rej)))
    .then((buf) => { fanfareBuf = buf; }).catch(() => { fanfareLoading = null; });
  return fanfareLoading;
}
// plays the fanfare; returns { cue } = seconds until the flute should come in
export function weddingFanfare() {
  if (!ctx) return { cue: 0 };
  if (!fanfareBuf) { trumpetFanfare(); return { cue: 1.4 }; } // not decoded (yet): the old synth fanfare
  const s = ctx.createBufferSource(); s.buffer = fanfareBuf;
  const g = ctx.createGain(); g.gain.value = 0.9;
  s.connect(g); g.connect(sfxBus); s.start(ctx.currentTime + 0.05);
  S.fanfare = s; s.onended = () => { if (S.fanfare === s) S.fanfare = null; };
  return { cue: FANFARE_CUE + 0.05 };
}
function fanfareStop() { if (S.fanfare) { try { S.fanfare.stop(); } catch (e) { /* already stopped */ } S.fanfare = null; } }

// "Here Comes the Bride" (Wagner, Bridal Chorus) in C, as [midi, beats]. G4 = 67.
const BRIDAL = [
  [67, 1], [72, 0.75], [72, 0.25], [72, 2],
  [67, 1], [74, 0.75], [71, 0.25], [72, 2],
  [67, 1], [72, 0.75], [77, 0.25], [77, 1], [76, 0.75], [74, 0.25], [72, 1], [71, 0.75], [72, 0.25], [74, 2],
  [67, 1], [72, 0.75], [72, 0.25], [72, 2],
  [67, 1], [74, 0.75], [71, 0.25], [72, 2],
  [67, 1], [72, 0.75], [76, 0.25], [79, 1], [76, 0.75], [72, 0.25], [69, 1], [72, 0.75], [71, 0.25], [72, 2],
];

// ---------- the flute from hell (or, if someone swiped it, the kazoo from hell) ----------
// It starts out genuinely lovely. `frenzy` (0..1) is how far it has fallen: the pitch sags, notes go wrong,
// the tempo bolts, the vibrato turns into a siren, and past ~0.85 the melody gives up entirely.
export function fluteStart(kind = 'flute', delay = 0) {
  if (!ctx) return;
  const kazoo = kind === 'kazoo';
  const t0 = ctx.currentTime + 0.05 + delay;
  const f = { frenzy: 0, next: t0, note: kazoo ? 67 : 79, notes: 0, kazoo, i: 0, oct: kazoo ? 0 : 12 };
  f.out = ctx.createGain(); f.out.gain.value = 0.0001; f.out.connect(sfxBus);
  f.art = ctx.createGain(); f.art.gain.value = 1; f.art.connect(f.out); // tonguing between notes
  f.o1 = ctx.createOscillator(); f.o1.type = kazoo ? 'sawtooth' : 'triangle';
  f.o2 = ctx.createOscillator(); f.o2.type = kazoo ? 'square' : 'sawtooth'; f.o2.detune.value = kazoo ? 30 : 4;
  f.o3 = ctx.createOscillator(); f.o3.type = 'sine';
  f.g2 = ctx.createGain(); f.g2.gain.value = kazoo ? 0.35 : 0.05;
  f.screech = ctx.createGain(); f.screech.gain.value = 0;
  // a kazoo is a buzz through a nasal formant
  f.lp = ctx.createBiquadFilter(); f.lp.type = kazoo ? 'bandpass' : 'lowpass'; f.lp.frequency.value = kazoo ? 1100 : 2200; f.lp.Q.value = kazoo ? 2.5 : 0.7;
  f.vib = ctx.createOscillator(); f.vib.frequency.value = 5.2;
  f.vibG = ctx.createGain(); f.vibG.gain.value = 0;
  f.vib.connect(f.vibG); f.vibG.connect(f.o1.detune); f.vibG.connect(f.o2.detune); f.vibG.connect(f.o3.detune);
  f.o1.connect(f.lp); f.o2.connect(f.g2); f.g2.connect(f.lp); f.o3.connect(f.screech); f.screech.connect(f.art); f.lp.connect(f.art);
  // breath
  f.br = ctx.createBufferSource(); f.br.buffer = noiseBuf; f.br.loop = true;
  const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.frequency.value = 2400; bf.Q.value = 1.2;
  f.brG = ctx.createGain(); f.brG.gain.value = kazoo ? 0.0001 : 0.02;
  f.br.connect(bf); bf.connect(f.brG); f.brG.connect(f.art);
  f.o1.frequency.value = f.o2.frequency.value = mtof(f.note);
  [f.o1, f.o2, f.o3, f.vib, f.br].forEach((o) => o.start());
  f.out.gain.setValueAtTime(0.0001, t0);
  f.out.gain.linearRampToValueAtTime(0.3, t0 + 0.12);
  S.flute = f;
}
export function fluteFrenzy(k) { if (S.flute) S.flute.frenzy = k; }
export function fluteStop() {
  const f = S.flute; if (!f) return;
  const t = ctx.currentTime;
  f.out.gain.cancelScheduledValues(t); f.out.gain.setValueAtTime(f.out.gain.value, t); f.out.gain.linearRampToValueAtTime(0.0001, t + 0.15);
  [f.o1, f.o2, f.o3, f.vib, f.br].forEach((o) => o.stop(t + 0.2));
  S.flute = null;
}
function scheduleFlute() {
  const f = S.flute;
  if (ctx.currentTime < f.next - 0.05) return;
  const t = Math.max(f.next, ctx.currentTime);
  const fr = f.frenzy, bad = fr * fr;
  let note, beats, off;
  if (fr < 0.85 || Math.random() > (fr - 0.85) * 5) {
    // the melody, played less and less like the melody
    const [n, b] = BRIDAL[f.i++ % BRIDAL.length];
    note = n + f.oct; beats = b;
    if (Math.random() < bad * 0.45) note += Math.random() < 0.35 ? 12 : (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 3)); // cracked octave / wrong note
    if (Math.random() < bad * 0.5) beats *= Math.random() < 0.5 ? 0.5 : 1.75; // lost count
    off = (Math.random() - 0.5) * bad * 160;
  } else {
    // "free improvisation"
    const scale = [0, 2, 3, 5, 7, 8, 10, 11, 13];
    note = f.note + (Math.random() < 0.7 ? Math.round((Math.random() - 0.5) * (2 + fr * 14)) : scale[Math.floor(Math.random() * scale.length)] - 5);
    beats = Math.random() < 0.2 ? 1.4 : 0.35;
    off = (Math.random() - 0.5) * 120;
  }
  const lo = f.kazoo ? 55 : 67, hi = f.kazoo ? 84 : 98;
  f.note = Math.max(lo, Math.min(hi, note));
  // the whole instrument sags flat and wobbles: the out-of-tune part
  const drift = -bad * 70 + Math.sin(f.notes * 0.7) * fr * 25;
  const fq = mtof(f.note) * Math.pow(2, (off + drift) / 1200);
  const dur = beats * 0.62 / (1 + fr * 0.9);
  const glide = 0.012 + fr * 0.09 * Math.random(); // clean slurs become slides
  [f.o1, f.o2].forEach((o) => { o.frequency.cancelScheduledValues(t); o.frequency.setValueAtTime(o.frequency.value, t); o.frequency.exponentialRampToValueAtTime(fq, t + glide); });
  f.o3.frequency.setValueAtTime(fq * 3.01, t);
  // tonguing: a little dip before each next note (fades as Reginald stops caring)
  f.art.gain.cancelScheduledValues(t);
  f.art.gain.setTargetAtTime(1, t, 0.012);
  if (dur > 0.15) f.art.gain.setTargetAtTime(1 - 0.55 * (1 - fr), t + dur - 0.06, 0.015);
  f.screech.gain.setTargetAtTime(fr > 0.3 && Math.random() < fr * 0.6 ? 0.08 + fr * 0.1 : 0, t, 0.02);
  // vibrato: delayed and gentle at first, a siren by the end
  f.vibG.gain.cancelScheduledValues(t); f.vibG.gain.setValueAtTime(fr * 20, t); f.vibG.gain.linearRampToValueAtTime(8 + fr * 70, t + Math.min(dur, 0.35));
  f.vib.frequency.setValueAtTime(5.2 + fr * 5, t);
  if (!f.kazoo) { f.lp.frequency.setValueAtTime(2200 + fr * 1600, t); f.g2.gain.setValueAtTime(0.05 + fr * 0.15, t); f.brG.gain.setValueAtTime(0.02 + fr * 0.11, t); }
  f.next = t + dur; f.notes++;
}

// ---------- feedback squeal ----------
export function feedbackStart() {
  if (!ctx || S.feedback) return;
  const t = ctx.currentTime;
  const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 1.6); g.connect(sfxBus);
  const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(2200, t); o.frequency.linearRampToValueAtTime(3300, t + 2.5);
  const o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.setValueAtTime(4410, t);
  const lfo = ctx.createOscillator(); lfo.frequency.value = 7; const lg = ctx.createGain(); lg.gain.value = 40; lfo.connect(lg); lg.connect(o.frequency);
  const g2 = ctx.createGain(); g2.gain.value = 0.4;
  o.connect(g); o2.connect(g2); g2.connect(g);
  [o, o2, lfo].forEach((x) => x.start());
  S.feedback = { g, list: [o, o2, lfo] };
}
export function feedbackStop() {
  const f = S.feedback; if (!f) return;
  const t = ctx.currentTime;
  f.g.gain.cancelScheduledValues(t); f.g.gain.setValueAtTime(f.g.gain.value, t); f.g.gain.linearRampToValueAtTime(0.0001, t + 0.08);
  f.list.forEach((o) => o.stop(t + 0.1)); S.feedback = null;
}

// ---------- one-shots ----------
export function recordScratch() {
  if (!ctx) return; const t = ctx.currentTime;
  noise(t, 0.12, { gain: 0.5, f: 1200, q: 3, fTo: 300 }); noise(t + 0.13, 0.18, { gain: 0.5, f: 400, q: 3, fTo: 2400 });
}
export function crash(size = 1) {
  if (!ctx) return; const t = ctx.currentTime;
  noise(t, 0.5 * size, { gain: 0.6, type: 'lowpass', f: 2500, fTo: 200 });
  osc('sine', 110, t, 0.35 * size, { gain: 0.7, slideTo: 35 });
  for (let i = 0; i < 6 * size; i++) noise(t + Math.random() * 0.3 * size, 0.08, { gain: 0.25, f: 600 + Math.random() * 2400, q: 4 });
}
export function thud() { if (!ctx) return; const t = ctx.currentTime; osc('sine', 90, t, 0.2, { gain: 0.6, slideTo: 40 }); noise(t, 0.08, { gain: 0.2, type: 'lowpass', f: 700 }); }
export function glass(n = 1) {
  if (!ctx) return; const t = ctx.currentTime;
  for (let i = 0; i < n; i++) {
    const tt = t + Math.random() * 0.25 * Math.min(n, 6);
    noise(tt, 0.15, { gain: 0.3, type: 'highpass', f: 4000 });
    for (let k = 0; k < 3; k++) osc('sine', 2500 + Math.random() * 4500, tt + Math.random() * 0.03, 0.25 + Math.random() * 0.4, { gain: 0.08 });
  }
}
export function tink() { if (!ctx) return; osc('sine', 3800 + Math.random() * 800, ctx.currentTime, 0.4, { gain: 0.07 }); }
export function zap(len = 1) {
  if (!ctx) return; const t = ctx.currentTime;
  for (let i = 0; i < 10 * len; i++) {
    const tt = t + Math.random() * 0.8 * len;
    osc('sawtooth', 60 + Math.random() * 900, tt, 0.05 + Math.random() * 0.08, { gain: 0.25, slideTo: 40 + Math.random() * 3000 });
    noise(tt, 0.05, { gain: 0.3, type: 'highpass', f: 3000 });
  }
  osc('square', 50, t, 0.8 * len, { gain: 0.15 });
}
export function spark() { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.04, { gain: 0.3, type: 'highpass', f: 5000 }); osc('square', 1500 + Math.random() * 2000, t, 0.03, { gain: 0.05 }); }
export function bark(pitch = 1) {
  if (!ctx) return; const t = ctx.currentTime;
  osc('sawtooth', 520 * pitch, t, 0.12, { gain: 0.3, slideTo: 260 * pitch, filter: { f: 1400, q: 3 } });
  noise(t, 0.08, { gain: 0.15, f: 900 * pitch, q: 2 });
}
export function whine() { if (!ctx) return; const t = ctx.currentTime; osc('sine', 900, t, 0.6, { gain: 0.1, slideTo: 1400 }); osc('sine', 1400, t + 0.6, 0.5, { gain: 0.08, slideTo: 900 }); }
export function growl() { if (!ctx) return; const t = ctx.currentTime; osc('sawtooth', 90, t, 0.8, { gain: 0.25, filter: { f: 400, q: 2 } }); }
export function chomp() { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.06, { gain: 0.5, type: 'lowpass', f: 1200 }); osc('square', 180, t, 0.06, { gain: 0.3, slideTo: 60 }); }
export function shutter() { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.025, { gain: 0.35, type: 'highpass', f: 3000 }); noise(t + 0.06, 0.03, { gain: 0.3, type: 'highpass', f: 2500 }); osc('sine', 3000, t, 0.05, { gain: 0.03 }); }
export function ding() { if (!ctx) return; const t = ctx.currentTime; osc('sine', mtof(84), t, 0.5, { gain: 0.15 }); osc('sine', mtof(91), t + 0.09, 0.8, { gain: 0.13 }); }
export function sadTrombone() {
  if (!ctx) return; const t = ctx.currentTime;
  [[58, 0.35], [57, 0.35], [56, 0.35], [55, 1.2]].reduce((tt, [n, d]) => {
    const o = osc('sawtooth', mtof(n), tt, d, { gain: 0.15, a: 0.03, filter: { f: 900 } });
    if (d > 1 && o) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 6; lg.gain.value = 30; l.connect(lg); lg.connect(o.detune); l.start(tt); l.stop(tt + d); }
    return tt + d;
  }, t);
}
export function slurp() { if (!ctx) return; const t = ctx.currentTime; noise(t, 0.5, { gain: 0.25, f: 500, q: 6, fTo: 1600 }); noise(t + 0.55, 0.2, { gain: 0.2, f: 700, q: 6, fTo: 300 }); }
export function gulp() { if (!ctx) return; const t = ctx.currentTime; osc('sine', 300, t, 0.1, { gain: 0.3, slideTo: 120 }); osc('sine', 260, t + 0.22, 0.1, { gain: 0.3, slideTo: 110 }); }
export function rattle() { if (!ctx) return; const t = ctx.currentTime; for (let i = 0; i < 14; i++) noise(t + i * 0.045 + Math.random() * 0.02, 0.03, { gain: 0.3, f: 900 + Math.random() * 1600, q: 5 }); }
export function whoosh() { if (!ctx) return; noise(ctx.currentTime, 0.45, { gain: 0.3, f: 300, q: 1, fTo: 2500 }); }
export function boing() { if (!ctx) return; const t = ctx.currentTime; const o = osc('sine', 180, t, 0.5, { gain: 0.3, slideTo: 420 }); if (o) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 18; lg.gain.value = 60; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + 0.5); } }
export function gasp() { if (!ctx) return; const t = ctx.currentTime; for (let i = 0; i < 6; i++) noise(t + Math.random() * 0.1, 0.5, { gain: 0.12, f: 900 + Math.random() * 900, q: 5, a: 0.08, fTo: 1400 + Math.random() * 600 }); }
export function scream(n = 3, pitch = 1) {
  if (!ctx) return; const t = ctx.currentTime;
  for (let i = 0; i < n; i++) {
    const tt = t + Math.random() * 0.4, f = (500 + Math.random() * 500) * pitch, d = 0.6 + Math.random() * 0.9;
    const o = osc('sawtooth', f, tt, d, { gain: 0.07, a: 0.05, slideTo: f * (0.7 + Math.random() * 0.2), filter: { f: 2200, q: 4, type: 'bandpass' } });
    if (o) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 7 + Math.random() * 4; lg.gain.value = 40; l.connect(lg); lg.connect(o.detune); l.start(tt); l.stop(tt + d + 0.1); }
  }
}
export function applause(dur = 2.5, n = 90) {
  if (!ctx) return; const t = ctx.currentTime;
  for (let i = 0; i < n; i++) noise(t + Math.random() * dur, 0.03, { gain: 0.08 + Math.random() * 0.08, f: 1000 + Math.random() * 2000, q: 1.5 });
}
export function bird() {
  if (!ctx) return; const t = ctx.currentTime, b = 2500 + Math.random() * 2000;
  const n = 2 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) osc('sine', b, t + i * 0.11, 0.07, { gain: 0.03, slideTo: b * (1.2 + Math.random() * 0.4) });
}
export function hiccup() { if (!ctx) return; const t = ctx.currentTime; osc('sine', 520, t, 0.09, { gain: 0.18, slideTo: 900 }); noise(t, 0.05, { gain: 0.12, f: 1400, q: 3 }); }
// footstep on grass / gravel / dance-floor tiles
export function footstep(surface = 'grass', run = false) {
  if (!ctx) return; const t = ctx.currentTime, v = run ? 1.3 : 1;
  if (surface === 'tile') { osc('sine', 180 + Math.random() * 40, t, 0.05, { gain: 0.07 * v, slideTo: 90 }); noise(t, 0.025, { gain: 0.05 * v, type: 'highpass', f: 3500 }); }
  else if (surface === 'gravel') { for (let i = 0; i < 3; i++) noise(t + i * 0.012, 0.03, { gain: 0.05 * v, f: 2500 + Math.random() * 2000, q: 2 }); }
  else noise(t, 0.07, { gain: 0.045 * v, type: 'lowpass', f: 900 + Math.random() * 300, a: 0.01 });
}
// a far-off motorcycle rev, for anyone paying attention
export function distantEngine() {
  if (!ctx) return; const t = ctx.currentTime;
  const o = osc('sawtooth', 60, t, 1.6, { gain: 0.035, a: 0.2, slideTo: 150, filter: { f: 380 } });
  if (o) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 24; lg.gain.value = 20; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + 1.8); }
}
export function distantBoom(k = 1) { // far-off giant monster impact: a low, soft thump and rumble
  if (!ctx) return; const t = ctx.currentTime;
  osc('sine', 55, t, 0.9, { gain: 0.16 * k, slideTo: 30 });
  noise(t, 1.6, { gain: 0.1 * k, type: 'lowpass', f: 180, a: 0.05 });
}
export function skid() { if (!ctx) return; noise(ctx.currentTime, 0.9, { gain: 0.35, f: 1800, q: 8, fTo: 900 }); }
export function trumpetFanfare() {
  if (!ctx) return; const t = ctx.currentTime;
  [[67, 0.15], [67, 0.15], [67, 0.15], [72, 0.6]].reduce((tt, [n, d]) => { osc('sawtooth', mtof(n), tt, d, { gain: 0.1, a: 0.02, filter: { f: 2500 } }); osc('square', mtof(n + 12), tt, d, { gain: 0.03, a: 0.02, filter: { f: 3000 } }); return tt + d + 0.03; }, t);
}
// ---------- loops ----------
export function fireLoop(intensity) {
  if (!ctx) return;
  if (!S.fireNode && intensity > 0) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700;
    const g = ctx.createGain(); g.gain.value = 0;
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start();
    S.fireNode = { s, g, i: 0 };
  }
  if (S.fireNode) {
    S.fireNode.i = intensity;
    S.fireNode.g.gain.setTargetAtTime(0.25 * intensity, ctx.currentTime, 0.3);
    if (intensity <= 0) { const n = S.fireNode; setTimeout(() => n.s.stop(), 1500); S.fireNode = null; }
  }
}
export function motorLoop(on, rev = 0) {
  if (!ctx) return;
  if (on && !S.motor) {
    const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 45;
    const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 22.5;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
    const g = ctx.createGain(); g.gain.value = 0;
    const am = ctx.createOscillator(); am.frequency.value = 26; const amg = ctx.createGain(); amg.gain.value = 0.12;
    am.connect(amg); amg.connect(g.gain);
    o.connect(f); o2.connect(f); f.connect(g); g.connect(sfxBus);
    [o, o2, am].forEach((x) => x.start());
    S.motor = { o, o2, g, am, f };
  }
  if (S.motor) {
    const m = S.motor, t = ctx.currentTime;
    if (!on) { m.g.gain.setTargetAtTime(0, t, 0.3); const mm = m; setTimeout(() => [mm.o, mm.o2, mm.am].forEach((x) => x.stop()), 1500); S.motor = null; return; }
    m.g.gain.setTargetAtTime(0.18 + rev * 0.1, t, 0.1);
    m.o.frequency.setTargetAtTime(45 + rev * 90, t, 0.15); m.o2.frequency.setTargetAtTime(22.5 + rev * 45, t, 0.15);
    m.am.frequency.setTargetAtTime(26 + rev * 40, t, 0.15); m.f.frequency.setTargetAtTime(500 + rev * 1200, t, 0.15);
  }
}
export function sprinklerLoop(on) {
  if (!ctx) return;
  if (on && !S.sprinkler) {
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 3000;
    const g = ctx.createGain(); g.gain.value = 0; g.gain.setTargetAtTime(0.14, ctx.currentTime, 0.5);
    s.connect(f); f.connect(g); g.connect(sfxBus); s.start();
    S.sprinkler = { s, g };
  } else if (!on && S.sprinkler) { S.sprinkler.g.gain.setTargetAtTime(0, ctx.currentTime, 0.4); const sp = S.sprinkler; setTimeout(() => sp.s.stop(), 2000); S.sprinkler = null; }
}
// a baby wailing: rising-falling "WAAAH"s with a little gasp for air between them (level 0..1; 0 stops)
export function babyCry(level = 1) {
  if (!ctx) return;
  if (level <= 0) { S.baby = null; return; }
  if (!S.baby) S.baby = { next: ctx.currentTime + 0.05, level };
  S.baby.level = level;
}
function scheduleBaby() {
  const b = S.baby, t = ctx.currentTime;
  if (b.next > t + 0.1) return;
  const tt = Math.max(b.next, t), d = 0.7 + Math.random() * 0.7, f = 420 + Math.random() * 110;
  for (const [type, mul, g, fc] of [['sawtooth', 1, 0.07, 1300], ['triangle', 2, 0.035, 2600]]) {
    const o = osc(type, f * mul, tt, d, { gain: g * b.level, a: 0.06, filter: { type: 'bandpass', f: fc, q: 2.5 } });
    if (!o) continue;
    o.frequency.setValueAtTime(f * mul * 0.82, tt);
    o.frequency.linearRampToValueAtTime(f * mul * 1.12, tt + d * 0.25);
    o.frequency.linearRampToValueAtTime(f * mul * 0.78, tt + d);
    const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = 6 + Math.random() * 3; lg.gain.value = 45;
    l.connect(lg); lg.connect(o.detune); l.start(tt); l.stop(tt + d + 0.1);
  }
  noise(tt + d + 0.12, 0.2, { gain: 0.06 * b.level, f: 2200, q: 2, a: 0.08, fTo: 3200 }); // *gasp*
  b.next = tt + d + 0.45 + Math.random() * 0.25;
}

export function murmurLoop(level) {
  // soft crowd bed: two low noise bands with slow, unrelated swells (no fast rhythmic sweep:
  // a 3 Hz filter wobble here used to read as someone crunching through the grass)
  if (!ctx) return;
  if (!S.murmur) {
    const g = ctx.createGain(); g.gain.value = 0; g.connect(sfxBus);
    for (const [fc, rate] of [[320, 0.13], [650, 0.21]]) {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
      const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fc; f.Q.value = 0.5;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
      const sw = ctx.createGain(); sw.gain.value = 0.6;
      const lfo = ctx.createOscillator(); lfo.frequency.value = rate; const lg = ctx.createGain(); lg.gain.value = 0.35;
      lfo.connect(lg); lg.connect(sw.gain); lfo.start();
      s.connect(f); f.connect(lp); lp.connect(sw); sw.connect(g); s.start(0, Math.random());
    }
    S.murmur = { g };
  }
  S.murmur.g.gain.setTargetAtTime(level * 0.018, ctx.currentTime, 0.5);
}

// ---------- babble voice (Animal-Crossing style) ----------
export function babble(text, pitch = 1, rate = 1) {
  if (!ctx) return 0;
  const t = ctx.currentTime;
  let i = 0, tt = t;
  const clean = text.replace(/[^a-zA-Z!? ]/g, '').slice(0, 60);
  for (const ch of clean) {
    if (ch === ' ') { tt += 0.05 / rate; continue; }
    const code = ch.toLowerCase().charCodeAt(0) - 97;
    const f = 180 * pitch * Math.pow(2, ((code % 7) - 3) / 12 + (ch === '!' ? 0.3 : 0));
    osc(i % 2 ? 'square' : 'triangle', f, tt, 0.045 / rate, { gain: 0.05, filter: { f: 1800 * pitch } });
    tt += 0.065 / rate; i++;
  }
  return tt - t;
}

export function updateAudio() {
  if (!ctx) return;
  if (S.musicOn) scheduleMusic();
  if (S.flute) scheduleFlute();
  if (S.baby) scheduleBaby();
  if (S.fireNode && Math.random() < 0.25 * S.fireNode.i) noise(ctx.currentTime, 0.02, { gain: 0.12 * S.fireNode.i, type: 'highpass', f: 2000 + Math.random() * 3000 });
}
export function stopAllLoops() {
  stopMusic(); fanfareStop(); fluteStop(); feedbackStop(); fireLoop(0); motorLoop(false); sprinklerLoop(false); babyCry(0);
}
