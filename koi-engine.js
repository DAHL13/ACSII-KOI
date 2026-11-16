(function (global) {
  'use strict';

  const DENSITY_CHARS = ['@', '#', '%', '*', '+', ':', '.'];
  const RIPPLE_CHARS = ['*', '+', ':', '~', '·'];
  const CELL_W = 8.5;
  const CELL_H = 11.5;

  const RIPPLE_POOL_SIZE = 60;
  const FOOD_POOL_SIZE = 30;
  const TRAIL_POOL_SIZE = 140;

  const VARIETY_COLOR_KEYS = {
    kohaku: {
      base: 'kohakuWhite',
      spotA: 'vermilion',
      spotB: 'crimson',
      fin: 'kohakuFin',
      eye: 'eyeDark'
    },
    yamabuki: {
      base: 'goldOgon',
      spotA: 'goldHighlight',
      spotB: 'goldOgon',
      fin: 'goldFin',
      eye: 'eyeDark'
    },
    showa: {
      base: 'sumiCharcoal',
      spotA: 'vermilion',
      spotB: 'tanchoWhite',
      fin: 'sumiFin',
      eye: 'eyeDark'
    },
    asagi: {
      base: 'asagiBlue',
      spotA: 'asagiOrange',
      spotB: 'asagiLight',
      fin: 'asagiOrange',
      eye: 'eyeDark'
    },
    tancho: {
      base: 'tanchoWhite',
      spotA: 'crimson',
      spotB: 'tanchoWhite',
      fin: 'kohakuFin',
      eye: 'eyeDark'
    },
    butterfly: {
      base: 'ghostCyan',
      spotA: 'ghostBright',
      spotB: 'ghostFin',
      fin: 'ghostFin',
      eye: 'eyeDark'
    }
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
      patches.push({
        type: 'A',
        u: 0.25,
        v: 0,
        ru: 0.24,
        rv: 0.55,
        phase: randRange(0, Math.PI * 2)
      });
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
      patches.push({
        type: 'A',
        u: 0.24,
        v: 0,
        ru: 0.22,
        rv: 0.46,
        phase: randRange(0, Math.PI * 2)
      });
    }
    return patches;
  }

  class KoiFish {
    constructor(width, height, depthOverride, varietyOverride) {
      this.depth = depthOverride !== undefined ? clamp(depthOverride, 0.6, 1.15) : randRange(0.6, 1.15);
      this.depthNorm = (this.depth - 0.6) / (1.15 - 0.6);
      this.variety = varietyOverride || pickGeneticVariety();
      this.isButterfly = this.variety === 'butterfly';
      this.isTancho = this.variety === 'tancho';
      this.colorKeys = VARIETY_COLOR_KEYS[this.variety];

      this.nodeCount = 12;
      this.totalLength = 152 * this.depth * randRange(0.94, 1.06);
      this.maxRadius = this.totalLength * randRange(0.148, 0.17);
      this.segLength = this.totalLength / (this.nodeCount - 1);

      this.finScale = this.isButterfly ? 1.45 : 1.0;
      this.alphaMultiplier = this.isButterfly ? 0.58 : 1.0;
      this.isGlowingDefault = this.isButterfly || this.depth >= 0.76;
      this.boundingRadius = this.totalLength * (this.isButterfly ? 0.68 : 0.58);
      this.ghostTrailTimer = 0;

      const angle = randRange(0, Math.PI * 2);
      this.baseSpeed = lerp(38, 66, this.depthNorm) * randRange(0.92, 1.08);
      this.speed = this.baseSpeed;
      this.heading = angle;

      const x = randRange(65, Math.max(130, width - 65));
      const y = randRange(65, Math.max(130, height - 65));
      this.x = x;
      this.y = y;
      this.vx = Math.cos(angle) * this.speed;
      this.vy = Math.sin(angle) * this.speed;

      this.swimPhase = randRange(0, Math.PI * 2);
      this.wanderPhase = randRange(0, Math.PI * 2);
      this.wanderSpeed = randRange(0.45, 0.95);
      this.curiosityBias = randRange(0.5, 1.15);

      this.patches = createMarkings(this.variety);

      this.baseNodes = new Array(this.nodeCount);
      this.nodes = new Array(this.nodeCount);
      for (let i = 0; i < this.nodeCount; i++) {
        const nx = x - Math.cos(angle) * this.segLength * i;
        const ny = y - Math.sin(angle) * this.segLength * i;
        this.baseNodes[i] = { x: nx, y: ny };
        this.nodes[i] = { x: nx, y: ny };
      }

      this.centerX = this.nodes[5].x;
      this.centerY = this.nodes[5].y;

      // Pre-allocated typed segment buffers (zero per-frame allocations)
      const segCount = this.nodeCount - 1;
      this.segAx = new Float64Array(segCount);
      this.segAy = new Float64Array(segCount);
      this.segVx = new Float64Array(segCount);
      this.segVy = new Float64Array(segCount);
      this.segLenSq = new Float64Array(segCount);

      // Pre-allocated lily pad intersection list
      this._intersectingLilies = new Uint8Array(16);
    }

    bodyRadiusAt(t) {
      const maxT = this.isButterfly ? 1.095 : 1.0;
      if (t < 0 || t > maxT) return 0;
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

    updatePhysics(dt, width, height, neighbors, foodPool, mouse, obstacleRect, stonesRect, ecosystem, engine) {
      this.wanderPhase += this.wanderSpeed * dt;

      let steerX = 0;
      let steerY = 0;

      // 1. Boids: Separation, Alignment, Cohesion
      let sepX = 0;
      let sepY = 0;
      let aliX = 0;
      let aliY = 0;
      let cohX = 0;
      let cohY = 0;
      let aliCount = 0;
      let cohCount = 0;

      const sepRadius = 56 + this.maxRadius * 1.4;
      const sepRadiusSq = sepRadius * sepRadius;
      const neighborRadius = 175 + this.depthNorm * 55;
      const neighborRadiusSq = neighborRadius * neighborRadius;

      for (let i = 0; i < neighbors.length; i++) {
        const other = neighbors[i];
        if (other === this) continue;

        const depthDist = Math.abs(this.depth - other.depth);
        const dx = other.x - this.x;
        const dy = other.y - this.y;
        const distSq = dx * dx + dy * dy;
        if (distSq < 1) continue;

        if (depthDist < 0.22 && distSq < sepRadiusSq) {
          const dist = Math.sqrt(distSq);
          const force = (sepRadius - dist) / sepRadius;
          sepX -= (dx / dist) * force;
          sepY -= (dy / dist) * force;
        }

        if (depthDist < 0.28 && distSq < neighborRadiusSq) {
          aliX += other.vx;
          aliY += other.vy;
          aliCount++;

          cohX += other.x;
          cohY += other.y;
          cohCount++;
        }
      }

      steerX += sepX * 95;
      steerY += sepY * 95;

      if (aliCount > 0) {
        steerX += (aliX / aliCount - this.vx) * 0.55;
        steerY += (aliY / aliCount - this.vy) * 0.55;
      }

      if (cohCount > 0) {
        steerX += (cohX / cohCount - this.x) * 0.16;
        steerY += (cohY / cohCount - this.y) * 0.16;
      }

      // 2. Organic wander
      const wanderAngle = this.heading + Math.sin(this.wanderPhase) * 0.72;
      steerX += Math.cos(wanderAngle) * 24;
      steerY += Math.sin(wanderAngle) * 24;

      // 3. Pooled food detection
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
        steerX += (dx / d) * (165 + urgency * 145);
        steerY += (dy / d) * (165 + urgency * 145);
        targetSpeed = this.baseSpeed * (1.35 + urgency * 0.65);
      } else {
        // Gentle curiosity toward floating Sakura cherry blossom petals
        let nearPetal = null;
        let nearPetalDist = 260;
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
          // Orbit curiously around floating petal when close, swim gently toward it when far
          const orbitPull = d < 75 ? -0.35 : 0.65;
          const tangentDir = this.vx * -uy + this.vy * ux >= 0 ? 1 : -1;
          steerX += (ux * orbitPull + -uy * tangentDir * 0.75) * 62 * this.curiosityBias;
          steerY += (uy * orbitPull + ux * tangentDir * 0.75) * 62 * this.curiosityBias;
          targetSpeed = this.baseSpeed * 1.12;
        } else if (mouse.active && mouse.energy > 0.05) {
          const dx = mouse.x - this.x;
          const dy = mouse.y - this.y;
          const d = Math.hypot(dx, dy);
          if (d > 55 && d < 280) {
            const pull = (1 - d / 280) * mouse.energy * this.curiosityBias;
            steerX += (dx / d) * pull * 52;
            steerY += (dy / d) * pull * 52;
          }
        }
      }

      // 4. Obstacle avoidance around central UI search card & bottom river stones
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
      const margin = 85;
      if (this.x < margin) steerX += ((margin - this.x) / margin) * 155;
      else if (this.x > width - margin) steerX -= ((this.x - (width - margin)) / margin) * 155;

      if (this.y < margin) steerY += ((margin - this.y) / margin) * 155;
      else if (this.y > height - margin) steerY -= ((this.y - (height - margin)) / margin) * 155;

      const desiredVx = this.vx + steerX * dt;
      const desiredVy = this.vy + steerY * dt;
      const desiredHeading = Math.atan2(desiredVy, desiredVx);

      const maxTurn = (2.1 + (targetSpeed / this.baseSpeed) * 0.7) * dt;
      const dAngle = clamp(angleDiff(desiredHeading, this.heading), -maxTurn, maxTurn);
      this.heading += dAngle;

      this.speed = lerp(this.speed, targetSpeed, clamp(dt * 3.2, 0, 1));
      this.vx = Math.cos(this.heading) * this.speed;
      this.vy = Math.sin(this.heading) * this.speed;

      this.x += this.vx * dt;
      this.y += this.vy * dt;

      const speedRatio = this.speed / Math.max(1, this.baseSpeed);
      this.swimPhase += (3.1 + speedRatio * 5.6) * dt;

      this.updateSpine();

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

    updateSpine() {
      this.baseNodes[0].x = this.x;
      this.baseNodes[0].y = this.y;
      this.nodes[0].x = this.x;
      this.nodes[0].y = this.y;

      for (let i = 1; i < this.nodeCount; i++) {
        const prev = this.baseNodes[i - 1];
        const curr = this.baseNodes[i];
        const dx = curr.x - prev.x;
        const dy = curr.y - prev.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        curr.x = prev.x + (dx / dist) * this.segLength;
        curr.y = prev.y + (dy / dist) * this.segLength;
      }

      const maxWave = this.totalLength * 0.088;
      for (let i = 1; i < this.nodeCount; i++) {
        const t = i / (this.nodeCount - 1);
        const prev = this.baseNodes[i - 1];
        const next = this.baseNodes[Math.min(this.nodeCount - 1, i + 1)];
        let tx = prev.x - next.x;
        let ty = prev.y - next.y;
        const tLen = Math.hypot(tx, ty) || 1;
        tx /= tLen;
        ty /= tLen;

        const nx = -ty;
        const ny = tx;

        const amp = maxWave * (0.04 + 0.96 * Math.pow(t, 1.55));
        const waveOffset = Math.sin(this.swimPhase - t * 4.5) * amp;

        this.nodes[i].x = this.baseNodes[i].x + nx * waveOffset;
        this.nodes[i].y = this.baseNodes[i].y + ny * waveOffset;
      }

      this.centerX = this.nodes[5].x;
      this.centerY = this.nodes[5].y;
    }

    getMarkType(t, vNorm, px, py) {
      if (this.isTancho) {
        const headNode = this.nodes[1];
        const spotRadius = this.maxRadius * 0.46;
        const dx = px - headNode.x;
        const dy = py - headNode.y;
        if (dx * dx + dy * dy <= spotRadius * spotRadius) {
          return 'A';
        }
        return 'base';
      }

      if (this.variety === 'asagi') {
        for (let i = 0; i < this.patches.length; i++) {
          const p = this.patches[i];
          const du = (t - p.u) / p.ru;
          const dv = (vNorm - p.v) / p.rv;
          const warp = 1 + 0.14 * Math.sin(t * 22 + p.phase);
          if (du * du + dv * dv < warp) return 'A';
        }
        const scalePattern = Math.sin(t * 48) * Math.cos(vNorm * 8.5);
        if (scalePattern > 0.56 && Math.abs(vNorm) < 0.65) return 'B';
        return 'base';
      }

      for (let i = 0; i < this.patches.length; i++) {
        const p = this.patches[i];
        const du = (t - p.u) / p.ru;
        const dv = (vNorm - p.v) / p.rv;
        const warp = 1 + 0.18 * Math.sin(t * 20 + vNorm * 5 + p.phase);
        if (du * du + dv * dv < warp) {
          return p.type;
        }
      }
      return 'base';
    }

    render(ctx, atlas, ecosystem, time) {
      const colors = this.colorKeys;

      // Broad-phase Bounding Circle test against lily pads (skip per-node occlusion if no intersection)
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
      const pad = this.maxRadius * (this.isButterfly ? 3.2 : 2.2);

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

      const flap = Math.sin(this.swimPhase - 0.9);
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

      const maxTailT = this.isButterfly ? 1.095 : 1.0;
      const baseAlpha = lerp(0.48, 0.98, this.depthNorm) * this.alphaMultiplier;
      const occludedAlpha = baseAlpha * 0.22;
      let currentOccludedState = false;
      ctx.globalAlpha = baseAlpha;

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
            const maxProj = this.isButterfly && i === lastIdx ? 2.05 : 1.0;
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

          if (bestT >= 0 && bestT <= maxTailT && absDist <= bodyR) {
            const notchStart = 0.85;
            if (bestT > notchStart) {
              const tailT = (bestT - notchStart) / (maxTailT - notchStart);
              const notchRatio = (this.isButterfly ? 0.34 : 0.28) * tailT;
              const normLat = absDist / Math.max(1, bodyR);
              if (normLat > notchRatio) {
                const finFade = (1 - normLat) * (1 - tailT * 0.48);
                density = clamp(finFade * (this.isButterfly ? 0.58 : 0.65), 0.05, 0.55);
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

          if (density <= 0.04) continue;

          let char;
          if (isEye) {
            char = 'o';
          } else {
            const idx = clamp(
              Math.floor((1 - density) * (DENSITY_CHARS.length - 0.01)),
              0,
              DENSITY_CHARS.length - 1
            );
            char = DENSITY_CHARS[idx];
          }

          let colorKey;
          if (isEye) {
            colorKey = colors.eye;
          } else if (isFin) {
            colorKey = colors.fin;
          } else {
            const vNorm = bestSignedDist / Math.max(1, bodyR);
            const mark = this.getMarkType(bestT, vNorm, px, py);
            if (mark === 'A') colorKey = colors.spotA;
            else if (mark === 'B') colorKey = colors.spotB;
            else colorKey = colors.base;
          }

          // Narrow-phase occlusion only when broad-phase circle intersected a lily pad
          const isOccluded =
            hitLilyCount > 0 ? ecosystem.isOccludedInList(px, py, this._intersectingLilies, hitLilyCount) : false;

          if (isOccluded !== currentOccludedState) {
            currentOccludedState = isOccluded;
            ctx.globalAlpha = isOccluded ? occludedAlpha : baseAlpha;
          }

          const isGlowing = !isOccluded && !isEye && this.isGlowingDefault && density > 0.25;
          atlas.drawGlyph(ctx, char, colorKey, isGlowing, px, py);
        }
      }

      ctx.globalAlpha = 1;
    }
  }

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

      // Performance telemetry (zero allocations)
      this.fps = 60;
      this.frameTimeMs = 0;
      this.fpsSampleStart = 0;
      this.fpsFrameCount = 0;
      this.onMetrics = options.onMetrics || null;

      this.resize();
      this.syncFishCount(this.fishCount);

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

    syncFishCount(targetCount) {
      const count = clamp(Math.round(targetCount), 5, 25);
      this.fishCount = count;

      while (this.kois.length < count) {
        const idx = this.kois.length;
        const depth = lerp(0.6, 1.15, (idx * 0.6180339887) % 1);
        this.kois.push(new KoiFish(this.width, this.height, depth));
      }

      if (this.kois.length > count) {
        this.kois.length = count;
      }
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

      // Pooled concentric ripples
      for (let i = 0; i < RIPPLE_POOL_SIZE; i++) {
        const r = this.ripplePool[i];
        if (!r.active) continue;
        r.age += dt;
        if (r.age >= r.duration) {
          r.active = false;
        }
      }

      // Pooled trail particles
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

      // Pooled food pellets
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
          const koi = this.kois[k];
          const dx = koi.x - f.x;
          const dy = koi.y - f.y;
          const eatR = 18 + koi.maxRadius * 0.4;
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
    }

    render() {
      const ctx = this.ctx;
      const atlas = this.atlas;
      const theme = this.ecosystem.getTheme();

      ctx.clearRect(0, 0, this.width, this.height);

      // LAYER 1: SUBACUÁTICA
      this.ecosystem.renderSubaqueous(ctx, atlas);

      // Wake & ghost trails (zero fillText / shadowBlur)
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

      // LAYER 2: SUPERFICIE (Ondas, Pellets y Nenúfares)
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

      // Pooled food pellets
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
