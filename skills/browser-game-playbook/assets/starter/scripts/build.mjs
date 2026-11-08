// Build: bundle src/main.js with esbuild, inject hashed asset names into index.html,
// copy /public, and generate the service worker with a precache manifest + content-hash version.
import * as esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const dev = process.argv.includes('--dev');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(path.join(dist, 'assets'), { recursive: true });

const result = await esbuild.build({
  entryPoints: { app: path.join(root, 'src/main.js') },
  outdir: path.join(dist, 'assets'),
  entryNames: '[name]-[hash]',
  bundle: true, minify: !dev, sourcemap: dev, format: 'esm', target: ['es2020', 'safari15', 'chrome90'],
  metafile: true, legalComments: 'none', logLevel: 'warning',
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __DEV__: JSON.stringify(dev), __ADS_MODE__: JSON.stringify(process.env.GAME_ADS === 'off' ? 'off' : 'demo') },
});

const outs = Object.keys(result.metafile.outputs).map(f => path.relative(dist, path.join(root, f)).replace(/\\/g, '/'));
const js = outs.find(f => f.endsWith('.js')), css = outs.find(f => f.endsWith('.css'));

// public/ -> dist/ (index.html and sw.js are templates)
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else if (!['index.html', 'sw.js'].includes(e.name) || src !== path.join(root, 'public')) fs.copyFileSync(s, d);
  }
}
copyDir(path.join(root, 'public'), dist);

let html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
html = html.replace('%JS%', js).replace('%CSS%', css);
fs.writeFileSync(path.join(dist, 'index.html'), html);

// Service worker with precache list + version derived from content.
const files = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p); else files.push(path.relative(dist, p).replace(/\\/g, '/'));
  }
})(dist);
const hash = crypto.createHash('sha1');
for (const f of files.sort()) hash.update(f).update(fs.readFileSync(path.join(dist, f)));
const version = hash.digest('hex').slice(0, 10);
const precache = ['./', ...files.filter(f => !f.endsWith('.map')).map(f => './' + f)];
let sw = fs.readFileSync(path.join(root, 'public/sw.js'), 'utf8');
sw = sw.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(precache));
fs.writeFileSync(path.join(dist, 'sw.js'), sw);

const size = f => fs.statSync(path.join(dist, f)).size;
const gzs = f => zlib.gzipSync(fs.readFileSync(path.join(dist, f))).length;
console.log(`built v${pkg.version} (${version}) — js ${(size(js) / 1024).toFixed(0)} KB (${(gzs(js) / 1024).toFixed(0)} KB gz), css ${(size(css) / 1024).toFixed(1)} KB, ${files.length} files`);
