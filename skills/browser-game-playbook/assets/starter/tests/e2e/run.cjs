/* End-to-end tests against the PRODUCTION build in headless Chromium.
 * Usage: npm run build && npm run e2e [-- --shots]
 * Encodes the lessons from the Tilt build: look at what users see (children inside bounds, real clicks through
 * overlays), audit a11y with axe, prove offline, and keep a software-GL-friendly setup (low DPR). */
const path = require('path'), fs = require('fs');
const { chromium, devices } = require('playwright');
const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');
const SHOTS = process.argv.includes('--shots'), SHOT_DIR = path.resolve(__dirname, '../../docs/screenshots');
const PORT = 4173, BASE = `http://localhost:${PORT}/`;
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];
const SAVE_KEY = '__SLUG__.save';

const results = [];
async function test(name, fn) {
  const t0 = Date.now();
  try { await fn(); results.push({ name, ok: true }); console.log(`  ok   ${name} (${Date.now() - t0} ms)`); }
  catch (e) { results.push({ name, ok: false }); console.log(`  FAIL ${name}\n       ${String(e.message).split('\n').slice(0, 4).join('\n       ')}`); }
}
const assert = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const eq = (a, b, m) => assert(a === b, `${m || 'eq'}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

let browser;
const baseSave = (over = {}) => ({ version: 1, coins: 30, level: 1, stars: {}, best: {}, daily: { last: null, streak: 0, bestStreak: 0, done: [] },
  settings: { sound: true, haptics: true, controls: 'auto', sensitivity: 1, quality: 'high', assist: false },
  flags: { tutorialSeen: true, motionAsked: false, noAds: false }, stats: {}, ...over });

async function open({ mobile = true, query = '?debug&ads=off', seed = null, ctxOpts = {}, init = null } = {}) {
  const dev = mobile ? { ...devices['iPhone 13'], deviceScaleFactor: 1 } : { viewport: { width: 1280, height: 800 } };
  const ctx = await browser.newContext({ ...dev, ...ctxOpts });
  // Chromium answers requestPermission() with 'prompt' without a gesture; stub it so default runs are quiet.
  await ctx.addInitScript(() => { if (typeof DeviceOrientationEvent !== 'undefined') DeviceOrientationEvent.requestPermission = async () => 'granted'; });
  if (init) await ctx.addInitScript(init);
  if (seed) await ctx.addInitScript(([k, s]) => { if (!localStorage.getItem('__seeded')) { localStorage.setItem(k, JSON.stringify(s)); localStorage.setItem('__seeded', '1'); } }, [SAVE_KEY, seed]);
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });   // CSP violations land here too
  await page.goto(BASE + query); await page.waitForSelector('.L-menu, .L-hud');
  return { ctx, page, errors };
}
const readSave = page => page.evaluate(k => JSON.parse(localStorage.getItem(k) || 'null'), SAVE_KEY);
const shot = async (page, name) => { if (SHOTS) { await page.waitForTimeout(1100); await page.screenshot({ path: path.join(SHOT_DIR, name + '.png') }); } };   // wait: animations!

/** Play the current round by tapping each target. Replace with your game's own "solve it" driver. */
async function solveRound(page) {
  const n = await page.evaluate(() => window.__game.round.targets.length);
  for (let i = 0; i < n; i++) {
    const pt = await page.evaluate(() => { const g = window.__game, r = document.getElementById('c').getBoundingClientRect(), t = g.round.targets[g.idx]; return { x: r.left + t.x * r.width, y: r.top + t.y * r.height }; });
    await page.mouse.click(pt.x, pt.y);    // a REAL click: proves no invisible overlay is swallowing input
  }
}

(async () => {
  const { serve } = await import('../../scripts/serve.mjs');
  const server = await serve(PORT);
  browser = await chromium.launch({ args: ARGS });
  console.log('e2e');

  await test('boot: menu renders with no console errors (incl. CSP violations)', async () => {
    const { ctx, page, errors } = await open();
    eq(await page.locator('[data-act=play]').count(), 1); await shot(page, '01-menu');
    eq(errors.length, 0, errors.join(' | ')); await ctx.close();
  });

  await test('play -> real clicks through the HUD layer -> win -> progress saved', async () => {
    const { ctx, page, errors } = await open();
    await page.click('[data-act=play]'); await page.waitForSelector('.hud');
    await solveRound(page); await page.waitForSelector('.modal.win'); await shot(page, '02-win');
    const s = await readSave(page); eq(s.level, 2); assert(s.coins > 30, 'coins awarded');
    await page.click('[data-act=next]'); await page.waitForSelector('.hud');
    eq(await page.locator('.hud-label').innerText(), 'Level 2');
    eq(errors.length, 0, errors.join(' | ')); await ctx.close();
  });

  await test('persistence: progress survives reload', async () => {
    const { ctx, page } = await open({ seed: baseSave({ level: 7, coins: 91 }) });
    await page.reload(); await page.waitForSelector('.L-menu');
    assert((await page.locator('[data-act=play]').innerText()).includes('Level 7')); await ctx.close();
  });

  await test('pause: button + Escape-free resume; auto-pause when tab hidden', async () => {
    const { ctx, page } = await open();
    await page.click('[data-act=play]'); await page.waitForSelector('.hud');
    await page.click('[data-act=pause]'); await page.waitForSelector('.L-pause');
    await page.click('[data-act=resume]'); await page.waitForSelector('.L-pause', { state: 'detached' });
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    eq(await page.evaluate(() => window.__game.mode), 'paused'); await ctx.close();
  });

  await test('settings persist across reload', async () => {
    const { ctx, page } = await open();
    await page.click('[data-act=settings]'); await page.waitForSelector('.L-settings');
    await page.locator('input[data-set=sound]').click(); await page.waitForTimeout(100);
    eq((await readSave(page)).settings.sound, false);
    await page.reload(); await page.waitForSelector('.L-menu'); await page.click('[data-act=settings]');
    eq(await page.locator('input[data-set=sound]').isChecked(), false); await ctx.close();
  });

  await test('ads off: win screen has no ad button', async () => {
    const { ctx, page } = await open();
    await page.click('[data-act=play]'); await page.waitForSelector('.hud'); await solveRound(page); await page.waitForSelector('.modal.win');
    eq(await page.locator('#double-btn').count(), 0); await ctx.close();
  });

  await test('layout: no horizontal scroll; every modal child fits at 320 px', async () => {
    const { ctx, page } = await open({ ctxOpts: { viewport: { width: 320, height: 568 } } });
    await page.click('[data-act=play]'); await page.waitForSelector('.hud'); await solveRound(page); await page.waitForSelector('.modal.win');
    await page.waitForTimeout(400);
    const bad = await page.evaluate(() => {   // check CHILDREN, not just the card: overflow hides inside a card that itself fits
      const out = [], card = document.querySelector('.modal.win .card'), c = card.getBoundingClientRect();
      if (c.left < 0 || c.right > innerWidth) out.push('card outside viewport');
      for (const el of card.querySelectorAll('*')) { const r = el.getBoundingClientRect(); if (r.width && (r.right > c.right + 1 || r.left < c.left - 1)) out.push(el.tagName + '.' + el.className); }
      if (document.documentElement.scrollWidth > innerWidth) out.push('page scrolls horizontally');
      return out;
    });
    assert(bad.length === 0, 'overflow: ' + bad.slice(0, 4).join(' | ')); await ctx.close();
  });

  await test('accessibility: axe-core (WCAG A/AA + best-practice) finds nothing on any screen', async () => {
    const { ctx, page } = await open({ ctxOpts: { bypassCSP: true }, seed: baseSave({ coins: 50, level: 3, stars: { 1: 3, 2: 2 } }) });   // bypassCSP: ONLY for injecting axe
    const audit = async name => {
      await page.addScriptTag({ content: AXE }); await page.waitForTimeout(450);
      const v = await page.evaluate(async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'best-practice'] })).violations.map(x => x.id + ' x' + x.nodes.length));
      assert(v.length === 0, `${name}: ${v.join(' ; ')}`);
    };
    await audit('menu');
    await page.click('[data-act=settings]'); await page.waitForSelector('.L-settings'); await audit('settings'); await page.click('[data-act=closeSettings]');
    await page.click('[data-act=levels]'); await page.waitForSelector('.L-levels'); await audit('levels'); await page.click('[data-act=closeLevels]');
    await page.click('[data-act=play]'); await page.waitForSelector('.hud'); await audit('hud');
    await solveRound(page); await page.waitForSelector('.modal.win'); await audit('win'); await ctx.close();
  });

  await test('offline: service worker precaches the app; reload + play with no network', async () => {
    const { ctx, page } = await open();
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload(); await page.waitForFunction(() => navigator.serviceWorker.controller != null);
    await ctx.setOffline(true); await page.reload(); await page.waitForSelector('.L-menu');
    await page.click('[data-act=play]'); await page.waitForSelector('.hud'); await ctx.setOffline(false); await ctx.close();
  });

  await browser.close(); server.close();
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
