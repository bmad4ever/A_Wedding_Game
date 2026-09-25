"""Generate environment textures (sky panorama, ground tiles) via local ComfyUI. Outputs to tools/raw_tex/."""
import os, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from comfy_faces import run

TEX = {
    "sky": ("wide panoramic landscape painting of a romantic sunset sky at dusk over gentle rolling hills and a distant vineyard, "
            "glowing orange and pink horizon fading to deep purple and blue at the top, soft stylized clouds, a few distant cypress trees, "
            "stylized painterly game background, no people, no buildings", 2048, 1024),
    "grass": ("seamless tileable top-down texture of a neatly mown lawn, short green grass, stylized hand painted game texture, even lighting, no shadows, flat view from directly above", 1024, 1024),
    "hedge": ("seamless tileable texture of a dense trimmed boxwood hedge wall, small green leaves, stylized hand painted game texture, even lighting, flat front view", 1024, 1024),
    "wood": ("seamless tileable texture of polished warm oak wooden floor planks, stylized hand painted game texture, flat top-down view, even lighting", 1024, 1024),
}

if __name__ == "__main__":
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "raw_tex")
    os.makedirs(out, exist_ok=True)
    for n in (sys.argv[1:] or TEX.keys()):
        p, w, h = TEX[n]
        t = time.time()
        run("http://127.0.0.1:8190", p, os.path.join(out, n + ".png"), w=w, h=h, rmbg=False)
        print(n, "%.1fs" % (time.time() - t), flush=True)
