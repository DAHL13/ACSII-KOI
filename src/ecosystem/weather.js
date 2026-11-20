import { CELL_H, CELL_W } from '../core/constants.js';
import { clamp, dampFactor, randRange } from '../core/math.js';
import { ObjectPool } from '../core/object-pool.js';

const RAIN_POOL_SIZE = 150;
const RAIN_RIPPLE_POOL_SIZE = 60;
const PETAL_POOL_SIZE = 90;
const PETAL_CHARS = ['✿', '❀', '*', '~', '·'];
const PETAL_COLORS = ['sakuraLight', 'sakuraDeep', 'sakuraPale'];

export class WeatherLayer {
  constructor(width, height, options = {}) {
    this.width = width;
    this.height = height;
    this.onPetalLand = options.onPetalLand || null;
    this.cherryShowerRemaining = 0;
    this.cherryEmitAccumulator = 0;
    this._flowVec = { vx: 0, vy: 0 };

    this.rainPool = new Array(RAIN_POOL_SIZE);
    for (let i = 0; i < RAIN_POOL_SIZE; i++) {
      this.rainPool[i] = {
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        impactY: 0,
        char: '/',
        alpha: 0.35
      };
    }

    this.rainRipplePool = new ObjectPool(RAIN_RIPPLE_POOL_SIZE, () => ({
      active: false,
      x: 0,
      y: 0,
      age: 0,
      duration: 0.7
    }));

    this.petalPool = new ObjectPool(PETAL_POOL_SIZE, () => ({
      active: false,
      state: 0,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      targetY: 0,
      age: 0,
      floatLife: 10,
      swayPhase: 0,
      swayFreq: 2,
      swayAmp: 20,
      char: '✿',
      colorKey: 'sakuraLight',
      scale: 1
    }));
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    for (let i = 0; i < PETAL_POOL_SIZE; i++) {
      const p = this.petalPool.items[i];
      if (!p.active) continue;
      p.x = clamp(p.x, 0, Math.max(20, width));
      p.targetY = Math.min(p.targetY, Math.max(40, height - 16));
    }
  }

  resetRainDrop(drop, randomY) {
    const speedFactor = randRange(0.75, 1.35);
    drop.active = true;
    drop.vy = 420 * speedFactor;
    drop.vx = -72 * speedFactor;
    drop.impactY = randRange(this.height * 0.12, this.height * 0.96);
    drop.y = randomY ? randRange(-80, drop.impactY) : randRange(-140, -15);
    drop.x = randRange(-40, this.width + 160);
    drop.char = speedFactor > 1.12 ? '|' : speedFactor > 0.9 ? '/' : "'";
    drop.alpha = randRange(0.24, 0.56);
  }

  seedRain(enabled) {
    const activeTarget = Math.min(RAIN_POOL_SIZE, Math.max(45, Math.floor(this.width / 18)));
    for (let i = 0; i < RAIN_POOL_SIZE; i++) {
      if (enabled && i < activeTarget) {
        this.resetRainDrop(this.rainPool[i], true);
      } else {
        this.rainPool[i].active = false;
      }
    }
  }

  spawnRainRipple(x, y) {
    const slot = this.rainRipplePool.acquire(true);
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.age = 0;
    slot.duration = randRange(0.55, 0.85);
  }

  triggerCherryBlossomShower(durationSeconds = 25) {
    this.cherryShowerRemaining = Math.max(this.cherryShowerRemaining, durationSeconds);
    for (let i = 0; i < 16; i++) {
      this.spawnFallingPetal(true);
    }
  }

  spawnFallingPetal(staggerY = false) {
    const slot = this.petalPool.acquire(false);
    if (!slot) return;

    slot.active = true;
    slot.state = 0;
    slot.x = randRange(20, Math.max(40, this.width - 20));
    slot.y = staggerY ? randRange(-120, -10) : randRange(-36, -8);
    slot.vx = randRange(-12, 16);
    slot.vy = randRange(48, 86);
    slot.targetY = randRange(this.height * 0.14, this.height * 0.92);
    slot.age = 0;
    slot.floatLife = randRange(7.5, 13.0);
    slot.swayPhase = randRange(0, Math.PI * 2);
    slot.swayFreq = randRange(1.6, 3.0);
    slot.swayAmp = randRange(18, 36);
    slot.char = PETAL_CHARS[Math.floor(Math.random() * PETAL_CHARS.length)];
    slot.colorKey = PETAL_COLORS[Math.floor(Math.random() * PETAL_COLORS.length)];
    slot.scale = randRange(0.85, 1.15);
  }

  findNearestFloatingPetal(x, y, maxDist = 250) {
    let best = null;
    let bestDistSq = maxDist * maxDist;
    const items = this.petalPool.items;
    for (let i = 0; i < PETAL_POOL_SIZE; i++) {
      const p = items[i];
      if (!p.active || p.state !== 1) continue;
      const dx = p.x - x;
      const dy = p.y - y;
      const dSq = dx * dx + dy * dy;
      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        best = p;
      }
    }
    return best;
  }

  update(dt, time, rainEnabled, getFlowAt) {
    for (let i = 0; i < RAIN_POOL_SIZE; i++) {
      const d = this.rainPool[i];
      if (!d.active) continue;

      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.y >= d.impactY) {
        if (d.x >= 0 && d.x <= this.width) {
          this.spawnRainRipple(d.x, d.impactY);
        }
        if (rainEnabled) {
          this.resetRainDrop(d, false);
        } else {
          d.active = false;
        }
      }
    }

    const ripples = this.rainRipplePool.items;
    for (let i = 0; i < RAIN_RIPPLE_POOL_SIZE; i++) {
      const r = ripples[i];
      if (!r.active) continue;
      r.age += dt;
      if (r.age >= r.duration) {
        r.active = false;
      }
    }

    if (this.cherryShowerRemaining > 0) {
      this.cherryShowerRemaining = Math.max(0, this.cherryShowerRemaining - dt);
      this.cherryEmitAccumulator += dt;
      while (this.cherryEmitAccumulator >= 0.14) {
        this.cherryEmitAccumulator -= 0.14;
        this.spawnFallingPetal(false);
      }
    }

    const petalDamp = dampFactor(0.992, dt);
    const petals = this.petalPool.items;
    for (let i = 0; i < PETAL_POOL_SIZE; i++) {
      const p = petals[i];
      if (!p.active) continue;

      p.age += dt;
      if (p.state === 0) {
        p.x += (p.vx + Math.sin(time * p.swayFreq + p.swayPhase) * p.swayAmp) * dt;
        p.y += p.vy * dt;

        if (p.x < -20) p.x += this.width + 40;
        if (p.x > this.width + 20) p.x -= this.width + 40;

        if (p.y >= p.targetY) {
          p.y = p.targetY;
          p.state = 1;
          p.age = 0;
          p.vx = randRange(-7, 7);
          p.vy = randRange(-4, 4);
          this.spawnRainRipple(p.x, p.y);
          if (this.onPetalLand) {
            this.onPetalLand(p.x, p.y);
          }
        }
      } else {
        getFlowAt(p.x, p.y, this._flowVec);
        p.x += (p.vx + this._flowVec.vx * 0.28 + Math.sin(time * 0.8 + p.swayPhase) * 2.5) * dt;
        p.y += (p.vy + this._flowVec.vy * 0.28) * dt;
        p.vx *= petalDamp;
        p.vy *= petalDamp;

        if (p.age >= p.floatLife) {
          p.active = false;
        }
      }
    }
  }

  renderSurface(ctx, atlas, theme) {
    const ripples = this.rainRipplePool.items;
    for (let i = 0; i < RAIN_RIPPLE_POOL_SIZE; i++) {
      const r = ripples[i];
      if (!r.active) continue;

      const progress = r.age / r.duration;
      const alpha = (1 - progress) * 0.55;
      if (alpha <= 0.02) continue;

      const halfSpread = 5 + progress * 22;
      const gx = (Math.floor(r.x / CELL_W) + 0.5) * CELL_W;
      const gy = (Math.floor(r.y / CELL_H) + 0.5) * CELL_H;

      ctx.globalAlpha = alpha;
      atlas.drawGlyph(ctx, '(', theme.ripplePrimaryKey, false, gx - halfSpread, gy);
      atlas.drawGlyph(ctx, ')', theme.ripplePrimaryKey, false, gx + halfSpread, gy);

      if (progress < 0.25) {
        ctx.globalAlpha = alpha * 0.9;
        atlas.drawGlyph(ctx, '·', theme.rippleSecondaryKey, false, gx, gy);
      } else if (progress > 0.35 && progress < 0.85) {
        ctx.globalAlpha = alpha * 0.45;
        atlas.drawGlyph(ctx, '~', theme.rippleSecondaryKey, false, gx, gy + CELL_H * 0.55);
      }
    }

    const petals = this.petalPool.items;
    for (let i = 0; i < PETAL_POOL_SIZE; i++) {
      const p = petals[i];
      if (!p.active || p.state !== 1) continue;
      const fadeOut = p.age > p.floatLife - 3 ? Math.max(0, (p.floatLife - p.age) / 3) : 1;
      if (fadeOut <= 0.02) continue;
      ctx.globalAlpha = 0.88 * fadeOut;
      atlas.drawGlyph(ctx, p.char, p.colorKey, true, p.x, p.y, p.scale);
    }
  }

  renderAtmospheric(ctx, atlas, theme) {
    for (let i = 0; i < RAIN_POOL_SIZE; i++) {
      const d = this.rainPool[i];
      if (!d.active) continue;
      ctx.globalAlpha = d.alpha;
      atlas.drawGlyph(ctx, d.char, theme.rainKey, false, d.x, d.y);
    }

    const petals = this.petalPool.items;
    for (let i = 0; i < PETAL_POOL_SIZE; i++) {
      const p = petals[i];
      if (!p.active || p.state !== 0) continue;
      const entryFade = Math.min(1, p.age * 2.5);
      ctx.globalAlpha = 0.92 * entryFade;
      atlas.drawGlyph(ctx, p.char, p.colorKey, true, p.x, p.y, p.scale);
    }
  }
}
