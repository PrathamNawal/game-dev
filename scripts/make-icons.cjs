/* Renders public/icons/icon.svg into the PNG sizes the manifest/iOS need, using Playwright's Chromium.
 * Usage: node scripts/make-icons.cjs   (outputs are committed; re-run only when the SVG changes) */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const dir = path.resolve(__dirname, '../public/icons');
const svg = fs.readFileSync(path.join(dir, 'icon.svg'), 'utf8');
const inner = svg.replace(/<svg[^>]*>/, '').replace('</svg>', '').replace(/<rect width="512" height="512" rx="112" fill="url\(#bg\)"\/>/, '');
const defs = (svg.match(/<defs>[\s\S]*?<\/defs>/) || [''])[0];
const bleed = (scale) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}<rect width="512" height="512" fill="url(#bg)"/><g transform="translate(${256 - 256 * scale} ${256 - 256 * scale}) scale(${scale})">${inner.replace(defs, '')}</g></svg>`;
(async () => {
  const b = await chromium.launch();
  const render = async (markup, size, file) => {
    const p = await b.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await p.setContent(`<body style="margin:0;background:transparent">${markup.replace('<svg ', `<svg width="${size}" height="${size}" `)}</body>`);
    await p.screenshot({ path: path.join(dir, file), omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
    await p.close(); console.log('wrote', file);
  };
  await render(svg, 192, 'icon-192.png');
  await render(svg, 512, 'icon-512.png');
  await render(bleed(0.8), 512, 'icon-maskable-512.png');   // Android adaptive-icon safe zone
  await render(bleed(0.92), 180, 'apple-touch-icon.png');   // iOS rounds the corners itself
  await b.close();
})();
