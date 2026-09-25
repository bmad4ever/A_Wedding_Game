// Character accessories, the dog, and the motorbike.
import * as THREE from 'three';
import { mat, mesh } from './util.js';

const cyl = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);

export function skirt(color, { len = 0.85, flare = 0.3, top = 0.11 } = {}) {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(top, flare, len, 10, 1, true);
  const m = mesh(geo, new THREE.MeshStandardMaterial({ color, flatShading: true, side: THREE.DoubleSide, roughness: 0.8 }), { y: -len / 2 + 0.06, parent: g });
  m.castShadow = true;
  return g;
}

export function weddingDress() {
  const g = skirt(0xffffff, { len: 0.98, flare: 0.62, top: 0.11 });
  // ruffle ring + train
  mesh(new THREE.TorusGeometry(0.6, 0.05, 4, 12), mat(0xfff8f0), { y: -0.86, rx: Math.PI / 2, parent: g });
  const train = mesh(new THREE.PlaneGeometry(0.9, 1.4), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.9 }), { y: -0.9, z: -0.8, rx: -Math.PI / 2 + 0.12, parent: g });
  train.receiveShadow = true;
  return g;
}

export function veil() {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, roughness: 1, depthWrite: false });
  const geo = new THREE.CylinderGeometry(0.12, 0.34, 1.1, 10, 1, true, Math.PI * 0.15, Math.PI * 0.7);
  mesh(geo, m, { y: -0.35, z: -0.12, ry: Math.PI, parent: g, cast: false });
  return g;
}

export function bouquet() {
  const g = new THREE.Group();
  mesh(new THREE.ConeGeometry(0.05, 0.22, 6), mat(0x4d7a32), { y: -0.08, rx: Math.PI, parent: g });
  const cols = [0xffffff, 0xff8fb1, 0xffc2d4, 0xffd166];
  for (let i = 0; i < 9; i++) mesh(new THREE.IcosahedronGeometry(0.05, 0), mat(cols[i % 4]), { x: Math.cos(i) * 0.07 * (i % 3 ? 1 : 0), y: 0.05 + (i % 2) * 0.03, z: Math.sin(i) * 0.07 * (i % 3 ? 1 : 0), parent: g });
  return g;
}

export function fluteProp() {
  const g = new THREE.Group();
  mesh(cyl(0.012, 0.012, 0.62, 6), mat(0xd9d9e0, { metal: 0.9, rough: 0.25 }), { rz: Math.PI / 2, parent: g });
  for (let i = 0; i < 5; i++) mesh(cyl(0.016, 0.016, 0.012, 6), mat(0xbfbfc8, { metal: 0.9, rough: 0.2 }), { x: -0.2 + i * 0.09, rz: Math.PI / 2, parent: g });
  return g;
}

// Reginald's backup instrument
export function kazooProp() {
  const g = new THREE.Group();
  mesh(cyl(0.018, 0.03, 0.16, 8), mat(0xffd21f, { rough: 0.4 }), { rz: Math.PI / 2, parent: g });
  mesh(cyl(0.014, 0.014, 0.03, 8), mat(0xe8b800), { x: 0.01, y: 0.028, parent: g });
  return g;
}

export function camera() {
  const g = new THREE.Group();
  mesh(new THREE.BoxGeometry(0.16, 0.1, 0.08), mat(0x222222), { parent: g });
  mesh(cyl(0.035, 0.035, 0.08, 8), mat(0x111111), { z: 0.07, rx: Math.PI / 2, parent: g });
  const fl = mesh(new THREE.BoxGeometry(0.05, 0.03, 0.03), new THREE.MeshBasicMaterial({ color: 0xdddddd }), { y: 0.07, parent: g });
  g.userData.flash = fl;
  return g;
}

export function cane() {
  const g = new THREE.Group();
  mesh(cyl(0.015, 0.015, 0.85, 5), mat(0x5a3a1a), { y: -0.42, parent: g });
  mesh(new THREE.TorusGeometry(0.05, 0.015, 4, 8, Math.PI), mat(0x5a3a1a), { x: 0.05, parent: g });
  return g;
}

export function glassProp(color = 0xd0104c) {
  const g = new THREE.Group();
  mesh(cyl(0.035, 0.028, 0.1, 8), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.4 }), { parent: g, cast: false });
  mesh(cyl(0.03, 0.026, 0.06, 8), mat(color), { y: -0.015, parent: g, cast: false });
  return g;
}

// kids' table cutlery: a chunky plastic fork (held in HandR, prongs up)
export function plasticFork(color = 0x4dabf7) {
  const g = new THREE.Group();
  const m = mat(color, { rough: 0.35 });
  mesh(new THREE.BoxGeometry(0.018, 0.12, 0.008), m, { y: 0.02, parent: g, cast: false });
  mesh(new THREE.BoxGeometry(0.034, 0.02, 0.008), m, { y: 0.09, parent: g, cast: false });
  for (let i = -1; i <= 1; i++) mesh(new THREE.BoxGeometry(0.007, 0.045, 0.007), m, { x: i * 0.012, y: 0.12, parent: g, cast: false });
  return g;
}

// a swaddled baby with a face sprite (tex: faces.js texture); userData.face is the sprite
export function babyBundle(tex) {
  const g = new THREE.Group();
  mesh(new THREE.CapsuleGeometry(0.075, 0.17, 4, 8), mat(0xa5d8ff, { rough: 0.95 }), { rz: Math.PI / 2, parent: g });
  mesh(new THREE.TorusGeometry(0.07, 0.02, 4, 10), mat(0xffffff, { rough: 0.95 }), { x: 0.1, ry: Math.PI / 2, parent: g });
  const face = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, alphaTest: 0.2 }));
  face.center.set(0.5, 0.12);
  face.scale.setScalar(0.22);
  face.position.set(0.15, 0.0, 0.04);
  g.add(face);
  g.userData.face = face;
  return g;
}

export function bible() {
  const g = new THREE.Group();
  mesh(new THREE.BoxGeometry(0.16, 0.04, 0.22), mat(0x222244), { parent: g });
  return g;
}

export function leatherCollar() { return null; }

// ---------------- the dog ----------------
export class Dog {
  constructor() {
    const g = new THREE.Group();
    this.root = g;
    const fur = mat(0xd9a441), furD = mat(0xb07e2a), dark = mat(0x222222), pink = mat(0xff7aa0);
    this.body = new THREE.Group(); this.body.position.y = 0.48; g.add(this.body);
    mesh(new THREE.BoxGeometry(0.34, 0.3, 0.72), fur, { parent: this.body });
    mesh(new THREE.BoxGeometry(0.3, 0.12, 0.6), furD, { y: 0.13, parent: this.body });
    // head
    this.head = new THREE.Group(); this.head.position.set(0, 0.2, 0.38); this.body.add(this.head);
    mesh(new THREE.BoxGeometry(0.28, 0.26, 0.28), fur, { y: 0.06, parent: this.head });
    mesh(new THREE.BoxGeometry(0.16, 0.12, 0.18), mat(0xe8c27a), { y: -0.01, z: 0.2, parent: this.head });
    mesh(new THREE.BoxGeometry(0.07, 0.05, 0.05), dark, { y: 0.04, z: 0.3, parent: this.head });
    this.tongue = mesh(new THREE.BoxGeometry(0.06, 0.015, 0.1), pink, { y: -0.08, z: 0.26, rx: 0.5, parent: this.head });
    for (const s of [-1, 1]) {
      mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), dark, { x: s * 0.07, y: 0.12, z: 0.145, parent: this.head });
      mesh(new THREE.BoxGeometry(0.02, 0.02, 0.01), mat(0xffffff), { x: s * 0.06, y: 0.135, z: 0.156, parent: this.head });
      const ear = mesh(new THREE.BoxGeometry(0.06, 0.18, 0.12), furD, { x: s * 0.16, y: 0.04, z: -0.02, rz: s * 0.2, parent: this.head });
      ear.name = 'ear';
    }
    // collar with tag
    mesh(new THREE.TorusGeometry(0.12, 0.025, 4, 10), mat(0xd62839), { y: 0.14, z: 0.32, rx: Math.PI / 2 - 0.3, parent: this.body });
    mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 8), mat(0xffd700, { metal: 0.8, rough: 0.3 }), { y: 0.04, z: 0.43, rx: Math.PI / 2, parent: this.body });
    // legs
    this.legs = [];
    for (const [x, z] of [[-0.11, 0.25], [0.11, 0.25], [-0.11, -0.25], [0.11, -0.25]]) {
      const pivot = new THREE.Group(); pivot.position.set(x, -0.1, z); this.body.add(pivot);
      mesh(new THREE.BoxGeometry(0.08, 0.4, 0.08), fur, { y: -0.18, parent: pivot });
      mesh(new THREE.BoxGeometry(0.09, 0.05, 0.12), furD, { y: -0.37, z: 0.02, parent: pivot });
      this.legs.push(pivot);
    }
    // tail
    this.tail = new THREE.Group(); this.tail.position.set(0, 0.1, -0.36); this.body.add(this.tail);
    mesh(new THREE.BoxGeometry(0.06, 0.06, 0.34), fur, { z: -0.15, rx: 0, parent: this.tail });
    this.tail.rotation.x = 0.7;
    // mouth attachment point
    this.mouth = new THREE.Group(); this.mouth.position.set(0, -0.05, 0.36); this.head.add(this.mouth);
    this.name = 'Biscuit';
    this.state = 'idle'; this.t = 0; this.phase = 0; this.speed = 0; this.wag = 1; this.headTilt = 0;
    this.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }
  update(dt) {
    this.t += dt;
    const t = this.t;
    this.tail.rotation.y = Math.sin(t * (8 + this.wag * 10)) * 0.6 * this.wag;
    this.tongue.visible = this.state !== 'sleep';
    const st = this.state;
    if (st === 'walk' || st === 'run') {
      const f = st === 'run' ? 14 : 8;
      this.phase += dt * f;
      const a = st === 'run' ? 0.9 : 0.5;
      this.legs[0].rotation.x = Math.sin(this.phase) * a; this.legs[3].rotation.x = Math.sin(this.phase) * a;
      this.legs[1].rotation.x = -Math.sin(this.phase) * a; this.legs[2].rotation.x = -Math.sin(this.phase) * a;
      this.body.position.y = 0.48 + Math.abs(Math.sin(this.phase)) * (st === 'run' ? 0.08 : 0.03);
      this.body.rotation.x = st === 'run' ? Math.sin(this.phase * 2) * 0.08 : 0;
      this.head.rotation.x = 0;
    } else if (st === 'sit') {
      this.legs[0].rotation.x = 0; this.legs[1].rotation.x = 0;
      this.legs[2].rotation.x = -1.3; this.legs[3].rotation.x = -1.3;
      this.body.rotation.x = -0.5; this.body.position.y = 0.36;
      this.head.rotation.x = 0.4 + Math.sin(t * 2) * 0.05; this.head.rotation.z = this.headTilt;
    } else if (st === 'sleep') {
      this.legs.forEach((l) => (l.rotation.x = -1.4));
      this.body.position.y = 0.22 + Math.sin(t * 1.5) * 0.01; this.body.rotation.x = 0;
      this.head.rotation.x = 0.5; this.wag = 0.1;
    } else if (st === 'bite') {
      this.legs.forEach((l, i) => (l.rotation.x = Math.sin(t * 20 + i) * 0.2));
      this.head.rotation.z = Math.sin(t * 30) * 0.5; this.body.position.y = 0.46; this.body.rotation.x = 0.1;
    } else { // idle
      this.legs.forEach((l) => (l.rotation.x = 0));
      this.body.position.y = 0.48 + Math.sin(t * 3) * 0.005; this.body.rotation.x = 0;
      this.head.rotation.x = Math.sin(t * 1.3) * 0.08; this.head.rotation.z = this.headTilt;
    }
  }
}

// ---------------- the ex's motorbike ----------------
export function motorbike() {
  const g = new THREE.Group();
  const chrome = mat(0xdddddd, { metal: 0.9, rough: 0.2 }), black = mat(0x151515, { rough: 0.5 }), red = mat(0xb00020, { metal: 0.4, rough: 0.3 });
  const wheels = [];
  for (const z of [-0.7, 0.72]) {
    const w = new THREE.Group(); w.position.set(0, 0.33, z); g.add(w);
    mesh(new THREE.TorusGeometry(0.28, 0.08, 6, 14), black, { ry: Math.PI / 2, parent: w });
    mesh(cyl(0.12, 0.12, 0.1, 8), chrome, { rz: Math.PI / 2, parent: w });
    wheels.push(w);
  }
  mesh(new THREE.BoxGeometry(0.3, 0.3, 0.9), red, { y: 0.62, z: 0.05, parent: g });
  mesh(new THREE.BoxGeometry(0.26, 0.12, 0.6), black, { y: 0.8, z: -0.3, parent: g });
  mesh(new THREE.BoxGeometry(0.22, 0.2, 0.3), chrome, { y: 0.45, z: 0.0, parent: g });
  mesh(cyl(0.04, 0.04, 0.8, 6), chrome, { y: 0.78, z: 0.62, rx: -0.4, parent: g });
  mesh(cyl(0.025, 0.025, 0.7, 6), chrome, { y: 1.12, z: 0.5, rz: Math.PI / 2, parent: g });
  mesh(cyl(0.05, 0.06, 0.6, 6), chrome, { x: 0.18, y: 0.35, z: -0.55, rx: Math.PI / 2 - 0.2, parent: g });
  const lamp = mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff6c0 }), { y: 0.95, z: 0.78, parent: g });
  g.userData.wheels = wheels; g.userData.lamp = lamp;
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return g;
}
