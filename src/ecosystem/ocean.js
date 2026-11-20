import { CELL_H, CELL_W } from '../core/constants.js';
import { clamp, dampFactor, lerpAngle, randRange } from '../core/math.js';
import { ObjectPool } from '../core/object-pool.js';

const PLANKTON_POOL_SIZE = 160;
const BUBBLE_POOL_SIZE = 70;
const PLANKTON_CHARS = ['·', '*', '+'];
const BUBBLE_CHARS = ['°', 'o', '·'];

export class OceanLayer {
  constructor(width, height, options = {}) {
    this.width = width;
    this.height = height;
    this.currentsEnabled = Boolean(options.currentsEnabled);
    this.planktonEnabled = Boolean(options.planktonEnabled);
    this.kelpEnabled = Boolean(options.kelpEnabled);
    this.jellyfishEnabled = Boolean(options.jellyfishEnabled);

    this.bubbleEmitAccum = 0;
    this.currentParticles = [];
    this.sunRays = [];
    this.kelpStalks = [];
    this.jellyfish = [];
    this._flowVec = { vx: 0, vy: 0 };

    this.planktonPool = new ObjectPool(PLANKTON_POOL_SIZE, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      age: 0,
      life: 0.9,
      char: '·',
      colorKey: 'planktonCyan'
    }));

    this.bubblePool = new ObjectPool(BUBBLE_POOL_SIZE, () => ({
      active: false,
      x: 0,
      y: 0,
      vy: -36,
      surfaceY: 40,
      age: 0,
      wobblePhase: 0,
      wobbleFreq: 3,
      char: '°'
    }));

    this.initCurrentsAndRays();
    this.initKelp();
    this.initJellyfish();
  }

  initCurrentsAndRays() {
    const currentCount = Math.max(30, Math.min(54, Math.floor((this.width * this.height) / 34000)));
    this.currentParticles = new Array(currentCount);
    for (let i = 0; i < currentCount; i++) {
      this.currentParticles[i] = {
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        speedMult: randRange(0.75, 1.35),
        phase: randRange(0, Math.PI * 2),
        char: i % 3 === 0 ? '≈' : i % 2 === 0 ? '~' : '·',
        deep: i % 2 === 1
      };
    }

    const rayCount = 12;
    this.sunRays = new Array(rayCount);
    for (let i = 0; i < rayCount; i++) {
      this.sunRays[i] = {
        x: randRange(this.width * 0.08, this.width * 0.92),
        y: randRange(20, this.height * 0.55),
        len: 4 + (i % 4),
        phase: randRange(0, Math.PI * 2),
        vx: randRange(3, 8)
      };
    }
  }

  initKelp() {
    this.kelpStalks = [];
    const w = this.width;
    const h = this.height;
    const spots = [
      [w * 0.03, h],
      [w * 0.055, h],
      [w * 0.085, h],
      [w * 0.125, h],
      [w * 0.16, h],
      [w * 0.84, h],
      [w * 0.875, h],
      [w * 0.915, h],
      [w * 0.945, h],
      [w * 0.97, h],
      [16, h * 0.78],
      [24, h * 0.62],
      [w - 16, h * 0.76],
      [w - 24, h * 0.58]
    ];
    for (let i = 0; i < spots.length; i++) {
      this.kelpStalks.push({
        baseX: spots[i][0] + randRange(-8, 8),
        baseY: spots[i][1],
        segments: 6 + (i % 5),
        segLen: randRange(11, 14),
        phase: randRange(0, Math.PI * 2),
        swayAmp: randRange(8, 16)
      });
    }
  }

  initJellyfish() {
    this.jellyfish = new Array(3);
    for (let i = 0; i < 3; i++) {
      const heading = randRange(-Math.PI * 0.85, -Math.PI * 0.15);
      this.jellyfish[i] = {
        x: randRange(this.width * 0.15, this.width * 0.85),
        y: randRange(this.height * 0.25, this.height * 0.82),
        vx: Math.cos(heading) * 14,
        vy: Math.sin(heading) * 14,
        heading,
        pulsePhase: randRange(0, Math.PI * 2),
        pulseSpeed: randRange(1.7, 2.3),
        scale: randRange(0.85, 1.15)
      };
    }
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.initCurrentsAndRays();
    this.initKelp();
    for (let i = 0; i < this.jellyfish.length; i++) {
      const j = this.jellyfish[i];
      j.x = clamp(j.x, 32, Math.max(32, width - 32));
      j.y = clamp(j.y, 32, Math.max(32, height - 32));
    }
  }

  getFlowAt(x, y, time, out) {
    if (!this.currentsEnabled) {
      out.vx = 0;
      out.vy = 0;
      return out;
    }
    out.vx = 24 + 10 * Math.sin(y * 0.004 + time * 0.4);
    out.vy = 5 * Math.cos(x * 0.003 + time * 0.28);
    return out;
  }

  spawnPlankton(x, y, vx = 0, vy = 0) {
    if (!this.planktonEnabled) return;
    const slot = this.planktonPool.acquire(true);
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.vx = vx + randRange(-14, 14);
    slot.vy = vy + randRange(-14, 14);
    slot.age = 0;
    slot.life = randRange(0.65, 1.35);
    slot.char = PLANKTON_CHARS[Math.floor(Math.random() * PLANKTON_CHARS.length)];
    slot.colorKey = Math.random() > 0.35 ? 'planktonCyan' : 'planktonBlue';
  }

  spawnBubble(x, y, surfaceY) {
    if (!this.planktonEnabled) return;
    const slot = this.bubblePool.acquire(false);
    if (!slot) return;

    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.vy = randRange(-44, -26);
    slot.surfaceY = surfaceY !== undefined ? surfaceY : randRange(this.height * 0.06, Math.max(80, y - 40));
    slot.age = 0;
    slot.wobblePhase = randRange(0, Math.PI * 2);
    slot.wobbleFreq = randRange(2.2, 4.2);
    slot.char = BUBBLE_CHARS[Math.floor(Math.random() * BUBBLE_CHARS.length)];
  }

  update(dt, time, obstacleRect, onBubblePop) {
    if (this.currentsEnabled) {
      for (let i = 0; i < this.currentParticles.length; i++) {
        const cp = this.currentParticles[i];
        this.getFlowAt(cp.x, cp.y, time, this._flowVec);
        cp.x += this._flowVec.vx * cp.speedMult * dt;
        cp.y += this._flowVec.vy * cp.speedMult * dt;
        if (cp.x > this.width + 20) cp.x = -20;
        if (cp.x < -20) cp.x = this.width + 20;
        if (cp.y > this.height + 20) cp.y = -20;
        if (cp.y < -20) cp.y = this.height + 20;
      }
      for (let i = 0; i < this.sunRays.length; i++) {
        const sr = this.sunRays[i];
        sr.x += sr.vx * dt;
        if (sr.x > this.width + 40) sr.x = -40;
      }
    }

    if (this.jellyfishEnabled) {
      const jellyBlend = 1 - dampFactor(0.95, dt);
      for (let i = 0; i < this.jellyfish.length; i++) {
        const j = this.jellyfish[i];
        j.pulsePhase += j.pulseSpeed * dt;
        const thrust = Math.pow(Math.max(0, Math.sin(j.pulsePhase)), 2);
        const targetSpd = 6 + thrust * 24;
        j.heading += Math.sin(time * 0.4 + i * 2.1) * 0.22 * dt;

        const margin = 95;
        if (j.x < margin) j.heading = lerpAngle(j.heading, 0, dt * 1.2);
        else if (j.x > this.width - margin) j.heading = lerpAngle(j.heading, Math.PI, dt * 1.2);
        if (j.y < margin) j.heading = lerpAngle(j.heading, Math.PI * 0.5, dt * 1.2);
        else if (j.y > this.height - margin) j.heading = lerpAngle(j.heading, -Math.PI * 0.5, dt * 1.2);

        if (obstacleRect && obstacleRect.width > 0 && obstacleRect.height > 0) {
          const pad = 36;
          if (
            j.x > obstacleRect.left - pad &&
            j.x < obstacleRect.right + pad &&
            j.y > obstacleRect.top - pad &&
            j.y < obstacleRect.bottom + pad
          ) {
            const cx = (obstacleRect.left + obstacleRect.right) * 0.5;
            const cy = (obstacleRect.top + obstacleRect.bottom) * 0.5;
            const awayAngle = Math.atan2(j.y - cy, j.x - cx);
            j.heading = lerpAngle(j.heading, awayAngle, clamp(dt * 2.2, 0, 1));
          }
        }

        j.vx += (Math.cos(j.heading) * targetSpd - j.vx) * jellyBlend;
        j.vy += (Math.sin(j.heading) * targetSpd - j.vy) * jellyBlend;
        this.getFlowAt(j.x, j.y, time, this._flowVec);
        j.x += (j.vx + this._flowVec.vx * 0.25) * dt;
        j.y += (j.vy + this._flowVec.vy * 0.25) * dt;
      }
    }

    if (this.planktonEnabled) {
      this.bubbleEmitAccum += dt;
      if (this.bubbleEmitAccum >= 0.26) {
        this.bubbleEmitAccum = 0;
        const bx = randRange(30, Math.max(60, this.width - 30));
        const by = randRange(this.height * 0.55, this.height - 20);
        this.spawnBubble(bx, by, randRange(this.height * 0.08, by - 50));
      }
    }

    const planktonDamp = dampFactor(0.94, dt);
    const plankton = this.planktonPool.items;
    for (let i = 0; i < PLANKTON_POOL_SIZE; i++) {
      const pl = plankton[i];
      if (!pl.active) continue;
      pl.age += dt;
      if (pl.age >= pl.life) {
        pl.active = false;
        continue;
      }
      this.getFlowAt(pl.x, pl.y, time, this._flowVec);
      pl.x += (pl.vx + this._flowVec.vx * 0.45) * dt;
      pl.y += (pl.vy + this._flowVec.vy * 0.45) * dt;
      pl.vx *= planktonDamp;
      pl.vy *= planktonDamp;
    }

    const bubbles = this.bubblePool.items;
    for (let i = 0; i < BUBBLE_POOL_SIZE; i++) {
      const b = bubbles[i];
      if (!b.active) continue;
      b.age += dt;
      this.getFlowAt(b.x, b.y, time, this._flowVec);
      b.x += (Math.sin(b.age * b.wobbleFreq + b.wobblePhase) * 14 + this._flowVec.vx * 0.35) * dt;
      b.y += b.vy * dt;
      if (b.y <= b.surfaceY || b.y < 14) {
        b.active = false;
        if (b.x > 10 && b.x < this.width - 10 && onBubblePop) {
          onBubblePop(b.x, b.y);
        }
      }
    }
  }

  renderSubaqueous(ctx, atlas, time, solarPhase) {
    if (this.currentsEnabled) {
      for (let i = 0; i < this.currentParticles.length; i++) {
        const cp = this.currentParticles[i];
        const alpha = 0.09 + 0.08 * Math.sin(time * 1.4 + cp.phase);
        if (alpha <= 0.02) continue;
        const gx = (Math.floor(cp.x / CELL_W) + 0.5) * CELL_W;
        const gy = (Math.floor(cp.y / CELL_H) + 0.5) * CELL_H;
        ctx.globalAlpha = alpha;
        atlas.drawGlyph(ctx, cp.char, cp.deep ? 'currentDeep' : 'currentTeal', false, gx, gy);
      }

      if (solarPhase === 'day' || solarPhase === 'sunset') {
        const rayKey = solarPhase === 'day' ? 'waterCyan' : 'waterAmber';
        for (let i = 0; i < this.sunRays.length; i++) {
          const sr = this.sunRays[i];
          const rayPulse = 0.045 + 0.035 * Math.sin(time * 0.7 + sr.phase);
          ctx.globalAlpha = rayPulse;
          for (let k = 0; k < sr.len; k++) {
            atlas.drawGlyph(ctx, '/', rayKey, false, sr.x - k * CELL_W * 1.4, sr.y + k * CELL_H * 1.8);
          }
        }
      }
    }

    if (this.kelpEnabled) {
      ctx.globalAlpha = solarPhase === 'night' ? 0.55 : 0.72;
      for (let i = 0; i < this.kelpStalks.length; i++) {
        const st = this.kelpStalks[i];
        for (let k = 0; k < st.segments; k++) {
          const ratio = k / st.segments;
          const sway = Math.sin(time * 1.45 + st.phase + k * 0.48) * st.swayAmp * ratio;
          const kx = st.baseX + sway;
          const ky = st.baseY - k * st.segLen - 6;
          const char = k === st.segments - 1 ? '~' : sway > 2.5 ? ')' : sway < -2.5 ? '(' : '|';
          const colorKey = ratio < 0.35 ? 'kelpDark' : ratio < 0.75 ? 'kelpMid' : 'kelpTip';
          atlas.drawGlyph(ctx, char, colorKey, false, kx, ky);
        }
      }
    }

    if (this.jellyfishEnabled) {
      for (let i = 0; i < this.jellyfish.length; i++) {
        this.renderSingleJellyfish(ctx, atlas, this.jellyfish[i]);
      }
    }
  }

  renderSingleJellyfish(ctx, atlas, j) {
    const cos = Math.cos(j.heading);
    const sin = Math.sin(j.heading);
    const rx = -sin;
    const ry = cos;
    const contract = Math.sin(j.pulsePhase);
    const bellW = (17 - contract * 4.5) * j.scale;
    const baseAlpha = 0.52 + 0.16 * (1 - contract * 0.5);

    ctx.globalAlpha = baseAlpha;
    atlas.drawGlyph(ctx, '@', 'jellyBell', true, j.x + cos * 6 * j.scale, j.y + sin * 6 * j.scale, 1.05);
    atlas.drawGlyph(ctx, '#', 'jellyBell', true, j.x, j.y);
    atlas.drawGlyph(ctx, '(', 'jellyRim', true, j.x - rx * bellW * 0.55, j.y - ry * bellW * 0.55);
    atlas.drawGlyph(ctx, ')', 'jellyRim', true, j.x + rx * bellW * 0.55, j.y + ry * bellW * 0.55);
    atlas.drawGlyph(
      ctx,
      '*',
      'jellyRim',
      true,
      j.x - rx * bellW * 0.28 + cos * 4 * j.scale,
      j.y - ry * bellW * 0.28 + sin * 4 * j.scale
    );
    atlas.drawGlyph(
      ctx,
      '*',
      'jellyRim',
      true,
      j.x + rx * bellW * 0.28 + cos * 4 * j.scale,
      j.y + ry * bellW * 0.28 + sin * 4 * j.scale
    );

    for (let tIdx = 0; tIdx < 4; tIdx++) {
      const latOffset = (tIdx - 1.5) * bellW * 0.34;
      for (let seg = 1; seg <= 4; seg++) {
        const distBack = seg * 10.5 * j.scale;
        const wave = Math.sin(j.pulsePhase - seg * 0.72 + tIdx * 0.9) * (3 + seg * 1.4);
        const tx = j.x - cos * distBack + rx * (latOffset + wave);
        const ty = j.y - sin * distBack + ry * (latOffset + wave);
        ctx.globalAlpha = baseAlpha * (1 - seg * 0.17);
        const ch = seg === 4 ? '·' : seg % 2 === 1 ? '~' : ':';
        atlas.drawGlyph(ctx, ch, 'jellyTentacle', seg <= 2, tx, ty, 0.92);
      }
    }
  }

  renderSurface(ctx, atlas) {
    const plankton = this.planktonPool.items;
    for (let i = 0; i < PLANKTON_POOL_SIZE; i++) {
      const pl = plankton[i];
      if (!pl.active) continue;
      const lifeT = pl.age / pl.life;
      const alpha = (1 - lifeT) * (0.65 + 0.35 * Math.sin(pl.age * 14));
      if (alpha <= 0.03) continue;
      ctx.globalAlpha = alpha;
      atlas.drawGlyph(ctx, pl.char, pl.colorKey, true, pl.x, pl.y, 0.9 + (1 - lifeT) * 0.2);
    }

    const bubbles = this.bubblePool.items;
    for (let i = 0; i < BUBBLE_POOL_SIZE; i++) {
      const b = bubbles[i];
      if (!b.active) continue;
      const fade = Math.min(1, b.age * 3);
      ctx.globalAlpha = 0.55 * fade;
      atlas.drawGlyph(ctx, b.char, 'bubblePearl', false, b.x, b.y, 0.85);
    }
  }
}
