(function (global) {
  'use strict';

  const CELL_W = 8.5;
  const CELL_H = 11.5;
  const RAIN_POOL_SIZE = 150;
  const RAIN_RIPPLE_POOL_SIZE = 60;
  const PETAL_POOL_SIZE = 90;
  const PETAL_CHARS = ['✿', '❀', '*', '~', '·'];
  const PETAL_COLORS = ['sakuraLight', 'sakuraDeep', 'sakuraPale'];

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
      ripplePrimaryKey: 'waterAmber',
      rippleSecondaryKey: 'waterMagenta',
      trailKey: 'waterAmber',
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

  function clamp(val, min, max) {
    return val < min ? min : val > max ? max : val;
  }

  function randRange(min, max) {
    return min + Math.random() * (max - min);
  }

  class PondEcosystem {
    constructor(width, height, options = {}) {
      this.width = width;
      this.height = height;

      this.timeMode = options.timeMode || 'auto';
      this.solarPhase = this.resolveSolarPhase();
      this.rainEnabled = Boolean(options.rainEnabled);
      this.liliesEnabled = options.liliesEnabled !== undefined ? Boolean(options.liliesEnabled) : true;
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

      this.initCaustics();
      this.initLilies();
      this.initFireflies();
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

    setObstacleRect(rect) {
      this.obstacleRect = rect;
    }

    resize(width, height) {
      this.width = width;
      this.height = height;
      this.initCaustics();
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
      this.fireflies = new Array(20);
      for (let i = 0; i < 20; i++) {
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

      // 3. Fireflies (Night Brownian motion)
      if (this.solarPhase === 'night') {
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
          p.x += (p.vx + Math.sin(this.time * 0.8 + p.swayPhase) * 2.5) * dt;
          p.y += p.vy * dt;
          p.vx *= 0.992;
          p.vy *= 0.992;

          if (p.age >= p.floatLife) {
            p.active = false;
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
      ctx.globalAlpha = 1;
    }

    renderSurface(ctx, atlas) {
      const theme = this.getTheme();

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

      // 1. Night Fireflies (*, +, ·)
      if (this.solarPhase === 'night') {
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
