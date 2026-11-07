// three.js presentation layer. Reads simulation state; never writes to it.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildWalls, CFG } from '../core/physics.js';
import { FLOOR } from '../core/levels.js';
import { paletteFor } from './palettes.js';

const MAX_BOARD_TILT = 0.2;      // radians (~11 degrees) of visual board tilt
const WALL_H = 0.5;
const R = CFG.RADIUS;

function canvasTex(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function glowTex() {
  return canvasTex(128, (g, s) => {
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(255,255,255,0.95)');
    grd.addColorStop(0.35, 'rgba(255,255,255,0.35)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, s, s);
  });
}

const easeOut = t => 1 - Math.pow(1 - t, 3);

export class Renderer {
  constructor(canvas, { quality = 'high' } = {}) {
    this.canvas = canvas;
    this.quality = quality;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: quality === 'high', powerPreference: 'high-performance' });
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    this.board = new THREE.Group();          // rotates with tilt
    this.content = new THREE.Group();        // level-specific, rebuilt each level
    this.board.add(this.content);
    this.scene.add(this.board);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x445066, 0.9);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.7);
    this.sun.position.set(3, 9, 5);
    this.scene.add(this.hemi, this.sun);
    this.glow = glowTex();
    this.tilt = { x: 0, y: 0 };
    this.trauma = 0;
    this.anim = null;
    this.confetti = null;
    this.hintGroup = null; this.hintT = 0;
    this._last = { x: 0, z: 0 };
    this.reducedMotion = false;
    this.level = null;
    this._disposables = [];
    this.setQuality(quality);
    this.resize();
  }

  setQuality(q) {
    this.quality = q;
    const high = q === 'high';
    this.gl.setPixelRatio(Math.min(window.devicePixelRatio || 1, high ? 2 : 1.25));
    this.gl.shadowMap.enabled = high;
    this.gl.shadowMap.type = THREE.PCFSoftShadowMap;
    this.sun.castShadow = high;
    if (high) {
      this.sun.shadow.mapSize.set(1024, 1024);
      if (!this.scene.environment) {
        const pm = new THREE.PMREMGenerator(this.gl);
        this.envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture;
        pm.dispose();
      }
      this.scene.environment = this.envTex;
      this.scene.environmentIntensity = 0.45;
    } else {
      this.scene.environment = null;
    }
    this.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; });
    if (this.blob) this.blob.visible = !high;
    if (this.level) this.resize();
  }

  resize() {
    const w = this.canvas.clientWidth || window.innerWidth, h = this.canvas.clientHeight || window.innerHeight;
    this.gl.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this._fitCamera();
  }

  _fitCamera() {
    if (!this.level) { this.camera.position.set(0, 10, 3); this.camera.lookAt(0, 0, 0); return; }
    const { w, h } = this.level;
    const fov = THREE.MathUtils.degToRad(this.camera.fov);
    const aspect = this.camera.aspect;
    const padW = w + 1.1, padH = h + 1.1 + (aspect < 0.8 ? 2.0 : 0.8); // leave room for HUD top/bottom on portrait
    const tanV = Math.tan(fov / 2);
    const dV = padH / (2 * tanV) * 1.08;
    const dH = padW / (2 * tanV * aspect) * 1.02;
    const d = Math.max(dV, dH);
    const lean = 0.22; // camera leans toward the player for a hint of perspective
    this.camBase = new THREE.Vector3(0, d, d * lean);
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(0, 0, 0);
    // Shadow frustum covers the board.
    const s = Math.max(w, h) * 0.75 + 1;
    const sc = this.sun.shadow.camera;
    sc.left = -s; sc.right = s; sc.top = s; sc.bottom = -s; sc.near = 1; sc.far = 40;
    sc.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0004;
  }

  _own(obj) { this._disposables.push(obj); return obj; }

  _clearLevel() {
    this.content.clear();
    for (const d of this._disposables) d.dispose && d.dispose();
    this._disposables = [];
    this.coinMeshes = []; this.holeMeshes = []; this.hintGroup = null;
    this.anim = null; this.confetti = null;
  }

  loadLevel(level) {
    this._clearLevel();
    this.level = level;
    const pal = paletteFor(level.params.world);
    this.palette = pal;
    this.scene.background = new THREE.Color(pal.bg);
    const { w, h } = level;
    const ox = -w / 2, oz = -h / 2;
    this.origin = { x: ox, z: oz };
    const hi = this.quality === 'high';

    // Base plate
    const base = new THREE.Mesh(
      this._own(new THREE.BoxGeometry(w + 0.5, 0.4, h + 0.5)),
      this._own(new THREE.MeshStandardMaterial({ color: pal.base, roughness: 0.8, metalness: 0.1 })));
    base.position.y = -0.21;
    base.receiveShadow = true;
    this.content.add(base);

    // Floor tiles (instanced by type)
    const tilePlane = this._own(new THREE.PlaneGeometry(1, 1)); tilePlane.rotateX(-Math.PI / 2);
    const byType = [[], [], []];
    level.floor.forEach((t, i) => byType[t].push(i));
    const mk = (type, material) => {
      const list = byType[type]; if (!list.length) return;
      const m = new THREE.InstancedMesh(tilePlane, this._own(material), list.length);
      const dummy = new THREE.Object3D(), col = new THREE.Color();
      list.forEach((ci, k) => {
        const x = ci % w, y = (ci / w) | 0;
        dummy.position.set(ox + x + 0.5, 0.001, oz + y + 0.5); dummy.updateMatrix(); m.setMatrixAt(k, dummy.matrix);
        if (type === FLOOR.NORMAL) m.setColorAt(k, col.set(((x + y) & 1) ? pal.floorA : pal.floorB));
      });
      m.receiveShadow = true;
      this.content.add(m);
    };
    mk(FLOOR.NORMAL, new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.05 }));
    const iceTex = this._own(canvasTex(128, (g, s) => {
      g.fillStyle = '#9fe7ff'; g.fillRect(0, 0, s, s);
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 6;
      for (let k = -s; k < s * 2; k += 28) { g.beginPath(); g.moveTo(k, s); g.lineTo(k + s, 0); g.stroke(); }
    }));
    const stickyTex = this._own(canvasTex(128, (g, s) => {
      g.fillStyle = '#d98a14'; g.fillRect(0, 0, s, s);
      g.fillStyle = 'rgba(80,40,0,0.55)';
      for (let yy = 16; yy < s; yy += 32) for (let xx = 16 + ((yy / 32) % 2) * 16; xx < s; xx += 32) { g.beginPath(); g.arc(xx, yy, 7, 0, 7); g.fill(); }
    }));
    mk(FLOOR.ICE, new THREE.MeshStandardMaterial({ map: iceTex, roughness: 0.15, metalness: 0.1 }));
    mk(FLOOR.STICKY, new THREE.MeshStandardMaterial({ map: stickyTex, roughness: 0.95, metalness: 0 }));

    // Walls
    const walls = buildWalls(level);
    const wallMesh = new THREE.InstancedMesh(
      this._own(new THREE.BoxGeometry(1, 1, 1)),
      this._own(new THREE.MeshStandardMaterial({ color: pal.wall, roughness: 0.45, metalness: 0.15 })), walls.length);
    const d = new THREE.Object3D();
    walls.forEach((wl, k) => {
      d.position.set(ox + (wl.x0 + wl.x1) / 2, WALL_H / 2, oz + (wl.y0 + wl.y1) / 2);
      d.scale.set(wl.x1 - wl.x0, WALL_H, wl.y1 - wl.y0);
      d.updateMatrix(); wallMesh.setMatrixAt(k, d.matrix);
    });
    wallMesh.castShadow = true; wallMesh.receiveShadow = true;
    this.content.add(wallMesh);

    // Holes
    const holeGeo = this._own(new THREE.CircleGeometry(CFG.HOLE_R, 28)); holeGeo.rotateX(-Math.PI / 2);
    const rimGeo = this._own(new THREE.RingGeometry(CFG.HOLE_R, CFG.HOLE_R + 0.05, 28)); rimGeo.rotateX(-Math.PI / 2);
    const holeMat = this._own(new THREE.MeshBasicMaterial({ color: 0x020307 }));
    const rimMat = this._own(new THREE.MeshBasicMaterial({ color: 0x8a93a8 }));
    for (const hole of level.holes) {
      const m = new THREE.Mesh(holeGeo, holeMat); m.position.set(ox + hole.x + 0.5, 0.012, oz + hole.y + 0.5);
      const r = new THREE.Mesh(rimGeo, rimMat); r.position.set(m.position.x, 0.013, m.position.z);
      this.content.add(m, r); this.holeMeshes.push(m);
    }

    // Goal
    const gcol = new THREE.Color(pal.goal);
    this.goal = new THREE.Group();
    const ring = new THREE.Mesh(this._own(new THREE.TorusGeometry(0.27, 0.04, 12, 40)), this._own(new THREE.MeshBasicMaterial({ color: gcol })));
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.04;
    const glow = new THREE.Mesh(this._own(new THREE.PlaneGeometry(1.5, 1.5)), this._own(new THREE.MeshBasicMaterial({ map: this.glow, color: gcol, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
    glow.rotation.x = -Math.PI / 2; glow.position.y = 0.02;
    this.goal.add(ring, glow);
    this.goal.position.set(ox + level.goal.x + 0.5, 0, oz + level.goal.y + 0.5);
    this.goalGlow = glow; this.goalRing = ring;
    this.content.add(this.goal);

    // Coins
    const coinGeo = this._own(new THREE.CylinderGeometry(0.13, 0.13, 0.035, 24)); coinGeo.rotateX(Math.PI / 2);
    const coinMat = this._own(new THREE.MeshStandardMaterial({ color: 0xffc933, emissive: 0x8a5a00, emissiveIntensity: 0.7, metalness: 0.7, roughness: 0.3 }));
    level.coins.forEach((c, i) => {
      const m = new THREE.Mesh(coinGeo, coinMat);
      m.position.set(ox + c.x + 0.5, 0.26, oz + c.y + 0.5);
      m.castShadow = hi; m.userData = { i, taken: false, pop: -1, phase: i * 1.7 };
      this.content.add(m); this.coinMeshes.push(m);
    });

    // Marble
    const tex = this._own(canvasTex(256, (g, s) => {
      const grd = g.createLinearGradient(0, 0, s, s); grd.addColorStop(0, '#fdfdff'); grd.addColorStop(1, '#c9d0de');
      g.fillStyle = grd; g.fillRect(0, 0, s, s);
      g.fillStyle = pal.stripe; g.fillRect(0, s * 0.18, s, s * 0.14); g.fillRect(0, s * 0.62, s, s * 0.14);
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(s * 0.5, 0, s * 0.04, s);
    }));
    this.marble = new THREE.Mesh(
      this._own(new THREE.SphereGeometry(R, hi ? 36 : 18, hi ? 24 : 12)),
      this._own(new THREE.MeshStandardMaterial({ map: tex, metalness: 0.35, roughness: 0.22 })));
    this.marble.castShadow = hi;
    this.content.add(this.marble);
    // Blob shadow used when real shadows are off.
    this.blob = new THREE.Mesh(this._own(new THREE.PlaneGeometry(0.9, 0.9)),
      this._own(new THREE.MeshBasicMaterial({ map: this.glow, color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false })));
    this.blob.rotation.x = -Math.PI / 2; this.blob.position.y = 0.02; this.blob.visible = !hi;
    this.content.add(this.blob);

    this.resetMarble(level.start.x + 0.5, level.start.y + 0.5);
    this.tilt.x = this.tilt.y = 0;
    this._fitCamera();
  }

  resetMarble(cx, cy) {
    this.anim = null;
    this.marble.visible = true;
    this.marble.scale.setScalar(1);
    this.marble.quaternion.identity();
    this.marble.position.set(this.origin.x + cx, R, this.origin.z + cy);
    this._last.x = this.marble.position.x; this._last.z = this.marble.position.z;
  }

  addTrauma(a) { if (!this.reducedMotion) this.trauma = Math.min(1, this.trauma + a); }

  popCoin(i) { const m = this.coinMeshes[i]; if (m) { m.userData.taken = true; m.userData.pop = 0; } }

  startFall(world) {
    // fall into the nearest hole
    let best = null, bd = 1e9;
    for (const hl of this.level.holes) {
      const d = Math.hypot(hl.x + 0.5 - world.x, hl.y + 0.5 - world.y);
      if (d < bd) { bd = d; best = hl; }
    }
    this.anim = { type: 'fall', t: 0, dur: 0.5, from: this.marble.position.clone(),
      to: new THREE.Vector3(this.origin.x + best.x + 0.5, 0, this.origin.z + best.y + 0.5), done: false };
  }

  startWin() {
    this.anim = { type: 'win', t: 0, dur: 0.55, from: this.marble.position.clone(),
      to: new THREE.Vector3(this.goal.position.x, 0.0, this.goal.position.z), done: false };
    if (!this.reducedMotion) this._burst(this.goal.position.x, this.goal.position.z);
  }

  get animDone() { return !this.anim || this.anim.done; }

  _burst(x, z) {
    const n = 70, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), vel = [];
    const palette = [0xffc933, this.palette.goal, 0xffffff, this.palette.wall].map(c => new THREE.Color(c));
    for (let i = 0; i < n; i++) {
      pos[i * 3] = x; pos[i * 3 + 1] = 0.2; pos[i * 3 + 2] = z;
      const a = Math.random() * Math.PI * 2, s = 1 + Math.random() * 2.6;
      vel.push([Math.cos(a) * s, 3 + Math.random() * 3.2, Math.sin(a) * s]);
      const c = palette[i % palette.length]; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.PointsMaterial({ size: 0.11, vertexColors: true, transparent: true, depthWrite: false });
    const pts = new THREE.Points(geo, mat); pts.frustumCulled = false;
    this.content.add(pts);
    this.confetti = { pts, vel, t: 0, geo, mat };
  }

  /** Show the safe path as a trail of dots for `sec` seconds. `cells` = cell indices. */
  showHint(cells, sec = 4) {
    if (this.hintGroup) { this.content.remove(this.hintGroup); }
    const g = new THREE.Group();
    const geo = this._own(new THREE.CircleGeometry(0.075, 12)); geo.rotateX(-Math.PI / 2);
    const mat = this._own(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 }));
    const { w } = this.level;
    cells.forEach((c, k) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(this.origin.x + (c % w) + 0.5, 0.03, this.origin.z + ((c / w) | 0) + 0.5);
      m.userData.k = k; g.add(m);
    });
    this.content.add(g); this.hintGroup = g; this.hintT = sec; this.hintMat = mat;
  }

  /**
   * Per-frame visual sync.
   * @param world simulation state, @param tilt {x,y} control vector, @param dt seconds, @param time seconds
   */
  sync(world, tilt, dt, time) {
    const k = 1 - Math.exp(-dt * 12);
    this.tilt.x += (tilt.x - this.tilt.x) * k;
    this.tilt.y += (tilt.y - this.tilt.y) * k;
    const amp = this.reducedMotion ? 0.4 : 1;
    this.board.rotation.z = -this.tilt.x * MAX_BOARD_TILT * amp;
    this.board.rotation.x = this.tilt.y * MAX_BOARD_TILT * amp;

    const a = this.anim;
    if (a) {
      a.t += dt;
      const p = Math.min(1, a.t / a.dur), e = easeOut(p);
      this.marble.position.lerpVectors(a.from, a.to, e);
      if (a.type === 'fall') {
        this.marble.position.y = R - e * 0.55;
        this.marble.scale.setScalar(Math.max(0.01, 1 - e * 0.9));
        this.marble.rotation.y += dt * 14;
      } else {
        this.marble.position.y = R - e * 0.2;
        this.marble.scale.setScalar(1 - e * 0.35);
      }
      if (p >= 1) a.done = true;
    } else if (world) {
      const px = this.origin.x + world.x, pz = this.origin.z + world.y;
      this.marble.position.set(px, R, pz);
      const dx = px - this._last.x, dz = pz - this._last.z;
      const len = Math.hypot(dx, dz);
      if (len > 1e-6) {
        const axis = new THREE.Vector3(dz, 0, -dx).normalize();
        this.marble.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(axis, len / R));
      }
      this._last.x = px; this._last.z = pz;
    }
    this.blob.position.x = this.marble.position.x; this.blob.position.z = this.marble.position.z;
    this.blob.scale.setScalar(this.marble.scale.x);

    // Goal pulse
    const pulse = 1 + Math.sin(time * 4) * 0.08;
    this.goalRing.scale.setScalar(pulse);
    this.goalGlow.material.opacity = 0.65 + Math.sin(time * 4) * 0.25;

    // Coins
    for (const c of this.coinMeshes) {
      const u = c.userData;
      if (u.taken) {
        if (u.pop >= 0) {
          u.pop += dt; const p = Math.min(1, u.pop / 0.3);
          c.scale.setScalar(1 + p * 0.8 * (1 - p) * 2 - p); c.position.y = 0.26 + p * 0.5;
          if (p >= 1) { c.visible = false; u.pop = -1; }
        }
      } else {
        c.rotation.y = time * 2.6 + u.phase; c.position.y = 0.26 + Math.sin(time * 2.2 + u.phase) * 0.03;
      }
    }

    // Confetti
    if (this.confetti) {
      const cf = this.confetti; cf.t += dt;
      const arr = cf.geo.attributes.position.array;
      for (let i = 0; i < cf.vel.length; i++) {
        cf.vel[i][1] -= 9 * dt;
        arr[i * 3] += cf.vel[i][0] * dt; arr[i * 3 + 1] += cf.vel[i][1] * dt; arr[i * 3 + 2] += cf.vel[i][2] * dt;
        if (arr[i * 3 + 1] < 0.02) { arr[i * 3 + 1] = 0.02; cf.vel[i][0] *= 0.6; cf.vel[i][2] *= 0.6; cf.vel[i][1] = 0; }
      }
      cf.geo.attributes.position.needsUpdate = true;
      cf.mat.opacity = Math.max(0, 1 - (cf.t - 1.2) / 0.8);
      if (cf.t > 2) { this.content.remove(cf.pts); cf.geo.dispose(); cf.mat.dispose(); this.confetti = null; }
    }

    // Hint
    if (this.hintGroup) {
      this.hintT -= dt;
      this.hintMat.opacity = Math.max(0, Math.min(0.9, this.hintT / 0.6)) * (0.65 + 0.35 * Math.sin(time * 8));
      if (this.hintT <= 0) { this.content.remove(this.hintGroup); this.hintGroup = null; }
    }

    // Camera shake (trauma^2, smooth sin noise)
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    const s = this.trauma * this.trauma;
    this.camera.position.set(this.camBase.x + Math.sin(time * 61) * 0.18 * s, this.camBase.y + Math.sin(time * 47) * 0.12 * s, this.camBase.z + Math.cos(time * 53) * 0.18 * s);
    this.camera.lookAt(0, 0, 0);
  }

  render() { this.gl.render(this.scene, this.camera); }
}
