// Spawns every character in the venue, dresses them and gives them something to say.
import * as THREE from 'three';
import { Character } from './rig.js';
import { NPC } from './npc.js';
import { face } from './faces.js';
import { L } from './layout.js';
import * as P from './props.js';
import { pick, rand } from './util.js';

const SKIN = [0xf2c6a0, 0xe8b48a, 0xc68a5a, 0x8d5a3a, 0xf7d7c0, 0xa86f48];
const SUITS = [0x2b3a55, 0x555a60, 0xc2a882, 0x6b1f2a, 0x1f3d2b, 0x3a3a3a, 0x7a8aa0];
const TIES = [0xb00020, 0x224488, 0xd4af37, 0x6a1b9a, 0x111111, 0xff8fb1];
const DRESSES = [0xe8a0b8, 0x9fc5e8, 0xb4a7d6, 0xffe599, 0xa2d9a0, 0xf4b183, 0x76a5af, 0xd5a6bd, 0xea9999];

export function suit(color = pick(SUITS), { tie = pick(TIES), skin = pick(SKIN), shirt = 0xffffff, shoes = 0x1a1a1a } = {}) {
  return { skin, top: color, sleeves: color, pants: color, shoes, shirt, tie };
}
export function dressOutfit(color = pick(DRESSES), { skin = pick(SKIN), sleeves = null } = {}) {
  return { skin, top: color, sleeves: sleeves ?? skin, pants: skin, hips: color, shoes: 0x333333 };
}

function lady(faceName, len = 0.75, opts = {}) {
  const col = pick(DRESSES);
  const ch = make(dressOutfit(col), faceName, opts);
  ch.attach('Pelvis', P.skirt(col, { len, flare: 0.2 + len * 0.1 }), new THREE.Vector3(0, 0.08, 0));
  return ch;
}

function make(outfit, faceName, opts = {}) {
  const ch = new Character({ outfit, face: face(faceName), faceSize: opts.faceSize ?? 0.5, height: opts.height ?? 1, name: opts.name });
  ch.faceName = faceName;
  return ch;
}

const MEN = ['guest1', 'guest3', 'guest4', 'guest6', 'guest7', 'guest9'];
const WOMEN = ['guest2', 'guest5', 'guest8', 'guest10', 'bridesmaid'];
const NAMES_M = ['Kevin', 'Gary', 'Cousin Todd', 'Mr. Pemberton', 'Brad', 'Nigel', 'Dave from Accounting', 'Carlos', 'Sven', 'Great-uncle Bertrand'];
const NAMES_F = ['Karen', 'Aunt Linda', 'Priya', 'Mildred', 'Stacy', 'Beatrice', 'Sophie', 'Fatima', 'Jolene'];

// generic guest lines (Act I). {G} = groom name, {B} = bride name
const GUEST_LINES = [
  'Congratulations! I give it... oh, you can hear me.',
  'Is it true the flutist is the bride\'s cousin? He\'s been "warming up" for three hours.',
  'The punch tastes like regret and pineapple.',
  'I RSVP\'d "maybe" and they still gave me a chair. Classy.',
  'You look nervous, {G}. Is that a sweat stain or a design choice?',
  'Lovely venue. I got lost twice finding the bathroom. It\'s a hedge.',
  'I brought a toaster. Everybody brings a toaster. It\'s a toaster wedding.',
  'Have you seen the champagne tower? Thirty glasses! I\'m going to need at least four.',
  'Don\'t tell {B}, but I\'m only here for the cake.',
  'My horoscope said I\'d meet someone special today. It\'s you. You\'re taken. Typical.',
  'Is the vegetarian option just the bread? It\'s always just the bread.',
  'The DJ asked me for requests. I said "silence". He laughed. I wasn\'t joking.',
  'I\'ve been to six weddings this year. I\'m running out of dresses. And friends.',
  'Did you know doves are just white pigeons? Think about that.',
  'I\'m not crying, it\'s allergies. I\'m allergic to commitment.',
  'I timed the speeches at the rehearsal dinner. Forty minutes. FORTY.',
  'Beautiful day for it! Not a cloud. I wore my good sunscreen and everything.',
  '{B} looks radiant, apparently. We\'re not allowed to look. Bad luck or something.',
  'My horoscope said "beware of large lizards" today. At a wedding? Weird.',
  'The venue has a weird rule: no loud noises after sunset. "Or they wake up." Who\'s they?',
];

export function createCast(scene, world) {
  const npcs = [];
  const by = {};
  const add = (npc, role) => { scene.add(npc.c.root); npcs.push(npc); if (role) by[role] = npc; npc.role = role || npc.role; return npc; };
  const chest = (ch, obj, off) => ch.attach('Chest', obj, off);

  // --- bride ---
  const bride = make({ skin: 0xf2c6a0, top: 0xffffff, sleeves: 0xf2c6a0, pants: 0xffffff, shoes: 0xffffff }, 'bride', { name: 'Bride', faceSize: 0.52 });
  bride.attach('Pelvis', P.weddingDress(), new THREE.Vector3(0, 0.08, 0));
  bride.attach('Head', P.veil(), new THREE.Vector3(0, 0.22, -0.04));
  bride.bouquet = chest(bride, P.bouquet(), new THREE.Vector3(0, -0.32, 0.3));
  const nb = add(new NPC(bride, { name: 'Bride', voice: 1.5 }), 'bride').place(L.tent.x + 0.6, L.tent.z + 0.2, -Math.PI / 2).setMode('bouquet');
  nb.lines = ['({G}? Is that you? DON\'T come in! It\'s bad luck!)'];

  // --- mother of the bride ---
  const mom = make(dressOutfit(0x8e5ea2, { sleeves: 0x8e5ea2 }), 'mom', { name: 'Mother of the Bride', faceSize: 0.6 });
  mom.attach('Pelvis', P.skirt(0x8e5ea2, { len: 0.9, flare: 0.3 }), new THREE.Vector3(0, 0.08, 0));
  add(new NPC(mom, { name: 'Mother of the Bride', voice: 1.25 }), 'mom').place(L.tent.x - 0.4, L.tent.z + 1.2, 2.2).setMode('talk');
  by.mom.lines = [
    'Oh, {G}! Did you finish the checklist I gave you? Every item. EVERY. ITEM.',
    'I\'m not saying {B} could have done better. I\'m just not saying she couldn\'t.',
    'The ceremony starts when the flutist plays the processional. Go tell him when you\'re ready, dear.',
  ];

  // --- bridesmaid guarding the tent ---
  const bm = make(dressOutfit(0xe8a0b8), 'bridesmaid', { name: 'Bridesmaid' });
  bm.attach('Pelvis', P.skirt(0xe8a0b8, { len: 0.8, flare: 0.28 }), new THREE.Vector3(0, 0.08, 0));
  add(new NPC(bm, { name: 'Bridesmaid Jess', voice: 1.4 }), 'bridesmaid').place(L.tent.x - L.tent.r - 0.5, L.tent.z, -Math.PI / 2).setMode('idle');
  by.bridesmaid.lines = [
    'Nope. No. Absolutely not. You can\'t see the bride before the ceremony!',
    'I don\'t care that you "just want to say hi". Seven years bad luck. I read it on a candle.',
    'Go pet the dog or something. Shoo.',
  ];

  // --- officiant ---
  const off = make({ skin: 0xf0c8a8, top: 0x111111, sleeves: 0x111111, pants: 0x111111, shoes: 0x111111, shirt: 0x111111, tie: 0xffffff }, 'officiant', { name: 'Father Gregory' });
  off.attach('Pelvis', P.skirt(0x111111, { len: 0.95, flare: 0.28 }), new THREE.Vector3(0, 0.08, 0));
  chest(off, P.bible(), new THREE.Vector3(0, -0.2, 0.3));
  add(new NPC(off, { name: 'Father Gregory', voice: 0.7 }), 'officiant').place(L.officiant.x, L.officiant.z, 0).setMode('idle');
  by.officiant.custom = (n, t) => { n.c.r('ArmL', -0.7, 0, 0.3); n.c.r('ForearmL', 0, -1.0, 0); n.c.r('ArmR', -0.7, 0, -0.3); n.c.r('ForearmR', 0, 1.0, 0); };
  by.officiant.lines = [
    'Ah, the groom. I have officiated 412 weddings. I remember none of them. It\'s a gift.',
    'When you are ready, cue the flutist. He insists on playing the processional. I could not stop him. I tried. God tried.',
    'Do you have the rings? Never mind, nobody ever has the rings.',
  ];

  // --- flutist ---
  const fl = make(suit(0x8a6a3a, { tie: 0x2e7d32, skin: 0xf0c8a8, shirt: 0xf5e6c8 }), 'flutist', { name: 'Cousin Reginald', faceSize: 0.58 });
  fl.flute = fl.attach('Head', P.fluteProp(), new THREE.Vector3(-0.3, -0.03, 0.16));
  add(new NPC(fl, { name: 'Cousin Reginald', voice: 0.9 }), 'flutist').place(L.flutist.x, L.flutist.z, 0.15).setMode('fluteIdle');

  // --- DJ ---
  const dj = make({ skin: 0xc68a5a, top: 0x1a1a1a, sleeves: 0x1a1a1a, pants: 0x2b3a55, shoes: 0xffffff, shirt: 0x39ff14, tie: 0x1a1a1a }, 'dj', { name: 'DJ Sick Beatz' });
  add(new NPC(dj, { name: 'DJ Sick Beatz', voice: 0.85 }), 'dj').place(L.dj.x, L.dj.z, 0).setMode('dj');
  by.dj.lines = [
    'Yo yo yo! DJ Sick Beatz in the house! Well, in the garden.',
    'Taking requests! Unless it\'s the Macarena. The Macarena and I are not on speaking terms.',
    'Your cousin with the flute asked me to "add reverb to his soul". I don\'t know what that means, bro.',
  ];

  // --- uncle (the dog's future victim) ---
  const unc = make({ skin: 0xf0b890, top: 0xff6f3c, sleeves: 0x3fb8af, pants: 0xe6d3a3, shoes: 0x6b4a2f, shirt: 0xffe066, tie: 0x3fb8af }, 'uncle', { name: 'Uncle Frank', faceSize: 0.56 });
  unc.glass = unc.attach('HandR', P.glassProp(0xd0104c), new THREE.Vector3(-0.05, 0, 0.04));
  add(new NPC(unc, { name: 'Uncle Frank', voice: 0.75 }), 'uncle').place(L.uncle.x, L.uncle.z, -2.4).setMode('drink');
  by.uncle.lines = [
    '{G}! My boy! See this left leg? Titanium knee. Cost more than this wedding!',
    'I\'ve got a speech ready. Twelve pages. Don\'t worry, it\'s double-spaced.',
    'Your mother seated me next to the ficus. Again. Me and that ficus go way back.',
  ];

  // --- grandma, front row ---
  const gm = make(dressOutfit(0x9fc5e8, { skin: 0xf0d0b8, sleeves: 0x9fc5e8 }), 'grandma', { name: 'Grandma Edna', height: 0.9, faceSize: 0.5 });
  gm.attach('Pelvis', P.skirt(0x9fc5e8, { len: 0.8, flare: 0.27 }), new THREE.Vector3(0, 0.08, 0));
  const gchair = world.chairs.find((c) => c.row === 0 && c.side === -1 && Math.abs(c.x + 1.25) < 0.01);
  gchair.taken = true;
  add(new NPC(gm, { name: 'Grandma Edna', voice: 1.2 }), 'grandma').place(gchair.x, gchair.z, Math.PI).setMode('sit');
  by.grandma.lines = [
    'Is this the funeral? No? Oh. I wore black for nothing, then.',
    'In my day we got married in a ditch and we were GRATEFUL.',
    'That flute boy played at my 90th birthday. I\'m 91 now. Still recovering.',
  ];

  // --- photographer ---
  const ph = make(dressOutfit(0x333333, { sleeves: 0x333333, skin: 0xe8b48a }), 'photographer', { name: 'Photographer' });
  ph.outfit = { pants: 0x333333 };
  ph.cam = ph.attach('Head', P.camera(), new THREE.Vector3(0, -0.02, 0.2));
  add(new NPC(ph, { name: 'Zoe (Photographer)', voice: 1.3 }), 'photographer').place(-3, 12, 0).setMode('idle');
  by.photographer.lines = [
    'Say "prenup"! ...Too soon?',
    'I charge extra for disasters. Not that there\'ll be one. *adjusts insurance*',
    'Stand still. No, stiller. You look like a hostage. Perfect.',
  ];

  // --- ex (off-stage until the finale) ---
  const ex = make({ skin: 0xe8b48a, top: 0x1a1a1a, sleeves: 0x1a1a1a, pants: 0x223355, shoes: 0x111111, shirt: 0xffffff, tie: 0xffffff }, 'ex', { name: 'Chad (The Ex)' });
  const exN = add(new NPC(ex, { name: 'Chad, the Ex', voice: 0.8, collide: false }), 'ex').place(0, 60, Math.PI).setMode('ride');
  exN.c.root.visible = false;

  // --- dancers ---
  by.dancers = [];
  for (let i = 0; i < 7; i++) {
    const woman = i % 2 === 0;
    const ch = woman ? lady(pick(WOMEN.slice(0, 4)), 0.7) : make(suit(), pick(MEN));
    const a = (i / 7) * Math.PI * 2;
    const n = add(new NPC(ch, { name: woman ? pick(NAMES_F) : pick(NAMES_M), voice: woman ? rand(1.2, 1.5) : rand(0.8, 1) }))
      .place(L.dance.x + Math.cos(a) * rand(1.2, 2.8), L.dance.z + Math.sin(a) * rand(1.2, 2.8), rand(-3, 3)).setMode('dance', i);
    n.lines = [pick(['WOOO! Is this the ceremony? I\'ve been dancing since noon!', 'The DJ only plays one song. I\'ve heard it 46 times. I LOVE IT.', 'Watch this move! It\'s called "The Tax Return"! *collapses gracefully*', 'Come dance, {G}! Or are you saving yourself for the flute solo?'])];
    by.dancers.push(n);
  }

  // --- a guest with a baby, on the aisle (third row) where the camera can see him wake up ---
  const bchair = world.chairs.find((c) => c.row === 2 && c.side === 1 && Math.abs(c.x - 1.25) < 0.01);
  bchair.taken = true;
  const bmom = lady('guest5', 0.55);
  const bundle = P.babyBundle(face('baby'));
  bmom.baby = bmom.attach('Chest', bundle, new THREE.Vector3(0, -0.24, 0.26));
  bmom.babyFace = bundle.userData.face;
  const nbm = add(new NPC(bmom, { name: 'Cousin Megan', voice: 1.3 }), 'babyMom').place(bchair.x, bchair.z, Math.PI).setMode('sitCradle');
  nbm.chair = bchair;
  nbm.lines = [
    'Shhh. Little Kevin JUST fell asleep. Took me three hours and a lullaby playlist.',
    'If that flute man so much as breathes near this baby, {G}, I will end him. Lovingly.',
    'He\'s named Kevin after nobody. We just really liked Kevin.',
  ];

  // --- the kids' table: four angels (for now) ---
  by.kids = [];
  const KIDS = [
    { face: 'kid1', name: 'Lily (6)', girl: true, h: 0.56, col: 0xff8fb1, voice: 1.9 },
    { face: 'kid2', name: 'Timmy (7)', girl: false, h: 0.6, col: 0x4dabf7, voice: 1.75 },
    { face: 'kid3', name: 'Zara (5)', girl: true, h: 0.53, col: 0xffd43b, voice: 2.0 },
    { face: 'kid4', name: 'Oliver (6)', girl: false, h: 0.57, col: 0x51cf66, voice: 1.8 },
  ];
  const KID_LINES = [
    ['Good afternoon, sir. Thank you for inviting us. We promise to be VERY good.', 'I drew you a picture! That\'s you. You\'re the one on fire. …It\'s just a drawing.'],
    ['We made a pact to behave. The pact expires when the grown-ups stop looking.', 'Mom says plastic forks can\'t hurt anybody. She says a lot of things.'],
    ['I\'m being so good. Do good kids get cake first? I\'m asking for all of us.', 'This is my dinosaur. His name is Mr. Chomps. He is also being good.'],
    ['I\'ve had FOUR juice boxes. I feel like I could lift a car.', 'My mom says if I sit still for the whole wedding I get a pony. I\'ve done the math. I will get the pony.'],
  ];
  KIDS.forEach((k, i) => {
    const skin = [0xf7d7c0, 0xf2c6a0, 0x8d5a3a, 0xf2c6a0][i];
    const outfit = k.girl ? { skin, top: k.col, sleeves: skin, pants: skin, shoes: 0xff6f91 } : { skin, top: k.col, sleeves: k.col, pants: 0x3a4a6a, shoes: 0x222222 };
    const ch = make(outfit, k.face, { name: k.name, height: k.h, faceSize: 0.42 });
    if (k.girl) ch.attach('Pelvis', P.skirt(k.col, { len: 0.3, flare: 0.15, top: 0.07 }), new THREE.Vector3(0, 0.05, 0));
    ch.fork = ch.attach('HandR', P.plasticFork([0xff6f91, 0xffd43b, 0x9775fa, 0x4dabf7][i]), new THREE.Vector3(-0.04, 0, 0.03));
    const seat = world.kidSeats[i];
    const n = add(new NPC(ch, { name: k.name, voice: k.voice })).place(seat.x, seat.z, seat.heading).setMode('kidSit', k.h);
    n.kid = k; n.seat = seat;
    n.lines = KID_LINES[i];
    by.kids.push(n);
  });

  // --- seated guests ---
  by.seated = [];
  const free = world.chairs.filter((c) => !c.taken);
  free.sort(() => Math.random() - 0.5);
  for (let i = 0; i < 14; i++) {
    const chair = free[i]; chair.taken = true;
    const woman = Math.random() < 0.5;
    const ch = woman ? lady(pick(WOMEN), 0.55) : make(suit(), pick(MEN));
    const n = add(new NPC(ch, { name: woman ? pick(NAMES_F) : pick(NAMES_M), voice: woman ? rand(1.15, 1.5) : rand(0.75, 1) }))
      .place(chair.x, chair.z, Math.PI).setMode(Math.random() < 0.3 ? 'sitClap' : 'sit');
    n.chair = chair;
    n.lines = [pick(GUEST_LINES)];
    by.seated.push(n);
  }

  // --- chatter pairs ---
  const pairs = [[[-9.5, 4.8], [-8.6, 4.5]], [[-8.3, -9.7], [-9.5, -9.5]], [[-6.9, 12], [-6, 12.9]], [[8.2, 13.2], [7.1, 13.5]], [[-12, -6], [-11.1, -5.3]]];
  by.chatters = [];
  pairs.forEach(([a, b]) => {
    const members = [a, b].map((p, k) => {
      const woman = Math.random() < 0.5;
      const ch = woman ? lady(pick(WOMEN), 0.75) : make(suit(), pick(MEN));
      const n = add(new NPC(ch, { name: woman ? pick(NAMES_F) : pick(NAMES_M), voice: woman ? rand(1.15, 1.5) : rand(0.75, 1) })).place(p[0], p[1], 0);
      n.setMode(k === 0 ? 'talk' : (Math.random() < 0.5 ? 'drink' : 'idle'));
      if (n.mode === 'drink') n.c.attach('HandR', P.glassProp(pick([0xd0104c, 0xf5d36b, 0x7b1e3a])), new THREE.Vector3(-0.05, 0, 0.04));
      n.lines = [pick(GUEST_LINES)];
      return n;
    });
    members[0].faceTo(b[0], b[1]); members[1].faceTo(a[0], a[1]);
    by.chatters.push(members);
  });

  // --- the dog ---
  const dog = new P.Dog();
  dog.root.position.set(L.dogBed.x, 0, L.dogBed.z);
  dog.state = 'sleep';
  scene.add(dog.root);
  by.dog = dog;

  return { npcs, by };
}
