(function (global) {
  'use strict';

  const CELL_W = 8.5;
  const CELL_H = 11.5;
  const RAIN_POOL_SIZE = 150;
  const RAIN_RIPPLE_POOL_SIZE = 60;
  const PETAL_POOL_SIZE = 90;
  const PLANKTON_POOL_SIZE = 160;
  const BUBBLE_POOL_SIZE = 70;
  const PETAL_CHARS = ['✿', '❀', '*', '~', '·'];
  const PETAL_COLORS = ['sakuraLight', 'sakuraDeep', 'sakuraPale'];
  const PLANKTON_CHARS = ['·', '*', '+'];
  const BUBBLE_CHARS = ['°', 'o', '·'];

  const SOLAR_KEYS = {
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
      rainKey: 'rainNight',
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

  function clamp(val, min, max) {
    return val < min ? min : val > max ? max : val;
  }

  function randRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function lerpAngle(a, b, t) {
    let diff = b - a;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return a + diff * t;
  }

  class PondEcosystem {
    constructor(width, height, options = {}) {
      this.width = width;
      this.height = height;

      this.timeMode = options.timeMode || 'auto';
      this.solarPhase = this.resolveSolarPhase();
      this.biome = options.biome === 'ocean' ? 'ocean' : 'pond';
      this.rainEnabled = Boolean(options.rainEnabled);
      this.liliesEnabled = options.liliesEnabled !== undefined ? Boolean(options.liliesEnabled) : true;
      this.firefliesMode = ['auto', 'on', 'off'].includes(options.firefliesMode) ? options.firefliesMode : 'auto';
      this.currentsEnabled = Boolean(options.currentsEnabled);
      this.planktonEnabled = Boolean(options.planktonEnabled);
      this.kelpEnabled = Boolean(options.kelpEnabled);
      this.jellyfishEnabled = Boolean(options.jellyfishEnabled);
      this.obstacleRect = null;

      this.time = 0;
      this.lilies = [];
      this.fireflies = [];
      this.causticPoints = [];

      // Pre-allocated Object Pool: 150 raindrops (zero runtime GC)
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

      // Pre-allocated Object Pool: 60 rain surface micro-ripples
      this.rainRipplePool = new Array(RAIN_RIPPLE_POOL_SIZE);
      for (let i = 0; i < RAIN_RIPPLE_POOL_SIZE; i++) {
        this.rainRipplePool[i] = {
          active: false,
          x: 0,
          y: 0,
          age: 0,
          duration: 0.7
        };
      }
      this.rainRippleCursor = 0;

      // Pre-allocated Object Pool: 90 Sakura cherry blossom petals
      this.petalPoolSize = PETAL_POOL_SIZE;
      this.petalPool = new Array(PETAL_POOL_SIZE);
      for (let i = 0; i < PETAL_POOL_SIZE; i++) {
        this.petalPool[i] = {
          active: false,
          state: 0, // 0 = falling, 1 = floating on surface
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
        };
      }
      this.petalCursor = 0;
      this.cherryShowerRemaining = 0;
      this.cherryEmitAccumulator = 0;
      this.onPetalLand = options.onPetalLand || null;

      // Pre-allocated Object Pool: 160 Bioluminescent Plankton Sparks
      this.planktonPool = new Array(PLANKTON_POOL_SIZE);
      for (let i = 0; i < PLANKTON_POOL_SIZE; i++) {
        this.planktonPool[i] = {
          active: false,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          age: 0,
          life: 0.9,
          char: '·',
          colorKey: 'planktonCyan'
        };
      }
      this.planktonCursor = 0;

      // Pre-allocated Object Pool: 70 Rising Bubbles
      this.bubblePool = new Array(BUBBLE_POOL_SIZE);
      for (let i = 0; i < BUBBLE_POOL_SIZE; i++) {
        this.bubblePool[i] = {
          active: false,
          x: 0,
          y: 0,
          vy: -36,
          surfaceY: 40,
          age: 0,
          wobblePhase: 0,
          wobbleFreq: 3,
          char: '°'
        };
      }
      this.bubbleCursor = 0;
      this.bubbleEmitAccum = 0;

      this.currentParticles = [];
      this.sunRays = [];
      this.kelpStalks = [];
      this.jellyfish = [];
      this._flowVec = { vx: 0, vy: 0 };

      this.initCaustics();
      this.initLilies();
      this.initFireflies();
      this.initCurrentsAndRays();
      this.initKelp();
      this.initJellyfish();
      this.seedRainPool();
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
      this.solarPhase = this.resolveSolarPhase();
      return this.solarPhase;
    }

    setBiome(biome) {
      this.biome = biome === 'ocean' ? 'ocean' : 'pond';
    }

    setCurrentsEnabled(enabled) {
      this.currentsEnabled = Boolean(enabled);
    }

    setPlanktonEnabled(enabled) {
      this.planktonEnabled = Boolean(enabled);
    }

    setKelpEnabled(enabled) {
      this.kelpEnabled = Boolean(enabled);
    }

    setJellyfishEnabled(enabled) {
      this.jellyfishEnabled = Boolean(enabled);
    }

    setRainEnabled(enabled) {
      const next = Boolean(enabled);
      if (next && !this.rainEnabled) {
        this.rainEnabled = true;
        this.seedRainPool();
      } else {
        this.rainEnabled = next;
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
      return this.solarPhase === 'night';
    }

    setObstacleRect(rect) {
      this.obstacleRect = rect;
    }

    resize(width, height) {
      this.width = width;
      this.height = height;
      this.initCaustics();
      this.initCurrentsAndRays();
      this.initKelp();
      if (this.rainEnabled) {
        this.seedRainPool();
      }
      for (let i = 0; i < this.lilies.length; i++) {
        const l = this.lilies[i];
        l.x = clamp(l.x, l.radius + 10, Math.max(l.radius + 20, width - l.radius - 10));
        l.y = clamp(l.y, l.radius + 10, Math.max(l.radius + 20, height - l.radius - 10));
      }
    }

    getTheme() {
      return SOLAR_KEYS[this.solarPhase] || SOLAR_KEYS.night;
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

    initLilies() {
      const count = 4 + Math.floor(Math.random() * 4);
      this.lilies = new Array(count);
      const padMargin = 75;

      for (let i = 0; i < count; i++) {
        const radius = randRange(40, 64);
        let x = randRange(padMargin, Math.max(padMargin + 20, this.width - padMargin));
        let y = randRange(padMargin, Math.max(padMargin + 20, this.height - padMargin));

        for (let attempt = 0; attempt < 18; attempt++) {
          let overlaps = false;
          for (let j = 0; j < i; j++) {
            const o = this.lilies[j];
            if (Math.hypot(x - o.x, y - o.y) < radius + o.radius + 22) {
              overlaps = true;
              break;
            }
          }
          if (!overlaps) break;
          x = randRange(padMargin, Math.max(padMargin + 20, this.width - padMargin));
          y = randRange(padMargin, Math.max(padMargin + 20, this.height - padMargin));
        }

        const speed = randRange(4.5, 10.5);
        const dir = randRange(0, Math.PI * 2);

        this.lilies[i] = {
          x,
          y,
          vx: Math.cos(dir) * speed,
          vy: Math.sin(dir) * speed,
          radius,
          angle: randRange(0, Math.PI * 2),
          angVel: randRange(-0.07, 0.07),
          notchHalfAngle: randRange(0.24, 0.34),
          hasFlower: i < 3 ? i % 2 === 0 : Math.random() < 0.45,
          flowerTone: Math.random() < 0.6 ? 'pink' : 'white',
          flowerOffsetAngle: randRange(0, Math.PI * 2)
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
      // Place swaying kelp cleanly in bottom-left, bottom-right, and far side margins
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
          scale: randRange(0.85, 1.15),
          depth: randRange(0.55, 0.82)
        };
      }
    }

    getFlowAt(x, y, out) {
      if (!this.currentsEnabled) {
        out.vx = 0;
        out.vy = 0;
        return out;
      }
      out.vx = 24 + 10 * Math.sin(y * 0.004 + this.time * 0.4);
      out.vy = 5 * Math.cos(x * 0.003 + this.time * 0.28);
      return out;
    }

    spawnPlankton(x, y, vx = 0, vy = 0) {
      if (!this.planktonEnabled) return;
      let slot = null;
      for (let i = 0; i < PLANKTON_POOL_SIZE; i++) {
        const idx = (this.planktonCursor + i) % PLANKTON_POOL_SIZE;
        if (!this.planktonPool[idx].active) {
          slot = this.planktonPool[idx];
          this.planktonCursor = (idx + 1) % PLANKTON_POOL_SIZE;
          break;
        }
      }
      if (!slot) {
        slot = this.planktonPool[this.planktonCursor];
        this.planktonCursor = (this.planktonCursor + 1) % PLANKTON_POOL_SIZE;
      }
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
      let slot = null;
      for (let i = 0; i < BUBBLE_POOL_SIZE; i++) {
        const idx = (this.bubbleCursor + i) % BUBBLE_POOL_SIZE;
        if (!this.bubblePool[idx].active) {
          slot = this.bubblePool[idx];
          this.bubbleCursor = (idx + 1) % BUBBLE_POOL_SIZE;
          break;
        }
      }
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

    seedRainPool() {
      const activeTarget = Math.min(RAIN_POOL_SIZE, Math.max(45, Math.floor(this.width / 18)));
      for (let i = 0; i < RAIN_POOL_SIZE; i++) {
        if (this.rainEnabled && i < activeTarget) {
          this.resetRainDrop(this.rainPool[i], true);
        } else {
          this.rainPool[i].active = false;
        }
      }
    }

    spawnRainRipple(x, y) {
      let slot = null;
      for (let i = 0; i < RAIN_RIPPLE_POOL_SIZE; i++) {
        const idx = (this.rainRippleCursor + i) % RAIN_RIPPLE_POOL_SIZE;
        if (!this.rainRipplePool[idx].active) {
          slot = this.rainRipplePool[idx];
          this.rainRippleCursor = (idx + 1) % RAIN_RIPPLE_POOL_SIZE;
          break;
        }
      }
      if (!slot) {
        slot = this.rainRipplePool[this.rainRippleCursor];
        this.rainRippleCursor = (this.rainRippleCursor + 1) % RAIN_RIPPLE_POOL_SIZE;
      }
      slot.active = true;
      slot.x = x;
      slot.y = y;
      slot.age = 0;
      slot.duration = randRange(0.55, 0.85);
    }

    setOnPetalLand(fn) {
      this.onPetalLand = fn;
    }

    triggerCherryBlossomShower(durationSeconds = 25) {
      this.cherryShowerRemaining = Math.max(this.cherryShowerRemaining, durationSeconds);
      for (let i = 0; i < 16; i++) {
        this.spawnFallingPetal(true);
      }
    }

    spawnFallingPetal(staggerY = false) {
      let slot = null;
      for (let i = 0; i < PETAL_POOL_SIZE; i++) {
        const idx = (this.petalCursor + i) % PETAL_POOL_SIZE;
        if (!this.petalPool[idx].active) {
          slot = this.petalPool[idx];
          this.petalCursor = (idx + 1) % PETAL_POOL_SIZE;
          break;
        }
      }
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

    // Broad-phase Bounding Circle intersection against lily pads (zero allocations)
    testCircleIntersectsLilies(cx, cy, radius, outIndices) {
      if (!this.liliesEnabled || this.lilies.length === 0) return 0;
      let hitCount = 0;
      for (let i = 0; i < this.lilies.length; i++) {
        const l = this.lilies[i];
        const sumR = radius + l.radius * 1.04;
        const dx = cx - l.x;
        const dy = cy - l.y;
        if (dx * dx + dy * dy <= sumR * sumR) {
          outIndices[hitCount++] = i;
        }
      }
      return hitCount;
    }

    // Narrow-phase check only against intersecting lily pads, respecting V-notch
    isOccludedInList(px, py, indices, count) {
      for (let i = 0; i < count; i++) {
        const l = this.lilies[indices[i]];
        const dx = px - l.x;
        const dy = py - l.y;
        const maxR = l.radius * 1.02;
        if (dx * dx + dy * dy > maxR * maxR) continue;

        const cos = Math.cos(-l.angle);
        const sin = Math.sin(-l.angle);
        const lx = dx * cos - dy * sin;
        const ly = dx * sin + dy * cos;
        const theta = Math.atan2(ly, lx);
        if (Math.abs(theta) < l.notchHalfAngle) {
          continue;
        }
        return true;
      }
      return false;
    }

    update(dt) {
      this.time += dt;
      if (this.timeMode === 'auto') {
        this.solarPhase = this.resolveSolarPhase();
      }

      // 1. Caustics
      for (let i = 0; i < this.causticPoints.length; i++) {
        const c = this.causticPoints[i];
        c.x += c.vx * dt;
        c.y += c.vy * dt + Math.sin(this.time * c.freq + c.phase) * 4 * dt;
        if (c.x > this.width) c.x -= this.width;
        if (c.x < 0) c.x += this.width;
        if (c.y > this.height) c.y -= this.height;
        if (c.y < 0) c.y += this.height;
      }

      // 2. Lily pads drift & elastic bounce
      if (this.liliesEnabled) {
        this.updateLilies(dt);
      }

      // 3. Fireflies (Brownian motion when active)
      if (this.isFirefliesActive()) {
        for (let i = 0; i < this.fireflies.length; i++) {
          const f = this.fireflies[i];
          f.vx += randRange(-44, 44) * dt;
          f.vy += randRange(-44, 44) * dt;
          f.vx *= 0.975;
          f.vy *= 0.975;
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

      // 4. Pooled Raindrops
      for (let i = 0; i < RAIN_POOL_SIZE; i++) {
        const d = this.rainPool[i];
        if (!d.active) continue;

        d.x += d.vx * dt;
        d.y += d.vy * dt;
        if (d.y >= d.impactY) {
          if (d.x >= 0 && d.x <= this.width) {
            this.spawnRainRipple(d.x, d.impactY);
          }
          if (this.rainEnabled) {
            this.resetRainDrop(d, false);
          } else {
            d.active = false;
          }
        }
      }

      // 5. Pooled Rain micro-ripples
      for (let i = 0; i < RAIN_RIPPLE_POOL_SIZE; i++) {
        const r = this.rainRipplePool[i];
        if (!r.active) continue;
        r.age += dt;
        if (r.age >= r.duration) {
          r.active = false;
        }
      }

      // 6. Pooled Sakura Cherry Blossoms (falling + floating)
      if (this.cherryShowerRemaining > 0) {
        this.cherryShowerRemaining = Math.max(0, this.cherryShowerRemaining - dt);
        this.cherryEmitAccumulator += dt;
        while (this.cherryEmitAccumulator >= 0.14) {
          this.cherryEmitAccumulator -= 0.14;
          this.spawnFallingPetal(false);
        }
      }

      for (let i = 0; i < PETAL_POOL_SIZE; i++) {
        const p = this.petalPool[i];
        if (!p.active) continue;

        p.age += dt;
        if (p.state === 0) {
          // Falling with gentle sinusoidal sway
          p.x += (p.vx + Math.sin(this.time * p.swayFreq + p.swayPhase) * p.swayAmp) * dt;
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
          // Floating gently on pond surface before fading out
          this.getFlowAt(p.x, p.y, this._flowVec);
          p.x += (p.vx + this._flowVec.vx * 0.28 + Math.sin(this.time * 0.8 + p.swayPhase) * 2.5) * dt;
          p.y += (p.vy + this._flowVec.vy * 0.28) * dt;
          p.vx *= 0.992;
          p.vy *= 0.992;

          if (p.age >= p.floatLife) {
            p.active = false;
          }
        }
      }

      // 7. Ocean Currents & Sun Rays
      if (this.currentsEnabled) {
        for (let i = 0; i < this.currentParticles.length; i++) {
          const cp = this.currentParticles[i];
          this.getFlowAt(cp.x, cp.y, this._flowVec);
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

      // 8. Deep-Sea Jellyfish rhythmic propulsion
      if (this.jellyfishEnabled) {
        for (let i = 0; i < this.jellyfish.length; i++) {
          const j = this.jellyfish[i];
          j.pulsePhase += j.pulseSpeed * dt;
          const thrust = Math.pow(Math.max(0, Math.sin(j.pulsePhase)), 2);
          const targetSpd = 6 + thrust * 24;
          j.heading += Math.sin(this.time * 0.4 + i * 2.1) * 0.22 * dt;

          // Keep softly inside viewport & away from central search box
          const margin = 95;
          if (j.x < margin) j.heading = lerpAngle(j.heading, 0, dt * 1.2);
          else if (j.x > this.width - margin) j.heading = lerpAngle(j.heading, Math.PI, dt * 1.2);
          if (j.y < margin) j.heading = lerpAngle(j.heading, Math.PI * 0.5, dt * 1.2);
          else if (j.y > this.height - margin) j.heading = lerpAngle(j.heading, -Math.PI * 0.5, dt * 1.2);

          j.vx = j.vx * 0.95 + Math.cos(j.heading) * targetSpd * 0.05;
          j.vy = j.vy * 0.95 + Math.sin(j.heading) * targetSpd * 0.05;
          this.getFlowAt(j.x, j.y, this._flowVec);
          j.x += (j.vx + this._flowVec.vx * 0.25) * dt;
          j.y += (j.vy + this._flowVec.vy * 0.25) * dt;
        }
      }

      // 9. Pooled Bioluminescent Plankton & Rising Bubbles
      if (this.planktonEnabled) {
        this.bubbleEmitAccum += dt;
        if (this.bubbleEmitAccum >= 0.26) {
          this.bubbleEmitAccum = 0;
          const bx = randRange(30, Math.max(60, this.width - 30));
          const by = randRange(this.height * 0.55, this.height - 20);
          this.spawnBubble(bx, by, randRange(this.height * 0.08, by - 50));
        }
      }

      for (let i = 0; i < PLANKTON_POOL_SIZE; i++) {
        const pl = this.planktonPool[i];
        if (!pl.active) continue;
        pl.age += dt;
        if (pl.age >= pl.life) {
          pl.active = false;
          continue;
        }
        this.getFlowAt(pl.x, pl.y, this._flowVec);
        pl.x += (pl.vx + this._flowVec.vx * 0.45) * dt;
        pl.y += (pl.vy + this._flowVec.vy * 0.45) * dt;
        pl.vx *= 0.94;
        pl.vy *= 0.94;
      }

      for (let i = 0; i < BUBBLE_POOL_SIZE; i++) {
        const b = this.bubblePool[i];
        if (!b.active) continue;
        b.age += dt;
        this.getFlowAt(b.x, b.y, this._flowVec);
        b.x += (Math.sin(b.age * b.wobbleFreq + b.wobblePhase) * 14 + this._flowVec.vx * 0.35) * dt;
        b.y += b.vy * dt;
        if (b.y <= b.surfaceY || b.y < 14) {
          b.active = false;
          if (b.x > 10 && b.x < this.width - 10) {
            this.spawnRainRipple(b.x, b.y);
          }
        }
      }
    }

    updateLilies(dt) {
      const margin = 12;
      for (let i = 0; i < this.lilies.length; i++) {
        const l = this.lilies[i];
        l.x += l.vx * dt;
        l.y += l.vy * dt;
        l.angle += l.angVel * dt;

        const speed = Math.hypot(l.vx, l.vy);
        if (speed > 13) {
          l.vx *= 0.99;
          l.vy *= 0.99;
        } else if (speed < 3.5) {
          l.vx += randRange(-1.5, 1.5) * dt;
          l.vy += randRange(-1.5, 1.5) * dt;
        }

        if (l.x - l.radius < margin) {
          l.x = margin + l.radius;
          l.vx = Math.abs(l.vx);
          l.angVel = -l.angVel;
        } else if (l.x + l.radius > this.width - margin) {
          l.x = this.width - margin - l.radius;
          l.vx = -Math.abs(l.vx);
          l.angVel = -l.angVel;
        }

        if (l.y - l.radius < margin) {
          l.y = margin + l.radius;
          l.vy = Math.abs(l.vy);
        } else if (l.y + l.radius > this.height - margin) {
          l.y = this.height - margin - l.radius;
          l.vy = -Math.abs(l.vy);
        }

        if (this.obstacleRect && this.obstacleRect.width > 0) {
          const pad = 16;
          const r = this.obstacleRect;
          const closestX = clamp(l.x, r.left - pad, r.right + pad);
          const closestY = clamp(l.y, r.top - pad, r.bottom + pad);
          const dx = l.x - closestX;
          const dy = l.y - closestY;
          const dist = Math.hypot(dx, dy);

          if (dist < l.radius) {
            const nx = dist > 0.001 ? dx / dist : 0;
            const ny = dist > 0.001 ? dy / dist : -1;
            const overlap = l.radius - dist;
            l.x += nx * overlap;
            l.y += ny * overlap;

            const vn = l.vx * nx + l.vy * ny;
            if (vn < 0) {
              l.vx -= 1.85 * vn * nx;
              l.vy -= 1.85 * vn * ny;
            }
          }
        }
      }

      for (let i = 0; i < this.lilies.length; i++) {
        for (let j = i + 1; j < this.lilies.length; j++) {
          const a = this.lilies[i];
          const b = this.lilies[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const minDist = a.radius + b.radius + 4;
          const distSq = dx * dx + dy * dy;

          if (distSq < minDist * minDist && distSq > 0.0001) {
            const dist = Math.sqrt(distSq);
            const nx = dx / dist;
            const ny = dy / dist;
            const overlap = (minDist - dist) * 0.5;

            a.x -= nx * overlap;
            a.y -= ny * overlap;
            b.x += nx * overlap;
            b.y += ny * overlap;

            const dvx = a.vx - b.vx;
            const dvy = a.vy - b.vy;
            const relVel = dvx * nx + dvy * ny;

            if (relVel > 0) {
              const impulse = relVel * 0.92;
              a.vx -= impulse * nx;
              a.vy -= impulse * ny;
              b.vx += impulse * nx;
              b.vy += impulse * ny;
            }
          }
        }
      }
    }

    renderSubaqueous(ctx, atlas) {
      const theme = this.getTheme();

      // 1. Caustics
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

      // 2. Ocean Currents & Subtle Sun Rays
      if (this.currentsEnabled) {
        for (let i = 0; i < this.currentParticles.length; i++) {
          const cp = this.currentParticles[i];
          const alpha = 0.09 + 0.08 * Math.sin(this.time * 1.4 + cp.phase);
          if (alpha <= 0.02) continue;
          const gx = (Math.floor(cp.x / CELL_W) + 0.5) * CELL_W;
          const gy = (Math.floor(cp.y / CELL_H) + 0.5) * CELL_H;
          ctx.globalAlpha = alpha;
          atlas.drawGlyph(ctx, cp.char, cp.deep ? 'currentDeep' : 'currentTeal', false, gx, gy);
        }

        if (this.solarPhase === 'day' || this.solarPhase === 'sunset') {
          const rayKey = this.solarPhase === 'day' ? 'waterCyan' : 'waterAmber';
          for (let i = 0; i < this.sunRays.length; i++) {
            const sr = this.sunRays[i];
            const rayPulse = 0.045 + 0.035 * Math.sin(this.time * 0.7 + sr.phase);
            ctx.globalAlpha = rayPulse;
            for (let k = 0; k < sr.len; k++) {
              atlas.drawGlyph(ctx, '/', rayKey, false, sr.x - k * CELL_W * 1.4, sr.y + k * CELL_H * 1.8);
            }
          }
        }
      }

      // 3. Swaying Marginal Kelp / Seaweed
      if (this.kelpEnabled) {
        ctx.globalAlpha = this.solarPhase === 'night' ? 0.55 : 0.72;
        for (let i = 0; i < this.kelpStalks.length; i++) {
          const st = this.kelpStalks[i];
          for (let k = 0; k < st.segments; k++) {
            const ratio = k / st.segments;
            const sway = Math.sin(this.time * 1.45 + st.phase + k * 0.48) * st.swayAmp * ratio;
            const kx = st.baseX + sway;
            const ky = st.baseY - k * st.segLen - 6;
            const char = k === st.segments - 1 ? '~' : sway > 2.5 ? ')' : sway < -2.5 ? '(' : '|';
            const colorKey = ratio < 0.35 ? 'kelpDark' : ratio < 0.75 ? 'kelpMid' : 'kelpTip';
            atlas.drawGlyph(ctx, char, colorKey, false, kx, ky);
          }
        }
      }

      // 4. Deep-Sea Luminous Jellyfish
      if (this.jellyfishEnabled) {
        for (let i = 0; i < this.jellyfish.length; i++) {
          this.renderSingleJellyfish(ctx, atlas, this.jellyfish[i]);
        }
      }

      ctx.globalAlpha = 1;
    }

    renderSingleJellyfish(ctx, atlas, j) {
      const cos = Math.cos(j.heading);
      const sin = Math.sin(j.heading);
      const rx = -sin;
      const ry = cos;
      const contract = Math.sin(j.pulsePhase);
      const bellW = (17 - contract * 4.5) * j.scale;
      const baseAlpha = 0.52 + 0.16 * (1 - contract * 0.5);

      // Bell Dome
      ctx.globalAlpha = baseAlpha;
      atlas.drawGlyph(ctx, '@', 'jellyBell', true, j.x + cos * 6 * j.scale, j.y + sin * 6 * j.scale, 1.05);
      atlas.drawGlyph(ctx, '#', 'jellyBell', true, j.x, j.y);
      atlas.drawGlyph(ctx, '(', 'jellyRim', true, j.x - rx * bellW * 0.55, j.y - ry * bellW * 0.55);
      atlas.drawGlyph(ctx, ')', 'jellyRim', true, j.x + rx * bellW * 0.55, j.y + ry * bellW * 0.55);
      atlas.drawGlyph(ctx, '*', 'jellyRim', true, j.x - rx * bellW * 0.28 + cos * 4, j.y - ry * bellW * 0.28 + sin * 4);
      atlas.drawGlyph(ctx, '*', 'jellyRim', true, j.x + rx * bellW * 0.28 + cos * 4, j.y + ry * bellW * 0.28 + sin * 4);

      // 4 Trailing Undulating Tentacles
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
      const theme = this.getTheme();

      // 0. Bioluminescent Plankton Sparks & Rising Bubbles
      for (let i = 0; i < PLANKTON_POOL_SIZE; i++) {
        const pl = this.planktonPool[i];
        if (!pl.active) continue;
        const lifeT = pl.age / pl.life;
        const alpha = (1 - lifeT) * (0.65 + 0.35 * Math.sin(pl.age * 14));
        if (alpha <= 0.03) continue;
        ctx.globalAlpha = alpha;
        atlas.drawGlyph(ctx, pl.char, pl.colorKey, true, pl.x, pl.y, 0.9 + (1 - lifeT) * 0.2);
      }

      for (let i = 0; i < BUBBLE_POOL_SIZE; i++) {
        const b = this.bubblePool[i];
        if (!b.active) continue;
        const fade = Math.min(1, b.age * 3);
        ctx.globalAlpha = 0.55 * fade;
        atlas.drawGlyph(ctx, b.char, 'bubblePearl', false, b.x, b.y, 0.85);
      }

      // 1. Pooled Rain micro-ripples: ( ) -> (   )
      for (let i = 0; i < RAIN_RIPPLE_POOL_SIZE; i++) {
        const r = this.rainRipplePool[i];
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

      // 2. Pooled Floating Sakura Petals on water surface
      for (let i = 0; i < PETAL_POOL_SIZE; i++) {
        const p = this.petalPool[i];
        if (!p.active || p.state !== 1) continue;
        const fadeOut = p.age > p.floatLife - 3 ? Math.max(0, (p.floatLife - p.age) / 3) : 1;
        if (fadeOut <= 0.02) continue;
        ctx.globalAlpha = 0.88 * fadeOut;
        atlas.drawGlyph(ctx, p.char, p.colorKey, true, p.x, p.y, p.scale);
      }

      // 3. ASCII Lily Pads (zero-allocation direct draw)
      if (!this.liliesEnabled) {
        ctx.globalAlpha = 1;
        return;
      }

      const padAlpha = this.solarPhase === 'night' ? 0.85 : 0.95;
      const flowerGlow = this.solarPhase === 'night';

      for (let i = 0; i < this.lilies.length; i++) {
        this.renderLilyPad(ctx, atlas, this.lilies[i], theme, padAlpha, flowerGlow);
      }

      ctx.globalAlpha = 1;
    }

    renderLilyPad(ctx, atlas, lily, theme, padAlpha, flowerGlow) {
      const pad = lily.radius;
      const maxRSq = pad * 1.06 * (pad * 1.06);
      const startCol = Math.floor((lily.x - pad - CELL_W) / CELL_W);
      const endCol = Math.ceil((lily.x + pad + CELL_W) / CELL_W);
      const startRow = Math.floor((lily.y - pad - CELL_H) / CELL_H);
      const endRow = Math.ceil((lily.y + pad + CELL_H) / CELL_H);

      const cos = Math.cos(-lily.angle);
      const sin = Math.sin(-lily.angle);
      const petalKey =
        lily.flowerTone === 'pink'
          ? this.solarPhase === 'night'
            ? 'lotusPinkDeep'
            : 'lotusPink'
          : 'lotusWhite';

      ctx.globalAlpha = padAlpha;

      for (let row = startRow; row <= endRow; row++) {
        const py = (row + 0.5) * CELL_H;
        const dy = py - lily.y;
        for (let col = startCol; col <= endCol; col++) {
          const px = (col + 0.5) * CELL_W;
          const dx = px - lily.x;

          const rSq = dx * dx + dy * dy;
          if (rSq > maxRSq) continue;

          const lx = dx * cos - dy * sin;
          const ly = dx * sin + dy * cos;
          const theta = Math.atan2(ly, lx);

          if (Math.abs(theta) < lily.notchHalfAngle) continue;

          const r = Math.sqrt(rSq);
          const nr = r / pad;
          const organicEdge = 1.0 + 0.04 * Math.sin(theta * 7);
          if (nr > organicEdge) continue;

          if (lily.hasFlower && nr < 0.34) {
            const petalShape = 0.25 + 0.09 * Math.cos((theta - lily.flowerOffsetAngle) * 6);
            if (nr < 0.1) {
              atlas.drawGlyph(ctx, nr < 0.05 ? '@' : '*', 'lotusStamen', true, px, py);
              continue;
            }
            if (nr < petalShape) {
              const pChar = nr < 0.18 ? '@' : nr < 0.26 ? '*' : '+';
              atlas.drawGlyph(ctx, pChar, petalKey, flowerGlow, px, py);
              continue;
            }
          }

          if (nr > 0.87) {
            atlas.drawGlyph(ctx, nr > 0.94 ? '.' : '~', theme.lilyRimKey, false, px, py);
          } else if (Math.abs(Math.sin(theta * 8)) > 0.93 && nr > 0.2) {
            atlas.drawGlyph(ctx, nr < 0.55 ? '@' : '#', theme.lilyVeinKey, false, px, py);
          } else {
            const char = nr < 0.35 ? '@' : nr < 0.62 ? '#' : nr < 0.78 ? '%' : '~';
            atlas.drawGlyph(ctx, char, theme.lilyMidKey, false, px, py);
          }
        }
      }
    }

    renderAtmospheric(ctx, atlas) {
      const theme = this.getTheme();

      // 1. Fireflies (*, +, ·)
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

      // 2. Pooled Diagonal Raindrops (|, /, ')
      for (let i = 0; i < RAIN_POOL_SIZE; i++) {
        const d = this.rainPool[i];
        if (!d.active) continue;
        ctx.globalAlpha = d.alpha;
        atlas.drawGlyph(ctx, d.char, theme.rainKey, false, d.x, d.y);
      }

      // 3. Pooled Falling Sakura Petals (✿, ❀, *, ~, ·)
      for (let i = 0; i < PETAL_POOL_SIZE; i++) {
        const p = this.petalPool[i];
        if (!p.active || p.state !== 0) continue;
        const entryFade = Math.min(1, p.age * 2.5);
        ctx.globalAlpha = 0.92 * entryFade;
        atlas.drawGlyph(ctx, p.char, p.colorKey, true, p.x, p.y, p.scale);
      }

      ctx.globalAlpha = 1;
    }
  }

  global.PondEcosystem = PondEcosystem;
})(window);
