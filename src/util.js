// Shared helpers: game clock, promise-based scheduler (wait / tween), easing, colliders.
import * as THREE from 'three';

export const clock = { t: 0, dt: 0, scale: 1 };
const waits = [];
const tweens = [];
let generation = 0; // bump to cancel everything on restart

export function wait(s) {
  const g = generation;
  return new Promise((r) => waits.push({ t: clock.t + s, r, g }));
}
export function tween(d, fn, ease = easeInOut) {
  const g = generation;
  return new Promise((r) => tweens.push({ t0: clock.t, d: Math.max(1e-4, d), fn, ease, r, g }));
}
export function cancelAll() { generation++; waits.length = 0; tweens.length = 0; }
export function tickScheduler() {
  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    if (tw.g !== generation) { tweens.splice(i, 1); continue; }
    const k = Math.min(1, (clock.t - tw.t0) / tw.d);
    tw.fn(tw.ease(k), k);
    if (k >= 1) { tweens.splice(i, 1); tw.r(); }
  }
  for (let i = waits.length - 1; i >= 0; i--) {
    const w = waits[i];
    if (w.g !== generation) { waits.splice(i, 1); continue; }
    if (clock.t >= w.t) { waits.splice(i, 1); w.r(); }
  }
}

export const lerp = (a, b, k) => a + (b - a) * k;
export const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const easeInOut = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
export const easeOut = (k) => 1 - (1 - k) * (1 - k);
export const easeIn = (k) => k * k;
export const linear = (k) => k;
export const easeOutBounce = (x) => {
  const n1 = 7.5625, d1 = 2.75;
  if (x < 1 / d1) return n1 * x * x;
  if (x < 2 / d1) return n1 * (x -= 1.5 / d1) * x + 0.75;
  if (x < 2.5 / d1) return n1 * (x -= 2.25 / d1) * x + 0.9375;
  return n1 * (x -= 2.625 / d1) * x + 0.984375;
};
export const rand = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export function angleLerp(a, b, k) {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}

// ---- simple 2D colliders on the XZ plane ----
export const colliders = [];
export function addBox(cx, cz, w, d, tag) { const c = { type: 'box', minX: cx - w / 2, maxX: cx + w / 2, minZ: cz - d / 2, maxZ: cz + d / 2, tag }; colliders.push(c); return c; }
export function addCircle(x, z, r, tag) { const c = { type: 'circle', x, z, r, tag }; colliders.push(c); return c; }
export function removeCollider(c) { const i = colliders.indexOf(c); if (i >= 0) colliders.splice(i, 1); }
export function resolveCollisions(pos, r, ignore) {
  for (const c of colliders) {
    if (c === ignore || c.off) continue;
    if (c.type === 'box') {
      const qx = clamp(pos.x, c.minX, c.maxX), qz = clamp(pos.z, c.minZ, c.maxZ);
      const dx = pos.x - qx, dz = pos.z - qz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-8) { const d = Math.sqrt(d2), p = (r - d) / d; pos.x += dx * p; pos.z += dz * p; }
        else { // inside: push out along smallest axis
          const l = pos.x - c.minX, rr = c.maxX - pos.x, t = pos.z - c.minZ, b = c.maxZ - pos.z, m = Math.min(l, rr, t, b);
          if (m === l) pos.x = c.minX - r; else if (m === rr) pos.x = c.maxX + r; else if (m === t) pos.z = c.minZ - r; else pos.z = c.maxZ + r;
        }
      }
    } else {
      const dx = pos.x - c.x, dz = pos.z - c.z, d2 = dx * dx + dz * dz, R = r + c.r;
      if (d2 < R * R && d2 > 1e-8) { const d = Math.sqrt(d2), p = (R - d) / d; pos.x += dx * p; pos.z += dz * p; }
    }
  }
}

// ---- canvas textures ----
export function canvasTex(w, h, draw, { repeat = null, srgb = true } = {}) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  draw(g, w, h);
  const tex = new THREE.CanvasTexture(cv);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(repeat[0], repeat[1]); }
  tex.anisotropy = 4;
  return tex;
}

const matCache = new Map();
export function mat(color, { flat = true, rough = 0.8, metal = 0, emissive = 0, ei = 1, transparent = false, opacity = 1, side = THREE.FrontSide, key = '' } = {}) {
  const k = [color, flat, rough, metal, emissive, ei, transparent, opacity, side, key].join('|');
  if (!key && matCache.has(k)) return matCache.get(k);
  const m = new THREE.MeshStandardMaterial({ color, flatShading: flat, roughness: rough, metalness: metal, emissive, emissiveIntensity: ei, transparent, opacity, side });
  if (!key) matCache.set(k, m);
  return m;
}

export function mesh(geo, material, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, cast = true, receive = true, parent = null } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  m.castShadow = cast; m.receiveShadow = receive;
  if (parent) parent.add(m);
  return m;
}
