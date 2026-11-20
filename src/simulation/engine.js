import { CELL_H, CELL_W, RIPPLE_CHARS } from '../core/constants.js';
import { clamp, dampFactor, lerp, randRange } from '../core/math.js';
import { ObjectPool } from '../core/object-pool.js';
import { BaitSchool } from './bait-school.js';
import { KoiFish } from './species/koi.js';
import { HammerheadShark, WhaleShark } from './species/sharks.js';
import { SeaTurtle } from './species/turtle.js';

const RIPPLE_POOL_SIZE = 60;
const FOOD_POOL_SIZE = 30;
const TRAIL_POOL_SIZE = 140;

export class KoiPondEngine {
  constructor(canvas, atlas, ecosystem, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: true });
    this.atlas = atlas;
    this.ecosystem = ecosystem;

    this.width = window.innerWidth;
    this.height = window.innerHeight;
    this.dpr = window.devicePixelRatio || 1;

    this.fishCount = clamp(options.fishCount || 12, 5, 25);
    this.enabledSpecies = Object.assign(
      { koi: true, turtle: false, whaleShark: false, hammerhead: false },
      options.species || {}
    );

    this.obstacleRect = null;
    this.stonesRect = null;
    this.creatures = [];

    if (this.ecosystem && this.ecosystem.setOnPetalLand) {
      this.ecosystem.setOnPetalLand((x, y) => {
        this.spawnRipple(x, y, 42, 0.85, 0.36);
      });
    }

    this.foodPool = new ObjectPool(FOOD_POOL_SIZE, () => ({
      active: false,
      x: 0,
      y: 0,
      age: 0,
      vx: 0,
      vy: 0
    }));

    this.ripplePool = new ObjectPool(RIPPLE_POOL_SIZE, () => ({
      active: false,
      x: 0,
      y: 0,
      age: 0,
      duration: 1,
      maxRadius: 80,
      intensity: 0.7,
      alt: false
    }));
    this.rippleSeq = 0;

    this.trailPool = new ObjectPool(TRAIL_POOL_SIZE, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      age: 0,
      life: 1,
      char: '·',
      colorKey: null
    }));

    this.schoolEnabled = Boolean(options.schoolEnabled);
    this.baitSchool = new BaitSchool(this.width, this.height);

    this.mouse = {
      x: this.width * 0.5,
      y: this.height * 0.5,
      lastSpawnX: this.width * 0.5,
      lastSpawnY: this.height * 0.5,
      active: false,
      energy: 0
    };

    this.time = 0;
    this.lastFrameTime = 0;
    this.rafId = null;
    this.running = false;
    this.pausedByVisibility = false;

    this.fps = 60;
    this.frameTimeMs = 0;
    this.fpsSampleStart = 0;
    this.fpsFrameCount = 0;
    this.onMetrics = options.onMetrics || null;

    this._resizeTimer = null;
    this._dprMql = null;
    this._onDprChange = null;
    this._motionMql =
      typeof window.matchMedia === 'function'
        ? window.matchMedia('(prefers-reduced-motion: reduce)')
        : null;
    this.reducedMotion = Boolean(this._motionMql && this._motionMql.matches);
    this._onMotionChange = (e) => {
      this.reducedMotion = Boolean(e.matches);
    };
    if (this._motionMql && typeof this._motionMql.addEventListener === 'function') {
      this._motionMql.addEventListener('change', this._onMotionChange);
    }

    this.resize();
    this.syncPopulation();

    this.handleResize = () => {
      clearTimeout(this._resizeTimer);
      this._resizeTimer = setTimeout(() => {
        this.resize();
      }, 120);
    };
    this.handleVisibilityChange = this.onVisibilityChange.bind(this);
    this.loop = this.frameLoop.bind(this);

    window.addEventListener('resize', this.handleResize);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
    this.watchDpr();
  }

  getCreatureCount() {
    return this.creatures.length;
  }

  getMetrics() {
    return {
      fps: this.fps,
      frameTimeMs: this.frameTimeMs
    };
  }

  watchDpr() {
    if (this._dprMql && this._onDprChange && typeof this._dprMql.removeEventListener === 'function') {
      this._dprMql.removeEventListener('change', this._onDprChange);
    }
    if (typeof window.matchMedia !== 'function') return;
    const dpr = window.devicePixelRatio || 1;
    this._dprMql = window.matchMedia(`(resolution: ${dpr}dppx)`);
    this._onDprChange = () => {
      this.resize();
      this.watchDpr();
    };
    if (typeof this._dprMql.addEventListener === 'function') {
      this._dprMql.addEventListener('change', this._onDprChange, { once: true });
    }
  }

  onVisibilityChange() {
    if (document.hidden) {
      this.pausedByVisibility = true;
      if (this.rafId !== null) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
    } else {
      this.pausedByVisibility = false;
      if (this.running && this.rafId === null) {
        const now = performance.now();
        this.lastFrameTime = now;
        this.fpsSampleStart = now;
        this.fpsFrameCount = 0;
        this.rafId = requestAnimationFrame(this.loop);
      }
    }
  }

  resize() {
    this.dpr = window.devicePixelRatio || 1;
    this.width = window.innerWidth;
    this.height = window.innerHeight;

    this.canvas.width = Math.floor(this.width * this.dpr);
    this.canvas.height = Math.floor(this.height * this.dpr);
    this.canvas.style.width = this.width + 'px';
    this.canvas.style.height = this.height + 'px';

    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    if (this.atlas) {
      this.atlas.ensureDpr(this.dpr);
    }
    if (this.ecosystem) {
      this.ecosystem.resize(this.width, this.height);
    }

    const maxX = Math.max(20, this.width - 20);
    const maxY = Math.max(20, this.height - 20);
    for (let i = 0; i < this.creatures.length; i++) {
      const c = this.creatures[i];
      const nx = clamp(c.x, 20, maxX);
      const ny = clamp(c.y, 20, maxY);
      const dx = nx - c.x;
      const dy = ny - c.y;
      if (dx !== 0 || dy !== 0) {
        c.x = nx;
        c.y = ny;
        for (let n = 0; n < c.nodeCount; n++) {
          c.baseNodes[n].x += dx;
          c.baseNodes[n].y += dy;
          c.nodes[n].x += dx;
          c.nodes[n].y += dy;
        }
        c.centerX += dx;
        c.centerY += dy;
      }
    }
    this.baitSchool.resize(this.width, this.height);
  }

  setObstacleRect(rect) {
    this.obstacleRect = rect;
    if (this.ecosystem) {
      this.ecosystem.setObstacleRect(rect);
    }
  }

  setStonesRect(rect) {
    this.stonesRect = rect;
    if (this.ecosystem && this.ecosystem.setStonesRect) {
      this.ecosystem.setStonesRect(rect);
    }
  }

  setSpecies(speciesMap) {
    this.enabledSpecies = Object.assign({}, this.enabledSpecies, speciesMap);
    this.syncPopulation();
  }

  setSchoolEnabled(enabled) {
    this.schoolEnabled = Boolean(enabled);
  }

  syncFishCount(targetCount) {
    this.fishCount = clamp(Math.round(targetCount), 5, 25);
    this.syncPopulation();
  }

  computeSpeciesTargets() {
    const sp = this.enabledSpecies;
    const total = this.fishCount;
    const activeList = [];
    if (sp.koi) activeList.push('koi');
    if (sp.turtle) activeList.push('turtle');
    if (sp.whaleShark) activeList.push('whaleShark');
    if (sp.hammerhead) activeList.push('hammerhead');

    const targets = { koi: 0, turtle: 0, whaleShark: 0, hammerhead: 0 };
    if (activeList.length === 0) return targets;

    if (activeList.length === 1) {
      const only = activeList[0];
      if (only === 'koi') targets.koi = total;
      else if (only === 'turtle') targets.turtle = clamp(Math.round(total * 0.55), 3, 12);
      else if (only === 'whaleShark') targets.whaleShark = clamp(Math.round(total * 0.2), 1, 4);
      else if (only === 'hammerhead') targets.hammerhead = clamp(Math.round(total * 0.36), 2, 8);
      return targets;
    }

    if (sp.whaleShark) {
      targets.whaleShark = total >= 16 ? 2 : 1;
    }
    if (sp.hammerhead) {
      targets.hammerhead = clamp(Math.round(total * 0.18), 1, 4);
    }
    if (sp.turtle) {
      targets.turtle = clamp(Math.round(total * 0.25), 1, 6);
    }
    if (sp.koi) {
      const used = targets.whaleShark + targets.hammerhead + targets.turtle;
      targets.koi = Math.max(2, total - used);
    }
    return targets;
  }

  createCreature(species, idx) {
    const depth = lerp(0.62, 1.14, (idx * 0.6180339887) % 1);
    if (species === 'turtle') return new SeaTurtle(this.width, this.height, depth);
    if (species === 'whaleShark') return new WhaleShark(this.width, this.height, clamp(depth, 0.68, 1.08));
    if (species === 'hammerhead') return new HammerheadShark(this.width, this.height, depth);
    return new KoiFish(this.width, this.height, depth);
  }

  syncPopulation() {
    const targets = this.computeSpeciesTargets();
    const bySpecies = { koi: [], turtle: [], whaleShark: [], hammerhead: [] };

    for (let i = 0; i < this.creatures.length; i++) {
      const c = this.creatures[i];
      if (bySpecies[c.species]) {
        bySpecies[c.species].push(c);
      }
    }

    const nextList = [];
    const order = ['koi', 'turtle', 'hammerhead', 'whaleShark'];
    for (let s = 0; s < order.length; s++) {
      const sp = order[s];
      const wanted = targets[sp];
      const existing = bySpecies[sp];
      for (let i = 0; i < wanted; i++) {
        if (i < existing.length) {
          nextList.push(existing[i]);
        } else {
          nextList.push(this.createCreature(sp, nextList.length));
        }
      }
    }

    nextList.sort((a, b) => a.depth - b.depth);
    this.creatures = nextList;
  }

  activateFoodSlot(x, y, delay = 0) {
    const slot = this.foodPool.acquire(true);
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.age = -delay;
    slot.vx = randRange(-5, 5);
    slot.vy = randRange(-5, 5);
  }

  dropFood(x, y) {
    this.activateFoodSlot(x, y, 0);
    this.spawnRipple(x, y, 108, 1.35, 0.9);
  }

  dropMultipleFood(count = 8) {
    const margin = 90;
    for (let i = 0; i < count; i++) {
      const fx = randRange(margin, Math.max(margin + 10, this.width - margin));
      let fy = randRange(margin, Math.max(margin + 10, this.height - margin));

      if (this.obstacleRect) {
        const r = this.obstacleRect;
        if (fx > r.left - 24 && fx < r.right + 24 && fy > r.top - 24 && fy < r.bottom + 24) {
          fy =
            Math.random() > 0.5
              ? Math.max(70, r.top - randRange(45, 120))
              : Math.min(this.height - 70, r.bottom + randRange(45, 120));
        }
      }

      this.activateFoodSlot(fx, fy, i * 0.08);
      this.spawnRipple(fx, fy, 92, 1.25, 0.75);
    }
  }

  spawnRipple(x, y, maxRadius = 85, duration = 1.2, intensity = 0.7) {
    const slot = this.ripplePool.acquire(true);
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.age = 0;
    slot.duration = duration;
    slot.maxRadius = maxRadius;
    slot.intensity = intensity;
    slot.alt = (this.rippleSeq++ & 1) === 1;
  }

  spawnTrailGlyph(x, y, char = '·', colorKey = null) {
    const slot = this.trailPool.acquire(true);
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.vx = randRange(-10, 10);
    slot.vy = randRange(-10, 10);
    slot.age = 0;
    slot.life = randRange(0.65, 1.2);
    slot.char = char;
    slot.colorKey = colorKey;
  }

  onMouseMove(x, y) {
    this.mouse.x = x;
    this.mouse.y = y;
    this.mouse.active = true;
    this.mouse.energy = Math.min(1.0, this.mouse.energy + 0.35);

    const dist = Math.hypot(x - this.mouse.lastSpawnX, y - this.mouse.lastSpawnY);
    if (dist > 18) {
      this.mouse.lastSpawnX = x;
      this.mouse.lastSpawnY = y;

      for (let i = 0; i < 2; i++) {
        this.spawnTrailGlyph(
          x + randRange(-10, 10),
          y + randRange(-8, 8),
          Math.random() > 0.42 ? '~' : '·',
          null
        );
      }

      if (dist > 34) {
        this.spawnRipple(x, y, 48, 0.85, 0.32);
      }

      if (this.ecosystem && this.ecosystem.isPlanktonEnabled && this.ecosystem.isPlanktonEnabled()) {
        const sparks = dist > 42 ? 3 : 1;
        for (let i = 0; i < sparks; i++) {
          this.ecosystem.spawnPlankton(x + randRange(-12, 12), y + randRange(-10, 10));
        }
      }
    }
  }

  onMouseLeave() {
    this.mouse.active = false;
  }

  start() {
    if (this.running) return;
    this.running = true;
    const now = performance.now();
    this.lastFrameTime = now;
    this.fpsSampleStart = now;
    this.fpsFrameCount = 0;
    if (!document.hidden) {
      this.rafId = requestAnimationFrame(this.loop);
    }
  }

  stop() {
    this.running = false;
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  destroy() {
    this.stop();
    clearTimeout(this._resizeTimer);
    this._resizeTimer = null;
    window.removeEventListener('resize', this.handleResize);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    if (this._dprMql && this._onDprChange && typeof this._dprMql.removeEventListener === 'function') {
      this._dprMql.removeEventListener('change', this._onDprChange);
    }
    if (this._motionMql && this._onMotionChange && typeof this._motionMql.removeEventListener === 'function') {
      this._motionMql.removeEventListener('change', this._onMotionChange);
    }
  }

  frameLoop(now) {
    if (!this.running || this.pausedByVisibility) return;

    if (this.reducedMotion && now - this.lastFrameTime < 50) {
      this.rafId = requestAnimationFrame(this.loop);
      return;
    }

    const rawDt = Math.min(Math.max(0, (now - this.lastFrameTime) / 1000), 0.05);
    this.lastFrameTime = now;
    const dt = this.reducedMotion ? rawDt * 0.35 : rawDt;

    const workStart = performance.now();
    this.update(dt);
    this.render();
    const workMs = performance.now() - workStart;

    this.frameTimeMs = this.frameTimeMs === 0 ? workMs : this.frameTimeMs * 0.88 + workMs * 0.12;
    this.fpsFrameCount++;
    const elapsed = now - this.fpsSampleStart;
    if (elapsed >= 350) {
      this.fps = Math.round((this.fpsFrameCount * 1000) / elapsed);
      this.fpsSampleStart = now;
      this.fpsFrameCount = 0;
      if (this.onMetrics) {
        this.onMetrics(this.fps, this.frameTimeMs);
      }
    }

    this.rafId = requestAnimationFrame(this.loop);
  }

  update(dt) {
    this.time += dt;
    this.mouse.energy = Math.max(0, this.mouse.energy - dt * 0.9);

    if (this.ecosystem) {
      this.ecosystem.update(dt);
    }

    const ripples = this.ripplePool.items;
    for (let i = 0; i < RIPPLE_POOL_SIZE; i++) {
      const r = ripples[i];
      if (!r.active) continue;
      r.age += dt;
      if (r.age >= r.duration) {
        r.active = false;
      }
    }

    const trailDamp = dampFactor(0.96, dt);
    const trails = this.trailPool.items;
    for (let i = 0; i < TRAIL_POOL_SIZE; i++) {
      const p = trails[i];
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= trailDamp;
      p.vy *= trailDamp;
    }

    const foodDamp = dampFactor(0.97, dt);
    const foods = this.foodPool.items;
    for (let i = 0; i < FOOD_POOL_SIZE; i++) {
      const f = foods[i];
      if (!f.active) continue;
      f.age += dt;
      if (f.age < 0) continue;

      f.x += f.vx * dt;
      f.y += f.vy * dt;
      f.vx *= foodDamp;
      f.vy *= foodDamp;

      let eaten = false;
      for (let k = 0; k < this.creatures.length; k++) {
        const c = this.creatures[k];
        const dx = c.x - f.x;
        const dy = c.y - f.y;
        const eatR = 18 + c.maxRadius * 0.4;
        if (dx * dx + dy * dy < eatR * eatR) {
          eaten = true;
          this.spawnRipple(f.x, f.y, 72, 0.95, 0.68);
          break;
        }
      }

      if (eaten || f.age > 24) {
        f.active = false;
      }
    }

    for (let i = 0; i < this.creatures.length; i++) {
      this.creatures[i].updatePhysics(
        dt,
        this.width,
        this.height,
        this.creatures,
        foods,
        this.mouse,
        this.obstacleRect,
        this.stonesRect,
        this.ecosystem,
        this
      );
    }

    if (this.schoolEnabled) {
      this.baitSchool.update(
        dt,
        this.width,
        this.height,
        this.creatures,
        this.mouse,
        this.obstacleRect,
        this.stonesRect
      );
    }
  }

  render() {
    const ctx = this.ctx;
    const atlas = this.atlas;
    const theme = this.ecosystem.getTheme();

    ctx.clearRect(0, 0, this.width, this.height);

    this.ecosystem.renderSubaqueous(ctx, atlas);

    if (this.schoolEnabled) {
      this.baitSchool.render(ctx, atlas);
    }

    const trails = this.trailPool.items;
    for (let i = 0; i < TRAIL_POOL_SIZE; i++) {
      const p = trails[i];
      if (!p.active) continue;
      const alpha = (1 - p.age / p.life) * 0.36;
      if (alpha <= 0.02) continue;
      const gx = (Math.floor(p.x / CELL_W) + 0.5) * CELL_W;
      const gy = (Math.floor(p.y / CELL_H) + 0.5) * CELL_H;
      ctx.globalAlpha = alpha;
      atlas.drawGlyph(ctx, p.char, p.colorKey || theme.trailKey, false, gx, gy);
    }
    ctx.globalAlpha = 1;

    for (let i = 0; i < this.creatures.length; i++) {
      this.creatures[i].render(ctx, atlas, this.ecosystem, this.time, this.width, this.height);
    }

    const ripples = this.ripplePool.items;
    for (let i = 0; i < RIPPLE_POOL_SIZE; i++) {
      const r = ripples[i];
      if (!r.active) continue;
      const progress = r.age / r.duration;
      const radius = Math.max(4, progress * r.maxRadius);
      const alpha = (1 - progress) * r.intensity * 0.58;
      if (alpha <= 0.02) continue;

      const charIndex = clamp(Math.floor(progress * RIPPLE_CHARS.length), 0, RIPPLE_CHARS.length - 1);
      const char = RIPPLE_CHARS[charIndex];
      const stepAngle = Math.max(0.18, CELL_W / radius);
      const colorKey = r.alt ? theme.rippleSecondaryKey : theme.ripplePrimaryKey;
      const glow = progress < 0.35;

      ctx.globalAlpha = alpha;
      let prevGx = NaN;
      let prevGy = NaN;
      let firstGx = NaN;
      let firstGy = NaN;
      for (let a = 0; a < Math.PI * 2; a += stepAngle) {
        const rx = r.x + Math.cos(a) * radius;
        const ry = r.y + Math.sin(a) * radius;
        const gx = (Math.floor(rx / CELL_W) + 0.5) * CELL_W;
        const gy = (Math.floor(ry / CELL_H) + 0.5) * CELL_H;
        if (gx === prevGx && gy === prevGy) continue;
        if (a > 0 && gx === firstGx && gy === firstGy) continue;
        if (Number.isNaN(firstGx)) {
          firstGx = gx;
          firstGy = gy;
        }
        prevGx = gx;
        prevGy = gy;
        atlas.drawGlyph(ctx, char, colorKey, glow, gx, gy);
      }
    }

    const foods = this.foodPool.items;
    for (let i = 0; i < FOOD_POOL_SIZE; i++) {
      const f = foods[i];
      if (!f.active || f.age < 0) continue;

      const pulse = 0.78 + 0.22 * Math.sin(this.time * 7 + i);
      const gx = (Math.floor(f.x / CELL_W) + 0.5) * CELL_W;
      const gy = (Math.floor(f.y / CELL_H) + 0.5) * CELL_H;

      ctx.globalAlpha = pulse;
      atlas.drawGlyph(ctx, '*', theme.pelletKey, true, gx, gy);

      if (Math.sin(this.time * 5 + i) > 0.1) {
        ctx.globalAlpha = 0.28;
        atlas.drawGlyph(ctx, '·', theme.pelletKey, true, gx - CELL_W, gy);
        atlas.drawGlyph(ctx, '·', theme.pelletKey, true, gx + CELL_W, gy);
      }
    }

    ctx.globalAlpha = 1;
    this.ecosystem.renderSurface(ctx, atlas);
    this.ecosystem.renderAtmospheric(ctx, atlas);
  }
}
