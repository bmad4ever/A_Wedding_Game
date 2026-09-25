// A Wedding Game — bootstrap, title screen, Act I (exploration) and the ending invoice.
import * as THREE from 'three';
import { loadRig, Character } from './rig.js';
import { loadFaces, face, imageToFace, loadFaceURL, setCustom, VARIANTS } from './faces.js';
import { buildWorld } from './world.js';
import { createCast } from './cast.js';
import { Player, CineCam } from './player.js';
import { FX } from './fx.js';
import { ui, names, fmt } from './ui.js';
import * as AU from './audio.js';
import { clock, tickScheduler, wait, tween, rand, pick, cancelAll, easeInOut, clamp, lerp, angleLerp, mat, mesh, addCircle, canvasTex } from './util.js';
import { L } from './layout.js';
import { asset } from './assets.js';
import { generateFaces } from './comfy.js';
import { CONFIG } from './config.js';
import { runCascade, standardBill } from './cascade.js';
import * as P from './props.js';
import { ACH, ENDINGS, progress, settings, saveSettings } from './progress.js';

const $ = (id) => document.getElementById(id);
const G = {
  state: 'loading', paused: false, busy: false, stats: null, world: null, cast: null, player: null, fx: null, cine: null,
  custom: { bride: null, groom: null }, photo: { bride: null, groom: null }, desc: { bride: '', groom: '' }, who: 'bride', interactables: [], current: null, fastForward: false, hintShown: false,
  flags: {}, bill: new Map(), album: [], runAch: new Set(), newAch: new Set(),
};
window.__G = G; // handy for debugging
const V = (x, y, z) => new THREE.Vector3(x, y, z);

// ------------------------------------------------------------------ renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
$('app').appendChild(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(55, innerWidth / innerHeight, 0.08, 600);
Character.camera = camera;
addEventListener('resize', () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  G.fx && G.fx.setScale(innerHeight);
});
addEventListener('error', (e) => ui.error('Error: ' + (e.message || e)));
addEventListener('unhandledrejection', (e) => ui.error('Error: ' + (e.reason && (e.reason.stack || e.reason.message) || e.reason)));
if ('ontouchstart' in window || matchMedia('(pointer: coarse)').matches) document.body.classList.add('touch');

// ------------------------------------------------------------------ achievements, album
function unlock(id, silent = false) {
  if (G.runAch.has(id)) return;
  G.runAch.add(id);
  if (progress.unlock(id)) G.newAch.add(id);
  if (silent) return;
  const a = ACH.find((x) => x.id === id);
  ui.toast('ACHIEVEMENT', `${a.name}: ${a.desc}`);
  AU.trumpetFanfare();
}
G.unlock = unlock;

// grab the current frame as a polaroid for the wedding album (4:3, 480px)
function capture(title) {
  renderer.render(scene, camera);
  const src = renderer.domElement, W = 480, H = 360;
  const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  const sw = Math.min(src.width, src.height * 4 / 3), sh = sw * 3 / 4;
  cv.getContext('2d').drawImage(src, (src.width - sw) / 2, (src.height - sh) / 2, sw, sh, 0, 0, W, H);
  const shot = { title, url: cv.toDataURL('image/jpeg', 0.72) };
  const i = G.album.findIndex((s) => s.title === title);
  if (i >= 0) G.album[i] = shot; else if (G.album.length < 12) G.album.push(shot);
}
G.capture = capture;

// ------------------------------------------------------------------ boot
const LOAD_LINES = ['Polishing the champagne glasses…', 'Ironing the tablecloths…', 'Teaching the dog to sit…', 'Tuning the string quartet… er, flute…', 'Arguing about the seating chart…', 'Folding 200 napkin swans…'];
async function boot() {
  let li = 0;
  const lt = setInterval(() => ui.loading(null, LOAD_LINES[++li % LOAD_LINES.length]), 700);
  ui.loading(0.05);
  await loadRig();
  ui.loading(0.2);
  await loadFaces((k) => ui.loading(0.2 + k * 0.5));
  const tl = new THREE.TextureLoader();
  const tex = {};
  await Promise.all(['sky', 'grass', 'hedge', 'wood'].map(async (n) => {
    try { tex[n] = await tl.loadAsync(asset(`assets/tex/${n}.jpg`)); tex[n].colorSpace = THREE.SRGBColorSpace; tex[n].anisotropy = 8; } catch (e) { /* fallback colours */ }
  }));
  ui.loading(0.8, 'Seating the guests…');
  G.world = buildWorld(scene, tex);
  // the far-off fight lands a blow: the boom arrives a moment later (it's a long way off)
  G.world.kaiju.onHit = (k) => { if (G.state === 'explore' || G.state === 'cascade') setTimeout(() => AU.distantBoom(k), 380); };
  G.cast = createCast(scene, G.world);
  G.player = new Player(scene, camera, renderer.domElement);
  G.fx = new FX(scene); G.fx.setScale(innerHeight);
  G.cine = new CineCam(camera);
  G.player.spawn();
  G.world.setNames(names.bride, names.groom);
  buildExtras();
  setupInteractables();
  setupTitle();
  // warm up shaders
  renderer.compile(scene, camera);
  ui.loading(1);
  clearInterval(lt);
  ui.screen('loading', false);
  G.state = 'title';
  requestAnimationFrame(loop);
  // restore after "try again"
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem('wg_state') || 'null'); sessionStorage.removeItem('wg_state'); } catch (e) { /* ignore */ }
  if (saved) {
    $('in-bride').value = saved.bride || 'Alice'; $('in-groom').value = saved.groom || 'Bob';
    if (saved.desc) { G.desc = { ...G.desc, ...saved.desc }; $('in-face').value = G.desc[G.who]; }
    for (const who of ['bride', 'groom']) {
      const c = saved.custom && saved.custom[who];
      if (!c) continue;
      try {
        const variants = {};
        for (const [n, u] of Object.entries(c.variants || {})) variants[n] = await loadFaceURL(u);
        applyCustom(who, c, await loadFaceURL(c.neutral), variants, c.back ? await loadFaceURL(c.back) : null);
      } catch (e) { /* ignore */ }
    }
    if (saved.autostart) startGame();
  }
}

// Act I props that only exist for the new interactions: Chad's helmet, the guestbook, Frank's ficus,
// a resting spot for the flute, the duct tape, Biscuit's leash, and the checklist marker.
function buildExtras() {
  const W = G.world, root = W.root;
  // motorcycle helmet with flame decals, left on the gate pillar
  const helmet = new THREE.Group();
  mesh(new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.6), mat(0x111111, { rough: 0.3, metal: 0.4 }), { parent: helmet });
  mesh(new THREE.BoxGeometry(0.26, 0.09, 0.06), mat(0x223355, { rough: 0.1, metal: 0.6 }), { y: 0.02, z: 0.17, parent: helmet });
  for (const s of [-1, 1]) mesh(new THREE.ConeGeometry(0.05, 0.16, 5), mat(0xff5a1a, { emissive: 0x551800 }), { x: s * 0.19, y: 0.06, rz: s * -1.2, parent: helmet });
  helmet.position.set(L.gate.x + 2.0, 2.93, L.gate.z); helmet.rotation.y = 2.6;
  root.add(helmet);
  // guestbook on a pedestal by the welcome sign
  const gb = new THREE.Group();
  gb.position.set(L.sign.x - 1.6, 0, L.sign.z - 0.2);
  mesh(new THREE.CylinderGeometry(0.16, 0.2, 1.0, 8), mat(0xfbf7ef), { y: 0.5, parent: gb });
  mesh(new THREE.BoxGeometry(0.34, 0.04, 0.26), mat(0x8e1f3a), { y: 1.03, rx: -0.2, parent: gb });
  mesh(new THREE.BoxGeometry(0.31, 0.02, 0.24), mat(0xffffff), { y: 1.055, rx: -0.2, parent: gb });
  root.add(gb); addCircle(gb.position.x, gb.position.z, 0.3, 'guestbook');
  W.guestbook = gb;
  // Uncle Frank's nemesis
  const ficus = new THREE.Group();
  ficus.position.set(L.uncle.x + 1.0, 0, L.uncle.z - 0.7);
  mesh(new THREE.CylinderGeometry(0.28, 0.2, 0.45, 10), mat(0xb5654a), { y: 0.22, parent: ficus });
  mesh(new THREE.CylinderGeometry(0.04, 0.05, 1.0, 6), mat(0x6b4a2f), { y: 0.9, parent: ficus });
  for (const [x, y, z, r] of [[0, 1.55, 0, 0.42], [0.25, 1.3, 0.1, 0.3], [-0.22, 1.35, -0.1, 0.32], [0.05, 1.85, 0.05, 0.28]]) mesh(new THREE.IcosahedronGeometry(r, 0), mat(0x3f7a34), { x, y, z, parent: ficus });
  root.add(ficus); addCircle(ficus.position.x, ficus.position.z, 0.35, 'ficus');
  W.ficus = ficus;
  // where Reginald rests his flute during his break
  const fluteDown = P.fluteProp();
  fluteDown.position.set(L.mic.x + 0.05, 1.25, L.mic.z + 0.05); fluteDown.rotation.y = 0.3;
  fluteDown.visible = false; root.add(fluteDown);
  W.fluteDown = fluteDown;
  // duct tape (shown once the groom tapes the power strip)
  const tape = new THREE.Group();
  for (const x of [-0.12, 0.05, 0.16]) mesh(new THREE.BoxGeometry(0.07, 0.07, 0.14), mat(0x9aa0a6, { rough: 0.5 }), { x, y: 0.04, parent: tape });
  tape.position.set(L.strip.x, 0, L.strip.z); tape.visible = false; root.add(tape);
  W.tape = tape;
  // Biscuit's leash: a line from his bed to his collar
  const leash = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(0, 0, 0)]), new THREE.LineBasicMaterial({ color: 0xd62839 }));
  leash.frustumCulled = false; leash.visible = false; root.add(leash);
  W.leash = leash;
  // checklist marker: a bouncing pink diamond
  const mTex = canvasTex(64, 64, (g) => { g.fillStyle = '#ff5ca8'; g.strokeStyle = '#fff'; g.lineWidth = 6; g.beginPath(); g.moveTo(32, 4); g.lineTo(56, 32); g.lineTo(32, 60); g.lineTo(8, 32); g.closePath(); g.fill(); g.stroke(); });
  // constant on-screen size, drawn over everything, so it reads from across the lawn
  const marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: mTex, depthTest: false, transparent: true, sizeAttenuation: false }));
  marker.scale.setScalar(0.035); marker.renderOrder = 20; marker.visible = false;
  scene.add(marker);
  G.marker = marker;
}

// ------------------------------------------------------------------ title screen & face customization (bride or groom)
const charOf = (who) => (who === 'bride' ? G.cast.by.bride : G.player.npc);
const PLACEHOLDER = {
  bride: 'e.g. freckles, curly red hair, big round glasses, huge grin',
  groom: 'e.g. bald, huge ginger beard, tiny round glasses, terrified smile',
};
function showWho() {
  for (const w of ['bride', 'groom']) $('who-' + w).classList.toggle('on', w === G.who);
  $('in-face').value = G.desc[G.who];
  $('in-face').placeholder = PLACEHOLDER[G.who];
  const c = G.custom[G.who];
  $('face-img').src = c ? c.neutral : asset(`assets/faces/${G.who}.png`);
  $('btn-photo-comfy').classList.toggle('hidden', !G.photo[G.who] || CONFIG.comfyUI === 'off');
}
// processed = { neutral: dataURL, variants: {name: dataURL}, back?: dataURL }, kept for "Try again"
function applyCustom(who, processed, neutralTex, variantTex = {}, backTex = null) {
  G.custom[who] = processed;
  setCustom(who, neutralTex, variantTex, backTex);
  charOf(who).c.setFace(neutralTex);
  if (who === G.who) $('face-img').src = processed.neutral;
}
function resetCustom(who) {
  G.custom[who] = null;
  G.photo[who] = null;
  if (who === G.who) $('btn-photo-comfy').classList.add('hidden');
  setCustom(who, null);
  charOf(who).c.setFace(face(who));
  if (who === G.who) $('face-img').src = asset(`assets/faces/${who}.png`);
}

function showTitleStats() {
  if (!progress.runs) return;
  const el = $('title-stats');
  el.textContent = `★ ${progress.achCount}/${ACH.length} achievements · 🎬 ${progress.endingCount}/${Object.keys(ENDINGS).length} endings · 💔 ${progress.runs} wedding${progress.runs > 1 ? 's' : ''} ruined`;
  el.classList.remove('hidden');
}

function applySettings() { document.body.classList.toggle('big-subs', settings.bigSubs); }
function setupSettings() {
  const bind = (id, key) => { const el = $(id); el.checked = !!settings[key]; el.onchange = () => { settings[key] = el.checked; saveSettings(); applySettings(); }; };
  bind('set-calm', 'calm'); bind('set-invert', 'invertY'); bind('set-subs', 'bigSubs'); bind('set-marker', 'marker');
  $('set-sens').value = settings.sens;
  $('set-sens').oninput = (e) => { settings.sens = parseFloat(e.target.value); saveSettings(); };
  applySettings();
}

// wedgame.config.json decides how much of the ComfyUI generator the title screen exposes (see config.js)
function applyComfyConfig() {
  const off = CONFIG.comfyUI === 'off';
  if (CONFIG.comfyUI !== 'full') $('comfy-settings').remove(); // no Server URL field unless it may be used
  $('in-face').classList.toggle('hidden', off);
  $('btn-gen').classList.toggle('hidden', off);
}

function setupTitle() {
  applyComfyConfig();
  ui.screen('title', true);
  showWho();
  showTitleStats();
  setupSettings();
  const status = (t, cls = '') => { const s = $('gen-status'); s.textContent = t; s.className = 'gen-status ' + cls; };
  const busy = (on) => {
    for (const id of ['btn-gen', 'btn-photo-comfy', 'who-bride', 'who-groom', 'btn-reset-face']) $(id).disabled = on;
    $('face-img').parentElement.classList.toggle('busy', on);
  };
  for (const w of ['bride', 'groom']) $('who-' + w).onclick = () => { G.desc[G.who] = $('in-face').value; G.who = w; showWho(); status(''); };
  $('in-face').addEventListener('input', () => { G.desc[G.who] = $('in-face').value; });
  // photo: an uploaded photo (dataURL) to cut out and make the expressions from, instead of the description
  const comfyFaces = async (photo = null) => {
    const who = G.who;
    busy(true);
    try {
      const blob = photo && await (await fetch(photo)).blob();
      const r = await generateFaces(who, $('in-face').value.trim(), CONFIG.comfyUI === 'full' ? $('in-comfy').value.trim() : '', (s) => status(s), VARIANTS[who], blob);
      const n = await imageToFace(r.neutral.dataURL, { removeBg: !r.neutral.alpha });
      const processed = { neutral: n.dataURL, variants: {} }, tex = {};
      for (const [v, img] of Object.entries(r.variants)) {
        const f = await imageToFace(img.dataURL, { removeBg: !img.alpha });
        processed.variants[v] = f.dataURL; tex[v] = f.texture;
      }
      let back = null;
      if (r.back) { const b = await imageToFace(r.back.dataURL, { removeBg: !r.back.alpha }); processed.back = b.dataURL; back = b.texture; }
      applyCustom(who, processed, n.texture, tex, back);
      const k = Object.keys(tex).length;
      const quip = who === 'bride' ? 'She looks… committed.' : 'He looks… ready. Ish.';
      status(`${photo ? 'Photo processed' : (who === 'bride' ? 'Bride' : 'Groom') + ' generated'}${k ? ` with ${k} expressions` : ''}${back ? ' and a back view' : ''}! ${quip}` +
        (r.editor ? '' : ' (No image-edit model on this server, so the expressions reuse this face.)'), 'ok');
    } catch (e) {
      status(e.message || String(e), 'err');
    } finally { busy(false); }
  };
  $('btn-gen').onclick = () => comfyFaces();
  $('btn-photo-comfy').onclick = () => comfyFaces(G.photo[G.who]);
  $('in-upload').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    e.target.value = '';
    const who = G.who;
    const url = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });
    try {
      const { texture, dataURL } = await imageToFace(url, { removeBg: false });
      applyCustom(who, { neutral: dataURL, variants: {} }, texture);
      G.photo[who] = url;
      if (who === G.who && CONFIG.comfyUI !== 'off') $('btn-photo-comfy').classList.remove('hidden');
      status('Photo applied. Bold choice.' + (CONFIG.comfyUI === 'off' ? '' : ' (ComfyUI can cut it out and make the expressions: 🪄 Process photo.)'), 'ok');
    } catch (err) { status('Could not read that image.', 'err'); }
  };
  $('btn-reset-face').onclick = () => { resetCustom(G.who); status(`Back to the default ${G.who}.`); };
  $('btn-start').onclick = () => startGame();
  $('btn-resume').onclick = () => setPaused(false);
  $('btn-restart').onclick = () => restart(true);
  $('btn-menu').onclick = () => restart(false);
  $('btn-skip').onclick = () => skipToInvoice();
  $('btn-again').onclick = () => restart(true);
  $('btn-title').onclick = () => restart(false);
  $('btn-album').onclick = () => saveAlbum();
  $('in-vol').oninput = (e) => AU.setVolume(parseFloat(e.target.value));
  for (const id of ['in-bride', 'in-groom']) $(id).addEventListener('keydown', (e) => e.stopPropagation());
  $('in-face').addEventListener('keydown', (e) => e.stopPropagation());
  // touch controls
  const tap = (el, fn) => { el.addEventListener('touchstart', (e) => { e.preventDefault(); fn(); }, { passive: false }); el.addEventListener('click', fn); };
  tap($('touch-e'), () => pressInteract());
  tap($('touch-pause'), () => { if (G.state === 'explore' || G.state === 'cascade' || G.state === 'intro') setPaused(!G.paused); });
  for (const b of document.querySelectorAll('.do-pad button')) tap(b, () => { if (G.dance) { G.dance.pressed = b.dataset.dir; G.dance.pressedAt = beatNow(); } });
  // checklist rows point the marker at their target
  $('cl-items').addEventListener('click', (e) => {
    const li = e.target.closest('li'); if (!li || !G.check) return;
    const it = G.check[[...li.parentElement.children].indexOf(li)];
    if (it) { G.markerFocus = it.id; G.markerPulse = clock.t; }
  });
}

function restart(autostart) {
  try {
    G.desc[G.who] = $('in-face').value;
    sessionStorage.setItem('wg_state', JSON.stringify({ bride: names.bride, groom: names.groom, desc: G.desc, custom: G.custom, autostart }));
  } catch (e) { /* storage full: restart without the custom face */ }
  location.reload();
}

function setPaused(p) {
  if (G.state === 'title' || G.state === 'ending' || G.state === 'loading') return;
  G.paused = p;
  ui.screen('pause', p);
  $('btn-skip').classList.toggle('hidden', !(G.state === 'cascade' && progress.runs > 0));
  if (p) G.player.unlock();
}

// ------------------------------------------------------------------ game start + intro
const CHECK = [
  { id: 'dog', label: 'Pet the dog (he is a good boy)' },
  { id: 'punch', label: 'Taste the punch' },
  { id: 'gift', label: 'Shake a gift (for science)' },
  { id: 'cake', label: 'Admire the cake' },
  { id: 'uncle', label: 'Say hi to Uncle Frank' },
  { id: 'bride', label: 'Check on {B} (NO PEEKING)' },
  { id: 'dance', label: 'Show off your dance moves' },
  { id: 'flute', label: 'Cue the flutist for the processional', final: true },
];
// where each checklist item happens (for the marker)
function checkPos(id) {
  const by = G.cast.by;
  switch (id) {
    case 'dog': return by.dog.root.position.clone().setY(1.5);
    case 'punch': return V(L.punch.x, 2.0, L.punch.z);
    case 'gift': return V(L.gifts.x, 1.9, L.gifts.z);
    case 'cake': return V(L.cake.x, 2.0, L.cake.z);
    case 'uncle': return by.uncle.pos.clone().setY(2.7);
    case 'bride': return V(L.tent.x - L.tent.r - 0.6, 2.7, L.tent.z);
    case 'dance': return V(L.dance.x, 2.4, L.dance.z);
    case 'flute': return by.flutist.pos.clone().setY(2.8);
  }
  return null;
}

const RING_HINT = { gift: 'shaking presents at the gift table', bed: 'playing with the dog, near his bed', punch: '"guarding" the punch bowl' };

async function startGame() {
  if (G.state !== 'title') return;
  names.bride = ($('in-bride').value.trim() || 'Alice').slice(0, 16);
  names.groom = ($('in-groom').value.trim() || 'Bob').slice(0, 16);
  G.world.setNames(names.bride, names.groom);
  G.cast.by.bride.name = names.bride;
  AU.initAudio();
  ui.screen('title', false);
  G.stats = { pets: 0, punch: 0, gifts: new Set(), talked: new Set(), photos: 0, danced: 0, danceScore: 0, peeks: 0, strip: false, arch: false, start: clock.t, mash: 0, cake: 0, bowl: 0, clues: new Set() };
  G.check = CHECK.map((c) => ({ ...c, done: false }));
  // the rings are somewhere different every time; Father Gregory drops a hint
  G.ringSpot = pick(['gift', 'bed', 'punch']);
  G.ringGift = pick([0, 1, 2, 3, 5]);
  G.cast.by.officiant.lines[2] = `Do you have the rings? Never mind, nobody ever has the rings. Last I saw them, the best man was ${RING_HINT[G.ringSpot]}.`;
  G.state = 'intro';
  ui.showHUD(true); ui.showChecklist(false); ui.controlsHint(false);
  AU.startMusic(); AU.murmurLoop(1);
  await intro();
  G.state = 'explore';
  G.player.enabled = true; G.player.cinematic = false;
  G.player.snapCamera();
  ui.letterbox(false); ui.showChecklist(true); ui.checklist(G.check); ui.controlsHint(true);
  G.exploreStart = clock.t;
  G.fluteBreakAt = clock.t + 35;
  G.nextEngine = clock.t + rand(55, 80);
  setTimeout(() => ui.controlsHint(false), 12000);
}

async function intro() {
  const { cine, player } = G;
  player.cinematic = true;
  ui.letterbox(true);
  cine.set(new THREE.Vector3(0, 16, 34), new THREE.Vector3(0, 2, 0));
  const flyover = cine.move(new THREE.Vector3(-8, 5, -6), new THREE.Vector3(0, 1.5, -20), 7.5, easeInOut);
  await wait(0.6);
  await ui.say('', `Sunset Gardens. The wedding of ${names.bride} and ${names.groom}.`, 4.2, 0.9);
  await ui.say('', 'Guests are arriving. The cake is perfect. The sun is golden.', 2.8, 0.9);
  await flyover;
  await cine.move(new THREE.Vector3(2.5, 1.9, -15.5), new THREE.Vector3(2.4, 1.5, -18.4), 1.6);
  G.cast.by.flutist.setMode('fluteIdle');
  await ui.say('Cousin Reginald', 'I\'ve prepared a small processional. Seventeen movements. Just say the word.', 3.4, 0.9);
  const p = player.pos;
  await cine.move(new THREE.Vector3(p.x, 2.2, p.z + 3.6), new THREE.Vector3(p.x, 1.55, p.z), 2.2);
  player.npc.faceTo(p.x, p.z - 5);
  await ui.say('Mother of the Bride', '{G}! Before the ceremony, you finish MY checklist. Then cue the flutist.', 3.6, 1.25);
  player.cinematic = false;
}

// ------------------------------------------------------------------ interactions
function tick(id) {
  const it = G.check.find((c) => c.id === id);
  if (!it || it.done) return;
  it.done = true;
  AU.ding();
  ui.checklist(G.check);
  if (G.markerFocus === id) G.markerFocus = null;
  const left = G.check.filter((c) => !c.final && !c.done).length;
  if (left === 0 && id !== 'flute') { ui.toast('CHECKLIST COMPLETE', 'Mom is… not displeased. Now cue the flutist!'); ui.hint('Everything is ready. Go cue the flutist at the arch!'); G.hintShown = true; unlock('mom', true); }
}

const SPEECH = [
  'Marriage is like my titanium knee: expensive, and it squeaks.',
  'I\'ve known {B} since she was THIS big. She bit me then, too.',
  '{G}: welcome to the family. There are no refunds.',
  'Love is patient. Love is kind. Love is… OW.',
  'I\'d like to thank the ficus, for its years of service.',
  'May your marriage outlast my first three!',
];

function setupInteractables() {
  const W = G.world, by = G.cast.by;
  const add = (o) => G.interactables.push(o);
  const say = (npc, text, dur) => ui.bubble(npc.c ? npc.c.root : npc, text, dur ?? Math.max(2.5, text.length * 0.06), npc.name || '');
  const groomSays = (text, dur) => { AU.babble(fmt(text), 1.0); return say(G.player.npc, text, dur); };
  const foundRings = (where) => {
    if (G.flags.rings || G.ringSpot !== where) return false;
    G.flags.rings = true;
    AU.ding(); G.fx.sparks(G.player.pos.clone().setY(1.2), 12, 1.5);
    unlock('rings');
    return true;
  };
  const clue = (id) => {
    const c = G.stats.clues;
    if (c.has(id)) return;
    c.add(id);
    if (c.size === 3) {
      unlock('clues');
      setTimeout(() => { if (G.state === 'explore') groomSays('A helmet, a card and a guestbook. Chad, Chad, Chad. Why do I know that name?'); }, 3200);
    }
  };

  // the dog
  add({
    id: 'dog', r: 1.5, pos: () => by.dog.root.position, label: () => (G.stats.pets ? 'Pet Biscuit again' : 'Pet the dog'),
    action: async () => {
      const dog = by.dog; G.stats.pets++;
      G.player.npc.faceTo(dog.root.position.x, dog.root.position.z);
      G.player.npc.setMode('crouch', 0.6);
      if (dog.state === 'sleep') { dog.state = 'idle'; AU.bark(1.1); await wait(0.3); }
      dog.state = 'sit'; dog.wag = 2; dog.headTilt = 0.3;
      G.fx.hearts(dog.root.position.clone().add(V(0, 1, 0)), 5);
      AU.whine();
      const lines = ['Who\'s a good boy? YOU are, Biscuit.', 'Biscuit\'s tail could power the DJ booth.', 'He smells like cake. Suspicious.', 'Biscuit rolls over. You are now covered in dog hair. Worth it.', 'The only guest who is genuinely happy to see you.'];
      groomSays(lines[Math.min(G.stats.pets - 1, lines.length - 1)]);
      await wait(1.6);
      G.player.npc.setMode('idle'); dog.headTilt = 0; dog.wag = 1.2;
      G.dogFollow = !G.flags.leashed;
      tick('dog');
      unlock('soulmate', true);
      if (G.stats.pets === 5) unlock('goodboy');
    },
  });
  // leash him to his bed (only once he trusts you, and only near the bed)
  add({
    id: 'leash', r: 1.5, pos: () => by.dog.root.position, priority: 0.5, label: () => 'Leash Biscuit to his bed',
    when: () => G.stats.pets > 0 && !G.flags.leashed && by.dog.root.position.distanceTo(V(L.dogBed.x, 0, L.dogBed.z)) < 3.5,
    action: async () => {
      const dog = by.dog, dp = dog.root.position;
      G.dogFollow = false; G.flags.leashed = true;
      G.player.npc.faceTo(dp.x, dp.z); G.player.npc.setMode('crouch', 0.7);
      const from = dp.clone(), to = V(L.dogBed.x + 0.6, 0, L.dogBed.z + 0.7);
      dog.state = 'walk';
      await tween(0.6, (k) => dp.lerpVectors(from, to, k));
      dog.state = 'sit'; dog.headTilt = 0.4;
      W.leash.visible = true;
      groomSays('Stay, Biscuit. Just for the ceremony. The leash is tied to the bed. The bed is heavy. Probably.');
      await wait(1.4);
      G.player.npc.setMode('idle'); dog.headTilt = 0;
      unlock('leash');
    },
  });
  // search the dog bed
  add({
    id: 'bed', r: 1.3, pos: () => V(L.dogBed.x - 0.3, 0, L.dogBed.z - 0.5), label: () => 'Search Biscuit\'s bed', when: () => !G.searchedBed,
    action: async () => {
      G.searchedBed = true;
      G.player.npc.faceTo(L.dogBed.x, L.dogBed.z); G.player.npc.setMode('crouch', 0.8);
      AU.rattle(); await wait(0.9);
      if (foundRings('bed')) groomSays('A squeaky toy, half a sock… and THE RINGS. Biscuit, you absolute legend.');
      else groomSays('A squeaky toy, 40% of a sock, and a biscuit named Biscuit. Nothing useful.');
      await wait(0.8); G.player.npc.setMode('idle');
    },
  });
  // punch
  add({
    id: 'punch', r: 1.6, pos: () => V(L.punch.x, 0, L.punch.z + 0.6), label: () => (G.stats.punch ? 'Another cup of punch?' : 'Taste the punch'),
    action: async () => {
      G.stats.punch++;
      G.player.npc.faceTo(L.punch.x, L.punch.z);
      G.player.npc.setMode('drink');
      AU.slurp(); await wait(1.2); AU.gulp();
      G.player.drunk = Math.min(1.2, G.player.drunk + 0.3);
      const lines = ['Fruity! With notes of… rum. So much rum.', 'Is the room spinning or is that the dance floor?', 'Thish punch is… *hic* …incredible.', 'You have achieved clarity. And double vision.'];
      if (G.stats.punch >= 2 && foundRings('punch')) groomSays('Something clinks at the bottom of the bowl… THE RINGS! Marinated in rum. Perfect.');
      else groomSays(lines[Math.min(G.stats.punch - 1, lines.length - 1)]);
      await wait(1.2);
      G.player.npc.setMode('idle');
      tick('punch');
      if (G.stats.punch === 3) unlock('openbar');
    },
  });
  // gifts
  W.gifts.forEach((gift, i) => add({
    id: 'gift' + i, r: 1.2, pos: () => gift.base.clone().setY(0), label: () => 'Shake the gift',
    action: async () => {
      G.stats.gifts.add(i);
      G.player.npc.faceTo(gift.base.x, gift.base.z);
      AU.rattle();
      await tween(0.8, (k) => { gift.obj.position.x = gift.base.x + Math.sin(k * 40) * 0.04 * (1 - k); gift.obj.rotation.z = Math.sin(k * 33) * 0.2 * (1 - k); });
      const lines = ['It rattles. Ominously.', 'It\'s ticking. That\'s normal, right?', 'Sounds like a toaster. Obviously.', 'Something inside just meowed.', 'Card says "Congrats! - Chad". Who is Chad?', 'It\'s... humming the flute solo?'];
      if (i === G.ringGift && foundRings('gift')) groomSays('It jingles. Like… rings. WHO GIFT-WRAPPED THE WEDDING RINGS?');
      else groomSays(lines[i % lines.length]);
      if (i === 4) clue('card');
      tick('gift');
      if (G.stats.gifts.size === 6) unlock('customs');
    },
  }));
  // cake
  add({
    id: 'cake', r: 1.6, pos: () => V(L.cake.x, 0, L.cake.z + 0.9), label: () => (G.stats.cake ? 'Poke the cake' : 'Admire the cake'),
    action: async () => {
      G.stats.cake++;
      G.player.npc.faceTo(L.cake.x, L.cake.z);
      if (G.stats.cake === 1) groomSays('Three tiers of buttercream. The second most expensive thing here, after the arch.');
      else { AU.boing(); groomSays('*poke* ...Nobody saw that.'); ui.bubble(G.cast.by.mom.c.root, 'I SAW THAT.', 2.5, 'Mother of the Bride'); }
      tick('cake');
    },
  });
  // champagne tower
  add({ id: 'tower', r: 1.4, pos: () => V(L.tower.x, 0, L.tower.z + 0.9), label: () => 'Admire the champagne tower', action: async () => { AU.tink(); groomSays('Thirty glasses of pure, unstable hubris.'); } });
  // power strip: inspect it, then tape it up
  add({
    id: 'strip', r: 1.2, pos: () => V(L.strip.x, 0, L.strip.z + 0.5), label: () => (!G.stats.strip ? 'Inspect the power strip' : G.flags.taped ? 'Admire your duct tape' : 'Tape up the power strip'),
    action: async () => {
      if (!G.stats.strip) {
        G.stats.strip = true; AU.spark(); G.fx.sparks(new THREE.Vector3(L.strip.x, 0.1, L.strip.z), 4, 1);
        groomSays('The DJ, the flute mic AND the table lights. It\'s warm. The little light is on, so it\'s fine.');
        unlock('safety');
      } else if (!G.flags.taped) {
        G.player.npc.faceTo(L.strip.x, L.strip.z); G.player.npc.setMode('crouch', 1);
        for (let i = 0; i < 3; i++) { AU.whoosh(); await wait(0.35); }
        W.tape.visible = true; G.flags.taped = true;
        groomSays('Three layers of duct tape. Waterproof. Probably. The box said "mostly".');
        await wait(0.6); G.player.npc.setMode('idle');
        unlock('tape');
      } else groomSays('Beautiful. A masterpiece of electrical safety.');
    },
  });
  // arch
  add({
    id: 'arch', r: 1.3, pos: () => V(L.arch.x + 1.5, 0, L.arch.z + 0.6), label: () => 'Lean on the arch',
    action: async () => {
      G.stats.arch = true; AU.whoosh();
      await tween(1.2, (k) => { W.archPivot.rotation.z = Math.sin(k * Math.PI * 4) * 0.05 * (1 - k); });
      groomSays('It creaks. The rental tag says "DEPOSIT NON-REFUNDABLE" in three languages.');
      unlock('engineer');
    },
  });
  // swipe the flute while Reginald is on his break
  add({
    id: 'swipe', r: 1.4, pos: () => V(L.mic.x, 0, L.mic.z + 0.3), priority: 1, label: () => 'Swipe the flute',
    when: () => G.fluteDown && !G.flags.noFlute,
    action: async () => {
      G.player.npc.faceTo(L.mic.x, L.mic.z);
      AU.whoosh();
      W.fluteDown.visible = false; G.flags.noFlute = true;
      groomSays('*hides the flute in a hedge* For the good of everyone.');
      unlock('kazoo');
    },
  });
  // welcome sign
  add({ id: 'sign', r: 1.4, pos: () => V(L.sign.x, 0, L.sign.z), label: () => 'Read the welcome sign', action: async () => groomSays('"No phones, no drama, NO FLUTES." Mom wrote that last part.') });
  // Chad clues: the helmet on the gate and the guestbook
  add({
    id: 'helmet', r: 1.6, pos: () => V(L.gate.x + 2.0, 0, L.gate.z - 1.0), label: () => 'Look at the helmet on the gate',
    action: async () => { G.player.npc.faceTo(L.gate.x + 2, L.gate.z); groomSays('A motorcycle helmet with flame decals. "C.H.A.D." on the back. Weird place to leave it.'); clue('helmet'); },
  });
  add({
    id: 'guestbook', r: 1.3, pos: () => W.guestbook.position, label: () => 'Read the guestbook',
    action: async () => {
      G.player.npc.faceTo(W.guestbook.position.x, W.guestbook.position.z);
      AU.rattle();
      groomSays('Latest entry: "See you soon, babe ;) — C." Who signs a guestbook BEFORE the wedding?');
      clue('book');
    },
  });
  // dance floor
  add({ id: 'dance', r: 3.2, pos: () => V(L.dance.x, 0, L.dance.z), label: () => (G.stats.danced ? 'Dance-off (again!)' : 'Start a dance-off'), action: () => danceOff() });
  // peek at the bride (tent door)
  add({
    id: 'tent', r: 1.6, pos: () => V(L.tent.x - L.tent.r - 1.1, 0, L.tent.z), label: () => 'Peek at {B}',
    action: async () => {
      G.stats.peeks++;
      const bm = by.bridesmaid;
      bm.faceTo(G.player.pos.x, G.player.pos.z);
      bm.setMode('point');
      ui.bubble(bm.c.root, bm.lines[Math.min(G.stats.peeks - 1, bm.lines.length - 1)], 3.2, bm.name);
      AU.babble('Nope no absolutely not', 1.4);
      await wait(0.5);
      ui.bubble(by.bride.c.root, '({G}?! Is that you?! DON\'T LOOK!)', 3, names.bride);
      // shove
      const p = G.player.pos, v = new THREE.Vector3(-1.4, 0, 0);
      await tween(0.35, (k) => { p.x += v.x * 0.05; });
      await wait(1.2); bm.setMode('idle'); bm.setHeading(-Math.PI / 2);
      tick('bride');
      if (G.stats.peeks === 1) unlock('badluck');
    },
  });
  // strike a pose while Zoe's camera is up
  add({ id: 'pose', r: 99, pos: () => G.player.pos, priority: 10, label: () => 'Strike a pose!', when: () => G.poseWindow && !G.posedNow, action: () => strikePose() });
  // talk to NPCs
  for (const n of G.cast.npcs) {
    if (['bride', 'bridesmaid', 'ex', 'flutist'].includes(n.role)) continue;
    add({
      id: 'npc:' + n.name + n.c.seed, r: 1.5, npc: n, pos: () => n.pos, label: () => `Talk to ${n.name}`,
      action: async () => {
        G.stats.talked.add(n);
        n._li = (n._li ?? -1) + 1;
        const line = (n.lines && n.lines.length) ? n.lines[n._li % n.lines.length] : 'Congratulations!';
        const prevMode = n.mode, prevH = n._homeH ?? n.heading;
        if (!['sit', 'sitClap', 'sitCradle', 'kidSit', 'dance', 'dj'].includes(n.mode)) { n.faceTo(G.player.pos.x, G.player.pos.z); if (n.mode !== 'drink') n.setMode('talk'); }
        G.player.npc.faceTo(n.pos.x, n.pos.z);
        ui.bubble(n.c.root, line, Math.max(3, fmt(line).length * 0.06), n.name);
        AU.babble(fmt(line), n.voice);
        await wait(1.0);
        if (n.role === 'uncle') { tick('uncle'); await wait(1.2); await uncleMenu(n); }
        if (!['sit', 'sitClap', 'sitCradle', 'kidSit', 'dance', 'dj'].includes(prevMode)) setTimeout(() => { if (G.state === 'explore' && !n.target) { n.setMode(prevMode); n.setHeading(prevH); } }, 2500);
        if (G.stats.talked.size === 10) unlock('social');
      },
    });
  }
  // the flutist — the trigger
  add({
    id: 'flute', r: 1.7, pos: () => by.flutist.pos, label: () => 'Cue the processional (start the ceremony)', priority: 1,
    action: async () => {
      if (G.state !== 'explore') return;
      G.state = 'cascade';
      G.player.enabled = false; G.player.unlock();
      ui.prompt(null); ui.hint(null); ui.showChecklist(false);
      G.marker.visible = false;
      tick('flute');
      if (clock.t - G.exploreStart < 45) unlock('speedrun', true);
      await runCascade(G);
      showEnding();
    },
  });
}

// Uncle Frank: speech-writing and seating
async function uncleMenu(un) {
  const opts = [], acts = [];
  if (!G.speech) { opts.push('"Want help with that speech?"'); acts.push('speech'); }
  if (!G.flags.ficus) { opts.push('"Want a seat away from the ficus?"'); acts.push('ficus'); }
  if (!opts.length) return;
  opts.push('"Carry on, Uncle Frank."'); acts.push(null);
  G.player.enabled = false;
  const act = acts[await ui.choice('Uncle Frank', opts)];
  if (act === 'speech') {
    const pool = [...SPEECH], chosen = [];
    for (let k = 1; k <= 3; k++) {
      const i = await ui.choice(`Uncle Frank's speech: line ${k} of 3`, pool);
      if (i < 0) break;
      chosen.push(pool.splice(i, 1)[0]);
    }
    if (chosen.length) {
      G.speech = chosen;
      ui.bubble(un.c.root, 'Beautiful! I\'ll read it LOUDLY. At the worst possible moment.', 3.2, un.name);
      AU.babble('Beautiful I will read it loudly', un.voice);
      unlock('speech');
    }
  } else if (act === 'ficus') {
    G.flags.ficus = true;
    ui.bubble(un.c.root, 'FREEDOM! Twelve years, that ficus and me. Twelve years.', 3, un.name);
    AU.babble('Freedom twelve years', un.voice);
    un.walkTo(-4.6, 7.8, { speed: 1.6 }).then(() => { if (G.state === 'explore') { un.faceTo(L.dance.x, L.dance.z); un.setMode('drink'); } });
    unlock('ficus');
  }
  G.player.enabled = true;
}

// ------------------------------------------------------------------ dance-off (rhythm minigame on the music's beat)
const DIRS = ['up', 'down', 'left', 'right'];
const KEYDIR = { ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down', ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
const beatNow = () => { const b = AU.beatTime(); return b >= 0 ? b : clock.t * 112 / 60; };
async function danceOff() {
  const n = G.player.npc, by = G.cast.by;
  G.stats.danced++;
  G.player.enabled = false;
  n.faceTo(G.player.camPos.x, G.player.camPos.z);
  n.setMode('dance', 0);
  const near = by.dancers.filter((d) => d.pos.distanceTo(n.pos) < 5);
  near.forEach((d) => { d._dArg = d.arg; d.faceTo(n.pos.x, n.pos.z); d.setMode('cheer'); });
  ui.bubble(by.dancers[0].c.root, pick(['DANCE-OFF! DANCE-OFF!', 'Oh no. Oh no no no. He\'s dancing.', 'Somebody film this!']), 2.5, by.dancers[0].name);
  ui.danceShow(true);
  const N = 8, seq = Array.from({ length: N }, () => pick(DIRS));
  const start = Math.ceil(beatNow()) + 2;
  let i = 0, score = 0, perfect = 0;
  await new Promise((res) => {
    G.dance = {
      pressed: null,
      update() {
        if (i >= N) { res(); return; }
        const bt = beatNow(), target = start + i * 2, k = 1 - (target - bt) / 2;
        ui.danceArrow(k > 0 ? seq[i] : null, k);
        const grade = (txt, cls) => { ui.danceGrade(txt, cls, `${score}/${N}`); i++; };
        if (this.pressed && k > 0) {
          // grade on when the key went down, not on this (possibly late) frame
          const d = Math.abs((this.pressedAt ?? bt) - target), ok = this.pressed === seq[i];
          this.pressed = null;
          if (ok && d <= 0.14) { score++; perfect++; n.setMode('dance', i % 5); AU.tink(); grade('PERFECT!', 'perfect'); }
          else if (ok && d <= 0.32) { score++; n.setMode('dance', i % 5); grade('GOOD', 'good'); }
          else { AU.boing(); grade('MISS', 'miss'); }
        } else if (this.pressed) this.pressed = null;
        else if (bt > target + 0.4) grade('MISS', 'miss');
      },
    };
  });
  G.dance = null;
  ui.danceArrow(null, 0);
  G.stats.danceScore = Math.max(G.stats.danceScore, score);
  const lead = by.dancers[0];
  if (score >= 6) { ui.bubble(lead.c.root, perfect >= 6 ? 'LEGENDARY. I\'m telling my grandchildren.' : 'YEAH {G}! That was actually good?!', 3, lead.name); AU.applause(2, 40); unlock('dance'); }
  else if (score >= 3) ui.bubble(lead.c.root, 'Solid. Like a dad at a barbecue.', 2.6, lead.name);
  else ui.bubble(lead.c.root, 'Boooo! …Sorry. Reflex.', 2.6, lead.name);
  await wait(1.6);
  ui.danceShow(false);
  near.forEach((d) => d.setMode('dance', d._dArg ?? 0));
  n.setMode('idle');
  G.player.enabled = true;
  tick('dance');
}

// ------------------------------------------------------------------ photographer pose
async function strikePose() {
  const n = G.player.npc;
  G.posedNow = true;
  n.faceTo(G.cast.by.photographer.pos.x, G.cast.by.photographer.pos.z);
  const pose = pick([['point', 0], ['cheer', 0], ['dance', 2], ['dance', 4]]);
  n.setMode(pose[0], pose[1]);
  AU.babble('Ta da', 1.0);
  await wait(1.3);
  n.setMode('idle');
}

// ------------------------------------------------------------------ input
function updateInteractions() {
  if (G.state !== 'explore' || G.busy) { ui.prompt(null); G.current = null; return; }
  const p = G.player.pos;
  const fwd = new THREE.Vector3(Math.sin(G.player.npc.heading), 0, Math.cos(G.player.npc.heading));
  let best = null, bestScore = 1e9;
  for (const it of G.interactables) {
    if (it.when && !it.when()) continue;
    const q = it.pos();
    const dx = q.x - p.x, dz = q.z - p.z, d = Math.hypot(dx, dz);
    if (d > it.r) continue;
    const facing = d > 0.01 ? (dx * fwd.x + dz * fwd.z) / d : 1;
    const score = Math.min(d, 3) - facing * 0.6 - (it.priority || 0) * 0.8;
    if (score < bestScore) { bestScore = score; best = it; }
  }
  G.current = best;
  ui.prompt(best ? best.label() : null);
}

async function pressInteract() {
  if (G.paused) return;
  if (ui.choiceActive()) { ui.choiceKey({ code: 'Enter', key: '' }); return; }
  if (ui.qteKey()) return;
  // Zoe's camera is up: posing wins over whatever the prompt said last frame
  if (G.state === 'explore' && G.poseWindow && !G.posedNow && !G.busy) { G.busy = true; ui.prompt(null); try { await strikePose(); } finally { G.busy = false; } return; }
  if (G.state === 'explore' && G.current && !G.busy) {
    const it = G.current;
    G.busy = true; ui.prompt(null);
    try { await it.action(); } finally { G.busy = false; }
  }
}

addEventListener('keydown', async (e) => {
  if (ui.choiceKey(e)) { e.preventDefault(); return; }
  if (G.dance && KEYDIR[e.code]) { if (!e.repeat) { G.dance.pressed = KEYDIR[e.code]; G.dance.pressedAt = beatNow(); } return; }
  if (e.code === 'Escape' || e.code === 'KeyP') { if (G.state === 'explore' || G.state === 'cascade' || G.state === 'intro') setPaused(!G.paused); return; }
  if (G.paused) return;
  if ((e.code === 'KeyE' || e.code === 'Enter') && (!e.repeat || G.qteActive)) pressInteract();
  if (e.code === 'Space') G.fastForward = true;
  if (e.code === 'KeyC' && (G.state === 'explore' || G.state === 'cascade')) snapshot();
});

function snapshot() {
  renderer.render(scene, camera);
  const a = document.createElement('a');
  a.href = renderer.domElement.toDataURL('image/png');
  a.download = `wedding-of-${names.bride}-and-${names.groom}-${Date.now()}.png`.replace(/[^a-z0-9.\-]/gi, '_');
  a.click();
  AU.shutter(); ui.flash(0.6);
  ui.toast('SNAPSHOT', 'Saved for the wedding album.');
}
addEventListener('keyup', (e) => { if (e.code === 'Space') G.fastForward = false; });

// ------------------------------------------------------------------ Act I ambient life
const AMBIENT = [
  'Lovely weather for it!', 'Is that the groom? He looks… damp.', 'I give it two years.', 'Where\'s the bar? Oh, there. Bye.', 'The DJ has played this song nine times.',
  'Did you see the champagne tower?!', 'I love a garden wedding. Nature! Bugs!', 'Is it rude to eat the centerpiece?', 'The flute guy keeps staring at me.',
  'My feet hurt already.', 'Shh, here comes the groom!', 'Is the dog invited to the reception?', 'Nice arch. Very… archy.', 'Five bucks says someone cries.', 'Did anyone bring a gift receipt?',
];
let nextChatter = 3, nextPhoto = 8, nextBird = 1, nextHic = 6, lastStep = 0;
const SUN0 = { pos: new THREE.Vector3(-38, 20, -10), col: new THREE.Color(0xffb070), i: 2.4 };
const SUN1 = { pos: new THREE.Vector3(-42, 10, -10), col: new THREE.Color(0xff8a4a), i: 2.1 };

function actOne(dt) {
  const { cast, player } = G;
  const by = cast.by;
  const el = clock.t - G.exploreStart;
  // ambient chatter bubbles
  nextChatter -= dt;
  if (nextChatter <= 0) {
    nextChatter = rand(3.5, 6.5);
    const near = cast.npcs.filter((n) => n.role !== 'ex' && n.c.root.visible && n.pos.distanceTo(player.pos) < 13 && !['bride'].includes(n.role));
    if (near.length) { const n = pick(near); ui.bubble(n.c.root, pick(AMBIENT), 3.2, n.name); }
  }
  nextBird -= dt;
  if (nextBird <= 0) { nextBird = rand(1.5, 5); AU.bird(); }
  if (clock.t > G.nextEngine) { G.nextEngine = clock.t + rand(80, 120); AU.distantEngine(); }
  // photographer
  const ph = by.photographer;
  nextPhoto -= dt;
  if (nextPhoto <= 0 && !ph.target && !ph.busy) {
    nextPhoto = rand(10, 16);
    const p = player.pos;
    if (p.distanceTo(ph.pos) < 18 && Math.random() < 0.8) {
      const a = rand(0, Math.PI * 2);
      const tx = clamp(p.x + Math.cos(a) * 2.6, L.bounds.minX + 1.5, L.bounds.maxX - 1.5), tz = clamp(p.z + Math.sin(a) * 2.6, L.bounds.minZ + 1.5, L.bounds.maxZ - 1.5);
      ph.busy = true;
      ph.walkTo(tx, tz, { speed: 2.2 }).then(async () => {
        if (G.state !== 'explore') { ph.busy = false; return; }
        ph.faceTo(player.pos.x, player.pos.z); ph.setMode('photo');
        ui.bubble(ph.c.root, pick(['Say "prenup"!', 'Look sad! Artsy!', 'Hold it… hold it…', 'Gorgeous. Mostly.', 'Now pretend you\'re in love!']), 2, ph.name);
        G.posedNow = false;
        G.poseWindow = player.pos.distanceTo(ph.pos) < 5 && !G.busy;
        await wait(1.1);
        G.poseWindow = false;
        if (G.state !== 'explore') { ph.busy = false; return; }
        AU.shutter();
        const fp = new THREE.Vector3(); ph.c.headAnchor.getWorldPosition(fp);
        G.fx.flash(fp, 2.2);
        if (player.pos.distanceTo(ph.pos) < 5) {
          ui.flash(0.45); G.stats.photos++;
          if (G.posedNow) { capture('Before (still smiling)'); unlock('poser'); ui.bubble(ph.c.root, 'YES! That\'s the one for the album!', 2.2, ph.name); }
          if (G.stats.photos === 3) unlock('paparazzi');
        }
        await wait(0.6); ph.setMode('idle'); ph.busy = false;
      });
    } else {
      ph.walkTo(rand(-10, 10), rand(-4, 16), { speed: 1.3 });
    }
  }
  // Reginald's break: he puts the flute down and goes to bother Grandma
  if (!G.fluteBreak && clock.t > G.fluteBreakAt && !G.busy && player.pos.distanceTo(by.flutist.pos) > 3.5) fluteBreak();
  // dog follows the groom once petted (unless leashed)
  const dog = by.dog;
  if (G.dogFollow && !G.busy) {
    const p = player.pos, dp = dog.root.position;
    const d = Math.hypot(p.x - dp.x, p.z - dp.z);
    if (d > 1.8) {
      const sp = d > 5 ? 5.5 : 2.4;
      dog.state = d > 5 ? 'run' : 'walk';
      dp.x += ((p.x - dp.x) / d) * sp * dt; dp.z += ((p.z - dp.z) / d) * sp * dt;
      dog.root.rotation.y = Math.atan2(p.x - dp.x, p.z - dp.z);
    } else if (dog.state === 'walk' || dog.state === 'run') dog.state = 'sit';
  }
  // guests turn to watch the groom walk past, then go back to what they were doing
  for (const n of cast.npcs) {
    if (n.target || n.busy || !['idle', 'talk', 'drink'].includes(n.mode) || ['bride', 'ex', 'flutist', 'photographer'].includes(n.role)) continue;
    const d = n.pos.distanceTo(player.pos);
    if (d < 2.6) {
      if (n._homeH === undefined) n._homeH = n.heading;
      n.setHeading(angleLerp(n.heading, Math.atan2(player.pos.x - n.pos.x, player.pos.z - n.pos.z), Math.min(1, dt * 4)));
    } else if (n._homeH !== undefined) {
      n.setHeading(angleLerp(n.heading, n._homeH, Math.min(1, dt * 3)));
      if (Math.abs(Math.sin((n.heading - n._homeH) / 2)) < 0.01) delete n._homeH;
    }
  }
  // footsteps
  const pn = player.npc;
  if (pn.manual.moving) {
    const step = Math.floor(pn.phase / Math.PI);
    if (step !== lastStep) {
      lastStep = step;
      const p = player.pos, half = L.dance.size / 2;
      const surface = Math.abs(p.x - L.dance.x) < half && Math.abs(p.z - L.dance.z) < half ? 'tile' : (Math.abs(p.x) < 1.3 && p.z > 10.5 ? 'gravel' : 'grass');
      AU.footstep(surface, pn.manual.run);
    }
  }
  // the punch talks back
  if (player.drunk > 0.6) {
    nextHic -= dt;
    if (nextHic <= 0 && !G.busy) { nextHic = rand(6, 10); AU.hiccup(); player.pitch = clamp(player.pitch + 0.05, -0.25, 1.1); ui.bubble(pn.c.root, '*hic*', 0.9, ''); }
  }
  // the sun sinks while you dawdle
  const sk = clamp(el / 360);
  G.world.sun.position.lerpVectors(SUN0.pos, SUN1.pos, sk);
  G.world.sun.color.copy(SUN0.col).lerp(SUN1.col, sk);
  G.world.sun.intensity = lerp(SUN0.i, SUN1.i, sk);
  // Mom's patience
  if (el > 240 && !G.momNag) {
    G.momNag = true;
    ui.bubble(by.mom.c.root, '{G}! The flutist is WAITING. I am WAITING. The CAKE is waiting.', 4, 'Mother of the Bride');
    ui.toast('MOM', 'is getting impatient…');
  }
  if (el > 420 && !G.momMarch && !G.busy) momMarch();
  // late hint
  if (!G.hintShown && el > 150) { G.hintShown = true; ui.hint('Tip: the ceremony starts whenever you cue the flutist at the arch.'); setTimeout(() => ui.hint(null), 8000); }
  updateMarker();
  updateInteractions();
}

async function fluteBreak() {
  const W = G.world, fl = G.cast.by.flutist, gm = G.cast.by.grandma;
  G.fluteBreak = true;
  fl.c.flute.visible = false; W.fluteDown.visible = true; G.fluteDown = true;
  ui.bubble(fl.c.root, 'Back in five. Nobody touch Esmeralda. (The flute.)', 3, fl.name);
  await fl.walkTo(-0.55, -15.5, { speed: 1.4 });
  if (G.state !== 'explore') return;
  fl.faceTo(gm.pos.x, gm.pos.z); fl.setMode('talk');
  ui.bubble(fl.c.root, 'Grandma Edna! Did you enjoy my set at your 90th?', 3, fl.name);
  await wait(3);
  if (G.state !== 'explore') return;
  ui.bubble(gm.c.root, 'I did not.', 2, gm.name);
  await wait(8);
  if (G.state !== 'explore') return;
  await fl.walkTo(L.flutist.x, L.flutist.z, { speed: 1.4 });
  if (G.state !== 'explore') return;
  fl.setHeading(0.15); fl.setMode('fluteIdle');
  G.fluteDown = false;
  if (G.flags.noFlute) {
    if (!fl.c.kazoo) fl.c.kazoo = fl.c.attach('Head', P.kazooProp(), V(-0.08, -0.06, 0.16));
    ui.bubble(fl.c.root, 'ESMERALDA?! …No matter. A true artist always carries a backup kazoo.', 3.6, fl.name);
    AU.babble('Esmeralda no matter a true artist', fl.voice);
  } else { W.fluteDown.visible = false; fl.c.flute.visible = true; }
  G.fluteBreak = false;
  G.fluteBreakAt = clock.t + rand(50, 70);
}

async function momMarch() {
  const mom = G.cast.by.mom, p = G.player.pos;
  G.momMarch = true; G.busy = true; ui.prompt(null); G.player.enabled = false;
  ui.bubble(mom.c.root, 'That\'s IT.', 2, 'Mother of the Bride');
  await mom.walkTo(p.x + 0.9, p.z + 0.7, { speed: 3.6 });
  if (G.state !== 'explore') return;
  mom.faceTo(p.x, p.z); mom.setMode('point');
  ui.bubble(mom.c.root, '{G}. We are starting. NOW.', 2.6, 'Mother of the Bride');
  AU.babble('We are starting now', 1.25);
  await wait(2.4);
  G.player.enabled = true;
  try { await G.interactables.find((i) => i.id === 'flute').action(); } finally { G.busy = false; }
}

function updateMarker() {
  const m = G.marker;
  const next = G.markerFocus || (G.check.find((c) => !c.final && !c.done) || G.check.find((c) => c.final)).id;
  const pos = checkPos(next);
  const show = settings.marker && pos && !G.busy && Math.hypot(pos.x - G.player.pos.x, pos.z - G.player.pos.z) > 2.2;
  m.visible = !!show;
  if (!show) return;
  const pulse = G.markerPulse && clock.t - G.markerPulse < 1.2 ? 1 + Math.abs(Math.sin((clock.t - G.markerPulse) * 8)) * 0.8 : 1;
  m.position.copy(pos).add(V(0, Math.sin(clock.t * 3) * 0.12, 0));
  m.scale.setScalar(0.035 * pulse);
}

// ------------------------------------------------------------------ per-frame world animation
const _c = new THREE.Color();
function animateWorld(dt) {
  const W = G.world;
  W.kaiju.update(clock.t, dt);
  W.balloon.rotation.set(Math.sin(clock.t * 0.9) * 0.05, 0, Math.sin(clock.t * 1.3) * 0.06);
  const beat = AU.beatPhase();
  const on = beat >= 0 && !G.blackout;
  // dance floor tiles
  const n = W.danceN, bt = Math.floor((clock.t * 112) / 60);
  for (let i = 0; i < n * n; i++) {
    if (!on) { _c.set(G.blackout ? 0x111111 : 0x2a2a2a); }
    else {
      const a = Math.floor(i / n), b = i % n;
      const hue = ((a + b + bt) % 6) / 6;
      const lit = ((a * 3 + b * 5 + bt) % 4) === 0;
      _c.setHSL(hue, 0.85, lit ? 0.55 * (1 - beat * 0.6) : 0.12);
    }
    W.danceTiles.setColorAt(i, _c);
  }
  W.danceTiles.instanceColor.needsUpdate = true;
  W.discoBall.rotation.y += dt * 0.8;
  if (!G.blackout) for (const v of W.vinyls) v.rotation.y += dt * 3.5;
  for (const s of W.speakerCones) s.scale.setScalar(on ? 1 + Math.max(0, 1 - beat * 4) * 0.08 : 1);
  W.candleFlames.forEach((f, i) => { f.scale.y = 0.8 + Math.sin(clock.t * 13 + i * 3) * 0.25; });
  W.stripLed.material.color.setHex(G.blackout ? 0x220000 : (Math.sin(clock.t * 4) > 0 ? 0xff2020 : 0x801010));
  // leash from the bed to Biscuit's collar
  if (W.leash.visible) {
    const a = W.leash.geometry.attributes.position, bp = W.dogBed.position, dp = G.cast.by.dog.root.position;
    a.setXYZ(0, bp.x, 0.18, bp.z); a.setXYZ(1, dp.x, dp.y + 0.62, dp.z); a.needsUpdate = true;
  }
}

function updateTitleCam() {
  const t = clock.t * 0.05;
  camera.position.set(Math.sin(t) * 24, 9 + Math.sin(t * 2) * 1.5, -4 + Math.cos(t) * 24);
  camera.lookAt(0, 1, -5);
}

// ------------------------------------------------------------------ main loop
let last = performance.now();
function loop(now) {
  requestAnimationFrame(loop);
  let dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (G.paused) { renderer.render(scene, camera); return; }
  if (G.fastForward && (G.state === 'intro' || (G.state === 'cascade' && !G.qteActive))) dt *= 3;
  dt *= G.timeScale ?? 1;
  clock.dt = dt; clock.t += dt;
  tickScheduler();
  for (const n of G.cast.npcs) n.update(dt);
  G.cast.by.dog.update(dt);
  if (G.state === 'title') { G.player.update(dt); updateTitleCam(); }
  else {
    G.player.update(dt);
    if (G.player.cinematic) G.cine.update(dt);
  }
  if (G.state === 'explore') actOne(dt);
  if (G.dance) G.dance.update();
  if (G.cascadeUpdate) G.cascadeUpdate(dt);
  animateWorld(dt);
  G.fx.update(dt, camera);
  AU.updateAudio();
  ui.tick(dt);
  ui.updateBubbles(camera);
  $('touch-e').classList.toggle('hidden', !((G.state === 'explore' && G.current) || G.qteActive || ui.choiceActive()));
  const sh = G.fx.shakeOffset();
  if (sh) camera.position.add(sh);
  renderer.render(scene, camera);
  if (sh) camera.position.sub(sh);
}

// ------------------------------------------------------------------ ending
// the ending = what Biscuit did x what the groom walks away with
function endingInfo() {
  const s = G.stats;
  const dog = s.pets > 0 && G.dogHasCake !== false;
  const groom = G.flags.rings ? 'rings' : s.punch >= 3 ? 'drunk' : 'sober';
  const id = `${dog ? 'dog' : 'nodog'}_${groom}`;
  const line = dog ? `${names.groom} did not get married today. But he did get a dog. And most of a cake.`
    : `${names.groom} did not get married today. Biscuit, however, had the best day of his life.`;
  let epilogue = `${names.bride} and Chad were last seen heading south on the motorway. `;
  epilogue += dog ? `${names.groom} and Biscuit are doing great. They share a flat, a sofa, and a strict no-flutes policy.` : 'Biscuit gained four kilos.';
  if (groom === 'rings') epilogue += ' The one ring Chad didn\'t catch paid for the first month\'s rent.';
  if (groom === 'drunk') epilogue += ` ${names.groom} remembers none of it and calls it "the best wedding ever".`;
  if (!dog) epilogue += ' (Pro tip: petting the dog changes how this ends.)';
  return { id, name: ENDINGS[id], line, epilogue };
}
G.endingInfo = endingInfo;

// Pause menu → "Skip to the invoice" (only after a first full run)
function skipToInvoice() {
  if (G.state !== 'cascade') return;
  cancelAll();
  ui.cancelQTE(); G.qteActive = false;
  G.cascadeUpdate = null; G.timeScale = 1; G.dance = null;
  AU.stopAllLoops();
  ui.clearSay(); ui.clearBubbles();
  G.paused = false; ui.screen('pause', false);
  showEnding();
}

function showEnding() {
  if (G.state === 'ending') return;
  G.state = 'ending';
  G.player.unlock();
  ui.showHUD(false);
  const s = G.stats;
  const E = endingInfo();
  // anything the cascade didn't get to bill (skipped) is billed at the standard rate
  for (const [key, label, amt] of standardBill(G)) if (!G.bill.has(key)) G.bill.set(key, [label, amt]);
  const rows = [...G.bill.values()];
  if (s.punch) rows.push([`Punch (you had ${s.punch} cup${s.punch > 1 ? 's' : ''}; it was 80% rum)`, s.punch * 15]);
  if (s.gifts.size) rows.push([`Gift inspection fee (${s.gifts.size} shaken, 1 now broken)`, 45 * s.gifts.size]);
  if (s.pets) rows.push([`Dog petting (${s.pets}×): Biscuit waived the fee`, 0]);
  if (s.danced) rows.push([`Dance floor: residual embarrassment (best score ${s.danceScore}/8)`, 0]);
  if (G.flags.ficus) rows.push(['Ficus: grief counselling after Frank left', 35]);
  rows.push([`Bride (${names.bride}): left with Chad`, 'priceless']);
  const table = $('inv-table');
  table.innerHTML = '';
  let total = 0;
  rows.forEach(([d, a], i) => {
    const tr = document.createElement('tr');
    tr.style.animationDelay = (0.4 + i * 0.12) + 's';
    const amt = typeof a === 'number' ? (a < 0 ? '−$' : '$') + Math.abs(a).toLocaleString('en-US', { minimumFractionDigits: a % 1 ? 2 : 0 }) : a;
    tr.innerHTML = `<td>${d}</td><td class="amt">${amt}</td>`;
    table.appendChild(tr);
    if (typeof a === 'number') total += a;
  });
  $('inv-to').textContent = names.groom;
  $('inv-total').textContent = '$' + total.toLocaleString('en-US', { minimumFractionDigits: 2 });
  $('inv-epilogue').textContent = E.epilogue;
  // achievements earned by the numbers
  const elapsed = (G.cascadeStart || clock.t) - (G.exploreStart || 0);
  const checks = {
    soulmate: s.pets >= 1, goodboy: s.pets >= 5, openbar: s.punch >= 3, badluck: s.peeks >= 1, customs: s.gifts.size >= 6, social: s.talked.size >= 10,
    paparazzi: s.photos >= 3, safety: s.strip, engineer: s.arch, mom: G.check.filter((c) => !c.final).every((c) => c.done), speedrun: elapsed < 45, fanning: s.mash >= 12, dance: s.danceScore >= 6,
  };
  for (const [id, ok] of Object.entries(checks)) if (ok) unlock(id, true);
  const newEnding = progress.ending(E.id);
  progress.finishRun();
  $('inv-ending').innerHTML = `Ending: <b>${E.name}</b>${newEnding ? ' (new!)' : ''} · ${progress.endingCount}/${Object.keys(ENDINGS).length} endings found`;
  $('inv-ach').innerHTML = ACH.map((a) => {
    const got = G.runAch.has(a.id), cls = got ? 'got' + (G.newAch.has(a.id) ? ' new' : '') : '';
    return `<span class="ach ${cls}" title="${a.desc}">${got ? '★' : '☆'} ${a.name}</span>`;
  }).join('');
  ui.album(G.album);
  ui.screen('ending', true);
}

// one collage PNG of the album
async function saveAlbum() {
  const shots = G.album; if (!shots.length) return;
  const cols = Math.min(3, shots.length), rows = Math.ceil(shots.length / cols), W = 480, H = 360, pad = 24, cap = 44;
  const cv = document.createElement('canvas');
  cv.width = cols * (W + pad) + pad; cv.height = rows * (H + cap + pad) + pad + 70;
  const g = cv.getContext('2d');
  g.fillStyle = '#fbf3e8'; g.fillRect(0, 0, cv.width, cv.height);
  g.fillStyle = '#c2185b'; g.font = 'bold 40px Georgia'; g.textAlign = 'center';
  g.fillText(`The wedding of ${names.bride} & ${names.groom}`, cv.width / 2, 54);
  for (let i = 0; i < shots.length; i++) {
    const img = await new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.src = shots[i].url; });
    const x = pad + (i % cols) * (W + pad), y = 80 + Math.floor(i / cols) * (H + cap + pad);
    g.fillStyle = '#fff'; g.fillRect(x - 8, y - 8, W + 16, H + cap + 8);
    g.drawImage(img, x, y, W, H);
    g.fillStyle = '#333'; g.font = 'italic 22px Georgia'; g.fillText(fmt(shots[i].title), x + W / 2, y + H + 30);
  }
  const a = document.createElement('a');
  a.href = cv.toDataURL('image/png');
  a.download = `wedding-album-${names.bride}-and-${names.groom}.png`.replace(/[^a-z0-9.\-]/gi, '_');
  a.click();
}

boot().catch((e) => { ui.error('Failed to start: ' + (e.stack || e)); console.error(e); });
