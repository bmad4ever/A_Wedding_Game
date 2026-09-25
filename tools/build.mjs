// Bundles the game into a single self-contained play.html (runs from file://, no server, no internet).
//   npm install && npm run build
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rel = (...p) => path.join(root, ...p);

const threePlugin = {
  name: 'three-vendor',
  setup(b) {
    b.onResolve({ filter: /^three$/ }, () => ({ path: rel('vendor/three.module.min.js') }));
    b.onResolve({ filter: /^three\/addons\// }, (a) => ({ path: rel('vendor/addons', a.path.replace(/^three\/addons\//, '')) }));
  },
};

// play.html runs from file:// with no server, so ComfyUI can't be reached: force comfyUI "off"
// (generator UI hidden at runtime) and swap src/comfy.js for a stub so it isn't bundled
const noComfyPlugin = {
  name: 'no-comfy',
  setup(b) {
    b.onLoad({ filter: /wedgame\.config\.json$/ }, () => ({ contents: JSON.stringify({ comfyUI: 'off' }), loader: 'json' }));
    b.onResolve({ filter: /^\.\/comfy\.js$/ }, () => ({ path: 'comfy-stub', namespace: 'no-comfy' }));
    b.onLoad({ filter: /.*/, namespace: 'no-comfy' }, () => ({
      contents: "export const generateFaces = () => Promise.reject(new Error('ComfyUI is not available in this build.'));", loader: 'js',
    }));
  },
};

const out = await esbuild.build({
  entryPoints: [rel('src/main.js')], bundle: true, format: 'iife', minify: true, write: false,
  target: 'es2020', plugins: [threePlugin, noComfyPlugin], legalComments: 'none',
});
const js = out.outputFiles[0].text;

// inline every asset as a data: URL
const MIME = { '.mp3': 'audio/mpeg', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.glb': 'model/gltf-binary', '.webp': 'image/webp' };
const assets = {};
const walk = (dir) => {
  for (const f of fs.readdirSync(rel(dir))) {
    const p = path.posix.join(dir, f);
    if (fs.statSync(rel(p)).isDirectory()) walk(p);
    else if (MIME[path.extname(f).toLowerCase()]) assets[p] = `data:${MIME[path.extname(f).toLowerCase()]};base64,` + fs.readFileSync(rel(p)).toString('base64');
  }
};
walk('assets');

let html = fs.readFileSync(rel('index.html'), 'utf8');
const css = fs.readFileSync(rel('style.css'), 'utf8');
html = html
  .replace(/<link rel="stylesheet" href="style.css">/, () => `<style>\n${css}\n</style>`)
  .replace(/<script type="importmap">[\s\S]*?<\/script>\n?/, '')
  .replace(/<script type="module" src="src\/main.js"><\/script>/, () =>
    `<script>window.__ASSETS=${JSON.stringify(assets)};</script>\n<script>\n${js.replace(/<\/script/gi, '<\/script')}\n</script>`);
fs.writeFileSync(rel('play.html'), html);
console.log(`play.html written: ${(html.length / 1048576).toFixed(1)} MB, ${Object.keys(assets).length} assets inlined`);
