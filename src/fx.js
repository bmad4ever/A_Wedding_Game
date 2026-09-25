// Particles, debris, simple rigid bodies, fire sources and camera shake.
import * as THREE from 'three';
import { rand } from './util.js';
import { settings } from './progress.js';

const VERT = `
attribute float size; attribute float alpha; attribute vec3 pcolor;
varying float vA; varying vec3 vC;
uniform float scale;
void main(){ vA = alpha; vC = pcolor; vec4 mv = modelViewMatrix * vec4(position,1.0);
  gl_PointSize = size * scale / max(0.1, -mv.z); gl_Position = projectionMatrix * mv; }`;
const FRAG = `
varying float vA; varying vec3 vC; uniform float soft;
void main(){ vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard;
  float a = mix(1.0, 1.0 - r * r, soft) * vA; gl_FragColor = vec4(vC, a); }`;

class Particles {
  constructor(scene, max, { additive = false, soft = 1 } = {}) {
    this.max = max;
    this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('pcolor', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      uniforms: { scale: { value: 400 }, soft: { value: soft } },
    });
    this.points = new THREE.Points(this.geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = additive ? 5 : 4;
    scene.add(this.points);
    this.p = [];
  }
  spawn(o) {
    if (this.p.length >= this.max) this.p.shift();
    this.p.push({
      x: o.pos.x, y: o.pos.y, z: o.pos.z, vx: o.vel?.x || 0, vy: o.vel?.y || 0, vz: o.vel?.z || 0,
      life: o.life || 1, age: 0, s0: o.size ?? 0.2, s1: o.sizeEnd ?? o.size ?? 0.2,
      c0: new THREE.Color(o.color ?? 0xffffff), c1: new THREE.Color(o.colorEnd ?? o.color ?? 0xffffff),
      g: o.gravity ?? 0, drag: o.drag ?? 0, a0: o.alpha ?? 1, a1: o.alphaEnd ?? 0, floor: o.floor ?? -100, bounce: o.bounce ?? 0,
    });
  }
  update(dt) {
    const c = new THREE.Color();
    let n = 0;
    for (let i = this.p.length - 1; i >= 0; i--) {
      const p = this.p[i];
      p.age += dt;
      if (p.age >= p.life) { this.p.splice(i, 1); continue; }
    }
    for (const p of this.p) {
      const k = p.age / p.life;
      p.vy -= p.g * dt;
      const d = Math.exp(-p.drag * dt);
      p.vx *= d; p.vy *= d; p.vz *= d;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      if (p.y < p.floor) { p.y = p.floor; p.vy = -p.vy * p.bounce; p.vx *= 0.6; p.vz *= 0.6; }
      this.pos[n * 3] = p.x; this.pos[n * 3 + 1] = p.y; this.pos[n * 3 + 2] = p.z;
      c.copy(p.c0).lerp(p.c1, k);
      this.col[n * 3] = c.r; this.col[n * 3 + 1] = c.g; this.col[n * 3 + 2] = c.b;
      this.size[n] = p.s0 + (p.s1 - p.s0) * k;
      this.alpha[n] = p.a0 + (p.a1 - p.a0) * k;
      n++;
    }
    this.geo.setDrawRange(0, n);
    for (const a of ['position', 'pcolor', 'size', 'alpha']) this.geo.attributes[a].needsUpdate = true;
  }
  clear() { this.p.length = 0; this.geo.setDrawRange(0, 0); }
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.add = new Particles(scene, 1500, { additive: true });
    this.norm = new Particles(scene, 1500, { additive: false, soft: 0.3 });
    this.bodies = [];
    this.fires = [];
    this.shakeAmt = 0; this.shakeT = 0;
    this.fireLights = [];
    for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xff7a20, 0, 14, 1.3); scene.add(l); this.fireLights.push(l); }
    // debris (instanced shards)
    this.shardMax = 240;
    this.shards = new THREE.InstancedMesh(new THREE.TetrahedronGeometry(0.03, 0), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.8, roughness: 0.1, metalness: 0.3 }), this.shardMax);
    this.shards.count = 0; this.shards.frustumCulled = false;
    this.shardData = [];
    scene.add(this.shards);
  }
  setScale(h) { this.add.mat.uniforms.scale.value = h * 0.6; this.norm.mat.uniforms.scale.value = h * 0.6; }

  shake(a, t = 0.4) { if (settings.calm) a *= 0.15; this.shakeAmt = Math.max(this.shakeAmt, a); this.shakeT = Math.max(this.shakeT, t); }

  sparks(pos, n = 20, spd = 3) {
    for (let i = 0; i < n; i++) this.add.spawn({ pos, vel: { x: rand(-spd, spd), y: rand(0.5, spd * 1.4), z: rand(-spd, spd) }, life: rand(0.3, 0.9), size: rand(0.05, 0.1), sizeEnd: 0.01, color: 0xffffaa, colorEnd: 0xff6600, gravity: 9, drag: 1, floor: 0.02, bounce: 0.4 });
    this.add.spawn({ pos, life: 0.12, size: 1.6, sizeEnd: 0.4, color: 0x99ccff, alpha: 1 });
  }
  flash(pos, size = 3, color = 0xffffff) { this.add.spawn({ pos, life: 0.15, size, sizeEnd: size * 0.3, color, alpha: 1 }); }
  splash(pos, n = 20, color = 0xf5d36b) {
    for (let i = 0; i < n; i++) this.norm.spawn({ pos, vel: { x: rand(-1.5, 1.5), y: rand(1, 3), z: rand(-1.5, 1.5) }, life: rand(0.4, 0.9), size: rand(0.04, 0.08), color, alpha: 0.9, alphaEnd: 0.4, gravity: 9.8, floor: 0.01 });
  }
  smoke(pos, n = 1, dark = 0.3) {
    for (let i = 0; i < n; i++) this.norm.spawn({ pos: { x: pos.x + rand(-0.2, 0.2), y: pos.y, z: pos.z + rand(-0.2, 0.2) }, vel: { x: rand(-0.2, 0.2) + 0.25, y: rand(0.6, 1.2), z: rand(-0.2, 0.2) }, life: rand(2, 3.5), size: rand(0.5, 0.8), sizeEnd: 2.4, color: new THREE.Color(dark, dark, dark), colorEnd: 0x888888, alpha: 0.45, alphaEnd: 0 });
  }
  confetti(pos, n = 60) {
    const cols = [0xff5ca8, 0xffd166, 0x06d6a0, 0x118ab2, 0xffffff, 0xef476f];
    for (let i = 0; i < n; i++) this.norm.spawn({ pos, vel: { x: rand(-3, 3), y: rand(3, 7), z: rand(-3, 3) }, life: rand(2, 3.5), size: rand(0.05, 0.09), color: cols[i % cols.length], alpha: 1, alphaEnd: 0.8, gravity: 4, drag: 1.5, floor: 0.01 });
  }
  hearts(pos, n = 6) {
    for (let i = 0; i < n; i++) this.add.spawn({ pos: { x: pos.x + rand(-0.3, 0.3), y: pos.y, z: pos.z + rand(-0.3, 0.3) }, vel: { x: 0, y: rand(0.5, 1.2), z: 0 }, life: 1.5, size: rand(0.15, 0.25), color: 0xff4d88, alpha: 1 });
  }
  rain(center, radius = 18, n = 25) {
    for (let i = 0; i < n; i++) this.norm.spawn({ pos: { x: center.x + rand(-radius, radius), y: rand(3, 6), z: center.z + rand(-radius, radius) }, vel: { x: 0, y: -8, z: 0 }, life: 0.8, size: 0.04, color: 0xbfe3ff, alpha: 0.7, alphaEnd: 0.7, floor: 0.02 });
  }
  spray(pos, n = 6) {
    for (let i = 0; i < n; i++) { const a = rand(0, Math.PI * 2), s = rand(2, 4); this.norm.spawn({ pos, vel: { x: Math.cos(a) * s, y: rand(3, 5), z: Math.sin(a) * s }, life: 1.3, size: 0.06, color: 0xcfeaff, alpha: 0.8, alphaEnd: 0.3, gravity: 9.8, floor: 0.02 }); }
  }

  shatter(pos, n = 12, color = 0xfff3c0) {
    for (let i = 0; i < n; i++) {
      if (this.shardData.length >= this.shardMax) this.shardData.shift();
      this.shardData.push({ p: new THREE.Vector3(pos.x, pos.y + 0.05, pos.z), v: new THREE.Vector3(rand(-2, 2), rand(1, 3), rand(-2, 2)), r: new THREE.Euler(rand(0, 6), rand(0, 6), rand(0, 6)), w: rand(5, 15), s: rand(0.6, 1.6), rest: false });
    }
    this.shards.material.color.set(color);
    this.splash(pos, 8);
  }

  // simple rigid body: {obj, vel:Vector3, ang:Vector3, floor, bounce, onLand, spin}
  body(obj, vel, ang, opts = {}) {
    const b = { obj, vel: vel.clone(), ang: ang.clone(), floor: opts.floor ?? 0, bounce: opts.bounce ?? 0.3, onLand: opts.onLand, landed: false, friction: opts.friction ?? 0.7, g: opts.g ?? 9.8 };
    this.bodies.push(b);
    return b;
  }

  fire(pos, intensity = 1, radius = 0.4) { const f = { pos: pos.clone(), i: intensity, r: radius, t: 0 }; this.fires.push(f); return f; }

  update(dt, camera) {
    // fires
    for (const f of this.fires) {
      f.t += dt;
      if (f.i <= 0.01) continue;
      const n = f.i * 60 * dt;
      for (let k = 0; k < n + (Math.random() < n % 1 ? 1 : 0); k++) {
        this.add.spawn({ pos: { x: f.pos.x + rand(-f.r, f.r), y: f.pos.y + rand(0, 0.1), z: f.pos.z + rand(-f.r * 0.5, f.r * 0.5) }, vel: { x: rand(-0.2, 0.2), y: rand(0.8, 1.8) * (0.6 + f.i * 0.5), z: rand(-0.2, 0.2) }, life: rand(0.4, 0.9), size: rand(0.25, 0.45) * (0.6 + f.i * 0.4), sizeEnd: 0.05, color: 0xffd060, colorEnd: 0xff2a00, alpha: 0.9, alphaEnd: 0 });
      }
      if (Math.random() < f.i * 6 * dt) this.smoke({ x: f.pos.x, y: f.pos.y + 0.8, z: f.pos.z }, 1, 0.15);
    }
    const lit = this.fires.filter((f) => f.i > 0.05).sort((a, b) => b.i - a.i);
    this.fireLights.forEach((l, i) => {
      const f = lit[i];
      if (!f) { l.intensity = 0; return; }
      l.position.set(f.pos.x, f.pos.y + 0.7, f.pos.z);
      l.intensity = (12 + Math.sin(f.t * 23 + i) * 3 + Math.random() * 4) * Math.min(1.5, f.i);
    });
    // bodies
    for (const b of this.bodies) {
      if (b.landed === 'rest') continue;
      b.vel.y -= b.g * dt;
      b.obj.position.addScaledVector(b.vel, dt);
      b.obj.rotation.x += b.ang.x * dt; b.obj.rotation.y += b.ang.y * dt; b.obj.rotation.z += b.ang.z * dt;
      if (b.obj.position.y <= b.floor) {
        b.obj.position.y = b.floor;
        const impact = -b.vel.y;
        if (!b.landed && b.onLand) b.onLand(b, impact);
        b.landed = true;
        b.vel.y = impact * b.bounce; b.vel.x *= b.friction; b.vel.z *= b.friction; b.ang.multiplyScalar(0.5);
        if (Math.abs(b.vel.y) < 0.4) { b.vel.set(0, 0, 0); b.landed = 'rest'; }
      }
    }
    this.bodies = this.bodies.filter((b) => b.landed !== 'rest' || b.keep);
    // shards
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3();
    this.shardData.forEach((s, i) => {
      if (!s.rest) {
        s.v.y -= 9.8 * dt; s.p.addScaledVector(s.v, dt); s.r.x += s.w * dt; s.r.z += s.w * dt;
        if (s.p.y < 0.02) { s.p.y = 0.02; s.v.y *= -0.3; s.v.x *= 0.5; s.v.z *= 0.5; s.w *= 0.5; if (Math.abs(s.v.y) < 0.3) s.rest = true; }
      }
      sc.setScalar(s.s);
      m4.compose(s.p, q.setFromEuler(s.r), sc);
      this.shards.setMatrixAt(i, m4);
    });
    this.shards.count = this.shardData.length;
    this.shards.instanceMatrix.needsUpdate = true;
    this.add.update(dt); this.norm.update(dt);
    // shake
    if (this.shakeT > 0) { this.shakeT -= dt; if (this.shakeT <= 0) this.shakeAmt = 0; }
  }
  shakeOffset() {
    if (this.shakeAmt <= 0) return null;
    const a = this.shakeAmt * Math.min(1, this.shakeT * 3);
    return new THREE.Vector3(rand(-a, a), rand(-a, a), rand(-a, a));
  }
  reset() {
    this.add.clear(); this.norm.clear(); this.bodies = []; this.fires = []; this.shardData = []; this.shards.count = 0;
    this.fireLights.forEach((l) => (l.intensity = 0));
  }
}
