import { DENSITY_CHARS } from '../../core/constants.js';
import { clamp, lerp, randRange } from '../../core/math.js';
import { AquaticCreature } from '../creature.js';

export class SeaTurtle extends AquaticCreature {
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
    let part = 0;

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
