// The groom: third-person controller + orbit camera + cinematic camera shots.
import * as THREE from 'three';
import { Character } from './rig.js';
import { NPC } from './npc.js';
import { face } from './faces.js';
import { resolveCollisions, clamp, tween, easeInOut, angleLerp, clock } from './util.js';
import { L } from './layout.js';
import { settings } from './progress.js';
import { mat, mesh } from './util.js';

export class Player {
  constructor(scene, camera, dom) {
    const ch = new Character({ outfit: { skin: 0xf2c6a0, top: 0x1c1c24, sleeves: 0x1c1c24, pants: 0x1c1c24, shoes: 0x0a0a0a, shirt: 0xffffff, tie: 0xff5ca8 }, face: face('groom'), faceSize: 0.52, name: 'Groom' });
    // boutonniere
    const bout = new THREE.Group();
    mesh(new THREE.IcosahedronGeometry(0.035, 0), mat(0xff8fb1), { parent: bout });
    mesh(new THREE.IcosahedronGeometry(0.025, 0), mat(0x4d7a32), { x: 0.02, y: -0.03, parent: bout });
    ch.attach('Chest', bout, new THREE.Vector3(0.09, 0.02, 0.1));
    this.npc = new NPC(ch, { name: 'Groom', voice: 1.0, collide: false });
    this.npc.manual = { moving: false, speed: 0, run: false };
    this.npc.bubbleH = 2.3;
    scene.add(ch.root);
    this.camera = camera;
    this.dom = dom;
    this.keys = {};
    this.yaw = Math.PI; this.pitch = 0.28; this.dist = 4.2;
    this.enabled = false;
    this.cinematic = false;
    this.camPos = new THREE.Vector3(); this.camLook = new THREE.Vector3();
    this.drunk = 0;
    this.vel = new THREE.Vector3();
    this.dragging = false;
    addEventListener('keydown', (e) => { this.keys[e.code] = true; });
    addEventListener('keyup', (e) => { this.keys[e.code] = false; });
    addEventListener('blur', () => { this.keys = {}; });
    dom.addEventListener('mousedown', (e) => {
      if (!this.enabled) return;
      this.dragging = true;
      if (document.pointerLockElement !== dom && dom.requestPointerLock) { try { const p = dom.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* ignore */ } }
    });
    addEventListener('mouseup', () => { this.dragging = false; });
    addEventListener('mousemove', (e) => {
      if (!this.enabled) return;
      if (document.pointerLockElement === dom || this.dragging) {
        this.yaw -= e.movementX * 0.0028 * settings.sens;
        this.pitch = clamp(this.pitch + e.movementY * 0.0022 * settings.sens * (settings.invertY ? -1 : 1), -0.25, 1.1);
      }
    });
    dom.addEventListener('wheel', (e) => { if (this.enabled) this.dist = clamp(this.dist + Math.sign(e.deltaY) * 0.4, 2.2, 8); }, { passive: true });
    // touch: left half = move stick, right half = look
    this.touch = { move: null, look: null, mx: 0, my: 0 };
    dom.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        if (t.clientX < innerWidth / 2 && !this.touch.move) this.touch.move = { id: t.identifier, x: t.clientX, y: t.clientY };
        else if (!this.touch.look) this.touch.look = { id: t.identifier, x: t.clientX, y: t.clientY };
      }
    }, { passive: true });
    dom.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (this.touch.move && t.identifier === this.touch.move.id) { this.touch.mx = clamp((t.clientX - this.touch.move.x) / 50, -1, 1); this.touch.my = clamp((t.clientY - this.touch.move.y) / 50, -1, 1); }
        if (this.touch.look && t.identifier === this.touch.look.id) { this.yaw -= (t.clientX - this.touch.look.x) * 0.006; this.pitch = clamp(this.pitch + (t.clientY - this.touch.look.y) * 0.004, -0.25, 1.1); this.touch.look.x = t.clientX; this.touch.look.y = t.clientY; }
      }
    }, { passive: true });
    const tend = (e) => { for (const t of e.changedTouches) { if (this.touch.move && t.identifier === this.touch.move.id) { this.touch.move = null; this.touch.mx = this.touch.my = 0; } if (this.touch.look && t.identifier === this.touch.look.id) this.touch.look = null; } };
    dom.addEventListener('touchend', tend, { passive: true });
    dom.addEventListener('touchcancel', tend, { passive: true });
  }
  get pos() { return this.npc.pos; }
  spawn() {
    this.npc.place(L.spawn.x, L.spawn.z, Math.PI);
    this.yaw = Math.PI; this.pitch = 0.28; this.dist = 4.2;
    this.snapCamera();
  }
  unlock() { if (document.pointerLockElement) document.exitPointerLock(); }
  snapCamera() { this.computeOrbit(this.camPos, this.camLook); this.camera.position.copy(this.camPos); this.camera.lookAt(this.camLook); }
  computeOrbit(outPos, outLook) {
    const p = this.pos;
    outLook.set(p.x, 1.55, p.z);
    const cp = Math.cos(this.pitch);
    outPos.set(p.x - Math.sin(this.yaw) * this.dist * cp, 1.55 + Math.sin(this.pitch) * this.dist, p.z - Math.cos(this.yaw) * this.dist * cp);
    outPos.y = Math.max(0.4, outPos.y);
  }
  update(dt) {
    const n = this.npc;
    if (this.enabled && !this.cinematic) {
      let fx = 0, fz = 0;
      const k = this.keys;
      if (k.KeyW || k.ArrowUp) fz += 1;
      if (k.KeyS || k.ArrowDown) fz -= 1;
      if (k.KeyA || k.ArrowLeft) fx += 1;
      if (k.KeyD || k.ArrowRight) fx -= 1;
      fx -= this.touch.mx; fz -= this.touch.my;
      const run = !!(k.ShiftLeft || k.ShiftRight);
      const len = Math.hypot(fx, fz);
      const speed = run ? 5.2 : 2.6;
      if (len > 0.1) {
        fx /= Math.max(1, len); fz /= Math.max(1, len);
        const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
        let dx = s * fz + c * fx, dz = c * fz - s * fx;
        if (this.drunk > 0) { const w = Math.sin(clock.t * 1.7) * this.drunk * 0.6; const ox = dx * Math.cos(w) - dz * Math.sin(w); dz = dx * Math.sin(w) + dz * Math.cos(w); dx = ox; }
        this.vel.x += (dx * speed - this.vel.x) * Math.min(1, dt * 12);
        this.vel.z += (dz * speed - this.vel.z) * Math.min(1, dt * 12);
        n.setHeading(angleLerp(n.heading, Math.atan2(dx, dz), Math.min(1, dt * 12)));
      } else {
        this.vel.multiplyScalar(Math.max(0, 1 - dt * 14));
      }
      n.pos.x += this.vel.x * dt; n.pos.z += this.vel.z * dt;
      resolveCollisions(n.pos, 0.32);
      const B = L.bounds;
      n.pos.x = clamp(n.pos.x, B.minX + 0.8, B.maxX - 0.8);
      n.pos.z = clamp(n.pos.z, B.minZ + 0.8, B.maxZ + 3);
      const sp = Math.hypot(this.vel.x, this.vel.z);
      n.manual.moving = sp > 0.4; n.manual.speed = sp; n.manual.run = sp > 3.8;
      if (!n.target && n.mode !== 'dance' && n.mode !== 'drink' && n.mode !== 'crouch') n.mode = 'idle';
    } else {
      n.manual.moving = false;
    }
    n.update(dt);
    if (!this.cinematic) {
      const tp = new THREE.Vector3(), tl = new THREE.Vector3();
      this.computeOrbit(tp, tl);
      const k = Math.min(1, dt * 10);
      this.camPos.lerp(tp, k); this.camLook.lerp(tl, k);
      this.camera.position.copy(this.camPos);
      this.camera.lookAt(this.camLook);
      if (this.drunk > 0) this.camera.rotateZ(Math.sin(clock.t * 1.3) * 0.06 * this.drunk);
      // punch makes the world breathe
      const fov = 55 + (this.drunk > 0 ? Math.sin(clock.t * 0.9) * 3.5 * this.drunk : 0);
      if (Math.abs(this.camera.fov - fov) > 0.01) { this.camera.fov = fov; this.camera.updateProjectionMatrix(); }
    } else if (this.camera.fov !== 55) { this.camera.fov = 55; this.camera.updateProjectionMatrix(); }
  }
}

// cinematic camera helper
export class CineCam {
  constructor(camera) { this.camera = camera; this.pos = new THREE.Vector3(); this.look = new THREE.Vector3(); this.follow = null; this.fov = 55; }
  set(pos, look) { this.pos.copy(pos); this.look.copy(look); this.follow = null; this.apply(); }
  async move(pos, look, d = 2, ease = easeInOut) {
    this.follow = null;
    const p0 = this.pos.clone(), l0 = this.look.clone();
    await tween(d, (k) => { this.pos.lerpVectors(p0, pos, k); this.look.lerpVectors(l0, look, k); }, ease);
  }
  // follow an object: offset in world space, look at object + lookOff
  track(obj, offset, lookOff = new THREE.Vector3(0, 1, 0), smooth = 4) { this.follow = { obj, offset, lookOff, smooth }; }
  update(dt) {
    if (this.follow) {
      const f = this.follow, p = new THREE.Vector3();
      f.obj.getWorldPosition(p);
      const k = Math.min(1, dt * f.smooth);
      this.pos.lerp(p.clone().add(f.offset), k);
      this.look.lerp(p.clone().add(f.lookOff), k);
    }
    this.apply();
  }
  apply() { this.camera.position.copy(this.pos); this.camera.lookAt(this.look); }
}
