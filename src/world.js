// Builds the garden wedding venue. Returns handles to every prop the story needs.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { L } from './layout.js';
import { buildKaiju } from './kaiju.js';
import { mat, mesh, canvasTex, addBox, addCircle, rand, pick } from './util.js';

const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt, rb, h, s = 8) => new THREE.CylinderGeometry(rt, rb, h, s);

function tr(geo, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const g = geo.clone();
  g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(1, 1, 1)));
  return g;
}

export function buildWorld(scene, tex) {
  const W = { scene, anim: [] };
  const root = new THREE.Group();
  scene.add(root);
  W.root = root;

  // ---------------- sky & lights ----------------
  scene.background = new THREE.Color(0x4a4f8e);
  scene.fog = new THREE.Fog(0xc8889a, 45, 190);
  if (tex.sky) {
    tex.sky.wrapS = THREE.MirroredRepeatWrapping;
    tex.sky.repeat.set(2, 1);
    const H = 282;
    const skyGeo = new THREE.CylinderGeometry(180, 180, H, 48, 1, true);
    const sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ map: tex.sky, side: THREE.BackSide, fog: false, depthWrite: false }));
    sky.position.y = H / 2 - H * 0.30;
    sky.rotation.y = Math.PI * 0.5;
    sky.renderOrder = -10;
    root.add(sky);
    W.sky = sky;
  }
  const hemi = new THREE.HemisphereLight(0xb0a0e0, 0x4a5a30, 1.25);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffb070, 2.4);
  sun.position.set(-38, 20, -10);
  sun.target.position.set(0, 0, -2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera;
  sc.left = -30; sc.right = 30; sc.top = 30; sc.bottom = -30; sc.near = 1; sc.far = 110;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);
  W.hemi = hemi; W.sun = sun;

  // ---------------- ground ----------------
  const grassMat = new THREE.MeshStandardMaterial({ color: 0xb8d090, map: tex.grass || null, roughness: 1 });
  if (tex.grass) { tex.grass.wrapS = tex.grass.wrapT = THREE.RepeatWrapping; tex.grass.repeat.set(70, 70); }
  const ground = mesh(new THREE.PlaneGeometry(420, 420), grassMat, { rx: -Math.PI / 2, cast: false, parent: root });
  W.ground = ground;
  // gravel path gate -> dance floor
  const pathMat = mat(0xd9c7a0, { flat: false, rough: 1 });
  mesh(new THREE.PlaneGeometry(2.4, 12), pathMat, { x: 0, y: 0.01, z: 15.5, rx: -Math.PI / 2, cast: false, parent: root });
  mesh(new THREE.PlaneGeometry(2.4, 5.5), pathMat, { x: 0, y: 0.01, z: -0.4, rx: -Math.PI / 2, cast: false, parent: root });

  // ---------------- hedges ----------------
  const hedgeMat = new THREE.MeshStandardMaterial({ color: 0x9fbf80, map: tex.hedge || null, roughness: 1 });
  const B = L.bounds;
  const hedge = (x, z, w, d) => {
    const m = hedgeMat.clone();
    if (tex.hedge) { m.map = tex.hedge.clone(); m.map.wrapS = m.map.wrapT = THREE.RepeatWrapping; m.map.repeat.set(Math.max(w, d) / 2, 0.8); m.map.needsUpdate = true; }
    mesh(box(w, 1.7, d), m, { x, y: 0.85, z, parent: root });
    addBox(x, z, w, d, 'hedge');
  };
  hedge(B.minX, (B.minZ + B.maxZ) / 2, 1, B.maxZ - B.minZ);
  hedge(B.maxX, (B.minZ + B.maxZ) / 2, 1, B.maxZ - B.minZ);
  hedge(0, B.minZ, B.maxX - B.minX + 1, 1);
  hedge((B.minX - 2) / 2, B.maxZ, B.maxX - 2 + 1, 1);
  hedge((B.maxX + 2) / 2, B.maxZ, B.maxX - 2 + 1, 1);

  // ---------------- trees outside ----------------
  const trunkMat = mat(0x6b4a2f), leafMats = [mat(0x3f6b2a), mat(0x4d7a32), mat(0x2f5a2a), mat(0x5a7f2f)];
  const cypress = new THREE.ConeGeometry(1, 1, 6), roundTree = new THREE.IcosahedronGeometry(1, 0);
  for (let i = 0; i < 70; i++) {
    const a = Math.random() * Math.PI * 2, r = rand(26, 70);
    const x = Math.cos(a) * r * 0.9, z = Math.sin(a) * r;
    if (Math.abs(x) < 4 && z > 20) continue; // keep gate road clear
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    if (Math.random() < 0.5) {
      const h = rand(6, 11);
      mesh(cypress, pick(leafMats), { y: h / 2 + 0.6, parent: g }).scale.set(1.1, h, 1.1);
      mesh(cyl(0.15, 0.2, 1.2, 5), trunkMat, { y: 0.6, parent: g });
    } else {
      const s = rand(2.2, 3.8);
      mesh(roundTree, pick(leafMats), { y: s + 1.8, parent: g }).scale.setScalar(s);
      mesh(cyl(0.25, 0.35, 2.6, 5), trunkMat, { y: 1.3, parent: g });
    }
    root.add(g);
  }
  // shrubs & flower pots along the inside of the hedges
  const potMat = mat(0xb4623a), bloom = [0xff8fb1, 0xffffff, 0xffd166, 0xe36bae, 0xc39bd3].map((c) => mat(c));
  const potGeo = cyl(0.35, 0.25, 0.5, 7), bushGeo = new THREE.IcosahedronGeometry(0.45, 0), flowerGeo = new THREE.IcosahedronGeometry(0.1, 0);
  const pot = (x, z) => {
    const g = new THREE.Group(); g.position.set(x, 0, z);
    mesh(potGeo, potMat, { y: 0.25, parent: g });
    mesh(bushGeo, leafMats[1], { y: 0.75, parent: g });
    for (let k = 0; k < 7; k++) mesh(flowerGeo, pick(bloom), { x: rand(-0.3, 0.3), y: rand(0.8, 1.15), z: rand(-0.3, 0.3), parent: g });
    root.add(g);
    addCircle(x, z, 0.4, 'pot');
  };
  for (let z = -18; z <= 18; z += 6) { pot(B.minX + 1.2, z); pot(B.maxX - 1.2, z); }
  pot(-2.2, -20.8); pot(2.2, -20.8); pot(-1.8, 20.3); pot(1.8, 20.3);

  buildArch(W, root);
  buildCeremony(W, root);
  buildBanquet(W, root);
  buildDJ(W, root);
  buildGifts(W, root);
  buildBar(W, root);
  buildKidsTable(W, root);
  buildDanceFloor(W, root);
  buildTent(W, root);
  buildGate(W, root);
  buildStringLights(W, root);
  buildCables(W, root);
  W.kaiju = buildKaiju(root); // way off in the distance. Nobody mentions it.
  return W;
}

// ---------------- ARCH ----------------
function buildArch(W, root) {
  const { x, z, w, h } = L.arch;
  const pivot = new THREE.Group();           // pivot at base of the west post, so it can fall west
  pivot.position.set(x - w / 2, 0, z);
  root.add(pivot);
  const arch = new THREE.Group();
  arch.position.x = w / 2;
  pivot.add(arch);
  const woodW = mat(0xf4efe6, { rough: 0.6 });
  const postH = h - w / 2;
  mesh(cyl(0.07, 0.09, postH, 6), woodW, { x: -w / 2, y: postH / 2, parent: arch });
  mesh(cyl(0.07, 0.09, postH, 6), woodW, { x: w / 2, y: postH / 2, parent: arch });
  mesh(new THREE.TorusGeometry(w / 2, 0.07, 5, 16, Math.PI), woodW, { y: postH, parent: arch });
  // flowers along the arch
  const pts = [];
  for (let i = 0; i < 90; i++) {
    const t = i / 89;
    if (t < 0.28) pts.push(new THREE.Vector3(-w / 2 + rand(-0.12, 0.12), postH * (t / 0.28) * 0.9 + 0.2, rand(-0.12, 0.12)));
    else if (t > 0.72) pts.push(new THREE.Vector3(w / 2 + rand(-0.12, 0.12), postH * ((1 - t) / 0.28) * 0.9 + 0.2, rand(-0.12, 0.12)));
    else { const a = Math.PI * (1 - (t - 0.28) / 0.44); pts.push(new THREE.Vector3(Math.cos(a) * w / 2 + rand(-0.12, 0.12), postH + Math.sin(a) * w / 2 + rand(-0.12, 0.12), rand(-0.14, 0.14))); }
  }
  const fl = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.13, 0), mat(0xffffff, { key: 'archflowers' }), pts.length);
  const cols = [0xffc2d4, 0xffffff, 0xff8fb1, 0xfff0c9, 0x9ccf7a, 0x7fb65a];
  const m4 = new THREE.Matrix4(), c = new THREE.Color();
  pts.forEach((p, i) => {
    const s = rand(0.6, 1.4);
    m4.compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(rand(0, 3), rand(0, 3), 0)), new THREE.Vector3(s, s, s));
    fl.setMatrixAt(i, m4); fl.setColorAt(i, c.set(pick(cols)));
  });
  fl.castShadow = true;
  arch.add(fl);
  // drapes
  const drape = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, side: THREE.DoubleSide, roughness: 1 });
  mesh(new THREE.PlaneGeometry(0.5, postH * 0.9), drape, { x: -w / 2 + 0.25, y: postH * 0.55, z: 0.05, parent: arch, cast: false });
  mesh(new THREE.PlaneGeometry(0.5, postH * 0.9), drape, { x: w / 2 - 0.25, y: postH * 0.55, z: 0.05, parent: arch, cast: false });
  W.archPivot = pivot; W.arch = arch;
  W.archColliders = [addCircle(x - w / 2, z, 0.2, 'arch'), addCircle(x + w / 2, z, 0.2, 'arch')];
  // tag hanging from the arch
  const tag = canvasTex(256, 128, (g) => {
    g.fillStyle = '#fff8e8'; g.fillRect(0, 0, 256, 128); g.strokeStyle = '#a33'; g.lineWidth = 6; g.strokeRect(4, 4, 248, 120);
    g.fillStyle = '#a33'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center';
    g.fillText('RENTAL - $2,400', 128, 50); g.font = '20px sans-serif'; g.fillText('deposit non-refundable', 128, 90);
  });
  mesh(new THREE.PlaneGeometry(0.4, 0.2), new THREE.MeshStandardMaterial({ map: tag, side: THREE.DoubleSide }), { x: w / 2 + 0.12, y: 1.3, z: 0.12, parent: arch, cast: false });
}

// ---------------- CEREMONY: aisle, chairs, mic ----------------
function buildCeremony(W, root) {
  const A = L.aisle;
  const runner = mesh(new THREE.PlaneGeometry(A.w, A.z1 - A.z0), mat(0xf6efe2, { flat: false, rough: 1 }),
    { x: 0, y: 0.015, z: (A.z0 + A.z1) / 2, rx: -Math.PI / 2, cast: false, parent: root });
  W.runner = runner;
  // petals
  const petals = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.06, 0.05), new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide }), 260);
  const m4 = new THREE.Matrix4(), c = new THREE.Color();
  for (let i = 0; i < 260; i++) {
    m4.compose(new THREE.Vector3(rand(-A.w / 2 - 0.2, A.w / 2 + 0.2), 0.02, rand(A.z0, A.z1)), new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, rand(0, 6))), new THREE.Vector3(1, 1, 1));
    petals.setMatrixAt(i, m4); petals.setColorAt(i, c.set(pick([0xff8fb1, 0xffc2d4, 0xd6336c, 0xffffff])));
  }
  root.add(petals);
  // chairs
  const cm = mat(0xfafafa, { rough: 0.5 });
  const parts = [tr(box(0.44, 0.05, 0.42), 0, 0.46, 0), tr(box(0.44, 0.36, 0.04), 0, 0.8, 0.2)];
  for (const [lx, lz] of [[-0.19, -0.18], [0.19, -0.18], [-0.19, 0.18], [0.19, 0.18]]) parts.push(tr(box(0.04, 0.46, 0.04), lx, 0.23, lz));
  parts.push(tr(box(0.04, 0.5, 0.04), -0.19, 0.72, 0.2), tr(box(0.04, 0.5, 0.04), 0.19, 0.72, 0.2));
  const chairGeo = mergeGeometries(parts);
  const sash = mergeGeometries([tr(box(0.46, 0.12, 0.05), 0, 0.84, 0.23)]);
  const sashMat = mat(0xe8a0b8);
  W.chairs = [];
  const C = L.chairs;
  for (let r = 0; r < C.rows; r++) {
    const z = C.z0 + r * C.dz;
    for (const side of [-1, 1]) {
      for (const cx of C.xs) {
        const ch = new THREE.Group();
        ch.position.set(side * cx, 0, z);
        mesh(chairGeo, cm, { parent: ch });
        if (Math.abs(cx - C.xs[0]) < 0.01) mesh(sash, sashMat, { parent: ch });
        root.add(ch);
        W.chairs.push({ obj: ch, x: side * cx, z, seat: new THREE.Vector3(side * cx, 0, z), taken: false, row: r, side });
      }
      addBox(side * (C.xs[0] + C.xs[3]) / 2, z + 0.02, C.xs[3] - C.xs[0] + 0.5, 0.45, 'chairs');
    }
  }
  // mic stand for the flutist
  const mic = new THREE.Group();
  mic.position.set(L.mic.x, 0, L.mic.z);
  const blk = mat(0x1a1a1a, { rough: 0.4, metal: 0.4 });
  mesh(cyl(0.18, 0.2, 0.03, 10), blk, { y: 0.015, parent: mic });
  mesh(cyl(0.012, 0.012, 1.45, 6), blk, { y: 0.72, parent: mic });
  mesh(new THREE.SphereGeometry(0.045, 8, 6), mat(0x555555, { metal: 0.6, rough: 0.3 }), { y: 1.47, z: -0.05, parent: mic });
  root.add(mic);
  W.mic = mic;
  // officiant lectern
  const lec = mesh(cyl(0.18, 0.25, 1.05, 6), mat(0x8a5a3a), { x: 0, y: 0.52, z: -18.7, parent: root });
  W.lectern = lec;
  addCircle(0, -18.7, 0.3, 'lectern');
}

// ---------------- BANQUET TABLE, CHAMPAGNE TOWER, CAKE ----------------
function buildBanquet(W, root) {
  const T = L.banquet;
  const g = new THREE.Group();
  g.position.set(T.x, 0, T.z);
  root.add(g);
  const cloth = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true });
  const clothMesh = mesh(box(T.len + 0.1, T.h - 0.02, T.w + 0.1), cloth, { y: (T.h - 0.02) / 2 + 0.02, parent: g });
  mesh(box(T.len, 0.04, T.w), mat(0xffffff), { y: T.h - 0.02, parent: g });
  // runner stripe
  mesh(box(T.len + 0.12, 0.012, 0.35), mat(0xe8a0b8, { rough: 1 }), { y: T.h + 0.005, parent: g, cast: false });
  W.banquet = g; W.banquetCloth = clothMesh; W.clothMat = cloth;
  addBox(T.x, T.z, T.len + 0.1, T.w + 0.1, 'banquet');
  // food, plates, candles
  const plate = cyl(0.13, 0.1, 0.02, 10), candle = cyl(0.025, 0.025, 0.22, 6);
  const flameGeo = new THREE.ConeGeometry(0.02, 0.06, 5);
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffc050 });
  W.candleFlames = [];
  for (let i = 0; i < 9; i++) {
    const lx = -T.len / 2 + 0.6 + i * 0.7;
    if (Math.abs(T.x + lx - L.tower.x) < 0.7 || Math.abs(T.x + lx - L.cake.x) < 0.6) continue;
    mesh(plate, mat(0xf2f2f2), { x: lx, y: T.h + 0.01, z: 0.3, parent: g });
    mesh(new THREE.IcosahedronGeometry(0.07, 0), mat(pick([0xd2691e, 0x9acd32, 0xff6347, 0xdeb887])), { x: lx, y: T.h + 0.07, z: 0.3, parent: g });
    mesh(candle, mat(0xfff5dc), { x: lx + 0.35, y: T.h + 0.11, z: 0, parent: g });
    const f = mesh(flameGeo, flameMat, { x: lx + 0.35, y: T.h + 0.25, z: 0, parent: g, cast: false });
    W.candleFlames.push(f);
  }
  // champagne tower (pyramid of coupes)
  const coupe = new THREE.LatheGeometry([
    new THREE.Vector2(0.0, 0), new THREE.Vector2(0.04, 0), new THREE.Vector2(0.008, 0.01), new THREE.Vector2(0.006, 0.08),
    new THREE.Vector2(0.02, 0.085), new THREE.Vector2(0.055, 0.11), new THREE.Vector2(0.06, 0.125),
  ], 8);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0xfff3c0, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.1, flatShading: true });
  const liquid = new THREE.CylinderGeometry(0.052, 0.02, 0.025, 8);
  const liqMat = new THREE.MeshStandardMaterial({ color: 0xf5d36b, emissive: 0x6b4e10, roughness: 0.2, transparent: true, opacity: 0.85 });
  const tower = new THREE.Group();
  tower.position.set(L.tower.x, T.h, L.tower.z);
  root.add(tower);
  mesh(cyl(0.34, 0.36, 0.06, 12), mat(0xd4af37, { metal: 0.8, rough: 0.3 }), { y: 0.03, parent: tower });
  W.glasses = [];
  const levels = [4, 3, 2, 1];
  let y = 0.06;
  levels.forEach((n, li) => {
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const gg = new THREE.Group();
      gg.position.set((i - (n - 1) / 2) * 0.125, y, (j - (n - 1) / 2) * 0.125);
      mesh(coupe, glassMat, { parent: gg, cast: false });
      mesh(liquid, liqMat, { y: 0.108, parent: gg, cast: false });
      tower.add(gg);
      W.glasses.push({ obj: gg, level: li });
    }
    y += 0.125;
  });
  W.tower = tower;
  W.glassGeo = coupe; W.glassMat = glassMat;
  // bottle on top
  mesh(cyl(0.03, 0.04, 0.3, 8), mat(0x1f4d2b, { rough: 0.2 }), { x: 0.4, y: 0.15, z: 0.2, parent: tower });

  // cake
  const cake = new THREE.Group();
  cake.position.set(L.cake.x, T.h, L.cake.z);
  const icing = mat(0xfffaf0, { flat: false, rough: 0.7 }), pinkM = mat(0xf7a8c4, { flat: false });
  mesh(cyl(0.22, 0.26, 0.08, 10), mat(0xd4af37, { metal: 0.7, rough: 0.3 }), { y: 0.04, parent: cake });
  let cy = 0.08;
  [[0.34, 0.24], [0.26, 0.22], [0.18, 0.2]].forEach(([r, h]) => {
    mesh(cyl(r, r, h, 14), icing, { y: cy + h / 2, parent: cake });
    mesh(new THREE.TorusGeometry(r, 0.025, 5, 14), pinkM, { y: cy + 0.02, rx: Math.PI / 2, parent: cake });
    cy += h;
  });
  // topper couple
  const tp = new THREE.Group(); tp.position.y = cy; cake.add(tp);
  mesh(new THREE.ConeGeometry(0.05, 0.14, 6), mat(0xffffff), { x: 0.04, y: 0.07, parent: tp });
  mesh(new THREE.SphereGeometry(0.025, 6, 5), mat(0xf0c090), { x: 0.04, y: 0.16, parent: tp });
  mesh(cyl(0.03, 0.035, 0.14, 6), mat(0x222233), { x: -0.04, y: 0.07, parent: tp });
  mesh(new THREE.SphereGeometry(0.025, 6, 5), mat(0xf0c090), { x: -0.04, y: 0.16, parent: tp });
  // strawberries
  for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; mesh(new THREE.ConeGeometry(0.025, 0.05, 5), mat(0xd62839), { x: Math.cos(a) * 0.3, y: 0.34, z: Math.sin(a) * 0.3, rx: Math.PI, parent: cake }); }
  root.add(cake);
  W.cake = cake; W.cakeTopper = tp;
  // cake knife
  mesh(box(0.03, 0.01, 0.3), mat(0xcccccc, { metal: 0.9, rough: 0.2 }), { x: L.cake.x + 0.45, y: T.h + 0.01, z: L.cake.z + 0.2, ry: 0.4, parent: root });

  // dog bed
  const bed = new THREE.Group();
  bed.position.set(L.dogBed.x, 0, L.dogBed.z);
  mesh(new THREE.TorusGeometry(0.42, 0.14, 6, 12), mat(0x7a4a8a), { y: 0.12, rx: Math.PI / 2, parent: bed });
  mesh(cyl(0.42, 0.42, 0.08, 12), mat(0xc9a0dc), { y: 0.05, parent: bed });
  const bowl = mesh(cyl(0.12, 0.09, 0.07, 10), mat(0xc0392b), { x: 0.7, y: 0.035, z: 0.1, parent: bed });
  bowl.name = 'bowl';
  // name plate
  const plateTex = canvasTex(256, 96, (g2) => { g2.fillStyle = '#5b3a1a'; g2.fillRect(0, 0, 256, 96); g2.fillStyle = '#ffe9b0'; g2.font = 'bold 44px Georgia, serif'; g2.textAlign = 'center'; g2.fillText('BISCUIT', 128, 64); });
  mesh(new THREE.PlaneGeometry(0.5, 0.18), new THREE.MeshStandardMaterial({ map: plateTex }), { x: 0, y: 0.3, z: 0.57, parent: bed });
  root.add(bed);
  W.dogBed = bed;
}

// ---------------- DJ BOOTH, SPEAKERS, POWER STRIP ----------------
function buildDJ(W, root) {
  const D = L.booth;
  const g = new THREE.Group();
  g.position.set(D.x, 0, D.z);
  root.add(g);
  const front = canvasTex(512, 256, (c) => {
    const gr = c.createLinearGradient(0, 0, 512, 256); gr.addColorStop(0, '#12002a'); gr.addColorStop(1, '#2a0040');
    c.fillStyle = gr; c.fillRect(0, 0, 512, 256);
    c.shadowColor = '#ff2bd6'; c.shadowBlur = 24; c.fillStyle = '#ff5ce1'; c.font = 'bold 84px Impact, sans-serif'; c.textAlign = 'center';
    c.fillText('DJ SICK', 256, 110); c.shadowColor = '#29f0ff'; c.fillStyle = '#7ff7ff'; c.fillText('BEATZ', 256, 210);
  });
  const bodyM = mat(0x151020, { rough: 0.5 });
  mesh(box(D.w, D.h, D.d), [bodyM, bodyM, bodyM, bodyM, new THREE.MeshStandardMaterial({ map: front, emissive: 0xffffff, emissiveMap: front, emissiveIntensity: 0.6 }), bodyM], { y: D.h / 2, parent: g });
  // decks
  const deckM = mat(0x333333, { rough: 0.4 }), vinyl = mat(0x0a0a0a, { rough: 0.2 });
  W.vinyls = [];
  for (const dx of [-0.7, 0.7]) {
    mesh(box(0.6, 0.06, 0.5), deckM, { x: dx, y: D.h + 0.03, parent: g });
    W.vinyls.push(mesh(cyl(0.2, 0.2, 0.015, 16), vinyl, { x: dx, y: D.h + 0.07, parent: g }));
  }
  mesh(box(0.5, 0.08, 0.4), mat(0x222222), { x: 0, y: D.h + 0.04, parent: g });
  // laptop
  mesh(box(0.34, 0.015, 0.24), mat(0xaaaaaa, { metal: 0.6, rough: 0.3 }), { x: 0, y: D.h + 0.09, z: -0.05, parent: g });
  const scr = mesh(box(0.34, 0.22, 0.01), new THREE.MeshStandardMaterial({ color: 0x223355, emissive: 0x3366ff, emissiveIntensity: 0.8 }), { x: 0, y: D.h + 0.2, z: -0.17, rx: -0.2, parent: g });
  W.djScreen = scr;
  // energy drink
  const canTex = canvasTex(128, 128, (c) => { c.fillStyle = '#39ff14'; c.fillRect(0, 0, 128, 128); c.fillStyle = '#000'; c.font = 'bold 40px Impact'; c.fillText('VOLT', 18, 80); });
  const can = mesh(cyl(0.035, 0.035, 0.12, 10), new THREE.MeshStandardMaterial({ map: canTex, metalness: 0.5, roughness: 0.3 }), { x: D.x - D.w / 2 + 0.08, y: D.h + 0.06, z: D.z + 0.3, parent: root });
  W.drink = can;
  addBox(D.x, D.z, D.w, D.d, 'booth');
  // speakers
  const spkM = mat(0x111111, { rough: 0.6 }), coneM = mat(0x2a2a2a, { rough: 0.3 });
  W.speakerCones = [];
  const speaker = (x, z, ry = 0, h = 1.6) => {
    const s = new THREE.Group(); s.position.set(x, 0, z); s.rotation.y = ry;
    mesh(box(0.6, h, 0.5), spkM, { y: h / 2, parent: s });
    W.speakerCones.push(mesh(cyl(0.2, 0.2, 0.04, 12), coneM, { y: h * 0.35, z: 0.26, rx: Math.PI / 2, parent: s }));
    W.speakerCones.push(mesh(cyl(0.1, 0.1, 0.04, 10), coneM, { y: h * 0.72, z: 0.26, rx: Math.PI / 2, parent: s }));
    root.add(s);
    addBox(x, z, 0.6, 0.5, 'speaker');
    return s;
  };
  W.speakers = L.speakers.map((p) => speaker(p.x, p.z));
  speaker(L.dance.x - L.dance.size / 2 - 0.6, L.dance.z - L.dance.size / 2 + 0.4, 0.6, 1.3);
  speaker(L.dance.x + L.dance.size / 2 + 0.6, L.dance.z - L.dance.size / 2 + 0.4, -0.6, 1.3);
  // power strip
  const st = new THREE.Group();
  st.position.set(L.strip.x, 0, L.strip.z);
  mesh(box(0.42, 0.05, 0.1), mat(0xeeeeee, { rough: 0.5 }), { y: 0.025, parent: st });
  const led = mesh(box(0.05, 0.02, 0.05), new THREE.MeshBasicMaterial({ color: 0xff2020 }), { x: -0.17, y: 0.055, parent: st });
  for (let i = 0; i < 4; i++) mesh(box(0.06, 0.03, 0.06), mat(0x222222), { x: -0.08 + i * 0.08, y: 0.06, parent: st });
  const warn = canvasTex(256, 128, (c) => { c.fillStyle = '#ffd000'; c.fillRect(0, 0, 256, 128); c.fillStyle = '#000'; c.font = 'bold 30px sans-serif'; c.textAlign = 'center'; c.fillText('KEEP DRY', 128, 55); c.font = '18px sans-serif'; c.fillText('(seriously)', 128, 95); });
  mesh(new THREE.PlaneGeometry(0.3, 0.15), new THREE.MeshStandardMaterial({ map: warn }), { x: 0, y: 0.09, z: 0.1, rx: -0.6, parent: st });
  root.add(st);
  W.strip = st; W.stripLed = led;
}

// ---------------- GIFT TABLE ----------------
function buildGifts(W, root) {
  const G = L.gifts;
  mesh(box(G.w, 0.75, G.d), mat(0xffffff, { rough: 0.9 }), { x: G.x, y: 0.375, z: G.z, parent: root });
  addBox(G.x, G.z, G.w, G.d, 'gifts');
  W.gifts = [];
  const colors = [[0xe63946, 0xffd166], [0x457b9d, 0xffffff], [0x2a9d8f, 0xe9c46a], [0x9b5de5, 0xf15bb5], [0xf4a261, 0x264653], [0xffffff, 0xe63946]];
  let x = G.x - G.w / 2 + 0.3;
  colors.forEach(([c1, c2], i) => {
    const s = rand(0.25, 0.42);
    const g = new THREE.Group();
    g.position.set(x, 0.75 + s / 2, G.z + rand(-0.15, 0.15));
    g.rotation.y = rand(-0.4, 0.4);
    mesh(box(s, s, s), mat(c1), { parent: g });
    mesh(box(s + 0.01, s + 0.01, 0.05), mat(c2), { parent: g });
    mesh(box(0.05, s + 0.01, s + 0.01), mat(c2), { parent: g });
    mesh(new THREE.TorusGeometry(0.06, 0.02, 4, 8), mat(c2), { y: s / 2 + 0.04, parent: g });
    root.add(g);
    W.gifts.push({ obj: g, base: g.position.clone(), size: s });
    x += s + 0.05;
  });
  // stacked gift on top
  const top = W.gifts[2];
  top.obj.position.y += 0;
  const sign = canvasTex(256, 128, (c) => { c.fillStyle = '#fff'; c.fillRect(0, 0, 256, 128); c.fillStyle = '#333'; c.font = 'italic 34px Georgia'; c.textAlign = 'center'; c.fillText('Gifts & Cards', 128, 55); c.font = '18px Georgia'; c.fillText('(cash preferred, honestly)', 128, 95); });
  mesh(new THREE.PlaneGeometry(0.6, 0.3), new THREE.MeshStandardMaterial({ map: sign }), { x: G.x, y: 0.95, z: G.z + G.d / 2 + 0.01, parent: root });
}

// ---------------- BAR & PUNCH ----------------
function buildBar(W, root) {
  const B = L.bar;
  const woodM = new THREE.MeshStandardMaterial({ color: 0xc08a5a, roughness: 0.8, flatShading: true });
  mesh(box(B.w, 1.05, B.d), woodM, { x: B.x, y: 0.525, z: B.z, parent: root });
  mesh(box(B.w + 0.1, 0.05, B.d + 0.1), mat(0x3a2a1a), { x: B.x, y: 1.07, z: B.z, parent: root });
  addBox(B.x, B.z, B.w, B.d, 'bar');
  // bottles
  for (let i = 0; i < 7; i++) {
    const c = pick([0x1f4d2b, 0x6b2d0f, 0x88aacc, 0xcc3344, 0xf5e6a8]);
    mesh(cyl(0.035, 0.045, 0.3, 7), mat(c, { rough: 0.2 }), { x: B.x + 0.2 + i * 0.18, y: 1.25, z: B.z - 0.2, parent: root });
  }
  // punch bowl
  const bowl = new THREE.LatheGeometry([new THREE.Vector2(0.001, 0), new THREE.Vector2(0.12, 0), new THREE.Vector2(0.06, 0.05), new THREE.Vector2(0.3, 0.2), new THREE.Vector2(0.33, 0.26)], 12);
  mesh(bowl, new THREE.MeshStandardMaterial({ color: 0xddeeff, transparent: true, opacity: 0.5, roughness: 0.1 }), { x: L.punch.x, y: 1.09, z: L.punch.z, parent: root, cast: false });
  const punch = mesh(cyl(0.3, 0.1, 0.16, 12), new THREE.MeshStandardMaterial({ color: 0xd0104c, roughness: 0.2, emissive: 0x300010 }), { x: L.punch.x, y: 1.09 + 0.12, z: L.punch.z, parent: root, cast: false });
  W.punch = punch;
  const sign = canvasTex(512, 200, (c) => {
    c.fillStyle = '#2b2b2b'; c.fillRect(0, 0, 512, 200); c.strokeStyle = '#c9a36b'; c.lineWidth = 8; c.strokeRect(6, 6, 500, 188);
    c.fillStyle = '#fff'; c.font = 'bold 60px "Comic Sans MS", cursive'; c.textAlign = 'center'; c.fillText('PUNCH', 256, 85);
    c.font = '28px "Comic Sans MS", cursive'; c.fillText('(definitely just juice)', 256, 140);
  });
  const easel = new THREE.Group(); easel.position.set(B.x - B.w / 2 - 0.7, 0, B.z + 0.4); easel.rotation.y = 0.4;
  mesh(box(0.9, 0.36, 0.03), new THREE.MeshStandardMaterial({ map: sign }), { y: 1.2, parent: easel });
  mesh(box(0.04, 1.3, 0.04), mat(0x6b4a2f), { x: -0.3, y: 0.65, rz: 0.1, parent: easel });
  mesh(box(0.04, 1.3, 0.04), mat(0x6b4a2f), { x: 0.3, y: 0.65, rz: -0.1, parent: easel });
  root.add(easel);
  // high-top cocktail tables
  for (const [x, z] of [[-6.5, 1.5], [-7.5, 8], [7, 12.5], [-4, 14]]) {
    mesh(cyl(0.35, 0.35, 0.04, 10), mat(0xffffff), { x, y: 1.05, z, parent: root });
    mesh(cyl(0.04, 0.04, 1.05, 6), mat(0xcccccc, { metal: 0.6 }), { x, y: 0.52, z, parent: root });
    mesh(cyl(0.38, 0.38, 0.9, 10, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }), { x, y: 0.6, z, parent: root });
    addCircle(x, z, 0.4, 'hightop');
  }
}

// ---------------- KIDS' TABLE ----------------
// A low table with plastic everything. W.kidSeats: where the kids sit ({ x, z, heading }).
function buildKidsTable(W, root) {
  const K = L.kids;
  const g = new THREE.Group(); g.position.set(K.x, 0, K.z); root.add(g);
  const cloth = canvasTex(128, 64, (c) => {
    c.fillStyle = '#ffe066'; c.fillRect(0, 0, 128, 64);
    const dots = ['#ff6f91', '#4dabf7', '#51cf66', '#9775fa'];
    for (let y = 0; y < 4; y++) for (let x = 0; x < 8; x++) { c.fillStyle = dots[(x + y) % 4]; c.beginPath(); c.arc(8 + x * 16 + (y % 2) * 8, 8 + y * 16, 4, 0, 7); c.fill(); }
  }, { repeat: [2, 1] });
  mesh(box(K.w, 0.05, K.d), new THREE.MeshStandardMaterial({ map: cloth, roughness: 0.9 }), { y: K.h, parent: g });
  mesh(box(K.w + 0.02, 0.12, K.d + 0.02), new THREE.MeshStandardMaterial({ map: cloth, roughness: 0.9 }), { y: K.h - 0.07, parent: g });
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(cyl(0.03, 0.03, K.h, 6), mat(0xffffff), { x: x * (K.w / 2 - 0.08), y: K.h / 2, z: z * (K.d / 2 - 0.08), parent: g });
  addBox(K.x, K.z, K.w, K.d, 'kids');
  // four little chairs, each a different colour
  const chairCols = [0xff6f91, 0x4dabf7, 0x51cf66, 0x9775fa];
  W.kidSeats = [];
  [[-0.45, -1], [0.45, -1], [-0.45, 1], [0.45, 1]].forEach(([x, side], i) => {
    const z = side * (K.d / 2 + 0.3), m = mat(chairCols[i], { rough: 0.4 });
    const ch = new THREE.Group(); ch.position.set(x, 0, z); ch.rotation.y = side < 0 ? 0 : Math.PI; g.add(ch);
    mesh(box(0.34, 0.04, 0.32), m, { y: 0.26, parent: ch });
    mesh(box(0.34, 0.3, 0.04), m, { y: 0.42, z: -0.16, parent: ch });
    for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(cyl(0.02, 0.02, 0.26, 5), m, { x: lx * 0.14, y: 0.13, z: lz * 0.13, parent: ch });
    W.kidSeats.push({ x: K.x + x, z: K.z + z - side * 0.04, heading: side < 0 ? 0 : Math.PI });
  });
  // plastic cups with straws, plates, crayons and toys
  const top = K.h + 0.025;
  [[-0.45, -0.2, 0xff6f91], [0.45, -0.2, 0x4dabf7], [-0.45, 0.2, 0x51cf66], [0.45, 0.2, 0x9775fa]].forEach(([x, z, c]) => {
    mesh(cyl(0.04, 0.03, 0.1, 8), mat(c, { rough: 0.3 }), { x: x + 0.12, y: top + 0.05, z, parent: g });
    mesh(cyl(0.005, 0.005, 0.14, 4), mat(0xffffff), { x: x + 0.13, y: top + 0.12, z, rz: 0.25, parent: g });
    mesh(cyl(0.1, 0.08, 0.015, 10), mat(0xffffff, { rough: 0.4 }), { x, y: top + 0.008, z, parent: g, cast: false });
  });
  // a stack of toy blocks, a rubber duck, a ball and a toy dinosaur
  [0xff6f91, 0x4dabf7, 0xffd43b].forEach((c, i) => mesh(box(0.07, 0.07, 0.07), mat(c), { x: 0.02, y: top + 0.035 + i * 0.07, z: 0.02, ry: i * 0.5, parent: g }));
  const duck = new THREE.Group(); duck.position.set(-0.15, top, -0.05); duck.rotation.y = 0.8; g.add(duck);
  mesh(new THREE.SphereGeometry(0.05, 8, 6), mat(0xffd43b), { y: 0.045, parent: duck }).scale.set(1.2, 0.8, 1);
  mesh(new THREE.SphereGeometry(0.032, 8, 6), mat(0xffd43b), { y: 0.1, z: 0.03, parent: duck });
  mesh(new THREE.ConeGeometry(0.015, 0.035, 5), mat(0xff922b), { y: 0.1, z: 0.07, rx: Math.PI / 2, parent: duck });
  mesh(new THREE.SphereGeometry(0.11, 10, 8), mat(0xff6b6b, { flat: false, rough: 0.35 }), { x: K.w / 2 + 0.35, y: 0.11, z: 0.3, parent: g });
  const dino = new THREE.Group(); dino.position.set(0.25, top, 0.05); dino.rotation.y = -0.6; g.add(dino);
  const dm = mat(0x51cf66);
  mesh(box(0.06, 0.06, 0.14), dm, { y: 0.07, parent: dino });
  mesh(box(0.04, 0.09, 0.04), dm, { y: 0.13, z: 0.07, parent: dino });
  mesh(box(0.05, 0.04, 0.07), dm, { y: 0.17, z: 0.1, parent: dino });
  mesh(new THREE.ConeGeometry(0.025, 0.1, 5), dm, { y: 0.07, z: -0.11, rx: -Math.PI / 2, parent: dino });
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) mesh(box(0.02, 0.04, 0.02), dm, { x: x * 0.02, y: 0.02, z: z * 0.04, parent: dino });
  // a balloon tied to a chair
  const bal = new THREE.Group(); bal.position.set(K.x - K.w / 2 - 0.1, 0, K.z - 0.6); root.add(bal);
  mesh(new THREE.SphereGeometry(0.16, 10, 8), mat(0xff6f91, { flat: false, rough: 0.3 }), { y: 1.45, parent: bal }).scale.set(1, 1.2, 1);
  mesh(cyl(0.003, 0.003, 1.3, 3), mat(0xffffff), { y: 0.65, parent: bal, cast: false });
  W.balloon = bal; // sways in main.js animateWorld
  // sign
  const sign = canvasTex(256, 128, (c) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, 256, 128); c.textAlign = 'center';
    c.fillStyle = '#e8590c'; c.font = 'bold 40px "Comic Sans MS", cursive'; c.fillText('KIDS\' TABLE', 128, 58);
    c.fillStyle = '#555'; c.font = '20px "Comic Sans MS", cursive'; c.fillText('(supervised*)   *not really', 128, 100);
  });
  const easel = new THREE.Group(); easel.position.set(K.x + K.w / 2 + 0.5, 0, K.z - 0.7); easel.rotation.y = -0.5; root.add(easel);
  mesh(box(0.6, 0.3, 0.02), new THREE.MeshStandardMaterial({ map: sign }), { y: 0.95, parent: easel });
  mesh(box(0.03, 1.0, 0.03), mat(0xffffff), { y: 0.5, z: -0.02, parent: easel });
}

// ---------------- DANCE FLOOR ----------------
function buildDanceFloor(W, root) {
  const D = L.dance, n = D.size;
  const tiles = new THREE.InstancedMesh(box(0.96, 0.06, 0.96), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, emissive: 0xffffff, emissiveIntensity: 0.0 }), n * n);
  const m4 = new THREE.Matrix4();
  let i = 0;
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    m4.makeTranslation(D.x - n / 2 + 0.5 + a, 0.03, D.z - n / 2 + 0.5 + b);
    tiles.setMatrixAt(i, m4); tiles.setColorAt(i, new THREE.Color(0x222222)); i++;
  }
  tiles.receiveShadow = true;
  root.add(tiles);
  W.danceTiles = tiles; W.danceN = n;
  // frame + disco ball
  const post = mat(0x2a2a2a, { metal: 0.5 });
  mesh(cyl(0.06, 0.06, 4.2, 6), post, { x: D.x - n / 2 - 0.3, y: 2.1, z: D.z, parent: root });
  mesh(cyl(0.06, 0.06, 4.2, 6), post, { x: D.x + n / 2 + 0.3, y: 2.1, z: D.z, parent: root });
  mesh(box(n + 0.6, 0.08, 0.08), post, { x: D.x, y: 4.2, z: D.z, parent: root });
  addCircle(D.x - n / 2 - 0.3, D.z, 0.15); addCircle(D.x + n / 2 + 0.3, D.z, 0.15);
  mesh(cyl(0.005, 0.005, 0.6, 3), post, { x: D.x, y: 3.9, z: D.z, parent: root });
  const ball = mesh(new THREE.IcosahedronGeometry(0.35, 1), new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.15, flatShading: true, emissive: 0x333344 }), { x: D.x, y: 3.45, z: D.z, parent: root });
  W.discoBall = ball;
}

// ---------------- BRIDE'S TENT ----------------
function buildTent(W, root) {
  const T = L.tent;
  const g = new THREE.Group();
  g.position.set(T.x, 0, T.z);
  const postM = mat(0xf4efe6);
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / n;
    mesh(cyl(0.05, 0.05, 2.5, 5), postM, { x: Math.cos(a) * T.r, y: 1.25, z: Math.sin(a) * T.r, parent: g });
    // curtains everywhere except the west-facing door
    const mid = a + Math.PI / n;
    if (Math.abs(Math.cos(mid) + 1) < 0.35) continue; // door facing -X
    const cur = mesh(new THREE.PlaneGeometry(2 * T.r * Math.sin(Math.PI / n), 2.4),
      new THREE.MeshStandardMaterial({ color: 0xfff6f0, transparent: true, opacity: 0.85, side: THREE.DoubleSide, roughness: 1 }),
      { x: Math.cos(mid) * T.r * 0.97, y: 1.25, z: Math.sin(mid) * T.r * 0.97, ry: -mid + Math.PI / 2, parent: g, cast: true });
    cur.receiveShadow = false;
  }
  mesh(new THREE.ConeGeometry(T.r + 0.4, 1.5, n), mat(0xfff0f5), { y: 3.2, ry: Math.PI / n, parent: g });
  mesh(new THREE.SphereGeometry(0.12, 6, 5), mat(0xd4af37, { metal: 0.8 }), { y: 4.0, parent: g });
  // mirror & vanity
  mesh(box(0.8, 0.75, 0.4), mat(0xffffff), { x: 1.4, y: 0.37, z: 0, parent: g });
  mesh(box(0.05, 0.9, 0.6), new THREE.MeshStandardMaterial({ color: 0xccddff, metalness: 1, roughness: 0.05 }), { x: 1.62, y: 1.25, z: 0, parent: g });
  root.add(g);
  // door sign
  W.tentSignDraw = (groom) => canvasTex(512, 256, (c) => {
    c.fillStyle = '#fff'; c.fillRect(0, 0, 512, 256); c.strokeStyle = '#e8a0b8'; c.lineWidth = 12; c.strokeRect(8, 8, 496, 240);
    c.fillStyle = '#c2185b'; c.font = 'bold 44px Georgia'; c.textAlign = 'center'; c.fillText('BRIDE ONLY', 256, 80);
    c.fillStyle = '#333'; c.font = '30px Georgia'; c.fillText('No grooms. This means', 256, 140); c.fillText('you, ' + groom + '.', 256, 185);
  });
  const signM = new THREE.MeshStandardMaterial({ map: W.tentSignDraw('Groom') });
  const sign = new THREE.Group(); sign.position.set(T.x - T.r - 1.2, 0, T.z + 1.3); sign.rotation.y = -Math.PI / 2 + 0.3;
  mesh(box(0.8, 0.42, 0.03), signM, { y: 1.1, parent: sign });
  mesh(box(0.04, 0.95, 0.04), mat(0x6b4a2f), { y: 0.47, parent: sign });
  root.add(sign);
  W.tentSignMat = signM;
  // colliders: ring of posts except door
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    if (Math.cos(a) < -0.8) continue;
    addCircle(T.x + Math.cos(a) * T.r, T.z + Math.sin(a) * T.r, 0.35, 'tent');
  }
}

// ---------------- GATE & WELCOME SIGN ----------------
function buildGate(W, root) {
  const G = L.gate;
  const brick = mat(0xb5654a, { rough: 1 });
  for (const s of [-1, 1]) {
    mesh(box(0.8, 2.6, 0.8), brick, { x: G.x + s * 2.0, y: 1.3, z: G.z, parent: root });
    mesh(box(0.95, 0.15, 0.95), mat(0xd9c7a0), { x: G.x + s * 2.0, y: 2.67, z: G.z, parent: root });
    addBox(G.x + s * 2.0, G.z, 0.8, 0.8, 'gate');
  }
  mesh(new THREE.TorusGeometry(2.0, 0.06, 5, 20, Math.PI), mat(0x222222, { metal: 0.7, rough: 0.4 }), { x: G.x, y: 2.6, z: G.z, parent: root });
  const bannerM = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide });
  mesh(new THREE.PlaneGeometry(2.6, 0.55), bannerM, { x: G.x, y: 3.55, z: G.z, parent: root });
  W.gateBannerMat = bannerM;
  // welcome easel
  const welcomeM = new THREE.MeshStandardMaterial();
  const easel = new THREE.Group();
  easel.position.set(L.sign.x, 0, L.sign.z);
  easel.rotation.y = 0.35;
  mesh(box(1.0, 1.3, 0.04), welcomeM, { y: 1.35, rx: -0.08, parent: easel });
  mesh(box(0.05, 1.8, 0.05), mat(0x6b4a2f), { x: -0.35, y: 0.9, rz: 0.08, parent: easel });
  mesh(box(0.05, 1.8, 0.05), mat(0x6b4a2f), { x: 0.35, y: 0.9, rz: -0.08, parent: easel });
  mesh(box(0.05, 1.8, 0.05), mat(0x6b4a2f), { y: 0.9, z: -0.35, rx: -0.3, parent: easel });
  root.add(easel);
  addCircle(L.sign.x, L.sign.z, 0.5, 'sign');
  W.welcomeMat = welcomeM;
  W.setNames = (bride, groom) => {
    W.welcomeMat.map = canvasTex(512, 666, (c) => {
      c.fillStyle = '#fbf7ef'; c.fillRect(0, 0, 512, 666);
      c.strokeStyle = '#c9a36b'; c.lineWidth = 10; c.strokeRect(14, 14, 484, 638);
      c.fillStyle = '#8a6a3a'; c.textAlign = 'center'; c.font = 'italic 40px Georgia'; c.fillText('Welcome to the', 256, 110); c.fillText('wedding of', 256, 160);
      c.fillStyle = '#c2185b'; c.font = 'bold 64px Georgia'; fitText(c, bride, 256, 270, 440); c.font = 'italic 44px Georgia'; c.fillText('&', 256, 330);
      c.font = 'bold 64px Georgia'; fitText(c, groom, 256, 410, 440);
      c.fillStyle = '#555'; c.font = '24px Georgia'; c.fillText('Unplugged ceremony.', 256, 500); c.fillText('Please: no phones,', 256, 535); c.fillText('no drama, NO FLUTES.', 256, 570);
    });
    W.welcomeMat.needsUpdate = true;
    W.gateBannerMat.map = canvasTex(1024, 216, (c) => {
      c.fillStyle = '#fff7fb'; c.fillRect(0, 0, 1024, 216); c.fillStyle = '#c2185b'; c.textAlign = 'center';
      c.font = 'bold 92px Georgia'; fitText(c, `${bride} ♥ ${groom}`, 512, 140, 960);
    });
    W.gateBannerMat.needsUpdate = true;
    W.tentSignMat.map = W.tentSignDraw(groom);
    W.tentSignMat.needsUpdate = true;
  };
}

function fitText(c, text, x, y, maxW) {
  let size = parseInt(c.font.match(/(\d+)px/)[1], 10);
  while (c.measureText(text).width > maxW && size > 12) { size -= 2; c.font = c.font.replace(/\d+px/, size + 'px'); }
  c.fillText(text, x, y);
}

// ---------------- STRING LIGHTS ----------------
function buildStringLights(W, root) {
  const poleM = mat(0x4a3520);
  const poles = [[-5.2, -17.5], [5.2, -17.5], [-5.2, -5.5], [5.2, -5.5], [-5.2, 11.5], [5.2, 11.5], [-9, 1], [9, 1]];
  const P = poles.map(([x, z]) => { mesh(cyl(0.06, 0.08, 4.4, 6), poleM, { x, y: 2.2, z, parent: root }); addCircle(x, z, 0.15, 'pole'); return new THREE.Vector3(x, 4.3, z); });
  const spans = [[0, 1], [2, 3], [0, 3], [1, 2], [2, 4], [3, 5], [4, 5], [2, 6], [3, 7], [6, 4], [7, 5], [0, 2], [1, 3]];
  const bulbPos = [];
  const wireM = new THREE.LineBasicMaterial({ color: 0x222222 });
  for (const [a, b] of spans) {
    const A = P[a], Bp = P[b], len = A.distanceTo(Bp), pts = [];
    const n = Math.floor(len / 0.6);
    for (let i = 0; i <= n; i++) {
      const t = i / n, p = A.clone().lerp(Bp, t);
      p.y -= Math.sin(t * Math.PI) * len * 0.07;
      pts.push(p);
      if (i > 0 && i < n) bulbPos.push(p.clone().add(new THREE.Vector3(0, -0.08, 0)));
    }
    root.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), wireM));
  }
  const bulbM = new THREE.MeshBasicMaterial({ color: 0xffd590 });
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.06, 6, 4), bulbM, bulbPos.length);
  const m4 = new THREE.Matrix4();
  bulbPos.forEach((p, i) => { m4.makeTranslation(p.x, p.y, p.z); bulbs.setMatrixAt(i, m4); });
  root.add(bulbs);
  W.bulbMat = bulbM;
  // a few real lights
  W.lamps = [];
  for (const [x, z] of [[0, -14], [0, -7], [0, 5], [-7, 3], [7, 3], [-7, -19], [7, -18]]) {
    const pl = new THREE.PointLight(0xffc27a, 9, 16, 1.6);
    pl.position.set(x, 3.8, z);
    root.add(pl);
    W.lamps.push(pl);
  }
  // lanterns on the aisle
  const lanternM = new THREE.MeshStandardMaterial({ color: 0xfff0c0, emissive: 0xffa640, emissiveIntensity: 1.2 });
  W.lanternMat = lanternM;
  for (let z = -17.5; z <= -6; z += 2.3) for (const s of [-1, 1]) {
    mesh(box(0.18, 0.28, 0.18), lanternM, { x: s * 0.85, y: 0.14, z, parent: root });
  }
}

// ---------------- CABLES ----------------
function buildCables(W, root) {
  const cableM = mat(0x111111, { flat: false, rough: 0.6 });
  const tube = (pts, r = 0.018) => {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
    return mesh(new THREE.TubeGeometry(curve, pts.length * 8, r, 5), cableM, { parent: root, cast: false });
  };
  const S = L.strip, B = L.booth, M = L.mic, T = L.banquet;
  // booth -> strip
  tube([[B.x - 0.5, 0.9, B.z - 0.46], [B.x - 0.8, 0.02, B.z - 0.3], [S.x + 0.8, 0.02, S.z], [S.x + 0.21, 0.03, S.z]]);
  // mic -> strip (the trip wire, loops right behind the flutist)
  W.tripCable = tube([[M.x, 0.02, M.z - 0.05], [M.x + 0.4, 0.02, M.z - 0.5], [L.flutist.x - 0.1, 0.03, L.flutist.z - 0.45], [L.flutist.x + 0.6, 0.02, L.flutist.z - 0.8], [S.x - 0.21, 0.03, S.z]]);
  // extension cord strip -> under the arch -> banquet table (fairy lights)
  W.extCable = tube([[S.x - 0.21, 0.03, S.z + 0.03], [2, 0.02, -19.6], [0, 0.02, -19.75], [-2.5, 0.02, -19.8], [T.x + T.len / 2 - 0.3, 0.02, T.z + 0.3], [T.x + T.len / 2 - 0.2, 0.5, T.z + 0.56]]);
  W.extCablePath = [[S.x, S.z], [2, -19.6], [0, -19.75], [-2.5, -19.8], [T.x + T.len / 2 - 0.3, T.z + 0.3]];
  // fairy light strand along the table front
  const fairyM = new THREE.MeshBasicMaterial({ color: 0xfff1b5 });
  W.fairyMat = fairyM;
  const n = 26;
  const fairy = new THREE.InstancedMesh(new THREE.SphereGeometry(0.025, 5, 4), fairyM, n);
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < n; i++) {
    const x = T.x - T.len / 2 + (i / (n - 1)) * T.len;
    m4.makeTranslation(x, T.h - 0.08 - Math.abs(Math.sin(i * 1.3)) * 0.1, T.z + T.w / 2 + 0.07);
    fairy.setMatrixAt(i, m4);
  }
  root.add(fairy);
}
