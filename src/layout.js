// Venue layout (metres). North = -Z (ceremony), South = +Z (gate).
export const L = {
  bounds: { minX: -16, maxX: 16, minZ: -23, maxZ: 22 },
  arch: { x: 0, z: -20, w: 3.0, h: 3.4 },
  officiant: { x: 0, z: -19.3 },
  flutist: { x: 2.4, z: -18.4 },
  mic: { x: 2.4, z: -17.8 },
  strip: { x: 3.7, z: -19.0 },
  booth: { x: 7.2, z: -19.6, w: 2.4, d: 0.9, h: 1.1 },
  dj: { x: 7.2, z: -20.5 },
  speakers: [{ x: 5.3, z: -20.3 }, { x: 9.1, z: -20.3 }],
  banquet: { x: -7.1, z: -19.9, len: 7.0, w: 1.1, h: 0.78 }, // along X: -10.6 .. -3.6
  tower: { x: -4.35, z: -19.9 },
  cake: { x: -9.9, z: -19.9 },
  dogBed: { x: -12.3, z: -17.2 },
  aisle: { z0: -18.6, z1: -5.2, w: 1.3 },
  chairs: { rows: 7, z0: -16.4, dz: 1.5, xs: [1.25, 1.9, 2.55, 3.2] },
  gifts: { x: -8.8, z: -11, w: 2.2, d: 0.9 },
  bar: { x: -10, z: 3.2, w: 3.4, d: 0.9 },
  punch: { x: -10.9, z: 3.2 },
  dance: { x: 0, z: 6.5, size: 8 },
  tent: { x: 11.5, z: 6.5, r: 2.4 },
  gate: { x: 0, z: 21.5 },
  sign: { x: -2.6, z: 19.2 },
  spawn: { x: 0, z: 17.5 },
  uncle: { x: 5.2, z: 10.4 },
  kids: { x: 9, z: -6, w: 1.8, d: 0.8, h: 0.48 }, // the kids' table (along X), two small chairs per long side
};
