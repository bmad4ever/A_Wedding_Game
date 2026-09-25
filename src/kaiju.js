// Far beyond the hedges, to the north: a giant lizard and a giant robot, fighting. Nobody at the wedding mentions it.
// Everything is ~50 m tall and ~165 m away, so it reads as a hazy silhouette over the treeline, with glowing accents.
// It isn't there during Act I: reveal() has both quietly rise up from below the horizon at the blackout (beat 5).
// buildKaiju(root) -> { update(t, dt), reveal(dur), onHit } ; onHit(strength) is called on every landed blow (for a distant boom).
import * as THREE from 'three';

const HAZE = new THREE.Color(0xb88aa8); // the pink evening fog; the fighters are painted part-way into it (fog: false)
function M(color, { emissive = 0, ei = 1, haze = 0.45 } = {}) {
  const c = new THREE.Color(color).lerp(HAZE, haze);
  return new THREE.MeshStandardMaterial({ color: c, emissive, emissiveIntensity: ei, roughness: 0.9, flatShading: true, fog: false });
}
// unlit (additive would vanish against the bright evening sky)
const glow = (color) => new THREE.MeshBasicMaterial({ color, fog: false });
function part(geo, mat, parent, { x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0 } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
  parent.add(m);
  return m;
}
const grp = (parent, x = 0, y = 0, z = 0) => { const g = new THREE.Group(); g.position.set(x, y, z); parent.add(g); return g; };
const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const C = (rt, rb, h, s = 7) => new THREE.CylinderGeometry(rt, rb, h, s);

// ---------------- the lizard (built facing +Z) ----------------
function lizard() {
  const root = new THREE.Group();
  const skin = M(0x2f4a38), belly = M(0x6a7a52), dark = M(0x1e2e24);
  const spikeMat = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x9ab0c0).lerp(HAZE, 0.3), emissive: 0x4fc3ff, emissiveIntensity: 0, flatShading: true, fog: false });
  const body = grp(root, 0, 13, 0);
  part(C(5.5, 7.5, 22, 8), skin, body, { y: 7, rx: 0.3 });
  part(C(4.2, 5.8, 18, 8), belly, body, { y: 6, z: 2.2, rx: 0.3 });
  // head + jaw
  const head = grp(body, 0, 18.5, 5.5);
  part(B(6, 5, 9), skin, head, { z: 2 });
  part(B(5, 1.2, 3), dark, head, { y: 2.3, z: 0.5 });
  const jaw = grp(head, 0, -2, 0);
  part(B(5, 1.6, 8), skin, jaw, { y: -0.6, z: 2.6 });
  for (const s of [-1, 1]) part(B(0.8, 0.6, 0.8), glow(0xffd23a), head, { x: s * 2.2, y: 1.2, z: 5.2 });
  // dorsal plates (glow before the breath)
  for (let i = 0; i < 7; i++) {
    const sz = 4.5 - Math.abs(i - 2.5) * 0.7;
    part(new THREE.ConeGeometry(sz * 0.55, sz * 1.5, 4), spikeMat, body, { y: 15 - i * 3.2, z: -3.6 - i * 0.9, rx: -0.5 });
  }
  // arms
  const arms = [];
  for (const s of [-1, 1]) {
    const a = grp(body, s * 5.5, 12, 3.5);
    part(C(1.4, 1.1, 7), skin, a, { y: -3, z: 1.5, rx: 0.9 });
    arms.push(a);
  }
  // legs
  const legs = [];
  for (const s of [-1, 1]) {
    const l = grp(root, s * 5, 14, -1);
    part(C(4, 3.2, 12), skin, l, { y: -6 });
    part(B(6, 2.6, 8.5), dark, l, { y: -12.7, z: 1.6 });
    legs.push(l);
  }
  // tail: a chain of shrinking segments, curling back and down
  const tail = [];
  let parent = grp(root, 0, 11, -6);
  for (let i = 0; i < 7; i++) {
    const r = 5 - i * 0.62, len = 7;
    const seg = grp(parent, 0, 0, i ? -len : 0);
    seg.rotation.x = i ? 0.08 : 0.35;
    part(C(r * 0.8, r, len, 7), skin, seg, { z: -len / 2, rx: Math.PI / 2 });
    tail.push(seg); parent = seg;
  }
  return { root, body, head, jaw, arms, legs, tail, spikeMat };
}

// ---------------- the robot (built facing +Z) ----------------
function mecha() {
  const root = new THREE.Group();
  const white = M(0xf4f4ff, { haze: 0.3 }), red = M(0xc4283a), blue = M(0x2c4a9a), steel = M(0x5a6070);
  const body = grp(root, 0, 22, 0);
  part(B(7, 5, 6), steel, body, { y: 0 });                    // pelvis
  const torso = grp(body, 0, 3, 0);
  part(B(15, 12, 9), white, torso, { y: 7 });
  part(B(9, 7, 1), blue, torso, { y: 8, z: 4.6 });
  const core = part(new THREE.OctahedronGeometry(2, 0), glow(0x5ff3ff), torso, { y: 8, z: 5.4 });
  for (const s of [-1, 1]) part(B(6, 4, 8), red, torso, { x: s * 10.5, y: 11 });  // shoulder pads
  for (const s of [-1, 1]) part(new THREE.ConeGeometry(1.4, 4, 6), steel, torso, { x: s * 3.5, y: 6, z: -5.5, rx: -Math.PI / 2 - 0.4 }); // thrusters
  const flames = [-1, 1].map((s) => part(new THREE.ConeGeometry(1.2, 6, 6), glow(0xff9a3a), torso, { x: s * 3.5, y: 4.2, z: -8.3, rx: Math.PI / 2 + 0.4 }));
  // head: visor + V-fin
  const head = grp(torso, 0, 14, 0.5);
  part(B(5, 4.5, 5), white, head, { y: 2 });
  part(B(4.2, 1.2, 0.5), glow(0xffe14a), head, { y: 2.3, z: 2.6 });
  for (const s of [-1, 1]) part(B(0.6, 5, 0.6), M(0xffd23a, { haze: 0.2 }), head, { x: s * 1.6, y: 5.5, z: 2, rz: -s * 0.7 });
  // arms: shoulder -> elbow -> detachable fist
  const arms = [];
  for (const s of [-1, 1]) {
    const sh = grp(torso, s * 10, 11, 0);
    part(B(3.6, 9, 3.6), white, sh, { y: -4.5 });
    const el = grp(sh, 0, -9, 0);
    part(B(4, 8, 4), red, el, { y: -4 });
    const fist = grp(el, 0, -9.5, 0);
    part(B(4.4, 4, 4.4), steel, fist);
    const trail = part(new THREE.ConeGeometry(1.5, 7, 6), glow(0xff9a3a), fist, { y: 5.5 });
    trail.visible = false;
    arms.push({ sh, el, fist, trail, home: fist.position.clone() });
  }
  // legs
  const legs = [];
  for (const s of [-1, 1]) {
    const l = grp(root, s * 4.5, 21, 0);
    part(B(5, 11, 5), white, l, { y: -5 });
    part(B(5.6, 10, 5.6), blue, l, { y: -15 });
    part(B(6.5, 2.4, 9), steel, l, { y: -20.2, z: 1 });
    legs.push(l);
  }
  return { root, body, torso, head, arms, legs, core, flames };
}

const clamp01 = (k) => Math.max(0, Math.min(1, k));
const win = (p, a, b) => clamp01((p - a) / (b - a));       // 0..1 across [a, b]
const bump = (p, a, b) => Math.sin(win(p, a, b) * Math.PI); // 0 -> 1 -> 0 across [a, b]

export function buildKaiju(root) {
  const L = lizard(), R = mecha();
  const LX = 40, LZ = -158, RX = 66, RZ = -150; // inside the sky dome (r = 180)
  const face = Math.atan2(RX - LX, RZ - LZ);
  L.root.position.set(LX, 0, LZ); L.root.rotation.y = face;
  R.root.position.set(RX, 0, RZ); R.root.rotation.y = face + Math.PI;
  const arena = new THREE.Group(); // below the ground (and hidden) until reveal()
  arena.visible = false;
  arena.add(L.root, R.root);
  root.add(arena);
  const toR = new THREE.Vector3(RX - LX, 0, RZ - LZ).normalize();

  // atomic breath beam + hit flashes
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 3, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color: 0x8fe4ff, fog: false, side: THREE.DoubleSide }));
  beam.geometry.translate(0, 0.5, 0);
  beam.visible = false; root.add(beam);
  const flashTex = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,240,1)'); gr.addColorStop(0.35, 'rgba(255,200,120,0.8)'); gr.addColorStop(1, 'rgba(255,120,60,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  })();
  const flashes = [0, 1].map(() => {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true }));
    s.visible = false; root.add(s); return s;
  });
  let fi = 0;
  const flashAt = (v, size) => { const f = flashes[fi++ % 2]; f.position.copy(v); f.userData = { t: 0, size }; f.visible = true; };

  const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
  const T = 16;
  let prev = 0;
  const api = { onHit: null };
  let rise = null; // { t, dur } while emerging
  api.reveal = (dur = 4) => { arena.visible = true; arena.position.y = -80; rise = { t: 0, dur }; };
  api.update = (t, dt) => {
    if (!arena.visible) return;
    if (rise) { rise.t += dt; const k = Math.min(1, rise.t / rise.dur); arena.position.y = -80 * (1 - k) * (1 - k); if (k >= 1) rise = null; }
    const p = t % T, cross = (x) => prev < x && p >= x;
    const hit = (obj, size, strength) => { obj.getWorldPosition(_a); flashAt(_a, size); api.onHit && api.onHit(strength); };
    // ---- lizard
    const roar = bump(p, 1.2, 2.8), spin = bump(p, 5.0, 7.4), breathUp = win(p, 8.0, 8.9), breath = p > 8.9 && p < 10.4;
    const recoilL = bump(p, 4.0, 5.0) + bump(p, 12.4, 13.6);
    L.root.rotation.y = face - spin * 2.6;
    L.body.rotation.x = -recoilL * 0.25 + roar * -0.15 + (breath ? 0.12 : 0);
    L.body.rotation.z = Math.sin(t * 0.9) * 0.05;
    L.head.rotation.x = -roar * 0.35 - recoilL * 0.3;
    L.jaw.rotation.x = Math.max(roar, breath ? 1 : 0, recoilL) * 0.55;
    L.tail.forEach((s, i) => { s.rotation.y = Math.sin(t * 1.6 - i * 0.6) * 0.12 + spin * (i ? 0.1 : 0.3); });
    L.arms.forEach((a, i) => { a.rotation.x = Math.sin(t * 1.3 + i) * 0.2 - recoilL * 0.6; });
    const stompL = Math.sin(t * 1.8);
    L.legs.forEach((l, i) => { l.rotation.x = (i ? stompL : -stompL) * 0.12; });
    L.spikeMat.emissiveIntensity = breath ? 3 + Math.sin(t * 40) * 0.8 : breathUp * 2.6;
    // ---- robot
    const punch = bump(p, 3.2, 4.6), stagger = bump(p, 6.0, 7.6), block = win(p, 8.6, 9.0) * (1 - win(p, 10.4, 10.9)), rocket = p > 11.2 && p < 13.9;
    R.body.position.set(0, 22 + Math.sin(t * 1.5) * 0.4, punch * 5 - stagger * 3);
    R.body.rotation.z = stagger * 0.22;
    R.body.rotation.x = stagger * -0.15 + punch * 0.12;
    R.head.rotation.y = Math.sin(t * 0.7) * 0.2;
    const [ar, al] = R.arms;
    ar.sh.rotation.x = -0.4 - punch * 1.25 - block * 1.1 - (rocket ? 1.5 : 0);
    ar.el.rotation.x = -1.2 + punch * 1.1 - block * 0.6 + (rocket ? 1.15 : 0);
    al.sh.rotation.x = -0.5 - block * 1.4 + Math.sin(t * 1.4) * 0.1;
    al.el.rotation.x = -1.3 - block * 0.4;
    // rocket punch: the right fist flies to the lizard's head and comes back
    const out = win(p, 11.4, 12.4), back = win(p, 12.5, 13.8);
    if (rocket && p > 11.4) {
      L.head.getWorldPosition(_b); ar.el.worldToLocal(_b);
      const k = p < 12.4 ? out * out : 1 - back;
      ar.fist.position.lerpVectors(ar.home, _b, k);
      ar.trail.visible = true;
    } else { ar.fist.position.copy(ar.home); ar.fist.rotation.set(0, 0, 0); ar.trail.visible = false; }
    const fl = 1 + Math.sin(t * 30) * 0.2 + (rocket ? 0.6 : 0) + punch;
    R.flames.forEach((f) => f.scale.set(1, fl, 1));
    R.core.rotation.y = t * 2;
    const walkR = Math.sin(t * 1.5);
    R.legs.forEach((l, i) => { l.rotation.x = (i ? walkR : -walkR) * 0.08 - stagger * 0.2; });
    // ---- breath beam, mouth -> robot core
    beam.visible = breath;
    if (breath) {
      L.jaw.getWorldPosition(_a); _a.addScaledVector(toR, 6);
      R.core.getWorldPosition(_b);
      const len = _a.distanceTo(_b);
      beam.position.copy(_a);
      beam.quaternion.setFromUnitVectors(_up, _b.sub(_a).normalize());
      beam.scale.set(1 + Math.sin(t * 35) * 0.25, len, 1 + Math.sin(t * 35) * 0.25);
      if (Math.floor(p * 6) !== Math.floor(prev * 6)) hit(R.core, 18, 0.5);
    }
    // ---- landed blows
    if (cross(4.0)) hit(L.head, 22, 1);
    if (cross(6.2)) hit(R.torso, 26, 1);
    if (cross(12.4)) hit(L.head, 26, 1.2);
    for (const f of flashes) {
      if (!f.visible) continue;
      f.userData.t += dt;
      const k = f.userData.t / 0.5;
      if (k >= 1) { f.visible = false; continue; }
      f.scale.setScalar(f.userData.size * (0.5 + k));
      f.material.opacity = 1 - k;
    }
    prev = p;
  };
  return api;
}
