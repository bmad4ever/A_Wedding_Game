// Deployment settings, from wedgame.config.json (also read by serve.js and bundled by tools/build.mjs).
//   comfyUI: "full"   - face generator + editable Server URL (local / dev use)
//            "locked" - face generator only talks to the default server (serve.js's proxy target, else comfyUrl);
//                       the Server URL field is gone and serve.js ignores any target the page asks for
//            "off"    - no ComfyUI at all: generator hidden, serve.js's /comfy proxy disabled
//   comfyUrl: the default ComfyUI server (used directly when the page is not served by serve.js)
import cfg from '../wedgame.config.json' with { type: 'json' };

const MODES = ['full', 'locked', 'off'];
export const CONFIG = {
  comfyUI: MODES.includes(cfg.comfyUI) ? cfg.comfyUI : 'off', // unknown value: fail closed
  comfyUrl: cfg.comfyUrl || 'http://127.0.0.1:8188',
};
