// Things that survive a reload: achievements, endings found, runs finished, player settings.
// Everything is wrapped in try/catch: private windows / blocked storage just mean nothing is remembered.

export const ACH = [
  { id: 'goodboy', name: 'Good Boy Enthusiast', desc: 'pet Biscuit 5 times' },
  { id: 'soulmate', name: 'Soulmate Found', desc: 'pet the dog' },
  { id: 'openbar', name: 'Open Bar', desc: '3 cups of "juice"' },
  { id: 'badluck', name: 'Bad Luck', desc: 'tried to see the bride' },
  { id: 'customs', name: 'Customs Officer', desc: 'shook every gift' },
  { id: 'social', name: 'Social Butterfly', desc: 'talked to 10 guests' },
  { id: 'paparazzi', name: 'Paparazzi Magnet', desc: 'photographed 3 times' },
  { id: 'poser', name: 'Strike a Pose', desc: 'posed for Zoe' },
  { id: 'safety', name: 'Safety Third', desc: 'inspected the power strip' },
  { id: 'tape', name: 'Duct Tape Engineer', desc: 'taped the power strip' },
  { id: 'engineer', name: 'Structural Engineer', desc: 'the arch wobbled' },
  { id: 'kazoo', name: 'Sticky Fingers', desc: 'swiped the flute' },
  { id: 'leash', name: 'Leash Law', desc: 'tied Biscuit to his bed' },
  { id: 'rings', name: 'Lord of the Rings', desc: 'found the wedding rings' },
  { id: 'clues', name: 'Saw It Coming', desc: 'found all three clues about Chad' },
  { id: 'speech', name: 'Ghostwriter', desc: 'wrote Uncle Frank\'s speech' },
  { id: 'ficus', name: 'Ficus Liberation Front', desc: 'moved Frank away from the ficus' },
  { id: 'dance', name: 'Dance Machine', desc: 'scored 6+ in the dance-off' },
  { id: 'mom', name: 'Mom Approved', desc: 'finished the whole checklist' },
  { id: 'speedrun', name: 'Speedrun to Disaster', desc: 'cued the flutist within 45 s' },
  { id: 'fanning', name: 'Fanning the Flames', desc: 'mashed E 12+ times at the fire' },
];

export const ENDINGS = {
  dog_sober: 'Man\'s Best Friend',
  dog_drunk: 'Best Wedding Ever *hic*',
  dog_rings: 'Pawn Stars',
  nodog_sober: 'Biscuit\'s Best Day',
  nodog_drunk: 'Open Bar, Closed Heart',
  nodog_rings: 'Ring-a-Ding Dumped',
};

const KEY = 'wg_progress', SKEY = 'wg_settings';
const read = (k, def) => { try { return { ...def, ...JSON.parse(localStorage.getItem(k) || '{}') }; } catch (e) { return { ...def }; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* not remembered */ } };

const P = read(KEY, { ach: [], endings: [], runs: 0 });

export const progress = {
  hasAch: (id) => P.ach.includes(id),
  // true when this is the first time ever
  unlock(id) { if (P.ach.includes(id)) return false; P.ach.push(id); write(KEY, P); return true; },
  ending(id) { if (P.endings.includes(id)) return false; P.endings.push(id); write(KEY, P); return true; },
  finishRun() { P.runs++; write(KEY, P); },
  get runs() { return P.runs; },
  get achCount() { return P.ach.filter((id) => ACH.some((a) => a.id === id)).length; },
  get endingCount() { return P.endings.filter((id) => ENDINGS[id]).length; },
};

export const settings = read(SKEY, { calm: false, sens: 1, invertY: false, bigSubs: false, marker: true });
export const saveSettings = () => write(SKEY, settings);
