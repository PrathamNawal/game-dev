/* End-to-end tests: drive the real production build in headless Chromium.
 * Usage: npm run build && npm run e2e [-- --shots]      (needs `playwright` + a Chromium build)
 * Uses low graphics + DPR 1 so a CPU rasterizer can keep up; physics is time-based, not frame-based. */
const path = require('path');
const { chromium, devices } = require('playwright');

const SHOTS = process.argv.includes('--shots');
const SHOT_DIR = path.resolve(__dirname, '../../docs/screenshots');
const PORT = 4173, BASE = `http://localhost:${PORT}/`;
const ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'];

const results = [];
async function test(name, fn) {
  const t0 = Date.now();
  try { await fn(); results.push({ name, ok: true, ms: Date.now() - t0 }); console.log(`  ok   ${name} (${Date.now() - t0} ms)`); }
  catch (e) { results.push({ name, ok: false, err: e }); console.log(`  FAIL ${name}\n       ${String(e.message).split('\n').slice(0, 4).join('\n       ')}`); }
}
const assert = (c, m) => { if (!c) throw new Error(m || 'assertion failed'); };
const eq = (a, b, m) => assert(a === b, `${m || 'eq'}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);

let browser;
async function open({ mobile = true, query = '?debug&q=low', seed = null, init = null, ctxOpts = {} } = {}) {
  const base = mobile ? { ...devices['iPhone 13'], deviceScaleFactor: 1 } : { viewport: { width: 1280, height: 800 } };
  const ctx = await browser.newContext({ ...base, ...ctxOpts });
  if (init) await ctx.addInitScript(init);
  if (seed) await ctx.addInitScript(s => { if (!localStorage.getItem('tilt.__seeded')) { localStorage.setItem('tilt.save', JSON.stringify(s)); localStorage.setItem('tilt.__seeded', '1'); } }, seed);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console.error: ' + m.text()); });
  await page.goto(BASE + query);
  await page.waitForSelector('.L-menu, .L-hud');
  return { ctx, page, errors };
}
const save = page => page.evaluate(() => JSON.parse(localStorage.getItem('tilt.save') || 'null'));
const app = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { if (SHOTS) { await page.waitForTimeout(1100); await page.screenshot({ path: path.join(SHOT_DIR, name + '.png') }); } };
const base = (over = {}) => ({ version: 1, coins: 30, level: 1, stars: {}, best: {}, daily: { last: null, streak: 0, bestStreak: 0, done: [] },
  settings: { sound: true, haptics: true, controls: 'auto', sensitivity: 1, quality: 'high', assist: false },
  flags: { tutorialSeen: false, motionAsked: false, noAds: false }, stats: {}, ...over });

(async () => {
  const { serve } = await import('../../scripts/serve.mjs');
  const server = await serve(PORT);
  browser = await chromium.launch({ args: ARGS });
  console.log('Tilt e2e');

  await test('boot: menu renders, WebGL scene live, no console errors', async () => {
    const { ctx, page, errors } = await open();
    await page.waitForTimeout(1200);
    eq(await page.locator('[data-act=play]').count(), 1);
    const calls = await app(page, () => window.__tilt.renderer.gl.info.render.calls);
    assert(calls > 5, 'scene should have draw calls, got ' + calls);
    await shot(page, '01-menu');
    eq(errors.length, 0, errors.join(' | ')); await ctx.close();
  });

  await test('play: HUD + tutorial coach; keyboard moves the marble and starts the timer', async () => {
    const { ctx, page, errors } = await open();
    await page.click('[data-act=play]'); await page.waitForSelector('.hud');
    assert(await page.locator('.coach').count() === 1, 'tutorial coach shown on level 1');
    eq(await page.locator('.hud-label').innerText(), 'Level 1');
    const dir = await app(page, () => { const L = window.__tilt.run.level, c = L.cells[L.start.y * L.w + L.start.x]; return (c & 2) ? 'ArrowUp' : 'ArrowRight'; });
    const x0 = await app(page, () => [window.__tilt.run.world.x, window.__tilt.run.world.y]);
    await page.keyboard.down(dir); await page.waitForTimeout(700); await page.keyboard.up(dir);
    const st = await app(page, () => ({ started: window.__tilt.run.started, t: window.__tilt.run.time, p: [window.__tilt.run.world.x, window.__tilt.run.world.y] }));
    assert(st.started && st.t > 0, 'timer started');
    assert(Math.abs(st.p[0] - x0[0]) + Math.abs(st.p[1] - x0[1]) > 0.1, 'marble moved ' + JSON.stringify([x0, st.p]));
    assert(await page.locator('.coach').count() === 0, 'coach dismissed on first motion');
    await shot(page, '02-play');
    eq(errors.length, 0, errors.join(' | ')); await ctx.close();
  });

  await test('win flow: autopilot clears level 1 -> stars, coins, progress saved', async () => {
    const { ctx, page, errors } = await open({ query: '?debug&auto&q=low' });
    await page.click('[data-act=play]');
    await page.waitForSelector('.modal.win', { timeout: 60000 });
    assert(await page.locator('.modal.win .star.on').count() >= 1, 'at least one star');
    const s = await save(page);
    eq(s.level, 2, 'level unlocked'); assert(s.coins > 30, 'coins awarded: ' + s.coins); assert(s.stars['1'] >= 1, 'stars saved'); assert(s.best['1'] > 0, 'best time saved');
    await shot(page, '03-win');
    await page.click('[data-act=next]'); await page.waitForSelector('.hud');
    eq(await page.locator('.hud-label').innerText(), 'Level 2', 'next level starts');
    eq(errors.length, 0, errors.join(' | ')); await ctx.close();
  });

  await test('persistence: progress survives reload', async () => {
    const { ctx, page } = await open({ seed: base({ level: 7, coins: 91, stars: { 1: 3 } }) });
    await page.reload(); await page.waitForSelector('.L-menu');
    assert((await page.locator('[data-act=play]').innerText()).includes('Level 7'), 'menu shows level 7');
    assert((await page.locator('#menu-coins').innerText()).includes('91'), 'coins shown');
    await ctx.close();
  });

  await test('hint: paid hint deducts 15 coins and draws the path', async () => {
    const { ctx, page } = await open({ seed: base({ coins: 50, flags: { tutorialSeen: true } }) });
    await page.click('[data-act=play]'); await page.waitForSelector('.hud');
    await page.click('#hint-btn');
    await page.waitForFunction(() => window.__tilt.renderer.hintGroup != null);
    eq((await save(page)).coins, 35, 'coins after hint');
    await shot(page, '04-hint');
    await ctx.close();
  });

  await test('hint: with 0 coins offers a rewarded (demo) ad, then grants the hint free', async () => {
    const { ctx, page } = await open({ seed: base({ coins: 0, flags: { tutorialSeen: true } }) });
    await page.click('[data-act=play]'); await page.waitForSelector('.hud');
    await page.click('#hint-btn');
    await page.waitForSelector('.L-confirm');
    await page.click('[data-c="1"]');
    await page.waitForSelector('.L-ad');
    assert((await page.locator('.L-ad').innerText()).includes('DEMO AD'), 'ad is labelled as demo');
    await page.waitForSelector('#ad-close:has-text("Claim reward")', { timeout: 10000 });
    await shot(page, '05-ad');
    await page.click('#ad-close');
    await page.waitForFunction(() => window.__tilt.renderer.hintGroup != null);
    eq((await save(page)).coins, 0, 'no coins spent'); eq((await save(page)).stats.adsWatched, 1, 'ad counted');
    await ctx.close();
  });

  await test('ads off mode: no ad UI anywhere; 0-coin hint/skip explain instead of showing ads', async () => {
    const { ctx, page, errors } = await open({ query: '?debug&q=low&ads=off', seed: base({ coins: 0, level: 2, flags: { tutorialSeen: true } }) });
    await page.click('[data-act=play]'); await page.waitForSelector('.hud');
    await page.click('#hint-btn'); await page.waitForSelector('.toast');
    eq(await page.locator('.L-confirm, .L-ad').count(), 0, 'no ad/confirm dialog');
    eq(await app(page, () => window.__tilt.renderer.hintGroup), null, 'no free hint without coins or ads');
    await page.click('[data-act=pause]'); await page.click('[data-act=skip]');
    await page.waitForFunction(() => [...document.querySelectorAll('.toast')].some(t => t.textContent.includes('Skipping costs')));
    eq(await page.locator('.L-ad').count(), 0);
    eq(errors.length, 0, errors.join(' | ')); await ctx.close();
  });

  await test('ads off mode: win screen has no "double coins" ad button', async () => {
    const { ctx, page } = await open({ query: '?debug&auto&q=low&ads=off', seed: base({ flags: { tutorialSeen: true } }) });
    await page.click('[data-act=play]'); await page.waitForSelector('.modal.win', { timeout: 60000 });
    eq(await page.locator('#double-btn').count(), 0); await ctx.close();
  });

  await test('daily: clear -> streak 1, rewards, menu shows done; second claim pays nothing', async () => {
    const { ctx, page, errors } = await open({ query: '?debug&auto&q=low' });
    await page.click('[data-act=daily]'); await page.waitForSelector('.hud');
    assert((await page.locator('.hud-label').innerText()).startsWith('Daily'), 'daily label');
    await page.waitForSelector('.modal.win', { timeout: 90000 });
    assert((await page.locator('.modal.win h2').innerText()).includes('Daily cleared'), 'title');
    let s = await save(page);
    eq(s.daily.streak, 1); assert(s.coins >= 40, 'daily pays >= 10: ' + s.coins); eq(s.stats.dailyClears, 1);
    await page.click('[data-act=next]'); await page.waitForSelector('.L-menu');
    assert((await page.locator('[data-act=daily]').innerText()).includes('Done today'), 'menu reflects completion');
    const coins1 = (await save(page)).coins;
    await page.click('[data-act=daily]'); await page.waitForSelector('.modal.win', { timeout: 90000 });
    eq((await save(page)).coins, coins1, 'no double payout'); eq((await save(page)).daily.streak, 1);
    eq(errors.length, 0, errors.join(' | ')); await ctx.close();
  });

  await test('pause: button + Escape toggle, restart and menu work', async () => {
    const { ctx, page } = await open({ seed: base({ flags: { tutorialSeen: true } }) });
    await page.click('[data-act=play]'); await page.waitForSelector('.hud');
    await page.click('[data-act=pause]'); await page.waitForSelector('.L-pause');
    eq(await app(page, () => window.__tilt.mode), 'paused');
    await shot(page, '06-pause');
    await page.keyboard.press('Escape'); await page.waitForSelector('.L-pause', { state: 'detached' });
    eq(await app(page, () => window.__tilt.mode), 'playing');
    await page.click('[data-act=pause]'); await page.click('[data-act=restart]'); await page.waitForSelector('.hud');
    await page.click('[data-act=pause]'); await page.click('[data-act=menu]'); await page.waitForSelector('.L-menu');
    await ctx.close();
  });

  await test('auto-pause when the tab is hidden', async () => {
    const { ctx, page } = await open({ seed: base({ flags: { tutorialSeen: true } }) });
    await page.click('[data-act=play]'); await page.waitForSelector('.hud');
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
    eq(await app(page, () => window.__tilt.mode), 'paused'); await ctx.close();
  });

  await test('settings: toggles persist across reload', async () => {
    const { ctx, page } = await open();
    await page.click('[data-act=settings]'); await page.waitForSelector('.L-settings');
    await shot(page, '07-settings');
    await page.locator('input[data-set=sound]').click();
    await page.locator('input[data-set=assist]').click();
    await page.locator('input[data-seg=quality][value=low]').check({ force: true });
    await page.waitForTimeout(100);
    let s = await save(page);
    eq(s.settings.sound, false); eq(s.settings.assist, true); eq(s.settings.quality, 'low');
    await page.reload(); await page.waitForSelector('.L-menu');
    await page.click('[data-act=settings]'); await page.waitForSelector('.L-settings');
    eq(await page.locator('input[data-set=sound]').isChecked(), false);
    eq(await page.locator('input[data-set=assist]').isChecked(), true);
    await ctx.close();
  });

  await test('settings: reset progress asks for confirmation and clears the save', async () => {
    const { ctx, page } = await open({ seed: base({ level: 12, coins: 500 }) });
    await page.click('[data-act=settings]'); await page.click('[data-act=resetProgress]');
    await page.waitForSelector('.L-confirm'); await page.click('[data-c="1"]');
    await page.waitForSelector('.L-menu');
    assert((await page.locator('[data-act=play]').innerText()).includes('Level 1'), 'back to level 1');
    await ctx.close();
  });

  await test('gyro: granted permission -> tilt drives the marble; recalibrate button present', async () => {
    const init = () => {
      DeviceOrientationEvent.requestPermission = async () => 'granted';
      window.__pose = { beta: 40, gamma: 0 };
      setInterval(() => dispatchEvent(Object.assign(new Event('deviceorientation'), window.__pose)), 16);
    };
    const { ctx, page, errors } = await open({ init, seed: base({ flags: { tutorialSeen: true } }) });
    await page.click('[data-act=play]'); await page.waitForSelector('.hud');
    await page.waitForSelector('[data-act=recal]');
    await page.evaluate(() => { window.__pose = { beta: 40, gamma: 14 }; });   // roll phone right
    await page.waitForFunction(() => window.__tilt.run.tilt.x > 0.3, null, { timeout: 5000 });
    await page.evaluate(() => { window.__pose = { beta: 40, gamma: 14 }; window.__tilt.input.recalibrate(); });  // new neutral
    await page.waitForFunction(() => Math.abs(window.__tilt.run.tilt.x) < 0.1, null, { timeout: 5000 });
    await shot(page, '08-gyro');
    eq(errors.length, 0, errors.join(' | ')); await ctx.close();
  });

  await test('gyro: permission denied -> graceful fallback to touch, game still playable', async () => {
    const init = () => { DeviceOrientationEvent.requestPermission = async () => 'denied'; };
    const { ctx, page } = await open({ init, seed: base({ flags: { tutorialSeen: true } }) });
    await page.click('[data-act=play]'); await page.waitForSelector('.hud');
    assert(await page.locator('.toast').count() >= 1, 'user is told');
    eq(await app(page, () => window.__tilt.input.usingGyro), false);
    eq(await page.locator('[data-act=recal]').count(), 0, 'no recalibrate button without gyro');
    await ctx.close();
  });

  await test('skip level: costs 40 coins, unlocks next', async () => {
    const { ctx, page } = await open({ seed: base({ coins: 100, level: 3, flags: { tutorialSeen: true } }) });
    await page.click('[data-act=play]'); await page.waitForSelector('.hud');
    await page.click('[data-act=pause]'); await page.click('[data-act=skip]');
    await page.waitForSelector('.L-confirm'); await page.click('[data-c="1"]');
    await page.waitForFunction(() => document.querySelector('.hud-label')?.textContent === 'Level 4');
    const s = await save(page); eq(s.coins, 60); eq(s.level, 4); eq(s.stats.skips, 1);
    await ctx.close();
  });

  await test('level select: pages, shows stars, starts the chosen level', async () => {
    const { ctx, page } = await open({ seed: base({ level: 25, stars: { 1: 3, 2: 2 }, flags: { tutorialSeen: true } }) });
    await page.click('[data-act=levels]'); await page.waitForSelector('.L-levels');
    eq(await page.locator('.lv').count(), 5, 'page 2 of 25 unlocked shows levels 21-25');
    await page.click('[data-act=levelsPage][data-page="0"]');
    eq(await page.locator('.lv').count(), 20, 'page 1 shows 20');
    assert((await page.locator('.lv[data-n="1"]').getAttribute('aria-label')).includes('3 stars'), 'level 1 has 3 stars');
    await shot(page, '11-levels');
    await page.click('.lv[data-n="2"]'); await page.waitForFunction(() => document.querySelector('.hud-label')?.textContent === 'Level 2');
    await ctx.close();
  });

  await test('touch stick (pointer drag) rolls the marble on a desktop viewport', async () => {
    const { ctx, page } = await open({ mobile: false, seed: base({ flags: { tutorialSeen: true } }) });
    await page.click('[data-act=play]'); await page.waitForSelector('.hud');
    await page.mouse.move(640, 500); await page.mouse.down(); await page.mouse.move(700, 500, { steps: 4 });
    await page.waitForFunction(() => window.__tilt.run.tilt.x > 0.5, null, { timeout: 4000 });
    assert(await page.locator('#stick:not([hidden])').count() === 1, 'stick visual shown');
    await page.mouse.up();
    await page.waitForFunction(() => Math.abs(window.__tilt.run.tilt.x) < 0.01, null, { timeout: 4000 });
    await shot(page, '09-desktop-play'); await ctx.close();
  });

  await test('desktop layout: no horizontal scroll; menu usable', async () => {
    const { ctx, page } = await open({ mobile: false });
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    assert(w[0] <= w[1], 'overflow ' + w); await shot(page, '10-desktop-menu'); await ctx.close();
  });

  await test('modals fit the viewport (no horizontal overflow) on a small phone', async () => {
    const { ctx, page } = await open({ ctxOpts: { viewport: { width: 320, height: 568 } }, query: '?debug&auto&q=low', seed: base({ flags: { tutorialSeen: true } }) });
    await page.click('[data-act=play]'); await page.waitForSelector('.modal.win', { timeout: 60000 });
    await page.waitForTimeout(400);
    const bad = await page.evaluate(() => {
      const card = document.querySelector('.modal.win .card'), c = card.getBoundingClientRect(), out = [];
      if (c.left < 0 || c.right > innerWidth) out.push('card outside viewport');
      for (const el of card.querySelectorAll('*')) { const r = el.getBoundingClientRect(); if (r.width && (r.right > c.right + 1 || r.left < c.left - 1)) out.push(el.tagName + '.' + el.className + ' ' + Math.round(r.left) + '-' + Math.round(r.right)); }
      return out;
    });
    assert(bad.length === 0, 'overflowing: ' + bad.slice(0, 4).join(' | '));
    await ctx.close();
  });

  await test('no GPU resource leak: 60 level loads keep geometries/textures bounded', async () => {
    const { ctx, page, errors } = await open({ seed: base({ flags: { tutorialSeen: true } }) });
    await page.click('[data-act=play]'); await page.waitForSelector('.hud');
    // Load levels through the real app path (journey levels 1..60) and sample GPU memory counters.
    const samples = [];
    for (let n = 1; n <= 60; n++) {
      await page.evaluate(n => window.__tilt.beginJourney(n), n);
      if (n % 20 === 0) samples.push(await page.evaluate(() => ({ g: window.__tilt.renderer.gl.info.memory.geometries, tx: window.__tilt.renderer.gl.info.memory.textures })));
    }
    assert(samples[2].g <= samples[0].g + 4 && samples[2].tx <= samples[0].tx + 4, 'GPU memory grew: ' + JSON.stringify(samples));
    eq(errors.length, 0, errors.join(' | ')); await ctx.close();
  });

  await test('reduced motion: game runs without errors', async () => {
    const { ctx, page, errors } = await open({ ctxOpts: { reducedMotion: 'reduce' }, query: '?debug&auto&q=low', seed: base({ flags: { tutorialSeen: true } }) });
    await page.click('[data-act=play]'); await page.waitForSelector('.modal.win', { timeout: 60000 });
    eq(await app(page, () => window.__tilt.renderer.reducedMotion), true); eq(errors.length, 0, errors.join(' | ')); await ctx.close();
  });

  await test('offline: service worker precaches the app; reload works with no network', async () => {
    const { ctx, page } = await open({ query: '?debug&q=low' });
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload(); await page.waitForSelector('.L-menu');       // now controlled by the SW
    await page.waitForFunction(() => navigator.serviceWorker.controller != null);
    await ctx.setOffline(true);
    await page.reload(); await page.waitForSelector('.L-menu');
    await page.click('[data-act=play]'); await page.waitForSelector('.hud');
    await ctx.setOffline(false); await ctx.close();
  });

  await browser.close(); server.close();
  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
