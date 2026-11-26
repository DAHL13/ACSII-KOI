import { CELL_H, CELL_W, SPACE_ORBIT_SPEEDS } from '../core/constants.js';
import { clamp, randRange } from '../core/math.js';
import { ObjectPool } from '../core/object-pool.js';

const CAM_DIST = 14.0;
const ORBIT_SPEED = 0.042;
const BLACK_HOLE_RES = 1.5;
const STARDUST_POOL_SIZE = 48;
const METEOR_POOL_SIZE = 24;

export const SPACE_PALETTES = {
  gold: {
    bgFill: 'rgba(2, 2, 5, 0.94)',
    ember: 'spaceEmber',
    rust: 'spaceRust',
    amber: 'spaceAmber',
    gold: 'spaceGold',
    pale: 'spacePale',
    core: 'spaceCore',
    dustA: 'nebulaGoldA',
    dustB: 'nebulaGoldB'
  },
  quasar: {
    bgFill: 'rgba(2, 4, 10, 0.94)',
    ember: 'quasarEmber',
    rust: 'quasarRust',
    amber: 'quasarAmber',
    gold: 'quasarGold',
    pale: 'quasarPale',
    core: 'quasarCore',
    dustA: 'nebulaBlueA',
    dustB: 'nebulaBlueB'
  },
  violet: {
    bgFill: 'rgba(4, 2, 10, 0.94)',
    ember: 'violetEmber',
    rust: 'violetRust',
    amber: 'violetAmber',
    gold: 'violetGold',
    pale: 'violetPale',
    core: 'violetCore',
    dustA: 'nebulaVioletA',
    dustB: 'nebulaVioletB'
  }
};

const FILL_LEVELS = [
  ['.', '·', ',', ':', ';', '-', '~', "'", '.', '·', ',', ':'],
  ['r', 't', 'v', 'c', 'x', 'z', '^', '~', '+', '*', 'r', 'c'],
  ['e', 'a', 's', 'n', 'u', 'o', '0', 'O', '=', '+', '*', '%'],
  ['Q', 'S', '8', 'B', 'R', 'K', 'N', 'M', 'W', '#', '@', '$']
];

const TANGENT_CHARS = ['-', '=', '/', '|', '\\', '~'];
const STAR_CHARS = ['·', '.', '*', '+'];
const STAR_COLORS = ['starCool', 'starCool', 'starBlue', 'starWarm'];
const DUST_CHARS = ['·', '.', ',', ':'];

const PLANET_SPECS = [
  {
    phi0: -0.34,
    orbitR: 32.5,
    y0: 3.2,
    omega: 0.006,
    radius: 1.30,
    spin: 0.14,
    bandFreq: 7.4,
    bandPhase: 0.4,
    bandStyle: 'bands',
    hasRings: true,
    ringTilt: 0.30,
    moon: { orbitR: 2.38, tiltY: 0.30, omega: 0.42, phase0: 0.8, radius: 0.22, colorKey: 'planetOchreLight' },
    darkKey: 'planetOchreDark',
    midKey: 'planetOchreMid',
    lightKey: 'planetOchreLight',
    ringKey: 'planetRingDust'
  },
  {
    phi0: 0.40,
    orbitR: 30.5,
    y0: -4.8,
    omega: 0.007,
    radius: 1.08,
    spin: 0.17,
    bandFreq: 5.2,
    bandPhase: 1.7,
    bandStyle: 'swirl',
    hasRings: false,
    ringTilt: 0,
    moon: { orbitR: 1.85, tiltY: 0.26, omega: 0.56, phase0: 2.4, radius: 0.20, colorKey: 'starCool' },
    darkKey: 'planetOceanDark',
    midKey: 'planetOceanMid',
    lightKey: 'planetOceanLight',
    ringKey: 'planetRingDust'
  },
  {
    phi0: 1.52,
    orbitR: 34.0,
    y0: 5.4,
    omega: 0.005,
    radius: 0.98,
    spin: 0.12,
    bandFreq: 6.4,
    bandPhase: 2.3,
    bandStyle: 'swirl',
    hasRings: false,
    ringTilt: 0,
    moon: null,
    darkKey: 'planetCrimsonDark',
    midKey: 'planetCrimsonMid',
    lightKey: 'planetCrimsonLight',
    ringKey: 'planetRingDust'
  },
  {
    phi0: 2.65,
    orbitR: 35.5,
    y0: -2.6,
    omega: 0.006,
    radius: 1.38,
    spin: 0.15,
    bandFreq: 8.2,
    bandPhase: 3.9,
    bandStyle: 'bands',
    hasRings: false,
    ringTilt: 0,
    moon: { orbitR: 2.04, tiltY: -0.28, omega: -0.36, phase0: 4.1, radius: 0.24, colorKey: 'planetVioletLight' },
    darkKey: 'planetVioletDark',
    midKey: 'planetVioletMid',
    lightKey: 'planetVioletLight',
    ringKey: 'planetRingDust'
  },
  {
    phi0: 3.78,
    orbitR: 30.0,
    y0: -6.2,
    omega: 0.009,
    radius: 0.80,
    spin: 0.20,
    bandFreq: 9.0,
    bandPhase: 4.5,
    bandStyle: 'crater',
    hasRings: false,
    ringTilt: 0,
    moon: null,
    darkKey: 'planetSlateDark',
    midKey: 'planetSlateMid',
    lightKey: 'planetIceLight',
    ringKey: 'planetRingDust'
  },
  {
    phi0: 4.90,
    orbitR: 33.0,
    y0: -1.8,
    omega: 0.008,
    radius: 1.04,
    spin: 0.16,
    bandFreq: 6.0,
    bandPhase: 0.9,
    bandStyle: 'bands',
    hasRings: false,
    ringTilt: 0,
    moon: null,
    darkKey: 'planetEmeraldDark',
    midKey: 'planetEmeraldMid',
    lightKey: 'planetEmeraldLight',
    ringKey: 'planetRingDust'
  }
];

function smoothstep(edge0, edge1, x) {
  const t = clamp((x - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function getTangentCharIndex(ux, vy) {
  const ang = Math.atan2(vy, ux);
  const tx = -Math.sin(ang);
  const ty = Math.cos(ang);
  const absX = Math.abs(tx);
  const absY = Math.abs(ty);
  if (absY < absX * 0.42) return 0; // '-'
  if (absX < absY * 0.42) return 3; // '|'
  if (tx * ty >= 0) return 4; // '\\'
  return 2; // '/'
}

export class SpaceLayer {
  constructor(width, height, options = {}) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);

    this.centerX = this.width * 0.5;
    this.centerY = this.height * 0.485;
    this.r0 = 60;
    this.focal = 840;
    this.glyphScale = 1;
    this.cellCount = 0;
    this.maxReachX = 400;
    this.maxReachY = 240;

    this.palette = 'gold';
    this.orbitSpeedScale = 1;
    this.orbitPhase = 0;
    this.planetOrbitTime = 0;
    this._lastCamTime = 0;
    this.setPalette(options.palette);
    this.setOrbitSpeed(options.orbitSpeed);

    this.candX = new Float32Array(0);
    this.candY = new Float32Array(0);
    this.candDx = new Float32Array(0);
    this.candDy = new Float32Array(0);
    this.candHash = new Uint8Array(0);
    this.candOdd = new Uint8Array(0);
    this.candEdgeFade = new Float32Array(0);

    this.stars = [];
    this.milkyWay = [];
    this.planets = [];
    this.projectedPlanets = [];
    this.shootingStars = [
      { active: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 0.9, cooldown: 3.5 },
      { active: false, x: 0, y: 0, vx: 0, vy: 0, age: 0, life: 0.9, cooldown: 9.5 }
    ];

    this.flare = 0;
    this.meteorTimer = 0;
    this.meteorSpawnAccum = 0;
    this.meteorFlareAccum = 0;

    this.camera = {
      time: -1,
      azimuth: 0,
      elev: 0.06,
      roll: 0.20,
      dist: CAM_DIST * 1.04,
      cx: 0,
      cy: 0,
      cz: CAM_DIST * 1.04,
      fwdX: 0,
      fwdY: 0,
      fwdZ: -1,
      rightX: 1,
      rightY: 0,
      rightZ: 0,
      upX: 0,
      upY: 1,
      upZ: 0
    };

    this.stardustPool = new ObjectPool(STARDUST_POOL_SIZE, () => ({
      active: false,
      x: 0,
      y: 0,
      angle: 0,
      radius: 0,
      angularSpeed: 0,
      radialSpeed: 0,
      age: 0,
      life: 1.4,
      char: '·',
      colorKey: 'spaceGold'
    }));

    this.meteorPool = new ObjectPool(METEOR_POOL_SIZE, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      age: 0,
      life: 0.95,
      char: '*'
    }));

    this.buildBlackHoleGrid();
    this.initStars();
    this.initMilkyWay();
    this.initPlanets();
    this.updateCamera(0);
  }

  setPalette(palette) {
    this.palette = SPACE_PALETTES[palette] ? palette : 'gold';
  }

  getPalette() {
    return this.palette;
  }

  getPaletteConfig() {
    return SPACE_PALETTES[this.palette] || SPACE_PALETTES.gold;
  }

  setOrbitSpeed(speed) {
    if (
      speed !== undefined &&
      speed !== null &&
      speed !== '' &&
      typeof speed !== 'boolean' &&
      SPACE_ORBIT_SPEEDS.includes(Number(speed))
    ) {
      this.orbitSpeedScale = Number(speed);
    } else {
      this.orbitSpeedScale = 1;
    }
  }

  getOrbitSpeed() {
    return this.orbitSpeedScale;
  }

  getCellCount() {
    return this.cellCount;
  }

  getStarCount() {
    return this.stars.length;
  }

  getMilkyWayCount() {
    return this.milkyWay.length;
  }

  getPlanetCount() {
    return this.planets.length;
  }

  getCameraState() {
    return this.camera;
  }

  setPointer() {
    // Space camera and starfield intentionally ignore pointer movement
  }

  resize(width, height) {
    this.width = Math.max(1, width);
    this.height = Math.max(1, height);
    this.buildBlackHoleGrid();
    this.initStars();
  }

  updateCamera(time) {
    const cam = this.camera;
    const tVal = Number.isFinite(time) ? time : 0;
    if (tVal !== this._lastCamTime) {
      const dTime = tVal - this._lastCamTime;
      this.orbitPhase += dTime * ORBIT_SPEED * this.orbitSpeedScale;
      this.planetOrbitTime += dTime * this.orbitSpeedScale;
      this._lastCamTime = tVal;
    }
    const azimuth = this.orbitPhase;
    const elev = 0.06 + 0.14 * Math.sin(azimuth);
    const roll = 0.10 + 0.10 * Math.cos(azimuth);
    const dist = CAM_DIST * (1.0 + 0.04 * Math.cos(azimuth));

    const cosE = Math.cos(elev);
    const sinE = Math.sin(elev);
    const cosA = Math.cos(azimuth);
    const sinA = Math.sin(azimuth);
    const cosR = Math.cos(roll);
    const sinR = Math.sin(roll);

    const fwdX = -cosE * sinA;
    const fwdY = -sinE;
    const fwdZ = -cosE * cosA;

    const r0X = cosA;
    const r0Z = -sinA;
    const u0X = -sinE * sinA;
    const u0Y = cosE;
    const u0Z = -sinE * cosA;

    cam.time = tVal;
    cam.azimuth = azimuth;
    cam.elev = elev;
    cam.roll = roll;
    cam.dist = dist;
    cam.cx = dist * cosE * sinA;
    cam.cy = dist * sinE;
    cam.cz = dist * cosE * cosA;
    cam.fwdX = fwdX;
    cam.fwdY = fwdY;
    cam.fwdZ = fwdZ;
    cam.rightX = r0X * cosR + u0X * sinR;
    cam.rightY = u0Y * sinR;
    cam.rightZ = r0Z * cosR + u0Z * sinR;
    cam.upX = -r0X * sinR + u0X * cosR;
    cam.upY = u0Y * cosR;
    cam.upZ = -r0Z * sinR + u0Z * cosR;
  }

  buildBlackHoleGrid() {
    const w = this.width;
    const h = this.height;
    this.centerX = w * 0.5;
    this.centerY = h * 0.485;

    // 30% zoomed-out perspective compared to original close-up framing
    const r0 = Math.max(36, Math.min(w * 0.08, h * 0.124));
    this.r0 = r0;
    this.focal = r0 * CAM_DIST;

    const areaRatio = (w * h) / (1280 * 800);
    const cellScale = clamp(Math.sqrt(Math.max(0.45, areaRatio)), 0.94, 1.8);
    const stepX = (CELL_W * cellScale) / BLACK_HOLE_RES;
    const stepY = (CELL_H * cellScale) / BLACK_HOLE_RES;
    this.glyphScale = (0.94 * Math.pow(cellScale, 0.72)) / 1.44;

    const maxReachX = Math.min(w * 0.54, r0 * 8.2);
    const maxReachY = Math.min(h * 0.54, r0 * 3.6);
    this.maxReachX = Math.max(1, maxReachX);
    this.maxReachY = Math.max(1, maxReachY);
    const halfCols = Math.ceil(maxReachX / stepX);
    const halfRows = Math.ceil(maxReachY / stepY);

    const xArr = [];
    const yArr = [];
    const dxArr = [];
    const dyArr = [];
    const hashArr = [];
    const oddArr = [];
    const edgeFadeArr = [];

    for (let row = -halfRows; row <= halfRows; row++) {
      const py = this.centerY + row * stepY;
      if (py < -stepY || py > h + stepY) continue;
      const dy = py - this.centerY;

      for (let col = -halfCols; col <= halfCols; col++) {
        const px = this.centerX + col * stepX;
        if (px < -stepX || px > w + stepX) continue;
        const dx = px - this.centerX;

        const normEll = (dx / maxReachX) * (dx / maxReachX) + (dy / maxReachY) * (dy / maxReachY);
        if (normEll > 1.04) continue;

        const edgeFade = smoothstep(1.02, 0.70, Math.sqrt(normEll));
        if (edgeFade <= 0.005) continue;

        const hash = Math.abs((col * 73856093) ^ (row * 19349663)) % 12;
        xArr.push(px);
        yArr.push(py);
        dxArr.push(dx);
        dyArr.push(dy);
        hashArr.push(hash);
        oddArr.push((col + row) & 1);
        edgeFadeArr.push(edgeFade);
      }
    }

    this.cellCount = xArr.length;
    this.candX = Float32Array.from(xArr);
    this.candY = Float32Array.from(yArr);
    this.candDx = Float32Array.from(dxArr);
    this.candDy = Float32Array.from(dyArr);
    this.candHash = Uint8Array.from(hashArr);
    this.candOdd = Uint8Array.from(oddArr);
    this.candEdgeFade = Float32Array.from(edgeFadeArr);
  }

  initStars() {
    const target = 180;
    const stars = new Array(target);
    for (let i = 0; i < target; i++) {
      const cosTheta = randRange(-1, 1);
      const sinTheta = Math.sqrt(Math.max(0, 1 - cosTheta * cosTheta));
      const phi = randRange(0, Math.PI * 2);
      stars[i] = {
        sx: sinTheta * Math.cos(phi),
        sy: cosTheta,
        sz: sinTheta * Math.sin(phi),
        phase: randRange(0, Math.PI * 2),
        speed: randRange(0.8, 2.3),
        baseAlpha: randRange(0.45, 0.96),
        char: STAR_CHARS[i % STAR_CHARS.length],
        colorKey: STAR_COLORS[i % STAR_COLORS.length]
      };
    }
    this.stars = stars;
  }

  initMilkyWay() {
    const target = 240;
    const tilt = 0.56;
    const yaw = 0.42;
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);
    const dust = new Array(target);

    for (let i = 0; i < target; i++) {
      const lon = (i / target) * Math.PI * 2 + randRange(-0.08, 0.08);
      const lat = (randRange(-1, 1) + randRange(-1, 1)) * 0.14;
      const cosLat = Math.cos(lat);
      const x0 = cosLat * Math.cos(lon);
      const y0 = Math.sin(lat);
      const z0 = cosLat * Math.sin(lon);

      const y1 = y0 * cosT - z0 * sinT;
      const z1 = y0 * sinT + z0 * cosT;
      const x2 = x0 * cosY - z1 * sinY;
      const z2 = x0 * sinY + z1 * cosY;

      dust[i] = {
        sx: x2,
        sy: y1,
        sz: z2,
        phase: randRange(0, Math.PI * 2),
        baseAlpha: 0.16 + 0.18 * Math.exp(-(lat * lat) / 0.014),
        char: DUST_CHARS[i % DUST_CHARS.length],
        alt: i % 3 === 0
      };
    }
    this.milkyWay = dust;
  }

  initPlanets() {
    this.planets = PLANET_SPECS.map((spec) => ({ ...spec }));
    this.projectedPlanets = PLANET_SPECS.map((spec) => ({
      spec,
      screenX: 0,
      screenY: 0,
      screenR: 0,
      zCam: 0,
      lx: 0,
      ly: 0,
      lz: 1,
      visible: false
    }));
  }

  triggerPulse(x, y, burstCount = 8) {
    this.flare = Math.min(1.15, this.flare + 0.55);
    const pal = this.getPaletteConfig();

    const dx = x - this.centerX;
    const dy = y - this.centerY;
    const baseAngle = Math.atan2(dy, dx);
    const baseRadius = Math.max(this.r0 * 1.12, Math.hypot(dx, dy));

    for (let i = 0; i < burstCount; i++) {
      const slot = this.stardustPool.acquire(true);
      const ang = baseAngle + randRange(-0.42, 0.42);
      const rad = Math.max(this.r0 * 1.06, baseRadius + randRange(-26, 26));
      slot.active = true;
      slot.angle = ang;
      slot.radius = rad;
      slot.x = this.centerX + Math.cos(ang) * rad;
      slot.y = this.centerY + Math.sin(ang) * rad * 0.56;
      slot.angularSpeed = randRange(1.25, 2.35);
      slot.radialSpeed = randRange(48, 102);
      slot.age = 0;
      slot.life = randRange(1.1, 2.2);
      slot.char = i % 3 === 0 ? '*' : i % 2 === 0 ? '+' : '·';
      slot.colorKey = i % 3 === 0 ? pal.core : i % 2 === 0 ? pal.pale : pal.gold;
    }
  }

  triggerMultiPulse() {
    this.flare = Math.min(1.25, this.flare + 0.9);
    const pal = this.getPaletteConfig();
    const ringCount = 18;
    for (let i = 0; i < ringCount; i++) {
      const slot = this.stardustPool.acquire(true);
      const ang = (i / ringCount) * Math.PI * 2 + randRange(-0.15, 0.15);
      const rad = randRange(this.r0 * 1.6, Math.max(this.r0 * 3.0, Math.min(this.width, this.height) * 0.42));
      slot.active = true;
      slot.angle = ang;
      slot.radius = rad;
      slot.x = this.centerX + Math.cos(ang) * rad;
      slot.y = this.centerY + Math.sin(ang) * rad * 0.56;
      slot.angularSpeed = randRange(1.1, 2.05);
      slot.radialSpeed = randRange(58, 112);
      slot.age = 0;
      slot.life = randRange(1.3, 2.4);
      slot.char = i % 2 === 0 ? '*' : '·';
      slot.colorKey = i % 3 === 0 ? pal.core : pal.gold;
    }
  }

  spawnMeteor() {
    const slot = this.meteorPool.acquire(true);
    const fromLeft = Math.random() > 0.35;
    slot.active = true;
    slot.age = 0;
    slot.life = randRange(0.65, 1.25);
    slot.x = fromLeft
      ? randRange(-40, this.width * 0.65)
      : randRange(this.width * 0.35, this.width + 40);
    slot.y = randRange(-20, this.height * 0.45);
    slot.vx = (fromLeft ? 1 : -1) * randRange(440, 740);
    slot.vy = randRange(180, 340);
    slot.char = Math.random() > 0.4 ? '*' : '+';
  }

  triggerMeteorShower(durationSeconds = 25) {
    this.meteorTimer = Math.max(this.meteorTimer, durationSeconds);
    this.meteorSpawnAccum = 0;
    this.meteorFlareAccum = 0;
    this.triggerMultiPulse();
    for (let i = 0; i < 6; i++) {
      this.spawnMeteor();
    }
  }

  resetShootingStar(s) {
    const fromLeft = Math.random() > 0.45;
    s.active = true;
    s.age = 0;
    s.life = randRange(0.55, 0.95);
    s.x = fromLeft ? randRange(this.width * 0.05, this.width * 0.45) : randRange(this.width * 0.55, this.width * 0.95);
    s.y = randRange(this.height * 0.04, this.height * 0.28);
    s.vx = (fromLeft ? 1 : -1) * randRange(420, 640);
    s.vy = randRange(150, 260);
    s.cooldown = randRange(7, 15);
  }

  update(dt, time) {
    if (this.flare > 0) {
      this.flare = Math.max(0, this.flare - dt * 0.65);
    }

    this.updateCamera(time);

    if (this.meteorTimer > 0) {
      this.meteorTimer = Math.max(0, this.meteorTimer - dt);
      this.meteorSpawnAccum += dt;
      this.meteorFlareAccum += dt;
      while (this.meteorSpawnAccum >= 0.16) {
        this.meteorSpawnAccum -= 0.16;
        this.spawnMeteor();
      }
      if (this.meteorFlareAccum >= 2.4) {
        this.meteorFlareAccum = 0;
        this.flare = Math.min(1.1, Math.max(this.flare, 0.42));
      }
    }

    const meteors = this.meteorPool.items;
    for (let i = 0; i < METEOR_POOL_SIZE; i++) {
      const m = meteors[i];
      if (!m.active) continue;
      m.age += dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.age >= m.life) {
        m.active = false;
      }
    }

    for (let i = 0; i < this.shootingStars.length; i++) {
      const s = this.shootingStars[i];
      if (s.active) {
        s.age += dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        if (s.age >= s.life) {
          s.active = false;
        }
      } else {
        s.cooldown -= dt;
        if (s.cooldown <= 0) {
          this.resetShootingStar(s);
        }
      }
    }

    const cam = this.camera;
    const cosR = Math.cos(cam.roll);
    const sinR = Math.sin(cam.roll);
    const flatRatio = Math.max(0.24, Math.abs(Math.sin(cam.elev)) * 1.15 + 0.16);
    const dust = this.stardustPool.items;
    const absorbR = this.r0 * 0.9;
    for (let i = 0; i < STARDUST_POOL_SIZE; i++) {
      const p = dust[i];
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.active = false;
        continue;
      }

      const boost = this.r0 / Math.max(this.r0 * 0.6, p.radius);
      p.angle += p.angularSpeed * (0.7 + boost * 1.4) * dt;
      p.radius -= p.radialSpeed * (0.8 + boost * 0.9) * dt;
      if (p.radius <= absorbR) {
        p.active = false;
        continue;
      }

      const rawX = Math.cos(p.angle) * p.radius;
      const rawY = Math.sin(p.angle) * p.radius * flatRatio;
      p.x = this.centerX + rawX * cosR - rawY * sinR;
      p.y = this.centerY + rawX * sinR + rawY * cosR;
    }
  }

  projectPlanets() {
    const cam = this.camera;
    const w = this.width;
    const h = this.height;
    const focal = this.focal;
    const list = this.projectedPlanets;
    const pTime = this.planetOrbitTime;

    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      const sp = item.spec;
      const phi = sp.phi0 + pTime * sp.omega;
      const wx = sp.orbitR * Math.sin(phi);
      const wy = sp.y0;
      const wz = -sp.orbitR * Math.cos(phi);

      const relX = wx - cam.cx;
      const relY = wy - cam.cy;
      const relZ = wz - cam.cz;

      const zCam = relX * cam.fwdX + relY * cam.fwdY + relZ * cam.fwdZ;
      if (zCam <= 4.0) {
        item.visible = false;
        continue;
      }

      const xCam = relX * cam.rightX + relY * cam.rightY + relZ * cam.rightZ;
      const yCam = relX * cam.upX + relY * cam.upY + relZ * cam.upZ;

      const invZ = focal / zCam;
      const screenX = this.centerX + xCam * invZ;
      const screenY = this.centerY - yCam * invZ;
      const screenR = sp.radius * invZ;
      const boundR = sp.hasRings ? screenR * 2.1 : screenR * 1.15;

      if (screenX + boundR < 0 || screenX - boundR > w || screenY + boundR < 0 || screenY - boundR > h) {
        item.visible = false;
        continue;
      }

      // Direction toward the Black Hole at world origin (0,0,0)
      const invLen = 1 / Math.max(0.001, Math.hypot(wx, wy, wz));
      const lwx = -wx * invLen;
      const lwy = -wy * invLen;
      const lwz = -wz * invLen;

      item.visible = true;
      item.screenX = screenX;
      item.screenY = screenY;
      item.screenR = screenR;
      item.zCam = zCam;
      item.lx = lwx * cam.rightX + lwy * cam.rightY + lwz * cam.rightZ;
      item.ly = lwx * cam.upX + lwy * cam.upY + lwz * cam.upZ;
      item.lz = -(lwx * cam.fwdX + lwy * cam.fwdY + lwz * cam.fwdZ);
    }

    list.sort((a, b) => b.zCam - a.zCam);
  }

  renderPlanetRingHalf(ctx, atlas, item, frontHalf, ecoActive) {
    const sp = item.spec;
    if (!sp.hasRings) return;
    const cx = item.screenX;
    const cy = item.screenY;
    const sr = item.screenR;
    const cosT = Math.cos(sp.ringTilt);
    const sinT = Math.sin(sp.ringTilt);
    const innerR = sr * 1.32;
    const outerR = sr * 1.92;
    const ringTracks = ecoActive ? 2 : 3;
    const angStart = frontHalf ? 0.04 : -Math.PI;
    const angEnd = frontHalf ? Math.PI : -0.04;
    const stepAng = ecoActive ? 0.34 : 0.22;

    for (let t = 0; t < ringTracks; t++) {
      const r = innerR + ((outerR - innerR) * t) / Math.max(1, ringTracks - 1);
      for (let a = angStart; a <= angEnd; a += stepAng) {
        const lx = Math.cos(a) * r;
        const ly = Math.sin(a) * r * 0.30;
        const rx = lx * cosT - ly * sinT;
        const ry = lx * sinT + ly * cosT;
        if (!frontHalf && rx * rx + ry * ry < sr * sr * 0.94) continue;
        const fade = t === 1 ? 0.72 : 0.48;
        ctx.globalAlpha = fade;
        const ch = t === 1 ? '=' : Math.abs(Math.cos(a)) > 0.65 ? '-' : '~';
        atlas.drawGlyph(ctx, ch, sp.ringKey, false, cx + rx, cy + ry, 0.74);
      }
    }
  }

  renderPlanetMoon(ctx, atlas, item, frontHalf) {
    const moon = item.spec.moon;
    if (!moon) return;
    const sr = item.screenR;
    const moonR = moon.radius * sr;
    if (moonR < 2.2) return;

    const mAng = moon.phase0 + this.planetOrbitTime * moon.omega;
    const isFront = Math.sin(mAng) >= 0;
    if (isFront !== frontHalf) return;

    const tilt = item.spec.hasRings ? item.spec.ringTilt : moon.tiltY;
    const cosT = Math.cos(tilt);
    const sinT = Math.sin(tilt);
    const lx = Math.cos(mAng) * moon.orbitR * sr;
    const ly = Math.sin(mAng) * moon.orbitR * sr * 0.28;
    const rx = lx * cosT - ly * sinT;
    const ry = lx * sinT + ly * cosT;

    if (!frontHalf && rx * rx + ry * ry < sr * sr * 1.06) return;

    const mx = item.screenX + rx;
    const my = item.screenY + ry;
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.getPaletteConfig().bgFill;
    ctx.beginPath();
    ctx.arc(mx, my, Math.max(2.4, moonR * 1.15), 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.88;
    atlas.drawGlyph(ctx, moonR >= 4 ? 'o' : '·', moon.colorKey, false, mx, my, clamp(moonR / 4.2, 0.62, 0.82));
  }

  renderPlanet(ctx, atlas, item, time, ecoActive) {
    if (!item.visible) return;
    const sp = item.spec;
    const cx = item.screenX;
    const cy = item.screenY;
    const sr = item.screenR;
    if (sr < 5) return;

    // 1. Back half of planetary rings & orbiting moon
    this.renderPlanetRingHalf(ctx, atlas, item, false, ecoActive);
    this.renderPlanetMoon(ctx, atlas, item, false);

    // 2. Opaque dark planetary silhouette so background stars don't shine through solid rock/gas
    ctx.globalAlpha = 1;
    ctx.fillStyle = this.getPaletteConfig().bgFill;
    ctx.beginPath();
    ctx.arc(cx, cy, sr * 0.98, 0, Math.PI * 2);
    ctx.fill();

    // 3. 3D-shaded ASCII sphere lit by the Black Hole accretion glow
    const stepX = CELL_W * (ecoActive ? 1.08 : 0.80);
    const stepY = CELL_H * (ecoActive ? 1.08 : 0.80);
    const cols = Math.ceil(sr / stepX);
    const rows = Math.ceil(sr / stepY);
    const lx = item.lx;
    const ly = item.ly;
    const lz = item.lz;

    for (let row = -rows; row <= rows; row++) {
      const py = cy + row * stepY;
      const ny = -(row * stepY) / sr;
      for (let col = -cols; col <= cols; col++) {
        const px = cx + col * stepX;
        const nx = (col * stepX) / sr;
        const r2 = nx * nx + ny * ny;
        if (r2 > 0.98) continue;
        const nz = Math.sqrt(Math.max(0, 1 - r2));

        const ndotl = nx * lx + ny * ly + nz * lz;
        const bandInput =
          sp.bandStyle === 'crater'
            ? (nx * nx * 1.4 + ny * ny * 1.1) * sp.bandFreq + time * sp.spin
            : sp.bandStyle === 'swirl'
              ? (ny * 0.75 + Math.sin(nx * 2.5 + time * sp.spin) * 0.35) * sp.bandFreq + sp.bandPhase
              : (ny * 0.9 + nx * 0.25) * sp.bandFreq + time * sp.spin + sp.bandPhase;
        const band = (sp.bandStyle === 'crater' ? 0.09 : 0.07) * Math.sin(bandInput);
        const diffuse = Math.pow(Math.max(0, ndotl), 0.78);
        const lit = clamp(diffuse * 0.90 + 0.03 + band * (ndotl > -0.15 ? 1 : 0.18), 0, 1);
        const rimGlow = nz < 0.46 && ndotl > 0.10 ? 0.22 : 0;
        const total = clamp(lit + rimGlow, 0, 1);

        let ch;
        let colorKey;
        let alpha;
        let glow = false;

        if (total < 0.12) {
          ch = '.';
          colorKey = sp.darkKey;
          alpha = 0.28;
        } else if (total < 0.30) {
          ch = ':';
          colorKey = sp.darkKey;
          alpha = 0.58;
        } else if (total < 0.54) {
          ch = ((col + row) & 1) === 0 ? 'o' : '~';
          colorKey = sp.midKey;
          alpha = 0.82;
        } else if (total < 0.78) {
          ch = ((col + row) & 1) === 0 ? 'O' : '#';
          colorKey = sp.midKey;
          alpha = 0.94;
        } else {
          ch = total > 0.90 ? '@' : '0';
          colorKey = sp.lightKey;
          alpha = 0.98;
          glow = !ecoActive && rimGlow > 0;
        }

        ctx.globalAlpha = alpha;
        atlas.drawGlyph(ctx, ch, colorKey, glow, px, py, 0.78);
      }
    }

    // 4. Front half of planetary rings & orbiting moon
    this.renderPlanetRingHalf(ctx, atlas, item, true, ecoActive);
    this.renderPlanetMoon(ctx, atlas, item, true);
  }

  render(ctx, atlas, time, solarPhase, ecoActive = false) {
    if (Math.abs(time - this.camera.time) > 0.001) {
      this.updateCamera(time);
    }

    const pal = this.getPaletteConfig();
    const cam = this.camera;
    const cosR = Math.cos(cam.roll);
    const sinR = Math.sin(cam.roll);
    const r0Dyn = this.r0 * (CAM_DIST / cam.dist);
    const focal = this.focal;
    const cx = this.centerX;
    const cy = this.centerY;

    // 0. Subtle 3D ASCII Milky Way interstellar dust band
    const dustStep = ecoActive ? 2 : 1;
    for (let i = 0; i < this.milkyWay.length; i += dustStep) {
      const m = this.milkyWay[i];
      const dotF = m.sx * cam.fwdX + m.sy * cam.fwdY + m.sz * cam.fwdZ;
      if (dotF <= 0.16) continue;

      const dotR = m.sx * cam.rightX + m.sy * cam.rightY + m.sz * cam.rightZ;
      const dotU = m.sx * cam.upX + m.sy * cam.upY + m.sz * cam.upZ;
      const px = cx + (dotR / dotF) * focal;
      const py = cy - (dotU / dotF) * focal;
      if (px < 4 || px > this.width - 4 || py < 4 || py > this.height - 4) continue;

      const dx = px - cx;
      const dy = py - cy;
      const ux = (dx * cosR + dy * sinR) / r0Dyn;
      const vy = (-dx * sinR + dy * cosR) / r0Dyn;
      const rShadow = Math.hypot(ux / 1.03, vy / 0.93);
      if (rShadow < 1.25) continue;

      ctx.globalAlpha = m.baseAlpha;
      atlas.drawGlyph(ctx, m.char, m.alt ? pal.dustB : pal.dustA, false, px, py, 0.78);
    }

    // 1. 3D orbiting celestial starfield with subtle gravitational lensing near the black hole
    for (let i = 0; i < this.stars.length; i++) {
      const st = this.stars[i];
      const dotF = st.sx * cam.fwdX + st.sy * cam.fwdY + st.sz * cam.fwdZ;
      if (dotF <= 0.16) continue;

      const dotR = st.sx * cam.rightX + st.sy * cam.rightY + st.sz * cam.rightZ;
      const dotU = st.sx * cam.upX + st.sy * cam.upY + st.sz * cam.upZ;
      let px = cx + (dotR / dotF) * focal;
      let py = cy - (dotU / dotF) * focal;

      const dx = px - cx;
      const dy = py - cy;
      const ux = (dx * cosR + dy * sinR) / r0Dyn;
      const vy = (-dx * sinR + dy * cosR) / r0Dyn;
      const rShadow = Math.hypot(ux / 1.03, vy / 0.93);

      // Occluded behind event horizon shadow
      if (rShadow < 1.15) continue;

      if (rShadow < 2.4) {
        const push = (0.95 / (rShadow * rShadow)) * r0Dyn * 0.25;
        const len = Math.max(1, Math.hypot(dx, dy));
        px += (dx / len) * push;
        py += (dy / len) * push;
      }

      if (px < 4 || px > this.width - 4 || py < 4 || py > this.height - 4) continue;

      const twinkle = 0.55 + 0.45 * Math.sin(time * st.speed + st.phase);
      const alpha = st.baseAlpha * twinkle;
      if (alpha <= 0.03) continue;

      ctx.globalAlpha = alpha;
      atlas.drawGlyph(ctx, st.char, st.colorKey, false, px, py, 0.84);
    }

    // 2. Ambient shooting stars + Pomodoro Meteor Shower
    for (let i = 0; i < this.shootingStars.length; i++) {
      const s = this.shootingStars[i];
      if (!s.active) continue;
      const lifeT = s.age / s.life;
      const fade = Math.sin(lifeT * Math.PI);
      if (fade <= 0.02) continue;
      ctx.globalAlpha = 0.85 * fade;
      atlas.drawGlyph(ctx, '*', 'starWarm', true, s.x, s.y, 1.0);
      ctx.globalAlpha = 0.45 * fade;
      atlas.drawGlyph(ctx, '·', 'starCool', false, s.x - s.vx * 0.024, s.y - s.vy * 0.024, 0.9);
      ctx.globalAlpha = 0.22 * fade;
      atlas.drawGlyph(ctx, '.', 'starCool', false, s.x - s.vx * 0.048, s.y - s.vy * 0.048, 0.85);
    }

    const meteors = this.meteorPool.items;
    for (let i = 0; i < METEOR_POOL_SIZE; i++) {
      const m = meteors[i];
      if (!m.active) continue;
      const lifeT = m.age / m.life;
      const fade = Math.sin(lifeT * Math.PI);
      if (fade <= 0.03) continue;
      ctx.globalAlpha = 0.95 * fade;
      atlas.drawGlyph(ctx, m.char, pal.core, !ecoActive, m.x, m.y, 1.06);
      ctx.globalAlpha = 0.65 * fade;
      atlas.drawGlyph(ctx, '+', pal.pale, false, m.x - m.vx * 0.018, m.y - m.vy * 0.018, 0.94);
      ctx.globalAlpha = 0.38 * fade;
      atlas.drawGlyph(ctx, '·', pal.gold, false, m.x - m.vx * 0.038, m.y - m.vy * 0.038, 0.88);
      ctx.globalAlpha = 0.18 * fade;
      atlas.drawGlyph(ctx, '.', pal.amber, false, m.x - m.vx * 0.060, m.y - m.vy * 0.060, 0.82);
    }

    // 3. Project background ASCII planets & draw planets behind the black hole distance
    this.projectPlanets();
    const planets = this.projectedPlanets;
    for (let i = 0; i < planets.length; i++) {
      if (planets[i].visible && planets[i].zCam > cam.dist) {
        this.renderPlanet(ctx, atlas, planets[i], time, ecoActive);
      }
    }

    // 4. Pitch-black shadow backdrop inside event horizon aligned with orbiting camera roll
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(cam.roll);
    ctx.scale(1.03, 0.93);
    const holeGrad = ctx.createRadialGradient(0, 0, r0Dyn * 0.55, 0, 0, r0Dyn * 1.06);
    holeGrad.addColorStop(0, 'rgba(1, 1, 3, 0.98)');
    holeGrad.addColorStop(0.84, 'rgba(1, 1, 3, 0.94)');
    holeGrad.addColorStop(1, 'rgba(1, 1, 3, 0)');
    ctx.fillStyle = holeGrad;
    ctx.beginPath();
    ctx.arc(0, 0, r0Dyn * 1.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 4.5 Subtle Einstein-ring gravitational lensing arc when a background planet aligns closely behind BH
    for (let i = 0; i < planets.length; i++) {
      const p = planets[i];
      if (!p.visible || p.zCam <= cam.dist) continue;
      const dxP = p.screenX - cx;
      const dyP = p.screenY - cy;
      const uxP = (dxP * cosR + dyP * sinR) / r0Dyn;
      const vyP = (-dxP * sinR + dyP * cosR) / r0Dyn;
      const rPShadow = Math.hypot(uxP / 1.03, vyP / 0.93);
      if (rPShadow >= 2.65) continue;

      const angP = Math.atan2(vyP / 0.93, uxP / 1.03);
      const strength = smoothstep(2.65, 1.25, rPShadow) * (0.46 + 0.14 * this.flare);
      for (let side = 0; side < 2; side++) {
        const baseAng = side === 0 ? angP : angP + Math.PI;
        const span = side === 0 ? 0.54 : 0.26;
        const sideWeight = (side === 0 ? 1.0 : 0.42) * strength;
        for (let da = -span; da <= span; da += 0.11) {
          const ang = baseAng + da;
          const arcFade = Math.cos((da / span) * Math.PI * 0.48) * sideWeight;
          if (arcFade <= 0.04) continue;
          const uArc = Math.cos(ang) * 1.15 * 1.03 * r0Dyn;
          const vArc = Math.sin(ang) * 1.15 * 0.93 * r0Dyn;
          const pxArc = cx + uArc * cosR - vArc * sinR;
          const pyArc = cy + uArc * sinR + vArc * cosR;
          const chArc = Math.abs(da) < 0.16 ? '~' : Math.abs(da) < 0.34 ? '-' : ':';
          ctx.globalAlpha = arcFade;
          atlas.drawGlyph(ctx, chArc, p.spec.lightKey, !ecoActive && side === 0 && arcFade > 0.25, pxArc, pyArc, 0.85);
        }
      }
    }

    // 5. Dynamic 3D-orbited ASCII Gargantua Black Hole with serene Keplerian spiral motion
    void solarPhase;
    const count = this.cellCount;
    const flareMult = 1 + 0.85 * this.flare;
    const solarBoost = 1.0;
    const emberKey = pal.ember;
    const rustKey = pal.rust;
    const gScale = ecoActive ? this.glyphScale * 1.22 : this.glyphScale;

    const sinE = Math.sin(cam.elev);
    const absSinE = Math.abs(sinE);
    const absTilt = Math.max(0.21, absSinE * 1.15 + 0.16);
    const signedTilt = sinE >= 0 ? absTilt : -absTilt;
    const edgeOnMix = 1.0 - smoothstep(0.0, 0.12, absSinE);
    const invR0Dyn = 1 / r0Dyn;

    for (let i = 0; i < count; i++) {
      if (ecoActive && this.candOdd[i]) continue;
      const dx = this.candDx[i];
      const dy = this.candDy[i];
      const ux = (dx * cosR + dy * sinR) * invR0Dyn;
      const vy = (-dx * sinR + dy * cosR) * invR0Dyn;

      if (Math.abs(ux) > 8.4 || Math.abs(vy) > 3.8) continue;

      const rShadow = Math.hypot(ux / 1.03, vy / 0.93);
      const inside = rShadow < 0.97;

      const signedVy = sinE >= 0 ? vy : -vy;
      const frontHalf = smoothstep(0.04, 0.22, signedVy);
      const edgeOnBand = Math.exp(-(vy * vy) / 0.036) * edgeOnMix;
      const frontStrip = Math.max(frontHalf, edgeOnBand);

      if (inside && frontStrip < 0.06) continue;

      // Equatorial accretion disk centered at (0,0) with continuous Keplerian spiral arms
      const diskNormY = vy / absTilt;
      const diskNormX = ux / 1.18;
      const rDisk = Math.hypot(diskNormX, diskNormY);

      const diskPhi = Math.atan2(vy / signedTilt, diskNormX);
      const worldPhi = diskPhi - cam.azimuth;
      const spiralA = Math.sin(worldPhi * 2.0 - rDisk * 3.6 - time * 0.90);
      const spiralB = Math.sin(worldPhi * 3.0 - rDisk * 5.2 - time * 1.25 + 1.4);
      const dustLane = Math.sin(rDisk * 5.0 - time * 0.45 + worldPhi);
      const diskWave = clamp(0.84 + 0.14 * spiralA + 0.08 * spiralB + 0.05 * dustLane, 0.58, 1.24);

      const diskInner = smoothstep(0.84, 1.16, rDisk);
      const diskOuter =
        Math.exp(-Math.pow(Math.max(0, rDisk - 1.15) / 2.55, 1.48)) *
        smoothstep(6.2, 2.8, rDisk);
      const featherScale = 0.32 + Math.abs(ux) * 0.055 + absTilt * 0.30;
      const featherRatio = vy / featherScale;
      const vertFeather = Math.exp(-(featherRatio * featherRatio));

      const backMask = signedVy < 0.04 ? smoothstep(0.95, 1.32, rShadow) : 1.0;
      const frontEntry = inside ? frontStrip : 1.0;

      const d = diskInner * diskOuter * (0.46 + 0.54 * vertFeather) * backMask * frontEntry * 1.42 * diskWave;

      // Gravitationally lensed upper & lower arches
      const ang = Math.atan2(vy, ux);
      const rDist = Math.hypot(ux, vy);
      const spinRate = 0.72 / (0.65 + rDist * 0.45);
      const phase = time * spinRate;
      const haloWave = 0.86 + 0.14 * Math.sin(ang * 3.0 - time * 0.95 + rDist * 2.8);

      const rHaloTop = Math.hypot(ux / 1.18, (vy + 0.04) / 1.06);
      const topArch =
        vy < 0.16
          ? Math.exp(-((rHaloTop - 1.09) / 0.26) * ((rHaloTop - 1.09) / 0.26)) *
            smoothstep(-0.35, 0.25, -vy) *
            smoothstep(0.95, 1.04, rShadow)
          : 0;

      const rHaloBot = Math.hypot(ux / 1.15, (vy - 0.06) / 1.04);
      const botArch =
        vy > -0.16
          ? Math.exp(-((rHaloBot - 1.07) / 0.22) * ((rHaloBot - 1.07) / 0.22)) *
            smoothstep(-0.35, 0.25, vy) *
            smoothstep(0.95, 1.04, rShadow)
          : 0;

      const topBias = 1.04 + 0.16 * sinE;
      const botBias = 0.92 - 0.16 * sinE;
      const h = Math.max(topArch * topBias, botArch * botBias) * haloWave;

      // Photon ring with orbiting hot spot
      const ringWave = 0.90 + 0.14 * Math.sin(ang * 4.0 - time * 1.20) + 0.12 * Math.sin(ang - time * 0.55);
      const rng =
        Math.exp(-((rShadow - 1.01) / 0.095) * ((rShadow - 1.01) / 0.095)) *
        1.04 *
        smoothstep(0.94, 1.0, rShadow) *
        ringWave;

      // Outer ember aura
      const rAura = Math.hypot(ux / 1.4, vy / (0.62 + absTilt * 0.4));
      const aura =
        Math.exp(-Math.pow(Math.max(0, rAura - 1.02) / 1.75, 1.42)) *
        0.40 *
        smoothstep(0.92, 1.14, rShadow);

      const doppler = 1.0 - 0.15 * Math.tanh(ux * 0.52);

      let heat;
      if (inside) {
        const frontFade = smoothstep(0.08, 0.26, d);
        heat = d * frontFade * doppler * flareMult * solarBoost;
      } else {
        const clampedAura = clamp(aura * 0.55, 0, 1);
        const clampedHalo = clamp(h, 0, 1);
        const screenBlend = 1 - (1 - clampedAura) * (1 - clampedHalo);
        const soft = Math.max(screenBlend, Math.max(d, h));
        const rawHeat = Math.max(soft, rng * 1.06);
        heat = rawHeat * doppler * flareMult * solarBoost;
      }

      heat *= this.candEdgeFade[i];

      if (heat <= 0.04) continue;

      const level = clamp(Math.floor(heat * 3.5), 0, 3);
      const rawIdx = this.candHash[i] + Math.floor(phase * 1.6 + worldPhi * 1.4 + rDisk * 3.2);
      const charIdx = ((rawIdx % 12) + 12) % 12;
      let char = FILL_LEVELS[level][charIdx];

      const isRingDominant = rng > aura * 0.95 && rng > d * 1.25 && rng > h * 1.15 && !inside;
      if (isRingDominant && heat > 0.62 && this.candHash[i] % 4 === 0) {
        char = TANGENT_CHARS[getTangentCharIndex(ux, vy)];
      }

      let colorKey;
      let glowing = false;
      let alpha;

      if (heat < 0.22) {
        colorKey = emberKey;
        alpha = clamp(((heat - 0.04) / 0.18) * 0.48, 0.03, 0.48);
      } else if (heat < 0.40) {
        colorKey = rustKey;
        alpha = 0.54 + (heat - 0.22) * 1.1;
      } else if (heat < 0.62) {
        colorKey = pal.amber;
        alpha = 0.72 + (heat - 0.40) * 0.7;
      } else if (heat < 0.86) {
        colorKey = pal.gold;
        alpha = 0.86 + (heat - 0.62) * 0.4;
      } else if (heat < 1.12) {
        colorKey = pal.pale;
        glowing = !ecoActive;
        alpha = 0.94;
      } else {
        colorKey = pal.core;
        glowing = !ecoActive;
        alpha = 1;
      }

      ctx.globalAlpha = alpha;
      atlas.drawGlyph(ctx, char, colorKey, glowing, this.candX[i], this.candY[i], gScale);
    }

    // 6. Any foreground planets (if zCam <= cam.dist)
    for (let i = 0; i < planets.length; i++) {
      if (planets[i].visible && planets[i].zCam <= cam.dist) {
        this.renderPlanet(ctx, atlas, planets[i], time, ecoActive);
      }
    }

    // 7. Orbiting stardust pulse particles
    const dust = this.stardustPool.items;
    for (let i = 0; i < STARDUST_POOL_SIZE; i++) {
      const p = dust[i];
      if (!p.active) continue;
      const lifeT = p.age / p.life;
      const entry = Math.min(1, p.age * 6);
      const exit = 1 - lifeT * lifeT;
      const alpha = entry * exit * 0.95;
      if (alpha <= 0.03) continue;
      ctx.globalAlpha = alpha;
      atlas.drawGlyph(ctx, p.char, p.colorKey, !ecoActive, p.x, p.y, 0.95 + (1 - lifeT) * 0.2);
    }

    ctx.globalAlpha = 1;
  }
}
