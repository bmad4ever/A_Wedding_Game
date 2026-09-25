// Procedural pose library. Every function adds rotations onto a Character's
// pose accumulator (see rig.js). Call c.clearPose() first, then any mix of
// these, then c.applyPose().
//
// Conventions (model space): x-rotation of a limb hanging down: negative = forward.
// Arm lowering from T-pose: z = -s*a  (s = +1 left, -1 right).
const S = { L: 1, R: -1 };
const sin = Math.sin, cos = Math.cos;

export function armsDown(c, a = 1.38) {
  c.r('ArmL', 0, 0, -a); c.r('ArmR', 0, 0, a);
}

// raise arm forward (f>0) with elbow bend e (>0 = bend forward/up)
export function arm(c, side, { down = 1.38, fwd = 0, out = 0, elbow = 0, twist = 0, hand = 0 } = {}) {
  const s = S[side];
  c.r('Arm' + side, -fwd, -s * out, -s * down);
  c.r('Forearm' + side, 0, -s * elbow, 0);
  if (twist) c.r('Arm' + side, twist, 0, 0);
  if (hand) c.r('Hand' + side, 0, 0, -s * hand);
}

export function leg(c, side, { fwd = 0, knee = 0, out = 0, foot = 0 } = {}) {
  const s = S[side];
  c.r('Thigh' + side, -fwd, 0, s * out);
  c.r('Tibia' + side, knee, 0, 0);
  if (foot) c.r('Foot' + side, foot, 0, 0);
}

export function idle(c, t, k = 1, arms = true) {
  const b = sin(t * 1.7 + c.seed) * 0.02 * k;
  if (arms) {
    arm(c, 'L', { down: 1.36 + b, fwd: 0.08, elbow: 0.15 });
    arm(c, 'R', { down: 1.36 - b, fwd: 0.08, elbow: 0.15 });
  }
  c.r('Spine01', b * 0.8, sin(t * 0.4 + c.seed) * 0.05, 0);
  c.r('Head', 0, 0, sin(t * 0.7 + c.seed * 2) * 0.05);
  c.faceRoll += sin(t * 0.7 + c.seed * 2) * 0.05;
  c.r('Pelvis', 0, 0, sin(t * 0.5 + c.seed) * 0.03);
}

// arms = false leaves the arms to the caller (e.g. holding a bouquet), since poses add up
export function walk(c, phase, amt = 1, run = 0, arms = true) {
  // phase runs backwards through the cycle so each knee bends while its leg swings forward (not while it pushes back)
  const sw = -sin(phase), cw = cos(phase);
  const A = (0.45 + run * 0.35) * amt;
  leg(c, 'L', { fwd: sw * A, knee: Math.max(0, -cw) * (0.7 + run * 0.6) * amt + 0.05 });
  leg(c, 'R', { fwd: -sw * A, knee: Math.max(0, cw) * (0.7 + run * 0.6) * amt + 0.05 });
  if (arms) {
    arm(c, 'L', { down: 1.35, fwd: -sw * (0.4 + run * 0.4) * amt, elbow: 0.25 + run * 0.9 });
    arm(c, 'R', { down: 1.35, fwd: sw * (0.4 + run * 0.4) * amt, elbow: 0.25 + run * 0.9 });
  }
  c.r('Spine01', 0.04 + run * 0.18, sw * 0.08 * amt, 0);
  c.hipY -= Math.abs(cw) * 0.035 * amt;
  c.faceRoll += sw * 0.04 * amt;
}

export function sit(c, t) {
  leg(c, 'L', { fwd: 1.5, knee: 1.5, out: 0.08 });
  leg(c, 'R', { fwd: 1.5, knee: 1.5, out: 0.08 });
  c.hipY -= 0.46 - c.lift; // seat height is absolute, not relative to the soles
  c.hipZ -= 0.05;
  c.r('Spine01', -0.05 + sin(t + c.seed) * 0.02, 0, 0);
}

export function clap(c, t, rate = 7) {
  const k = (sin(t * rate) + 1) * 0.5;
  arm(c, 'L', { down: 1.0, fwd: 0.9, out: 0, elbow: 1.1 + k * 0.35 });
  arm(c, 'R', { down: 1.0, fwd: 0.9, out: 0, elbow: 1.1 + k * 0.35 });
}

export function talk(c, t, intensity = 1) {
  const g = sin(t * 2.3 + c.seed);
  arm(c, 'L', { down: 1.35, fwd: 0.1, elbow: 0.2 });
  arm(c, 'R', { down: 1.1 - g * 0.15 * intensity, fwd: 0.35 + g * 0.15 * intensity, elbow: 1.2 + sin(t * 3.1) * 0.3 * intensity, hand: 0.3 });
  c.r('Head', sin(t * 5 + c.seed) * 0.06 * intensity, 0, 0);
  c.faceRoll += sin(t * 2.5 + c.seed) * 0.08 * intensity;
}

export function dance(c, t, style = 0, energy = 1) {
  const beat = t * (112 / 60) * Math.PI; // half-beat oscillation
  const b = sin(beat), b2 = sin(beat * 2);
  c.hipY -= (1 - Math.abs(cos(beat))) * 0.06 * energy;
  c.r('Pelvis', 0, 0, b * 0.12 * energy);
  c.faceRoll += b * 0.15 * energy;
  switch (style % 5) {
    case 0: // raise the roof
      arm(c, 'L', { down: -0.3 + b2 * 0.3, fwd: 0, elbow: 1.4 });
      arm(c, 'R', { down: -0.3 + b2 * 0.3, fwd: 0, elbow: 1.4 });
      leg(c, 'L', { fwd: 0.1, knee: 0.2 + Math.abs(b) * 0.3 });
      leg(c, 'R', { fwd: 0.1, knee: 0.2 + Math.abs(b) * 0.3 });
      break;
    case 1: // disco point
      arm(c, 'R', { down: b > 0 ? -0.9 : 1.2, fwd: 0.2, elbow: 0.1 });
      arm(c, 'L', { down: 1.2, fwd: 0.3, elbow: 1.2 });
      leg(c, 'L', { fwd: b * 0.25, knee: 0.2 });
      leg(c, 'R', { fwd: -b * 0.25, knee: 0.2 });
      c.r('Spine01', 0, b * 0.25, b * 0.08);
      break;
    case 2: // the sprinkler
      arm(c, 'L', { down: 0.2, fwd: 0.2, elbow: 1.8, out: 0.2 });
      arm(c, 'R', { down: 0.0, fwd: 0.1 + (b + 1) * 0.5, elbow: 0.0 });
      c.r('Spine01', 0, ((t * 2) % 2 - 1) * 0.6, 0);
      leg(c, 'L', { knee: 0.3 }); leg(c, 'R', { knee: 0.3 });
      break;
    case 3: // chicken dance
      arm(c, 'L', { down: 1.2 - Math.abs(b2) * 0.6, fwd: -0.2, elbow: 2.0 });
      arm(c, 'R', { down: 1.2 - Math.abs(b2) * 0.6, fwd: -0.2, elbow: 2.0 });
      c.r('Spine01', 0.2, 0, 0);
      c.r('Head', b2 * 0.2, 0, 0);
      leg(c, 'L', { fwd: 0.2, knee: 0.5 + b * 0.2, out: 0.2 });
      leg(c, 'R', { fwd: 0.2, knee: 0.5 - b * 0.2, out: 0.2 });
      c.hipY -= 0.08;
      break;
    case 4: // wave arms overhead
      arm(c, 'L', { down: -1.1, out: b * 0.4, elbow: 0.1 });
      arm(c, 'R', { down: -1.1, out: -b * 0.4, elbow: 0.1 });
      c.r('Spine01', 0, 0, b * 0.15);
      leg(c, 'L', { knee: 0.2 }); leg(c, 'R', { knee: 0.2 });
      break;
  }
}

export function flute(c, t, frenzy = 0) {
  const w = sin(t * (3 + frenzy * 9)) * (0.05 + frenzy * 0.12);
  arm(c, 'R', { down: 0.9 + w, fwd: 1.0, elbow: 2.2, out: 0.0, twist: 0 });
  arm(c, 'L', { down: 0.5 - w, fwd: 1.25, elbow: 1.6, out: -0.35 });
  c.r('Spine01', -0.08 - frenzy * 0.2 * (1 + sin(t * 4)), sin(t * 1.3) * (0.1 + frenzy * 0.3), sin(t * 0.9) * 0.1 * (1 + frenzy * 2));
  c.r('Head', 0, 0, 0.18);
  c.faceRoll += 0.25 + sin(t * (1 + frenzy * 6)) * 0.1 * (1 + frenzy * 3);
  leg(c, 'L', { fwd: 0.15, knee: 0.1 });
  leg(c, 'R', { fwd: -0.1, knee: 0.1 + frenzy * Math.abs(sin(t * 6)) * 0.4 });
}

export function djBob(c, t, energy = 1) {
  const beat = t * (112 / 60) * Math.PI * 2;
  c.r('Head', Math.max(0, sin(beat)) * 0.3 * energy, 0, 0);
  c.r('Spine01', Math.max(0, sin(beat)) * 0.08 * energy, 0, 0);
  arm(c, 'L', { down: 1.0, fwd: 0.8, elbow: 0.9 });
  arm(c, 'R', { down: 0.9, fwd: 0.6 + sin(beat * 0.25) * 0.2, elbow: 1.3 });
  c.hipY -= Math.max(0, sin(beat)) * 0.03 * energy;
  c.faceRoll += sin(beat * 0.5) * 0.1;
}

export function panic(c, t, run = 0) {
  arm(c, 'L', { down: -1.0 + sin(t * 17) * 0.4, out: sin(t * 13) * 0.4, elbow: 0.4 });
  arm(c, 'R', { down: -1.0 + sin(t * 15 + 1) * 0.4, out: sin(t * 11) * 0.4, elbow: 0.4 });
  c.faceRoll += sin(t * 20) * 0.15;
  if (!run) { leg(c, 'L', { knee: Math.max(0, sin(t * 14)) * 0.6, fwd: Math.max(0, sin(t * 14)) * 0.4 }); leg(c, 'R', { knee: Math.max(0, -sin(t * 14)) * 0.6, fwd: Math.max(0, -sin(t * 14)) * 0.4 }); }
}

export function cheer(c, t) {
  arm(c, 'L', { down: -1.2 + sin(t * 6) * 0.2, elbow: 0.3 });
  arm(c, 'R', { down: -1.2 - sin(t * 6) * 0.2, elbow: 0.3 });
  c.hipY -= Math.max(0, sin(t * 6)) * 0.05;
}

export function point(c, side = 'R') {
  arm(c, side, { down: 0.1, fwd: 1.3, elbow: 0 });
  arm(c, side === 'R' ? 'L' : 'R', { down: 1.35 });
}

export function holdBouquet(c) {
  arm(c, 'L', { down: 1.3, fwd: 0.35, elbow: 0.95, out: -0.3 });
  arm(c, 'R', { down: 1.3, fwd: 0.35, elbow: 0.95, out: -0.3 });
}

export function drink(c, t) {
  const up = (sin(t * 0.8 + c.seed) + 1) * 0.5;
  arm(c, 'R', { down: 1.2 - up * 0.3, fwd: 0.6 + up * 0.5, elbow: 1.5 + up * 0.8 });
  arm(c, 'L', { down: 1.35, fwd: 0.05 });
  c.r('Head', -up * 0.25, 0, 0);
}

export function crouch(c, amt = 1) {
  leg(c, 'L', { fwd: 1.2 * amt, knee: 2.0 * amt, out: 0.15 });
  leg(c, 'R', { fwd: 1.2 * amt, knee: 2.0 * amt, out: 0.15 });
  c.hipY -= 0.5 * amt;
  c.r('Spine01', 0.5 * amt, 0, 0);
}

export function hopOnLeg(c, t) {
  // uncle hopping, clutching his leg
  leg(c, 'L', { fwd: 0.7, knee: 1.6 });
  arm(c, 'L', { down: 0.9, fwd: 0.7, elbow: 0.8 });
  arm(c, 'R', { down: 0.9, fwd: 0.7, elbow: 0.8 });
  c.r('Spine01', 0.35, 0, sin(t * 9) * 0.1);
  c.hipY += Math.abs(sin(t * 9)) * 0.22;
  leg(c, 'R', { knee: 0.2 + Math.abs(sin(t * 9)) * 0.2 });
  c.faceRoll += sin(t * 9) * 0.2;
}

export function faint(c, k) {
  // fall backwards, k 0..1
  c.r('Pelvis', -k * 1.4, 0, 0);
  arm(c, 'L', { down: 1.38 - k * 1.2, fwd: k * 0.2 });
  arm(c, 'R', { down: 1.38 - k * 1.2, fwd: k * 0.2 });
  c.hipY -= k * (0.85 - c.lift);
  c.faceRoll += k * 1.2;
}

export function ride(c) {
  // sitting astride a motorbike
  leg(c, 'L', { fwd: 1.1, knee: 1.3, out: 0.3 });
  leg(c, 'R', { fwd: 1.1, knee: 1.3, out: 0.3 });
  arm(c, 'L', { down: 0.8, fwd: 1.0, elbow: 0.4, out: -0.2 });
  arm(c, 'R', { down: 0.8, fwd: 1.0, elbow: 0.4, out: -0.2 });
  c.r('Spine01', 0.35, 0, 0);
  c.hipY += c.lift; // saddle height is absolute
}

// holding a swaddled baby across the chest; rock (0..1) bounces it, for when it cries
export function cradle(c, t, rock = 0) {
  const b = sin(t * 9) * 0.12 * rock;
  arm(c, 'L', { down: 1.3 + b, fwd: 0.5, elbow: 1.4, out: -0.3 });
  arm(c, 'R', { down: 1.35 - b, fwd: 0.3, elbow: 1.1, out: -0.2 });
  c.r('Head', 0.3 + rock * sin(t * 4.5) * 0.1, 0, 0);
  c.hipY -= Math.abs(sin(t * 4.5)) * 0.03 * rock;
}

// the kids' table. Sitting on a small chair: sit() drops the hips for an adult chair, h = body height scale
export function kidSit(c, t, h) {
  sit(c, t);
  c.hipY += 0.46 * (1 - h) + 0.02;
  const k = sin(t * 2.2 + c.seed);
  // well-behaved: one hand fiddling with a toy on the table, the other at rest
  arm(c, 'R', { down: 0.95 + k * 0.08, fwd: 0.9, elbow: 0.7 + k * 0.25 });
  arm(c, 'L', { down: 1.1, fwd: 0.7, elbow: 0.5 });
  c.r('Head', 0.15 + sin(t * 1.1 + c.seed) * 0.08, sin(t * 0.7 + c.seed) * 0.2, 0);
  c.faceRoll += sin(t * 1.3 + c.seed) * 0.08;
}

// savage: jabbing with a plastic fork, bouncing on the spot (legs = false while walking; low = at someone on the ground)
export function kidStab(c, t, legs = true, low = 0) {
  const j = sin(t * 16 + c.seed);
  if (low) {
    arm(c, 'R', { down: 0.2 + j * 0.45, fwd: 1.0, elbow: 0.3 - j * 0.3 });
    c.r('Spine01', 0.45, 0, 0);
  } else arm(c, 'R', { down: -0.4 + j * 0.5, fwd: 0.8 + j * 0.4, elbow: 0.6 - j * 0.5 });
  arm(c, 'L', { down: 0.6 + sin(t * 11) * 0.3, fwd: 0.4, out: 0.3, elbow: 0.4 });
  c.r('Spine01', 0.15, sin(t * 5 + c.seed) * 0.2, 0);
  c.faceRoll += sin(t * 12 + c.seed) * 0.12;
  if (legs) {
    const h = Math.abs(sin(t * 8 + c.seed));
    c.hipY += h * 0.08;
    leg(c, 'L', { fwd: h * 0.3, knee: h * 0.6 });
    leg(c, 'R', { fwd: h * 0.2, knee: h * 0.5 });
  }
}

// savage: kneeling, wrapped around somebody's leg
export function kidGrab(c, t) {
  leg(c, 'L', { fwd: 0.25, knee: 1.7, out: 0.2 });
  leg(c, 'R', { fwd: 0.35, knee: 1.8, out: 0.2 });
  c.hipY -= 0.2;
  arm(c, 'L', { down: 0.9, fwd: 1.2, elbow: 1.4, out: -0.4 });
  arm(c, 'R', { down: 0.9, fwd: 1.2, elbow: 1.4, out: -0.4 });
  c.r('Spine01', 0.3, sin(t * 7 + c.seed) * 0.1, 0);
  c.faceRoll += sin(t * 9 + c.seed) * 0.15;
}

// the ringleader: jumping up and down on the fallen grown-up, fork thrust at the sky, fist pumping
export function kidRally(c, t) {
  const j = Math.abs(sin(t * 7));
  c.hipY += j * 0.14 - (1 - j) * 0.06;
  leg(c, 'L', { fwd: (1 - j) * 0.6, knee: (1 - j) * 1.1, out: 0.15 });
  leg(c, 'R', { fwd: (1 - j) * 0.6, knee: (1 - j) * 1.1, out: 0.15 });
  arm(c, 'R', { down: -1.3 + sin(t * 7) * 0.15, elbow: 0.1 });
  arm(c, 'L', { down: -0.3 + sin(t * 7 + 1.2) * 0.45, fwd: 0.3, elbow: 1.5 });
  c.r('Spine01', -0.15, sin(t * 2.1) * 0.35, 0);
  c.r('Head', -0.2, 0, 0);
  c.faceRoll += sin(t * 7) * 0.12;
}
