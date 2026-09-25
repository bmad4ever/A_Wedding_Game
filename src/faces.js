// Face billboard textures. Uses the pre-generated ComfyUI portraits in assets/faces,
// with a procedurally drawn cartoon face as fallback if a file is missing.
import * as THREE from 'three';
import { asset, FACE_NAMES, BACK_NAMES } from './assets.js';

export const FACES = {};

const EXTRA = ['flutist_bliss', 'flutist_shock', 'bride_love', 'groom_cry', 'mom_shock', 'grandma_shock', 'officiant_shock', 'ex_wink',
  'kid1_savage', 'kid2_savage', 'kid3_savage', 'kid4_savage', 'baby_cry'];

// Customisable characters and the expression variants the game swaps to. A custom face overrides the
// neutral one and every variant; a variant that wasn't generated falls back to the custom neutral face.
export const VARIANTS = { bride: ['bride_shock', 'bride_love'], groom: ['groom_shock', 'groom_cry'] };
const OVERRIDE = {};
export function setCustom(who, neutral, variants = {}, back = null) {
  for (const n of [who, ...VARIANTS[who]]) {
    if (neutral) {
      OVERRIDE[n] = n === who ? neutral : (variants[n] || neutral);
      if (back) BACKS.set(OVERRIDE[n], back);
    } else delete OVERRIDE[n];
  }
}

// Generated back-of-head sprites: front texture -> back texture. Every expression of a character
// shares that character's one back view ('bride_shock' -> 'bride_back').
const BACKS = new WeakMap();
const baseOf = (name) => name.split('_')[0];
export const isCustom = (who) => !!OVERRIDE[who];

function fallbackFace(name) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  const g = cv.getContext('2d');
  let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const skin = ['#f2c6a0', '#e0a878', '#c68a5a', '#8d5a3a', '#f7d7c0'][h % 5];
  const hair = ['#3b2314', '#d9a441', '#111', '#8a3b12', '#bbb'][(h >> 3) % 5];
  g.fillStyle = hair; g.beginPath(); g.ellipse(128, 110, 100, 96, 0, Math.PI, 0); g.fill();
  g.fillStyle = skin; g.strokeStyle = '#3a2210'; g.lineWidth = 8;
  g.beginPath(); g.ellipse(128, 140, 88, 104, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = hair; g.beginPath(); g.ellipse(128, 70, 84, 40, 0, Math.PI, 0); g.fill();
  const shock = /shock|pain/.test(name);
  g.fillStyle = '#fff'; g.beginPath(); g.arc(95, 130, shock ? 22 : 16, 0, 7); g.arc(161, 130, shock ? 22 : 16, 0, 7); g.fill();
  g.fillStyle = '#222'; g.beginPath(); g.arc(97, 132, 7, 0, 7); g.arc(159, 132, 7, 0, 7); g.fill();
  g.strokeStyle = '#6a2a1a'; g.lineWidth = 7; g.beginPath();
  if (shock) { g.fillStyle = '#6a1a1a'; g.ellipse(128, 195, 22, 30, 0, 0, 7); g.fill(); }
  else { g.arc(128, 175, 36, 0.2, Math.PI - 0.2); g.stroke(); }
  const t = new THREE.CanvasTexture(normaliseHead(cv)); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Head sprites are "head + neck" squares: the neck bottom is the bottom edge (centred), and the
// neck is NECK x the head height (top of hair to chin). tools/crop_faces.py does the same for the
// bundled faces; this handles generated/uploaded ones at runtime. Images without a neck (photos,
// the fallback face) get one painted on in their skin colour.
export const NECK = 0.22;
export function normaliseHead(src, S = 256) {
  const pad = Math.round(Math.max(src.width, src.height) * 0.6);
  const W = src.width + pad * 2, H = src.height + pad;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(src, pad, 0);
  const d = g.getImageData(0, 0, W, H).data;
  const L = new Int32Array(H).fill(-1), R = new Int32Array(H).fill(-1);
  let top = -1, bot = -1;
  for (let y = 0; y < H; y++) {
    let l = -1, r = -1;
    for (let x = 0; x < W; x++) if (d[(y * W + x) * 4 + 3] > 40) { if (l < 0) l = x; r = x; }
    if (l >= 0) { L[y] = l; R[y] = r; if (top < 0) top = y; bot = y; }
  }
  if (top < 0) return src;
  const wid = (y) => (L[y] < 0 ? 0 : R[y] - L[y] + 1);
  const hh = bot - top;
  let m = -1;
  for (let y = Math.floor(top + 0.5 * hh); y < bot - 0.06 * hh; y++) if (wid(y) > 3 && (m < 0 || wid(y) < wid(m))) m = y;
  let maxW = 0; for (let y = top; y <= bot; y++) maxW = Math.max(maxW, wid(y));
  let target, cx;
  if (m > 0 && wid(m) < 0.55 * maxW && wid(m - Math.round(0.05 * hh)) <= 1.15 * wid(m)) { // (an oval narrows fast; a neck doesn't)
    // has a neck: find the jaw, trim/extend the neck to the standard length, clip collars to it
    const nw = wid(m);
    let chin = m; while (chin > top && wid(chin) <= 1.2 * nw) chin--;
    let b0 = m; while (b0 + 1 <= bot && wid(b0 + 1) >= 0.85 * nw && wid(b0 + 1) <= 1.3 * nw) b0++;
    target = Math.round(chin + NECK * (chin - top));
    const nl = L[m] - 2, nr = R[m] + 3;
    g.clearRect(0, m + 1, nl, H); g.clearRect(nr, m + 1, W - nr, H);
    const srcRow = Math.max(m, Math.min(b0, target) - 3);
    g.clearRect(0, srcRow + 1, W, H);
    if (target > srcRow + 1) g.drawImage(cv, 0, srcRow, W, 1, 0, srcRow + 1, W, target - srcRow - 1);
    cx = (L[m] + R[m]) / 2;
  } else {
    // no neck: paint one behind the chin in the sampled skin colour, with dark side outlines
    let x0 = W, x1 = 0; for (let y = top; y <= bot; y++) if (L[y] >= 0) { x0 = Math.min(x0, L[y]); x1 = Math.max(x1, R[y]); }
    cx = (x0 + x1) / 2;
    const px = [];
    for (const fx of [0.3, 0.35, 0.65, 0.7]) for (const fy of [0.55, 0.6, 0.65]) {
      const i = (Math.round(top + fy * hh) * W + Math.round(x0 + fx * (x1 - x0))) * 4;
      if (d[i + 3] > 200) px.push([d[i], d[i + 1], d[i + 2], d[i] + d[i + 1] + d[i + 2]]);
    }
    px.sort((a, b) => a[3] - b[3]);
    const sk = px.length ? px[px.length >> 1] : [240, 196, 160];
    target = Math.round(bot + NECK * hh);
    const nw = 0.4 * (x1 - x0), ow = Math.max(2, 0.025 * (x1 - x0)), y0 = Math.round(bot - 0.15 * hh);
    g.globalCompositeOperation = 'destination-over';
    g.fillStyle = `rgb(${sk[0]},${sk[1]},${sk[2]})`; g.fillRect(cx - nw / 2, y0, nw, target - y0);
    g.fillStyle = '#2a1a14'; g.fillRect(cx - nw / 2 - ow, y0, nw + 2 * ow, target - y0);
    g.globalCompositeOperation = 'source-over';
  }
  let hw = 0; for (let y = top; y < target; y++) if (L[y] >= 0) hw = Math.max(hw, 2 * Math.max(cx - L[y], R[y] - cx));
  const side = Math.max(target - top, hw) * 1.03;
  const out = document.createElement('canvas'); out.width = out.height = S;
  out.getContext('2d').drawImage(cv, cx - side / 2, target - side, side, side, 0, 0, S, S);
  return out;
}

export async function loadFaces(onProgress) {
  const loader = new THREE.TextureLoader();
  const names = [...FACE_NAMES, ...EXTRA];
  let done = 0;
  const backs = {};
  const total = names.length + BACK_NAMES.length;
  const load = async (n) => { const t = await loader.loadAsync(asset(`assets/faces/${n}.png`)); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t; };
  await Promise.all([
    ...names.map(async (n) => {
      try { FACES[n] = await load(n); } catch (e) { FACES[n] = fallbackFace(n); }
      done++; onProgress && onProgress(done / total);
    }),
    ...BACK_NAMES.map(async (n) => {
      try { backs[n] = await load(n + '_back'); } catch (e) { /* procedural back */ }
      done++; onProgress && onProgress(done / total);
    }),
  ]);
  for (const n in FACES) if (backs[baseOf(n)]) BACKS.set(FACES[n], backs[baseOf(n)]);
  return FACES;
}

// Back-of-head texture for a face: the generated <name>_back sprite when there is one, else one
// derived from the face: same silhouette, filled with the hair colour sampled from the top of the
// portrait, plus a little shading and strands.
const backCache = new WeakMap();
export function backOf(tex) {
  if (!tex) return null;
  if (BACKS.has(tex)) return BACKS.get(tex);
  if (!tex.image) return null;
  if (backCache.has(tex)) return backCache.get(tex);
  const img = tex.image;
  const S = 128;
  const cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d', { willReadFrequently: true });
  try { g.drawImage(img, 0, 0, S, S); } catch (e) { return null; }
  const d = g.getImageData(0, 0, S, S).data;
  // sample hair colour: step inward from the silhouette edge on both sides and from the top,
  // skip outlines/highlights, take the median
  const samples = [];
  const push = (x, y) => {
    const i = (y * S + x) * 4;
    if (d[i + 3] < 200) return;
    const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    if (l > 30 && l < 235) samples.push([d[i], d[i + 1], d[i + 2], l]);
  };
  for (let y = Math.floor(S * 0.22); y < S * 0.5; y += 3) {
    let xl = 0; while (xl < S / 2 && d[(y * S + xl) * 4 + 3] < 200) xl++;
    let xr = S - 1; while (xr > S / 2 && d[(y * S + xr) * 4 + 3] < 200) xr--;
    if (xl < S / 2) { push(Math.min(S - 1, xl + 6), y); push(Math.min(S - 1, xl + 9), y); }
    if (xr > S / 2) { push(Math.max(0, xr - 6), y); push(Math.max(0, xr - 9), y); }
  }
  for (let x = Math.floor(S * 0.3); x < S * 0.7; x += 4) {
    let y = 0; while (y < S * 0.6 && d[(y * S + x) * 4 + 3] < 200) y++;
    if (y < S * 0.6) { push(x, Math.min(S - 1, y + 6)); push(x, Math.min(S - 1, y + 10)); }
  }
  let col = [80, 60, 40];
  if (samples.length) { samples.sort((a, b) => a[3] - b[3]); col = samples[Math.floor(samples.length / 2)]; }
  g.globalCompositeOperation = 'source-in';
  const [r, gg, b] = col;
  const grad = g.createRadialGradient(S * 0.45, S * 0.35, S * 0.05, S / 2, S / 2, S * 0.55);
  grad.addColorStop(0, `rgb(${Math.min(255, r + 30)},${Math.min(255, gg + 30)},${Math.min(255, b + 30)})`);
  grad.addColorStop(1, `rgb(${r * 0.55 | 0},${gg * 0.55 | 0},${b * 0.55 | 0})`);
  g.fillStyle = grad; g.fillRect(0, 0, S, S);
  g.globalCompositeOperation = 'source-atop';
  // silhouette rows: the neck is the narrow strip at the bottom (sprites end at the neck's cut)
  const row = (y) => { let l = -1, r = -1; for (let x = 0; x < S; x++) if (d[(y * S + x) * 4 + 3] > 120) { if (l < 0) l = x; r = x; } return [l, r]; };
  let top = 0; while (top < S - 1 && row(top)[0] < 0) top++;
  const [bl, br] = row(S - 5), wb = br - bl;
  let ny = S;
  if (bl >= 0) { ny = S - 5; while (ny > S * 0.4) { const [l, r] = row(ny - 1); if (l < 0 || r - l > wb * 1.3) break; ny--; } }
  // hair strands falling from the crown to the nape
  const [hl, hr] = row(Math.round((top + ny) / 2)), cx = (hl + hr) / 2, hw = (hr - hl) / 2;
  g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 1.5;
  for (let k = -5; k <= 5; k++) {
    const f = k / 5.5;
    g.beginPath(); g.moveTo(cx + f * hw * 0.25, top + 3);
    g.quadraticCurveTo(cx + f * hw * 1.05, top + (ny - top) * 0.35, cx + f * hw * 0.8, ny + 2); g.stroke();
  }
  g.globalCompositeOperation = 'source-over';
  // the neck is skin from behind too: copy it back from the front
  if (ny < S) {
    g.clearRect(0, ny, S, S - ny);
    g.drawImage(img, 0, ny * img.height / S, img.width, (S - ny) * img.height / S, 0, ny, S, S - ny);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace;
  backCache.set(tex, t);
  return t;
}

// A face already normalised by imageToFace (e.g. restored after "Try again"): load it as-is.
export async function loadFaceURL(url) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const t = new THREE.Texture(img); t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true;
  return t;
}

export function face(name) { return OVERRIDE[name] || FACES[name] || (FACES[name] = fallbackFace(name)); }

// Fill background-removal holes (eye whites, teeth) and, if the silhouette has a white "sticker"
// rim, eat it: grow the outside into near-white pixels up to the dark outline. (Same as crop_faces.py.)
function dehalo(g, W, H, steps = 24) {
  const id = g.getImageData(0, 0, W, H), d = id.data, N = W * H;
  const white = new Uint8Array(N), out = new Uint8Array(N);
  for (let k = 0; k < N; k++) {
    const r = d[k * 4], gg = d[k * 4 + 1], b = d[k * 4 + 2];
    white[k] = Math.min(r, gg, b) > 225 && Math.max(r, gg, b) - Math.min(r, gg, b) < 25 ? 1 : 0;
  }
  const nb = (k, f) => { const x = k % W; if (k >= W) f(k - W); if (k < N - W) f(k + W); if (x > 0) f(k - 1); if (x < W - 1) f(k + 1); };
  // outside = transparent pixels connected to the border
  let front = [];
  for (let k = 0; k < N; k++) { const x = k % W, y = (k / W) | 0; if ((x === 0 || y === 0 || x === W - 1 || y === H - 1) && d[k * 4 + 3] <= 40) { out[k] = 1; front.push(k); } }
  while (front.length) { const next = []; for (const k of front) nb(k, (n) => { if (!out[n] && d[n * 4 + 3] <= 40) { out[n] = 1; next.push(n); } }); front = next; }
  let edge = 0, edgeWhite = 0;
  for (let k = 0; k < N; k++) {
    if (out[k]) continue;
    if (d[k * 4 + 3] <= 40) { d[k * 4 + 3] = 255; continue; } // hole
    let touches = false; nb(k, (n) => { if (out[n]) touches = true; });
    if (touches) { edge++; if (white[k]) edgeWhite++; }
  }
  if (edgeWhite > 0.5 * edge) {
    front = []; for (let k = 0; k < N; k++) if (out[k]) front.push(k);
    for (let s = 0; s < steps && front.length; s++) {
      const next = [];
      for (const k of front) nb(k, (n) => { if (!out[n] && white[n]) { out[n] = 1; d[n * 4 + 3] = 0; next.push(n); } });
      front = next;
    }
  }
  g.putImageData(id, 0, 0);
}

// Turn any image (generated or uploaded) into a face texture: remove a flat light
// background by flood-fill from the borders (if it has no alpha), then normalise to a head+neck square.
export async function imageToFace(src, { removeBg = true } = {}) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.crossOrigin = 'anonymous'; i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const S = 384;
  const cv = document.createElement('canvas');
  const sc = Math.min(1, 768 / Math.max(img.width, img.height));
  cv.width = Math.round(img.width * sc); cv.height = Math.round(img.height * sc);
  const g = cv.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, cv.width, cv.height);
  const W = cv.width, H = cv.height;
  const id = g.getImageData(0, 0, W, H), d = id.data;
  let hasAlpha = false;
  for (let i = 3; i < d.length; i += 4 * 97) if (d[i] < 250) { hasAlpha = true; break; }
  if (removeBg && !hasAlpha) {
    // flood fill from edges over pixels close to the corner colour
    const ref = [d[0], d[1], d[2]];
    const close = (i) => Math.abs(d[i] - ref[0]) + Math.abs(d[i + 1] - ref[1]) + Math.abs(d[i + 2] - ref[2]) < 60;
    const seen = new Uint8Array(W * H), stack = [];
    for (let x = 0; x < W; x++) { stack.push(x, 0, x, H - 1); }
    for (let y = 0; y < H; y++) { stack.push(0, y, W - 1, y); }
    while (stack.length) {
      const y = stack.pop(), x = stack.pop();
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      const k = y * W + x;
      if (seen[k]) continue;
      seen[k] = 1;
      if (!close(k * 4)) continue;
      d[k * 4 + 3] = 0;
      stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
    }
    g.putImageData(id, 0, 0);
  } else if (!hasAlpha) {
    // photo upload without bg removal: oval mask
    g.globalCompositeOperation = 'destination-in';
    g.beginPath(); g.ellipse(W / 2, H / 2, W * 0.42, H * 0.48, 0, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = 'source-over';
  }
  if (removeBg) dehalo(g, W, H);
  const out = normaliseHead(cv, S);
  const t = new THREE.CanvasTexture(out); t.colorSpace = THREE.SRGBColorSpace;
  return { texture: t, dataURL: out.toDataURL('image/png') };
}
