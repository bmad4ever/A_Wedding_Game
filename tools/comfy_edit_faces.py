"""Derive expression variants (e.g. bride -> bride_shock) with Qwen-Image-Edit-2511 on a local ComfyUI.

Usage: python tools/comfy_edit_faces.py [--url http://127.0.0.1:8190] [target ...]
Reads tools/raw_faces/<base>.png, writes tools/raw_faces/<target>.png (then run crop_faces.py).
"""
import json, time, urllib.request, urllib.parse, random, os, argparse, io, uuid
from PIL import Image

KEEP = "Keep the exact same cartoon art style, identity, hair, accessories, framing and plain white background."
EDITS = {
    "bride_shock": ("bride", "Change her facial expression only: she is screaming in pure terror, mouth stretched wide open in a huge scream, eyes bulging wide, black mascara tears streaming down her cheeks. " + KEEP),
    "groom_shock": ("groom", "Change his facial expression only: he is screaming in horror, mouth wide open, eyebrows shot up, eyes huge with tiny pupils, sweat drops flying off his head. " + KEEP),
    "dj_shock": ("dj", "Change his facial expression only: he is screaming in panic, mouth wide open, sunglasses cracked and slipping down his nose. " + KEEP),
    "uncle_pain": ("uncle", "Change his facial expression only: he is howling in agonizing pain, mouth wide open, eyes squeezed shut, big tears squirting out. " + KEEP),
    "flutist_bliss": ("flutist", "Change his facial expression only: eyes rolled up in ecstatic artistic rapture, cheeks puffed up hugely like balloons, sweating. " + KEEP),
    "bride_love": ("bride", "Change her facial expression only: dreamy lovestruck blushing smile with big sparkling heart-shaped eyes. " + KEEP),
    "mom_shock": ("mom", "Change her facial expression only: she is fainting in shock, mouth open, eyes rolled back. " + KEEP),
    "grandma_shock": ("grandma", "Change her facial expression only: jaw dropped comically in disbelief, eyes huge behind her glasses. " + KEEP),
    "officiant_shock": ("officiant", "Change his facial expression only: eyes wide open in horror, mouth open screaming. " + KEEP),
    "flutist_shock": ("flutist", "Change his facial expression only: screaming in horror, mouth wide open, glasses cracked. " + KEEP),
    "ex_wink": ("ex", "Change his facial expression only: cocky wink and a smug one-sided grin showing a gold tooth. " + KEEP),
}


def wf(img_name, prompt, seed):
    return {
        "1": {"class_type": "UNETLoader", "inputs": {"unet_name": "qwen_image_edit_2511_int8_convrot.safetensors", "weight_dtype": "default"}},
        "2": {"class_type": "LoraLoaderModelOnly", "inputs": {"model": ["1", 0], "lora_name": "qwen_edit_2511\\Qwen-Image-Edit-2511-Lightning-8steps-V1.0-fp32.safetensors", "strength_model": 1.0}},
        "3": {"class_type": "ModelSamplingAuraFlow", "inputs": {"model": ["2", 0], "shift": 3.1}},
        "4": {"class_type": "CFGNorm", "inputs": {"model": ["3", 0], "strength": 1.0}},
        "5": {"class_type": "CLIPLoader", "inputs": {"clip_name": "qwen_2.5_vl_7b_huihui_abliterated_int8_convrot.safetensors", "type": "qwen_image", "device": "default"}},
        "6": {"class_type": "VAELoader", "inputs": {"vae_name": "qwen_image_vae.safetensors"}},
        "7": {"class_type": "LoadImage", "inputs": {"image": img_name}},
        "8": {"class_type": "ImageScaleToTotalPixels", "inputs": {"image": ["7", 0], "upscale_method": "lanczos", "megapixels": 0.6, "resolution_steps": 16}},
        "10": {"class_type": "TextEncodeQwenImageEditPlus", "inputs": {"clip": ["5", 0], "vae": ["6", 0], "image1": ["8", 0], "prompt": prompt}},
        "11": {"class_type": "TextEncodeQwenImageEditPlus", "inputs": {"clip": ["5", 0], "vae": ["6", 0], "image1": ["8", 0], "prompt": ""}},
        "12": {"class_type": "FluxKontextMultiReferenceLatentMethod", "inputs": {"conditioning": ["10", 0], "reference_latents_method": "index_timestep_zero"}},
        "13": {"class_type": "FluxKontextMultiReferenceLatentMethod", "inputs": {"conditioning": ["11", 0], "reference_latents_method": "index_timestep_zero"}},
        "14": {"class_type": "GetImageSize", "inputs": {"image": ["8", 0]}},
        "15": {"class_type": "EmptyLatentImage", "inputs": {"width": ["14", 0], "height": ["14", 1], "batch_size": 1}},
        "16": {"class_type": "CFGGuider", "inputs": {"model": ["4", 0], "positive": ["12", 0], "negative": ["13", 0], "cfg": 1.0}},
        "17": {"class_type": "KSamplerSelect", "inputs": {"sampler_name": "euler_ancestral"}},
        "18": {"class_type": "ManualSigmas", "inputs": {"sigmas": "1.0, 0.990, 0.972, 0.940, 0.880, 0.760, 0.520, 0.240, 0.0"}},
        "19": {"class_type": "RandomNoise", "inputs": {"noise_seed": seed}},
        "20": {"class_type": "SamplerCustomAdvanced", "inputs": {"noise": ["19", 0], "guider": ["16", 0], "sampler": ["17", 0], "sigmas": ["18", 0], "latent_image": ["15", 0]}},
        "21": {"class_type": "VAEDecode", "inputs": {"samples": ["20", 0], "vae": ["6", 0]}},
        "22": {"class_type": "RMBG", "inputs": {"image": ["21", 0], "model": "RMBG-2.0", "sensitivity": 1.0, "process_res": 1024, "mask_blur": 0, "mask_offset": 0,
                                                 "invert_output": False, "refine_foreground": False, "background": "Alpha", "background_color": "#222222"}},
        "23": {"class_type": "SaveImage", "inputs": {"images": ["22", 0], "filename_prefix": "wedgame_edit"}},
    }


def upload(url, path):
    im = Image.open(path).convert("RGBA")
    bg = Image.new("RGBA", im.size, (255, 255, 255, 255))
    bg.alpha_composite(im)
    buf = io.BytesIO()
    bg.convert("RGB").save(buf, "PNG")
    name = "wedgame_%s.png" % uuid.uuid4().hex[:8]
    boundary = uuid.uuid4().hex
    crlf = "\r\n"
    head = ("--" + boundary + crlf + 'Content-Disposition: form-data; name="image"; filename="' + name + '"' + crlf +
            "Content-Type: image/png" + crlf + crlf).encode()
    tail = (crlf + "--" + boundary + crlf + 'Content-Disposition: form-data; name="overwrite"' + crlf + crlf + "true" + crlf +
            "--" + boundary + "--" + crlf).encode()
    req = urllib.request.Request(url + "/upload/image", data=head + buf.getvalue() + tail,
                                 headers={"Content-Type": "multipart/form-data; boundary=" + boundary})
    return json.loads(urllib.request.urlopen(req).read())["name"]


def run(url, base, prompt, out):
    name = upload(url, base)
    req = urllib.request.Request(url + "/prompt", data=json.dumps({"prompt": wf(name, prompt, random.randint(0, 2**31))}).encode(),
                                 headers={"Content-Type": "application/json"})
    pid = json.loads(urllib.request.urlopen(req).read())["prompt_id"]
    while True:
        time.sleep(1)
        h = json.loads(urllib.request.urlopen(url + "/history/" + pid).read())
        if pid in h:
            st = h[pid].get("status", {})
            if st.get("status_str") == "error":
                raise RuntimeError(json.dumps(st)[-1500:])
            im = h[pid]["outputs"]["23"]["images"][0]
            q = urllib.parse.urlencode({"filename": im["filename"], "subfolder": im["subfolder"], "type": im["type"]})
            open(out, "wb").write(urllib.request.urlopen(url + "/view?" + q).read())
            return


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:8190")
    ap.add_argument("targets", nargs="*")
    a = ap.parse_args()
    raw = os.path.join(os.path.dirname(os.path.abspath(__file__)), "raw_faces")
    for t in (a.targets or EDITS.keys()):
        base, prompt = EDITS[t]
        t0 = time.time()
        run(a.url, os.path.join(raw, base + ".png"), prompt, os.path.join(raw, t + ".png"))
        print(t, "%.1fs" % (time.time() - t0), flush=True)
