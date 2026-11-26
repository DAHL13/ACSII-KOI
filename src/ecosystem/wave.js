import { CELL_H, CELL_W } from '../core/constants.js';
import { clamp, dampFactor, lerp, randRange } from '../core/math.js';
import { ObjectPool } from '../core/object-pool.js';

export const BOAT_COUNT = 3;
export const WAVE_CLAW_COUNT = 26;

const CAM_DIST = 920;
const SPRAY_POOL_SIZE = 160;
const TEMPEST_POOL_SIZE = 44;
const SURGE_RING_SIZE = 8;
const HOLLOW_MIST_COUNT = 84;

const PAD_X = 48;
const PAD_Y = 28;

// Pre-indexed ASCII glyph & palette tables for zero-allocation Z-buffer rendering.
// Every character exists in ATLAS_CHARS and every color exists in PALETTE_COLORS.
const WAVE_CHARS = [
  '.',  // 0
  '·',  // 1
  ',',  // 2
  ':',  // 3
  ';',  // 4
  '-',  // 5
  '~',  // 6
  '≈',  // 7
  '_',  // 8
  '/',  // 9
  '\\', // 10
  '|',  // 11
  '(',  // 12
  ')',  // 13
  '^',  // 14
  '*',  // 15
  '+',  // 16
  'o',  // 17
  '°',  // 18
  'c',  // 19
  's',  // 20
  'S',  // 21
  '%',  // 22
  '#',  // 23
  '@',  // 24
  '=',  // 25
  '0',  // 26
  'O',  // 27
  'M',  // 28
  'W',  // 29
  'v',  // 30
  'n',  // 31
  'u'   // 32
];

const CH_DOT = 0;
const CH_MIDDOT = 1;
const CH_COLON = 3;
const CH_SEMI = 4;
const CH_DASH = 5;
const CH_TILDE = 6;
const CH_APPROX = 7;
const CH_UNDER = 8;
const CH_PIPE = 11;
const CH_STAR = 15;
const CH_O_LOW = 17;
const CH_DEG = 18;
const CH_C = 19;
const CH_S_LOW = 20;
const CH_S_CAP = 21;
const CH_PCT = 22;
const CH_HASH = 23;
const CH_AT = 24;
const CH_EQ = 25;
const CH_O_CAP = 27;
const CH_M = 28;
const CH_W = 29;
const CH_N = 31;
const CH_U = 32;

const WAVE_COLORS = [
  'waveAbyss',         // 0
  'wavePrussianDeep',  // 1
  'waveIndigoMid',     // 2
  'wavePrussianMid',   // 3
  'wavePrussianLight', // 4
  'waveCerulean',      // 5
  'waveFoamAqua',      // 6
  'waveSeafoam',       // 7
  'waveFoamIce',       // 8
  'waveFoamWhite',     // 9
  'waveWashiCream',    // 10
  'waveWashiWarm',     // 11
  'waveFujiDark',      // 12
  'waveFujiMid',       // 13
  'waveWoodDark',      // 14
  'waveWoodMid',       // 15
  'waveWoodLight',     // 16
  'waveInk'            // 17
];

const COL_ABYSS = 0;
const COL_PRUSSIAN_DEEP = 1;
const COL_INDIGO_MID = 2;
const COL_PRUSSIAN_MID = 3;
const COL_PRUSSIAN_LIGHT = 4;
const COL_CERULEAN = 5;
const COL_FOAM_AQUA = 6;
const COL_SEAFOAM = 7;
const COL_FOAM_ICE = 8;
const COL_FOAM_WHITE = 9;
const COL_WOOD_DARK = 14;
const COL_WOOD_MID = 15;
const COL_WOOD_LIGHT = 16;
const COL_INK = 17;

const FOAM_CHARS = [CH_AT, CH_HASH, CH_PCT, CH_S_CAP, CH_S_LOW, CH_STAR, CH_O_CAP];
const WATER_RIB_CHARS = [CH_HASH, CH_PCT, CH_S_CAP, CH_S_LOW, CH_TILDE, CH_APPROX, CH_COLON];
const SPRAY_GLYPHS = ['*', 'o', '°', '·', '.'];
const TEMPEST_GLYPHS = ['✿', '❀', '*', '°', '·'];

// Directional Gerstner-like wave trains (dx, dz, freq, speed, amp, steepness)
const WAVE_TRAINS = [
  { dx: 0.92, dz: -0.39, freq: 0.0115, speed: 1.35, amp: 18, steep: 0.55 },
  { dx: 0.64, dz: 0.77, freq: 0.0175, speed: 1.72, amp: 12, steep: 0.45 },
  { dx: -0.45, dz: 0.89, freq: 0.0245, speed: 2.08, amp: 8, steep: 0.35 },
  { dx: 0.98, dz: 0.18, freq: 0.036, speed: 2.55, amp: 4.5, steep: 0.25 }
];

// 26 articulated 3D clawing foam talons (18 multi-tier on Great Wave arch, 8 on foreground Mini-Fuji)
const CLAW_SPECS = [
  // Great Wave breaking lip (group 0) — upper crest curls, sweeping dragon talons & lower inner hooks
  { group: 0, s: 0.56, reach: 34, drop: -18, curl: 0.46, zOff: -4, phase: 0.1, forks: 2 },
  { group: 0, s: 0.61, reach: 42, drop: -15, curl: 0.52, zOff: -5, phase: 0.5, forks: 2 },
  { group: 0, s: 0.65, reach: 52, drop: -11, curl: 0.58, zOff: -6, phase: 0.9, forks: 2 },
  { group: 0, s: 0.69, reach: 64, drop: -6, curl: 0.66, zOff: -7, phase: 1.3, forks: 2 },
  { group: 0, s: 0.72, reach: 76, drop: 2, curl: 0.74, zOff: -8, phase: 1.7, forks: 3 },
  { group: 0, s: 0.75, reach: 86, drop: 8, curl: 0.82, zOff: -6, phase: 2.0, forks: 2 },
  { group: 0, s: 0.78, reach: 96, drop: 15, curl: 0.88, zOff: -4, phase: 2.4, forks: 3 },
  { group: 0, s: 0.81, reach: 104, drop: 22, curl: 0.94, zOff: -2, phase: 2.8, forks: 2 },
  { group: 0, s: 0.83, reach: 110, drop: 28, curl: 1.00, zOff: 0, phase: 3.1, forks: 3 },
  { group: 0, s: 0.86, reach: 112, drop: 36, curl: 1.05, zOff: 2, phase: 3.5, forks: 3 },
  { group: 0, s: 0.88, reach: 106, drop: 44, curl: 1.08, zOff: 4, phase: 3.9, forks: 2 },
  { group: 0, s: 0.90, reach: 98, drop: 50, curl: 1.12, zOff: 6, phase: 4.3, forks: 3 },
  { group: 0, s: 0.92, reach: 90, drop: 55, curl: 1.14, zOff: 8, phase: 4.7, forks: 2 },
  { group: 0, s: 0.94, reach: 82, drop: 60, curl: 1.16, zOff: 10, phase: 5.0, forks: 2 },
  { group: 0, s: 0.96, reach: 74, drop: 64, curl: 1.18, zOff: 12, phase: 5.4, forks: 2 },
  { group: 0, s: 0.975, reach: 64, drop: 68, curl: 1.18, zOff: 14, phase: 5.8, forks: 2 },
  { group: 0, s: 0.99, reach: 54, drop: 72, curl: 1.20, zOff: 15, phase: 6.0, forks: 2 },
  { group: 0, s: 1.00, reach: 44, drop: 75, curl: 1.22, zOff: 16, phase: 6.2, forks: 2 },
  // Foreground Mini-Fuji wave peak (group 1)
  { group: 1, s: 0.34, reach: 24, drop: 10, curl: 0.58, zOff: -4, phase: 0.4, forks: 2 },
  { group: 1, s: 0.39, reach: 32, drop: 14, curl: 0.68, zOff: -5, phase: 0.9, forks: 2 },
  { group: 1, s: 0.44, reach: 40, drop: 18, curl: 0.78, zOff: -6, phase: 1.4, forks: 2 },
  { group: 1, s: 0.49, reach: 48, drop: 24, curl: 0.86, zOff: -7, phase: 1.9, forks: 3 },
  { group: 1, s: 0.54, reach: 52, drop: 28, curl: 0.94, zOff: -8, phase: 2.3, forks: 2 },
  { group: 1, s: 0.59, reach: 46, drop: 30, curl: 0.98, zOff: -6, phase: 2.8, forks: 2 },
  { group: 1, s: 0.64, reach: 38, drop: 32, curl: 1.00, zOff: -4, phase: 3.3, forks: 2 },
  { group: 1, s: 0.69, reach: 30, drop: 34, curl: 1.04, zOff: -2, phase: 3.9, forks: 2 }
];

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export class GreatWaveLayer {
  constructor(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.time = 0;

    this.wsX = 1;
    this.wsY = 1;
    this.areaScale = 1;
    this.perspScale = 1;
    this.horizonY = this.height * 0.68;

    // Autonomous 3D ocean camera buoy sway (mouse tracking disabled)
    this.pointerActive = false;
    this.camParallaxX = 0;
    this.camParallaxY = 0;
    this.camX = 0;
    this.camY = 0;

    // Natural & interactive swell state
    this.swellPhase = 0;
    this.surgeBoost = 0;
    this.swellBoost = 0;
    this.swellWaveActive = false;
    this.swellWaveProgress = 0;
    this._hasActiveImpulse = false;
    this.tempestTimer = 0;
    this.tempestSpawnAccum = 0;
    this.ambientSprayAccum = 0;

    this.crestX = this.width * 0.32;
    this.crestY = this.height * 0.22;

    // Localized radial 3D click surges (ring buffer)
    this.surges = new Array(SURGE_RING_SIZE);
    for (let i = 0; i < SURGE_RING_SIZE; i++) {
      this.surges[i] = { active: false, wx: 0, wz: 0, age: 0, duration: 2.4, amp: 28 };
    }
    this.surgeCursor = 0;

    // 3 dynamic pitching Oshiokuri-bune boats
    this.boats = [
      {
        baseWx: -435,
        wz: -26,
        halfLen: 88,
        hullDepth: 22,
        rowerCount: 8,
        dir: -1,
        wx: -435,
        wy: 0,
        pitch: 0.34,
        roll: 0,
        sx: this.width * 0.16,
        sy: this.height * 0.56
      },
      {
        baseWx: 118,
        wz: -62,
        halfLen: 128,
        hullDepth: 26,
        rowerCount: 10,
        dir: 1,
        wx: 118,
        wy: -100,
        pitch: 0.14,
        roll: 0,
        sx: this.width * 0.58,
        sy: this.height * 0.84
      },
      {
        baseWx: 305,
        wz: 24,
        halfLen: 96,
        hullDepth: 20,
        rowerCount: 9,
        dir: 1,
        wx: 305,
        wy: 0,
        pitch: 0.32,
        roll: 0,
        sx: this.width * 0.72,
        sy: this.height * 0.65
      }
    ];

    // Pooled 3D sea spray droplets & tempest coastal petals
    this.sprayPool = new ObjectPool(SPRAY_POOL_SIZE, () => ({
      active: false,
      wx: 0,
      wy: 0,
      wz: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      age: 0,
      life: 1.4,
      char: '*',
      colorKey: 'waveFoamWhite',
      glow: false
    }));

    this.tempestPool = new ObjectPool(TEMPEST_POOL_SIZE, () => ({
      active: false,
      wx: 0,
      wy: 0,
      wz: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      age: 0,
      life: 2.8,
      char: '✿',
      colorKey: 'sakuraLight',
      isPetal: true
    }));

    // Suspended 3D mist specks inside the wave hollow above Mount Fuji
    this.hollowMist = new Array(HOLLOW_MIST_COUNT);
    this.initHollowMist();

    // Cached far parallax backdrop
    this._backdropCanvas = null;
    this._backdropW = 0;
    this._backdropH = 0;
    this._backdropDpr = 0;
    this._backdropEco = null;

    // Pre-allocated screen-grid 3D Z-buffer (area-normalized to bound 1080p/4K work)
    this.stepX = 6.2;
    this.stepY = 7.5;
    this.baseGlyphScale = 0.66;
    this.cols = 0;
    this.rows = 0;
    this._bufCapacity = 0;
    this._zBuf = new Float32Array(0);
    this._charIdxBuf = new Uint8Array(0);
    this._colorIdxBuf = new Uint8Array(0);
    this._alphaBuf = new Float32Array(0);
    this._glowBuf = new Uint8Array(0);
    this._scaleBuf = new Float32Array(0);
    this._tagBuf = new Int32Array(0);
    this._touchedIndices = new Int32Array(0);
    this._touchedCount = 0;
    this._frameTag = 1;
    this._lastShadedCount = 0;

    // Scratch structs & strip-cached buffers to avoid per-frame allocations
    this._projTmp = { sx: 0, sy: 0, p: 1, relZ: CAM_DIST };
    this._surfTmp = { wx: 0, wy: 0, wz: 0 };
    this._gwSpineTmp = {
      outX: 0,
      outY: 0,
      inX: 0,
      inY: 0,
      crestFwd: 0,
      impY: 0
    };
    this._prevWaveCol = new Int16Array(128);
    this._prevWaveRow = new Int16Array(128);
    this._stripCurX = new Float32Array(128);
    this._stripCurY = new Float32Array(128);
    this._stripCurZ = new Float32Array(128);
    this._stripPrevX = new Float32Array(128);
    this._stripPrevY = new Float32Array(128);
    this._stripPrevZ = new Float32Array(128);
    this._vSinPi = new Float32Array(128);
    this._vSinPiSize = 0;
    this._oceanPrevY = new Float32Array(32);
    this._polyBackX = new Float32Array(40);
    this._polyBackY = new Float32Array(40);
    this._gradCtx = null;
    this._gradW = 0;
    this._gradH = 0;
    this._oceanGrad = null;
    this._gwGrad = null;
    this._rsGrad = null;
    this._fgGrad = null;

    this.updateMetrics();
    this.seedInitialSpray();
    this.updateBoats(0);
  }

  updateMetrics() {
    this.wsX = Math.max(0.36, this.width / 1280);
    this.wsY = Math.max(0.48, this.height / 800);
    const rawArea = Math.sqrt((this.width * this.height) / (1280 * 800));
    this.areaScale = clamp(rawArea, 0.78, 1.55);
    this.perspScale = clamp(rawArea, 0.62, 1.38);
    this.horizonY = this.height * 0.68;
  }

  ensureZBuffer(ecoActive) {
    this.stepX = (ecoActive ? 7.4 : 4.95) * this.areaScale;
    this.stepY = (ecoActive ? 8.8 : 5.95) * this.areaScale;
    this.baseGlyphScale = (ecoActive ? 0.74 : 0.52) * this.areaScale;
    this.cols = Math.ceil(this.width / this.stepX) + 2;
    this.rows = Math.ceil(this.height / this.stepY) + 2;
    const needed = this.cols * this.rows;
    if (needed > this._bufCapacity) {
      this._bufCapacity = needed;
      this._zBuf = new Float32Array(needed);
      this._charIdxBuf = new Uint8Array(needed);
      this._colorIdxBuf = new Uint8Array(needed);
      this._alphaBuf = new Float32Array(needed);
      this._glowBuf = new Uint8Array(needed);
      this._scaleBuf = new Float32Array(needed);
      this._tagBuf = new Int32Array(needed);
      this._touchedIndices = new Int32Array(needed);
      this._frameTag = 1;
    }
  }

  ensureVSinLut(vSteps) {
    if (this._vSinPiSize === vSteps) return;
    this._vSinPiSize = vSteps;
    for (let vi = 0; vi < vSteps; vi++) {
      this._vSinPi[vi] = Math.sin((vi / (vSteps - 1)) * Math.PI);
    }
  }

  initHollowMist() {
    for (let i = 0; i < HOLLOW_MIST_COUNT; i++) {
      const a = (i * 2.39996) % (Math.PI * 2);
      const r = Math.sqrt((i + 0.5) / HOLLOW_MIST_COUNT);
      this.hollowMist[i] = {
        wx: -15 + Math.cos(a) * 195 * r,
        wy: 115 + Math.sin(a) * 130 * r,
        wz: 185 + ((i * 37) % 160),
        phase: (i * 0.67) % (Math.PI * 2),
        speed: 0.7 + (i % 5) * 0.25,
        char: i % 5 === 0 ? 'o' : i % 2 === 0 ? '·' : '.',
        bright: i % 3 === 0
      };
    }
  }

  seedInitialSpray() {
    for (let i = 0; i < 38; i++) {
      const sp = this.sprayPool.acquire(true);
      const claw = CLAW_SPECS[i % CLAW_SPECS.length];
      this.evalGreatWavePoint(claw.s, 0.08, this.time, this._surfTmp);
      sp.active = true;
      sp.wx = this._surfTmp.wx + claw.reach * 0.72 + randRange(-24, 34);
      sp.wy = this._surfTmp.wy - claw.drop * 0.35 + randRange(-14, 24);
      sp.wz = this._surfTmp.wz + claw.zOff + randRange(-12, 12);
      sp.vx = randRange(25, 95);
      sp.vy = randRange(18, 86);
      sp.vz = randRange(-12, 14);
      sp.age = randRange(0, 0.85);
      sp.life = randRange(0.95, 1.85);
      sp.char = SPRAY_GLYPHS[i % SPRAY_GLYPHS.length];
      sp.colorKey = i % 3 === 0 ? 'waveFoamWhite' : 'waveFoamIce';
      sp.glow = i % 4 === 0;
    }
  }

  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this._backdropW = 0;
    this._gradW = 0;
    this.updateMetrics();
  }

  setPointer() {
    // Great Wave moves autonomously; pointer tracking is intentionally disabled
  }

  project3D(wx, wy, wz, out) {
    const relZ = Math.max(180, CAM_DIST + wz);
    const p = CAM_DIST / relZ;
    out.sx = this.width * 0.5 + (wx - this.camX) * p * this.wsX;
    out.sy = this.horizonY - (wy - this.camY) * p * this.wsY;
    out.p = p;
    out.relZ = relZ;
    return out;
  }

  unprojectSeaPoint(sx, sy) {
    const relY = (this.horizonY - sy) / Math.max(0.1, this.wsY);
    const t = clamp(1 - (sy - this.height * 0.42) / Math.max(1, this.height * 0.56), 0, 1);
    const wz = lerp(-85, 360, t);
    const p = CAM_DIST / Math.max(180, CAM_DIST + wz);
    const wx = (sx - this.width * 0.5) / Math.max(0.05, p * this.wsX) + this.camX;
    return { wx: clamp(wx, -680, 680), wy: relY / p, wz };
  }

  spawnSpray(wx, wy, wz, vx, vy, vz, life = 1.35, bright = true) {
    const slot = this.sprayPool.acquire(true);
    slot.active = true;
    slot.wx = wx;
    slot.wy = wy;
    slot.wz = wz;
    slot.vx = vx;
    slot.vy = vy;
    slot.vz = vz;
    slot.age = 0;
    slot.life = life;
    slot.char = SPRAY_GLYPHS[Math.floor(Math.random() * SPRAY_GLYPHS.length)];
    slot.colorKey = bright ? (Math.random() > 0.35 ? 'waveFoamWhite' : 'waveFoamIce') : 'waveSeafoam';
    slot.glow = bright && Math.random() > 0.55;
  }

  spawnTempestParticle() {
    const slot = this.tempestPool.acquire(true);
    const isPetal = Math.random() > 0.38;
    slot.active = true;
    slot.wx = randRange(-660, 420);
    slot.wy = randRange(120, 460);
    slot.wz = randRange(-70, 210);
    slot.vx = randRange(65, 165);
    slot.vy = isPetal ? randRange(-42, 24) : randRange(25, 95);
    slot.vz = randRange(-18, 18);
    slot.age = 0;
    slot.life = randRange(1.8, 3.2);
    slot.isPetal = isPetal;
    slot.char = isPetal
      ? (Math.random() > 0.5 ? '✿' : '❀')
      : TEMPEST_GLYPHS[2 + Math.floor(Math.random() * 3)];
    slot.colorKey = isPetal
      ? (Math.random() > 0.45 ? 'sakuraLight' : 'sakuraPale')
      : (Math.random() > 0.45 ? 'waveFoamWhite' : 'waveSeafoam');
  }

  triggerWaveSurge(x, y) {
    const pt = this.unprojectSeaPoint(x, y);
    const slot = this.surges[this.surgeCursor % SURGE_RING_SIZE];
    this.surgeCursor = (this.surgeCursor + 1) % SURGE_RING_SIZE;
    slot.active = true;
    slot.wx = pt.wx;
    slot.wz = pt.wz;
    slot.age = 0;
    slot.duration = 2.6;
    slot.amp = 32;

    this._hasActiveImpulse = true;
    this.surgeBoost = Math.min(1.4, this.surgeBoost + 0.72);

    for (let i = 0; i < 20; i++) {
      const ang = (i / 20) * Math.PI * 2 + randRange(-0.18, 0.18);
      const spd = randRange(42, 145);
      this.spawnSpray(
        pt.wx + Math.cos(ang) * randRange(4, 24),
        Math.max(-90, pt.wy) + randRange(-8, 18),
        pt.wz + Math.sin(ang) * randRange(4, 22),
        Math.cos(ang) * spd + 24,
        randRange(48, 138),
        Math.sin(ang) * spd * 0.5,
        randRange(0.95, 1.65),
        i % 3 !== 0
      );
    }
  }

  triggerGreatSwell() {
    this.swellWaveActive = true;
    this.swellWaveProgress = 0;
    this._hasActiveImpulse = true;
    this.swellBoost = Math.min(1.5, this.swellBoost + 0.95);

    for (let i = 0; i < WAVE_CLAW_COUNT; i++) {
      const claw = CLAW_SPECS[i];
      if (claw.group === 0) {
        this.evalGreatWavePoint(claw.s, 0.06, this.time, this._surfTmp);
      } else {
        this.evalForegroundWavePoint(claw.s, 0.08, this.time, this._surfTmp);
      }
      this.spawnSpray(
        this._surfTmp.wx + claw.reach * randRange(0.65, 1.05),
        this._surfTmp.wy - claw.drop * randRange(0.25, 0.6) + randRange(-10, 24),
        this._surfTmp.wz + claw.zOff + randRange(-10, 10),
        randRange(48, 165),
        randRange(35, 128),
        randRange(-22, 22),
        randRange(1.0, 1.85),
        true
      );
    }
  }

  triggerTempestTide(durationSeconds = 25) {
    this.tempestTimer = Math.max(this.tempestTimer, durationSeconds);
    this.tempestSpawnAccum = 0;
    this.triggerGreatSwell();
    for (let i = 0; i < 14; i++) {
      this.spawnTempestParticle();
    }
  }

  // Global wave pulse amplitude at (wx, wz) from active click surges + travelling Great Swell
  evalImpulseAt(wx, wz) {
    if (!this._hasActiveImpulse) return 0;
    let h = 0;
    for (let i = 0; i < SURGE_RING_SIZE; i++) {
      const s = this.surges[i];
      if (!s.active) continue;
      const dist = Math.hypot(wx - s.wx, (wz - s.wz) * 0.85);
      const front = s.age * 240;
      const band = Math.exp(-Math.pow((dist - front) / 72, 2));
      const fade = 1 - s.age / s.duration;
      h += Math.sin((dist - front) * 0.065) * s.amp * band * fade;
    }
    if (this.swellWaveActive) {
      const frontX = lerp(-760, 780, this.swellWaveProgress);
      const env = Math.sin(clamp(this.swellWaveProgress, 0, 1) * Math.PI);
      const distX = wx - frontX;
      h += Math.exp(-(distX * distX) / 26000) * 44 * env;
    }
    return h;
  }

  // Natural multi-harmonic ocean elevation at (wx, wz)
  evalOceanHeight(wx, wz, t) {
    let wy = -46;
    for (let i = 0; i < WAVE_TRAINS.length; i++) {
      const tr = WAVE_TRAINS[i];
      const ph = (wx * tr.dx + wz * tr.dz) * tr.freq - t * tr.speed;
      const s = Math.sin(ph);
      wy += (s + tr.steep * 0.35 * (s * s - 0.5)) * tr.amp;
    }
    if (this._hasActiveImpulse) {
      wy += this.evalImpulseAt(wx, wz);
    }
    return wy;
  }

  // Hoisted s-invariant geometry for a Great Wave spine strip
  evalGreatWaveSpine(s, t, outSpine) {
    const swellWave = this.swellWaveActive
      ? Math.exp(-Math.pow((s - this.swellWaveProgress) / 0.28, 2)) *
        Math.sin(clamp(this.swellWaveProgress, 0, 1) * Math.PI) *
        36
      : 0;
    const breath =
      Math.sin(t * 0.78 - s * 2.7) * (11 + 8 * this.swellBoost) +
      Math.cos(t * 1.24 - s * 4.4) * 5.5 +
      swellWave;
    const curlLift = Math.sin(t * 0.92 - s * 1.9) * (12 + 10 * this.swellBoost);

    let outX;
    let outY;
    if (s < 0.62) {
      const u = s / 0.62;
      outX = lerp(-720, -300, Math.pow(u, 0.92));
      outY = lerp(78, 446, Math.sin(u * Math.PI * 0.5));
    } else {
      const u = (s - 0.62) / 0.38;
      outX = -300 + Math.sin(u * Math.PI * 0.54) * 212;
      outY = 446 - Math.pow(u, 1.52) * 102;
    }
    outY += breath * smoothstep(0.05, 0.75, s);
    outX += curlLift * smoothstep(0.42, 1.0, s);

    let inX;
    let inY;
    if (s < 0.38) {
      const u = s / 0.38;
      inX = lerp(-490, -175, smoothstep(0, 1, u));
      inY = lerp(-260, -145, u);
    } else if (s < 0.74) {
      const u = (s - 0.38) / 0.36;
      const arch = Math.sin(u * Math.PI);
      inX = lerp(-175, -218, u) - arch * 54;
      inY = lerp(-145, 255, smoothstep(0, 1, u));
    } else {
      const u = (s - 0.74) / 0.26;
      inX = lerp(-218, -104, Math.sin(u * Math.PI * 0.52)) + curlLift * 0.75;
      inY = lerp(255, 298, smoothstep(0, 0.65, u)) - Math.pow(u, 2.0) * 14;
    }
    inY += breath * 0.55 * smoothstep(0.25, 0.85, s);

    outSpine.outX = outX;
    outSpine.outY = outY;
    outSpine.inX = inX;
    outSpine.inY = inY;
    outSpine.scoopAmp = smoothstep(0.2, 0.85, s) * 28;
    outSpine.crestFwd = smoothstep(0.2, 0.88, s) * -32;
    outSpine.impY = this._hasActiveImpulse ? this.evalImpulseAt((outX + inX) * 0.5, 32) * 0.45 : 0;
  }

  // Parametric surface of the monumental curling Great Wave
  evalGreatWavePoint(s, wParam, t, out) {
    this.evalGreatWaveSpine(s, t, this._gwSpineTmp);
    const sp = this._gwSpineTmp;
    const bulge = Math.sin(wParam * Math.PI);
    const scoop = bulge * sp.scoopAmp;
    out.wx = lerp(sp.outX, sp.inX, wParam) - scoop * 0.45;
    out.wy = lerp(sp.outY, sp.inY, wParam) + scoop * 0.35 + sp.impY;
    out.wz = 68 + sp.crestFwd - bulge * 42 + wParam * 36;
    return out;
  }

  // Foreground Mini-Fuji wave (wz in [-145, -45]) providing strong near-plane 3D parallax
  evalForegroundWavePoint(s, wParam, t, out) {
    const heave = Math.sin(t * 0.96 - s * 3.1) * (9 + 6 * this.swellBoost);
    const swayX = Math.cos(t * 0.72 - s * 2.2) * 7;

    const tri = Math.exp(-Math.pow((s - 0.52) / 0.21, 2));
    const topX = lerp(-715, -35, s) + swayX;
    const topY = lerp(-115, -225, smoothstep(0.55, 1.0, s)) + tri * 165 + heave;

    const botX = lerp(-690, 5, s);
    const botY = -305;

    const bulge = Math.sin(wParam * Math.PI);
    const scoop = bulge * 16;
    out.wx = lerp(topX, botX, wParam) - scoop * 0.35;
    out.wy = lerp(topY, botY, wParam) + (this._hasActiveImpulse ? this.evalImpulseAt(topX, -92) * 0.45 : 0);
    out.wz = -102 - bulge * 28 + (1 - tri) * 24 + s * 18;
    return out;
  }

  // Sweeping right-side rising swell curving inward from the right viewport margin
  evalRightSwellPoint(s, wParam, t, out) {
    const heave = Math.sin(t * 0.84 + s * 2.6 + 1.1) * (10 + 7 * this.swellBoost);
    const crestX = lerp(175, 720, smoothstep(0, 1, s));
    const crestY = lerp(-210, 215, Math.pow(s, 1.38)) + heave;

    const baseX = lerp(150, 740, s);
    const baseY = -295;

    const bulge = Math.sin(wParam * Math.PI);
    const curl = bulge * s * 26;
    out.wx = lerp(crestX, baseX, wParam) - curl;
    out.wy = lerp(crestY, baseY, wParam) + (this._hasActiveImpulse ? this.evalImpulseAt(crestX, 30) * 0.42 : 0);
    out.wz = lerp(140, -45, s) - bulge * 22 + wParam * 28;
    return out;
  }

  // Live 3D water surface height sampled by boats for natural pitching & heave
  evalBoatWaterY(wx, wz, t, boatIdx) {
    const oceanY = this.evalOceanHeight(wx, wz, t);
    if (boatIdx === 0) {
      const slopeLift = smoothstep(-310, -575, wx) * 120;
      return oceanY * 0.45 + 6 + slopeLift;
    }
    if (boatIdx === 1) {
      const troughDip = -112 + Math.sin(wx * 0.008 - t * 1.1) * 14;
      return oceanY * 0.35 + troughDip;
    }
    const rightSlope = smoothstep(140, 480, wx) * 98;
    return oceanY * 0.42 - 54 + rightSlope;
  }

  updateBoats(t) {
    for (let i = 0; i < BOAT_COUNT; i++) {
      const b = this.boats[i];
      const swayX = Math.sin(t * 0.62 + i * 2.1) * 10;
      b.wx = b.baseWx + swayX;

      const yStern = this.evalBoatWaterY(b.wx - b.halfLen * 0.72, b.wz, t, i);
      const yMid = this.evalBoatWaterY(b.wx, b.wz, t, i);
      const yBow = this.evalBoatWaterY(b.wx + b.halfLen * 0.72, b.wz, t, i);

      b.wy = (yStern + yMid * 2 + yBow) * 0.25 + 6;
      b.pitch = Math.atan2(yBow - yStern, b.halfLen * 1.44);
      b.roll = Math.sin(t * 1.38 + i * 2.4) * 0.14;

      this.project3D(b.wx, b.wy, b.wz, this._projTmp);
      b.sx = this._projTmp.sx;
      b.sy = this._projTmp.sy;
    }
  }

  update(dt, time) {
    if (time !== undefined) {
      this.time = time;
    } else {
      this.time += dt;
    }
    const t = this.time;
    this.swellPhase = (t * 0.42) % (Math.PI * 2);

    // Autonomous organic 3D ocean camera buoy sway (no mouse tracking)
    this.camParallaxX = 0;
    this.camParallaxY = 0;
    this.camX = Math.sin(t * 0.31) * 14 + Math.cos(t * 0.19) * 6;
    this.camY = Math.sin(t * 0.43) * 8 + Math.cos(t * 0.27) * 4;

    if (this.surgeBoost > 0) {
      this.surgeBoost = Math.max(0, this.surgeBoost - dt * 0.46);
    }
    if (this.swellBoost > 0) {
      this.swellBoost = Math.max(0, this.swellBoost - dt * 0.38);
    }

    if (this.swellWaveActive) {
      this.swellWaveProgress += dt * 0.48;
      if (this.swellWaveProgress >= 1.15) {
        this.swellWaveActive = false;
        this.swellWaveProgress = 0;
      }
    }

    let anySurge = this.swellWaveActive;
    for (let i = 0; i < SURGE_RING_SIZE; i++) {
      const s = this.surges[i];
      if (!s.active) continue;
      s.age += dt;
      if (s.age >= s.duration) {
        s.active = false;
      } else {
        anySurge = true;
      }
    }
    this._hasActiveImpulse = anySurge;

    // Track crest projection for telemetry & tests
    this.evalGreatWavePoint(0.64, 0.04, t, this._surfTmp);
    this.project3D(this._surfTmp.wx, this._surfTmp.wy, this._surfTmp.wz, this._projTmp);
    this.crestX = this._projTmp.sx;
    this.crestY = this._projTmp.sy;

    // Update pitching boats
    this.updateBoats(t);

    // Continuous natural sea spray emission from crest claws
    this.ambientSprayAccum += dt * (11 + 14 * this.swellBoost + 8 * this.surgeBoost);
    while (this.ambientSprayAccum >= 1) {
      this.ambientSprayAccum -= 1;
      const clawIdx = Math.floor(Math.random() * WAVE_CLAW_COUNT);
      const claw = CLAW_SPECS[clawIdx];
      if (claw.group === 0) {
        this.evalGreatWavePoint(claw.s, 0.06, t, this._surfTmp);
      } else {
        this.evalForegroundWavePoint(claw.s, 0.08, t, this._surfTmp);
      }
      const whip = Math.sin(t * 2.2 - claw.phase);
      this.spawnSpray(
        this._surfTmp.wx + claw.reach * 0.92 + whip * 8,
        this._surfTmp.wy - claw.drop * 0.72 + randRange(-8, 12),
        this._surfTmp.wz + claw.zOff,
        randRange(32, 118),
        randRange(18, 88),
        randRange(-14, 14),
        randRange(0.85, 1.65),
        Math.random() > 0.25
      );
    }

    // Pomodoro 25s Tempest Tide coastal sakura & moonlit mist reward
    if (this.tempestTimer > 0) {
      this.tempestTimer = Math.max(0, this.tempestTimer - dt);
      this.tempestSpawnAccum += dt;
      while (this.tempestSpawnAccum >= 0.14) {
        this.tempestSpawnAccum -= 0.14;
        this.spawnTempestParticle();
      }
    }

    // Ballistic 3D sea spray physics
    const sprays = this.sprayPool.items;
    const airDamp = dampFactor(0.985, dt);
    for (let i = 0; i < SPRAY_POOL_SIZE; i++) {
      const sp = sprays[i];
      if (!sp.active) continue;
      sp.age += dt;
      if (sp.age >= sp.life) {
        sp.active = false;
        continue;
      }
      sp.vy -= 105 * dt;
      sp.vx = (sp.vx + 18 * dt) * airDamp;
      sp.vz *= airDamp;
      sp.wx += sp.vx * dt;
      sp.wy += sp.vy * dt;
      sp.wz += sp.vz * dt;
    }

    // Tempest coastal sakura & mist physics
    const tempests = this.tempestPool.items;
    for (let i = 0; i < TEMPEST_POOL_SIZE; i++) {
      const tp = tempests[i];
      if (!tp.active) continue;
      tp.age += dt;
      if (tp.age >= tp.life) {
        tp.active = false;
        continue;
      }
      if (tp.isPetal) {
        tp.vy += Math.sin(t * 2.8 + i) * 32 * dt;
      } else {
        tp.vy -= 48 * dt;
      }
      tp.wx += tp.vx * dt;
      tp.wy += tp.vy * dt;
      tp.wz += tp.vz * dt;
    }
  }

  ensureBackdropCache(atlas, ecoActive) {
    const dpr = atlas.dpr || 1;
    const w = this.width;
    const h = this.height;
    if (
      this._backdropCanvas &&
      this._backdropW === w &&
      this._backdropH === h &&
      this._backdropDpr === dpr &&
      this._backdropEco === ecoActive
    ) {
      return this._backdropCanvas;
    }

    const totalW = w + PAD_X * 2;
    const totalH = h + PAD_Y * 2;
    const pxW = Math.max(1, Math.ceil(totalW * dpr));
    const pxH = Math.max(1, Math.ceil(totalH * dpr));

    let cache = this._backdropCanvas;
    if (!cache || cache.width !== pxW || cache.height !== pxH) {
      if (typeof OffscreenCanvas !== 'undefined') {
        cache = new OffscreenCanvas(pxW, pxH);
      } else {
        cache = document.createElement('canvas');
        cache.width = pxW;
        cache.height = pxH;
      }
    }

    const bctx = cache.getContext('2d', { alpha: false }) || cache.getContext('2d');
    bctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // 1. Deep Ukiyo-e Twilight Sky & Warm Washi Horizon Atmosphere
    const skyGrad = bctx.createLinearGradient(0, 0, 0, totalH);
    skyGrad.addColorStop(0.0, '#060f20');
    skyGrad.addColorStop(0.32, '#0d1c38');
    skyGrad.addColorStop(0.64, '#1a2c4a');
    skyGrad.addColorStop(1.0, '#09142a');
    bctx.globalAlpha = 1;
    bctx.fillStyle = skyGrad;
    bctx.fillRect(0, 0, totalW, totalH);

    // Subtle warm washi-parchment luminous cloud band behind the arch
    const washiGlow = bctx.createRadialGradient(
      totalW * 0.70,
      totalH * 0.24,
      20,
      totalW * 0.66,
      totalH * 0.30,
      totalW * 0.44
    );
    washiGlow.addColorStop(0.0, 'rgba(232, 213, 181, 0.14)');
    washiGlow.addColorStop(0.45, 'rgba(203, 178, 138, 0.07)');
    washiGlow.addColorStop(1.0, 'rgba(12, 24, 48, 0.0)');
    bctx.fillStyle = washiGlow;
    bctx.fillRect(0, 0, totalW, totalH);

    // Brooding storm shadow inside the Great Wave hollow behind Mount Fuji
    const hollowShadow = bctx.createRadialGradient(
      totalW * 0.62,
      totalH * 0.60,
      18,
      totalW * 0.60,
      totalH * 0.56,
      totalW * 0.28
    );
    hollowShadow.addColorStop(0.0, 'rgba(4, 10, 24, 0.62)');
    hollowShadow.addColorStop(0.6, 'rgba(7, 16, 36, 0.34)');
    hollowShadow.addColorStop(1.0, 'rgba(7, 16, 36, 0.0)');
    bctx.fillStyle = hollowShadow;
    bctx.fillRect(0, 0, totalW, totalH);

    // 2. Delicate Washi-Paper ASCII Clouds in Upper & Right Sky
    const stepX = ecoActive ? 12 : 7;
    const stepY = ecoActive ? 13 : 8;
    for (let y = 14; y < totalH * 0.42; y += stepY) {
      const ny = y / totalH;
      for (let x = 12; x < totalW - 12; x += stepX) {
        const nx = x / totalW;
        const cloudA = Math.exp(-Math.pow((nx - 0.72) / 0.16, 2) - Math.pow((ny - 0.20) / 0.08, 2));
        const cloudB = Math.exp(-Math.pow((nx - 0.89) / 0.11, 2) - Math.pow((ny - 0.13) / 0.065, 2));
        const cloudC = Math.exp(-Math.pow((nx - 0.20) / 0.10, 2) - Math.pow((ny - 0.14) / 0.055, 2));
        const swirl = Math.sin(nx * 23.0 + ny * 15.0) * 0.22 + Math.cos(nx * 37.0 - ny * 19.0) * 0.14;
        const density = Math.max(cloudA, cloudB, cloudC) + swirl * 0.28;
        if (density < 0.43) continue;

        const cxDist = Math.abs(x - PAD_X - w * 0.5);
        const cyDist = Math.abs(y - PAD_Y - h * 0.44);
        const uiFade = cxDist < 280 && cyDist < 130 ? 0.30 : 1.0;

        const jx = x + Math.sin(y * 0.71 + x * 0.13) * 3.2;
        const jy = y + Math.cos(x * 0.53 + y * 0.19) * 2.6;
        const ch = density > 0.82 ? '~' : density > 0.64 ? '·' : '.';
        const col = density > 0.70 ? 'waveWashiCream' : 'waveWashiWarm';
        bctx.globalAlpha = clamp((density - 0.35) * 0.36 * uiFade, 0.04, 0.22);
        atlas.drawGlyph(bctx, ch, col, false, jx, jy, 0.42 * this.perspScale);
      }
    }

    // 3. Distant Twilight Stars in Upper Zenith
    for (let i = 0; i < 64; i++) {
      const sx = (((i * 197 + 43) % 997) / 997) * totalW;
      const sy = (((i * 313 + 19) % 991) / 991) * (totalH * 0.32);
      bctx.globalAlpha = 0.22 + (i % 4) * 0.08;
      atlas.drawGlyph(bctx, i % 5 === 0 ? '*' : '·', i % 2 === 0 ? 'starCool' : 'starBlue', false, sx, sy, 0.40);
    }

    // 4. Mount Fuji (富士山) at high engraving resolution inside the Great Wave hollow
    const fujiCenterX = PAD_X + w * 0.735;
    const fujiBaseY = PAD_Y + h * 0.665;
    const fujiH = Math.max(82, h * 0.175);
    const fujiHalfW = Math.max(96, w * 0.135);
    const fStepX = ecoActive ? 6 : 3.0;
    const fStepY = ecoActive ? 7 : 3.6;
    const fujiGlyphScale = (ecoActive ? 0.62 : 0.38) * this.perspScale;

    for (let fy = fujiBaseY - fujiH; fy <= fujiBaseY + 6; fy += fStepY) {
      const hFrac = clamp((fy - (fujiBaseY - fujiH)) / fujiH, 0, 1);
      const halfSpan = fujiHalfW * (0.04 + Math.pow(hFrac, 0.78) * 0.96);
      for (let fx = fujiCenterX - halfSpan; fx <= fujiCenterX + halfSpan; fx += fStepX) {
        const xNorm = (fx - fujiCenterX) / Math.max(1, halfSpan);
        const gully =
          Math.sin(xNorm * 16.0 + hFrac * 4.5) * 0.068 +
          Math.cos(xNorm * 29.0 - hFrac * 3.0) * 0.028;
        const snowLine = 0.29 + gully + Math.abs(xNorm) * 0.09;
        const isSnow = hFrac < snowLine;
        const isSnowEdge = !isSnow && hFrac < snowLine + 0.045;
        const isEdge = Math.abs(Math.abs(xNorm) - 1.0) < 0.12;

        let ch;
        let colKey;
        let alpha;
        if (isSnow) {
          ch = hFrac < 0.12 ? '@' : isEdge ? (xNorm < 0 ? '/' : '\\') : hFrac < 0.22 ? '#' : 'S';
          colKey = hFrac < 0.21 || xNorm < 0.15 ? 'waveFoamWhite' : 'waveFoamIce';
          alpha = 0.95;
        } else if (isSnowEdge) {
          ch = isEdge ? (xNorm < 0 ? '/' : '\\') : ':';
          colKey = 'waveFoamAqua';
          alpha = 0.78;
        } else {
          const ridge = Math.sin(xNorm * 22.0 + hFrac * 6.0);
          ch = isEdge ? (xNorm < 0 ? '/' : '\\') : hFrac < 0.62 ? (ridge > 0 ? '%' : '#') : 'M';
          colKey = xNorm < 0.08 ? 'waveFujiMid' : hFrac > 0.72 && ridge < -0.2 ? 'waveAbyss' : 'waveFujiDark';
          alpha = lerp(0.90, 0.56, hFrac);
        }

        bctx.globalAlpha = alpha;
        atlas.drawGlyph(bctx, ch, colKey, false, fx, fy, fujiGlyphScale);
      }
    }

    // 5. Crisp Double-Framed Vertical Ukiyo-e Cartouche Signature Box
    if (w >= 960) {
      const boxX = PAD_X + clamp(w * 0.055, 36, 84);
      const boxTop = PAD_Y + clamp(h * 0.115, 76, 110);
      const boxBot = boxTop + 104;
      const boxW = 24;
      bctx.globalAlpha = 0.46;
      for (let by = boxTop; by <= boxBot; by += 6) {
        const isTop = by === boxTop;
        const isBot = by + 6 > boxBot;
        if (isTop || isBot) {
          atlas.drawGlyph(bctx, '+', 'waveWashiWarm', false, boxX - boxW * 0.5, by, 0.42);
          atlas.drawGlyph(bctx, '-', 'waveWashiWarm', false, boxX - boxW * 0.25, by, 0.42);
          atlas.drawGlyph(bctx, '-', 'waveWashiWarm', false, boxX, by, 0.42);
          atlas.drawGlyph(bctx, '-', 'waveWashiWarm', false, boxX + boxW * 0.25, by, 0.42);
          atlas.drawGlyph(bctx, '+', 'waveWashiWarm', false, boxX + boxW * 0.5, by, 0.42);
        } else {
          atlas.drawGlyph(bctx, '|', 'waveWashiWarm', false, boxX - boxW * 0.5, by, 0.42);
          atlas.drawGlyph(bctx, Math.round(by / 6) % 2 === 0 ? ':' : '·', 'waveWashiCream', false, boxX - 2, by, 0.38);
          atlas.drawGlyph(bctx, Math.round(by / 6) % 3 === 0 ? '-' : '·', 'waveWashiCream', false, boxX + 2, by, 0.38);
          atlas.drawGlyph(bctx, '|', 'waveWashiWarm', false, boxX + boxW * 0.5, by, 0.42);
        }
      }
    }

    bctx.globalAlpha = 1;
    this._backdropCanvas = cache;
    this._backdropW = w;
    this._backdropH = h;
    this._backdropDpr = dpr;
    this._backdropEco = ecoActive;
    return cache;
  }

  plotCell(col, row, depthZ, charIdx, colorIdx, alpha, glow, scale) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return;
    const idx = row * this.cols + col;
    const tag = this._frameTag;
    if (this._tagBuf[idx] !== tag) {
      this._tagBuf[idx] = tag;
      this._zBuf[idx] = depthZ;
      this._charIdxBuf[idx] = charIdx;
      this._colorIdxBuf[idx] = colorIdx;
      this._alphaBuf[idx] = alpha;
      this._glowBuf[idx] = glow ? 1 : 0;
      this._scaleBuf[idx] = scale;
      this._touchedIndices[this._touchedCount++] = idx;
    } else if (depthZ < this._zBuf[idx]) {
      this._zBuf[idx] = depthZ;
      this._charIdxBuf[idx] = charIdx;
      this._colorIdxBuf[idx] = colorIdx;
      this._alphaBuf[idx] = alpha;
      this._glowBuf[idx] = glow ? 1 : 0;
      this._scaleBuf[idx] = scale;
    }
  }

  plotProjected(sx, sy, depthZ, charIdx, colorIdx, alpha, glow, scale) {
    const col = Math.round(sx / this.stepX);
    const row = Math.round(sy / this.stepY);
    this.plotCell(col, row, depthZ, charIdx, colorIdx, alpha, glow, scale);
  }

  // --- Layered 3D Woodblock Silhouette Polygons (smooth Prussian bodies underneath fine ASCII engraving) ---

  ensurePolyGradients(ctx) {
    const w = this.width;
    const h = this.height;
    if (this._gradCtx === ctx && this._gradW === w && this._gradH === h && this._oceanGrad) {
      return;
    }

    const oceanGrad = ctx.createLinearGradient(0, this.horizonY - 10, 0, h);
    oceanGrad.addColorStop(0.0, 'rgb(11, 31, 68)');
    oceanGrad.addColorStop(0.45, 'rgb(8, 22, 50)');
    oceanGrad.addColorStop(1.0, 'rgb(4, 12, 30)');

    const gwGrad = ctx.createLinearGradient(w * 0.08, h * 0.18, w * 0.42, h * 0.85);
    gwGrad.addColorStop(0.0, 'rgb(22, 59, 114)');
    gwGrad.addColorStop(0.45, 'rgb(13, 38, 82)');
    gwGrad.addColorStop(1.0, 'rgb(6, 17, 42)');

    const rsGrad = ctx.createLinearGradient(w * 0.65, h * 0.48, w, h);
    rsGrad.addColorStop(0.0, 'rgb(17, 46, 94)');
    rsGrad.addColorStop(0.6, 'rgb(10, 29, 64)');
    rsGrad.addColorStop(1.0, 'rgb(5, 14, 34)');

    const fgGrad = ctx.createLinearGradient(0, h * 0.56, 0, h);
    fgGrad.addColorStop(0.0, 'rgb(18, 50, 98)');
    fgGrad.addColorStop(0.5, 'rgb(10, 30, 68)');
    fgGrad.addColorStop(1.0, 'rgb(5, 15, 36)');

    this._oceanGrad = oceanGrad;
    this._gwGrad = gwGrad;
    this._rsGrad = rsGrad;
    this._fgGrad = fgGrad;
    this._gradCtx = ctx;
    this._gradW = w;
    this._gradH = h;
  }

  fillOceanBase(ctx, t) {
    this.ensurePolyGradients(ctx);
    const w = this.width;
    const h = this.height;
    const wz = 540;
    const p = CAM_DIST / (CAM_DIST + wz);
    const steps = 28;

    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const sx = lerp(-24, w + 24, i / steps);
      const wx = (sx - w * 0.5) / Math.max(0.05, p * this.wsX) + this.camX;
      const wy = this.evalOceanHeight(wx, wz, t);
      const sy = this.horizonY - (wy - this.camY) * p * this.wsY;
      if (i === 0) ctx.moveTo(sx, sy);
      else ctx.lineTo(sx, sy);
    }
    ctx.lineTo(w + 24, h + 24);
    ctx.lineTo(-24, h + 24);
    ctx.closePath();

    ctx.fillStyle = this._oceanGrad;
    ctx.fill();
  }

  fillGreatWavePolygon(ctx, t) {
    this.ensurePolyGradients(ctx);
    const steps = 36;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const s = i / steps;
      // Stay slightly inside the scalloped outer foam so lacy white ASCII forms the outer silhouette
      const wOff = s < 0.72 ? 0.08 : 0.14;
      const pt = this.evalGreatWavePoint(s, wOff, t, this._surfTmp);
      this.project3D(pt.wx, pt.wy, pt.wz, this._projTmp);
      if (i === 0) ctx.moveTo(this._projTmp.sx, this._projTmp.sy);
      else ctx.lineTo(this._projTmp.sx, this._projTmp.sy);
    }
    for (let i = steps; i >= 0; i--) {
      const s = i / steps;
      const pt = this.evalGreatWavePoint(s, 0.98, t, this._surfTmp);
      this.project3D(pt.wx, pt.wy, pt.wz, this._projTmp);
      ctx.lineTo(this._projTmp.sx, this._projTmp.sy);
    }
    ctx.lineTo(-32, this.height + 32);
    ctx.closePath();

    ctx.fillStyle = this._gwGrad;
    ctx.fill();
  }

  fillRightSwellPolygon(ctx, t) {
    this.ensurePolyGradients(ctx);
    const steps = 28;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const s = i / steps;
      const pt = this.evalRightSwellPoint(s, 0.06, t, this._surfTmp);
      this.project3D(pt.wx, pt.wy, pt.wz, this._projTmp);
      if (i === 0) ctx.moveTo(this._projTmp.sx, this._projTmp.sy);
      else ctx.lineTo(this._projTmp.sx, this._projTmp.sy);
    }
    ctx.lineTo(this.width + 32, this.height + 32);
    const ptStart = this.evalRightSwellPoint(0, 1, t, this._surfTmp);
    this.project3D(ptStart.wx, ptStart.wy, ptStart.wz, this._projTmp);
    ctx.lineTo(this._projTmp.sx, this.height + 32);
    ctx.closePath();

    ctx.fillStyle = this._rsGrad;
    ctx.fill();
  }

  fillForegroundWavePolygon(ctx, t) {
    this.ensurePolyGradients(ctx);
    const steps = 30;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const s = i / steps;
      const pt = this.evalForegroundWavePoint(s, 0.06, t, this._surfTmp);
      this.project3D(pt.wx, pt.wy, pt.wz, this._projTmp);
      if (i === 0) ctx.moveTo(this._projTmp.sx, this._projTmp.sy);
      else ctx.lineTo(this._projTmp.sx, this._projTmp.sy);
    }
    const ptEnd = this.evalForegroundWavePoint(1, 1, t, this._surfTmp);
    this.project3D(ptEnd.wx, ptEnd.wy, ptEnd.wz, this._projTmp);
    ctx.lineTo(this._projTmp.sx, this.height + 32);
    ctx.lineTo(-32, this.height + 32);
    ctx.closePath();

    ctx.fillStyle = this._fgGrad;
    ctx.fill();
  }

  // --- Selective High-Detail Z-Buffered ASCII Engraving ---

  rasterizeOceanField(t, ecoActive) {
    const w = this.width;
    const cols = this.cols;
    const rows = this.rows;
    const stepX = this.stepX;
    const stepY = this.stepY;
    const zSteps = ecoActive ? 10 : 15;
    const gBase = this.baseGlyphScale;
    this._oceanPrevY.fill(0);

    for (let col = 0; col < cols; col++) {
      const sx = col * stepX;
      let prevZiY = 0;

      for (let zi = 0; zi < zSteps; zi++) {
        const zFrac = zi / (zSteps - 1);
        const wz = lerp(550, 78, Math.pow(zFrac, 1.28));
        const p = CAM_DIST / (CAM_DIST + wz);
        const wx = (sx - w * 0.5) / Math.max(0.05, p * this.wsX) + this.camX;

        const wy = this.evalOceanHeight(wx, wz, t);
        const sy = this.horizonY - (wy - this.camY) * p * this.wsY;
        const row = clamp(Math.round(sy / stepY), 0, rows - 1);

        const slopeX = col > 0 ? (wy - this._oceanPrevY[zi]) / 14 : 0;
        const slopeZ = zi > 0 ? (prevZiY - wy) / 30 : 0;
        this._oceanPrevY[zi] = wy;
        prevZiY = wy;

        const crestFactor = clamp((wy + 62) / 48, 0, 1);
        const lit = clamp(0.45 - slopeX * 0.42 + slopeZ * 0.55 + crestFactor * 0.32, 0, 1);
        const stripe = Math.sin(wx * 0.044 + wz * 0.034 - t * 2.1);

        // Selectively engrave sunlit wave crests & sparkling ripples over the deep Prussian ocean polygon
        let charIdx = -1;
        let colorIdx = COL_PRUSSIAN_MID;
        if (crestFactor > 0.84 && stripe > 0.18) {
          charIdx = stripe > 0.54 ? CH_S_LOW : CH_TILDE;
          colorIdx = crestFactor > 0.93 ? COL_FOAM_ICE : COL_FOAM_AQUA;
        } else if (lit > 0.74 && ((col + zi) % 3) === 0) {
          charIdx = stripe > 0.15 ? CH_APPROX : CH_TILDE;
          colorIdx = COL_CERULEAN;
        } else if (lit > 0.56 && ((col + zi) % 6) === 0) {
          charIdx = stripe > 0 ? CH_TILDE : CH_DASH;
          colorIdx = COL_PRUSSIAN_LIGHT;
        }

        if (charIdx >= 0) {
          const depthFade = smoothstep(575, 210, wz);
          const alpha = clamp(0.32 + 0.56 * depthFade + crestFactor * 0.12, 0.22, 0.90);
          const scale = clamp((0.72 + 0.34 * p) * gBase, 0.34, 1.12);
          this.plotCell(col, row, wz, charIdx, colorIdx, alpha, false, scale);
        }
      }
    }
  }

  rasterizeGreatWave(t, ecoActive) {
    const sSteps = ecoActive ? 54 : 98;
    const vSteps = ecoActive ? 30 : 56;
    const stepX = this.stepX;
    const stepY = this.stepY;
    const gBase = this.baseGlyphScale;
    this.ensureVSinLut(vSteps);
    this._prevWaveCol.fill(-1);
    this._prevWaveRow.fill(-1);

    const ds = 1 / (sSteps - 1);
    const dv = 1 / (vSteps - 1);
    const sp = this._gwSpineTmp;

    for (let si = 0; si < sSteps; si++) {
      const s = si * ds;
      let prevCol = -1;
      let prevRow = -1;

      // Hoist s-invariant curves once per spine strip
      this.evalGreatWaveSpine(s, t, sp);
      const outX = sp.outX;
      const outY = sp.outY;
      const inX = sp.inX;
      const inY = sp.inY;
      const scoopAmp = sp.scoopAmp;
      const crestFwd = sp.crestFwd;
      const impY = sp.impY;

      for (let vi = 0; vi < vSteps; vi++) {
        const v = vi * dv;
        const bulge = this._vSinPi[vi];
        const scoop = bulge * scoopAmp;
        this._stripCurX[vi] = lerp(outX, inX, v) - scoop * 0.45;
        this._stripCurY[vi] = lerp(outY, inY, v) + scoop * 0.35 + impY;
        this._stripCurZ[vi] = 68 + crestFwd - bulge * 42 + v * 36;
      }

      if (si === 0) {
        this.evalGreatWaveSpine(ds, t, sp);
        for (let vi = 0; vi < vSteps; vi++) {
          const v = vi * dv;
          const bulge = this._vSinPi[vi];
          const scoop = bulge * sp.scoopAmp;
          this._stripPrevX[vi] = lerp(sp.outX, sp.inX, v) - scoop * 0.45;
          this._stripPrevY[vi] = lerp(sp.outY, sp.inY, v) + scoop * 0.35 + sp.impY;
          this._stripPrevZ[vi] = 68 + sp.crestFwd - bulge * 42 + v * 36;
        }
      }

      // Hoist s-dependent foam rim & cascade envelope once per strip
      const scallop =
        0.055 * Math.sin(s * 24.0 - t * 1.9) +
        0.028 * Math.sin(s * 49.0 + t * 1.3) +
        0.016 * Math.cos(s * 83.0 - t * 2.6);
      const foamEdge = 0.145 + scallop + smoothstep(0.66, 0.98, s) * 0.34;
      const midFoamBand = smoothstep(0.12, 0.24, s) * (1 - smoothstep(0.42, 0.55, s));
      const midFoamCenter = 0.37 + 0.05 * Math.sin(s * 26.0 - t * 2.1);
      const sRibBias = -s * 7.8 + t * 2.4 + Math.sin(s * 16.0) * 1.15;
      const sFineBias = -s * 12.5 + t * 3.1;
      const tipFoamBonus = smoothstep(0.75, 1.0, s) * 0.38;

      for (let vi = 0; vi < vSteps; vi++) {
        const v = vi * dv;
        const wx = this._stripCurX[vi];
        const wy = this._stripCurY[vi];
        const wz = this._stripCurZ[vi];

        // Fast 3D tangents from cached strips -> cross-product surface normal
        const sxTs = si === 0 ? this._stripPrevX[vi] - wx : wx - this._stripPrevX[vi];
        const syTs = si === 0 ? this._stripPrevY[vi] - wy : wy - this._stripPrevY[vi];
        const szTs = si === 0 ? this._stripPrevZ[vi] - wz : wz - this._stripPrevZ[vi];

        const vxTv = vi < vSteps - 1 ? this._stripCurX[vi + 1] - wx : wx - this._stripCurX[vi - 1];
        const vyTv = vi < vSteps - 1 ? this._stripCurY[vi + 1] - wy : wy - this._stripCurY[vi - 1];
        const vzTv = vi < vSteps - 1 ? this._stripCurZ[vi + 1] - wz : wz - this._stripCurZ[vi - 1];

        let nx = syTs * vzTv - szTs * vyTv;
        let ny = szTs * vxTv - sxTs * vzTv;
        let nz = sxTs * vyTv - syTs * vxTv;
        const nLen = Math.hypot(nx, ny, nz) || 1;
        nx /= nLen;
        ny /= nLen;
        nz /= nLen;
        if (nz > 0) {
          nx = -nx;
          ny = -ny;
          nz = -nz;
        }

        const shade = clamp(0.5 + (nx * 0.42 + ny * 0.68 - nz * 0.46) * 0.5, 0, 1);

        const rib = Math.sin(v * 30.0 + sRibBias);
        const fineRib = Math.cos(v * 58.0 + sFineBias);

        const midFoamEnv =
          midFoamBand > 0.02
            ? midFoamBand * Math.exp(-Math.pow((v - midFoamCenter) / 0.065, 2))
            : 0;

        const isFoamCap = v < foamEdge || s > 0.91 || midFoamEnv > 0.52;
        const isFoamLace = !isFoamCap && (v < foamEdge + 0.075 || midFoamEnv > 0.26);
        const isInkOutline = !isFoamCap && !isFoamLace && (v < foamEdge + 0.125 || midFoamEnv > 0.14);

        let charIdx = -1;
        let colorIdx = COL_PRUSSIAN_DEEP;
        let glow = false;

        if (isFoamCap) {
          const density = clamp(
            Math.max(1.0 - v / Math.max(0.04, foamEdge), midFoamEnv) + tipFoamBonus,
            0,
            1
          );
          const hash = Math.abs(Math.floor(s * 67 + v * 43 + t * 5)) % FOAM_CHARS.length;
          charIdx = density > 0.64 ? FOAM_CHARS[hash % 4] : FOAM_CHARS[2 + (hash % 4)];
          colorIdx = density > 0.54 ? COL_FOAM_WHITE : COL_FOAM_ICE;
          glow = !ecoActive && density > 0.86 && s > 0.64;
        } else if (isFoamLace) {
          charIdx = rib > 0.15 ? CH_S_LOW : fineRib > 0 ? CH_TILDE : CH_O_LOW;
          colorIdx = rib > 0.22 ? COL_FOAM_ICE : rib > -0.25 ? COL_FOAM_AQUA : COL_SEAFOAM;
        } else if (isInkOutline) {
          charIdx = rib > 0.1 ? CH_HASH : CH_S_CAP;
          colorIdx = COL_INK;
        } else {
          const vein = rib * 0.64 + fineRib * 0.36;
          const speck = Math.sin(s * 103.0 + v * 127.0);
          if (speck > 0.945 && v < 0.80) {
            charIdx = speck > 0.974 ? CH_DEG : CH_MIDDOT;
            colorIdx = COL_FOAM_ICE;
          } else if (vein > 0.42 && shade > 0.38) {
            charIdx = WATER_RIB_CHARS[(si + vi) % 4];
            colorIdx = shade > 0.68 ? COL_SEAFOAM : COL_CERULEAN;
          } else if (vein > 0.32 && ((si + vi) % 4) === 0) {
            charIdx = rib > 0 ? CH_S_LOW : CH_APPROX;
            colorIdx = shade > 0.55 ? COL_PRUSSIAN_LIGHT : COL_PRUSSIAN_MID;
          } else if (vein < -0.68 && ((si + vi) % 5) === 0) {
            charIdx = CH_COLON;
            colorIdx = COL_INDIGO_MID;
          }
        }

        this.project3D(wx, wy, wz, this._projTmp);
        const col = Math.round(this._projTmp.sx / stepX);
        const row = Math.round(this._projTmp.sy / stepY);

        if (charIdx >= 0) {
          const scale = clamp(this._projTmp.p * gBase * (isFoamCap ? 1.08 : 1.0), 0.34, 1.32);
          this.plotCell(col, row, wz, charIdx, colorIdx, 0.96, glow, scale);

          // Gap-fill only outer white foam crown & ink contour (along strips for foam cap, along v for contour)
          if (isFoamCap || isInkOutline) {
            if (prevRow >= 0 && Math.abs(row - prevRow) <= 5 && Math.abs(col - prevCol) <= 4) {
              const rDiff = Math.max(Math.abs(row - prevRow), Math.abs(col - prevCol));
              if (rDiff > 1) {
                for (let step = 1; step < rDiff; step++) {
                  const tStep = step / rDiff;
                  this.plotCell(
                    Math.round(lerp(prevCol, col, tStep)),
                    Math.round(lerp(prevRow, row, tStep)),
                    wz + 0.4,
                    charIdx,
                    colorIdx,
                    0.96,
                    false,
                    scale
                  );
                }
              }
            }
            if (isFoamCap) {
              const sPrevC = this._prevWaveCol[vi];
              const sPrevR = this._prevWaveRow[vi];
              if (sPrevC >= 0 && Math.abs(col - sPrevC) <= 6 && Math.abs(row - sPrevR) <= 5) {
                const cDiff = Math.max(Math.abs(col - sPrevC), Math.abs(row - sPrevR));
                if (cDiff > 1) {
                  for (let step = 1; step < cDiff; step++) {
                    const tStep = step / cDiff;
                    this.plotCell(
                      Math.round(lerp(sPrevC, col, tStep)),
                      Math.round(lerp(sPrevR, row, tStep)),
                      wz + 0.5,
                      charIdx,
                      colorIdx,
                      0.96,
                      false,
                      scale
                    );
                  }
                }
              }
            }
          }
        }
        this._prevWaveCol[vi] = col;
        this._prevWaveRow[vi] = row;
        prevCol = col;
        prevRow = row;
      }

      const tx = this._stripPrevX;
      const ty = this._stripPrevY;
      const tz = this._stripPrevZ;
      this._stripPrevX = this._stripCurX;
      this._stripPrevY = this._stripCurY;
      this._stripPrevZ = this._stripCurZ;
      this._stripCurX = tx;
      this._stripCurY = ty;
      this._stripCurZ = tz;
    }
  }

  rasterizeForegroundWave(t, ecoActive) {
    const sSteps = ecoActive ? 38 : 68;
    const vSteps = ecoActive ? 20 : 36;
    const stepX = this.stepX;
    const stepY = this.stepY;
    const rows = this.rows;
    const gBase = this.baseGlyphScale;
    this.ensureVSinLut(vSteps);
    this._prevWaveCol.fill(-1);
    this._prevWaveRow.fill(-1);

    const ds = 1 / (sSteps - 1);
    const dv = 1 / (vSteps - 1);

    for (let si = 0; si < sSteps; si++) {
      const s = si * ds;
      let lastRow = -1;
      let lastCol = -1;
      let lastWz = -100;

      // Hoist s-invariant terms
      const heave = Math.sin(t * 0.96 - s * 3.1) * (9 + 6 * this.swellBoost);
      const swayX = Math.cos(t * 0.72 - s * 2.2) * 7;
      const tri = Math.exp(-Math.pow((s - 0.52) / 0.21, 2));
      const topX = lerp(-715, -35, s) + swayX;
      const topY = lerp(-115, -225, smoothstep(0.55, 1.0, s)) + tri * 165 + heave;
      const botX = lerp(-690, 5, s);
      const botY = -305;
      const impY = this._hasActiveImpulse ? this.evalImpulseAt(topX, -92) * 0.45 : 0;
      const wzBase = -102 + (1 - tri) * 24 + s * 18;
      const scallop = 0.045 * Math.sin(s * 24.0 - t * 2.1) + 0.024 * Math.cos(s * 51.0 + t * 1.5);
      const foamEdge = 0.22 + 0.14 * tri + scallop;
      const sRibBias = -s * 9.0 + t * 2.3;
      const sFineBias = -s * 14.0 + t * 3.0;

      for (let vi = 0; vi < vSteps; vi++) {
        const v = vi * dv;
        const bulge = this._vSinPi[vi];
        const scoop = bulge * 16;
        const wx = lerp(topX, botX, v) - scoop * 0.35;
        const wy = lerp(topY, botY, v) + impY;
        const wz = wzBase - bulge * 28;

        this.project3D(wx, wy, wz, this._projTmp);
        const col = Math.round(this._projTmp.sx / stepX);
        const row = Math.round(this._projTmp.sy / stepY);

        const rib = Math.sin(v * 24.0 + sRibBias) * 0.7 + Math.cos(v * 44.0 + sFineBias) * 0.3;
        const isFoam = v < foamEdge;

        let charIdx = -1;
        let colorIdx = COL_PRUSSIAN_DEEP;
        if (isFoam) {
          charIdx = v < foamEdge * 0.52 ? CH_AT : (si + vi) % 2 === 0 ? CH_HASH : CH_S_CAP;
          colorIdx = v < foamEdge * 0.62 ? COL_FOAM_WHITE : COL_FOAM_ICE;
        } else if (v < foamEdge + 0.09) {
          charIdx = rib > 0 ? CH_S_LOW : CH_TILDE;
          colorIdx = rib > 0.1 ? COL_FOAM_AQUA : COL_SEAFOAM;
        } else if (v < foamEdge + 0.145) {
          charIdx = CH_HASH;
          colorIdx = COL_INK;
        } else if (rib > 0.34) {
          charIdx = CH_PCT;
          colorIdx = COL_CERULEAN;
        } else if (rib > 0.22 && ((si + vi) % 4) === 0) {
          charIdx = CH_APPROX;
          colorIdx = COL_PRUSSIAN_LIGHT;
        }

        if (charIdx >= 0) {
          const scale = clamp(this._projTmp.p * gBase * 1.02, 0.35, 1.32);
          this.plotCell(col, row, wz, charIdx, colorIdx, 0.96, false, scale);

          if (isFoam || colorIdx === COL_INK) {
            if (lastRow >= 0 && Math.abs(row - lastRow) <= 5 && Math.abs(col - lastCol) <= 4) {
              const rDiff = Math.max(Math.abs(row - lastRow), Math.abs(col - lastCol));
              if (rDiff > 1) {
                for (let step = 1; step < rDiff; step++) {
                  const tStep = step / rDiff;
                  this.plotCell(
                    Math.round(lerp(lastCol, col, tStep)),
                    Math.round(lerp(lastRow, row, tStep)),
                    wz + 0.4,
                    charIdx,
                    colorIdx,
                    0.96,
                    false,
                    scale
                  );
                }
              }
            }
            const sPrevC = this._prevWaveCol[vi];
            const sPrevR = this._prevWaveRow[vi];
            if (sPrevC >= 0 && Math.abs(col - sPrevC) <= 5 && Math.abs(row - sPrevR) <= 4) {
              const cDiff = Math.max(Math.abs(col - sPrevC), Math.abs(row - sPrevR));
              if (cDiff > 1) {
                for (let step = 1; step < cDiff; step++) {
                  const tStep = step / cDiff;
                  this.plotCell(
                    Math.round(lerp(sPrevC, col, tStep)),
                    Math.round(lerp(sPrevR, row, tStep)),
                    wz + 0.5,
                    charIdx,
                    colorIdx,
                    0.96,
                    false,
                    scale
                  );
                }
              }
            }
          }
        }
        this._prevWaveCol[vi] = col;
        this._prevWaveRow[vi] = row;
        lastRow = row;
        lastCol = col;
        lastWz = wz;
      }

      // Selective carved woodblock ribs down to bottom edge (base polygon fills Prussian body)
      if (lastCol >= 0 && lastRow >= 0 && lastRow < rows - 1) {
        const fillScale = clamp(1.04 * gBase, 0.38, 1.24);
        for (let r = lastRow + 1; r < rows; r += 5) {
          const rib = Math.sin(r * 0.44 - si * 0.32 + t * 2.0);
          if (rib < 0.34) continue;
          const colIdx = rib > 0.62 ? COL_PRUSSIAN_LIGHT : COL_PRUSSIAN_MID;
          this.plotCell(lastCol, r, lastWz + 2, rib > 0.52 ? CH_TILDE : CH_S_LOW, colIdx, 0.90, false, fillScale);
        }
      }
    }
  }

  rasterizeRightSwell(t, ecoActive) {
    const sSteps = ecoActive ? 34 : 62;
    const vSteps = ecoActive ? 18 : 32;
    const stepX = this.stepX;
    const stepY = this.stepY;
    const rows = this.rows;
    const gBase = this.baseGlyphScale;
    this.ensureVSinLut(vSteps);
    this._prevWaveCol.fill(-1);
    this._prevWaveRow.fill(-1);

    const ds = 1 / (sSteps - 1);
    const dv = 1 / (vSteps - 1);

    for (let si = 0; si < sSteps; si++) {
      const s = si * ds;
      let lastRow = -1;
      let lastCol = -1;
      let lastWz = 40;

      // Hoist s-invariant geometry
      const heave = Math.sin(t * 0.84 + s * 2.6 + 1.1) * (10 + 7 * this.swellBoost);
      const crestX = lerp(175, 720, smoothstep(0, 1, s));
      const crestY = lerp(-210, 215, Math.pow(s, 1.38)) + heave;
      const baseX = lerp(150, 740, s);
      const baseY = -295;
      const impY = this._hasActiveImpulse ? this.evalImpulseAt(crestX, 30) * 0.42 : 0;
      const wzBase = lerp(140, -45, s);
      const scallop = 0.036 * Math.sin(s * 20.0 - t * 2.0) + 0.018 * Math.cos(s * 43.0 + t * 1.4);
      const foamEdge = 0.13 + 0.14 * smoothstep(0.55, 1.0, s) + scallop;
      const sRibBias = s * 10.0 - t * 2.2;
      const sFineBias = s * 16.0 - t * 2.8;

      for (let vi = 0; vi < vSteps; vi++) {
        const v = vi * dv;
        const bulge = this._vSinPi[vi];
        const curl = bulge * s * 26;
        const wx = lerp(crestX, baseX, v) - curl;
        const wy = lerp(crestY, baseY, v) + impY;
        const wz = wzBase - bulge * 22 + v * 28;

        this.project3D(wx, wy, wz, this._projTmp);
        const col = Math.round(this._projTmp.sx / stepX);
        const row = Math.round(this._projTmp.sy / stepY);

        const rib = Math.sin(v * 24.0 + sRibBias) * 0.7 + Math.cos(v * 44.0 + sFineBias) * 0.3;
        const isFoam = v < foamEdge;

        let charIdx = -1;
        let colorIdx = COL_PRUSSIAN_DEEP;
        if (isFoam) {
          charIdx = v < foamEdge * 0.54 ? CH_HASH : CH_S_CAP;
          colorIdx = v < foamEdge * 0.62 ? COL_FOAM_WHITE : COL_FOAM_ICE;
        } else if (v < foamEdge + 0.085) {
          charIdx = CH_TILDE;
          colorIdx = rib > 0 ? COL_FOAM_AQUA : COL_SEAFOAM;
        } else if (v < foamEdge + 0.135) {
          charIdx = CH_HASH;
          colorIdx = COL_INK;
        } else if (rib > 0.32) {
          charIdx = CH_APPROX;
          colorIdx = COL_CERULEAN;
        } else if (rib > 0.20 && ((si + vi) % 4) === 0) {
          charIdx = CH_S_LOW;
          colorIdx = COL_PRUSSIAN_MID;
        }

        if (charIdx >= 0) {
          const scale = clamp(this._projTmp.p * gBase * 1.0, 0.34, 1.28);
          this.plotCell(col, row, wz, charIdx, colorIdx, 0.96, false, scale);

          if (isFoam || colorIdx === COL_INK) {
            if (lastRow >= 0 && Math.abs(row - lastRow) <= 5 && Math.abs(col - lastCol) <= 4) {
              const rDiff = Math.max(Math.abs(row - lastRow), Math.abs(col - lastCol));
              if (rDiff > 1) {
                for (let step = 1; step < rDiff; step++) {
                  const tStep = step / rDiff;
                  this.plotCell(
                    Math.round(lerp(lastCol, col, tStep)),
                    Math.round(lerp(lastRow, row, tStep)),
                    wz + 0.5,
                    charIdx,
                    colorIdx,
                    0.96,
                    false,
                    scale
                  );
                }
              }
            }
            const sPrevC = this._prevWaveCol[vi];
            const sPrevR = this._prevWaveRow[vi];
            if (sPrevC >= 0 && Math.abs(col - sPrevC) <= 5 && Math.abs(row - sPrevR) <= 4) {
              const cDiff = Math.max(Math.abs(col - sPrevC), Math.abs(row - sPrevR));
              if (cDiff > 1) {
                for (let step = 1; step < cDiff; step++) {
                  const tStep = step / cDiff;
                  this.plotCell(
                    Math.round(lerp(sPrevC, col, tStep)),
                    Math.round(lerp(sPrevR, row, tStep)),
                    wz + 0.6,
                    charIdx,
                    colorIdx,
                    0.96,
                    false,
                    scale
                  );
                }
              }
            }
          }
        }
        this._prevWaveCol[vi] = col;
        this._prevWaveRow[vi] = row;
        lastRow = row;
        lastCol = col;
        lastWz = wz;
      }

      if (lastCol >= 0 && lastRow >= 0 && lastRow < rows - 1) {
        const fillScale = clamp(gBase, 0.36, 1.20);
        for (let r = lastRow + 1; r < rows; r += 5) {
          const rib = Math.sin(r * 0.48 + si * 0.35 - t * 1.9);
          if (rib < 0.38) continue;
          this.plotCell(lastCol, r, lastWz + 2, CH_TILDE, COL_PRUSSIAN_MID, 0.90, false, fillScale);
        }
      }
    }
  }

  rasterizeClaws(t, ecoActive) {
    const stepX = this.stepX;
    const stepY = this.stepY;
    const gBase = this.baseGlyphScale;
    const segCount = ecoActive ? 7 : 10;

    for (let i = 0; i < WAVE_CLAW_COUNT; i++) {
      const c = CLAW_SPECS[i];
      if (c.group === 0) {
        this.evalGreatWavePoint(c.s, 0.04, t, this._surfTmp);
      } else {
        this.evalForegroundWavePoint(c.s, 0.05, t, this._surfTmp);
      }

      const whip = Math.sin(t * 2.15 - c.phase) * (8 + 7 * this.swellBoost);
      const lift = Math.cos(t * 1.72 - c.phase * 1.3) * (6 + 6 * this.swellBoost);

      for (let f = 0; f < c.forks; f++) {
        const forkBias = c.forks === 1 ? 0 : (f / (c.forks - 1) - 0.5) * 0.62;
        const fReach = c.reach * (1 - Math.abs(forkBias) * 0.24);
        const fDrop = c.drop + forkBias * 22;

        let pCol = -1;
        let pRow = -1;
        for (let k = 0; k < segCount; k++) {
          const u = k / (segCount - 1);
          const arch = Math.sin(u * Math.PI * 0.68) * 18;
          const hook = Math.pow(u, 2.2) * fDrop * c.curl * 0.48;
          const wx = this._surfTmp.wx + u * fReach + whip * u - Math.pow(u, 3.0) * 6 * c.curl;
          const wy = this._surfTmp.wy + arch - hook + lift * u * 0.65;
          const wz = this._surfTmp.wz + c.zOff + Math.sin(u * Math.PI) * -6 + forkBias * 10;

          this.project3D(wx, wy, wz, this._projTmp);
          const col = Math.round(this._projTmp.sx / stepX);
          const row = Math.round(this._projTmp.sy / stepY);
          const ch = u < 0.30 ? CH_AT : u < 0.56 ? CH_HASH : u < 0.78 ? CH_STAR : u < 0.92 ? CH_C : CH_O_LOW;
          const colorIdx = u < 0.74 ? COL_FOAM_WHITE : COL_FOAM_ICE;
          const scale = clamp(this._projTmp.p * gBase * (1.12 - u * 0.22), 0.36, 1.28);

          // Alternate dark ink outline and aqua foam halo across claw segments to avoid stacked per-vertex draws.
          if ((k & 1) === 0 && u < 0.48) {
            this.plotCell(col, row + 1, wz - 2.3, CH_S_LOW, COL_INK, 0.88, false, scale * 0.94);
          } else if (k % 3 === 1 && u < 0.58) {
            this.plotCell(col - 1, row + 1, wz - 2.6, CH_TILDE, COL_FOAM_AQUA, 0.88, false, scale * 0.95);
          }
          this.plotCell(col, row, wz - 3, ch, colorIdx, 0.96, !ecoActive && c.group === 0 && k === segCount - 1, scale);

          if (pCol >= 0 && (Math.abs(col - pCol) > 1 || Math.abs(row - pRow) > 1)) {
            const steps = Math.max(Math.abs(col - pCol), Math.abs(row - pRow));
            for (let sIdx = 1; sIdx < steps; sIdx++) {
              const tS = sIdx / steps;
              this.plotCell(
                Math.round(lerp(pCol, col, tS)),
                Math.round(lerp(pRow, row, tS)),
                wz - 2.8,
                ch,
                colorIdx,
                0.96,
                false,
                scale * 0.96
              );
            }
          }
          pCol = col;
          pRow = row;
        }
      }
    }
  }

  rasterizeBoat(bi, t, ecoActive) {
    const stepX = this.stepX;
    const stepY = this.stepY;
    const gBase = this.baseGlyphScale;
    const stations = ecoActive ? 24 : 48;

    const b = this.boats[bi];
    const cosP = Math.cos(b.pitch);
    const sinP = Math.sin(b.pitch);

    for (let st = 0; st < stations; st++) {
      const u = (st / (stations - 1)) * 2 - 1;
      const sheer = Math.pow(Math.abs(u), 2.1) * (u * b.dir > 0 ? 34 : 22);
      const hullWidth = (1 - Math.pow(Math.abs(u), 2.4) * 0.78) * b.hullDepth;
      const localX = u * b.halfLen;
      const isRib = st % 8 === 0 && Math.abs(u) < 0.72;

      for (let k = 0; k < 7; k++) {
        const kv = k / 6;
        const localY = sheer - kv * hullWidth;
        const wx = b.wx + localX * cosP - localY * sinP;
        const wy = b.wy + localX * sinP + localY * cosP;
        const wz = b.wz - (1 - kv) * 4;

        this.project3D(wx, wy, wz, this._projTmp);
        const col = Math.round(this._projTmp.sx / stepX);
        const row = Math.round(this._projTmp.sy / stepY);
        const ch =
          k === 0
            ? CH_EQ
            : isRib && k < 6
              ? CH_PIPE
              : k <= 2
                ? CH_M
                : k <= 4
                  ? CH_W
                  : k === 5
                    ? CH_HASH
                    : CH_UNDER;
        const colorIdx = k === 0 ? COL_WOOD_LIGHT : k < 4 ? COL_WOOD_MID : COL_WOOD_DARK;
        const scale = clamp(this._projTmp.p * gBase * 1.04, 0.36, 1.24);
        this.plotCell(col, row, wz - 2.5, ch, colorIdx, 0.96, false, scale);
      }
    }

    // Prow splash foam where the bow cuts the swell
    const prowU = b.dir;
    const prowX = b.wx + prowU * b.halfLen * cosP - 28 * sinP;
    const prowY = b.wy + prowU * b.halfLen * sinP + 24 * cosP;
    for (let sp = 0; sp < 5; sp++) {
      const spPhase = t * 4.2 + bi * 1.9 + sp * 1.15;
      const sxOff = prowU * (4 + sp * 5) + Math.sin(spPhase) * 4;
      const syOff = -4 + Math.abs(Math.cos(spPhase)) * 12;
      this.project3D(prowX + sxOff, prowY + syOff, b.wz - 3.2, this._projTmp);
      this.plotProjected(
        this._projTmp.sx,
        this._projTmp.sy,
        b.wz - 3.2,
        sp % 2 === 0 ? CH_STAR : CH_DEG,
        sp < 3 ? COL_FOAM_WHITE : COL_FOAM_ICE,
        0.92,
        false,
        clamp(this._projTmp.p * gBase * 0.88, 0.34, 1.04)
      );
    }

    // Crouched rowers clutching oars along the mid-hull
    for (let r = 0; r < b.rowerCount; r++) {
      const ru = lerp(-0.48, 0.56, r / Math.max(1, b.rowerCount - 1));
      const sheer = Math.pow(Math.abs(ru), 2.1) * (ru * b.dir > 0 ? 34 : 22);
      const localX = ru * b.halfLen;
      const bob = Math.sin(t * 2.3 + r * 0.7 + bi) * 1.8;

      const wxT = b.wx + localX * cosP - (sheer + 8 + bob) * sinP;
      const wyT = b.wy + localX * sinP + (sheer + 8 + bob) * cosP;
      this.project3D(wxT, wyT, b.wz - 3.5, this._projTmp);
      this.plotProjected(
        this._projTmp.sx,
        this._projTmp.sy,
        b.wz - 3.5,
        r % 2 === 0 ? CH_N : CH_U,
        COL_INDIGO_MID,
        0.96,
        false,
        clamp(this._projTmp.p * gBase * 0.94, 0.36, 1.14)
      );

      const wxH = b.wx + (localX + 3 * b.dir) * cosP - (sheer + 16 + bob) * sinP;
      const wyH = b.wy + (localX + 3 * b.dir) * sinP + (sheer + 16 + bob) * cosP;
      this.project3D(wxH, wyH, b.wz - 3.8, this._projTmp);
      this.plotProjected(
        this._projTmp.sx,
        this._projTmp.sy,
        b.wz - 3.8,
        CH_O_LOW,
        COL_FOAM_ICE,
        0.96,
        false,
        clamp(this._projTmp.p * gBase * 0.88, 0.34, 1.08)
      );
    }
  }

  flushZBuffer(ctx, atlas, ecoActive) {
    const stepX = this.stepX;
    const stepY = this.stepY;
    const cols = this.cols;
    const wHalf = this.width * 0.5;
    const hUiCenter = this.height * 0.48;
    const count = this._touchedCount;
    this._lastShadedCount += count;

    let lastAlpha = -1;
    for (let i = 0; i < count; i++) {
      const idx = this._touchedIndices[i];
      const row = Math.floor(idx / cols);
      const col = idx - row * cols;
      const sx = col * stepX;
      const sy = row * stepY;

      const colorIdx = this._colorIdxBuf[idx];
      let alpha = this._alphaBuf[idx];

      // Preserve crisp readability for central clock, search bar & hint
      const cxDist = Math.abs(sx - wHalf);
      const cyDist = Math.abs(sy - hUiCenter);
      if (cxDist < 285 && cyDist < 130) {
        alpha *= colorIdx >= COL_SEAFOAM ? 0.36 : 0.62;
      }

      if (alpha <= 0.03) continue;
      if (Math.abs(alpha - lastAlpha) > 0.06) {
        ctx.globalAlpha = alpha;
        lastAlpha = alpha;
      }
      atlas.drawGlyph(
        ctx,
        WAVE_CHARS[this._charIdxBuf[idx]],
        WAVE_COLORS[colorIdx],
        !ecoActive && this._glowBuf[idx] === 1,
        sx,
        sy,
        this._scaleBuf[idx]
      );
    }
  }

  beginZPass() {
    this._frameTag++;
    this._touchedCount = 0;
  }

  render(ctx, atlas, time, _solarPhase, ecoActive = false) {
    this.time = time;
    const w = this.width;
    const h = this.height;

    // 1. Oversized cached parallax backdrop cropped cleanly to the viewport
    const backdrop = this.ensureBackdropCache(atlas, ecoActive);
    const dpr = this._backdropDpr || 1;
    const srcX = Math.round(clamp(PAD_X + this.camX * 0.24, 0, PAD_X * 1.9) * dpr);
    const srcY = Math.round(clamp(PAD_Y + this.camY * 0.18, 0, PAD_Y * 1.9) * dpr);
    const srcW = Math.min(backdrop.width - srcX, Math.max(1, Math.round(w * dpr)));
    const srcH = Math.min(backdrop.height - srcY, Math.max(1, Math.round(h * dpr)));
    ctx.globalAlpha = 1;
    ctx.drawImage(backdrop, srcX, srcY, srcW, srcH, 0, 0, w, h);

    // 2. Ambient 3D floating sea mist specks inside the wave hollow around Mount Fuji
    this.ensureZBuffer(ecoActive);
    const atmosScale = this.baseGlyphScale;
    let lastAtmosAlpha = 1;
    for (let i = 0; i < HOLLOW_MIST_COUNT; i++) {
      const m = this.hollowMist[i];
      const driftX = m.wx + Math.sin(time * m.speed + m.phase) * 14;
      const driftY = m.wy + Math.cos(time * m.speed * 0.8 + m.phase) * 9;
      this.project3D(driftX, driftY, m.wz, this._projTmp);
      const alpha = (0.34 + 0.36 * Math.sin(time * 1.4 + m.phase)) * (m.bright ? 1.0 : 0.75);
      if (alpha <= 0.04) continue;
      if (Math.abs(alpha - lastAtmosAlpha) > 0.03) {
        ctx.globalAlpha = alpha;
        lastAtmosAlpha = alpha;
      }
      atlas.drawGlyph(
        ctx,
        m.char,
        m.bright ? 'waveFoamWhite' : 'waveFoamIce',
        false,
        this._projTmp.sx,
        this._projTmp.sy,
        clamp(this._projTmp.p * atmosScale * 0.92, 0.32, 0.92)
      );
    }

    this._lastShadedCount = 0;
    this.ensurePolyGradients(ctx);

    // 3a. Layer A: Distant 3D Ocean Base + Lit Crests & Ripples
    ctx.globalAlpha = 1;
    this.fillOceanBase(ctx, time);
    this.beginZPass();
    this.rasterizeOceanField(time, ecoActive);
    this.flushZBuffer(ctx, atlas, ecoActive);

    // 3b. Layer B: Monumental Great Wave 3D Silhouette + High-Detail Foam & Striations
    ctx.globalAlpha = 1;
    this.fillGreatWavePolygon(ctx, time);
    this.beginZPass();
    this.rasterizeGreatWave(time, ecoActive);
    this.flushZBuffer(ctx, atlas, ecoActive);

    // 3c. Layer C: Right Swell 3D Silhouette + Boat 0 (left) & Boat 2 (right under Fuji)
    ctx.globalAlpha = 1;
    this.fillRightSwellPolygon(ctx, time);
    this.beginZPass();
    this.rasterizeRightSwell(time, ecoActive);
    this.rasterizeBoat(0, time, ecoActive);
    this.rasterizeBoat(2, time, ecoActive);
    this.flushZBuffer(ctx, atlas, ecoActive);

    // 3d. Layer D: Foreground Mini-Fuji 3D Silhouette (occluding Boat 0 stern & wave base) + 26 Claws + Boat 1
    ctx.globalAlpha = 1;
    this.fillForegroundWavePolygon(ctx, time);
    this.beginZPass();
    this.rasterizeForegroundWave(time, ecoActive);
    this.rasterizeClaws(time, ecoActive);
    this.rasterizeBoat(1, time, ecoActive);
    this.flushZBuffer(ctx, atlas, ecoActive);

    // 4. Pooled 3D ballistic sea spray droplets
    const sprays = this.sprayPool.items;
    const sprayStep = ecoActive ? 2 : 1;
    lastAtmosAlpha = -1;
    for (let i = 0; i < SPRAY_POOL_SIZE; i += sprayStep) {
      const sp = sprays[i];
      if (!sp.active) continue;
      const lifeT = sp.age / sp.life;
      const alpha = Math.sin(clamp(lifeT, 0, 1) * Math.PI) * 0.92;
      if (alpha <= 0.04) continue;
      this.project3D(sp.wx, sp.wy, sp.wz, this._projTmp);
      if (Math.abs(alpha - lastAtmosAlpha) > 0.03) {
        ctx.globalAlpha = alpha;
        lastAtmosAlpha = alpha;
      }
      atlas.drawGlyph(
        ctx,
        sp.char,
        sp.colorKey,
        !ecoActive && sp.glow,
        this._projTmp.sx,
        this._projTmp.sy,
        clamp(this._projTmp.p * atmosScale * (1.06 - lifeT * 0.22), 0.34, 1.16)
      );
    }

    // 5. Pomodoro 25s Tempest Tide coastal sakura & seafoam sparkles
    const tempests = this.tempestPool.items;
    lastAtmosAlpha = -1;
    for (let i = 0; i < TEMPEST_POOL_SIZE; i++) {
      const tp = tempests[i];
      if (!tp.active) continue;
      const lifeT = tp.age / tp.life;
      const alpha = Math.sin(clamp(lifeT, 0, 1) * Math.PI) * 0.9;
      if (alpha <= 0.04) continue;
      this.project3D(tp.wx, tp.wy, tp.wz, this._projTmp);
      if (Math.abs(alpha - lastAtmosAlpha) > 0.03) {
        ctx.globalAlpha = alpha;
        lastAtmosAlpha = alpha;
      }
      atlas.drawGlyph(
        ctx,
        tp.char,
        tp.colorKey,
        !ecoActive && !tp.isPetal,
        this._projTmp.sx,
        this._projTmp.sy,
        clamp(this._projTmp.p * this.perspScale * (tp.isPetal ? 0.85 : 0.72), 0.48, 1.14)
      );
    }

    ctx.globalAlpha = 1;
  }

  getShadedCellCount() {
    return this._lastShadedCount;
  }

  getBoatStates() {
    return this.boats.map((b) => ({
      x: b.sx,
      y: b.sy,
      wz: b.wz,
      pitch: b.pitch
    }));
  }

  getWaveState() {
    return {
      crestX: this.crestX,
      crestY: this.crestY,
      swellPhase: this.swellPhase,
      camParallaxX: this.camParallaxX,
      camParallaxY: this.camParallaxY,
      surgeBoost: this.surgeBoost,
      tempestTimer: this.tempestTimer,
      shadedCells: this._lastShadedCount
    };
  }
}
