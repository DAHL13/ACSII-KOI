import { BIOME_KEYS, CELL_H, CELL_W } from '../core/constants.js';
import { clamp, dampFactor, randRange } from '../core/math.js';
import { AuroraLayer } from './aurora.js';
import { LilyPadLayer } from './lilies.js';
import { OceanLayer } from './ocean.js';
import { SpaceLayer } from './space.js';
import { GreatWaveLayer } from './wave.js';
import { WeatherLayer } from './weather.js';

export const SOLAR_KEYS = {
  day: {
    causticKey: 'waterCyan',
    causticAltKey: 'waterBlue',
    ripplePrimaryKey: 'waterCyan',
    rippleSecondaryKey: 'waterBlue',
    trailKey: 'waterCyan',
    pelletKey: 'pelletGold',
    rainKey: 'rainDay',
    lilyRimKey: 'lilyRimDay',
    lilyMidKey: 'lilyMidDay',
    lilyVeinKey: 'lilyVeinDay'
  },
  sunset: {
    causticKey: 'waterAmber',
    causticAltKey: 'waterMagenta',
    ripplePrimaryKey: 'waterCyan',
    rippleSecondaryKey: 'waterBlue',
    trailKey: 'waterCyan',
    pelletKey: 'pelletGold',
    rainKey: 'rainSunset',
    lilyRimKey: 'lilyRimSunset',
    lilyMidKey: 'lilyMidSunset',
    lilyVeinKey: 'lilyVeinSunset'
  },
  night: {
    causticKey: 'waterBlue',
    causticAltKey: 'waterCyan',
    ripplePrimaryKey: 'waterCyan',
    rippleSecondaryKey: 'waterBlue',
    trailKey: 'waterCyan',
    pelletKey: 'pelletGold',
    rainKey: 'rainNight',
    lilyRimKey: 'lilyRimNight',
    lilyMidKey: 'lilyMidNight',
    lilyVeinKey: 'lilyVeinNight'
  }
};

const BIOME_SOLAR_THEMES = {
  pond: SOLAR_KEYS,
  ocean: SOLAR_KEYS,
  reef: {
    day: {
      ...SOLAR_KEYS.day,
      causticKey: 'reefTeal',
      causticAltKey: 'reefCoral',
      ripplePrimaryKey: 'reefTeal',
      rippleSecondaryKey: 'reefCoral',
      trailKey: 'reefTeal'
    },
    sunset: {
      ...SOLAR_KEYS.sunset,
      causticKey: 'waterAmber',
      causticAltKey: 'reefCoral',
      ripplePrimaryKey: 'reefCoral',
      rippleSecondaryKey: 'reefTeal',
      trailKey: 'reefCoral'
    },
    night: {
      ...SOLAR_KEYS.night,
      causticKey: 'reefTeal',
      causticAltKey: 'reefCoral',
      ripplePrimaryKey: 'reefTeal',
      rippleSecondaryKey: 'waterCyan',
      trailKey: 'reefTeal'
    }
  },
  winter: {
    day: {
      ...SOLAR_KEYS.day,
      causticKey: 'snowBlue',
      causticAltKey: 'iceCyan',
      ripplePrimaryKey: 'iceCyan',
      rippleSecondaryKey: 'snowBlue',
      trailKey: 'iceCyan',
      rainKey: 'snowBlue'
    },
    sunset: {
      ...SOLAR_KEYS.sunset,
      causticKey: 'snowBlue',
      causticAltKey: 'iceCyan',
      ripplePrimaryKey: 'iceCyan',
      rippleSecondaryKey: 'snowBlue',
      trailKey: 'snowBlue',
      rainKey: 'snowBlue'
    },
    night: {
      ...SOLAR_KEYS.night,
      causticKey: 'snowBlue',
      causticAltKey: 'iceCyan',
      ripplePrimaryKey: 'iceCyan',
      rippleSecondaryKey: 'snowBlue',
      trailKey: 'snowBlue',
      rainKey: 'snowBlue'
    }
  },
  space: {
    day: {
      ...SOLAR_KEYS.day,
      causticKey: 'spaceGold',
      causticAltKey: 'spaceAmber',
      ripplePrimaryKey: 'spaceGold',
      rippleSecondaryKey: 'spaceAmber',
      trailKey: 'spaceAmber',
      pelletKey: 'spaceCore',
      rainKey: 'spacePale'
    },
    sunset: {
      ...SOLAR_KEYS.sunset,
      causticKey: 'spaceGold',
      causticAltKey: 'spaceSunsetOrange',
      ripplePrimaryKey: 'spaceGold',
      rippleSecondaryKey: 'spaceSunsetOrange',
      trailKey: 'spaceSunsetOrange',
      pelletKey: 'spaceCore',
      rainKey: 'spacePale'
    },
    night: {
      ...SOLAR_KEYS.night,
      causticKey: 'spaceGold',
      causticAltKey: 'spaceAmber',
      ripplePrimaryKey: 'spaceGold',
      rippleSecondaryKey: 'spaceAmber',
      trailKey: 'spaceAmber',
      pelletKey: 'spaceCore',
      rainKey: 'starWarm'
    }
  },
  aurora: {
    day: {
      ...SOLAR_KEYS.night,
      causticKey: 'auroraEmerald',
      causticAltKey: 'auroraCyan',
      ripplePrimaryKey: 'auroraEmerald',
      rippleSecondaryKey: 'auroraCyan',
      trailKey: 'auroraCyan',
      pelletKey: 'auroraLime',
      rainKey: 'snowBlue'
    },
    sunset: {
      ...SOLAR_KEYS.night,
      causticKey: 'auroraEmerald',
      causticAltKey: 'auroraViolet',
      ripplePrimaryKey: 'auroraEmerald',
      rippleSecondaryKey: 'auroraViolet',
      trailKey: 'auroraCyan',
      pelletKey: 'auroraLime',
      rainKey: 'snowBlue'
    },
    night: {
      ...SOLAR_KEYS.night,
      causticKey: 'auroraEmerald',
      causticAltKey: 'auroraCyan',
      ripplePrimaryKey: 'auroraEmerald',
      rippleSecondaryKey: 'auroraViolet',
      trailKey: 'auroraCyan',
      pelletKey: 'auroraLime',
      rainKey: 'snowBlue'
    }
  },
  wave: {
    day: {
      ...SOLAR_KEYS.night,
      causticKey: 'waveCerulean',
      causticAltKey: 'waveSeafoam',
      ripplePrimaryKey: 'waveFoamWhite',
      rippleSecondaryKey: 'waveSeafoam',
      trailKey: 'waveFoamIce',
      pelletKey: 'waveWashiCream',
      rainKey: 'waveFoamIce'
    },
    sunset: {
      ...SOLAR_KEYS.night,
      causticKey: 'waveCerulean',
      causticAltKey: 'waveSeafoam',
      ripplePrimaryKey: 'waveFoamWhite',
      rippleSecondaryKey: 'waveSeafoam',
      trailKey: 'waveFoamIce',
      pelletKey: 'waveWashiCream',
      rainKey: 'waveFoamIce'
    },
    night: {
      ...SOLAR_KEYS.night,
      causticKey: 'waveCerulean',
      causticAltKey: 'waveSeafoam',
      ripplePrimaryKey: 'waveFoamWhite',
      rippleSecondaryKey: 'waveSeafoam',
      trailKey: 'waveFoamIce',
      pelletKey: 'waveWashiCream',
      rainKey: 'waveFoamIce'
    }
  }
};

const ZERO_FLOW = (_x, _y, out) => {
  out.vx = 0;
  out.vy = 0;
};

export class PondEcosystem {
  constructor(width, height, options = {}) {
    this.width = width;
    this.height = height;

    this.timeMode = options.timeMode || 'auto';
    this.solarPhase = this.resolveSolarPhase();
    this.biome = BIOME_KEYS.includes(options.biome) ? options.biome : 'pond';
    this.rainEnabled = Boolean(options.rainEnabled);
    this.snowEnabled = Boolean(options.snowEnabled);
    this.liliesEnabled = options.liliesEnabled !== undefined ? Boolean(options.liliesEnabled) : true;
    this.firefliesMode = ['auto', 'on', 'off'].includes(options.firefliesMode) ? options.firefliesMode : 'auto';
    this.obstacleRect = null;
    this.stonesRect = null;
    this._solarCheckAccum = 0;
    this.time = 0;

    this.causticPoints = [];
    this.fireflies = [];

    this.liliesLayer = new LilyPadLayer(width, height);
    this.weatherLayer = new WeatherLayer(width, height, { onPetalLand: options.onPetalLand || null });
    this.oceanLayer = new OceanLayer(width, height, {
      currentsEnabled: options.currentsEnabled,
      planktonEnabled: options.planktonEnabled,
      kelpEnabled: options.kelpEnabled,
      jellyfishEnabled: options.jellyfishEnabled
    });
    this.spaceLayer = new SpaceLayer(width, height, {
      palette: options.spacePalette,
      orbitSpeed: options.spaceOrbitSpeed
    });
    this.auroraLayer = new AuroraLayer(width, height);
    this.waveLayer = new GreatWaveLayer(width, height);

    this.initCaustics();
    this.initFireflies();
    this.weatherLayer.seedRain(this.rainEnabled);
    this.weatherLayer.seedSnow(this.snowEnabled);
  }

  resolveSolarPhase() {
    if (this.timeMode === 'day' || this.timeMode === 'sunset' || this.timeMode === 'night') {
      return this.timeMode;
    }
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    if (mins >= 420 && mins < 1080) return 'day';
    if (mins >= 1080 && mins < 1230) return 'sunset';
    return 'night';
  }

  setTimeMode(mode) {
    this.timeMode = mode;
    this._solarCheckAccum = 0;
    this.solarPhase = this.resolveSolarPhase();
    return this.solarPhase;
  }

  setBiome(biome) {
    const nextBiome = BIOME_KEYS.includes(biome) ? biome : 'pond';
    const wasNonAquatic = this.isNonAquaticBiome();
    this.biome = nextBiome;
    if (this.isNonAquaticBiome()) {
      this.weatherLayer.seedRain(false);
      this.weatherLayer.seedSnow(false);
    } else if (wasNonAquatic) {
      if (this.rainEnabled) this.weatherLayer.seedRain(true);
      if (this.snowEnabled) this.weatherLayer.seedSnow(true);
    }
  }

  isSpaceBiome() {
    return this.biome === 'space';
  }

  isAuroraBiome() {
    return this.biome === 'aurora';
  }

  isWaveBiome() {
    return this.biome === 'wave';
  }

  isNonAquaticBiome() {
    return this.biome === 'space' || this.biome === 'aurora' || this.biome === 'wave';
  }

  setSpacePalette(palette) {
    this.spaceLayer.setPalette(palette);
  }

  setSpaceOrbitSpeed(speed) {
    this.spaceLayer.setOrbitSpeed(speed);
  }

  setPointer(x, y, active) {
    this.spaceLayer.setPointer(x, y, active);
    this.auroraLayer.setPointer(x, y, active);
    this.waveLayer.setPointer(x, y, active);
  }

  triggerSpacePulse(x, y, count = 8) {
    this.spaceLayer.triggerPulse(x, y, count);
  }

  triggerSpaceMultiPulse() {
    this.spaceLayer.triggerMultiPulse();
  }

  triggerAuroraPulse(x, y, count = 10) {
    this.auroraLayer.triggerPulse(x, y, count);
  }

  triggerAuroraMultiPulse() {
    this.auroraLayer.triggerMultiPulse();
  }

  triggerWaveSurge(x, y) {
    this.waveLayer.triggerWaveSurge(x, y);
  }

  triggerWaveSwell() {
    this.waveLayer.triggerGreatSwell();
  }

  setCurrentsEnabled(enabled) {
    this.oceanLayer.currentsEnabled = Boolean(enabled);
  }

  setPlanktonEnabled(enabled) {
    this.oceanLayer.planktonEnabled = Boolean(enabled);
  }

  isPlanktonEnabled() {
    return this.oceanLayer.planktonEnabled;
  }

  setKelpEnabled(enabled) {
    this.oceanLayer.kelpEnabled = Boolean(enabled);
  }

  setJellyfishEnabled(enabled) {
    this.oceanLayer.jellyfishEnabled = Boolean(enabled);
  }

  setRainEnabled(enabled) {
    const next = Boolean(enabled);
    if (next && !this.rainEnabled) {
      this.rainEnabled = true;
      if (!this.isNonAquaticBiome()) {
        this.weatherLayer.seedRain(true);
      }
    } else {
      this.rainEnabled = next;
    }
  }

  setSnowEnabled(enabled) {
    const next = Boolean(enabled);
    if (next && !this.snowEnabled) {
      this.snowEnabled = true;
      if (!this.isNonAquaticBiome()) {
        this.weatherLayer.seedSnow(true);
      }
    } else {
      this.snowEnabled = next;
    }
  }

  setLiliesEnabled(enabled) {
    this.liliesEnabled = Boolean(enabled);
  }

  setFirefliesMode(mode) {
    if (mode === 'auto' || mode === 'on' || mode === 'off') {
      this.firefliesMode = mode;
    }
  }

  isFirefliesActive() {
    if (this.firefliesMode === 'on') return true;
    if (this.firefliesMode === 'off') return false;
    return this.solarPhase === 'night' && !this.isNonAquaticBiome();
  }

  setObstacleRect(rect) {
    this.obstacleRect = rect;
  }

  setStonesRect(rect) {
    this.stonesRect = rect;
  }

  setOnPetalLand(fn) {
    this.weatherLayer.onPetalLand = fn;
  }

  triggerCherryBlossomShower(durationSeconds = 25) {
    if (this.biome === 'space') {
      this.spaceLayer.triggerMeteorShower(durationSeconds);
      return;
    }
    if (this.biome === 'aurora') {
      this.auroraLayer.triggerAuroraSurge(durationSeconds);
      return;
    }
    if (this.biome === 'wave') {
      this.waveLayer.triggerTempestTide(durationSeconds);
      return;
    }
    this.weatherLayer.triggerCherryBlossomShower(durationSeconds);
  }

  findNearestFloatingPetal(x, y, maxDist = 250) {
    return this.weatherLayer.findNearestFloatingPetal(x, y, maxDist);
  }

  spawnPlankton(x, y, vx = 0, vy = 0) {
    this.oceanLayer.spawnPlankton(x, y, vx, vy);
  }

  spawnBubble(x, y, surfaceY) {
    this.oceanLayer.spawnBubble(x, y, surfaceY);
  }

  getLilyCount() {
    return this.liliesLayer.lilies.length;
  }

  testCircleIntersectsLilies(cx, cy, radius, outIndices) {
    if (!this.liliesEnabled) return 0;
    return this.liliesLayer.testCircleIntersects(cx, cy, radius, outIndices);
  }

  isOccludedInList(px, py, indices, count) {
    return this.liliesLayer.isOccludedInList(px, py, indices, count);
  }

  getTheme() {
    if (this.biome === 'space') {
      const pal = this.spaceLayer.getPaletteConfig();
      return {
        ...BIOME_SOLAR_THEMES.space.night,
        causticKey: pal.gold,
        causticAltKey: pal.amber,
        ripplePrimaryKey: pal.gold,
        rippleSecondaryKey: pal.amber,
        trailKey: pal.amber,
        pelletKey: pal.core
      };
    }
    const biomeThemes = BIOME_SOLAR_THEMES[this.biome] || BIOME_SOLAR_THEMES.pond;
    return biomeThemes[this.solarPhase] || biomeThemes.night;
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    this.initCaustics();
    this.liliesLayer.resize(width, height);
    this.weatherLayer.resize(width, height);
    this.oceanLayer.resize(width, height);
    this.spaceLayer.resize(width, height);
    this.auroraLayer.resize(width, height);
    this.waveLayer.resize(width, height);
    if (this.rainEnabled && !this.isNonAquaticBiome()) {
      this.weatherLayer.seedRain(true);
    }
    if (this.snowEnabled) {
      this.weatherLayer.seedSnow(true);
    }
    for (let i = 0; i < this.fireflies.length; i++) {
      const f = this.fireflies[i];
      f.x = clamp(f.x, 16, Math.max(16, width - 16));
      f.y = clamp(f.y, 16, Math.max(16, height - 16));
    }
  }

  initCaustics() {
    const count = Math.max(36, Math.min(72, Math.floor((this.width * this.height) / 26000)));
    this.causticPoints = new Array(count);
    for (let i = 0; i < count; i++) {
      this.causticPoints[i] = {
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: randRange(4, 14),
        vy: randRange(-4, 6),
        phase: randRange(0, Math.PI * 2),
        freq: randRange(0.7, 1.5),
        alt: i % 2 === 1,
        char: i % 3 === 0 ? ':' : '·'
      };
    }
  }

  initFireflies() {
    const count = 24;
    this.fireflies = new Array(count);
    for (let i = 0; i < count; i++) {
      this.fireflies[i] = {
        x: Math.random() * this.width,
        y: Math.random() * this.height,
        vx: randRange(-14, 14),
        vy: randRange(-14, 14),
        phase: randRange(0, Math.PI * 2),
        pulseSpeed: randRange(1.4, 3.0),
        warm: i % 3 === 0
      };
    }
  }

  updateFireflies(dt) {
    if (!this.isFirefliesActive()) return;
    const fireflyDamp = dampFactor(0.975, dt);
    for (let i = 0; i < this.fireflies.length; i++) {
      const f = this.fireflies[i];
      f.vx += randRange(-44, 44) * dt;
      f.vy += randRange(-44, 44) * dt;
      f.vx *= fireflyDamp;
      f.vy *= fireflyDamp;
      const speed = Math.hypot(f.vx, f.vy);
      if (speed > 26) {
        f.vx = (f.vx / speed) * 26;
        f.vy = (f.vy / speed) * 26;
      }
      f.x += f.vx * dt;
      f.y += f.vy * dt;

      if (f.x < 16) {
        f.x = 16;
        f.vx = Math.abs(f.vx);
      } else if (f.x > this.width - 16) {
        f.x = this.width - 16;
        f.vx = -Math.abs(f.vx);
      }
      if (f.y < 16) {
        f.y = 16;
        f.vy = Math.abs(f.vy);
      } else if (f.y > this.height - 16) {
        f.y = this.height - 16;
        f.vy = -Math.abs(f.vy);
      }
    }
  }

  update(dt) {
    this.time += dt;
    if (this.timeMode === 'auto') {
      this._solarCheckAccum += dt;
      if (this._solarCheckAccum >= 15) {
        this._solarCheckAccum = 0;
        this.solarPhase = this.resolveSolarPhase();
      }
    }

    if (this.biome === 'space') {
      this.spaceLayer.update(dt, this.time);
      this.updateFireflies(dt);
      this.weatherLayer.update(dt, this.time, false, ZERO_FLOW, false);
      return;
    }

    if (this.biome === 'aurora') {
      this.auroraLayer.update(dt, this.time);
      this.updateFireflies(dt);
      this.weatherLayer.update(dt, this.time, false, ZERO_FLOW, false);
      return;
    }

    if (this.biome === 'wave') {
      this.waveLayer.update(dt, this.time);
      this.updateFireflies(dt);
      this.weatherLayer.update(dt, this.time, false, ZERO_FLOW, false);
      return;
    }

    for (let i = 0; i < this.causticPoints.length; i++) {
      const c = this.causticPoints[i];
      c.x += c.vx * dt;
      c.y += c.vy * dt + Math.sin(this.time * c.freq + c.phase) * 4 * dt;
      if (c.x > this.width) c.x -= this.width;
      if (c.x < 0) c.x += this.width;
      if (c.y > this.height) c.y -= this.height;
      if (c.y < 0) c.y += this.height;
    }

    if (this.liliesEnabled) {
      this.liliesLayer.update(dt, this.obstacleRect, this.stonesRect);
    }

    this.updateFireflies(dt);

    const boundFlow = (x, y, out) => this.oceanLayer.getFlowAt(x, y, this.time, out);
    this.weatherLayer.update(dt, this.time, this.rainEnabled, boundFlow, this.snowEnabled);
    this.oceanLayer.update(dt, this.time, this.obstacleRect, (x, y) => {
      this.weatherLayer.spawnRainRipple(x, y);
    });
  }

  renderSubaqueous(ctx, atlas, ecoActive = false) {
    if (this.biome === 'space') {
      this.spaceLayer.render(ctx, atlas, this.time, this.solarPhase, ecoActive);
      ctx.globalAlpha = 1;
      return;
    }
    if (this.biome === 'aurora') {
      this.auroraLayer.render(ctx, atlas, this.time, this.solarPhase, ecoActive);
      ctx.globalAlpha = 1;
      return;
    }
    if (this.biome === 'wave') {
      this.waveLayer.render(ctx, atlas, this.time, this.solarPhase, ecoActive);
      ctx.globalAlpha = 1;
      return;
    }

    const theme = this.getTheme();

    if (this.solarPhase === 'day') {
      for (let i = 0; i < this.causticPoints.length; i++) {
        const c = this.causticPoints[i];
        const alpha = 0.09 + 0.09 * Math.sin(this.time * c.freq + c.phase);
        if (alpha <= 0.02) continue;
        const gx = (Math.floor(c.x / CELL_W) + 0.5) * CELL_W;
        const gy = (Math.floor(c.y / CELL_H) + 0.5) * CELL_H;
        ctx.globalAlpha = alpha;
        atlas.drawGlyph(ctx, c.char, theme.causticKey, false, gx, gy);
      }
    } else if (this.solarPhase === 'sunset') {
      for (let i = 0; i < this.causticPoints.length; i++) {
        const c = this.causticPoints[i];
        const alpha = 0.07 + 0.07 * Math.sin(this.time * c.freq + c.phase);
        if (alpha <= 0.02) continue;
        const gx = (Math.floor(c.x / CELL_W) + 0.5) * CELL_W;
        const gy = (Math.floor(c.y / CELL_H) + 0.5) * CELL_H;
        ctx.globalAlpha = alpha;
        atlas.drawGlyph(ctx, c.char, c.alt ? theme.causticAltKey : theme.causticKey, false, gx, gy);
      }
    } else {
      for (let i = 0; i < this.causticPoints.length; i += 2) {
        const c = this.causticPoints[i];
        const alpha = 0.05 + 0.04 * Math.sin(this.time * c.freq + c.phase);
        const gx = (Math.floor(c.x / CELL_W) + 0.5) * CELL_W;
        const gy = (Math.floor(c.y / CELL_H) + 0.5) * CELL_H;
        ctx.globalAlpha = alpha;
        atlas.drawGlyph(ctx, '·', theme.causticKey, false, gx, gy);
      }
    }

    this.oceanLayer.renderSubaqueous(ctx, atlas, this.time, this.solarPhase);
    ctx.globalAlpha = 1;
  }

  renderSurface(ctx, atlas) {
    const theme = this.getTheme();
    if (this.isNonAquaticBiome()) {
      this.weatherLayer.renderSurface(ctx, atlas, theme);
      ctx.globalAlpha = 1;
      return;
    }

    this.oceanLayer.renderSurface(ctx, atlas);
    this.weatherLayer.renderSurface(ctx, atlas, theme);

    if (this.liliesEnabled) {
      this.liliesLayer.render(ctx, atlas, theme, this.solarPhase);
    }

    ctx.globalAlpha = 1;
  }

  renderAtmospheric(ctx, atlas) {
    const theme = this.getTheme();

    if (this.isFirefliesActive()) {
      for (let i = 0; i < this.fireflies.length; i++) {
        const f = this.fireflies[i];
        const pulse = 0.5 + 0.5 * Math.sin(this.time * f.pulseSpeed + f.phase);
        const alpha = 0.28 + pulse * 0.72;
        const char = pulse > 0.72 ? '*' : pulse > 0.36 ? '+' : '·';
        const key = f.warm ? 'fireflyGold' : 'fireflyGreen';

        ctx.globalAlpha = alpha;
        atlas.drawGlyph(ctx, char, key, true, f.x, f.y, 0.9 + pulse * 0.2);
      }
    }

    this.weatherLayer.renderAtmospheric(ctx, atlas, theme);
    ctx.globalAlpha = 1;
  }
}
