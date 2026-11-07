// One play-through of one level: wires World (simulation) <-> Renderer (visuals) <-> Input.
import { World, CFG } from '../core/physics.js';
import { computePath } from '../core/autopilot.js';
import { vibrate } from './fx.js';

const MAX_SUBSTEPS = 6;

export class Run {
  /**
   * @param {{renderer, input, level, assist?:boolean, audio?, on?:{fell?,won?,coin?,hit?,start?}}} o
   */
  constructor({ renderer, input, level, assist = false, audio = null, on = {} }) {
    this.renderer = renderer; this.input = input; this.level = level; this.audio = audio; this.on = on;
    this.world = new World(level, { assist });
    this.acc = 0;
    this.clock = 0;           // visual time
    this.started = false;     // timer starts on first deliberate motion
    this.state = 'playing';   // 'playing' | 'falling' | 'won'
    this.paused = false;
    this.tilt = { x: 0, y: 0 };
    this.coinsGot = 0;
    renderer.loadLevel(level);
  }

  get time() { return this.world.time; }
  get falls() { return this.world.falls; }

  /** Compute the safe path from the marble's current cell and show it. */
  showHint(sec = 4) {
    const cells = computePath(this.level, this.world.cellIndex);
    if (cells.length) this.renderer.showHint(cells, sec);
    return cells.length > 0;
  }

  update(dt) {
    dt = Math.min(dt, 0.05);
    this.clock += dt;
    if (this.paused) { this.renderer.sync(this.world, this.tilt, dt, this.clock); return; }

    const t = this.state === 'playing' ? this.input.getTilt(dt) : { x: 0, y: 0 };
    this.tilt = t;
    if (!this.started && this.state === 'playing' && Math.hypot(t.x, t.y) > 0.06) {
      this.started = true; this.on.start?.();
    }

    if (this.state === 'playing') {
      this.acc += dt;
      let n = 0;
      while (this.acc >= CFG.DT && n < MAX_SUBSTEPS) {
        const ev = this.world.step(CFG.DT, this.started ? t : { x: 0, y: 0 });
        if (!this.started) this.world.time = 0;
        this.acc -= CFG.DT; n++;
        for (const e of ev) this._handle(e);
        if (this.state !== 'playing') break;
      }
      if (n === MAX_SUBSTEPS) this.acc = 0; // drop backlog instead of spiralling
    }

    if (this.state === 'falling' && this.renderer.animDone) {
      this.world.respawn();
      const s = this.level.start;
      this.renderer.resetMarble(s.x + 0.5, s.y + 0.5);
      this.state = 'playing';
      this.input.recalibrate?.();
    }
    if (this.state === 'won' && this.renderer.animDone && !this._wonFired) {
      this._wonFired = true;
      this.on.won?.({ time: this.world.time, falls: this.world.falls, coins: this.world.coinsTaken.size });
    }

    this.renderer.sync(this.state === 'won' || this.state === 'falling' ? null : this.world, t, dt, this.clock);
    this.audio?.setRolling?.(this.state === 'playing' ? this.world.speed : 0, this.world);
  }

  _handle(e) {
    switch (e.type) {
      case 'hit': {
        const k = Math.min(1, e.impact / 6);
        this.renderer.addTrauma(0.08 + k * 0.22);
        this.audio?.hit?.(k);
        if (e.impact > 2) vibrate(4 + Math.round(k * 8));
        this.on.hit?.(e.impact);
        break;
      }
      case 'coin':
        this.coinsGot++;
        this.renderer.popCoin(e.index);
        this.audio?.coin?.(this.coinsGot);
        vibrate(8);
        this.on.coin?.(e.index);
        break;
      case 'fell':
        this.state = 'falling';
        this.renderer.startFall(this.world);
        this.renderer.addTrauma(0.35);
        this.audio?.fall?.();
        vibrate(25);
        this.on.fell?.();
        break;
      case 'won':
        this.state = 'won';
        this.renderer.startWin();
        this.audio?.win?.();
        vibrate([20, 40, 30]);
        break;
    }
  }
}
