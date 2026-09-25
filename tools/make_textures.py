"""Post-process raw ComfyUI textures (tools/raw_tex) into game-ready files in assets/tex (seamless tiles + sky)."""
from PIL import Image
import numpy as np, os
here = os.path.dirname(os.path.abspath(__file__))
src, dst = os.path.join(here, 'raw_tex'), os.path.join(here, '..', 'assets', 'tex')
os.makedirs(dst, exist_ok=True)

def seamless(im, size):
    a = np.asarray(im.convert('RGB').resize((size, size), Image.LANCZOS)).astype(np.float32)
    r = np.roll(np.roll(a, size // 2, 0), size // 2, 1)
    x = np.linspace(0, 1, size)
    tri = 1 - np.abs(x * 2 - 1)
    w = np.clip(np.outer(tri, tri) * 1.6, 0, 1)[..., None]
    return Image.fromarray((a * w + r * (1 - w)).astype(np.uint8))

for n in ['grass', 'hedge', 'wood']:
    seamless(Image.open(os.path.join(src, n + '.png')), 512).save(os.path.join(dst, n + '.jpg'), quality=85)
Image.open(os.path.join(src, 'sky.png')).convert('RGB').save(os.path.join(dst, 'sky.jpg'), quality=82)
print(os.listdir(dst))
