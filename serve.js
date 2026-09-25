#!/usr/bin/env node
// Tiny zero-dependency static server for A Wedding Game.
// Also proxies /comfy/* to a local ComfyUI so the bride-face generator works
// without needing ComfyUI's CORS flag.
//
//   node serve.js [port] [comfyUrl]
//   e.g. node serve.js 8080 http://127.0.0.1:8188
//
// Then open http://localhost:8080/ (index.html = dev modules, play.html = bundled build).

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.argv[2] || process.env.PORT || '8080', 10);
// wedgame.config.json: comfyUI "full" | "locked" | "off" (see src/config.js), comfyUrl = default server
let CFG = {};
try { CFG = JSON.parse(fs.readFileSync(path.join(__dirname, 'wedgame.config.json'), 'utf8')); } catch (e) { /* defaults */ }
const MODE = ['full', 'locked', 'off'].includes(CFG.comfyUI) ? CFG.comfyUI : 'off';
const COMFY = (process.argv[3] || process.env.COMFY_URL || CFG.comfyUrl || 'http://127.0.0.1:8188').replace(/\/$/, '');
const ROOT = __dirname;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp',
  '.glb': 'model/gltf-binary', '.css': 'text/css', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.ogg': 'audio/ogg',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.md': 'text/markdown; charset=utf-8',
};

// The page may pick the ComfyUI server (title-screen "Server URL") via the x-comfy-target header;
// otherwise the command-line / env default is used.
function comfyBase(req) {
  const want = req.headers['x-comfy-target'];
  if (want && MODE === 'full') { // "locked": never let the page pick where the proxy connects
    try {
      const u = new URL(want);
      if (u.protocol === 'http:') return u.origin;
    } catch (e) { /* fall through to default */ }
  }
  return COMFY;
}

// "locked": only the calls the face generator makes (src/comfy.js), nothing else of ComfyUI's API
const LOCKED_API = /^\/comfy\/(system_stats|object_info\/\w+|upload\/image|prompt|history\/[\w-]+|view\?[^/]*)$/;

function proxy(req, res) {
  const base = comfyBase(req);
  const target = new URL(base + req.url.replace(/^\/comfy/, ''));
  const headers = { ...req.headers, host: target.host, origin: base };
  delete headers['x-comfy-target'];
  delete headers.referer;
  const p = http.request({
    hostname: target.hostname, port: target.port || 80, path: target.pathname + target.search,
    method: req.method, headers,
  }, (r) => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  p.on('error', () => { res.writeHead(502, { 'content-type': 'application/json' }); res.end('{"error":"comfyui unreachable"}'); });
  req.pipe(p);
}

http.createServer((req, res) => {
  if (req.url.startsWith('/comfy/') || req.url === '/comfy') {
    if (MODE === 'off') { res.writeHead(404); return res.end('comfyui disabled'); }
    if (MODE === 'locked' && !LOCKED_API.test(req.url)) { res.writeHead(403); return res.end('not allowed'); }
    return proxy(req, res);
  }
  let rel = decodeURIComponent(req.url.split('?')[0]);
  if (rel.endsWith('/')) rel += 'index.html';
  const file = path.normalize(path.join(ROOT, rel));
  if (!file.startsWith(ROOT)) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('not found'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log(`A Wedding Game -> http://localhost:${PORT}/   (ComfyUI ${MODE === 'off' ? 'disabled' : `proxy -> ${COMFY}${MODE === 'locked' ? ', locked' : ''}`})`);
});
