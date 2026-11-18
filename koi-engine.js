(function (global) {
  'use strict';

  const DENSITY_CHARS = ['@', '#', '%', '*', '+', ':', '.'];
  const RIPPLE_CHARS = ['*', '+', ':', '~', '·'];
  const CELL_W = 8.5;
  const CELL_H = 11.5;

  const RIPPLE_POOL_SIZE = 60;
  const FOOD_POOL_SIZE = 30;
  const TRAIL_POOL_SIZE = 140;
  const BAIT_POOL_SIZE = 45;

  const VARIETY_COLOR_KEYS = {
    kohaku: { base: 'kohakuWhite', spotA: 'vermilion', spotB: 'crimson', fin: 'kohakuFin', eye: 'eyeDark' },
    yamabuki: { base: 'goldOgon', spotA: 'goldHighlight', spotB: 'goldOgon', fin: 'goldFin', eye: 'eyeDark' },
    showa: { base: 'sumiCharcoal', spotA: 'vermilion', spotB: 'tanchoWhite', fin: 'sumiFin', eye: 'eyeDark' },
    asagi: { base: 'asagiBlue', spotA: 'asagiOrange', spotB: 'asagiLight', fin: 'asagiOrange', eye: 'eyeDark' },
    tancho: { base: 'tanchoWhite', spotA: 'crimson', spotB: 'tanchoWhite', fin: 'kohakuFin', eye: 'eyeDark' },
    butterfly: { base: 'ghostCyan', spotA: 'ghostBright', spotB: 'ghostFin', fin: 'ghostFin', eye: 'eyeDark' }
  };

  function clamp(val, min, max) {
    return val < min ? min : val > max ? max : val;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function randRange(min, max) {
    return min + Math.random() * (max - min);
  }

  function angleDiff(target, current) {
    let diff = target - current;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return diff;
  }

  function pickGeneticVariety() {
    const r = Math.random();
    if (r < 0.2125) return 'kohaku';
    if (r < 0.425) return 'yamabuki';
    if (r < 0.6375) return 'showa';
    if (r < 0.85) return 'asagi';
    if (r < 0.93) return 'tancho';
    return 'butterfly';
  }

  function createMarkings(variety) {
    const patches = [];
    if (variety === 'kohaku') {
      const count = 3 + Math.floor(Math.random() * 3);
      for (let i = 0; i < count; i++) {
        patches.push({
          type: 'A',
          u: randRange(0.06, 0.72),
          v: randRange(-0.45, 0.45),
          ru: randRange(0.08, 0.16),
          rv: randRange(0.45, 0.95),
          phase: randRange(0, Math.PI * 2)
        });
      }
    } else if (variety === 'yamabuki') {
      patches.push({ type: 'A', u: 0.25, v: 0, ru: 0.24, rv: 0.55, phase: randRange(0, Math.PI * 2) });
    } else if (variety === 'showa') {
      const redCount = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < redCount; i++) {
        patches.push({
          type: 'A',
          u: randRange(0.08, 0.68),
          v: randRange(-0.45, 0.45),
          ru: randRange(0.09, 0.16),
          rv: randRange(0.5, 0.9),
          phase: randRange(0, Math.PI * 2)
        });
      }
      const whiteCount = 2 + Math.floor(Math.random() * 2);
      for (let i = 0; i < whiteCount; i++) {
        patches.push({
          type: 'B',
          u: randRange(0.05, 0.7),
          v: randRange(-0.5, 0.5),
          ru: randRange(0.08, 0.15),
          rv: randRange(0.45, 0.85),
          phase: randRange(0, Math.PI * 2)
        });
      }
    } else if (variety === 'asagi') {
      patches.push({ type: 'A', u: 0.13, v: 0.68, ru: 0.08, rv: 0.36, phase: 0.4 });
      patches.push({ type: 'A', u: 0.13, v: -0.68, ru: 0.08, rv: 0.36, phase: 1.7 });
      patches.push({ type: 'A', u: 0.42, v: 0.78, ru: 0.24, rv: 0.32, phase: 2.3 });
      patches.push({ type: 'A', u: 0.42, v: -0.78, ru: 0.24, rv: 0.32, phase: 3.9 });
    } else if (variety === 'butterfly') {
      patches.push({ type: 'A', u: 0.24, v: 0, ru: 0.22, rv: 0.46, phase: randRange(0, Math.PI * 2) });
    }
    return patches;
  }

  /* ---------------------------------------------------------
   * Base Class: Shared Boids, Spine Kinematics & 2.5D Rasterizer
   * --------------------------------------------------------- */
  class AquaticCreature {
    constructor(width, height, config) {
      this.species = config.species;
      this.depth = clamp(config.depth !== undefined ? config.depth : randRange(0.6, 1.15), 0.6, 1.15);
      this.depthNorm = (this.depth - 0.6) / (1.15 - 0.6);

      this.nodeCount = config.nodeCount || 12;
      this.totalLength = config.totalLength;
      this.maxRadius = config.maxRadius;
      this.segLength = this.totalLength / (this.nodeCount - 1);

      this.waveAmplitudeRatio = config.waveAmplitudeRatio !== undefined ? config.waveAmplitudeRatio : 0.088;
      this.waveFrequency = config.waveFrequency !== undefined ? config.waveFrequency : 4.5;
      this.waveStartT = config.waveStartT !== undefined ? config.waveStartT : 0;
      this.wavePow = config.wavePow !== undefined ? config.wavePow : 1.55;
      this.turnCurlScale = config.turnCurlScale !== undefined ? config.turnCurlScale : 0;
      this.swimBaseRate = config.swimBaseRate !== undefined ? config.swimBaseRate : 3.1;
      this.swimSpeedRate = config.swimSpeedRate !== undefined ? config.swimSpeedRate : 5.6;
      this.maxTurnRate = config.maxTurnRate !== undefined ? config.maxTurnRate : 2.1;
      this.alphaMultiplier = config.alphaMultiplier !== undefined ? config.alphaMultiplier : 1.0;
      this.isGlowingDefault = config.isGlowingDefault !== undefined ? config.isGlowingDefault : this.depth >= 0.76;
      this.boundingRadius = config.boundingRadius || this.totalLength * 0.62;
      this.bboxPad = config.bboxPad || this.maxRadius * 2.2;
      this.maxTailT = config.maxTailT || 1.0;
      this.tailExtraProj = config.tailExtraProj || 1.0;
      this.headScanAmp = config.headScanAmp || 0;
      this.turnBias = 0;

      this.baseSpeed = config.baseSpeed;
      this.speed = this.baseSpeed;
      this.heading = randRange(0, Math.PI * 2);

      this.x = randRange(70, Math.max(140, width - 70));
      this.y = randRange(70, Math.max(140, height - 70));
      this.vx = Math.cos(this.heading) * this.speed;
      this.vy = Math.sin(this.heading) * this.speed;

      this.swimPhase = randRange(0, Math.PI * 2);
      this.wanderPhase = randRange(0, Math.PI * 2);
      this.wanderSpeed = randRange(0.4, 0.9);
      this.curiosityBias = config.curiosityBias !== undefined ? config.curiosityBias : randRange(0.5, 1.15);

      this.baseNodes = new Array(this.nodeCount);
      this.nodes = new Array(this.nodeCount);
      for (let i = 0; i < this.nodeCount; i++) {
        const nx = this.x - Math.cos(this.heading) * this.segLength * i;
        const ny = this.y - Math.sin(this.heading) * this.segLength * i;
        this.baseNodes[i] = { x: nx, y: ny };
        this.nodes[i] = { x: nx, y: ny };
      }

      this.centerIdx = Math.floor(this.nodeCount * 0.45);
      this.centerX = this.nodes[this.centerIdx].x;
      this.centerY = this.nodes[this.centerIdx].y;

      const segCount = this.nodeCount - 1;
      this.segAx = new Float64Array(segCount);
      this.segAy = new Float64Array(segCount);
      this.segVx = new Float64Array(segCount);
      this.segVy = new Float64Array(segCount);
      this.segLenSq = new Float64Array(segCount);
      this._intersectingLilies = new Uint8Array(16);
    }

    updatePhysics(dt, width, height, neighbors, foodPool, mouse, obstacleRect, stonesRect, ecosystem, engine) {
      this.wanderPhase += this.wanderSpeed * dt;

      let steerX = 0;
      let steerY = 0;

      // 1. Boids: Separation across all creatures; Alignment & Cohesion with same species
      let sepX = 0;
      let sepY = 0;
      let aliX = 0;
      let aliY = 0;
      let cohX = 0;
      let cohY = 0;
      let aliCount = 0;
      let cohCount = 0;

      const sepRadius = 54 + this.maxRadius * 1.45;
      const neighborRadius = 175 + this.depthNorm * 60;
      const neighborRadiusSq = neighborRadius * neighborRadius;

      for (let i = 0; i < neighbors.length; i++) {
        const other = neighbors[i];
        if (other === this) continue;

        const depthDist = Math.abs(this.depth - other.depth);
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < 1) continue;

        const combinedSep = sepRadius + other.maxRadius * 0.85;
        if (depthDist < 0.24 && distSq < combinedSep * combinedSep) {
          const dist = Math.sqrt(distSq);
          const force = (combinedSep - dist) / combinedSep;
          sepX -= (dx / dist) * force;
          sepY -= (dy / dist) * force;
        }

        if (other.species === this.species && depthDist < 0.28 && distSq < neighborRadiusSq) {
          aliX += other.vx;
          aliY += other.vy;
          aliCount++;
          cohX += other.x;
          cohY += other.y;
          cohCount++;
        }
      }

      steerX += sepX * 105;
      steerY += sepY * 105;

      if (aliCount > 0) {
        steerX += (aliX / aliCount - this.vx) * 0.52;
        steerY += (aliY / aliCount - this.vy) * 0.52;
      }

      if (cohCount > 0) {
        steerX += (cohX / cohCount - this.x) * 0.14;
        steerY += (cohY / cohCount - this.y) * 0.14;
      }

      // 2. Organic wander
      const wanderAngle = this.heading + Math.sin(this.wanderPhase) * 0.68;
      steerX += Math.cos(wanderAngle) * 22;
      steerY += Math.sin(wanderAngle) * 22;

      // 3. Food attraction & floating Sakura petal curiosity
      let targetSpeed = this.baseSpeed;
      let nearestFood = null;
      let nearestFoodDist = 480;

      for (let i = 0; i < FOOD_POOL_SIZE; i++) {
        const f = foodPool[i];
        if (!f.active || f.age < 0) continue;
        const d = Math.hypot(f.x - this.x, f.y - this.y);
        if (d < nearestFoodDist) {
          nearestFoodDist = d;
          nearestFood = f;
        }
      }

      if (nearestFood) {
        const dx = nearestFood.x - this.x;
        const dy = nearestFood.y - this.y;
        const d = Math.max(1, nearestFoodDist);
        const urgency = clamp(1 - d / 520, 0.25, 1.0);
        steerX += (dx / d) * (155 + urgency * 135);
        steerY += (dy / d) * (155 + urgency * 135);
        targetSpeed = this.baseSpeed * (1.28 + urgency * 0.58);
      } else {
        let nearPetal = null;
        let nearPetalDist = 250;
        if (ecosystem && ecosystem.petalPool) {
          const pool = ecosystem.petalPool;
          const len = ecosystem.petalPoolSize || pool.length;
          for (let i = 0; i < len; i++) {
            const p = pool[i];
            if (!p.active || p.state !== 1) continue;
            const d = Math.hypot(p.x - this.x, p.y - this.y);
            if (d < nearPetalDist) {
              nearPetalDist = d;
              nearPetal = p;
            }
          }
        }

        if (nearPetal) {
          const dx = nearPetal.x - this.x;
          const dy = nearPetal.y - this.y;
          const d = Math.max(1, nearPetalDist);
          const ux = dx / d;
          const uy = dy / d;
          const orbitPull = d < 80 ? -0.35 : 0.62;
          const tangentDir = this.vx * -uy + this.vy * ux >= 0 ? 1 : -1;
          steerX += (ux * orbitPull + -uy * tangentDir * 0.72) * 58 * this.curiosityBias;
          steerY += (uy * orbitPull + ux * tangentDir * 0.72) * 58 * this.curiosityBias;
          targetSpeed = this.baseSpeed * 1.1;
        } else if (mouse.active && mouse.energy > 0.05) {
          const dx = mouse.x - this.x;
          const dy = mouse.y - this.y;
          const d = Math.hypot(dx, dy);
          if (d > 55 && d < 280) {
            const pull = (1 - d / 280) * mouse.energy * this.curiosityBias;
            steerX += (dx / d) * pull * 48;
            steerY += (dy / d) * pull * 48;
          }
        }
      }

      // 4. Obstacle avoidance (hero search card & bottom river stones)
      if (obstacleRect && obstacleRect.width > 0 && obstacleRect.height > 0) {
        const pad = 44;
        const left = obstacleRect.left - pad;
        const right = obstacleRect.right + pad;
        const top = obstacleRect.top - pad;
        const bottom = obstacleRect.bottom + pad;

        if (this.x > left && this.x < right && this.y > top && this.y < bottom) {
          const cx = (left + right) * 0.5;
          const cy = (top + bottom) * 0.5;
          const rx = (right - left) * 0.5;
          const ry = (bottom - top) * 0.5;
          const nx = (this.x - cx) / Math.max(1, rx);
          const ny = (this.y - cy) / Math.max(1, ry);
          const mag = Math.hypot(nx, ny) || 1;
          const ux = nx / mag;
          const uy = ny / mag;

          const tangentDir = this.vx * -uy + this.vy * ux >= 0 ? 1 : -1;
          const tx = -uy * tangentDir;
          const ty = ux * tangentDir;
          const strength = clamp(1.25 - mag, 0.1, 1.15);

          steerX += (ux * 165 + tx * 95) * strength;
          steerY += (uy * 165 + ty * 95) * strength;
        }
      }

      if (stonesRect && stonesRect.width > 0 && stonesRect.height > 0) {
        const padX = 36;
        const padTop = 44;
        const left = stonesRect.left - padX;
        const right = stonesRect.right + padX;
        const top = stonesRect.top - padTop;

        if (this.x > left && this.x < right && this.y > top) {
          const depthInside = clamp((this.y - top) / Math.max(24, stonesRect.height + padTop), 0.15, 1.2);
          const cx = (left + right) * 0.5;
          const sideDir = this.x >= cx ? 1 : -1;
          steerY -= 175 * depthInside;
          steerX += sideDir * 55 * depthInside;
        }
      }

      // 5. Soft viewport margins
      const margin = 90;
      if (this.x < margin) steerX += ((margin - this.x) / margin) * 155;
      else if (this.x > width - margin) steerX -= ((this.x - (width - margin)) / margin) * 155;

      if (this.y < margin) steerY += ((margin - this.y) / margin) * 155;
      else if (this.y > height - margin) steerY -= ((this.y - (height - margin)) / margin) * 155;

      const desiredVx = this.vx + steerX * dt;
      const desiredVy = this.vy + steerY * dt;
      const desiredHeading = Math.atan2(desiredVy, desiredVx);

      const maxTurn = (this.maxTurnRate + (targetSpeed / this.baseSpeed) * 0.55) * dt;
      const dAngle = clamp(angleDiff(desiredHeading, this.heading), -maxTurn, maxTurn);
      this.heading += dAngle;

      const instantTurn = clamp(dAngle / Math.max(dt, 0.001), -2.5, 2.5);
      this.turnBias = lerp(this.turnBias, instantTurn, clamp(dt * 4.5, 0, 1));

      this.speed = lerp(this.speed, targetSpeed, clamp(dt * 3.0, 0, 1));
      this.vx = Math.cos(this.heading) * this.speed;
      this.vy = Math.sin(this.heading) * this.speed;

      this.x += this.vx * dt;
      this.y += this.vy * dt;

      const speedRatio = this.speed / Math.max(1, this.baseSpeed);
      this.swimPhase += (this.swimBaseRate + speedRatio * this.swimSpeedRate) * dt;

      this.updateSpine();
      if (ecosystem && ecosystem.planktonEnabled) {
        if ((Math.abs(this.turnBias) > 0.55 || speedRatio > 1.15) && Math.random() < dt * 11) {
          const tail = this.nodes[this.nodeCount - 1];
          ecosystem.spawnPlankton(tail.x + randRange(-8, 8), tail.y + randRange(-8, 8), -this.vx * 0.12, -this.vy * 0.12);
        }
        if (Math.random() < dt * 0.65) {
          ecosystem.spawnBubble(this.x + randRange(-10, 10), this.y + randRange(-8, 8));
        }
      }
      this.onAfterUpdate(dt, engine);
    }

    onAfterUpdate() {}

    updateSpine() {
      this.baseNodes[0].x = this.x;
      this.baseNodes[0].y = this.y;

      for (let i = 1; i < this.nodeCount; i++) {
        const prev = this.baseNodes[i - 1];
        const curr = this.baseNodes[i];
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        curr.x = prev.x + (dx / dist) * this.segLength;
        curr.y = prev.y + (dy / dist) * this.segLength;
      }

      const maxWave = this.totalLength * this.waveAmplitudeRatio;
      for (let i = 0; i < this.nodeCount; i++) {
        const t = i / (this.nodeCount - 1);
        const prev = this.baseNodes[Math.max(0, i - 1)];
        const next = this.baseNodes[Math.min(this.nodeCount - 1, i + 1)];
        let tx = prev.x - next.x;
        let ty = prev.y - next.y;
        const tLen = Math.hypot(tx, ty) || 1;
        tx /= tLen;
        ty /= tLen;

        const nx = -ty;
        const ny = tx;

        let waveOffset;
        if (i === 0) {
          waveOffset = this.headScanAmp > 0 ? Math.sin(this.swimPhase * 0.85) * this.headScanAmp : 0;
        } else {
          let ampFactor;
          if (this.waveStartT > 0) {
            const postT = clamp((t - this.waveStartT) / (1 - this.waveStartT), 0, 1);
            ampFactor = 0.015 + 0.985 * Math.pow(postT, this.wavePow);
          } else {
            ampFactor = 0.04 + 0.96 * Math.pow(t, this.wavePow);
          }
          const amp = maxWave * ampFactor;
          const tailLag = t > 0.72 ? Math.pow((t - 0.72) / 0.28, 1.4) * 0.55 : 0;
          const turnCurl = this.turnCurlScale > 0 ? this.turnBias * this.totalLength * this.turnCurlScale * Math.pow(t, 1.85) : 0;
          waveOffset = Math.sin(this.swimPhase - t * this.waveFrequency - tailLag) * amp + turnCurl;
        }

        this.nodes[i].x = this.baseNodes[i].x + nx * waveOffset;
        this.nodes[i].y = this.baseNodes[i].y + ny * waveOffset;
      }

      this.centerX = this.nodes[this.centerIdx].x;
      this.centerY = this.nodes[this.centerIdx].y;
    }

    // Overridden by subclasses for species-specific anatomy & markings
    sampleCell(bestT, bestSignedDist, absDist, bodyR, px, py, time) {
      return null;
    }

    render(ctx, atlas, ecosystem, time) {
      const hitLilyCount = ecosystem
        ? ecosystem.testCircleIntersectsLilies(
            this.centerX,
            this.centerY,
            this.boundingRadius,
            this._intersectingLilies
          )
        : 0;

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      const pad = this.bboxPad;

      for (let i = 0; i < this.nodeCount; i++) {
        const n = this.nodes[i];
        if (n.x < minX) minX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.x > maxX) maxX = n.x;
        if (n.y > maxY) maxY = n.y;
      }

      const startCol = Math.floor((minX - pad) / CELL_W);
      const endCol = Math.ceil((maxX + pad) / CELL_W);
      const startRow = Math.floor((minY - pad) / CELL_H);
      const endRow = Math.ceil((maxY + pad) / CELL_H);

      const segCount = this.nodeCount - 1;
      const invSegCount = 1 / segCount;
      const lastIdx = segCount - 1;

      for (let i = 0; i < segCount; i++) {
        const a = this.nodes[i];
        const b = this.nodes[i + 1];
        const vx = b.x - a.x;
        const vy = b.y - a.y;
        this.segAx[i] = a.x;
        this.segAy[i] = a.y;
        this.segVx[i] = vx;
        this.segVy[i] = vy;
        this.segLenSq[i] = vx * vx + vy * vy || 0.0001;
      }

      const baseAlpha = lerp(0.48, 0.98, this.depthNorm) * this.alphaMultiplier;
      const occludedAlpha = baseAlpha * 0.22;
      let currentOccludedState = false;
      ctx.globalAlpha = baseAlpha;

      // Reusable sample result holder (zero allocations in loop)
      const cellOut = this._cellOut || (this._cellOut = { char: '.', colorKey: 'kohakuWhite', glow: false });

      for (let row = startRow; row <= endRow; row++) {
        const py = (row + 0.5) * CELL_H;
        for (let col = startCol; col <= endCol; col++) {
          const px = (col + 0.5) * CELL_W;

          let bestDistSq = Infinity;
          let bestT = 0;
          let bestSignedDist = 0;

          for (let i = 0; i < segCount; i++) {
            const ax = this.segAx[i];
            const ay = this.segAy[i];
            const svx = this.segVx[i];
            const svy = this.segVy[i];
            const wx = px - ax;
            const wy = py - ay;
            const maxProj = i === lastIdx ? this.tailExtraProj : 1.0;
            const proj = clamp((wx * svx + wy * svy) / this.segLenSq[i], 0, maxProj);
            const dx = px - (ax + proj * svx);
            const dy = py - (ay + proj * svy);
            const dSq = dx * dx + dy * dy;

            if (dSq < bestDistSq) {
              bestDistSq = dSq;
              bestT = (i + proj) * invSegCount;
              const cross = svx * dy - svy * dx;
              bestSignedDist = cross >= 0 ? Math.sqrt(dSq) : -Math.sqrt(dSq);
            }
          }

          if (!this.evaluateCell(bestT, bestSignedDist, px, py, time, cellOut)) {
            continue;
          }

          const isOccluded =
            hitLilyCount > 0 ? ecosystem.isOccludedInList(px, py, this._intersectingLilies, hitLilyCount) : false;

          if (isOccluded !== currentOccludedState) {
            currentOccludedState = isOccluded;
            ctx.globalAlpha = isOccluded ? occludedAlpha : baseAlpha;
          }

          const isGlowing = !isOccluded && cellOut.glow;
          atlas.drawGlyph(ctx, cellOut.char, cellOut.colorKey, isGlowing, px, py);
        }
      }

      ctx.globalAlpha = 1;
    }
  }

  /* ---------------------------------------------------------
   * Species 1: Koi Fish (Classic + Tancho + Phantom Butterfly)
   * --------------------------------------------------------- */
  class KoiFish extends AquaticCreature {
    constructor(width, height, depthOverride, varietyOverride) {
      const depth = clamp(depthOverride !== undefined ? depthOverride : randRange(0.6, 1.15), 0.6, 1.15);
      const depthNorm = (depth - 0.6) / (1.15 - 0.6);
      const variety = varietyOverride || pickGeneticVariety();
      const isButterfly = variety === 'butterfly';
      const totalLength = 152 * depth * randRange(0.94, 1.06);
      const maxRadius = totalLength * randRange(0.148, 0.17);

      super(width, height, {
        species: 'koi',
        depth,
        nodeCount: 12,
        totalLength,
        maxRadius,
        baseSpeed: lerp(38, 66, depthNorm) * randRange(0.92, 1.08),
        alphaMultiplier: isButterfly ? 0.58 : 1.0,
        isGlowingDefault: isButterfly || depth >= 0.76,
        boundingRadius: totalLength * (isButterfly ? 0.68 : 0.58),
        bboxPad: maxRadius * (isButterfly ? 3.2 : 2.2),
        maxTailT: isButterfly ? 1.095 : 1.0,
        tailExtraProj: isButterfly ? 2.05 : 1.0
      });

      this.variety = variety;
      this.isButterfly = isButterfly;
      this.isTancho = variety === 'tancho';
      this.colorKeys = VARIETY_COLOR_KEYS[variety];
      this.finScale = isButterfly ? 1.45 : 1.0;
      this.patches = createMarkings(variety);
      this.ghostTrailTimer = 0;
    }

    bodyRadiusAt(t) {
      if (t < 0 || t > this.maxTailT) return 0;
      if (t < 0.14) {
        const s = t / 0.14;
        return this.maxRadius * (0.24 + 0.68 * Math.pow(Math.sin(s * Math.PI * 0.5), 0.72));
      }
      if (t < 0.36) {
        const s = (t - 0.14) / 0.22;
        return this.maxRadius * (0.92 + 0.08 * Math.sin(s * Math.PI * 0.5));
      }
      if (t < 0.79) {
        const s = (t - 0.36) / 0.43;
        return this.maxRadius * (1.0 - 0.81 * Math.pow(s, 1.18));
      }
      const tailSpan = this.isButterfly ? 0.305 : 0.21;
      const s = clamp((t - 0.79) / tailSpan, 0, 1);
      const flare = this.isButterfly ? 0.86 : 0.58;
      return this.maxRadius * (0.19 + flare * Math.pow(s, 0.84));
    }

    onAfterUpdate(dt, engine) {
      if (this.isButterfly) {
        this.ghostTrailTimer += dt;
        if (this.ghostTrailTimer >= 0.085) {
          this.ghostTrailTimer = 0;
          const tail = this.nodes[this.nodeCount - 1];
          engine.spawnTrailGlyph(
            tail.x + randRange(-6, 6),
            tail.y + randRange(-6, 6),
            Math.random() > 0.45 ? '·' : '~',
            'ghostFin'
          );
        }
      }
    }

    getMarkType(t, vNorm, px, py) {
      if (this.isTancho) {
        const headNode = this.nodes[1];
        const spotRadius = this.maxRadius * 0.46;
        const dx = px - headNode.x;
        const dy = py - headNode.y;
        return dx * dx + dy * dy <= spotRadius * spotRadius ? 'A' : 'base';
      }
      if (this.variety === 'asagi') {
        for (let i = 0; i < this.patches.length; i++) {
          const p = this.patches[i];
          const du = (t - p.u) / p.ru;
          const dv = (vNorm - p.v) / p.rv;
          if (du * du + dv * dv < 1 + 0.14 * Math.sin(t * 22 + p.phase)) return 'A';
        }
        return Math.sin(t * 48) * Math.cos(vNorm * 8.5) > 0.56 && Math.abs(vNorm) < 0.65 ? 'B' : 'base';
      }
      for (let i = 0; i < this.patches.length; i++) {
        const p = this.patches[i];
        const du = (t - p.u) / p.ru;
        const dv = (vNorm - p.v) / p.rv;
        if (du * du + dv * dv < 1 + 0.18 * Math.sin(t * 20 + vNorm * 5 + p.phase)) return p.type;
      }
      return 'base';
    }

    evaluateCell(bestT, bestSignedDist, px, py, time, out) {
      let adjustedSignedDist = bestSignedDist;
      if (this.isButterfly && bestT > 0.79) {
        const extraT = (bestT - 0.79) / 0.305;
        adjustedSignedDist += Math.sin(this.swimPhase * 1.4 - extraT * 4.5) * this.maxRadius * 0.26 * extraT;
      }

      const absDist = Math.abs(adjustedSignedDist);
      const bodyR = this.bodyRadiusAt(bestT);
      let density = -1;
      let isFin = false;
      let isEye = false;

      if (bestT >= 0 && bestT <= this.maxTailT && absDist <= bodyR) {
        if (bestT > 0.85) {
          const tailT = (bestT - 0.85) / (this.maxTailT - 0.85);
          const notchRatio = (this.isButterfly ? 0.34 : 0.28) * tailT;
          const normLat = absDist / Math.max(1, bodyR);
          if (normLat > notchRatio) {
            density = clamp((1 - normLat) * (1 - tailT * 0.48) * (this.isButterfly ? 0.58 : 0.65), 0.05, 0.55);
            isFin = true;
          }
        } else if (bestT > 0.78) {
          const normLat = absDist / Math.max(1, bodyR);
          density = clamp((1 - normLat) * 0.62, 0.08, 0.62);
          isFin = true;
        } else {
          const normLat = absDist / Math.max(1, bodyR);
          const shimmer = Math.sin(bestT * 26 - this.swimPhase * 0.6 + time * 1.4) * 0.06;
          density = clamp((1 - normLat * normLat) * 0.96 + shimmer, 0.08, 1.0);
          if (this.depth > 0.66 && bestT > 0.065 && bestT < 0.115 && normLat > 0.38 && normLat < 0.72) {
            isEye = true;
          }
        }
      }

      if (density < 0.15 && bestT > 0.16 && bestT < 0.46) {
        const flap = Math.sin(this.swimPhase - 0.9);
        const side = bestSignedDist >= 0 ? 1 : -1;
        const finWave = this.isButterfly ? Math.sin(this.swimPhase * 1.35 - absDist * 0.09) * 0.045 : 0;
        const finCenterT = 0.29 + side * flap * 0.028 + finWave;
        const finOutMin = bodyR * 0.82;
        const finOutMax = this.maxRadius * ((1.72 + flap * side * 0.15) * this.finScale);

        if (absDist > finOutMin && absDist < finOutMax) {
          const du = (bestT - finCenterT) / (this.isButterfly ? 0.125 : 0.095);
          const dv = (absDist - (finOutMin + finOutMax) * 0.5) / ((finOutMax - finOutMin) * 0.5);
          const ell = du * du + dv * dv;
          if (ell < 1.0) {
            const finD = (1 - ell) * (this.isButterfly ? 0.52 : 0.46);
            if (finD > density) {
              density = finD;
              isFin = true;
            }
          }
        }
      }

      if (density <= 0.04) return false;

      if (isEye) {
        out.char = 'o';
        out.colorKey = this.colorKeys.eye;
        out.glow = false;
        return true;
      }

      const idx = clamp(Math.floor((1 - density) * (DENSITY_CHARS.length - 0.01)), 0, DENSITY_CHARS.length - 1);
      out.char = DENSITY_CHARS[idx];

      if (isFin) {
        out.colorKey = this.colorKeys.fin;
      } else {
        const vNorm = bestSignedDist / Math.max(1, bodyR);
        const mark = this.getMarkType(bestT, vNorm, px, py);
        out.colorKey = mark === 'A' ? this.colorKeys.spotA : mark === 'B' ? this.colorKeys.spotB : this.colorKeys.base;
      }

      out.glow = this.isGlowingDefault && density > 0.25;
      return true;
    }
  }

  /* ---------------------------------------------------------
   * Species 2: Sea Turtle (Tortuga Marina)
   * --------------------------------------------------------- */
  class SeaTurtle extends AquaticCreature {
    constructor(width, height, depthOverride) {
      const depth = clamp(depthOverride !== undefined ? depthOverride : randRange(0.62, 1.12), 0.6, 1.15);
      const depthNorm = (depth - 0.6) / (1.15 - 0.6);
      const totalLength = 122 * depth * randRange(0.92, 1.08);
      const maxRadius = totalLength * 0.34;

      super(width, height, {
        species: 'turtle',
        depth,
        nodeCount: 5,
        totalLength,
        maxRadius,
        baseSpeed: lerp(24, 38, depthNorm) * randRange(0.92, 1.08),
        waveAmplitudeRatio: 0.014,
        waveFrequency: 2.2,
        swimBaseRate: 1.8,
        swimSpeedRate: 2.3,
        maxTurnRate: 1.4,
        boundingRadius: totalLength * 0.72,
        bboxPad: maxRadius * 2.1
      });
    }

    bodyRadiusAt(t) {
      if (t < 0 || t > 0.96) return 0;
      if (t < 0.14) {
        const s = t / 0.14;
        return this.maxRadius * (0.14 + 0.24 * Math.sin(s * Math.PI * 0.65));
      }
      if (t < 0.20) {
        return this.maxRadius * 0.32;
      }
      if (t < 0.78) {
        const s = (t - 0.20) / 0.58;
        return this.maxRadius * Math.pow(Math.sin(s * Math.PI), 0.62);
      }
      const s = (t - 0.78) / 0.18;
      return this.maxRadius * 0.18 * Math.max(0, 1 - s);
    }

    evaluateCell(bestT, bestSignedDist, px, py, time, out) {
      const absDist = Math.abs(bestSignedDist);
      const bodyR = this.bodyRadiusAt(bestT);
      let density = -1;
      let part = 0; // 0 = shell, 1 = head, 2 = flipper, 3 = eye

      // 1. Head, Shell & Short Tail
      if (bestT >= 0 && bestT <= 0.95 && absDist <= bodyR) {
        const normLat = absDist / Math.max(1, bodyR);
        if (bestT < 0.20) {
          part = 1;
          density = clamp((1 - normLat * normLat) * 0.85, 0.18, 0.9);
          if (bestT > 0.04 && bestT < 0.11 && normLat > 0.42 && normLat < 0.78) {
            part = 3;
          }
        } else if (bestT <= 0.78) {
          part = 0;
          density = clamp(0.95 - normLat * 0.45, 0.28, 0.98);
        } else {
          part = 1;
          density = clamp((1 - normLat) * 0.5, 0.08, 0.52);
        }
      }

      // 2. Swept Rowing Front Flippers (t ≈ 0.24..0.54)
      if (density < 0.2 && bestT > 0.20 && bestT < 0.64) {
        const flap = Math.sin(this.swimPhase);
        const reach = this.maxRadius * (1.76 + flap * 0.18);
        const startR = bodyR * 0.76;
        if (absDist > startR && absDist < reach) {
          const outRatio = (absDist - startR) / Math.max(1, reach - startR);
          const sweepCenterT = 0.29 + outRatio * 0.17 - flap * 0.065;
          const halfWidthT = lerp(0.11, 0.042, outRatio);
          const du = (bestT - sweepCenterT) / halfWidthT;
          const dv = (outRatio - 0.48) / 0.54;
          const ell = du * du + dv * dv;
          if (ell < 1.0) {
            const finD = (1 - ell) * 0.72;
            if (finD > density) {
              density = finD;
              part = 2;
            }
          }
        }
      }

      // 3. Compact Rear Flippers (t ≈ 0.70..0.92)
      if (density < 0.2 && bestT > 0.68 && bestT < 0.94) {
        const flapRear = Math.cos(this.swimPhase);
        const startR = bodyR * 0.72;
        const reach = this.maxRadius * 0.95;
        if (absDist > startR && absDist < reach) {
          const outRatio = (absDist - startR) / Math.max(1, reach - startR);
          const centerT = 0.78 + outRatio * 0.07 + flapRear * 0.025;
          const du = (bestT - centerT) / 0.075;
          const dv = (outRatio - 0.5) / 0.52;
          const ell = du * du + dv * dv;
          if (ell < 1.0) {
            const finD = (1 - ell) * 0.56;
            if (finD > density) {
              density = finD;
              part = 2;
            }
          }
        }
      }

      if (density <= 0.05) return false;

      if (part === 3) {
        out.char = 'o';
        out.colorKey = 'eyeDark';
        out.glow = false;
        return true;
      }

      const idx = clamp(Math.floor((1 - density) * (DENSITY_CHARS.length - 0.01)), 0, DENSITY_CHARS.length - 1);
      out.char = DENSITY_CHARS[idx];

      if (part === 1) {
        out.colorKey = 'turtleSkin';
        out.glow = this.isGlowingDefault && density > 0.35;
      } else if (part === 2) {
        out.colorKey = density > 0.4 ? 'turtleSkin' : 'turtleFinTip';
        out.glow = false;
      } else {
        const normLat = absDist / Math.max(1, bodyR);
        const vNorm = bestSignedDist / Math.max(1, bodyR);
        const shellT = (bestT - 0.20) / 0.58;
        const scuteGrid = Math.abs(Math.sin(shellT * Math.PI * 4.5)) < 0.19 || Math.abs(Math.cos(vNorm * 4.2)) < 0.20;
        if (normLat > 0.78 || (normLat < 0.18 && shellT > 0.16 && shellT < 0.84)) {
          out.colorKey = 'turtleScuteGold';
          out.glow = this.isGlowingDefault;
        } else if (scuteGrid) {
          out.colorKey = 'turtleShellDark';
          out.glow = false;
        } else {
          out.colorKey = 'turtleShellMid';
          out.glow = this.isGlowingDefault && density > 0.55;
        }
      }
      return true;
    }
  }

  /* ---------------------------------------------------------
   * Shared Shark Base (Top-Down Silhouette, Pelvic Fins & Whip Tail)
   * --------------------------------------------------------- */
  class SharkCreature extends AquaticCreature {
    sharkTailRadius(t) {
      if (t < 0.68 || t > this.maxTailT) return 0;
      const s = clamp((t - 0.68) / (this.maxTailT - 0.68), 0, 1);
      const rawR = this.maxRadius * lerp(0.28, 0.05, Math.pow(s, 0.85));
      // Keep minimum raster thickness so the long curved ASCII tail whip stays continuous
      return Math.max(rawR, t < 0.96 ? 4.6 : 2.8);
    }

    evaluateSharkAppendages(bestT, bestSignedDist, absDist, bodyR, pecReachMult) {
      let density = -1;
      let kind = 0; // 0 = none, 1 = fin, 2 = subterminal tail notch

      // 1. Falcate swept pectoral wings (0.23 <= t <= 0.48)
      if (bestT > 0.22 && bestT < 0.50) {
        const startR = bodyR * 0.78;
        const reach = this.maxRadius * pecReachMult;
        if (absDist > startR && absDist < reach) {
          const outRatio = (absDist - startR) / Math.max(1, reach - startR);
          const centerT = 0.27 + Math.pow(outRatio, 1.15) * 0.16;
          const halfW = lerp(0.088, 0.022, outRatio);
          const du = (bestT - centerT) / halfW;
          const dv = (outRatio - 0.48) / 0.54;
          const ell = du * du + dv * dv;
          if (ell < 1.0) {
            density = (1 - ell) * 0.72;
            kind = 1;
          }
        }
      }

      // 2. Swept rear pelvic fins (0.55 <= t <= 0.70)
      if (density < 0.15 && bestT > 0.54 && bestT < 0.72) {
        const startR = bodyR * 0.72;
        const reach = this.maxRadius * 1.04;
        if (absDist > startR && absDist < reach) {
          const outRatio = (absDist - startR) / Math.max(1, reach - startR);
          const centerT = 0.585 + outRatio * 0.085;
          const halfW = lerp(0.062, 0.018, outRatio);
          const du = (bestT - centerT) / halfW;
          const dv = (outRatio - 0.48) / 0.54;
          const ell = du * du + dv * dv;
          if (ell < 1.0) {
            const pelD = (1 - ell) * 0.64;
            if (pelD > density) {
              density = pelD;
              kind = 1;
            }
          }
        }
      }

      // 3. Asymmetric subterminal caudal notch along one side of the whip tail
      if (density < 0.1 && bestT > 0.83 && bestT < 0.90 && bestSignedDist > 0) {
        const notchCenter = 0.865;
        const du = (bestT - notchCenter) / 0.026;
        const reach = bodyR + this.maxRadius * 0.18;
        if (absDist > bodyR * 0.6 && absDist < reach) {
          const dv = (absDist - bodyR) / Math.max(1, reach - bodyR);
          if (du * du + dv * dv < 1.0) {
            density = 0.52;
            kind = 2;
          }
        }
      }

      this._appendageOut = this._appendageOut || { density: -1, kind: 0 };
      this._appendageOut.density = density;
      this._appendageOut.kind = kind;
      return this._appendageOut;
    }
  }

  /* ---------------------------------------------------------
   * Species 3: Whale Shark (Tiburón Ballena)
   * --------------------------------------------------------- */
  class WhaleShark extends SharkCreature {
    constructor(width, height, depthOverride) {
      const depth = clamp(depthOverride !== undefined ? depthOverride : randRange(0.65, 1.12), 0.6, 1.15);
      const depthNorm = (depth - 0.6) / (1.15 - 0.6);
      const totalLength = 284 * depth * randRange(0.95, 1.06);
      const maxRadius = totalLength * 0.156;

      super(width, height, {
        species: 'whaleShark',
        depth,
        nodeCount: 15,
        totalLength,
        maxRadius,
        baseSpeed: lerp(28, 46, depthNorm) * randRange(0.94, 1.06),
        waveStartT: 0.20,
        wavePow: 1.85,
        waveAmplitudeRatio: 0.132,
        waveFrequency: 2.85,
        turnCurlScale: 0.085,
        swimBaseRate: 2.0,
        swimSpeedRate: 3.4,
        maxTurnRate: 1.25,
        boundingRadius: totalLength * 0.64,
        bboxPad: maxRadius * 2.5,
        maxTailT: 1.04,
        tailExtraProj: 1.3
      });
    }

    bodyRadiusAt(t) {
      if (t < 0 || t > this.maxTailT) return 0;
      if (t < 0.08) {
        const s = t / 0.08;
        return this.maxRadius * (0.56 + 0.32 * Math.pow(s, 0.55));
      }
      if (t < 0.28) {
        const s = (t - 0.08) / 0.20;
        return this.maxRadius * (0.88 + 0.12 * Math.sin(s * Math.PI * 0.5));
      }
      if (t < 0.68) {
        const s = (t - 0.28) / 0.40;
        return this.maxRadius * lerp(1.0, 0.28, Math.pow(s, 1.12));
      }
      return this.sharkTailRadius(t);
    }

    evaluateCell(bestT, bestSignedDist, px, py, time, out) {
      const absDist = Math.abs(bestSignedDist);
      const bodyR = this.bodyRadiusAt(bestT);
      let density = -1;
      let isFin = false;
      let isEye = false;

      if (bestT >= 0 && bestT <= this.maxTailT && absDist <= bodyR) {
        const normLat = absDist / Math.max(1, bodyR);
        if (bestT > 0.72) {
          const tailFade = clamp((bestT - 0.72) / (this.maxTailT - 0.72), 0, 1);
          density = clamp((1 - normLat * 0.75) * lerp(0.85, 0.42, tailFade), 0.1, 0.85);
          isFin = bestT > 0.82;
        } else {
          density = clamp((1 - normLat * normLat * 0.88) * 0.96, 0.14, 1.0);
          if (bestT > 0.045 && bestT < 0.085 && normLat > 0.72 && normLat < 0.90) {
            isEye = true;
          }
        }
      }

      if (density < 0.18) {
        const app = this.evaluateSharkAppendages(bestT, bestSignedDist, absDist, bodyR, 2.22);
        if (app.density > density) {
          density = app.density;
          isFin = app.kind > 0;
        }
      }

      if (density <= 0.05) return false;

      if (isEye) {
        out.char = 'o';
        out.colorKey = 'eyeDark';
        out.glow = false;
        return true;
      }

      const idx = clamp(Math.floor((1 - density) * (DENSITY_CHARS.length - 0.01)), 0, DENSITY_CHARS.length - 1);
      out.char = DENSITY_CHARS[idx];

      if (isFin) {
        const isDottedFin = bestT < 0.68 && Math.sin(bestT * 60) * Math.cos(absDist * 0.22) > 0.65;
        out.colorKey = isDottedFin ? 'whaleSpot' : 'whaleFin';
        out.glow = isDottedFin && this.isGlowingDefault;
        return true;
      }

      const vNorm = bestSignedDist / Math.max(1, bodyR);
      const isDorsalLine = bestT > 0.36 && bestT < 0.54 && Math.abs(vNorm) < 0.14;
      const isSpot =
        bestT > 0.10 &&
        bestT < 0.74 &&
        Math.abs(vNorm) < 0.88 &&
        ((Math.sin(bestT * 56) > 0.45 && Math.cos(vNorm * 11) > 0.34) ||
          (Math.sin(bestT * 28) > 0.90 && Math.abs(vNorm) < 0.72));

      if (isSpot) {
        out.char = '*';
        out.colorKey = 'whaleSpot';
        out.glow = this.isGlowingDefault;
      } else if (isDorsalLine) {
        out.colorKey = 'whaleFlank';
        out.glow = this.isGlowingDefault;
      } else {
        out.colorKey = Math.abs(vNorm) < 0.56 ? 'whaleBack' : 'whaleFlank';
        out.glow = this.isGlowingDefault && density > 0.65;
      }
      return true;
    }
  }

  /* ---------------------------------------------------------
   * Species 4: Hammerhead Shark (Tiburón Martillo)
   * --------------------------------------------------------- */
  class HammerheadShark extends SharkCreature {
    constructor(width, height, depthOverride) {
      const depth = clamp(depthOverride !== undefined ? depthOverride : randRange(0.64, 1.15), 0.6, 1.15);
      const depthNorm = (depth - 0.6) / (1.15 - 0.6);
      const totalLength = 224 * depth * randRange(0.94, 1.07);
      const maxRadius = totalLength * 0.128;

      super(width, height, {
        species: 'hammerhead',
        depth,
        nodeCount: 14,
        totalLength,
        maxRadius,
        baseSpeed: lerp(44, 72, depthNorm) * randRange(0.94, 1.06),
        waveStartT: 0.20,
        wavePow: 1.85,
        waveAmplitudeRatio: 0.148,
        waveFrequency: 2.85,
        turnCurlScale: 0.095,
        swimBaseRate: 2.6,
        swimSpeedRate: 4.4,
        maxTurnRate: 2.15,
        headScanAmp: maxRadius * 0.09,
        boundingRadius: totalLength * 0.64,
        bboxPad: maxRadius * 2.7,
        maxTailT: 1.03,
        tailExtraProj: 1.3
      });
    }

    bodyRadiusAt(t) {
      if (t < 0 || t > this.maxTailT) return 0;
      if (t < 0.14) {
        const s = clamp((t - 0.06) / 0.08, 0, 1);
        return this.maxRadius * lerp(0.66, 0.72, s);
      }
      if (t < 0.29) {
        const s = (t - 0.14) / 0.15;
        return this.maxRadius * lerp(0.72, 1.0, Math.sin(s * Math.PI * 0.5));
      }
      if (t < 0.68) {
        const s = (t - 0.29) / 0.39;
        return this.maxRadius * lerp(1.0, 0.28, Math.pow(s, 1.12));
      }
      return this.sharkTailRadius(t);
    }

    evaluateCell(bestT, bestSignedDist, px, py, time, out) {
      const absDist = Math.abs(bestSignedDist);
      const bodyR = this.bodyRadiusAt(bestT);
      let density = -1;
      let isFin = false;
      let isEye = false;
      let inHammer = false;

      // 1. Curved convex + swept-back Cephalofoil ("Hammer" Head)
      if (bestT >= 0 && bestT < 0.145) {
        const latNorm = absDist / this.maxRadius;
        if (latNorm <= 1.82) {
          const sweepBack = 0.025 * Math.pow(latNorm, 1.35);
          const effT = bestT - sweepBack;
          if (effT >= 0 && effT <= 0.085) {
            const hammerReach = this.maxRadius * 1.82 * Math.sin(clamp(effT / 0.085, 0.16, 1.0) * Math.PI);
            if (absDist <= hammerReach) {
              inHammer = true;
              const edgeFade = 1 - Math.abs(effT - 0.042) / 0.045;
              const tipFade = 1 - (absDist / Math.max(1, hammerReach)) * 0.35;
              density = clamp(0.55 + edgeFade * 0.42 * tipFade, 0.3, 0.98);
              if (effT > 0.024 && effT < 0.064 && latNorm > 1.36 && latNorm < 1.66) {
                isEye = true;
              }
            }
          }
        }
      }

      // 2. Torso & long whip tail
      if (!inHammer && bestT >= 0.03 && bestT <= this.maxTailT && absDist <= bodyR) {
        const normLat = absDist / Math.max(1, bodyR);
        if (bestT > 0.72) {
          const tailFade = clamp((bestT - 0.72) / (this.maxTailT - 0.72), 0, 1);
          density = clamp((1 - normLat * 0.72) * lerp(0.86, 0.44, tailFade), 0.12, 0.88);
          isFin = bestT > 0.82;
        } else {
          density = clamp((1 - normLat * normLat * 0.82) * 0.96, 0.18, 1.0);
        }
      }

      // 3. Falcate pectoral wings, pelvic fins & subterminal tail notch
      if (density < 0.18) {
        const app = this.evaluateSharkAppendages(bestT, bestSignedDist, absDist, bodyR, 2.26);
        if (app.density > density) {
          density = app.density;
          isFin = app.kind > 0;
        }
      }

      if (density <= 0.05) return false;

      if (isEye) {
        out.char = 'o';
        out.colorKey = 'eyeDark';
        out.glow = false;
        return true;
      }

      const idx = clamp(Math.floor((1 - density) * (DENSITY_CHARS.length - 0.01)), 0, DENSITY_CHARS.length - 1);
      out.char = DENSITY_CHARS[idx];

      if (isFin) {
        out.colorKey = 'hammerFin';
        out.glow = false;
        return true;
      }

      const normLat = absDist / Math.max(1, bodyR);
      const isGillTick =
        !inHammer && bestT > 0.17 && bestT < 0.23 && normLat > 0.74 && Math.sin(bestT * 140) > 0.45;
      const isDorsalLine = !inHammer && bestT > 0.34 && bestT < 0.50 && absDist <= this.maxRadius * 0.13;

      if (isGillTick) {
        out.char = '·';
        out.colorKey = 'hammerEdge';
        out.glow = false;
      } else if (isDorsalLine) {
        out.char = '*';
        out.colorKey = 'hammerEdge';
        out.glow = this.isGlowingDefault;
      } else if (inHammer) {
        out.colorKey = absDist > this.maxRadius * 1.48 ? 'hammerEdge' : 'hammerDark';
        out.glow = this.isGlowingDefault && absDist > this.maxRadius * 1.48;
      } else if (normLat < 0.56) {
        out.colorKey = 'hammerDark';
        out.glow = this.isGlowingDefault && density > 0.65;
      } else {
        out.colorKey = normLat > 0.84 ? 'hammerEdge' : 'hammerMid';
        out.glow = this.isGlowingDefault && normLat > 0.84;
      }
      return true;
    }
  }

  /* ---------------------------------------------------------
   * Main Engine (Multi-Species Boids, Pooling & Atlas Render)
   * --------------------------------------------------------- */
  class KoiPondEngine {
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
      this.kois = [];

      if (this.ecosystem && this.ecosystem.setOnPetalLand) {
        this.ecosystem.setOnPetalLand((x, y) => {
          this.spawnRipple(x, y, 42, 0.85, 0.36);
        });
      }

      // Pre-allocated Object Pool: 30 food pellets
      this.foodPool = new Array(FOOD_POOL_SIZE);
      for (let i = 0; i < FOOD_POOL_SIZE; i++) {
        this.foodPool[i] = { active: false, x: 0, y: 0, age: 0, vx: 0, vy: 0 };
      }
      this.foodCursor = 0;

      // Pre-allocated Object Pool: 60 concentric ripples
      this.ripplePool = new Array(RIPPLE_POOL_SIZE);
      for (let i = 0; i < RIPPLE_POOL_SIZE; i++) {
        this.ripplePool[i] = {
          active: false,
          x: 0,
          y: 0,
          age: 0,
          duration: 1,
          maxRadius: 80,
          intensity: 0.7,
          alt: false
        };
      }
      this.rippleCursor = 0;
      this.rippleSeq = 0;

      // Pre-allocated Object Pool: 140 wake/trail glyphs
      this.trailPool = new Array(TRAIL_POOL_SIZE);
      for (let i = 0; i < TRAIL_POOL_SIZE; i++) {
        this.trailPool[i] = {
          active: false,
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          age: 0,
          life: 1,
          char: '·',
          colorKey: null
        };
      }
      this.trailCursor = 0;

      // Pre-allocated Object Pool: 45 Baitfish micro-school
      this.schoolEnabled = Boolean(options.schoolEnabled);
      this.baitPool = new Array(BAIT_POOL_SIZE);
      for (let i = 0; i < BAIT_POOL_SIZE; i++) {
        this.baitPool[i] = {
          x: 0,
          y: 0,
          vx: 0,
          vy: 0,
          heading: 0,
          baseSpeed: 68,
          neon: i % 3 === 0
        };
      }
      this.initBaitSchool();

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

      this.resize();
      this.syncPopulation();

      this.handleResize = this.resize.bind(this);
      this.handleVisibilityChange = this.onVisibilityChange.bind(this);
      this.loop = this.frameLoop.bind(this);

      window.addEventListener('resize', this.handleResize);
      document.addEventListener('visibilitychange', this.handleVisibilityChange);
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
    }

    setObstacleRect(rect) {
      this.obstacleRect = rect;
      if (this.ecosystem) {
        this.ecosystem.setObstacleRect(rect);
      }
    }

    setStonesRect(rect) {
      this.stonesRect = rect;
    }

    setSpecies(speciesMap) {
      this.enabledSpecies = Object.assign({}, this.enabledSpecies, speciesMap);
      this.syncPopulation();
    }

    setSchoolEnabled(enabled) {
      this.schoolEnabled = Boolean(enabled);
    }

    initBaitSchool() {
      const cx = randRange(this.width * 0.2, this.width * 0.8);
      const cy = randRange(this.height * 0.2, this.height * 0.8);
      const baseAngle = randRange(0, Math.PI * 2);
      for (let i = 0; i < BAIT_POOL_SIZE; i++) {
        const b = this.baitPool[i];
        const angle = baseAngle + randRange(-0.4, 0.4);
        b.x = cx + randRange(-95, 95);
        b.y = cy + randRange(-65, 65);
        b.heading = angle;
        b.baseSpeed = randRange(66, 86);
        b.vx = Math.cos(angle) * b.baseSpeed;
        b.vy = Math.sin(angle) * b.baseSpeed;
      }
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

      // Balanced mixed ecosystem (respecting giant sizing)
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

      for (let i = 0; i < this.kois.length; i++) {
        const c = this.kois[i];
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

      this.kois = nextList;
    }

    activateFoodSlot(x, y, delay = 0) {
      let slot = null;
      for (let i = 0; i < FOOD_POOL_SIZE; i++) {
        const idx = (this.foodCursor + i) % FOOD_POOL_SIZE;
        if (!this.foodPool[idx].active) {
          slot = this.foodPool[idx];
          this.foodCursor = (idx + 1) % FOOD_POOL_SIZE;
          break;
        }
      }
      if (!slot) {
        slot = this.foodPool[this.foodCursor];
        this.foodCursor = (this.foodCursor + 1) % FOOD_POOL_SIZE;
      }
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
            fy = Math.random() > 0.5
              ? Math.max(70, r.top - randRange(45, 120))
              : Math.min(this.height - 70, r.bottom + randRange(45, 120));
          }
        }

        this.activateFoodSlot(fx, fy, i * 0.08);
        this.spawnRipple(fx, fy, 92, 1.25, 0.75);
      }
    }

    spawnRipple(x, y, maxRadius = 85, duration = 1.2, intensity = 0.7) {
      let slot = null;
      for (let i = 0; i < RIPPLE_POOL_SIZE; i++) {
        const idx = (this.rippleCursor + i) % RIPPLE_POOL_SIZE;
        if (!this.ripplePool[idx].active) {
          slot = this.ripplePool[idx];
          this.rippleCursor = (idx + 1) % RIPPLE_POOL_SIZE;
          break;
        }
      }
      if (!slot) {
        slot = this.ripplePool[this.rippleCursor];
        this.rippleCursor = (this.rippleCursor + 1) % RIPPLE_POOL_SIZE;
      }
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
      let slot = null;
      for (let i = 0; i < TRAIL_POOL_SIZE; i++) {
        const idx = (this.trailCursor + i) % TRAIL_POOL_SIZE;
        if (!this.trailPool[idx].active) {
          slot = this.trailPool[idx];
          this.trailCursor = (idx + 1) % TRAIL_POOL_SIZE;
          break;
        }
      }
      if (!slot) {
        slot = this.trailPool[this.trailCursor];
        this.trailCursor = (this.trailCursor + 1) % TRAIL_POOL_SIZE;
      }
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

        if (this.ecosystem && this.ecosystem.planktonEnabled) {
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
      window.removeEventListener('resize', this.handleResize);
      document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    }

    frameLoop(now) {
      if (!this.running || this.pausedByVisibility) return;

      const dt = Math.min(Math.max(0, (now - this.lastFrameTime) / 1000), 0.05);
      this.lastFrameTime = now;

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

      for (let i = 0; i < RIPPLE_POOL_SIZE; i++) {
        const r = this.ripplePool[i];
        if (!r.active) continue;
        r.age += dt;
        if (r.age >= r.duration) {
          r.active = false;
        }
      }

      for (let i = 0; i < TRAIL_POOL_SIZE; i++) {
        const p = this.trailPool[i];
        if (!p.active) continue;
        p.age += dt;
        if (p.age >= p.life) {
          p.active = false;
          continue;
        }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.96;
        p.vy *= 0.96;
      }

      for (let i = 0; i < FOOD_POOL_SIZE; i++) {
        const f = this.foodPool[i];
        if (!f.active) continue;
        f.age += dt;
        if (f.age < 0) continue;

        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.vx *= 0.97;
        f.vy *= 0.97;

        let eaten = false;
        for (let k = 0; k < this.kois.length; k++) {
          const c = this.kois[k];
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

      for (let i = 0; i < this.kois.length; i++) {
        this.kois[i].updatePhysics(
          dt,
          this.width,
          this.height,
          this.kois,
          this.foodPool,
          this.mouse,
          this.obstacleRect,
          this.stonesRect,
          this.ecosystem,
          this
        );
      }

      this.kois.sort((a, b) => a.depth - b.depth);

      if (this.schoolEnabled) {
        this.updateBaitSchool(dt);
      }
    }

    updateBaitSchool(dt) {
      const margin = 55;
      for (let i = 0; i < BAIT_POOL_SIZE; i++) {
        const b = this.baitPool[i];
        let sepX = 0;
        let sepY = 0;
        let aliX = 0;
        let aliY = 0;
        let cohX = 0;
        let cohY = 0;
        let aliCount = 0;
        let cohCount = 0;

        for (let j = 0; j < BAIT_POOL_SIZE; j++) {
          if (i === j) continue;
          const o = this.baitPool[j];
          const dx = o.x - b.x;
          const dy = o.y - b.y;
          const dSq = dx * dx + dy * dy;
          if (dSq < 1) continue;

          if (dSq < 484) {
            const d = Math.sqrt(dSq);
            sepX -= (dx / d) * ((22 - d) / 22);
            sepY -= (dy / d) * ((22 - d) / 22);
          }
          if (dSq < 6400) {
            aliX += o.vx;
            aliY += o.vy;
            aliCount++;
            cohX += o.x;
            cohY += o.y;
            cohCount++;
          }
        }

        let steerX = sepX * 195;
        let steerY = sepY * 195;
        if (aliCount > 0) {
          steerX += (aliX / aliCount - b.vx) * 1.4;
          steerY += (aliY / aliCount - b.vy) * 1.4;
        }
        if (cohCount > 0) {
          steerX += (cohX / cohCount - b.x) * 0.85;
          steerY += (cohY / cohCount - b.y) * 0.85;
        }

        // Predator evasion & vortex swirl around Sharks / Turtles / Koi
        let fleeBoost = 0;
        for (let k = 0; k < this.kois.length; k++) {
          const pred = this.kois[k];
          const isShark = pred.species === 'whaleShark' || pred.species === 'hammerhead';
          const fleeR = isShark ? 155 : 95;
          const dx = b.x - pred.centerX;
          const dy = b.y - pred.centerY;
          const dSq = dx * dx + dy * dy;
          if (dSq < fleeR * fleeR && dSq > 1) {
            const d = Math.sqrt(dSq);
            const urgency = (fleeR - d) / fleeR;
            const ux = dx / d;
            const uy = dy / d;
            const side = b.vx * -uy + b.vy * ux >= 0 ? 1 : -1;
            steerX += (ux * 260 + -uy * side * 140) * urgency;
            steerY += (uy * 260 + ux * side * 140) * urgency;
            if (urgency > fleeBoost) fleeBoost = urgency;
          }
        }

        // Scatter from cursor motion
        if (this.mouse.active && this.mouse.energy > 0.12) {
          const dx = b.x - this.mouse.x;
          const dy = b.y - this.mouse.y;
          const dSq = dx * dx + dy * dy;
          if (dSq < 13225 && dSq > 1) {
            const d = Math.sqrt(dSq);
            const urgency = ((115 - d) / 115) * this.mouse.energy;
            steerX += (dx / d) * urgency * 290;
            steerY += (dy / d) * urgency * 290;
            if (urgency > fleeBoost) fleeBoost = urgency;
          }
        }

        // Central card & bottom river stones avoidance
        if (this.obstacleRect && this.obstacleRect.width > 0) {
          const r = this.obstacleRect;
          if (b.x > r.left - 24 && b.x < r.right + 24 && b.y > r.top - 24 && b.y < r.bottom + 24) {
            const cx = (r.left + r.right) * 0.5;
            const cy = (r.top + r.bottom) * 0.5;
            const dx = b.x - cx;
            const dy = b.y - cy;
            const d = Math.hypot(dx, dy) || 1;
            steerX += (dx / d) * 210;
            steerY += (dy / d) * 210;
          }
        }

        if (this.stonesRect && this.stonesRect.width > 0 && b.y > this.stonesRect.top - 22) {
          steerY -= 190;
        }

        // Viewport boundaries
        if (b.x < margin) steerX += ((margin - b.x) / margin) * 220;
        else if (b.x > this.width - margin) steerX -= ((b.x - (this.width - margin)) / margin) * 220;
        if (b.y < margin) steerY += ((margin - b.y) / margin) * 220;
        else if (b.y > this.height - margin) steerY -= ((b.y - (this.height - margin)) / margin) * 220;

        const targetSpd = b.baseSpeed * (1 + fleeBoost * 0.9);
        const desiredHeading = Math.atan2(b.vy + steerY * dt, b.vx + steerX * dt);
        const dAng = clamp(angleDiff(desiredHeading, b.heading), -4.5 * dt, 4.5 * dt);
        b.heading += dAng;
        b.vx = Math.cos(b.heading) * targetSpd;
        b.vy = Math.sin(b.heading) * targetSpd;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
      }
    }

    renderBaitSchool(ctx, atlas) {
      for (let i = 0; i < BAIT_POOL_SIZE; i++) {
        const b = this.baitPool[i];
        const headChar = b.vx >= 0 ? '>' : '<';
        const colorKey = b.neon ? 'baitNeon' : 'baitSilver';
        const tx = b.x - Math.cos(b.heading) * 6.5;
        const ty = b.y - Math.sin(b.heading) * 6.5;

        ctx.globalAlpha = 0.48;
        atlas.drawGlyph(ctx, '-', colorKey, false, tx, ty, 0.78);
        ctx.globalAlpha = 0.78;
        atlas.drawGlyph(ctx, headChar, colorKey, b.neon, b.x, b.y, 0.82);
      }
      ctx.globalAlpha = 1;
    }

    render() {
      const ctx = this.ctx;
      const atlas = this.atlas;
      const theme = this.ecosystem.getTheme();

      ctx.clearRect(0, 0, this.width, this.height);

      // LAYER 1: SUBACUÁTICA
      this.ecosystem.renderSubaqueous(ctx, atlas);

      if (this.schoolEnabled) {
        this.renderBaitSchool(ctx, atlas);
      }

      for (let i = 0; i < TRAIL_POOL_SIZE; i++) {
        const p = this.trailPool[i];
        if (!p.active) continue;
        const alpha = (1 - p.age / p.life) * 0.36;
        if (alpha <= 0.02) continue;
        const gx = (Math.floor(p.x / CELL_W) + 0.5) * CELL_W;
        const gy = (Math.floor(p.y / CELL_H) + 0.5) * CELL_H;
        ctx.globalAlpha = alpha;
        atlas.drawGlyph(ctx, p.char, p.colorKey || theme.trailKey, false, gx, gy);
      }
      ctx.globalAlpha = 1;

      for (let i = 0; i < this.kois.length; i++) {
        this.kois[i].render(ctx, atlas, this.ecosystem, this.time);
      }

      // LAYER 2: SUPERFICIE
      for (let i = 0; i < RIPPLE_POOL_SIZE; i++) {
        const r = this.ripplePool[i];
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
        for (let a = 0; a < Math.PI * 2; a += stepAngle) {
          const rx = r.x + Math.cos(a) * radius;
          const ry = r.y + Math.sin(a) * radius;
          const gx = (Math.floor(rx / CELL_W) + 0.5) * CELL_W;
          const gy = (Math.floor(ry / CELL_H) + 0.5) * CELL_H;
          atlas.drawGlyph(ctx, char, colorKey, glow, gx, gy);
        }
      }

      for (let i = 0; i < FOOD_POOL_SIZE; i++) {
        const f = this.foodPool[i];
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

      // LAYER 3: ATMOSFÉRICA
      this.ecosystem.renderAtmospheric(ctx, atlas);
    }
  }

  global.KoiPondEngine = KoiPondEngine;
})(window);
