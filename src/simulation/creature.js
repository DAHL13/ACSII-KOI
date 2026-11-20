import { CELL_H, CELL_W } from '../core/constants.js';
import { angleDiff, clamp, lerp, randRange } from '../core/math.js';

export class AquaticCreature {
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
    this.isGlowingDefault =
      config.isGlowingDefault !== undefined ? config.isGlowingDefault : this.depth >= 0.76;
    this.boundingRadius = config.boundingRadius || this.totalLength * 0.62;
    this.bboxPad = config.bboxPad || this.maxRadius * 2.2;
    this.maxTailT = config.maxTailT || 1.0;
    this.tailExtraProj = config.tailExtraProj || 1.0;
    this.headScanAmp = config.headScanAmp || 0;
    this.turnBias = 0;

    this.baseSpeed = config.baseSpeed;
    this.speed = this.baseSpeed;
    this.heading = randRange(0, Math.PI * 2);

    const spawnPadX = Math.min(70, Math.max(12, width * 0.25));
    const spawnPadY = Math.min(70, Math.max(12, height * 0.25));
    this.x = randRange(spawnPadX, Math.max(spawnPadX + 10, width - spawnPadX));
    this.y = randRange(spawnPadY, Math.max(spawnPadY + 10, height - spawnPadY));
    this.vx = Math.cos(this.heading) * this.speed;
    this.vy = Math.sin(this.heading) * this.speed;

    this.swimPhase = randRange(0, Math.PI * 2);
    this.wanderPhase = randRange(0, Math.PI * 2);
    this.wanderSpeed = randRange(0.4, 0.9);
    this.curiosityBias =
      config.curiosityBias !== undefined ? config.curiosityBias : randRange(0.5, 1.15);

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
    this._intersectingLilies = new Uint16Array(16);
  }

  updatePhysics(
    dt,
    width,
    height,
    neighbors,
    foodItems,
    mouse,
    obstacleRect,
    stonesRect,
    ecosystem,
    engine
  ) {
    this.wanderPhase += this.wanderSpeed * dt;

    let steerX = 0;
    let steerY = 0;

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

    const wanderAngle = this.heading + Math.sin(this.wanderPhase) * 0.68;
    steerX += Math.cos(wanderAngle) * 22;
    steerY += Math.sin(wanderAngle) * 22;

    let targetSpeed = this.baseSpeed;
    let nearestFood = null;
    let nearestFoodDist = 480;

    for (let i = 0; i < foodItems.length; i++) {
      const f = foodItems[i];
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
      const nearPetal =
        ecosystem && ecosystem.findNearestFloatingPetal
          ? ecosystem.findNearestFloatingPetal(this.x, this.y, 250)
          : null;

      if (nearPetal) {
        const dx = nearPetal.x - this.x;
        const dy = nearPetal.y - this.y;
        const d = Math.max(1, Math.hypot(dx, dy));
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
    if (ecosystem && ecosystem.isPlanktonEnabled && ecosystem.isPlanktonEnabled()) {
      if ((Math.abs(this.turnBias) > 0.55 || speedRatio > 1.15) && Math.random() < dt * 11) {
        const tail = this.nodes[this.nodeCount - 1];
        ecosystem.spawnPlankton(
          tail.x + randRange(-8, 8),
          tail.y + randRange(-8, 8),
          -this.vx * 0.12,
          -this.vy * 0.12
        );
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
        const turnCurl =
          this.turnCurlScale > 0
            ? this.turnBias * this.totalLength * this.turnCurlScale * Math.pow(t, 1.85)
            : 0;
        waveOffset = Math.sin(this.swimPhase - t * this.waveFrequency - tailLag) * amp + turnCurl;
      }

      this.nodes[i].x = this.baseNodes[i].x + nx * waveOffset;
      this.nodes[i].y = this.baseNodes[i].y + ny * waveOffset;
    }

    this.centerX = this.nodes[this.centerIdx].x;
    this.centerY = this.nodes[this.centerIdx].y;
  }

  render(ctx, atlas, ecosystem, time, viewWidth, viewHeight) {
    const lilyCount = ecosystem && ecosystem.getLilyCount ? ecosystem.getLilyCount() : 0;
    if (lilyCount > this._intersectingLilies.length) {
      this._intersectingLilies = new Uint16Array(lilyCount);
    }
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

    let startCol = Math.floor((minX - pad) / CELL_W);
    let endCol = Math.ceil((maxX + pad) / CELL_W);
    let startRow = Math.floor((minY - pad) / CELL_H);
    let endRow = Math.ceil((maxY + pad) / CELL_H);

    if (viewWidth > 0 && viewHeight > 0) {
      startCol = Math.max(0, startCol);
      endCol = Math.min(Math.ceil(viewWidth / CELL_W), endCol);
      startRow = Math.max(0, startRow);
      endRow = Math.min(Math.ceil(viewHeight / CELL_H), endRow);
      if (startCol > endCol || startRow > endRow) return;
    }

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

    const cellOut = this._cellOut || (this._cellOut = { char: '.', colorKey: 'kohakuWhite', glow: false });
    const maxReachSq = pad * pad;

    for (let row = startRow; row <= endRow; row++) {
      const py = (row + 0.5) * CELL_H;
      for (let col = startCol; col <= endCol; col++) {
        const px = (col + 0.5) * CELL_W;

        let bestDistSq = Infinity;
        let bestT = 0;
        let bestCrossPos = true;

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
            bestCrossPos = svx * dy - svy * dx >= 0;
          }
        }

        if (bestDistSq > maxReachSq) continue;
        const bestDist = Math.sqrt(bestDistSq);
        const bestSignedDist = bestCrossPos ? bestDist : -bestDist;

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
