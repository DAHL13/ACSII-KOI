import { CELL_H, CELL_W } from '../core/constants.js';
import { clamp, randRange } from '../core/math.js';
import { ObjectPool } from '../core/object-pool.js';

const MOTE_POOL_SIZE = 44;
const STAR_CHARS = ['·', '.', '*', '+'];
const STAR_COLORS = ['starCool', 'starCool', 'starBlue', 'starWarm'];
const CURTAIN_BASE_CHARS = ['|', '|', ':', ';', '#'];
const CURTAIN_MID_CHARS = ['|', ':', '~', '+', '*'];
const CURTAIN_TOP_CHARS = ['^', "'", '·', '.'];

const CURTAIN_BANDS = [
  { baseY: 0.29, ampA: 0.085, ampB: 0.036, freqA: 4.1, freqB: 8.6, speedA: 0.22, speedB: -0.34, height: 0.19, weight: 1.05 },
  { baseY: 0.16, ampA: 0.065, ampB: 0.028, freqA: 3.4, freqB: 7.2, speedA: -0.19, speedB: 0.27, height: 0.13, weight: 0.78 }
];

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export class AuroraLayer {
  constructor(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);

    this.stepX = CELL_W;
    this.stepY = CELL_H;
    this.glyphScale = 1;
    this.cols = 0;
    this.rows = 0;

    this.farRidgeY = [];
    this.nearRidgeY = [];
    this.pines = [];
    this.stars = [];
    this.shootingStars = [
      { active: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 0.85, cooldown: 4.5 },
      { active: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 0.85, cooldown: 11.0 }
    ];

    this.surgeTimer = 0;
    this.surgeSpawnAccum = 0;
    this.pulseBoost = 0;
    this.waveOriginX = this.width * 0.5;
    this.waveAge = 99;
    this._terrainCanvas = null;
    this._terrainW = 0;
    this._terrainH = 0;
    this._terrainDpr = 0;
    this._terrainEco = null;

    this.motePool = new ObjectPool(MOTE_POOL_SIZE, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      age: 0,
      life: 2.0,
      char: '·',
      colorKey: 'auroraEmerald'
    }));

    this.buildLandscape();
    this.initStars();
  }

  getStarCount() {
    return this.stars.length;
  }

  getRidgeSampleCount() {
    return this.farRidgeY.length;
  }

  setPointer() {
    // Arctic sky intentionally ignores pointer hover trails
  }

  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this._terrainW = 0;
    this.buildLandscape();
    this.initStars();
  }

  evalFarRidge(nx, h) {
    const leftPeak = Math.exp(-Math.pow((nx - 0.12) / 0.11, 2)) * 0.26;
    const midShoulder = Math.exp(-Math.pow((nx - 0.34) / 0.09, 2)) * 0.11;
    const rightSub = Math.exp(-Math.pow((nx - 0.68) / 0.09, 2)) * 0.12;
    const rightPeak = Math.exp(-Math.pow((nx - 0.87) / 0.12, 2)) * 0.28;
    const crag = 0.015 * Math.sin(nx * 37.0) + 0.008 * Math.cos(nx * 67.0);
    return h * (0.85 - leftPeak - midShoulder - rightSub - rightPeak - crag);
  }

  evalNearRidge(nx, h) {
    const leftHill = Math.exp(-Math.pow((nx - 0.07) / 0.13, 2)) * 0.15;
    const midFoothill = Math.exp(-Math.pow((nx - 0.25) / 0.10, 2)) * 0.07;
    const valleyRight = Math.exp(-Math.pow((nx - 0.92) / 0.14, 2)) * 0.16;
    const crag = 0.009 * Math.sin(nx * 43.0 + 1.2) + 0.006 * Math.cos(nx * 79.0);
    return h * (0.89 - leftHill - midFoothill - valleyRight - crag);
  }

  buildLandscape() {
    const w = this.width;
    const h = this.height;
    const areaRatio = (w * h) / (1280 * 800);
    const cellScale = clamp(Math.sqrt(Math.max(0.45, areaRatio)), 0.96, 1.75);

    this.stepX = CELL_W * cellScale * 1.15;
    this.stepY = CELL_H * cellScale * 1.15;
    this.glyphScale = 0.95 * Math.pow(cellScale, 0.7);
    this.cols = Math.ceil(w / this.stepX) + 1;
    this.rows = Math.ceil((h * 0.78) / this.stepY);

    this.farRidgeY = new Array(this.cols);
    this.nearRidgeY = new Array(this.cols);
    for (let c = 0; c < this.cols; c++) {
      const nx = clamp((c * this.stepX) / Math.max(1, w), 0, 1);
      this.farRidgeY[c] = this.evalFarRidge(nx, h);
      this.nearRidgeY[c] = this.evalNearRidge(nx, h);
    }

    const pines = [];
    const pineCount = Math.max(14, Math.min(34, Math.floor(w / 46)));
    for (let i = 0; i < pineCount; i++) {
      const nx = (i + 0.45) / pineCount + Math.sin(i * 7.3) * 0.015;
      if (nx > 0.30 && nx < 0.70) continue;
      const clampedNx = clamp(nx, 0.02, 0.98);
      const px = clampedNx * w;
      const py = this.evalNearRidge(clampedNx, h) + randRange(-2, 16);
      const heightCells = i % 3 === 0 ? 3 : 2;
      pines.push({ x: px, y: py, levels: heightCells });
    }
    this.pines = pines;
  }

  initStars() {
    const count = 145;
    const stars = new Array(count);
    for (let i = 0; i < count; i++) {
      const x = randRange(8, Math.max(16, this.width - 8));
      const y = randRange(8, Math.max(24, this.height * 0.76));
      stars[i] = {
        x,
        y,
        phase: randRange(0, Math.PI * 2),
        speed: randRange(0.9, 2.2),
        baseAlpha: randRange(0.28, 0.85),
        char: STAR_CHARS[i % STAR_CHARS.length],
        colorKey: STAR_COLORS[i % STAR_COLORS.length]
      };
    }
    this.stars = stars;
  }

  spawnMote(x, y, warm = false) {
    const slot = this.motePool.acquire(true);
    slot.active = true;
    slot.x = x;
    slot.y = y;
    slot.vx = randRange(-24, 24);
    slot.vy = randRange(-72, -32);
    slot.age = 0;
    slot.life = randRange(1.4, 2.5);
    slot.char = Math.random() > 0.45 ? '*' : Math.random() > 0.5 ? '+' : '·';
    slot.colorKey = warm ? 'auroraMagenta' : Math.random() > 0.5 ? 'auroraLime' : 'auroraCyan';
  }

  triggerPulse(x, y, count = 10) {
    this.pulseBoost = Math.min(1.1, this.pulseBoost + 0.65);
    this.waveOriginX = x;
    this.waveAge = 0;
    for (let i = 0; i < count; i++) {
      this.spawnMote(x + randRange(-44, 44), Math.min(y + randRange(-18, 22), this.height * 0.72), i % 3 === 0);
    }
  }

  triggerMultiPulse() {
    this.pulseBoost = Math.min(1.25, this.pulseBoost + 0.95);
    this.waveOriginX = this.width * 0.5;
    this.waveAge = 0;
    for (let i = 0; i < 16; i++) {
      const mx = (i + 0.5) * (this.width / 16) + randRange(-18, 18);
      const my = randRange(this.height * 0.16, this.height * 0.54);
      this.spawnMote(mx, my, i % 3 === 0);
    }
  }

  triggerAuroraSurge(durationSeconds = 25) {
    this.surgeTimer = Math.max(this.surgeTimer, durationSeconds);
    this.surgeSpawnAccum = 0;
    this.triggerMultiPulse();
  }

  resetShootingStar(s) {
    const fromLeft = Math.random() > 0.5;
    s.active = true;
    s.age = 0;
    s.life = randRange(0.5, 0.85);
    s.x = fromLeft ? randRange(this.width * 0.05, this.width * 0.4) : randRange(this.width * 0.6, this.width * 0.95);
    s.y = randRange(this.height * 0.03, this.height * 0.22);
    s.vx = (fromLeft ? 1 : -1) * randRange(420, 620);
    s.vy = randRange(120, 220);
    s.cooldown = randRange(8, 16);
  }

  update(dt) {
    if (this.pulseBoost > 0) {
      this.pulseBoost = Math.max(0, this.pulseBoost - dt * 0.45);
    }
    this.waveAge += dt;

    if (this.surgeTimer > 0) {
      this.surgeTimer = Math.max(0, this.surgeTimer - dt);
      this.surgeSpawnAccum += dt;
      while (this.surgeSpawnAccum >= 0.22) {
        this.surgeSpawnAccum -= 0.22;
        this.spawnMote(
          randRange(this.width * 0.06, this.width * 0.94),
          randRange(this.height * 0.14, this.height * 0.56),
          Math.random() > 0.55
        );
      }
    }

    for (let i = 0; i < this.shootingStars.length; i++) {
      const s = this.shootingStars[i];
      if (s.active) {
        s.age += dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.age >= s.life) s.active = false;
      } else {
        s.cooldown -= dt;
        if (s.cooldown <= 0) this.resetShootingStar(s);
      }
    }

    const motes = this.motePool.items;
    for (let i = 0; i < MOTE_POOL_SIZE; i++) {
      const m = motes[i];
      if (!m.active) continue;
      m.age += dt;
      if (m.age >= m.life) {
        m.active = false;
        continue;
      }
      m.x += m.vx * dt;
      m.y += m.vy * dt;
    }
  }

  drawMountainPolygon(ctx, ridgeY, fillStyle, baseY) {
    const cols = ridgeY.length;
    if (cols < 2) return;
    ctx.globalAlpha = 1;
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.moveTo(0, baseY);
    for (let c = 0; c < cols; c++) {
      ctx.lineTo(Math.min(this.width, c * this.stepX), ridgeY[c]);
    }
    ctx.lineTo(this.width, baseY);
    ctx.closePath();
    ctx.fill();
  }

  ensureTerrainCache(atlas, ecoActive) {
    const dpr = atlas.dpr || 1;
    const w = this.width;
    const h = this.height;
    if (
      this._terrainCanvas &&
      this._terrainW === w &&
      this._terrainH === h &&
      this._terrainDpr === dpr &&
      this._terrainEco === ecoActive
    ) {
      return this._terrainCanvas;
    }

    const pxW = Math.max(1, Math.ceil(w * dpr));
    const pxH = Math.max(1, Math.ceil(h * dpr));
    let cache = this._terrainCanvas;
    if (!cache || cache.width !== pxW || cache.height !== pxH) {
      if (typeof OffscreenCanvas !== 'undefined') {
        cache = new OffscreenCanvas(pxW, pxH);
      } else {
        cache = document.createElement('canvas');
        cache.width = pxW;
        cache.height = pxH;
      }
    }

    const tctx = cache.getContext('2d');
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tctx.clearRect(0, 0, w, h);

    const gScale = this.glyphScale;
    const colStep = ecoActive ? 2 : 1;

    this.drawMountainPolygon(tctx, this.farRidgeY, 'rgba(6, 13, 24, 0.95)', h + 4);
    for (let col = 0; col < this.cols; col += colStep) {
      const px = col * this.stepX;
      if (px > w) continue;
      const fy = this.farRidgeY[col];
      const ny = this.nearRidgeY[col];
      const prevFy = this.farRidgeY[Math.max(0, col - 1)];
      const slope = fy - prevFy;
      const crestChar = Math.abs(slope) < 1.8 ? '^' : slope < 0 ? '/' : '\\';
      const snowCap = fy < h * 0.72;
      tctx.globalAlpha = snowCap ? 0.76 : 0.60;
      atlas.drawGlyph(tctx, crestChar, snowCap ? 'iceCyan' : 'lilyVeinNight', false, px, fy + 2, gScale * 0.95);

      for (let py = fy + this.stepY; py < ny - 4; py += this.stepY * (ecoActive ? 2 : 1)) {
        const ch = (col + Math.round(py / this.stepY)) % 3 === 0 ? '%' : ':';
        tctx.globalAlpha = 0.52;
        atlas.drawGlyph(tctx, ch, 'mountainRidge', false, px, py, gScale * 0.88);
      }
    }

    this.drawMountainPolygon(tctx, this.nearRidgeY, 'rgba(3, 8, 15, 0.98)', h + 4);
    for (let col = 0; col < this.cols; col += colStep) {
      const px = col * this.stepX;
      if (px > w) continue;
      const ny = this.nearRidgeY[col];
      const prevNy = this.nearRidgeY[Math.max(0, col - 1)];
      const slope = ny - prevNy;
      const ridgeChar = Math.abs(slope) < 1.5 ? '_' : slope < 0 ? '/' : '\\';
      tctx.globalAlpha = 0.72;
      atlas.drawGlyph(tctx, ridgeChar, 'lilyVeinNight', false, px, ny + 1, gScale * 0.92);
    }

    for (let i = 0; i < this.pines.length; i++) {
      const pine = this.pines[i];
      tctx.globalAlpha = 0.86;
      for (let l = 0; l < pine.levels; l++) {
        atlas.drawGlyph(tctx, '^', 'lilyMidDay', false, pine.x, pine.y - l * 7, gScale * 0.88);
      }
      atlas.drawGlyph(tctx, '|', 'lilyRimDay', false, pine.x, pine.y + 6, gScale * 0.82);
    }

    tctx.globalAlpha = 1;
    this._terrainCanvas = cache;
    this._terrainW = w;
    this._terrainH = h;
    this._terrainDpr = dpr;
    this._terrainEco = ecoActive;
    return cache;
  }

  render(ctx, atlas, time, _solarPhase, ecoActive = false) {
    const w = this.width;
    const h = this.height;
    const gScale = this.glyphScale;
    const curtainScale = ecoActive ? gScale * 1.38 : gScale;

    // 1. Arctic night stars above mountains
    for (let i = 0; i < this.stars.length; i++) {
      const st = this.stars[i];
      const cIdx = clamp(Math.round(st.x / this.stepX), 0, this.farRidgeY.length - 1);
      if (st.y >= this.farRidgeY[cIdx] - 8) continue;
      const twinkle = 0.52 + 0.48 * Math.sin(time * st.speed + st.phase);
      const alpha = st.baseAlpha * twinkle;
      if (alpha <= 0.03) continue;
      ctx.globalAlpha = alpha;
      atlas.drawGlyph(ctx, st.char, st.colorKey, false, st.x, st.y, 0.82);
    }

    // 2. High-altitude shooting stars
    for (let i = 0; i < this.shootingStars.length; i++) {
      const s = this.shootingStars[i];
      if (!s.active) continue;
      const fade = Math.sin((s.age / s.life) * Math.PI);
      if (fade <= 0.02) continue;
      ctx.globalAlpha = 0.8 * fade;
      atlas.drawGlyph(ctx, '*', 'starWarm', true, s.x, s.y, 0.96);
      ctx.globalAlpha = 0.4 * fade;
      atlas.drawGlyph(ctx, '·', 'starCool', false, s.x - s.vx * 0.024, s.y - s.vy * 0.024, 0.86);
    }

    // 3. Shimmering multi-curtain ASCII Aurora Borealis
    const colStep = ecoActive ? 2 : 1;
    const rowStep = ecoActive ? 2 : 1;
    const surgeActive = this.surgeTimer > 0 ? Math.min(1, this.surgeTimer / 2.5) : 0;
    const energyGain = 1 + this.pulseBoost * 0.42 + surgeActive * 0.38;
    const waveSpeed = 480;
    const waveRadius = this.waveAge * waveSpeed;

    for (let col = 0; col < this.cols; col += colStep) {
      const px = col * this.stepX;
      if (px > w) continue;
      const nx = px / Math.max(1, w);
      const farCut = this.farRidgeY[col] ?? h;
      const waveDist = Math.abs(px - this.waveOriginX);
      const shock =
        this.waveAge < 2.2
          ? Math.exp(-Math.pow((waveDist - waveRadius) / 90, 2)) * (1 - this.waveAge / 2.2) * 0.55
          : 0;

      for (let b = 0; b < CURTAIN_BANDS.length; b++) {
        const band = CURTAIN_BANDS[b];
        const lowerY =
          h *
          (band.baseY +
            band.ampA * Math.sin(nx * band.freqA + time * band.speedA + b * 1.1) +
            band.ampB * Math.cos(nx * band.freqB + time * band.speedB));
        const rayHeight = h * band.height * (0.85 + 0.25 * Math.sin(nx * 6.5 - time * 0.4 + b)) * (1 + surgeActive * 0.22);
        const gapMask = 0.28 + 0.72 * Math.pow(0.5 + 0.5 * Math.sin(nx * 5.4 + time * 0.18 + b * 2.2), 1.35);
        const fold =
          (0.46 +
            0.36 * Math.sin(nx * 24.0 + time * 1.15 + b * 2.1) +
            0.18 * Math.cos(nx * 41.0 - time * 1.65)) *
          gapMask;

        const rowTop = Math.max(0, Math.floor((lowerY - rayHeight) / this.stepY));
        const rowBot = Math.min(this.rows - 1, Math.ceil((lowerY + this.stepY * 1.2) / this.stepY));

        for (let row = rowTop; row <= rowBot; row += rowStep) {
          const py = row * this.stepY;
          if (py >= farCut - 2) continue;

          const dyAbove = lowerY - py;
          if (dyAbove < -this.stepY * 1.0) continue;

          let vProfile;
          let hNorm;
          if (dyAbove < 0) {
            vProfile = smoothstep(-this.stepY * 1.0, 0, dyAbove) * 0.78;
            hNorm = 0;
          } else {
            hNorm = clamp(dyAbove / Math.max(18, rayHeight), 0, 1);
            // Bright razor-sharp lower rim that dissolves into delicate vertical rays
            const lowerRim = Math.exp(-Math.pow(hNorm / 0.18, 2)) * 0.45;
            vProfile = (Math.pow(1 - hNorm, 1.48) + lowerRim) * smoothstep(-0.02, 0.06, hNorm);
          }

          const ripple = 0.88 + 0.12 * Math.sin(py * 0.065 - time * 1.4 + col * 0.35);
          const intensity = vProfile * fold * ripple * band.weight * energyGain * (1 + shock);
          if (intensity <= 0.17) continue;

          const hash = (col * 17 + row * 31 + b * 13 + Math.floor(time * 4.5)) % 5;
          let ch;
          let colorKey;
          let glowing = false;

          if (hNorm < 0.24) {
            ch = CURTAIN_BASE_CHARS[hash % CURTAIN_BASE_CHARS.length];
            colorKey = intensity > 0.65 ? 'auroraLime' : 'auroraEmerald';
            glowing = !ecoActive && intensity > 0.42;
          } else if (hNorm < 0.56) {
            ch = CURTAIN_MID_CHARS[hash % CURTAIN_MID_CHARS.length];
            colorKey = intensity > 0.44 ? 'auroraCyan' : 'auroraTeal';
            glowing = !ecoActive && intensity > 0.58;
          } else if (hNorm < 0.82) {
            ch = CURTAIN_MID_CHARS[(hash + 1) % CURTAIN_MID_CHARS.length];
            colorKey = 'auroraViolet';
          } else {
            ch = CURTAIN_TOP_CHARS[hash % CURTAIN_TOP_CHARS.length];
            colorKey = 'auroraMagenta';
          }

          ctx.globalAlpha = clamp(intensity * 0.82, 0.10, 0.96);
          atlas.drawGlyph(ctx, ch, colorKey, glowing, px, py, curtainScale);
        }
      }
    }

    // 4. Silhouetted ASCII alpine mountain ridges & pines (cached in OffscreenCanvas)
    const terrainCache = this.ensureTerrainCache(atlas, ecoActive);
    ctx.globalAlpha = 1;
    ctx.drawImage(terrainCache, 0, 0, w, h);

    // 5. Rising geomagnetic aurora motes from interaction & Pomodoro surge
    const motes = this.motePool.items;
    for (let i = 0; i < MOTE_POOL_SIZE; i++) {
      const m = motes[i];
      if (!m.active) continue;
      const lifeT = m.age / m.life;
      const alpha = Math.sin(lifeT * Math.PI) * 0.88;
      if (alpha <= 0.03) continue;
      ctx.globalAlpha = alpha;
      atlas.drawGlyph(ctx, m.char, m.colorKey, !ecoActive, m.x, m.y, 0.92 + (1 - lifeT) * 0.18);
    }

    ctx.globalAlpha = 1;
  }
}
