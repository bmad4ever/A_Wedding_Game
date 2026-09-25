"""Turn raw head+neck renders (tools/raw_heads) into 256px sprites in assets/faces.

Every sprite is normalised the same way so the characters match in-game:
  * the neck is found (narrowest part of the lower silhouette) and trimmed or extended to
    NECK x the head height (top of hair/hat to chin), with anything wider below the chin
    (shoulder lines, collars) clipped to the neck's width;
  * the neck bottom is the bottom edge of the square, centred horizontally, so the game can anchor
    the sprite at (0.5, 0) on the character's collar.
src/faces.js (normaliseHead) does the same thing at runtime for generated/uploaded brides.
"""
from PIL import Image
import numpy as np
import glob, os, sys

NECK = 0.22
here = os.path.dirname(os.path.abspath(__file__))
src = os.path.join(here, 'raw_heads'); dst = os.path.join(here, '..', 'assets', 'faces')


def grow(seed, allowed, steps):
    t = seed.copy()
    for _ in range(steps):
        g = t.copy()
        g[1:] |= t[:-1]; g[:-1] |= t[1:]; g[:, 1:] |= t[:, :-1]; g[:, :-1] |= t[:, 1:]
        g &= allowed | t
        if (g == t).all(): break
        t = g
    return t


def dehalo(a):
    """Fill background-removal holes (eye whites, teeth) and eat a white 'sticker' rim, if there is one."""
    rgb = a[:, :, :3].astype(int)
    white = (rgb.min(2) > 225) & (rgb.max(2) - rgb.min(2) < 25)
    clear = a[:, :, 3] <= 40
    border = np.zeros_like(clear); border[0] = border[-1] = True; border[:, 0] = border[:, -1] = True
    outside = grow(border & clear, clear, 10 ** 6)
    holes = clear & ~outside
    a[holes, 3] = 255
    # silhouette pixels touching the outside: mostly white means a sticker rim
    edge = ~outside & (np.roll(outside, 1, 0) | np.roll(outside, -1, 0) | np.roll(outside, 1, 1) | np.roll(outside, -1, 1))
    if (white & edge).sum() > 0.5 * edge.sum():
        a[grow(outside, white, 30), 3] = 0
    return a


def normalise(im):
    a = dehalo(np.pad(np.array(im), ((0, 400), (300, 300), (0, 0))))   # pad: room to extend the neck / square up
    op = a[:, :, 3] > 40
    rows = np.where(op.any(1))[0]
    top, bot = rows[0], rows[-1]
    L = np.full(a.shape[0], -1); R = np.full(a.shape[0], -1)
    for y in rows:
        xs = np.where(op[y])[0]; L[y], R[y] = xs[0], xs[-1]
    W = R - L + 1
    H = bot - top
    lo = [y for y in range(int(top + 0.5 * H), int(bot - 0.06 * H)) if W[y] > 3]   # skip the neck's rounded bottom outline
    m = min(lo, key=lambda y: W[y])                      # narrowest row = the neck
    nw = W[m]
    if nw > 0.55 * W[top:m].max():
        raise ValueError('no neck found (hair/shoulders cover it?) - regenerate this one')
    chin = m
    while chin > top and W[chin] <= 1.2 * nw: chin -= 1
    b0 = m                                               # last row that's still neck-wide
    while b0 + 1 <= bot and 0.85 * nw <= W[b0 + 1] <= 1.3 * nw: b0 += 1
    head_h = chin - top
    target = int(chin + NECK * head_h)
    nl, nr = L[m] - 2, R[m] + 3
    out = a.copy()
    out[m + 1:, :nl] = 0; out[m + 1:, nr:] = 0           # clip collars / shoulders to the neck
    src_row = max(m, min(b0, target) - 8)                # a clean neck row above any bottom outline
    for y in range(src_row + 1, target):                 # extend (or tidy) the neck down to target
        out[y] = out[src_row]
    out[target:] = 0
    cx = (L[m] + R[m]) / 2
    side = int(max(target - top, (R[top:chin + 1].max() - L[top:chin + 1][L[top:chin + 1] >= 0].min())) * 1.03)
    x0 = int(cx - side / 2)
    img = Image.fromarray(out)
    return img.crop((x0, target - side, x0 + side, target))


if __name__ == '__main__':
    names = sys.argv[1:]
    for f in sorted(glob.glob(os.path.join(src, '*.png'))):
        n = os.path.splitext(os.path.basename(f))[0]
        if n.startswith('_') or n.startswith('sheet') or n.startswith('tpl'): continue
        if names and n not in names: continue
        try: out = normalise(Image.open(f).convert('RGBA'))
        except ValueError as e: print(n, 'SKIPPED:', e); continue
        out.resize((256, 256), Image.LANCZOS).save(os.path.join(dst, n + '.png'), optimize=True)
        print(n)
