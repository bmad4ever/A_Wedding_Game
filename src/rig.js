// Mannequin rig: loads the low-poly mannequin, recolours it per outfit using the
// dominant bone of each vertex, strips the head (replaced by a face billboard)
// and exposes a tiny "model-space euler" posing API for procedural animation.
//
// Model space: +X = character's left, +Y = up, +Z = forward (facing).
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { asset } from './assets.js';
import { backOf } from './faces.js';

export const SCALE = 6.3;          // mannequin is ~0.28 units tall -> ~1.76 m
let TEMPLATE = null;
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler();
const _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();

export async function loadRig() {
  const gltf = await new GLTFLoader().loadAsync(asset('assets/mannequin.glb'));
  const scene = gltf.scene;
  let mesh = null;
  scene.traverse((o) => { if (o.isSkinnedMesh) mesh = o; });
  // dominant bone per vertex
  const geo = mesh.geometry;
  const si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
  const bones = mesh.skeleton.bones.map((b) => b.name);
  const dom = new Array(si.count);
  for (let i = 0; i < si.count; i++) {
    let best = 0, bw = -1;
    for (let k = 0; k < 4; k++) { const w = sw.getComponent(i, k); if (w > bw) { bw = w; best = si.getComponent(i, k); } }
    dom[i] = bones[best];
  }
  // rest data in model space
  scene.updateMatrixWorld(true);
  const restWorldQ = {}, restPos = {};
  scene.traverse((o) => {
    if (o.isBone) {
      restWorldQ[o.name] = o.getWorldQuaternion(new THREE.Quaternion());
      restPos[o.name] = o.getWorldPosition(new THREE.Vector3()).multiplyScalar(SCALE);
    }
  });
  // the model's origin is below the soles: lowest rest-pose vertex (metres, at height 1)
  const pos = mesh.geometry.attributes.position, v = new THREE.Vector3();
  let footY = Infinity;
  for (let i = 0; i < pos.count; i++) footY = Math.min(footY, v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).y);
  footY *= SCALE;
  // bind-space vertex positions (mesh is in bind pose)
  TEMPLATE = { scene, mesh, dom, restWorldQ, restPos, footY, geoCache: new Map() };
  return TEMPLATE;
}

// Outfit: colours per body region. Regions derived from bones.
// { skin, top, sleeves, pants, shoes, shirt (V-neck insert, optional), tie (optional), hips (pelvis override, optional) }
const REGION = {
  Pelvis: 'pants', Spine01: 'top', Spine02: 'top', Chest: 'top', Neck: 'skin', Head: 'head',
  ShoulderL: 'top', ShoulderR: 'top', ArmL: 'sleeves', ArmR: 'sleeves', ForearmL: 'sleeves', ForearmR: 'sleeves',
  HandL: 'skin', HandR: 'skin', ThighL: 'pants', ThighR: 'pants', TibiaL: 'pants', TibiaR: 'pants',
  FootL: 'shoes', FootR: 'shoes', ToeL: 'shoes', ToeR: 'shoes', Root: 'pants',
};

function outfitGeometry(outfit) {
  const key = JSON.stringify(outfit);
  if (TEMPLATE.geoCache.has(key)) return TEMPLATE.geoCache.get(key);
  const src = TEMPLATE.mesh.geometry;
  const pos = src.attributes.position;
  // find bind-space bounds to place the shirt V
  const m = TEMPLATE.mesh.matrixWorld; // bind pose -> model (unscaled)
  const v = new THREE.Vector3();
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  const neckY = TEMPLATE.restPos.Neck.y / SCALE, chestY = TEMPLATE.restPos.Spine02.y / SCALE;
  for (let i = 0; i < pos.count; i++) {
    const region = REGION[TEMPLATE.dom[i]] || 'top';
    let col = outfit[region] ?? outfit.top;
    if (outfit.hips && TEMPLATE.dom[i] === 'Pelvis') col = outfit.hips; // dresses: waist in the dress colour, legs bare
    v.fromBufferAttribute(pos, i).applyMatrix4(m);
    if (region === 'top' && outfit.shirt && v.z > 0.004) {
      // V-neck shirt insert on the front of the chest
      const t = (v.y - chestY) / (neckY - chestY);
      if (t > 0 && Math.abs(v.x) < 0.02 * t + 0.001) col = outfit.shirt;
      if (outfit.tie && t > 0.1 && Math.abs(v.x) < 0.0025) col = outfit.tie;
    }
    if (region === 'pants' && outfit.belt && Math.abs(v.y - TEMPLATE.restPos.Pelvis.y / SCALE - 0.004) < 0.0025) col = outfit.belt;
    c.set(col ?? 0xff00ff);
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  // drop the head triangles (head + neck are a billboard) and squash the neck ball into a low
  // collar cap, so the chest stays closed when seen from behind/above
  const index = src.index.array;
  const keep = [];
  for (let t = 0; t < index.length; t += 3) {
    const a = index[t], b = index[t + 1], d = index[t + 2];
    if (TEMPLATE.dom[a] === 'Head' && TEMPLATE.dom[b] === 'Head' && TEMPLATE.dom[d] === 'Head') continue;
    keep.push(a, b, d);
  }
  const g = src.clone();
  g.setIndex(keep);
  const gp = g.attributes.position, inv = m.clone().invert();
  const n = TEMPLATE.restPos.Neck.clone().divideScalar(SCALE), capY = n.y - 0.001;
  for (let i = 0; i < gp.count; i++) {
    if (TEMPLATE.dom[i] !== 'Neck' && TEMPLATE.dom[i] !== 'Head') continue;
    v.fromBufferAttribute(gp, i).applyMatrix4(m);
    v.set(n.x + (v.x - n.x) * 0.75, Math.min(v.y, capY), n.z + (v.z - n.z) * 0.75).applyMatrix4(inv);
    gp.setXYZ(i, v.x, v.y, v.z);
  }
  g.computeVertexNormals();
  g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  TEMPLATE.geoCache.set(key, g);
  return g;
}

const matCache = new Map();
function bodyMaterial(flat) {
  const k = flat ? 'f' : 's';
  if (!matCache.has(k)) matCache.set(k, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, metalness: 0.0, flatShading: !!flat }));
  return matCache.get(k);
}

export class Character {
  constructor({ outfit, face, faceSize = 0.42, name = '', height = 1 }) {
    this.name = name;
    this.root = new THREE.Group();
    this.root.name = 'char:' + name;
    const model = skeletonClone(TEMPLATE.scene);
    this.model = model;
    model.scale.setScalar(SCALE * height);
    this.root.add(model);
    this.bones = {};
    model.traverse((o) => {
      if (o.isBone) this.bones[o.name] = o;
      if (o.isSkinnedMesh) {
        this.mesh = o;
        o.geometry = outfitGeometry(outfit);
        o.material = bodyMaterial(false);
        o.castShadow = true;
        o.frustumCulled = false;
      }
    });
    this.rest = {};
    for (const n in this.bones) this.rest[n] = this.bones[n].quaternion.clone();
    this.p = {};          // pose accumulators: bone -> [x,y,z] model-space euler (radians)
    this.hipY = 0;        // pelvis vertical offset (metres)
    this.hipZ = 0;
    this.lift = TEMPLATE.footY * height; // model is lowered by this so the soles touch the ground
    this.lean = 0;
    // face billboard on the head bone
    this.front = face;
    this.faceMat = new THREE.SpriteMaterial({ map: face, transparent: true, alphaTest: 0.2, depthWrite: true });
    this.faceSprite = new THREE.Sprite(this.faceMat);
    this.faceSize = faceSize;
    // the sprite is a head + neck square (see faces.js normaliseHead): anchor its bottom-centre
    // (the neck's cut) just inside the collar, so it also rolls around the neck base
    this.faceSprite.scale.setScalar(faceSize * 1.2);
    this.faceSprite.center.set(0.5, 0);
    const headAnchor = new THREE.Object3D();
    this.attach('Head', headAnchor, new THREE.Vector3(0, 0.02, 0.0));
    headAnchor.add(this.faceSprite);
    this.faceSprite.position.y = ((TEMPLATE.restPos.Neck.y - TEMPLATE.restPos.Head.y) * height - 0.04);
    this.headAnchor = headAnchor;
    this.faceRoll = 0;
    this.extras = [];
    this.seed = Math.random() * 10;
  }

  setFace(tex) { this.front = tex; this.back = null; this._backView = false; this.faceMat.map = tex; this.faceMat.needsUpdate = true; }

  // Attach an object (built in metres, model-space orientation) to a bone.
  attach(boneName, obj, offset = new THREE.Vector3()) {
    const bone = this.bones[boneName];
    const qInv = TEMPLATE.restWorldQ[boneName].clone().invert();
    const holder = new THREE.Object3D();
    holder.quaternion.copy(qInv);
    holder.position.copy(offset).divideScalar(this.model.scale.x).applyQuaternion(qInv);
    holder.scale.setScalar(1 / this.model.scale.x);
    holder.add(obj);
    bone.add(holder);
    return holder;
  }

  // model-space euler rotation accumulate
  r(bone, x = 0, y = 0, z = 0) {
    const p = this.p[bone] || (this.p[bone] = [0, 0, 0]);
    p[0] += x; p[1] += y; p[2] += z;
  }

  clearPose() { for (const k in this.p) { const p = this.p[k]; p[0] = p[1] = p[2] = 0; } this.hipY = 0; this.hipZ = 0; this.faceRoll = 0; }

  applyPose() {
    for (const name in this.bones) {
      const b = this.bones[name];
      const p = this.p[name];
      if (!p || (p[0] === 0 && p[1] === 0 && p[2] === 0)) { b.quaternion.copy(this.rest[name]); continue; }
      const qw = TEMPLATE.restWorldQ[name];
      _q.setFromEuler(_e.set(p[0], p[1], p[2], 'XYZ'));
      // local = qw^-1 * qModel * qw
      _q2.copy(qw).invert().multiply(_q).multiply(qw);
      b.quaternion.copy(this.rest[name]).multiply(_q2);
    }
    // show the back of the head when the camera is behind us
    if (Character.camera && this.front) {
      const cp = Character.camera.position, rp = this.root.getWorldPosition(_v1);
      const dx = cp.x - rp.x, dz = cp.z - rp.z;
      const fw = this.root.getWorldDirection(_v2);
      const dot = (fw.x * dx + fw.z * dz) / (Math.hypot(dx, dz) + 1e-6);
      const want = this._backView ? dot < 0.05 : dot < -0.25;
      if (want !== this._backView) {
        this._backView = want;
        if (want && !this.back) this.back = backOf(this.front);
        this.faceMat.map = want && this.back ? this.back : this.front;
      }
    }
    this.model.position.y = this.hipY - this.lift;
    this.model.position.z = this.hipZ;
    this.faceMat.rotation = this.faceRoll;
  }
}

export function restPos(bone) { return TEMPLATE.restPos[bone].clone(); }
