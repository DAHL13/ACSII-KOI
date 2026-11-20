import { angleDiff, clamp, randRange } from '../core/math.js';

export const BAIT_POOL_SIZE = 45;
const GRID_CELL_SIZE = 80;

export class SpatialHashGrid {
  constructor(width, height, cellSize = GRID_CELL_SIZE, capacity = BAIT_POOL_SIZE) {
    this.cellSize = cellSize;
    this.capacity = capacity;
    this.next = new Int16Array(capacity);
    this.cols = 1;
    this.rows = 1;
    this.heads = new Int16Array(1);
    this.resize(width, height);
  }

  resize(width, height) {
    this.cols = Math.max(1, Math.ceil(Math.max(1, width) / this.cellSize));
    this.rows = Math.max(1, Math.ceil(Math.max(1, height) / this.cellSize));
    const total = this.cols * this.rows;
    if (this.heads.length < total) {
      this.heads = new Int16Array(total);
    }
    this.clear();
  }

  clear() {
    this.heads.fill(-1);
  }

  insert(index, x, y) {
    const col = clamp(Math.floor(x / this.cellSize), 0, this.cols - 1);
    const row = clamp(Math.floor(y / this.cellSize), 0, this.rows - 1);
    const cell = row * this.cols + col;
    this.next[index] = this.heads[cell];
    this.heads[cell] = index;
  }

  forEachNeighbor(x, y, visitor) {
    const col = clamp(Math.floor(x / this.cellSize), 0, this.cols - 1);
    const row = clamp(Math.floor(y / this.cellSize), 0, this.rows - 1);
    const minC = Math.max(0, col - 1);
    const maxC = Math.min(this.cols - 1, col + 1);
    const minR = Math.max(0, row - 1);
    const maxR = Math.min(this.rows - 1, row + 1);
    for (let r = minR; r <= maxR; r++) {
      const rowOffset = r * this.cols;
      for (let c = minC; c <= maxC; c++) {
        let idx = this.heads[rowOffset + c];
        while (idx !== -1) {
          visitor(idx);
          idx = this.next[idx];
        }
      }
    }
  }
}

export class BaitSchool {
  constructor(width, height) {
    this.items = new Array(BAIT_POOL_SIZE);
    for (let i = 0; i < BAIT_POOL_SIZE; i++) {
      this.items[i] = {
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        heading: 0,
        cosH: 1,
        sinH: 0,
        baseSpeed: 68,
        neon: i % 3 === 0
      };
    }
    this.grid = new SpatialHashGrid(width, height, GRID_CELL_SIZE, BAIT_POOL_SIZE);
    this.init(width, height);
  }

  init(width, height) {
    this.grid.resize(width, height);
    const cx = randRange(width * 0.2, width * 0.8);
    const cy = randRange(height * 0.2, height * 0.8);
    const baseAngle = randRange(0, Math.PI * 2);
    for (let i = 0; i < BAIT_POOL_SIZE; i++) {
      const b = this.items[i];
      const angle = baseAngle + randRange(-0.4, 0.4);
      b.x = cx + randRange(-95, 95);
      b.y = cy + randRange(-65, 65);
      b.heading = angle;
      b.cosH = Math.cos(angle);
      b.sinH = Math.sin(angle);
      b.baseSpeed = randRange(66, 86);
      b.vx = b.cosH * b.baseSpeed;
      b.vy = b.sinH * b.baseSpeed;
    }
  }

  resize(width, height) {
    this.grid.resize(width, height);
    const maxX = Math.max(20, width - 20);
    const maxY = Math.max(20, height - 20);
    for (let i = 0; i < BAIT_POOL_SIZE; i++) {
      const b = this.items[i];
      b.x = clamp(b.x, 20, maxX);
      b.y = clamp(b.y, 20, maxY);
    }
  }

  update(dt, width, height, predators, mouse, obstacleRect, stonesRect) {
    const margin = 55;
    const grid = this.grid;
    const neededCols = Math.max(1, Math.ceil(Math.max(1, width) / GRID_CELL_SIZE));
    const neededRows = Math.max(1, Math.ceil(Math.max(1, height) / GRID_CELL_SIZE));
    if (neededCols !== grid.cols || neededRows !== grid.rows) {
      grid.resize(width, height);
    } else {
      grid.clear();
    }

    for (let i = 0; i < BAIT_POOL_SIZE; i++) {
      grid.insert(i, this.items[i].x, this.items[i].y);
    }

    const heads = grid.heads;
    const next = grid.next;
    const cols = grid.cols;
    const rows = grid.rows;

    for (let i = 0; i < BAIT_POOL_SIZE; i++) {
      const b = this.items[i];
      let sepX = 0;
      let sepY = 0;
      let aliX = 0;
      let aliY = 0;
      let cohX = 0;
      let cohY = 0;
      let aliCount = 0;
      let cohCount = 0;

      const cellCol = clamp(Math.floor(b.x / GRID_CELL_SIZE), 0, cols - 1);
      const cellRow = clamp(Math.floor(b.y / GRID_CELL_SIZE), 0, rows - 1);
      const minC = Math.max(0, cellCol - 1);
      const maxC = Math.min(cols - 1, cellCol + 1);
      const minR = Math.max(0, cellRow - 1);
      const maxR = Math.min(rows - 1, cellRow + 1);

      for (let r = minR; r <= maxR; r++) {
        const rowOffset = r * cols;
        for (let c = minC; c <= maxC; c++) {
          let j = heads[rowOffset + c];
          while (j !== -1) {
            if (j !== i) {
              const o = this.items[j];
              const dx = o.x - b.x;
              const dy = o.y - b.y;
              const dSq = dx * dx + dy * dy;
              if (dSq >= 1) {
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
            }
            j = next[j];
          }
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

      let fleeBoost = 0;
      for (let k = 0; k < predators.length; k++) {
        const pred = predators[k];
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

      if (mouse.active && mouse.energy > 0.12) {
        const dx = b.x - mouse.x;
        const dy = b.y - mouse.y;
        const dSq = dx * dx + dy * dy;
        if (dSq < 13225 && dSq > 1) {
          const d = Math.sqrt(dSq);
          const urgency = ((115 - d) / 115) * mouse.energy;
          steerX += (dx / d) * urgency * 290;
          steerY += (dy / d) * urgency * 290;
          if (urgency > fleeBoost) fleeBoost = urgency;
        }
      }

      if (obstacleRect && obstacleRect.width > 0) {
        const r = obstacleRect;
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

      if (stonesRect && stonesRect.width > 0 && b.y > stonesRect.top - 22) {
        steerY -= 190;
      }

      if (b.x < margin) steerX += ((margin - b.x) / margin) * 220;
      else if (b.x > width - margin) steerX -= ((b.x - (width - margin)) / margin) * 220;
      if (b.y < margin) steerY += ((margin - b.y) / margin) * 220;
      else if (b.y > height - margin) steerY -= ((b.y - (height - margin)) / margin) * 220;

      const targetSpd = b.baseSpeed * (1 + fleeBoost * 0.9);
      const desiredHeading = Math.atan2(b.vy + steerY * dt, b.vx + steerX * dt);
      const dAng = clamp(angleDiff(desiredHeading, b.heading), -4.5 * dt, 4.5 * dt);
      b.heading += dAng;
      b.cosH = Math.cos(b.heading);
      b.sinH = Math.sin(b.heading);
      b.vx = b.cosH * targetSpd;
      b.vy = b.sinH * targetSpd;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
  }

  render(ctx, atlas) {
    for (let i = 0; i < BAIT_POOL_SIZE; i++) {
      const b = this.items[i];
      const headChar = b.vx >= 0 ? '>' : '<';
      const colorKey = b.neon ? 'baitNeon' : 'baitSilver';
      const tx = b.x - b.cosH * 6.5;
      const ty = b.y - b.sinH * 6.5;

      ctx.globalAlpha = 0.48;
      atlas.drawGlyph(ctx, '-', colorKey, false, tx, ty, 0.78);
      ctx.globalAlpha = 0.78;
      atlas.drawGlyph(ctx, headChar, colorKey, b.neon, b.x, b.y, 0.82);
    }
    ctx.globalAlpha = 1;
  }
}
