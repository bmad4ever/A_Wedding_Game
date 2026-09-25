"""Generate the head+neck billboards for A Wedding Game from one shared template, so every
character has the same framing, neck and art style.

  1. template: a bald cartoon head + neck made with Krea2, background removed once with RMBG
     (tools/raw_heads/_template_rgba.png; regenerate with --template)
  2. characters: Qwen-Image 2.1 edits the template into each character
  3. expressions: Qwen-Image 2.1 edits a character into its shocked/pained/... variant
  4. backs: one rear view per character (<name>_back), shared by all its expressions in game

Qwen-Image 2.1's VAE is RGBA: the transparent reference goes in as-is and the edit comes back with
its own alpha, so no background removal is needed after the template.

Usage: python tools/comfy_heads.py [--url http://127.0.0.1:8190] [--template] [--steps 20] [--res 512] [name ...]
Writes tools/raw_heads/<name>.png (RGBA). Then run tools/crop_faces.py.
"""
import os, argparse, random, json, time, uuid, urllib.request, urllib.parse
import comfy_faces as cf

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.join(HERE, "raw_heads")
TEMPLATE = os.path.join(RAW, "_template_rgba.png")

TEMPLATE_PROMPT = (
    "cartoon caricature illustration of a bald person with a smooth hairless head, neutral friendly smile, "
    "head and long neck only, the neck ends with a straight horizontal cut at the bottom, no shoulders, no collar, no clothes, "
    "no body, front view facing the viewer, centered, small in frame with lots of empty space around, thick clean dark outlines, "
    "flat vibrant colors, plain pure white background")

BG = "fully transparent background (alpha)"
KEEP = ("Keep exactly the same head size, head position and framing. Keep the same bare neck, fully visible, ending in a straight cut "
        "at the bottom: no shoulders, no clothes, no collarbones. Keep the thick dark outline cartoon art style with vibrant colors and "
        "soft cel shading, and the " + BG + ".")
CHAR = "Turn this bald cartoon person in <image1> into {d}. Give them funny exaggerated caricature features, expressive eyes and eyebrows. " + KEEP
EXPR = ("Change the facial expression of the person in <image1> only: {d} Keep the exact same identity, hair, accessories, art style, "
        "framing, neck and the " + BG + ".")
BACK = ("Rotate the view to show the back of this same person's head in <image1>: rear view from directly behind, the face is not "
        "visible at all. Keep the same hairstyle, hair colour and length. Only keep head accessories that are clearly visible in <image1>; "
        "do not add any new accessory, jewelry, tiara, crown, headband, hair clip or ribbon. Keep the same bare neck, fully visible, ending "
        "in a straight cut at the bottom: no shoulders, no clothes. Keep the same head size, position, framing and thick dark outline "
        "cartoon art style, and the " + BG + ".")
NEG = "blurry, deformed, shoulders, clothes, torso, white border, sticker outline, background scenery"

CHARS = {
    "bride":        "a young woman, a bride with an elegant brown updo hairstyle, a small silver tiara, sparkling eyes, huge hopeful smile, rosy cheeks",
    "groom":        "a young man, a groom with neat short brown hair and a tiny mustache, a warm, happy, confident smile, relaxed friendly eyes",
    "flutist":      "an intense eccentric man with wild curly grey hair and round glasses, eyes closed in artistic passion, puffed cheeks",
    "dj":           "a cool DJ man with a backwards black cap, sunglasses, goatee and big over-ear headphones worn on his ears over the cap, smug grin",
    "uncle":        "a bald chubby middle-aged uncle with a round red nose, bushy grey mustache and a loud laughing open mouth",
    "grandma":      "a tiny sweet old grandma with a white hair bun, wrinkles, big round glasses and a mischievous smirk",
    "officiant":    "a solemn elderly priest with a bald top and white side hair, a tiny white clerical collar band low on the neck, extremely bored half-closed eyes",
    "photographer": "a hipster photographer woman with a beanie, bangs and big hoop earrings, winking",
    "ex":           "a smug handsome rebel man with slicked back black hair, stubble, a small scar and aviator sunglasses, cocky smirk",
    "mom":          "a proud middle-aged mother of the bride with voluminous curly auburn hair (a full head of hair, not bald) under a big fancy purple feathered hat, pearl earrings and teary emotional eyes",
    "bridesmaid":   "a cheerful young woman bridesmaid with bright red hair tied back in a high ponytail, freckles, big smile",
    "guest1":       "a middle-aged man with a comb-over and thick glasses, polite smile",
    "guest2":       "a young woman with a black bob haircut and bright red lipstick, one raised eyebrow",
    "guest3":       "a young man with dark brown skin, a huge afro and a friendly toothy grin",
    "guest4":       "an old man with enormous white eyebrows and a monocle, confused",
    "guest5":       "a woman with blonde curly hair and a flower in her hair, laughing",
    "guest6":       "a bearded hipster man with a man bun, dreamy expression",
    "guest7":       "a teenage boy with braces and messy hair, bored and on the verge of an eye-roll",
    "guest8":       "an elegant older woman with grey silver hair in a sharp bob and cat-eye glasses, judging silently",
    "guest9":       "a sunburnt man with a bright ginger beard and a big grin",
    "guest10":      "a young woman with brown skin, black braided hair pulled completely up into a tall bun on top of her head, nothing hanging below her ears, neck fully bare, gold earrings, gossiping face",
    # the kids' table (child-sized bodies in-game) and the baby in its parent's arms
    "kid1":         "a small girl about six years old with two blonde pigtails, a gap-toothed angelic sweet smile, big innocent eyes, round cheeks",
    "kid2":         "a small boy about seven years old with a messy brown bowl haircut, freckles, big innocent eyes and a polite little smile",
    "kid3":         "a small girl about five years old with dark brown skin and two puffy afro puffs, big innocent eyes, a sweet shy smile",
    "kid4":         "a chubby little boy about six years old with spiky black hair, round glasses, rosy round cheeks, an angelic well-behaved smile",
    "baby":         "a chubby bald baby with a single curl of hair on top, huge round cheeks, tiny button nose, big curious eyes, peaceful little smile",
}

EXPRS = {
    "bride_shock":     ("bride", "she is screaming in pure terror, mouth stretched wide open in a huge scream, eyes bulging wide, black mascara tears streaming down her cheeks."),
    "bride_love":      ("bride", "dreamy lovestruck blushing smile with big sparkling heart-shaped eyes."),
    "groom_shock":     ("groom", "he is screaming in horror, mouth wide open, eyebrows shot up, eyes huge with tiny pupils, sweat drops flying off his head."),
    "groom_cry":       ("groom", "he is sobbing uncontrollably, eyebrows raised in despair, trembling open mouth, big streams of tears pouring down his cheeks, runny nose."),
    "dj_shock":        ("dj", "he is screaming in panic, mouth wide open, sunglasses cracked and slipping down his nose."),
    "uncle_pain":      ("uncle", "he is howling in agonizing pain, mouth wide open, eyes squeezed shut, big tears squirting out."),
    "flutist_bliss":   ("flutist", "eyes rolled up in ecstatic artistic rapture, cheeks puffed up hugely like balloons, sweating."),
    "flutist_shock":   ("flutist", "screaming in horror, mouth wide open, glasses cracked."),
    "mom_shock":       ("mom", "she is fainting in shock, mouth open, eyes rolled back."),
    "grandma_shock":   ("grandma", "jaw dropped comically in disbelief, eyes huge behind her glasses."),
    "officiant_shock": ("officiant", "eyes wide open in horror, mouth open screaming."),
    "ex_wink":         ("ex", "cocky wink and a smug one-sided grin showing a gold tooth."),
    "kid1_savage":     ("kid1", "a feral battle-cry, mouth wide open yelling, furious narrowed eyes, eyebrows slanted down in rage, like a tiny barbarian."),
    "kid2_savage":     ("kid2", "a feral battle-cry, mouth wide open yelling, furious narrowed eyes, eyebrows slanted down in rage, like a tiny barbarian."),
    "kid3_savage":     ("kid3", "an evil maniacal grin showing all her teeth, wild wide eyes, eyebrows slanted down, plotting chaos."),
    "kid4_savage":     ("kid4", "an evil maniacal grin showing all his teeth, wild wide eyes behind his glasses, eyebrows slanted down, plotting chaos."),
    "baby_cry":        ("baby", "the baby is wailing at full volume, mouth wide open in a huge square cry, eyes squeezed shut, big tears squirting out, red face."),
}

def wf(img, prompt, seed, steps=20, res=512):
    return {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": "qwen_image_2.1_int8_convrot.safetensors", "weight_dtype": "default"}},
        "2": {"class_type": "QwenImage21Cache", "inputs": {"model": ["1", 0], "device": "auto", "dtype": "default"}},
        "3": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen3vl_8b_int8_convrot.safetensors", "type": "qwen_image", "device": "default"}},
        "4": {"class_type": "VAELoader", "inputs": {"vae_name": "qwen_image_2.1_vae_bf16.safetensors"}},
        "5": {"class_type": "LoadImage", "inputs": {"image": img}},
        "6": {"class_type": "JoinImageWithAlpha", "inputs": {"image": ["5", 0], "alpha": ["5", 1]}},
        "7": {"class_type": "TextEncodeQwenImage21", "inputs": {"clip": ["3", 0], "prompt": prompt, "negative_prompt": NEG,
                                                              "resolution": res, "images.image_1": ["6", 0], "vae": ["4", 0]}},
        "8": {"class_type": "KSampler", "inputs": {"model": ["2", 0], "positive": ["7", 0], "negative": ["7", 1], "latent_image": ["7", 2],
                                                 "seed": seed, "steps": steps, "cfg": 1.0, "sampler_name": "euler_ancestral_cfg_pp",
                                                 "scheduler": "simple", "denoise": 1.0}},
        "9": {"class_type": "VAEDecode", "inputs": {"samples": ["8", 0], "vae": ["4", 0]}},
        "10": {"class_type": "SaveImage", "inputs": {"images": ["9", 0], "filename_prefix": "wedgame_head"}},
    }


def upload(url, path):
    """Upload a PNG as-is (keeping its alpha)."""
    data = open(path, "rb").read()
    name = "wedgame_%s.png" % uuid.uuid4().hex[:8]
    b = uuid.uuid4().hex
    crlf = chr(13) + chr(10)
    head = ("--" + b + crlf + 'Content-Disposition: form-data; name="image"; filename="' + name + '"' + crlf +
            "Content-Type: image/png" + crlf + crlf).encode()
    tail = (crlf + "--" + b + crlf + 'Content-Disposition: form-data; name="overwrite"' + crlf + crlf + "true" + crlf +
            "--" + b + "--" + crlf).encode()
    req = urllib.request.Request(url + "/upload/image", data=head + data + tail,
                                 headers={"Content-Type": "multipart/form-data; boundary=" + b})
    return json.loads(urllib.request.urlopen(req).read())["name"]


def edit(url, src, prompt, out, seed=None, steps=20, res=512):
    g = wf(upload(url, src), prompt, seed if seed is not None else random.randint(0, 2**31), steps, res)
    req = urllib.request.Request(url + "/prompt", data=json.dumps({"prompt": g}).encode(), headers={"Content-Type": "application/json"})
    pid = json.loads(urllib.request.urlopen(req).read())["prompt_id"]
    while True:
        time.sleep(1)
        h = json.loads(urllib.request.urlopen(url + "/history/" + pid).read())
        if pid in h:
            st = h[pid].get("status", {})
            if st.get("status_str") == "error":
                raise RuntimeError(json.dumps(st)[-1500:])
            im = h[pid]["outputs"]["10"]["images"][0]
            q = urllib.parse.urlencode({"filename": im["filename"], "subfolder": im["subfolder"], "type": im["type"]})
            open(out, "wb").write(urllib.request.urlopen(url + "/view?" + q).read())
            return


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:8190")
    ap.add_argument("--template", action="store_true", help="regenerate the bald template first")
    ap.add_argument("--steps", type=int, default=20, help="sampling steps (20 matches 40 for these simple edits)")
    ap.add_argument("--res", type=int, default=512, help="edit resolution (512 is plenty for 256px sprites; ~3x faster than 768)")
    ap.add_argument("names", nargs="*")
    a = ap.parse_args()
    os.makedirs(RAW, exist_ok=True)
    if a.template or not os.path.exists(TEMPLATE):
        cf.run(a.url, TEMPLATE_PROMPT, TEMPLATE, 44, rmbg=True)
        print("template", flush=True)
    names = a.names or list(CHARS) + list(EXPRS) + [c + "_back" for c in CHARS]
    for n in names:
        t = time.time()
        if n in CHARS:
            edit(a.url, TEMPLATE, CHAR.format(d=CHARS[n]), os.path.join(RAW, n + ".png"), steps=a.steps, res=a.res)
        elif n.endswith("_back"):
            edit(a.url, os.path.join(RAW, n[:-5] + ".png"), BACK, os.path.join(RAW, n + ".png"), steps=a.steps, res=a.res)
        else:
            base, d = EXPRS[n]
            edit(a.url, os.path.join(RAW, base + ".png"), EXPR.format(d=d), os.path.join(RAW, n + ".png"), steps=a.steps, res=a.res)
        print(n, "%.0fs" % (time.time() - t), flush=True)
