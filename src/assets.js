// Asset URL resolver. In the bundled build (play.html) every asset is inlined
// as a data: URL in window.__ASSETS so the game runs from file:// with no server.
export function asset(path) {
  const inl = (typeof window !== 'undefined' && window.__ASSETS) || null;
  if (inl && inl[path]) return inl[path];
  return path;
}

export const FACE_NAMES = [
  'bride', 'bride_shock', 'groom', 'groom_shock', 'flutist', 'dj', 'dj_shock', 'uncle', 'uncle_pain',
  'grandma', 'officiant', 'photographer', 'ex', 'mom', 'bridesmaid',
  'guest1', 'guest2', 'guest3', 'guest4', 'guest5', 'guest6', 'guest7', 'guest8', 'guest9', 'guest10',
  'kid1', 'kid2', 'kid3', 'kid4', 'baby',
];

// Characters with a generated back-of-head sprite (assets/faces/<name>_back.png). One per character,
// shared by all its expressions; a missing file falls back to the procedural back (faces.js backOf).
export const BACK_NAMES = [
  'bride', 'groom', 'flutist', 'dj', 'uncle', 'grandma', 'officiant', 'photographer', 'ex', 'mom', 'bridesmaid',
  'guest1', 'guest2', 'guest3', 'guest4', 'guest5', 'guest6', 'guest7', 'guest8', 'guest9', 'guest10',
  'kid1', 'kid2', 'kid3', 'kid4',
];
