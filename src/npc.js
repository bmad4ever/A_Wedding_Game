// NPC wrapper: movement, facing, mode-driven procedural animation.
import * as THREE from 'three';
import * as A from './anim.js';
import { addCircle, angleLerp, clock } from './util.js';

export class NPC {
  constructor(char, { name = '', voice = 1, role = '', collide = true } = {}) {
    this.c = char;
    this.name = name;
    this.role = role;
    this.voice = voice;
    this.mode = 'idle';
    this.arg = 0;
    this.target = null;
    this.speed = 1.4;
    this.heading = 0;
    this.moving = false;
    this.phase = Math.random() * 6;
    this.collider = collide ? addCircle(0, 0, 0.3, 'npc') : null;
    this.custom = null;       // optional (npc, t, dt) => void for extra posing
    this.lookAtTarget = null;
    this.t0 = Math.random() * 10;
  }
  get pos() { return this.c.root.position; }
  place(x, z, heading = 0) { this.c.root.position.set(x, 0, z); this.setHeading(heading); return this; }
  setHeading(h) { this.heading = h; this.c.root.rotation.y = h; }
  faceTo(x, z) { this.setHeading(Math.atan2(x - this.pos.x, z - this.pos.z)); }
  setMode(m, arg = 0) { this.mode = m; this.arg = arg; return this; }
  walkTo(x, z, { speed = 1.4, run = false } = {}) {
    this.speed = run ? Math.max(speed, 3.6) : speed;
    this.run = run;
    return new Promise((res) => { this.target = { x, z, res }; });
  }
  async path(points, opts) { for (const [x, z] of points) await this.walkTo(x, z, opts); }
  update(dt) {
    const t = clock.t + this.t0;
    const c = this.c;
    this.moving = false;
    if (this.manual && !this.target) {
      this.moving = this.manual.moving;
      this.run = this.manual.run;
      if (this.moving) this.phase += dt * this.manual.speed * (this.run ? 3.0 : 4.2);
    }
    if (this.target) {
      const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d < 0.08) { const r = this.target.res; this.target = null; r(); }
      else {
        const step = Math.min(d, this.speed * dt);
        this.pos.x += (dx / d) * step; this.pos.z += (dz / d) * step;
        this.setHeading(angleLerp(this.heading, Math.atan2(dx, dz), Math.min(1, dt * 10)));
        this.moving = true;
        this.phase += dt * this.speed * (this.run ? 3.0 : 4.2);
      }
    }
    if (this.collider) { this.collider.x = this.pos.x; this.collider.z = this.pos.z; }
    c.clearPose();
    if (this.moving) {
      if (this.mode === 'panicRun') { A.walk(c, this.phase, 1, 1); A.panic(c, t, true); }
      else if (this.mode === 'bouquet') { A.walk(c, this.phase, 1, this.run ? 1 : 0, false); A.holdBouquet(c); }
      else if (this.mode === 'cradle') { A.walk(c, this.phase, 1, this.run ? 1 : 0, false); A.cradle(c, t, this.arg); }
      else if (this.mode === 'kidStab') { A.walk(c, this.phase, 1, 1, false); A.kidStab(c, t, false); }
      else A.walk(c, this.phase, 1, this.run ? 1 : 0);
    } else {
      switch (this.mode) {
        case 'idle': A.idle(c, t); break;
        case 'sit': A.sit(c, t); A.idle(c, t, 0.5); break;
        case 'sitClap': A.sit(c, t); A.clap(c, t); break;
        case 'clap': A.idle(c, t, 0.3); A.clap(c, t); break;
        case 'talk': A.talk(c, t, 1); break;
        case 'dance': A.dance(c, t + this.t0, this.arg); break;
        case 'flute': A.flute(c, t, this.arg); break;
        case 'fluteIdle': A.flute(c, t * 0.3, 0); break;
        case 'dj': A.djBob(c, t, this.arg || 1); break;
        case 'panic': A.panic(c, t); break;
        case 'cheer': A.cheer(c, t); break;
        case 'point': A.point(c); break;
        case 'bouquet': A.idle(c, t, 0.5, false); A.holdBouquet(c); break;
        case 'drink': A.drink(c, t); break;
        case 'crouch': A.crouch(c, this.arg || 1); A.idle(c, t, 0.3); break;
        case 'hop': A.hopOnLeg(c, t); break;
        case 'faint': A.faint(c, this.arg); break;
        case 'ride': A.ride(c); break;
        case 'sitPanic': A.sit(c, t); A.panic(c, t); break;
        case 'photo': A.idle(c, t, 0.3); A.arm(c, 'L', { down: 0.9, fwd: 1.2, elbow: 1.9 }); A.arm(c, 'R', { down: 0.9, fwd: 1.2, elbow: 1.9 }); break;
        case 'cradle': A.idle(c, t, 0.3, false); A.cradle(c, t, this.arg); break;
        case 'sitCradle': A.sit(c, t); A.cradle(c, t, this.arg); break;
        case 'kidSit': A.kidSit(c, t, this.arg); break;
        case 'kidStab': A.kidStab(c, t, true, this.arg); break;
        case 'kidRally': A.kidRally(c, t); break;
        case 'kidGrab': A.kidGrab(c, t); break;
        case 'freeze': break;
        default: A.idle(c, t);
      }
    }
    if (this.custom) this.custom(this, t, dt);
    c.applyPose();
  }
}
