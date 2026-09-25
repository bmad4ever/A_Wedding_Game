// DOM overlay: subtitles, speech bubbles, prompts, checklist, beat cards, QTEs, toasts.
import * as THREE from 'three';
import { babble } from './audio.js';
import { wait, clock } from './util.js';
import { settings } from './progress.js';

const $ = (id) => document.getElementById(id);
const show = (el, on = true) => el.classList.toggle('hidden', !on);
export const ui = {};
let subTimer = null;
const bubbles = [];
let qteState = null;
export const names = { bride: 'Alice', groom: 'Bob' };
export const fmt = (s) => s.replace(/\{B\}/g, names.bride).replace(/\{G\}/g, names.groom);

ui.showHUD = (on) => show($('hud'), on);
ui.screen = (id, on) => show($(id), on);

ui.say = (name, text, dur = null, voice = 1) => {
  text = fmt(text);
  const el = $('subtitle');
  $('sub-name').textContent = name ? fmt(name) + ':' : '';
  $('sub-text').textContent = text;
  show(el, true);
  const d = dur ?? Math.max(2.2, text.length * 0.055 + 0.8);
  babble(text, voice);
  clearTimeout(subTimer);
  const token = {};
  ui._sub = token;
  return wait(d).then(() => { if (ui._sub === token) show(el, false); });
};
ui.clearSay = () => { show($('subtitle'), false); ui._sub = null; };

ui.bubble = (obj, text, dur = 3.5, name = '') => {
  const el = document.createElement('div');
  el.className = 'bubble';
  el.innerHTML = (name ? `<b>${fmt(name)}</b>` : '') + escapeHtml(fmt(text));
  $('bubbles').appendChild(el);
  const b = { obj, el, until: clock.t + dur, h: obj.bubbleH ?? 2.25 };
  bubbles.push(b);
  return b;
};
function escapeHtml(s) { return s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
const _v = new THREE.Vector3();
ui.updateBubbles = (camera) => {
  const w = innerWidth, h = innerHeight;
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i];
    if (clock.t > b.until) { b.el.remove(); bubbles.splice(i, 1); continue; }
    b.obj.getWorldPosition(_v); _v.y += b.h;
    const dist = _v.distanceTo(camera.position);
    _v.project(camera);
    const vis = _v.z < 1 && dist < 22 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1;
    b.el.style.display = vis ? '' : 'none';
    if (vis) { b.el.style.left = ((_v.x + 1) / 2) * w + 'px'; b.el.style.top = ((1 - _v.y) / 2) * h + 'px'; b.el.style.opacity = String(Math.min(1, (22 - dist) / 6)); }
  }
};
ui.clearBubbles = () => { bubbles.forEach((b) => b.el.remove()); bubbles.length = 0; };

ui.prompt = (text) => {
  if (!text) { show($('prompt'), false); return; }
  $('prompt-text').textContent = fmt(text);
  show($('prompt'), true);
};

ui.checklist = (items) => {
  const ul = $('cl-items');
  ul.innerHTML = '';
  let done = 0;
  for (const it of items) {
    const li = document.createElement('li');
    li.textContent = fmt(it.label);
    if (it.done) { li.className = 'done'; done++; }
    if (it.final) li.classList.add('final');
    ul.appendChild(li);
  }
  $('cl-count').textContent = `${done}/${items.filter((i) => !i.final).length}`;
};
ui.showChecklist = (on) => show($('checklist'), on);

ui.beat = async (num, title, dur = 3.2) => {
  const el = $('beat');
  el.querySelector('.beat-num').textContent = num;
  el.querySelector('.beat-title').textContent = fmt(title);
  show(el, false); void el.offsetWidth; show(el, true);
  await wait(dur);
  show(el, false);
};

ui.meter = (on) => show($('meter'), on);
ui.integrity = (pct) => { $('m-fill').style.width = Math.max(0, pct) + '%'; };
let dmgShown = 0, dmgTarget = 0;
ui.damage = (amount) => { dmgTarget = amount; };
ui.resetDamage = () => { dmgShown = 0; dmgTarget = 0; $('m-dmg').textContent = '$0'; };
ui.tick = (dt) => {
  if (dmgShown !== dmgTarget) {
    dmgShown += (dmgTarget - dmgShown) * Math.min(1, dt * 4) + Math.sign(dmgTarget - dmgShown);
    if (Math.abs(dmgTarget - dmgShown) < 2) dmgShown = dmgTarget;
    $('m-dmg').textContent = '$' + Math.round(dmgShown).toLocaleString('en-US');
  }
  if (qteState) {
    const k = Math.min(1, (clock.t - qteState.t0) / qteState.dur);
    $('qte-fill').style.width = (qteState.mash ? Math.min(100, qteState.count * 8) : (1 - k) * 100) + '%';
    if (k >= 1) ui.endQTE();
  }
};

ui.qte = (text, dur = 2.5, { mash = false } = {}) => new Promise((res) => {
  $('qte-text').textContent = fmt(text);
  show($('qte'), true);
  qteState = { t0: clock.t, dur, mash, count: 0, res, pressed: false };
});
ui.qteKey = () => {
  if (!qteState) return false;
  qteState.count++;
  qteState.pressed = true;
  if (!qteState.mash) ui.endQTE();
  return true;
};
// drop a QTE without resolving it (skip to the invoice)
ui.cancelQTE = () => { qteState = null; show($('qte'), false); };
ui.endQTE = () => {
  if (!qteState) return;
  const q = qteState; qteState = null;
  show($('qte'), false);
  q.res({ pressed: q.pressed, count: q.count });
};

ui.toast = (title, text) => {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span class="tt">${title}</span>${escapeHtml(fmt(text))}`;
  $('toasts').appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .5s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 600); }, 3800);
};

ui.flash = (k = 1, color = '#fff') => {
  if (settings.calm) k *= 0.12;
  const el = $('flash');
  el.style.background = color;
  el.style.transition = 'none'; el.style.opacity = String(k);
  requestAnimationFrame(() => { el.style.transition = 'opacity .5s'; el.style.opacity = '0'; });
};
ui.vignette = (k) => {
  const inner = 55 - k * 35, a = 0.55 + k * 0.35;
  $('vignette').style.background = `radial-gradient(ellipse at center, transparent ${inner}%, rgba(${Math.round(k * 60)},0,0,${a}) 100%)`;
};
ui.letterbox = (on) => $('letterbox').classList.toggle('on', on);
ui.hint = (text) => { if (!text) return show($('hint'), false); $('hint').textContent = fmt(text); show($('hint'), true); };
ui.controlsHint = (on) => show($('crosshint'), on);

// ---- dialogue choices: ui.choice(title, ['a', 'b']) -> index, or -1 when dismissed ----
let choiceState = null;
ui.choice = (title, options) => new Promise((res) => {
  const box = $('choice');
  box.querySelector('.ch-title').textContent = fmt(title);
  const list = box.querySelector('.ch-list');
  list.innerHTML = '';
  options.forEach((o, i) => {
    const b = document.createElement('button');
    b.className = 'ch-opt';
    b.innerHTML = `<span class="key">${i + 1}</span>${escapeHtml(fmt(o))}`;
    b.onclick = (e) => { e.stopPropagation(); ui.choiceDone(i); };
    list.appendChild(b);
  });
  show(box, true);
  choiceState = { res, n: options.length, sel: 0 };
  ui.choiceHighlight();
});
ui.choiceActive = () => !!choiceState;
ui.choiceHighlight = () => { [...$('choice').querySelectorAll('.ch-opt')].forEach((b, i) => b.classList.toggle('sel', choiceState && i === choiceState.sel)); };
ui.choiceDone = (i) => { if (!choiceState) return; const c = choiceState; choiceState = null; show($('choice'), false); c.res(i); };
// keyboard for the open choice; returns true when the key was used
ui.choiceKey = (e) => {
  if (!choiceState) return false;
  const c = choiceState;
  const n = parseInt(e.key, 10);
  if (n >= 1 && n <= c.n) ui.choiceDone(n - 1);
  else if (e.code === 'ArrowDown' || e.code === 'KeyS') { c.sel = (c.sel + 1) % c.n; ui.choiceHighlight(); }
  else if (e.code === 'ArrowUp' || e.code === 'KeyW') { c.sel = (c.sel + c.n - 1) % c.n; ui.choiceHighlight(); }
  else if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') ui.choiceDone(c.sel);
  else if (e.code === 'Escape') ui.choiceDone(-1);
  return true;
};

// ---- dance-off lane: one arrow at a time, a ring closes in on the beat ----
const ARROWS = { up: '▲', down: '▼', left: '◀', right: '▶' };
ui.danceShow = (on) => { show($('danceoff'), on); if (on) { $('do-grade').textContent = ''; $('do-score').textContent = ''; } };
ui.danceArrow = (dir, k) => { // k: 0 = ring far away, 1 = on the beat
  $('do-arrow').textContent = dir ? ARROWS[dir] : '';
  $('do-ring').style.transform = `translate(-50%, -50%) scale(${dir ? 1 + (1 - Math.min(1, k)) * 1.8 : 0})`;
  $('do-ring').style.opacity = dir ? String(0.3 + 0.7 * Math.min(1, k)) : '0';
};
ui.danceGrade = (text, cls, score) => {
  const g = $('do-grade');
  g.textContent = text; g.className = 'do-grade ' + cls;
  void g.offsetWidth; g.classList.add('pop');
  $('do-score').textContent = score;
};

// ---- the wedding album on the invoice: tilted polaroids ----
ui.album = (shots) => {
  const el = $('inv-album');
  el.innerHTML = '';
  shots.forEach((s, i) => {
    const d = document.createElement('figure');
    d.className = 'polaroid';
    d.style.setProperty('--tilt', ((i % 2 ? 1 : -1) * (1.5 + (i * 7) % 5)) + 'deg');
    d.style.animationDelay = (0.6 + i * 0.15) + 's';
    d.innerHTML = `<img src="${s.url}" alt=""><figcaption>${escapeHtml(fmt(s.title))}</figcaption>`;
    el.appendChild(d);
  });
  show($('album-wrap'), shots.length > 0);
};

ui.loading = (k, text) => { $('load-fill').style.width = Math.round(k * 100) + '%'; if (text) $('load-text').textContent = text; };
ui.error = (msg) => { const e = $('err'); e.textContent = msg; show(e, true); };
