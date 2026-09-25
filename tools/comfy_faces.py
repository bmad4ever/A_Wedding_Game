"""Generate cartoon head billboards for A Wedding Game via a local ComfyUI.

Usage: python tools/comfy_faces.py [--url http://127.0.0.1:8190] [name ...]
Writes RGBA PNGs to assets/faces/<name>.png (background removed).
"""
import json, sys, time, urllib.request, urllib.parse, random, os, argparse

STYLE = ("cartoon caricature of a single human head only, no neck, no shoulders, no body, "
         "front view facing the viewer, centered, thick clean outlines, flat vibrant colors, "
         "funny exaggerated features, sticker illustration, plain pure white background. ")

FACES = {
    "bride":        "a young bride with an elegant updo hairstyle, a small tiara, sparkling eyes, huge hopeful smile, rosy cheeks",
    "bride_shock": "SCREAMING IN TERROR, mouth stretched wide open in a huge O scream, eyes bulging, black mascara tears running down cheeks, hands-off panic: a young bride with an elegant brown updo hairstyle and a small tiara",
    "groom":        "a nervous young groom with neat short brown hair and a tiny mustache, sweating a little, awkward proud grin",
    "groom_shock": "SCREAMING IN HORROR, mouth wide open showing teeth and tongue, eyebrows raised to the hairline, eyes huge and tiny pupils, sweat drops flying: a young groom with neat short brown hair and a tiny mustache",
    "flutist":      "an intense eccentric man with wild curly grey hair and round glasses, eyes closed in artistic passion, puffed cheeks",
    "dj":           "a cool DJ with a backwards cap, sunglasses, goatee and big over-ear headphones around his neck, smug grin",
    "dj_shock": "SCREAMING IN PANIC, mouth wide open, sunglasses cracked and askew: a DJ with a backwards black cap, goatee and big headphones",
    "uncle":        "a bald chubby middle-aged uncle with a red nose, bushy grey mustache and a loud laughing mouth",
    "uncle_pain": "HOWLING IN PAIN, mouth wide open crying, tears squirting out of squeezed shut eyes: a bald chubby middle-aged uncle with a red nose and bushy grey mustache",
    "grandma":      "a tiny sweet old grandma with a white hair bun, big round glasses and a mischievous smirk",
    "officiant":    "a solemn elderly priest with a white collar, bald top with white side hair, extremely bored half-closed eyes",
    "photographer": "a hipster photographer woman with a beanie, bangs and big hoop earrings, winking",
    "ex":           "a smug handsome rebel with slicked back black hair, stubble, a scar and aviator sunglasses, cocky smirk",
    "mom":          "a proud mother of the bride with a big fancy feathered hat, pearls and teary emotional eyes",
    "bridesmaid":   "a cheerful bridesmaid with long red hair and freckles, big smile",
    "guest1":       "a middle-aged man with a comb-over and thick glasses, polite smile",
    "guest2":       "a young woman with a black bob haircut and bright red lipstick, raised eyebrow",
    "guest3":       "a young man with a huge afro and a friendly toothy grin",
    "guest4":       "an old man with enormous white eyebrows and a monocle, confused",
    "guest5":       "a woman with blonde curly hair and a flower in her hair, laughing",
    "guest6":       "a bearded hipster man with a man bun, dreamy expression",
    "guest7":       "a teenage boy with braces and messy hair, bored and on the verge of an eye-roll",
    "guest8":       "an elegant woman with grey silver hair in a sharp bob and cat-eye glasses, judging silently",
    "guest9":       "a sunburnt man with a bright ginger beard and a big grin",
    "guest10":      "a young woman with long black braids and gold earrings, gossiping face",
}

def wf(prompt, seed, w=768, h=768, rmbg=True):
    g = {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": "Krea2_Turbo_convrot_int8mixed.safetensors", "weight_dtype": "default"}},
        "2": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen3vl_4b_int8_convrot.safetensors", "type": "krea2", "device": "default"}},
        "3": {"class_type": "VAELoader", "inputs": {"vae_name": "qwen_image_vae.safetensors"}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": prompt}},
        "5": {"class_type": "CLIPTextEncode", "inputs": {"clip": ["2", 0], "text": ""}},
        "6": {"class_type": "EmptySD3LatentImage", "inputs": {"width": w, "height": h, "batch_size": 1}},
        "7": {"class_type": "KSampler", "inputs": {"model": ["1", 0], "positive": ["4", 0], "negative": ["5", 0], "latent_image": ["6", 0],
              "seed": seed, "steps": 8, "cfg": 1.0, "sampler_name": "euler_ancestral", "scheduler": "simple", "denoise": 1.0}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["3", 0]}},
        "9": {"class_type": "RMBG", "inputs": {"image": ["8", 0], "model": "RMBG-2.0", "sensitivity": 1.0, "process_res": 1024, "mask_blur": 0, "mask_offset": 0, "invert_output": False, "refine_foreground": False, "background": "Alpha", "background_color": "#222222"}},
        "10": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": "wedgame_face"}},
    }
    if not rmbg:
        del g["9"]
        g["10"]["inputs"]["images"] = ["8", 0]
    return g

def post(url, path, data):
    req = urllib.request.Request(url + path, data=json.dumps(data).encode(), headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req).read())

def run(url, prompt, out, seed=None, **kw):
    seed = seed if seed is not None else random.randint(0, 2**31)
    pid = post(url, "/prompt", {"prompt": wf(prompt, seed, **kw)})["prompt_id"]
    while True:
        time.sleep(1)
        h = json.loads(urllib.request.urlopen(f"{url}/history/{pid}").read())
        if pid in h:
            st = h[pid].get("status", {})
            if st.get("status_str") == "error":
                raise RuntimeError(json.dumps(st)[:2000])
            imgs = h[pid]["outputs"]["10"]["images"]
            im = imgs[0]
            q = urllib.parse.urlencode({"filename": im["filename"], "subfolder": im["subfolder"], "type": im["type"]})
            open(out, "wb").write(urllib.request.urlopen(f"{url}/view?{q}").read())
            return

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:8190")
    ap.add_argument("--seed", type=int, default=None)
    ap.add_argument("names", nargs="*")
    a = ap.parse_args()
    here = os.path.dirname(os.path.abspath(__file__))
    outdir = os.path.join(here, "..", "assets", "faces")
    os.makedirs(outdir, exist_ok=True)
    for n in (a.names or FACES.keys()):
        t = time.time()
        run(a.url, STYLE + FACES[n], os.path.join(outdir, n + ".png"), a.seed)
        print(n, f"{time.time()-t:.1f}s", flush=True)
