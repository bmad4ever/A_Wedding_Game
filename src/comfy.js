// Optional face generator (bride or groom) using a local ComfyUI server.
// When served by serve.js, requests go through its same-origin /comfy proxy (no CORS needed); the
// title-screen Server URL is passed to the proxy in the x-comfy-target header. From file:// the
// browser talks to the Server URL directly (ComfyUI then needs --enable-cors-header).
//
// With an image-edit model on the server (Qwen-Image 2.1, else Qwen-Image-Edit-2511) the face is made
// the same way as the bundled cast: the bald template head is edited into the described person, and
// that face is edited again into each expression the game needs (shocked, crying, …). Without one,
// a text-to-image model makes the neutral face and the expressions fall back to it.
import { asset } from './assets.js';
import { CONFIG } from './config.js';

const T2I_STYLE = 'cartoon caricature illustration of a single human head and bare neck only, the neck ends with a straight horizontal cut at the bottom, ' +
  'no shoulders, no clothes, no body, front view facing the viewer, centered, small in frame, thick clean dark outlines, flat vibrant colors, ' +
  'funny exaggerated features, expressive eyes, plain pure white background, no white border around the character. ';

// mood: the default neutral expression (without it the edit model tends to give the bride a worried look)
const WHO = {
  bride: { person: 'a bride with a small tiara', fallback: 'an elegant updo, sparkling eyes, a huge hopeful smile', label: 'bride',
    mood: 'radiant and joyful, a huge happy carefree smile, relaxed eyebrows, bright cheerful sparkling eyes, rosy cheeks' },
  groom: { person: 'a groom', fallback: 'neat short hair, a warm happy smile', label: 'groom',
    mood: 'happy and confident, a big warm smile, relaxed eyebrows, bright cheerful eyes' },
};

// Qwen-Image 2.1 edit size/steps: the head ends up as a small billboard sprite, so 512px / 20 steps keeps the
// prompt adherence of 768px / 30 steps at about a third of the time (~7 s instead of ~22 s per edit).
const Q21_RES = 512, Q21_STEPS = 20;
// expression edits per variant (same wording as tools/comfy_heads.py)
const EXPR = {
  bride_shock: 'she is screaming in pure terror, mouth stretched wide open in a huge scream, eyes bulging wide, black mascara tears streaming down her cheeks.',
  bride_love: 'dreamy lovestruck blushing smile with big sparkling heart-shaped eyes.',
  groom_shock: 'he is screaming in horror, mouth wide open, eyebrows shot up, eyes huge with tiny pupils, sweat drops flying off his head.',
  groom_cry: 'he is sobbing uncontrollably, eyebrows raised in despair, trembling open mouth, big streams of tears pouring down his cheeks, runny nose.',
};

// back-of-head view (same wording as tools/comfy_heads.py); one per character, shared by its expressions
const BACK = 'Rotate the view to show the back of this same person\'s head{ref}: rear view from directly behind, the face is not visible at all. ' +
  'Keep the same hairstyle, hair colour and length. Only keep head accessories that are clearly visible in the image; do not add any new ' +
  'accessory, jewelry, tiara, crown, headband, hair clip or ribbon. Keep the same bare neck, fully visible, ending in a straight cut at the bottom: ' +
  'no shoulders, no clothes. Keep the same head size, position, framing and {style}, and the {bg}.';

let srvHeaders = {}; // extra headers for the chosen server (proxy target)

async function j(url, opts = {}, ms = 8000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...opts, headers: { ...(opts.headers || {}), ...srvHeaders }, signal: ctl.signal });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

async function findServer(userUrl) {
  const cands = [];
  // "locked" deployments never take a server from the page: only the proxy's own target, else the configured default
  const locked = CONFIG.comfyUI !== 'full';
  const user = locked ? '' : (userUrl ? userUrl.trim().replace(/\/$/, '') : '');
  if (location.protocol.startsWith('http')) {
    const proxy = location.origin + '/comfy';
    if (user) cands.push({ base: proxy, headers: { 'x-comfy-target': user } }); // proxy -> Server URL
    cands.push({ base: proxy, headers: {} });                                  // proxy -> serve.js default
  }
  if (user) cands.push({ base: user, headers: {} });                           // direct (needs CORS)
  else if (locked && !location.protocol.startsWith('http')) cands.push({ base: CONFIG.comfyUrl.replace(/\/$/, ''), headers: {} });
  for (const c of cands) {
    srvHeaders = c.headers;
    try { await j(c.base + '/system_stats', {}, 3000); return c.base; } catch (e) { /* try next */ }
  }
  srvHeaders = {};
  return null;
}

function opts(info, node, input) {
  try {
    const v = info[node].input.required[input][0];
    if (Array.isArray(v)) return v;
    return info[node].input.required[input][1]?.options || [];
  } catch (e) { return []; }
}
const find = (list, ...needles) => list.find((n) => needles.every((s) => n.toLowerCase().includes(s)));

const NODES = ['UNETLoader', 'CLIPLoader', 'VAELoader', 'CheckpointLoaderSimple', 'LoraLoaderModelOnly', 'RMBG', 'LoadImage', 'JoinImageWithAlpha',
  'TextEncodeQwenImage21', 'QwenImage21Cache', 'TextEncodeQwenImageEditPlus', 'ImageScaleToTotalPixels', 'FluxKontextMultiReferenceLatentMethod',
  'CFGNorm', 'ModelSamplingAuraFlow', 'ManualSigmas', 'BasicScheduler', 'SamplerCustomAdvanced', 'CFGGuider', 'KSamplerSelect', 'RandomNoise', 'GetImageSize'];

async function serverInfo(base) {
  const info = {};
  await Promise.all(NODES.map(async (n) => { try { Object.assign(info, await j(`${base}/object_info/${n}`)); } catch (e) { /* missing node */ } }));
  const m = {
    unets: opts(info, 'UNETLoader', 'unet_name'), clips: opts(info, 'CLIPLoader', 'clip_name'), vaes: opts(info, 'VAELoader', 'vae_name'),
    ckpts: opts(info, 'CheckpointLoaderSimple', 'ckpt_name'), loras: opts(info, 'LoraLoaderModelOnly', 'lora_name'),
  };
  return { info, m, editor: pickEditor(info, m) };
}

function pickEditor(info, m) {
  const has = (...n) => n.every((x) => info[x]);
  if (has('TextEncodeQwenImage21', 'JoinImageWithAlpha', 'LoadImage')) {
    const unet = find(m.unets, 'qwen_image_2.1'), vae = find(m.vaes, 'qwen_image_2.1_vae', 'bf16') || find(m.vaes, 'qwen_image_2.1_vae');
    const clip = find(m.clips, 'qwen3vl_8b', 'int8') || m.clips.find((c) => /qwen3vl_8b/i.test(c) && !/joy/i.test(c));
    if (unet && vae && clip) return { kind: 'q21', unet, vae, clip, cache: !!info.QwenImage21Cache };
  }
  if (has('TextEncodeQwenImageEditPlus', 'LoadImage', 'SamplerCustomAdvanced', 'CFGGuider', 'KSamplerSelect', 'RandomNoise', 'GetImageSize')) {
    const unet = find(m.unets, 'qwen_image_edit_2511') || find(m.unets, 'qwen_image_edit_2509') || find(m.unets, 'qwen_image_edit');
    const vae = find(m.vaes, 'qwen_image_vae'), clip = find(m.clips, 'qwen_2.5_vl_7b');
    const lora = find(m.loras, 'edit-2511-lightning-8steps') || find(m.loras, 'edit-lightning-8steps');
    if (unet && vae && clip) return { kind: 'q2511', unet, vae, clip, lora, rmbg: !!info.RMBG, manual: !!info.ManualSigmas };
  }
  return null;
}

const RMBG = (img) => ({ class_type: 'RMBG', inputs: { image: img, model: 'RMBG-2.0', sensitivity: 1, process_res: 1024, mask_blur: 0, mask_offset: 0, invert_output: false, refine_foreground: false, background: 'Alpha', background_color: '#222222' } });

// ---------- edit graphs (output node '99') ----------
function editGraph(ed, imgName, prompt, seed) {
  if (ed.kind === 'q21') {
    const g = {
      1: { class_type: 'UNETLoader', inputs: { unet_name: ed.unet, weight_dtype: 'default' } },
      3: { class_type: 'CLIPLoader', inputs: { clip_name: ed.clip, type: 'qwen_image', device: 'default' } },
      4: { class_type: 'VAELoader', inputs: { vae_name: ed.vae } },
      5: { class_type: 'LoadImage', inputs: { image: imgName } },
      6: { class_type: 'JoinImageWithAlpha', inputs: { image: ['5', 0], alpha: ['5', 1] } },
      7: { class_type: 'TextEncodeQwenImage21', inputs: { clip: ['3', 0], prompt, negative_prompt: 'blurry, deformed, shoulders, clothes, torso, white border, background scenery', resolution: Q21_RES, 'images.image_1': ['6', 0], vae: ['4', 0] } },
      9: { class_type: 'VAEDecode', inputs: { samples: ['8', 0], vae: ['4', 0] } },
      99: { class_type: 'SaveImage', inputs: { images: ['9', 0], filename_prefix: 'wedgame_face' } },
    };
    let model = ['1', 0];
    if (ed.cache) { g[2] = { class_type: 'QwenImage21Cache', inputs: { model, device: 'auto', dtype: 'default' } }; model = ['2', 0]; }
    g[8] = { class_type: 'KSampler', inputs: { model, positive: ['7', 0], negative: ['7', 1], latent_image: ['7', 2], seed, steps: Q21_STEPS, cfg: 1, sampler_name: 'euler_ancestral_cfg_pp', scheduler: 'simple', denoise: 1 } };
    return { graph: g, alpha: true };
  }
  // Qwen-Image-Edit-2511 (RGB in, RGB out; background removed afterwards)
  const g = {
    1: { class_type: 'UNETLoader', inputs: { unet_name: ed.unet, weight_dtype: 'default' } },
    5: { class_type: 'CLIPLoader', inputs: { clip_name: ed.clip, type: 'qwen_image', device: 'default' } },
    6: { class_type: 'VAELoader', inputs: { vae_name: ed.vae } },
    7: { class_type: 'LoadImage', inputs: { image: imgName } },
    8: { class_type: 'ImageScaleToTotalPixels', inputs: { image: ['7', 0], upscale_method: 'lanczos', megapixels: 0.6, resolution_steps: 16 } },
    10: { class_type: 'TextEncodeQwenImageEditPlus', inputs: { clip: ['5', 0], vae: ['6', 0], image1: ['8', 0], prompt } },
    11: { class_type: 'TextEncodeQwenImageEditPlus', inputs: { clip: ['5', 0], vae: ['6', 0], image1: ['8', 0], prompt: '' } },
    14: { class_type: 'GetImageSize', inputs: { image: ['8', 0] } },
    15: { class_type: 'EmptyLatentImage', inputs: { width: ['14', 0], height: ['14', 1], batch_size: 1 } },
    17: { class_type: 'KSamplerSelect', inputs: { sampler_name: 'euler_ancestral' } },
    19: { class_type: 'RandomNoise', inputs: { noise_seed: seed } },
    20: { class_type: 'SamplerCustomAdvanced', inputs: { noise: ['19', 0], guider: ['16', 0], sampler: ['17', 0], sigmas: ['18', 0], latent_image: ['15', 0] } },
    21: { class_type: 'VAEDecode', inputs: { samples: ['20', 0], vae: ['6', 0] } },
  };
  let model = ['1', 0];
  if (ed.lora) { g[2] = { class_type: 'LoraLoaderModelOnly', inputs: { model, lora_name: ed.lora, strength_model: 1 } }; model = ['2', 0]; }
  g[3] = { class_type: 'ModelSamplingAuraFlow', inputs: { model, shift: 3.1 } }; model = ['3', 0];
  let pos = ['10', 0], neg = ['11', 0];
  if (g[1] && ed.lora && ed.manual) {
    g[18] = { class_type: 'ManualSigmas', inputs: { sigmas: '1.0, 0.990, 0.972, 0.940, 0.880, 0.760, 0.520, 0.240, 0.0' } };
  } else {
    g[18] = { class_type: 'BasicScheduler', inputs: { model, scheduler: 'simple', steps: ed.lora ? 8 : 30, denoise: 1 } };
  }
  g[16] = { class_type: 'CFGGuider', inputs: { model, positive: pos, negative: neg, cfg: ed.lora ? 1 : 4 } };
  let img = ['21', 0];
  if (ed.rmbg) { g[22] = RMBG(img); img = ['22', 0]; }
  g[99] = { class_type: 'SaveImage', inputs: { images: img, filename_prefix: 'wedgame_face' } };
  return { graph: g, alpha: ed.rmbg };
}

// background removal only (output node '99'), for an uploaded photo when the server has no edit model
function rmbgGraph(imgName) {
  return { graph: { 1: { class_type: 'LoadImage', inputs: { image: imgName } }, 2: RMBG(['1', 0]), 99: { class_type: 'SaveImage', inputs: { images: ['2', 0], filename_prefix: 'wedgame_face' } } }, alpha: true };
}

// ---------- text-to-image fallback (output node '99') ----------
function t2iGraph(m, rmbg, prompt, seed) {
  const g = {};
  let img;
  const krea = find(m.unets, 'krea2', 'turbo', 'mixed') || find(m.unets, 'krea2', 'turbo');
  const kreaClip = find(m.clips, 'qwen3vl_4b') || find(m.clips, 'qwen3', '4b');
  const qvae = find(m.vaes, 'qwen_image_vae');
  const zimg = find(m.unets, 'z_image_turbo');
  const zclip = find(m.clips, 'qwen_3_4b') || find(m.clips, 'qwen3_4b');
  const zvae = find(m.vaes, 'ae.safetensors') || find(m.vaes, 'zit_vae') || find(m.vaes, 'flux');
  const sampler = (model, pos, neg, latent, steps, cfg, sname = 'euler', sched = 'simple') => ({ class_type: 'KSampler', inputs: { model, positive: pos, negative: neg, latent_image: latent, seed, steps, cfg, sampler_name: sname, scheduler: sched, denoise: 1 } });
  if (krea && kreaClip && qvae) {
    g[1] = { class_type: 'UNETLoader', inputs: { unet_name: krea, weight_dtype: 'default' } };
    g[2] = { class_type: 'CLIPLoader', inputs: { clip_name: kreaClip, type: 'krea2', device: 'default' } };
    g[3] = { class_type: 'VAELoader', inputs: { vae_name: qvae } };
    g[6] = { class_type: 'EmptySD3LatentImage', inputs: { width: 768, height: 768, batch_size: 1 } };
    g[7] = sampler(['1', 0], ['4', 0], ['5', 0], ['6', 0], 8, 1, 'euler_ancestral');
  } else if (zimg && zclip && zvae) {
    g[1] = { class_type: 'UNETLoader', inputs: { unet_name: zimg, weight_dtype: 'default' } };
    g[2] = { class_type: 'CLIPLoader', inputs: { clip_name: zclip, type: 'lumina2', device: 'default' } };
    g[3] = { class_type: 'VAELoader', inputs: { vae_name: zvae } };
    g[6] = { class_type: 'EmptySD3LatentImage', inputs: { width: 768, height: 768, batch_size: 1 } };
    g[7] = sampler(['1', 0], ['4', 0], ['5', 0], ['6', 0], 8, 1, 'res_multistep');
  } else if (m.ckpts.length) {
    const ck = find(m.ckpts, 'xl') || m.ckpts[0];
    const xl = /xl/i.test(ck);
    g[1] = { class_type: 'CheckpointLoaderSimple', inputs: { ckpt_name: ck } };
    g[6] = { class_type: 'EmptyLatentImage', inputs: { width: xl ? 1024 : 512, height: xl ? 1024 : 512, batch_size: 1 } };
    g[7] = sampler(['1', 0], ['4', 0], ['5', 0], ['6', 0], 24, 6.5, 'euler_ancestral', 'normal');
    g[4] = { class_type: 'CLIPTextEncode', inputs: { clip: ['1', 1], text: prompt } };
    g[5] = { class_type: 'CLIPTextEncode', inputs: { clip: ['1', 1], text: 'photo, realistic, body, shoulders, text, watermark, blurry' } };
    g[8] = { class_type: 'VAEDecode', inputs: { samples: ['7', 0], vae: ['1', 2] } };
  } else {
    throw new Error('No usable image model found on this ComfyUI.');
  }
  if (!g[4]) {
    g[4] = { class_type: 'CLIPTextEncode', inputs: { clip: ['2', 0], text: prompt } };
    g[5] = { class_type: 'CLIPTextEncode', inputs: { clip: ['2', 0], text: '' } };
    g[8] = { class_type: 'VAEDecode', inputs: { samples: ['7', 0], vae: ['3', 0] } };
  }
  img = ['8', 0];
  if (rmbg) { g[9] = RMBG(img); img = ['9', 0]; }
  g[99] = { class_type: 'SaveImage', inputs: { images: img, filename_prefix: 'wedgame_face' } };
  return { graph: g, alpha: rmbg };
}

// ---------- plumbing ----------
const toDataURL = (blob) => new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });

// scale a (possibly huge) photo down before uploading it
async function shrink(blob, max = 1024) {
  const img = await createImageBitmap(blob);
  const k = Math.min(1, max / Math.max(img.width, img.height));
  if (k === 1) return blob;
  const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
  cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
  return new Promise((r) => cv.toBlob(r, 'image/png'));
}

async function flattenOnWhite(blob) {
  const img = await createImageBitmap(blob);
  const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
  const g = cv.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0);
  return new Promise((r) => cv.toBlob(r, 'image/png'));
}

async function upload(base, blob) {
  const fd = new FormData();
  fd.append('image', blob, `wedgame_${Math.random().toString(36).slice(2, 10)}.png`);
  fd.append('overwrite', 'true');
  return (await j(base + '/upload/image', { method: 'POST', body: fd }, 30000)).name;
}

async function runGraph(base, graph, label, onStatus) {
  const res = await j(base + '/prompt', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: graph, client_id: 'wedgame' }) }, 15000);
  const pid = res.prompt_id;
  const t0 = performance.now();
  for (;;) {
    await new Promise((r) => setTimeout(r, 1000));
    const secs = Math.round((performance.now() - t0) / 1000);
    onStatus(`${label}… ${secs}s`);
    if (secs > 300) throw new Error('ComfyUI took too long.');
    const h = await j(`${base}/history/${pid}`, {}, 8000);
    if (!h[pid]) continue;
    const st = h[pid].status || {};
    if (st.status_str === 'error') throw new Error('ComfyUI reported an error running the workflow.');
    const out = h[pid].outputs && h[pid].outputs['99'];
    if (out && out.images && out.images[0]) {
      const im = out.images[0];
      const q = new URLSearchParams({ filename: im.filename, subfolder: im.subfolder || '', type: im.type || 'output' });
      return (await fetch(`${base}/view?${q}`, { headers: srvHeaders })).blob();
    }
  }
}

// Generate a custom face for `who` ('bride' | 'groom') plus its expression variants.
// With `photo` (a Blob) the uploaded photo is used instead of a description: it is cut out to head + neck
// on a transparent background (edit model, else plain background removal) and the variants are made from it.
// Returns { neutral: {dataURL, alpha}, variants: {name: {dataURL, alpha}}, back?: {dataURL, alpha}, editor }.
export async function generateFaces(who, description, userUrl, onStatus = () => {}, variantNames = [], photo = null) {
  if (CONFIG.comfyUI === 'off') throw new Error('ComfyUI is disabled on this build.');
  onStatus('Looking for ComfyUI…');
  const base = await findServer(userUrl);
  if (!base) throw new Error('ComfyUI not reachable. (Run it locally, or use "Upload photo" instead.)');
  onStatus('Picking a model…');
  const { m, info, editor } = await serverInfo(base);
  const W = WHO[who];
  const desc = description || W.fallback;
  const seed = () => Math.floor(Math.random() * 2 ** 31);
  const bg = editor && editor.kind === 'q21' ? 'fully transparent background (alpha)' : 'plain pure white background, with no white border or halo around the character';
  const ref = editor && editor.kind === 'q21' ? ' in <image1>' : '';
  const total = 1 + (editor ? variantNames.length + 1 : 0);
  const step = (i, what) => `Painting the ${W.label} (${i}/${total}: ${what})`;
  const edit = async (srcBlob, prompt, label) => {
    const inBlob = editor.kind === 'q21' ? srcBlob : await flattenOnWhite(srcBlob);
    const name = await upload(base, inBlob);
    const { graph, alpha } = editGraph(editor, name, prompt, seed());
    return { blob: await runGraph(base, graph, label, onStatus), alpha };
  };

  let neutral;
  if (photo) {
    photo = await shrink(photo);
    if (editor) {
      const prompt = `Cut out the head and neck of the person${ref}. Keep their face, identity, hairstyle, skin tone, expression and photographic look exactly the same. ` +
        'Remove everything else: background, shoulders, clothes and body. Show only the head and a bare neck, fully visible, ending in a straight cut at the bottom, ' +
        `front view, centered, with empty space around the head, and the ${bg}.`;
      neutral = await edit(photo, prompt, step(1, 'cutting out the photo'));
    } else if (info.RMBG) {
      const { graph, alpha } = rmbgGraph(await upload(base, photo));
      neutral = { blob: await runGraph(base, graph, step(1, 'removing the background'), onStatus), alpha };
    } else throw new Error('This ComfyUI has neither an image-edit model nor the RMBG node, so it cannot process a photo.');
  } else if (editor) {
    const tpl = await (await fetch(asset('assets/faces/_template.png'))).blob();
    const prompt = `Turn this bald cartoon person${ref} into ${W.person}: ${desc}. Give them funny exaggerated caricature features and big expressive eyes. ` +
      `Unless described otherwise above, their facial expression is ${W.mood}. ` +
      'Keep exactly the same head size, head position and framing. Keep the same bare neck, fully visible, ending in a straight cut at the bottom: ' +
      `no shoulders, no clothes. Keep the thick dark outline cartoon art style with vibrant colors and soft cel shading, and the ${bg}.`;
    neutral = await edit(tpl, prompt, step(1, 'face'));
  } else {
    const { graph, alpha } = t2iGraph(m, !!info.RMBG, T2I_STYLE + `${W.person}, ${desc}, ${W.mood}`, seed());
    neutral = { blob: await runGraph(base, graph, step(1, 'face'), onStatus), alpha };
  }
  const result = { neutral: { dataURL: await toDataURL(neutral.blob), alpha: neutral.alpha }, variants: {}, editor: editor ? editor.kind : null };
  if (editor) {
    let i = 1;
    for (const v of variantNames) {
      i++;
      if (!EXPR[v]) continue;
      const prompt = `Change the facial expression of the person${ref} only: ${EXPR[v]} Keep the exact same identity, hair, accessories, art style, framing, neck and the ${bg}.`;
      try {
        const r = await edit(neutral.blob, prompt, step(i, v.split('_')[1]));
        result.variants[v] = { dataURL: await toDataURL(r.blob), alpha: r.alpha };
      } catch (e) { /* this expression falls back to the neutral face */ }
    }
    try {
      const r = await edit(neutral.blob, BACK.replace('{ref}', ref).replace('{bg}', bg).replace('{style}', photo ? 'realistic photographic look' : 'thick dark outline cartoon art style'), step(total, 'back of the head'));
      result.back = { dataURL: await toDataURL(r.blob), alpha: r.alpha };
    } catch (e) { /* the game draws a procedural back instead */ }
  }
  return result;
}
