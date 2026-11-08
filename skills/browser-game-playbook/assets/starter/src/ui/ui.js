// DOM overlay UI. Static markup via template strings (no user-supplied HTML ever reaches innerHTML),
// behaviour via delegated `data-act` clicks routed to the handlers passed in by the App.
import { ICON } from './icons.js';

const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const starRow = (n, total = 3) => Array.from({ length: total }, (_, i) => `<span class="star ${i < n ? 'on' : ''}" style="--i:${i}">${ICON.star}</span>`).join('');
const coinPill = (v, id = '') => `<div class="coinpill" ${id ? `id="${id}"` : ''} aria-label="Coins">${ICON.coin}<b>${esc(v)}</b></div>`;
const fmt = t => (t >= 60 ? `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}` : t.toFixed(1));

export class UI {
  /** @param {HTMLElement} root  @param {Record<string, Function>} actions */
  constructor(root, actions) {
    this.root = root; this.actions = actions;
    this.layers = {};
    root.addEventListener('click', e => {
      const el = e.target.closest('[data-act]'); if (!el) return;
      this.actions.sfx?.('click');
      this.actions[el.dataset.act]?.(el.dataset);
    });
    root.addEventListener('input', e => {
      const el = e.target.closest('[data-set]'); if (!el) return;
      const v = el.type === 'checkbox' ? el.checked : el.type === 'range' ? parseFloat(el.value) : el.value;
      this.actions.setSetting?.(el.dataset.set, v);
    });
    root.addEventListener('change', e => {
      const el = e.target.closest('[data-seg]'); if (!el) return;
      this.actions.setSetting?.(el.dataset.seg, el.value);
    });
  }

  _layer(name, html, cls = '') {
    this._drop(name);
    const el = document.createElement('div');
    el.className = `layer L-${name} ${cls}`; el.innerHTML = html;
    this.root.appendChild(el); this.layers[name] = el;
    return el;
  }
  _drop(name) { const l = this.layers[name]; if (l) { l.remove(); delete this.layers[name]; } }
  hideAll() { for (const k of Object.keys(this.layers)) this._drop(k); }
  _focus(el, sel = '.primary') { const b = el.querySelector(sel) || el.querySelector('button'); b?.focus({ preventScroll: true }); }

  // ---------- Menu ----------
  showMenu({ level, coins, daily, canInstall }) {
    this.hideAll();
    const dailySub = daily.done ? `Done today · ${daily.streak}-day streak` : (daily.streak ? `${daily.streak}-day streak — keep it going` : 'New puzzle every day');
    const el = this._layer('menu', `
      <section class="screen menu" data-ui>
        <div class="menu-top">${coinPill(coins, 'menu-coins')}</div>
        <div class="brand"><h1>__NAME_UPPER__</h1><p>__TAGLINE__</p></div>
        <div class="stack">
          <button class="btn primary big" data-act="play"><span class="ico">${ICON.play}</span><span>Play<small>Level ${esc(level)}</small></span></button>
          <button class="btn gold big" data-act="daily"><span class="ico">${ICON.flame}</span><span>Daily Challenge<small>${esc(dailySub)}</small></span></button>
          <div class="row">
            <button class="btn ghost" data-act="levels">${ICON.levels}<span>Levels</span></button>
            <button class="btn ghost" data-act="settings">${ICON.sliders}<span>Settings</span></button>
            ${canInstall ? `<button class="btn ghost" data-act="install">${ICON.install}<span>Install</span></button>` : ''}
          </div>
        </div>
        <p class="tip">__TIP__</p>
      </section>`);
    this._focus(el);
  }

  // ---------- HUD ----------
  showHud({ label, coins, hintCost, showRecal, daily }) {
    this._drop('menu');
    this._layer('hud', `
      <div class="hud">
        <div class="hud-top">
          <button class="iconbtn" data-act="pause" data-ui aria-label="Pause">${ICON.pause}</button>
          <div class="hud-center"><div class="hud-label">${esc(label)}</div><div class="hud-time" id="hud-time" aria-live="off">0.0</div></div>
          ${coinPill(coins, 'hud-coins')}
        </div>
        <div class="pips" id="pips" role="img" aria-label="0 of 3 coins collected">${[0, 1, 2].map(i => `<i data-i="${i}"></i>`).join('')}</div>
        <div class="hud-bottom">
          <button class="btn small" id="hint-btn" data-act="hint" data-ui aria-label="Show hint">${ICON.hint}<span>Hint</span><em>${ICON.coin}${esc(hintCost)}</em></button>
          ${showRecal ? `<button class="iconbtn" data-act="recal" data-ui aria-label="Recalibrate motion controls">${ICON.recal}</button>` : ''}
        </div>
      </div>
      <div class="stick" id="stick" hidden><i></i></div>`);
    this.hud = {
      time: document.getElementById('hud-time'), coins: document.getElementById('hud-coins')?.querySelector('b'),
      pips: [...document.querySelectorAll('#pips i')], hint: document.getElementById('hint-btn'), stick: document.getElementById('stick'),
    };
    this._lastTime = ''; this._lastPips = -1;
  }
  updateHud({ time, pips, coins }) {
    if (!this.hud) return;
    const t = fmt(time);
    if (t !== this._lastTime) { this.hud.time.textContent = t; this._lastTime = t; }
    if (pips !== this._lastPips) {
      this.hud.pips.forEach((p, i) => p.classList.toggle('on', i < pips)); this._lastPips = pips;
      this.hud.pips[0]?.parentElement.setAttribute('aria-label', `${pips} of 3 coins collected`);
    }
    if (coins != null && this.hud.coins && this.hud.coins.textContent !== String(coins)) this.hud.coins.textContent = coins;
  }
  setHintPulse(on) { this.hud?.hint?.classList.toggle('pulse', !!on); }
  updateStick(stick) {
    const el = this.hud?.stick; if (!el) return;
    if (!stick.active) { el.hidden = true; return; }
    el.hidden = false;
    el.style.transform = `translate(${stick.ox}px, ${stick.oy}px)`;
    el.firstElementChild.style.transform = `translate(${stick.x * 44}px, ${stick.y * 44}px)`;
  }
  showCoach(text) { this._layer('coach', `<div class="coach" role="status">${esc(text)}</div>`); }
  hideCoach() { this._drop('coach'); }

  // ---------- Pause ----------
  showPause({ skipCost, canSkip, showRecal }) {
    const el = this._layer('pause', `
      <div class="modal" data-ui role="dialog" aria-modal="true" aria-labelledby="pz">
        <div class="card">
          <h2 id="pz">Paused</h2>
          <button class="btn primary" data-act="resume">${ICON.play}<span>Resume</span></button>
          <div class="grid2">
            <button class="btn ghost" data-act="restart">${ICON.restart}<span>Restart</span></button>
            <button class="btn ghost" data-act="settings">${ICON.sliders}<span>Settings</span></button>
            ${showRecal ? `<button class="btn ghost" data-act="recal">${ICON.recal}<span>Recalibrate</span></button>` : ''}
            ${canSkip ? `<button class="btn ghost" data-act="skip">${ICON.skip}<span>Skip ${ICON.coin}${esc(skipCost)}</span></button>` : ''}
          </div>
          <button class="btn ghost" data-act="menu">${ICON.home}<span>Main menu</span></button>
        </div>
      </div>`);
    this._focus(el);
  }
  hidePause() { this._drop('pause'); }

  // ---------- Win ----------
  showWin(r) {
    const el = this._layer('win', `
      <div class="modal win" data-ui role="dialog" aria-modal="true" aria-labelledby="wz">
        <div class="card">
          <h2 id="wz">${esc(r.title)}</h2>
          <div class="stars" role="img" aria-label="${esc(r.stars)} of 3 stars">${starRow(r.stars)}</div>
          <dl class="facts">
            <div><dt>Time</dt><dd>${fmt(r.time)}s${r.newBest ? ' <span class="tag">Best!</span>' : ''}</dd></div>
            ${r.falls ? `<div><dt>Falls</dt><dd>${esc(r.falls)} <span class="muted">(+${r.falls * 2}s)</span></dd></div>` : ''}
            <div><dt>Coins</dt><dd id="win-coins">+${esc(r.total)} ${ICON.coin}</dd></div>
            ${r.streak ? `<div><dt>Streak</dt><dd>${ICON.flame} ${esc(r.streak)} day${r.streak > 1 ? 's' : ''}</dd></div>` : ''}
          </dl>
          ${r.already ? '<p class="muted">Daily already claimed — rewards were paid the first time.</p>' : ''}
          <button class="btn primary" data-act="next">${ICON.play}<span>${esc(r.nextLabel)}</span></button>
          ${r.canDouble ? `<button class="btn gold" id="double-btn" data-act="double">${ICON.video}<span>Watch ad · double coins</span></button>` : ''}
          <div class="row">
            <button class="btn ghost" data-act="replay">${ICON.restart}<span>Replay</span></button>
            <button class="btn ghost" data-act="share">${ICON.share}<span>Share</span></button>
            <button class="btn ghost" data-act="menu">${ICON.home}<span>Menu</span></button>
          </div>
        </div>
      </div>`);
    this._focus(el);
  }
  hideWin() { this._drop('win'); }
  markDoubled(total) {
    const b = document.getElementById('double-btn'); if (b) b.remove();
    const c = document.getElementById('win-coins'); if (c) c.innerHTML = `+${esc(total)} ${ICON.coin}`;
  }

  // ---------- Settings ----------
  showSettings({ settings, gyro, version, persistent }) {
    const seg = (key, opts, cur) => `<div class="seg" role="radiogroup">${opts.map(([v, l]) => `<label><input type="radio" name="${key}" data-seg="${key}" value="${v}" ${cur === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>`;
    const tog = (key, label, hint, on) => `<label class="row-set"><span><b>${label}</b>${hint ? `<small>${hint}</small>` : ''}</span><input class="switch" type="checkbox" data-set="${key}" ${on ? 'checked' : ''}></label>`;
    const el = this._layer('settings', `
      <div class="modal settings" data-ui role="dialog" aria-modal="true" aria-labelledby="sz">
        <div class="card scroll">
          <div class="card-head"><h2 id="sz">Settings</h2><button class="iconbtn" data-act="closeSettings" aria-label="Close settings">${ICON.close}</button></div>
          ${tog('sound', 'Sound', '', settings.sound)}
          ${tog('haptics', 'Vibration', 'On supported phones', settings.haptics)}
          ${tog('assist', 'Assist mode', 'Slower marble, easier control', settings.assist)}
          <div class="row-set col"><span><b>Controls</b><small>Motion uses your phone’s sensor</small></span>${seg('controls', [['auto', 'Auto'], ['motion', 'Motion'], ['touch', 'Touch']], settings.controls)}</div>
          <div class="row-set col"><span><b>Sensitivity</b></span><input type="range" min="0.6" max="1.6" step="0.05" value="${esc(settings.sensitivity)}" data-set="sensitivity" aria-label="Sensitivity"></div>
          <div class="row-set col"><span><b>Graphics</b><small>Choose Low for older phones</small></span>${seg('quality', [['high', 'High'], ['low', 'Low']], settings.quality)}</div>
          ${gyro.canEnable ? `<button class="btn ghost" data-act="enableMotion">${ICON.recal}<span>${gyro.enabled ? 'Motion enabled ✓' : 'Enable motion control'}</span></button>` : ''}
          <button class="btn danger" data-act="resetProgress">Reset progress</button>
          <p class="muted fine">__NAME__ v${esc(version)} · No banner ads. Ever.${persistent ? '' : ' · Progress can’t be saved in this browser mode.'}</p>
        </div>
      </div>`);
    this._focus(el, '.seg input:checked');
  }
  hideSettings() { this._drop('settings'); }

  // ---------- Level select ----------
  showLevels({ unlocked, stars, page, perPage = 20, current }) {
    const pages = Math.max(1, Math.ceil(unlocked / perPage));
    page = Math.max(0, Math.min(page, pages - 1));
    const first = page * perPage + 1, last = Math.min(unlocked, first + perPage - 1);
    let cells = '';
    for (let n = first; n <= last; n++) {
      const s = stars[String(n)] || 0;
      cells += `<button class="lv ${n === current ? 'cur' : ''}" data-act="playLevel" data-n="${n}" aria-label="Level ${n}, ${s} stars"><b>${n}</b><span class="mini">${starRow(s)}</span></button>`;
    }
    const el = this._layer('levels', `
      <div class="modal levels" data-ui role="dialog" aria-modal="true" aria-labelledby="lz">
        <div class="card">
          <div class="card-head"><h2 id="lz">Levels</h2><button class="iconbtn" data-act="closeLevels" aria-label="Close">${ICON.close}</button></div>
          <div class="lvgrid">${cells}</div>
          <div class="pager">
            <button class="btn ghost small" data-act="levelsPage" data-page="${page - 1}" ${page === 0 ? 'disabled' : ''} aria-label="Previous page">‹</button>
            <span>${first}–${last} of ${unlocked}</span>
            <button class="btn ghost small" data-act="levelsPage" data-page="${page + 1}" ${page >= pages - 1 ? 'disabled' : ''} aria-label="Next page">›</button>
          </div>
        </div>
      </div>`);
    this._focus(el, '.lv.cur');
  }
  hideLevels() { this._drop('levels'); }

  // ---------- Dialogs / toasts / ads ----------
  confirm({ title, body, ok = 'OK', cancel = 'Cancel', danger = false }) {
    return new Promise(resolve => {
      const el = this._layer('confirm', `
        <div class="modal front" data-ui role="alertdialog" aria-modal="true" aria-labelledby="cz">
          <div class="card small"><h2 id="cz">${esc(title)}</h2><p>${esc(body)}</p>
            <div class="row"><button class="btn ghost" data-c="0">${esc(cancel)}</button><button class="btn ${danger ? 'danger' : 'primary'}" data-c="1">${esc(ok)}</button></div>
          </div></div>`);
      el.addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (!b) return; e.stopPropagation(); this._drop('confirm'); resolve(b.dataset.c === '1'); }, true);
      el.querySelector('[data-c="1"]').focus({ preventScroll: true });
    });
  }

  toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    this.root.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2200); setTimeout(() => t.remove(), 2700);
  }

  /** Clearly-labelled demo ad. Resolves true when the countdown completes, false if closed early. */
  showDemoAd(kind, seconds) {
    return new Promise(resolve => {
      let left = seconds, done = false;
      const el = this._layer('ad', `
        <div class="modal front ad" data-ui role="dialog" aria-modal="true" aria-labelledby="az">
          <div class="card small">
            <span class="tag">DEMO AD</span>
            <h2 id="az">${kind === 'rewarded' ? 'Rewarded video' : 'Sponsored break'}</h2>
            <p class="muted">A real ad network plays here in production. ${kind === 'rewarded' ? 'Watch to the end to earn your reward.' : ''}</p>
            <div class="bar"><i id="ad-bar"></i></div>
            <button class="btn ghost" id="ad-close" ${kind === 'rewarded' ? '' : 'disabled'}>${kind === 'rewarded' ? 'Close' : `Continue in ${left}s`}</button>
          </div></div>`);
      const bar = el.querySelector('#ad-bar'), btn = el.querySelector('#ad-close');
      const finish = ok => { if (done) return; done = true; clearInterval(iv); this._drop('ad'); resolve(ok); };
      btn.addEventListener('click', () => finish(false));
      const t0 = performance.now();
      const iv = setInterval(() => {
        const p = Math.min(1, (performance.now() - t0) / (seconds * 1000));
        bar.style.width = `${p * 100}%`;
        left = Math.max(0, Math.ceil(seconds - p * seconds));
        if (kind !== 'rewarded') btn.textContent = `Continue in ${left}s`;
        if (p >= 1) { if (kind === 'rewarded') { btn.textContent = 'Claim reward'; btn.replaceWith(btn.cloneNode(true)); el.querySelector('#ad-close').addEventListener('click', () => finish(true)); el.querySelector('#ad-close').classList.replace('ghost', 'primary'); el.querySelector('#ad-close').focus({ preventScroll: true }); clearInterval(iv); } else finish(true); }
      }, 100);
    });
  }
}
