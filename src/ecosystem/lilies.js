import { CELL_H, CELL_W } from '../core/constants.js';
import { clamp, dampFactor, randRange } from '../core/math.js';

function resolveCircleRectObstacle(circle, rect, pad, restitution = 1.55) {
  if (!rect || rect.width <= 0 || rect.height <= 0) return;
  const closestX = clamp(circle.x, rect.left - pad, rect.right + pad);
  const closestY = clamp(circle.y, rect.top - pad, rect.bottom + pad);
  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  const dist = Math.hypot(dx, dy);

  if (dist < circle.radius) {
    const nx = dist > 0.001 ? dx / dist : 0;
    const ny = dist > 0.001 ? dy / dist : -1;
    const overlap = circle.radius - dist;
    circle.x += nx * overlap;
    circle.y += ny * overlap;

    const vn = circle.vx * nx + circle.vy * ny;
    if (vn < 0) {
      circle.vx -= restitution * vn * nx;
      circle.vy -= restitution * vn * ny;
    }
  }
}

export class LilyPadLayer {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.lilies = [];
    this.init();
  }

  init() {
    const count = 4 + Math.floor(Math.random() * 4);
    this.lilies = new Array(count);
    const padMargin = Math.min(75, Math.max(16, Math.min(this.width, this.height) * 0.2));

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
      const angle = randRange(0, Math.PI * 2);

      this.lilies[i] = {
        x,
        y,
        vx: Math.cos(dir) * speed,
        vy: Math.sin(dir) * speed,
        radius,
        angle,
        cosNegAngle: Math.cos(-angle),
        sinNegAngle: Math.sin(-angle),
        angVel: randRange(-0.07, 0.07),
        notchHalfAngle: randRange(0.24, 0.34),
        hasFlower: i < 3 ? i % 2 === 0 : Math.random() < 0.45,
        flowerTone: Math.random() < 0.6 ? 'pink' : 'white',
        flowerOffsetAngle: randRange(0, Math.PI * 2),
        _cacheCanvas: null,
        _cachePhase: '',
        _cacheDpr: 0,
        _cacheLogicalSize: 0
      };
    }
  }

  resize(width, height) {
    this.width = width;
    this.height = height;
    for (let i = 0; i < this.lilies.length; i++) {
      const l = this.lilies[i];
      const minX = l.radius + 10;
      const maxX = width - l.radius - 10;
      const minY = l.radius + 10;
      const maxY = height - l.radius - 10;
      l.x = maxX >= minX ? clamp(l.x, minX, maxX) : width * 0.5;
      l.y = maxY >= minY ? clamp(l.y, minY, maxY) : height * 0.5;
    }
  }

  testCircleIntersects(cx, cy, radius, outIndices) {
    if (this.lilies.length === 0 || !outIndices || outIndices.length === 0) {
      return 0;
    }
    const maxHits = outIndices.length;
    let hitCount = 0;
    for (let i = 0; i < this.lilies.length; i++) {
      const l = this.lilies[i];
      const sumR = radius + l.radius * 1.04;
      const dx = cx - l.x;
      const dy = cy - l.y;
      if (dx * dx + dy * dy <= sumR * sumR) {
        if (hitCount < maxHits) {
          outIndices[hitCount++] = i;
        } else {
          break;
        }
      }
    }
    return hitCount;
  }

  isOccludedInList(px, py, indices, count) {
    const limit = Math.min(count, indices.length);
    for (let i = 0; i < limit; i++) {
      const l = this.lilies[indices[i]];
      if (!l) continue;
      const dx = px - l.x;
      const dy = py - l.y;
      const maxR = l.radius * 1.02;
      if (dx * dx + dy * dy > maxR * maxR) continue;

      const cos = l.cosNegAngle !== undefined ? l.cosNegAngle : Math.cos(-l.angle);
      const sin = l.sinNegAngle !== undefined ? l.sinNegAngle : Math.sin(-l.angle);
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

  update(dt, obstacleRect, stonesRect) {
    const margin = 12;
    const lilyDamp = dampFactor(0.99, dt);

    for (let i = 0; i < this.lilies.length; i++) {
      const l = this.lilies[i];
      l.x += l.vx * dt;
      l.y += l.vy * dt;
      l.angle += l.angVel * dt;

      const speed = Math.hypot(l.vx, l.vy);
      if (speed > 13) {
        l.vx *= lilyDamp;
        l.vy *= lilyDamp;
      } else if (speed < 3.5) {
        l.vx += randRange(-1.5, 1.5) * dt;
        l.vy += randRange(-1.5, 1.5) * dt;
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

    for (let i = 0; i < this.lilies.length; i++) {
      const l = this.lilies[i];
      resolveCircleRectObstacle(l, obstacleRect, 16, 1.55);
      resolveCircleRectObstacle(l, stonesRect, 14, 1.55);

      const minX = margin + l.radius;
      const maxX = this.width - margin - l.radius;
      if (maxX < minX) {
        l.x = this.width * 0.5;
      } else if (l.x < minX) {
        l.x = minX;
        l.vx = Math.abs(l.vx);
        l.angVel = -l.angVel;
      } else if (l.x > maxX) {
        l.x = maxX;
        l.vx = -Math.abs(l.vx);
        l.angVel = -l.angVel;
      }

      const minY = margin + l.radius;
      const maxY = this.height - margin - l.radius;
      if (maxY < minY) {
        l.y = this.height * 0.5;
      } else if (l.y < minY) {
        l.y = minY;
        l.vy = Math.abs(l.vy);
      } else if (l.y > maxY) {
        l.y = maxY;
        l.vy = -Math.abs(l.vy);
      }

      l.cosNegAngle = Math.cos(-l.angle);
      l.sinNegAngle = Math.sin(-l.angle);
    }
  }

  ensureCache(lily, atlas, theme, solarPhase, flowerGlow) {
    if (
      lily._cacheCanvas &&
      lily._cachePhase === solarPhase &&
      lily._cacheDpr === atlas.dpr
    ) {
      return lily._cacheCanvas;
    }

    const logicalSize = Math.ceil((lily.radius * 1.1 + 14) * 2);
    const pxSize = Math.ceil(logicalSize * atlas.dpr);
    let cache = lily._cacheCanvas;
    if (!cache || cache.width !== pxSize || cache.height !== pxSize) {
      if (typeof OffscreenCanvas !== 'undefined') {
        cache = new OffscreenCanvas(pxSize, pxSize);
      } else {
        cache = document.createElement('canvas');
        cache.width = pxSize;
        cache.height = pxSize;
      }
    }

    const cctx = cache.getContext('2d');
    cctx.setTransform(atlas.dpr, 0, 0, atlas.dpr, 0, 0);
    cctx.clearRect(0, 0, logicalSize, logicalSize);
    cctx.globalAlpha = 1;

    const half = logicalSize * 0.5;
    const pad = lily.radius;
    const maxRSq = pad * 1.06 * (pad * 1.06);
    const startCol = Math.floor((half - pad - CELL_W) / CELL_W);
    const endCol = Math.ceil((half + pad + CELL_W) / CELL_W);
    const startRow = Math.floor((half - pad - CELL_H) / CELL_H);
    const endRow = Math.ceil((half + pad + CELL_H) / CELL_H);

    const petalKey =
      lily.flowerTone === 'pink'
        ? solarPhase === 'night'
          ? 'lotusPinkDeep'
          : 'lotusPink'
        : 'lotusWhite';

    for (let row = startRow; row <= endRow; row++) {
      const py = (row + 0.5) * CELL_H;
      const dy = py - half;
      for (let col = startCol; col <= endCol; col++) {
        const px = (col + 0.5) * CELL_W;
        const dx = px - half;

        const rSq = dx * dx + dy * dy;
        if (rSq > maxRSq) continue;

        const theta = Math.atan2(dy, dx);
        if (Math.abs(theta) < lily.notchHalfAngle) continue;

        const r = Math.sqrt(rSq);
        const nr = r / pad;
        const organicEdge = 1.0 + 0.04 * Math.sin(theta * 7);
        if (nr > organicEdge) continue;

        if (lily.hasFlower && nr < 0.34) {
          const petalShape = 0.25 + 0.09 * Math.cos((theta - lily.flowerOffsetAngle) * 6);
          if (nr < 0.1) {
            atlas.drawGlyph(cctx, nr < 0.05 ? '@' : '*', 'lotusStamen', true, px, py);
            continue;
          }
          if (nr < petalShape) {
            const pChar = nr < 0.18 ? '@' : nr < 0.26 ? '*' : '+';
            atlas.drawGlyph(cctx, pChar, petalKey, flowerGlow, px, py);
            continue;
          }
        }

        if (nr > 0.87) {
          atlas.drawGlyph(cctx, nr > 0.94 ? '.' : '~', theme.lilyRimKey, false, px, py);
        } else if (Math.abs(Math.sin(theta * 8)) > 0.93 && nr > 0.2) {
          atlas.drawGlyph(cctx, nr < 0.55 ? '@' : '#', theme.lilyVeinKey, false, px, py);
        } else {
          const char = nr < 0.35 ? '@' : nr < 0.62 ? '#' : nr < 0.78 ? '%' : '~';
          atlas.drawGlyph(cctx, char, theme.lilyMidKey, false, px, py);
        }
      }
    }

    lily._cacheCanvas = cache;
    lily._cachePhase = solarPhase;
    lily._cacheDpr = atlas.dpr;
    lily._cacheLogicalSize = logicalSize;
    return cache;
  }

  render(ctx, atlas, theme, solarPhase) {
    const padAlpha = solarPhase === 'night' ? 0.85 : 0.95;
    const flowerGlow = solarPhase === 'night';

    for (let i = 0; i < this.lilies.length; i++) {
      const lily = this.lilies[i];
      const cache = this.ensureCache(lily, atlas, theme, solarPhase, flowerGlow);
      const half = lily._cacheLogicalSize * 0.5;
      ctx.save();
      ctx.globalAlpha = padAlpha;
      ctx.translate(lily.x, lily.y);
      ctx.rotate(lily.angle);
      ctx.drawImage(cache, -half, -half, lily._cacheLogicalSize, lily._cacheLogicalSize);
      ctx.restore();
    }
  }
}
