// ACT II — one authored domino chain. Every beat causes the next.
import * as THREE from 'three';
import { ui, names, fmt } from './ui.js';
import * as AU from './audio.js';
import { face } from './faces.js';
import { L } from './layout.js';
import { wait, tween, clock, rand, pick, easeIn, easeOut, easeInOut, easeOutBounce, linear, lerp, removeCollider } from './util.js';
import * as P from './props.js';

const V = (x, y, z) => new THREE.Vector3(x, y, z);

// The invoice, line by line, as [key, label, amount]. Choices made in Act I swap some lines.
// The cascade bills each line as it happens; anything skipped is billed from here (main.js showEnding).
export function standardBill(G) {
  const f = G.flags || {};
  const rows = [
    ['mic', 'Microphone + stand (knocked over, then stepped on)', 700],
    ['arch', 'Ceremony arch (rental, non-refundable deposit)', 2400],
    ['tower', 'Champagne tower: 30 coupes + 6 bottles of Brut', 1470],
    ['strip', 'Power strip (vaporized)', 12.99],
  ];
  if (f.taped) rows.push(['tape', 'Duct tape (performed flawlessly; not its fault)', 4.5], ['fog', 'Fog machine (the DJ\'s own, now modern art)', 1200]);
  rows.push(['baby', 'Earplugs, rows 1 to 7 (Baby Kevin: 94 decibels, three octaves)', 64]);
  rows.push(['dj', 'DJ Sick Beatz: equipment + emotional damages', 8700], ['cloth', 'Banquet tablecloth, incinerated', 180]);
  rows.push(['kids', 'Kids\' table demands: 1 pony (deposit), 40 juice boxes, bedtime (cancelled), one guest\'s trousers', 1250]);
  rows.push(['cake', 'Three-tier wedding cake (current owner: Biscuit)', 950]);
  if (f.leashed) rows.push(['leg', 'Uncle Frank\'s back (hit by a flying dog bed)', 6000], ['bed', 'Dog bed (towed 80 metres, still attached)', 85]);
  else rows.push(['leg', 'Uncle Frank\'s leg (the good one)', 14000]);
  rows.push(['tires', 'Motorcycle tire marks on heritage lawn', 600], ['sprinklers', 'Emergency sprinkler activation + water bill', 320], ['grief', 'Grief counselling, 38 guests', 11400],
    ['flute', f.noFlute ? 'Kazoo solo, 17 movements (billed by Reginald; flute "missing")' : 'Flute solo, 17 movements (billed by Reginald)', 500]);
  if (f.rings) rows.push(['rings', 'Wedding ring, pawned at dawn (the one Chad didn\'t catch)', -1600]);
  return rows;
}

export async function runCascade(G) {
  const { world: W, cast, player, cine, fx } = G;
  const by = cast.by;
  const groom = player.npc;
  G.cascadeStart = clock.t;
  G.timeScale = 1;
  const upd = [];               // per-frame callbacks for this act
  G.cascadeUpdate = (dt) => { for (const f of upd) f(dt); };
  let damage = 0;
  const STD = new Map(standardBill(G).map(([k, l, a]) => [k, [l, a]]));
  // bill a standard line (by key) or a custom one; the damages counter follows along
  const bill = (key, label, amt) => {
    const e = label ? [label, amt] : STD.get(key);
    if (!e || G.bill.has(key)) return;
    G.bill.set(key, e);
    damage += Math.max(0, e[1]); ui.damage(damage);
  };
  const integ = (v) => ui.integrity(v);
  const snap = (title) => G.capture && G.capture(title);
  const F = G.flags;
  const setFace = (n, f) => n.c.setFace(face(f)); // custom bride/groom faces override these (faces.js)
  const say = (n, text, dur, voice) => ui.say(n ? n.name : '', text, dur, voice ?? (n ? n.voice : 1));
  const bubble = (n, text, dur = 2.5) => ui.bubble(n.c ? n.c.root : (n.root || n), text, dur, n.name || '');
  const qte = async (text, dur, opts) => { G.qteActive = true; const r = await ui.qte(text, dur, opts); G.qteActive = false; return r; };
  const beat = (n, title) => { ui.beat(`BEAT ${n} / 8`, title); ui.vignette(n / 8); };

  player.cinematic = true;
  ui.letterbox(true);
  ui.clearBubbles();
  ui.meter(true); ui.integrity(100); ui.resetDamage();

  // ------------------------------------------------ places, everyone
  const standing = [...by.dancers, ...by.chatters.flat()];
  const spots = [];
  for (let z = -4.8; z <= -2.6; z += 1.1) for (let x = -4.2; x <= 4.2; x += 0.95) if (Math.abs(x) > 1.0) spots.push([x + rand(-0.15, 0.15), z + rand(-0.2, 0.2)]);
  spots.sort(() => Math.random() - 0.5);
  standing.forEach((n, i) => { const [x, z] = spots[i % spots.length]; n.target = null; n.place(x, z, Math.PI); n.setMode('idle'); });
  by.uncle.target = null;
  if (F.ficus) by.uncle.place(-4.2, 1.6, Math.PI + 0.3).setMode('drink'); else by.uncle.place(3.9, 1.3, Math.PI - 0.3).setMode('drink');
  by.mom.place(-4.3, -17.2, Math.PI * 0.85).setMode('idle');
  by.bridesmaid.place(-1.5, -18.4, 0.1).setMode('idle');
  by.photographer.target = null; by.photographer.place(-4.6, -13.5, Math.PI * 0.75).setMode('photo');
  by.dog.root.position.set(L.dogBed.x + (F.leashed ? 0.6 : 0), 0, L.dogBed.z + (F.leashed ? 0.7 : 0)); by.dog.root.rotation.y = 0.8; by.dog.state = 'sit'; G.dogFollow = false;
  groom.target = null; groom.place(0.75, -18.6, 0.05).setMode('idle');
  by.officiant.place(L.officiant.x, L.officiant.z, 0).setMode('idle');
  by.flutist.target = null; by.flutist.custom = null;
  by.flutist.place(L.flutist.x, L.flutist.z, 0.1);
  // the flute (or, if the groom swiped it, the backup kazoo)
  W.fluteDown.visible = false; G.fluteDown = false;
  by.flutist.c.flute.visible = !F.noFlute;
  if (F.noFlute && !by.flutist.c.kazoo) by.flutist.c.kazoo = by.flutist.c.attach('Head', P.kazooProp(), V(-0.08, -0.06, 0.16));
  by.bride.target = null; by.bride.place(L.tent.x - 1.2, L.tent.z, -Math.PI / 2).setMode('bouquet');
  const bm = by.babyMom;
  bm.target = null; bm.place(bm.chair.x, bm.chair.z, Math.PI).setMode('sitCradle', 0);
  by.kids.forEach((k) => { k.target = null; k.place(k.seat.x, k.seat.z, k.seat.heading).setMode('kidSit', k.kid.h); });
  player.drunk *= 0.5;

  // ------------------------------------------------ opening
  cine.set(V(0, 2.2, -12), V(0, 1.5, -19));
  AU.musicDuck(0.18, 1);
  await say(by.officiant, 'Dearly beloved. We are gathered here today… Reginald? The processional, please.', 3.6);
  // a real orchestra (for about ten seconds)
  AU.musicDuck(0.0, 0.6);
  const fan = AU.weddingFanfare();
  const fanT0 = clock.t;
  AU.fluteStart(F.noFlute ? 'kazoo' : 'flute', fan.cue); // audio-clocked: the pickup lands on the orchestra's final chord
  // the processional: bride leaves the tent, crosses the lawn, then takes the aisle one hesitation step at a time
  const aisle0 = -4.4, BRIDE_Z = -12.2; // she gets about halfway before things fall apart; later beats pick her up here
  let procession = true;
  (async () => {
    await by.bride.path([[L.tent.x - 3, L.tent.z - 0.5], [4, 0.5], [0, aisle0]], { speed: 1.6 });
    for (let z = aisle0; procession && z > BRIDE_Z + 0.01;) {
      z = Math.max(BRIDE_Z, z - 0.55);
      await by.bride.walkTo(0, z, { speed: 0.65 });
      if (procession) { by.bride.setHeading(Math.PI); await wait(0.3); }
    }
    if (procession) { by.bride.setHeading(Math.PI); by.bride.setMode('bouquet'); }
  })();
  cine.track(by.bride.c.root, V(-2.2, 1.5, -3.2), V(0, 1.3, 0), 3);
  await wait(2.2);
  await say(by.mom, 'Oh… oh, she looks BEAUTIFUL…', 2.4);
  cine.set(V(3.6, 1.8, -15.8), V(2.4, 1.55, -18.4));
  by.flutist.setMode('fluteIdle');
  await say(by.flutist, F.noFlute ? 'Mendelssohn. Charming. Esmeralda is gone, but art finds a way.' : 'Ah, Mendelssohn. A charming warm-up act.', 2.6);
  by.flutist.setMode('flute', 0);
  setFace(by.flutist, 'flutist_bliss');
  await wait(Math.max(0.2, fan.cue - (clock.t - fanT0)));

  // ================================================= BEAT 1 — flute solo from hell
  // It starts out lovely. It gets worse with every step she takes down the aisle.
  let decay = 0, bonus = 0, movement = 1;
  const fluteT0 = clock.t;
  const fluteUpd = () => {
    const walked = Math.min(1, Math.max(0, (aisle0 - by.bride.pos.z) / (aisle0 - BRIDE_Z)));
    decay = Math.max(decay, Math.pow(walked, 1.3), (clock.t - fluteT0) * 0.02);
    const frenzy = Math.min(1, decay + bonus);
    by.flutist.arg = frenzy; AU.fluteFrenzy(frenzy);
  };
  upd.push(fluteUpd);
  // the dog howls along (once it's gone bad)
  (async () => { await wait(7); by.dog.head.rotation.x = -0.6; for (let i = 0; i < 3; i++) { AU.whine(); await wait(1.3); } })();
  cine.set(V(0, 1.6, -15), V(0, 1.1, -6));
  await say(by.grandma, '…Oh, that\'s lovely. Who knew he could actually play?', 2.6);
  cine.track(by.flutist.c.root, V(1.3, 1.7, 2.6), V(0, 1.5, 0), 2);
  const mv = async (text) => { ui.say('', `Movement ${['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII', 'XIV', 'XV', 'XVI', 'XVII'][movement - 1]}: ${text}`, 2.2); movement++; };
  // (her aisle walk spans the whole solo: ~16 s from here to beat 2)
  await mv(F.noFlute ? '"Kazoo Concerto in B-flat Minor"' : '"Dawn Over the Fjord"');
  await wait(2.2);
  beat(1, F.noFlute ? 'The Kazoo Solo From Hell' : 'The Flute Solo From Hell');
  await wait(1.8);
  snap(F.noFlute ? 'The processional (kazoo)' : 'The processional');
  // crowd reaction, bride still coming up the aisle
  cine.set(V(0, 1.6, -15), V(0, 1.1, -8));
  by.seated.slice(0, 5).forEach((n) => n.setMode('sit'));
  bubble(by.grandma, 'Is he… being murdered?', 2.4);
  wait(1.2).then(() => bubble(by.bride, '(keep smiling… keep walking…)', 2.4));
  await mv(F.noFlute ? '"The Buzzing"' : '"The Screaming"');
  await wait(2.4);
  // …which wakes the baby
  cine.set(V(0.15, 1.2, -15.0), V(1.2, 0.8, -13.3));
  bm.c.babyFace.material.map = face('baby_cry'); bm.c.babyFace.material.needsUpdate = true;
  bm.arg = 1;
  AU.babyCry(1);
  ui.bubble(bm.c.baby, 'WAAAAAAAAAAH!!!', 2.2, 'Baby Kevin');
  bill('baby');
  wait(1.0).then(() => bubble(bm, 'Shhh, shh, shh… it\'s only Cousin Reginald, sweetie…', 2.4));
  await wait(2.6);
  movement = 9;
  await mv(F.noFlute ? '"Wasps at Dawn (Dubstep Remix)"' : '"A Gentle Brook (Dubstep Remix)"');
  await wait(1.4);
  cine.set(V(1.8, 1.8, -14.5), V(1.2, 1.5, -18.5));
  const q1 = await qte('Stop the flute!', 2.2);
  if (q1.pressed) {
    groom.setMode('panic');
    bubble(groom, 'Reginald! That\'s ENOUGH!', 2);
    await wait(0.8);
    bubble(by.flutist, 'THE ARTIST IS NOT FINISHED!', 2.2);
    bonus = 0.35;
    bill('reginald', 'Reginald\'s emotional damages ("THE ARTIST WAS NOT FINISHED")', 250);
    await wait(1.4);
  } else {
    bubble(groom, '(it\'s fine… it\'s only seventeen movements…)', 2.4);
    bill('overtime', 'Movements VIII to XVII, overtime surcharge', 120);
    await wait(1.4);
  }
  groom.setMode('idle');
  movement = 14;
  await mv('"The Awakening of the Neighbours\' Dogs"');
  await wait(1.6);

  // ================================================= BEAT 2 — feedback + spilled drink
  beat(2, 'Feedback');
  bill('mic'); integ(88);
  AU.feedbackStart();
  bonus = 1;
  cine.set(V(6.8, 1.9, -16.4), V(7.2, 1.2, -19.8));
  setFace(by.dj, 'dj_shock');
  by.dj.setMode('panic');
  G.cast.npcs.filter((n) => by.seated.includes(n)).forEach((n) => n.setMode('sit'));
  await say(by.dj, 'NO NO NO — he\'s going through MY board! Kill it, KILL IT!', 2.6);
  // DJ lunges for the plug… and swipes the energy drink
  by.dj.setMode('idle');
  by.dj.custom = (n) => { n.c.r('Spine01', 0.6, 0.4, 0); n.c.r('ArmL', -1.2, 0, 0.8); n.c.r('ArmR', -0.6, 0, -0.2); };
  await by.dj.walkTo(L.dj.x - 0.8, L.dj.z + 0.1, { speed: 3 });
  AU.whoosh();
  const can = W.drink;
  cine.set(V(5.2, 1.0, -17.3), V(4.6, 0.3, -19.1));
  fx.body(can, V(-2.2, 1.2, 0.35), V(4, 2, 7), { floor: 0.035, bounce: 0.35, friction: 0.8, onLand: () => AU.tink() });
  const q2 = qte('Catch the drink!', 1.2);
  await wait(1.0);
  // can rolls toward the strip, spilling
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(1, 16), new THREE.MeshStandardMaterial({ color: 0x5dff3a, emissive: 0x1a6a10, transparent: true, opacity: 0.75, roughness: 0.05 }));
  puddle.rotation.x = -Math.PI / 2; puddle.position.set(4.6, 0.012, -19.05); puddle.scale.setScalar(0.01);
  W.root.add(puddle);
  const canStart = can.position.clone();
  tween(1.8, (k) => { can.position.x = lerp(canStart.x, L.strip.x + 0.45, k); can.position.z = lerp(canStart.z, L.strip.z, k); can.rotation.set(0, 0, Math.PI / 2 + k * 10); }, easeOut);
  tween(2.4, (k) => { puddle.scale.set(0.05 + k * 0.32, 0.05 + k * 0.18, 1); puddle.position.x = lerp(4.9, L.strip.x + 0.62, k); }, easeOut);
  const r2 = await q2;
  if (r2.pressed) {
    // a heroic dive, from seven metres away
    bubble(groom, '*DIVES* …catches nothing.', 1.8);
    groom.setMode('faint', 0);
    tween(0.3, (k) => { groom.arg = k; groom.pos.x = 0.75 + k * 0.9; }, easeIn);
    AU.thud();
    bill('suit', 'Groom\'s rental suit, grass-stained (heroic dive, caught nothing)', 90);
    wait(1.5).then(() => { if (groom.mode === 'faint') groom.setMode('idle'); });
  }
  await wait(1.6);
  ui.say('', '…it stops two centimetres from the power strip.', 2.6);
  await wait(2.2);
  cine.set(V(4.3, 0.55, -18.4), V(L.strip.x, 0.05, L.strip.z));
  await wait(1.6);
  snap('Two centimetres');
  bubble(by.dj, '…phew.', 1.6);
  await wait(1.2);
  by.dj.custom = null; by.dj.setMode('panic');

  // ================================================= BEAT 3 — cable trip -> arch collapse
  beat(3, 'Structural Integrity');
  cine.set(V(4.5, 2.2, -13.5), V(0.5, 1.6, -19.5));
  // Reginald, lost in the music, steps back… onto the cable
  by.flutist.custom = (n, t) => { n.c.r('Spine01', -0.3, 0, 0); };
  await by.flutist.walkTo(L.flutist.x - 0.25, L.flutist.z - 0.55, { speed: 0.7 });
  AU.fluteStop(); upd.splice(upd.indexOf(fluteUpd), 1);
  setFace(by.flutist, 'flutist_shock');
  AU.boing();
  by.flutist.setMode('panic');
  // mic stand topples
  fx.body(W.mic, V(-0.3, 0.5, -0.5), V(-1.4, 0, 1.2), { floor: 0, bounce: 0.1 });
  tween(0.6, (k) => { W.mic.rotation.x = -k * 1.5; });
  // he staggers into the arch and grabs the post
  await by.flutist.walkTo(1.7, L.arch.z + 0.35, { speed: 3.2 });
  by.flutist.custom = (n) => { n.c.r('ArmR', -1.0, 0, -1.0); n.c.r('ArmL', -1.0, 0, 1.0); n.c.r('Spine01', -0.4, 0, 0.3); };
  AU.feedbackStop(); AU.thud();
  bubble(by.flutist, 'WHOA-OA-OA—', 1.6);
  await tween(0.5, (k) => { W.archPivot.rotation.z = Math.sin(k * Math.PI * 3) * 0.06; });
  setFace(by.bride, 'bride_shock'); setFace(groom, 'groom_shock');
  procession = false; by.bride.target = null;
  by.bride.place(0, BRIDE_Z, Math.PI).setMode('bouquet');
  by.flutist.setMode('faint', 0);
  tween(0.8, (k) => { by.flutist.arg = k; }, easeIn);
  W.archColliders.forEach(removeCollider);
  cine.set(V(-1.2, 2.6, -13.5), V(-3.2, 1.2, -20));
  AU.whoosh();
  await tween(1.25, (k) => { W.archPivot.rotation.z = k * 1.74; }, easeIn);
  AU.crash(1.4); fx.shake(0.25, 0.7); ui.flash(0.25);
  fx.confetti(V(-4.6, 1.2, -19.9), 50);
  bill('arch'); integ(72);
  snap('Structural integrity');
  tween(0.5, (k) => { W.archPivot.rotation.z = 1.74 - Math.sin(k * Math.PI) * 0.08; }, linear);
  ui.say('', 'Arch: rental. Deposit: non-refundable.', 2.6);

  // ================================================= BEAT 4 — champagne tower topples
  beat(4, 'Glass Half Empty');
  // table shockwave
  const b0 = W.banquet.position.clone();
  tween(0.8, (k) => { W.banquet.position.x = b0.x + Math.sin(k * 50) * 0.03 * (1 - k); W.banquet.position.y = Math.abs(Math.sin(k * 30)) * 0.03 * (1 - k); });
  cine.set(V(-3.2, 1.35, -17.6), V(-4.5, 0.9, -19.9));
  G.timeScale = 0.35;
  AU.gasp();
  const glasses = [...W.glasses].sort((a, b) => b.level - a.level);
  const tp = W.tower.position;
  let broke = 0;
  const survivor = Math.random() < 0.35 ? pick(glasses.filter((g) => g.level === 0)) : null; // sometimes one glass lands on its feet
  glasses.forEach((g, i) => {
    setTimeout(() => {
      const o = g.obj;
      const wp = new THREE.Vector3(); o.getWorldPosition(wp);
      W.root.attach(o);
      const dir = V(wp.x - tp.x - 0.15, 0, wp.z - tp.z).normalize();
      fx.body(o, V(dir.x * rand(0.8, 2.2) - 0.6, rand(0.6, 2.2), dir.z * rand(0.8, 2.2)), V(rand(-8, 8), rand(-4, 4), rand(-8, 8)), {
        floor: wp.distanceTo(tp) < 0.4 && Math.random() < 0.3 ? L.banquet.h + 0.02 : 0.02, bounce: 0.2,
        onLand: (b) => { if (g === survivor) { AU.tink(); return; } AU.glass(1); fx.shatter(b.obj.position, 10); b.obj.visible = false; broke++; },
      });
    }, i * 55);
  });
  await wait(0.9);
  snap('Glass half empty');
  G.timeScale = 1;
  await wait(1.2);
  bill('tower'); integ(55);
  if (survivor) ui.say('', `Glasses broken: ${glasses.length - 1} of ${glasses.length}. One survived. Barely.`, 2.4);
  else ui.say('', `Glasses broken: all ${glasses.length} of them.`, 2.2);
  await wait(1.6);

  // ================================================= BEAT 5 — short circuit, blackout
  beat(5, 'Short Circuit');
  // champagne flood flows east under the fallen arch toward the strip
  const flood = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ color: 0xf5d36b, emissive: 0x5a4210, transparent: true, opacity: 0.8, roughness: 0.05, metalness: 0.2 }));
  flood.rotation.x = -Math.PI / 2;
  W.root.add(flood);
  const fx0 = L.banquet.x + L.banquet.len / 2 - 0.3, fx1 = L.strip.x - 0.1;
  cine.set(V(0.5, 1.4, -16.4), V(0.8, 0, -19.5));
  cine.move(V(2.6, 1.0, -17.2), V(3.4, 0, -19.2), 3.4);
  AU.slurp();
  await tween(3.4, (k) => {
    const x = lerp(fx0, fx1, k);
    flood.scale.set(x - fx0 + 0.001, 0.55 + Math.sin(k * 20) * 0.08, 1);
    flood.position.set((fx0 + x) / 2, 0.01, L.banquet.z + 0.7 + Math.sin(k * 3) * 0.2 - k * 0.4);
  }, easeInOut);
  if (F.taped) {
    // the duct tape holds! …and then the DJ plugs in his fog machine
    cine.set(V(4.3, 0.55, -18.4), V(L.strip.x, 0.05, L.strip.z));
    AU.tink();
    await ui.say('', 'The champagne reaches the power strip. The duct tape… HOLDS.', 2.6);
    bubble(groom, 'YES! Three layers! WHO\'S THE ENGINEER NOW?', 2.2);
    await wait(1.4);
    const fog = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.3), new THREE.MeshStandardMaterial({ color: 0x2a2a30, roughness: 0.5 }));
    fog.position.set(L.strip.x + 0.9, 0.13, L.strip.z - 0.35); W.root.add(fog);
    cine.set(V(5.6, 1.4, -16.6), V(L.strip.x + 0.4, 0.3, L.strip.z));
    bubble(by.dj, 'Crisis averted! Time for the FOG MACHINE for the first dance!', 2.6);
    by.dj.custom = null; by.dj.setMode('idle');
    await by.dj.walkTo(L.strip.x + 0.7, L.strip.z + 0.4, { speed: 2.6 });
    by.dj.setMode('crouch', 1);
    bubble(by.dj, '*peels back the tape* Just gonna squeeze in one more plug…', 2.2);
    await wait(1.6);
    bill('tape'); bill('fog');
    wait(0.6).then(() => fx.smoke(fog.position.clone().setY(0.4), 6, 0.6));
  }
  // ZAP
  AU.zap(1.5);
  fx.sparks(V(L.strip.x, 0.1, L.strip.z), 60, 4);
  wait(0.1).then(() => snap('Short circuit'));
  ui.flash(0.9, '#cfe8ff');
  fx.shake(0.12, 1.2);
  await wait(0.4);
  fx.sparks(V(L.strip.x, 0.1, L.strip.z), 40, 3); AU.zap(0.6);
  await wait(0.3);
  // blackout
  G.blackout = true;
  W.kaiju.reveal(6); // unannounced: it rises in the background of the next wide shots, for whoever notices
  AU.stopMusic('powerdown');
  W.bulbMat.color.setHex(0x222222); W.fairyMat.color.setHex(0x222222);
  W.lamps.forEach((l) => (l.intensity = 0));
  W.lanternMat.emissiveIntensity = 0;
  W.djScreen.material.emissiveIntensity = 0;
  W.stripLed.visible = false;
  const sun0 = W.sun.intensity, hemi0 = W.hemi.intensity;
  cine.set(V(0, 5, -4), V(0, 1, -16));
  const moon = new THREE.DirectionalLight(0x8fa8ff, 0);
  moon.position.set(20, 30, 10); W.root.add(moon);
  const hemiSky0 = W.hemi.color.clone();
  await tween(1.6, (k) => { W.sun.intensity = lerp(sun0, 0.2, k); W.hemi.intensity = lerp(hemi0, 0.7, k); W.hemi.color.copy(hemiSky0).lerp(new THREE.Color(0x5a6aa8), k); moon.intensity = k * 0.6; if (W.sky) W.sky.material.color.setScalar(lerp(1, 0.45, k)); scene(G).background.setRGB(lerp(0.29, 0.06, k), lerp(0.31, 0.05, k), lerp(0.56, 0.14, k)); scene(G).fog.color.setRGB(lerp(0.78, 0.12, k), lerp(0.53, 0.08, k), lerp(0.6, 0.16, k)); });
  bill('strip'); bill('dj'); integ(40);
  AU.gasp();
  await ui.say('', 'The sun, sensing the mood, sets.', 2.4);

  // ================================================= BEAT 6 — fire
  beat(6, 'Things Are Heating Up');
  // sparks crawl along the extension cord to the tablecloth
  const path = W.extCablePath.map(([x, z]) => V(x, 0.05, z));
  const cablePos = (k) => { const s = k * (path.length - 1), i = Math.min(path.length - 2, Math.floor(s)); return path[i].clone().lerp(path[i + 1], s - i); };
  cine.set(V(2.2, 2.4, -15.2), V(1.2, 0.1, -19.6));
  cine.move(V(-2.4, 2.2, -15.6), V(-3.8, 0.5, -19.8), 2.2);
  await tween(2.2, (k) => { const p = cablePos(k); fx.sparks(p, 3, 1.2); if (Math.random() < 0.3) AU.spark(); }, linear);
  // the tablecloth catches
  const T = L.banquet;
  const fires = [];
  for (let x = T.x + T.len / 2 - 0.2; x > T.x - T.len / 2; x -= 0.6) fires.push(fx.fire(V(x, T.h, T.z + rand(-0.2, 0.2)), 0, 0.35));
  const skirtFires = [fx.fire(V(T.x + T.len / 2 - 0.1, 0.1, T.z + 0.6), 0, 0.3)];
  let fireFront = 0; // 0..1 along the table (east -> west)
  const cloth0 = new THREE.Color(0xffffff), charred = new THREE.Color(0x1a1410);
  const fireUpd = (dt) => {
    fires.forEach((f, i) => { const k = i / (fires.length - 1); if (fireFront >= k) f.i = Math.min(1.3, f.i + dt * 0.8); });
    skirtFires.forEach((f) => (f.i = Math.min(1, f.i + dt * 0.5)));
    W.clothMat.color.copy(cloth0).lerp(charred, Math.min(1, fireFront * 1.2));
    AU.fireLoop(Math.min(1, fireFront * 1.5 + 0.3));
  };
  upd.push(fireUpd);
  AU.crash(0.4);
  await tween(1.5, (k) => { fireFront = k * 0.15; }, linear);
  // panic! (except the kids' table, who have been waiting for this, and their victim: whoever stands nearest)
  AU.scream(6);
  const K = L.kids, kids = by.kids;
  const kd = (n) => Math.hypot(n.pos.x - K.x, n.pos.z - K.z);
  const victim = standing.reduce((a, b) => (kd(b) < kd(a) ? b : a));
  const panicking = [...by.seated, ...standing, by.photographer].filter((n) => n !== victim);
  panicking.forEach((n) => { n.setMode('panicRun'); if (n.chair) n.c.root.position.y = 0; });
  by.grandma.setMode('sitPanic'); setFace(by.grandma, 'grandma_shock');
  setFace(by.mom, 'mom_shock');
  by.mom.setMode('faint', 0); tween(1, (k) => { by.mom.arg = k; }, easeIn);
  setFace(by.officiant, 'officiant_shock'); by.officiant.setMode('panic');
  by.bridesmaid.setMode('panic');
  // the baby's parent picks up the (still screaming) baby and leaves, briskly
  bm.c.root.position.y = 0; bm.setMode('cradle', 1);
  bm.path([[0.9, -9], [-2.6, 2], [-2.6, 16]], { speed: 1.8 }); // west of the kids' table, out the gate
  wait(0.5).then(() => bubble(bm, 'That\'s it. Kevin and I are going HOME.', 2.2));
  // the victim runs to "protect the children", out on the open lawn by their table
  victim.target = null; victim.setMode('panicRun');
  victim.walkTo(RIOT.x, RIOT.z, { run: true, speed: 3.2 });
  wait(0.3).then(() => bubble(victim, 'The CHILDREN! Someone protect the children!', 2.2));
  const panicUpd = () => {
    for (const n of panicking) if (!n.target && n.mode === 'panicRun') n.walkTo(rand(-8, 8), rand(-15, 0), { run: true, speed: rand(3, 4.5) });
  };
  upd.push(panicUpd);
  cine.set(V(-3, 2.6, -8.5), V(-3, 0.8, -15));
  await wait(1.2);
  snap('Things heating up');
  await wait(1.0);
  // ------ the kids' table does not panic
  cine.set(V(K.x - 2.4, 1.3, K.z + 2.6), V(K.x, 0.55, K.z));
  kids.forEach((k) => setFace(k, k.c.faceName + '_savage'));
  AU.scream(4, 1.9);
  bubble(kids[1], 'THE GROWN-UPS ARE DISTRACTED. NOW!!!', 2.2);
  await wait(1.4);
  const [stabber, chief, grabL, grabR] = kids; // Timmy (the one who yelled NOW) is the chief
  kids.forEach((k) => {
    if (k.collider) k.collider.off = true;
    k.setMode('kidStab');
    k.walkTo(RIOT.x + rand(-0.5, 0.5), RIOT.z + rand(-0.5, 0.5), { run: true, speed: 3.8 });
  });
  victim.target = null; victim.place(RIOT.x, RIOT.z, 0.9); victim.setMode('idle'); // (arrived, whatever the frame rate)
  cine.set(V(RIOT.x + 3.4, 1.5, RIOT.z + 2.4), V(RIOT.x - 0.3, 0.8, RIOT.z - 0.4));
  bubble(victim, 'Aww, the little ones want a hug— WAIT—', 2.2);
  await wait(1.6);
  // TIMBER: they take the legs out, the victim goes down flat on their back
  kids.forEach((k) => { k.target = null; });
  victim.setMode('faint', 0);
  tween(0.45, (k) => { victim.arg = k; }, easeIn).then(() => { AU.thud(); fx.shake(0.06, 0.3); });
  victim.custom = (n, t) => { // flailing
    n.c.r('ArmL', Math.sin(t * 11) * 0.5, 0, Math.sin(t * 7) * 0.4 * n.arg);
    n.c.r('ArmR', Math.sin(t * 9 + 1) * 0.5, 0, Math.sin(t * 8) * 0.4 * n.arg);
  };
  // lying on their back: in victim-local space the feet point to +z, the chest is at about z = -0.35
  const pinned = [[grabL, 0.16, 0.95, Math.PI, 'kidGrab'], [grabR, -0.16, 1.1, Math.PI, 'kidGrab'], [stabber, 0.62, -0.25, -Math.PI / 2, 'kidStab']]; // [kid, x, z, heading offset, mode]
  pinned.forEach(([k, , , , m]) => k.setMode(m, 1));
  chief.setMode('kidRally');
  const RALLY = [
    'FOR THE KIDS\' TABLE!!!', 'NO BEDTIME! NO MERCY!', 'WHO WANTS CAKE?!', 'THE GROWN-UP HAS FALLEN! WE RULE NOW!',
    'NO VEGETABLES! EVER AGAIN!', 'TODAY WE STAY UP PAST NINE!', 'GIVE US THE PONY AND NOBODY GETS FORKED!',
  ];
  const CHANTS = ['YEAAAAH!!!', 'CAKE! CAKE! CAKE!', 'NO BEDTIME!!', 'CHAAAARGE!', '*war cry*', 'PONY! PONY! PONY!'];
  const PLEAS = ['I YIELD! I YIELD!', 'Is ANYONE\'s mother here?!', 'That is a SPORK! That is a SPORK!', 'I\'ll get you a pony! I\'ll get you TWO ponies!'];
  let rallyT = 0.6, ri = Math.floor(rand(0, RALLY.length)), plead = 0;
  const riotUpd = (dt) => {
    const vp = victim.pos, h = victim.heading, cs = Math.cos(h), sn = Math.sin(h);
    const at = (x, z) => [vp.x + x * cs + z * sn, vp.z - x * sn + z * cs]; // victim-local -> world
    for (const [k, x, z, dh] of pinned) { const [wx, wz] = at(x, z); k.pos.x = wx; k.pos.z = wz; k.setHeading(h + dh); }
    // the chief stands on the victim's chest, facing the troops at the feet
    const [cx, cz] = at(0, -0.35); chief.pos.set(cx, 0.24 * victim.arg, cz); chief.setHeading(h);
    if ((rallyT -= dt) <= 0) {
      rallyT = 3.2;
      bubble(chief, RALLY[ri++ % RALLY.length], 2.2);
      AU.babble('FOR THE KIDS TABLE', chief.voice, 1.5);
      wait(1.0).then(() => { if (!upd.includes(riotUpd)) return; for (const k of [stabber, grabL, grabR]) bubble(k, pick(CHANTS), 1.4); AU.scream(3, 2.1); });
      if (++plead % 2 === 0) wait(2.1).then(() => { if (upd.includes(riotUpd)) bubble(victim, pick(PLEAS), 1.4); });
    }
  };
  upd.push(riotUpd);
  { // from the victim's side (the stabber works the other side), so the pile-up reads left to right
    const h = victim.heading, cs = Math.cos(h), sn = Math.sin(h), vp = victim.pos;
    const at = (x, z, y) => V(vp.x + x * cs + z * sn, y, vp.z - x * sn + z * cs);
    cine.set(at(-3.1, 0.3, 1.35), at(0, 0.2, 0.7));
  }
  bill('kids');
  await wait(4.2);
  snap('The kids\' table');
  // player's heroic attempt
  cine.set(V(-2.2, 1.9, -15.6), V(-5.5, 0.9, -19.7));
  groom.walkTo(-3.2, -18.6, { run: true, speed: 4 });
  const q3 = await qte('Blow out the fire! MASH E!', 3.2, { mash: true });
  G.stats.mash = q3.count;
  groom.setMode('panic');
  if (q3.count > 0) {
    fires.forEach((f) => (f.i += q3.count * 0.05));
    fireFront = Math.min(1, fireFront + q3.count * 0.02);
    fx.shake(Math.min(0.3, 0.015 * q3.count), 1.4);
    fx.sparks(V(-4.2, T.h + 0.3, T.z), Math.min(80, q3.count * 4), 3);
    bill('breath', `Fire accelerant: your breath (${q3.count} puffs)`, Math.min(40, q3.count) * 15);
    ui.say('', `You are fanning it. Fire intensity +${q3.count * 25}%.`, 2.6);
    if (q3.count >= 12) ui.toast('ACHIEVEMENT', 'Fanning the Flames: mashed E like your marriage depended on it');
  } else {
    ui.say('', 'You bravely do nothing. Honestly, the right call.', 2.6);
  }
  bill('cloth'); integ(30);
  await tween(3, (k) => { fireFront = Math.max(fireFront, 0.2 + k * 0.6); }, linear);
  cine.set(V(-8.8, 1.5, -16.9), V(-9.9, 1.0, -19.9));
  await say(by.mom.mode === 'faint' ? by.grandma : by.mom, 'THE CAKE!!!', 1.8, 1.3);

  // ================================================= BEAT 7 — the dog
  beat(7, 'Who Let The Dog Out');
  const dog = by.dog;
  dog.state = 'run'; dog.wag = 2;
  const dp = dog.root.position;
  if (F.leashed) {
    // he's still tied to his bed. The bed is coming too.
    const bed = W.dogBed;
    upd.push(() => {
      const dx = bed.position.x - dp.x, dz = bed.position.z - dp.z, d = Math.hypot(dx, dz);
      if (d > 1.3) { bed.position.x = dp.x + dx / d * 1.3; bed.position.z = dp.z + dz / d * 1.3; bed.rotation.y += 0.08; }
    });
    bubble(dog, '*brings his bed along*', 1.6);
  }
  await tweenMove(dog, V(L.cake.x - 0.2, 0, L.cake.z + 0.8), 0.6);
  // leap onto the table
  AU.bark(1.2);
  await tween(0.35, (k) => { dp.y = Math.sin(k * Math.PI) * 0.9 + k * 0.1; dp.z = lerp(L.cake.z + 0.8, L.cake.z + 0.45, k); }, linear);
  AU.chomp();
  const cake = W.cake;
  dog.mouth.add(cake);
  cake.position.set(0, -0.15, 0.2); cake.rotation.set(0, 0, 0); cake.scale.setScalar(0.7);
  await tween(0.35, (k) => { dp.y = Math.sin((1 - k) * Math.PI * 0.5) * 0.4 * (1 - k); dp.z = lerp(L.cake.z + 0.45, L.cake.z + 1.4, k); }, linear);
  dp.y = 0;
  fireFront = 1;
  bill('cake'); integ(20);
  bubble(dog, '*heroically rescues cake from fire*', 2.2);
  // laps around the dance floor
  cine.track(dog.root, V(3.5, 3.2, 5.5), V(0, 0.6, 0), 2.5);
  const lapPts = [];
  const cx = L.dance.x, cz = L.dance.z;
  lapPts.push([-8, -12], [-6, -2], [cx - 5, cz - 4]);
  for (let i = 0; i <= 24; i++) { const a = -Math.PI * 0.75 + (i / 12) * Math.PI * 2; lapPts.push([cx + Math.cos(a) * 5.2, cz + Math.sin(a) * 5.2]); }
  for (const [x, z] of lapPts) await tweenMove(dog, V(x, 0, z), 7.5);
  bubble(dog, 'Victory lap!', 1.4);
  // … and finds Uncle Frank
  const un = by.uncle;
  cine.set(V(un.pos.x + 2.4, 1.4, un.pos.z + 2.2), V(un.pos.x, 0.7, un.pos.z));
  if (un.c.glass) un.c.glass.visible = false;
  if (F.leashed) {
    // Biscuit runs past; the dog bed on the end of the leash does not
    await tweenMove(dog, V(un.pos.x + 1.0, 0, un.pos.z + 1.1), 7);
    await tweenMove(dog, V(un.pos.x - 1.6, 0, un.pos.z - 1.4), 7);
    AU.thud(); AU.boing(); fx.shake(0.1, 0.4);
    setFace(un, 'uncle_pain');
    un.setMode('faint', 0); tween(0.4, (k) => { un.arg = k; }, easeIn);
    await say(un, 'MY BACK!!! …the leg\'s fine, though. Thanks for asking.', 2.4, 0.75);
    snap('Hit by a flying dog bed');
    bill('leg'); bill('bed');
  } else {
    await tweenMove(dog, V(un.pos.x + 0.25, 0, un.pos.z + 0.55), 6);
    dog.root.rotation.y = Math.atan2(un.pos.x - dp.x, un.pos.z - dp.z);
    dog.state = 'bite'; AU.growl(); AU.chomp();
    setFace(un, 'uncle_pain');
    un.setMode('hop');
    await say(un, 'NOT THE GOOD ONE!!!', 2.0, 0.75);
    snap('Not the good one');
    bill('leg');
  }
  integ(10);
  // the speech the groom helped write, delivered at the worst possible moment
  if (G.speech) {
    await say(un, 'Since I\'m up… A FEW WORDS FOR THE HAPPY COUPLE!', 2.2, 0.75);
    for (const line of G.speech) await say(un, line, Math.max(2.2, line.length * 0.055), 0.75);
  }
  dog.state = 'run';
  const dogUpd = (dt) => { if (dog.state === 'bite') dog.root.position.x += Math.sin(clock.t * 30) * 0.004; };
  upd.push(dogUpd);
  tweenMove(dog, V(-2, 0, 13), 6).then(() => { dog.state = 'sit'; });
  await wait(1.2);

  // ================================================= BEAT 8 — the ex
  beat(8, 'Plus One');
  const bike = P.motorbike();
  bike.position.set(0, 0, 46); bike.rotation.y = Math.PI;
  W.root.add(bike);
  const head = new THREE.SpotLight(0xfff2c0, 40, 30, 0.45, 0.5, 1.2);
  head.position.set(0, 1.0, 0.8); head.target.position.set(0, 0, 8);
  bike.add(head, head.target);
  const ex = by.ex;
  ex.c.root.visible = true;
  bike.add(ex.c.root);
  ex.c.root.position.set(0, -0.12, -0.2); ex.c.root.rotation.set(0, 0, 0);
  ex.setMode('ride');
  AU.motorLoop(true, 0.2);
  cine.set(V(1.5, 1.5, 17), V(0, 1.2, 30));
  const bikeUpd = (dt) => { bike.userData.wheels.forEach((w) => (w.rotation.x += dt * 20)); };
  upd.push(bikeUpd);
  await wait(0.8);
  AU.motorLoop(true, 1);
  await tween(2.6, (k) => { bike.position.z = lerp(46, 12, k); }, linear);
  AU.skid();
  cine.set(V(-2.8, 1.6, 0.2), V(0.3, 1.2, -2.8));
  await tween(1.2, (k) => { bike.position.z = lerp(12, -1.6, k); bike.position.x = lerp(0, 1.1, k); bike.rotation.y = Math.PI + Math.sin(k * Math.PI) * 0.5; }, easeOut);
  AU.motorLoop(true, 0.1);
  bill('tires'); integ(6);
  setFace(ex, 'ex_wink');
  await say(ex, `Hey, ${names.bride}. Heard things got… heated.`, 2.8, 0.8);
  // she never made it to the altar: halfway down the aisle, she turns around
  cine.set(V(-1.4, 1.7, BRIDE_Z + 2.3), V(0.2, 1.5, BRIDE_Z));
  by.bride.faceTo(bike.position.x, bike.position.z);
  await wait(0.8);
  by.bride.setHeading(Math.PI); await wait(0.9); // looks at the burning altar…
  by.bride.faceTo(bike.position.x, bike.position.z);
  setFace(by.bride, 'bride_love');
  await say(by.bride, '…Is that a new bike?', 2.2, 1.5);
  // …and runs back down it
  const toBike = by.bride.walkTo(bike.position.x - 0.7, bike.position.z + 0.7, { run: true, speed: 4.2 });
  // groom's last stand
  cine.set(V(0, 2.4, 3.5), V(0, 1, -10));
  groom.setMode('idle'); groom.place(0.2, BRIDE_Z - 2.4, 0);
  if (G.stats.clues && G.stats.clues.size >= 3) bubble(groom, 'A helmet. A card. The guestbook. I CALLED it.', 2.4);
  const q4 = qte('STOP HER!', 1.8);
  // bride hops on
  await Promise.race([toBike, wait(2.8)]);
  by.bride.target = null;
  bike.add(by.bride.c.root);
  by.bride.c.root.position.set(0, -0.02, -0.72); by.bride.c.root.rotation.set(0, 0, 0);
  by.bride.setMode('ride');
  if (by.bride.collider) by.bride.collider.off = true;
  wait(0.3).then(() => snap('Plus one'));
  const r4 = await q4;
  if (r4.pressed) {
    groom.walkTo(0.3, -2.4, { run: true, speed: 4.5 });
    await wait(0.9);
    groom.target = null;
    AU.boing(); AU.thud();
    groom.setMode('faint', 0);
    tween(0.5, (k) => { groom.arg = k; }, easeIn);
    ui.say('', 'You trip over chair #37.', 2.2);
    bill('chair', 'Chair #37 (tripped over, heroically)', 45);
  } else {
    await ui.say('', 'You stand there. Frozen. Covered in champagne.', 2.4);
  }
  AU.motorLoop(true, 1);
  bubble(ex, 'Later, loser!', 1.6);
  // bouquet toss
  const bq = P.bouquet();
  const b0p = new THREE.Vector3(); by.bride.c.bouquet.getWorldPosition(b0p);
  by.bride.c.bouquet.visible = false;
  W.root.add(bq); bq.position.copy(b0p);
  const gp = groom.pos.clone().add(V(0, 0.4, 0));
  tween(1.4, (k) => { bq.position.lerpVectors(b0p, gp, k); bq.position.y += Math.sin(k * Math.PI) * 3; bq.rotation.x += 0.3; }, linear).then(() => { AU.thud(); });
  await tween(2.6, (k) => { bike.position.z = lerp(-1.6, 30, easeIn(k)); bike.position.x = lerp(1.1, 0, k); bike.rotation.y = lerp(Math.PI * 1.15, 0, Math.min(1, k * 4)); }, linear);
  AU.motorLoop(false);
  integ(0);
  if (F.rings) {
    // one last grand gesture
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.015, 6, 14), new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.9, roughness: 0.2 }));
    W.root.add(ring);
    const r0 = groom.pos.clone().add(V(0, 1.4, 0)), r1 = V(0, 1.2, 20);
    cine.set(V(1.4, 1.8, -6.5), V(0, 1.2, 4));
    AU.whoosh();
    await tween(1.2, (k) => { ring.position.lerpVectors(r0, r1, k); ring.position.y += Math.sin(k * Math.PI) * 3; ring.rotation.x += 0.4; }, linear);
    ring.visible = false;
    await ui.say('', 'You hurl a wedding ring after the bike. Chad catches it. Without looking.', 2.8);
  }
  await wait(0.6);

  // ================================================= FINALE — sprinklers
  ui.beat('', 'Happily Ever After?', 3.5);
  AU.sadTrombone();
  await wait(2.0);
  // sprinklers pop up
  AU.sprinklerLoop(true);
  bill('sprinklers');
  const heads = [[-6, -17], [-2, -12], [3, -12], [-7, -9], [6, -6], [-4, -4], [4, 2], [-5, 8], [5, 10]];
  const sprUpd = (dt) => {
    for (const [x, z] of heads) fx.spray(V(x, 0.3, z), 2);
    fx.rain(V(0, 0, -8), 14, 10);
    fires.forEach((f) => (f.i = Math.max(0, f.i - dt * 0.35)));
    skirtFires.forEach((f) => (f.i = Math.max(0, f.i - dt * 0.35)));
  };
  upd.splice(upd.indexOf(fireUpd), 1);
  upd.push(sprUpd);
  AU.fireLoop(0.4);
  cine.set(V(-3, 3, -6), V(-5, 0.8, -18));
  await ui.say('', 'The fire alarm finally triggers the sprinklers.', 2.6);
  AU.fireLoop(0); AU.babyCry(0);
  upd.splice(upd.indexOf(riotUpd), 1);
  panicking.forEach((n) => { n.target = null; n.setMode('idle'); });
  upd.splice(upd.indexOf(panicUpd), 1);
  for (const n of panicking) n.setMode(pick(['idle', 'idle', 'panic']));
  // final scene: most guests have fled; the groom sits alone on the dance floor
  for (const n of panicking) { n.c.root.visible = false; if (n.collider) n.collider.off = true; }
  [by.dj, by.officiant, by.flutist, by.bridesmaid, bm, victim, ...kids].forEach((n) => { n.target = null; n.c.root.visible = false; if (n.collider) n.collider.off = true; });
  groom.target = null;
  groom.place(0, 4.6, 0).setMode('sit');
  setFace(groom, 'groom_cry');
  groom.c.bouquet = groom.c.attach('Chest', P.bouquet(), V(0, -0.34, 0.32));
  bq.visible = false;
  groom.custom = (n, t) => { n.c.hipY -= 0.38; n.c.r('ArmL', -0.7, 0, 0.35); n.c.r('ForearmL', 0, -1.2, 0); n.c.r('ArmR', -0.7, 0, -0.35); n.c.r('ForearmR', 0, 1.2, 0); n.c.r('Head', 0.25, 0, 0); };
  dog.root.position.set(4.5, 0, 8.5);
  cine.set(V(-1.2, 1.25, 7.3), V(0.3, 0.65, 4.8));
  const sadLight = new THREE.PointLight(0xaab8ff, 5, 8, 1.2); sadLight.position.set(0.5, 3.2, 5.5); W.root.add(sadLight);
  await wait(1.5);
  const petted = G.stats.pets > 0;
  const dogHasCake = cake.parent === dog.mouth;
  G.dogHasCake = dogHasCake;
  const E = G.endingInfo();
  snap('Happily ever after?');
  dog.state = 'walk';
  await tweenMove(dog, V(1.05, 0, 5.0), 2.2);
  dog.root.rotation.y = Math.atan2(groom.pos.x - dp.x, groom.pos.z - dp.z);
  if (petted && dogHasCake) {
    // he brings you the cake
    W.root.attach(cake);
    await tween(0.5, (k) => { cake.position.y = lerp(cake.position.y, 0.0, k); }, easeOut);
    cake.position.set(0.3, 0.06, 5.45); cake.rotation.set(0, 0, 0);
    dog.state = 'sit'; dog.wag = 2.5; AU.bark(1.3);
    fx.hearts(V(0.5, 1.2, 5.2), 8);
    setFace(groom, 'groom');
    bubble(dog, '*drops the cake at your feet*', 2.4);
    await wait(1.8);
    await ui.say('', E.line, 4.2);
  } else {
    dog.state = 'sit'; dog.wag = 2;
    if (dogHasCake) { W.root.attach(cake); cake.position.set(1.3, 0.06, 5.6); cake.rotation.set(0, 0, 0); }
    AU.chomp(); await wait(0.4); AU.chomp();
    bubble(dog, '*eats the entire cake in front of you, maintaining eye contact*', 3);
    await wait(1.8);
    await ui.say('', E.line, 4.2);
  }
  if (F.rings) { bubble(groom, 'At least I still have one ring. That\'s… rent.', 3); await wait(2.4); }
  else if (G.stats.punch >= 3) { bubble(groom, 'Honestly? Best wedding ever. *hic*', 3); await wait(2.4); }
  bill('grief'); bill('flute'); if (F.rings) bill('rings');
  ui.letterbox(false);
  await wait(1.6);
  AU.sprinklerLoop(false);
  AU.applause(3, 50);
  G.cascadeUpdate = null;
}

function scene(G) { return G.world.scene; }
// where the kids' table ambushes its victim: open lawn beside the table, clear of the panicking crowd
const RIOT = { x: L.kids.x + 0.4, z: L.kids.z + 2.6 };

// move the dog in a straight line at speed (m/s)
function tweenMove(dog, to, speed) {
  const p = dog.root.position, from = p.clone();
  const d = from.distanceTo(to);
  dog.root.rotation.y = Math.atan2(to.x - from.x, to.z - from.z);
  dog.state = speed > 4 ? 'run' : 'walk';
  return tween(Math.max(0.05, d / speed), (k) => { p.lerpVectors(from, to, k); }, linear);
}
