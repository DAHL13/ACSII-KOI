import { DENSITY_CHARS } from '../../core/constants.js';
import { clamp, lerp, randRange } from '../../core/math.js';
import { AquaticCreature } from '../creature.js';

export class GiantCarp extends AquaticCreature {
  constructor(width, height, depthOverride) {
    const depth = clamp(depthOverride !== undefined ? depthOverride : randRange(0.64, 1.14), 0.6, 1.15);
    const depthNorm = (depth - 0.6) / (1.15 - 0.6);
    const totalLength = 198 * depth * randRange(0.94, 1.07);
    const maxRadius = totalLength * 0.165;

    super(width, height, {
      species: 'giantCarp',
      depth,
      nodeCount: 13,
      totalLength,
      maxRadius,
      baseSpeed: lerp(32, 52, depthNorm) * randRange(0.92, 1.08),
      alphaMultiplier: 0.94,
      waveAmplitudeRatio: 0.095,
      waveFrequency: 4.3,
      waveStartT: 0.05,
      wavePow: 1.5,
      turnCurlScale: 0.24,
      swimBaseRate: 2.7,
      swimSpeedRate: 4.8,
      maxTurnRate: 1.85,
      boundingRadius: totalLength * 0.64,
      bboxPad: maxRadius * 2.4,
      maxTailT: 1.1,
      tailExtraProj: 1.65
    });
  }

  bodyRadiusAt(t) {
    if (t < 0 || t > 0.9) return 0;
    if (t < 0.24) {
      const s = t / 0.24;
      return this.maxRadius * Math.pow(Math.sin(s * Math.PI * 0.5), 0.74);
    }
    const s = (t - 0.24) / 0.66;
    return this.maxRadius * (0.14 + 0.86 * Math.pow(Math.max(0, 1 - s), 1.32));
  }

  evaluateCell(bestT, bestSignedDist, px, py, time, out) {
    const absDist = Math.abs(bestSignedDist);
    const bodyR = this.bodyRadiusAt(bestT);
    let density = -1;
    let isFin = false;
    let isEye = false;

    if (bestT >= 0 && bestT <= 0.88 && absDist <= bodyR) {
      const norm = absDist / Math.max(1, bodyR);
      density = Math.pow(clamp(1 - norm * norm * 0.85, 0, 1), 0.72);
      if (bestT > 0.06 && bestT < 0.13 && norm > 0.44 && norm < 0.76) {
        isEye = true;
      }
    }

    if (density < 0.25 && bestT > 0.22 && bestT < 0.54) {
      const pecWave = Math.sin(this.swimPhase * 0.9 - bestT * 4) * 0.04;
      const finReach = bodyR + this.maxRadius * (1.28 + pecWave);
      const u = (bestT - 0.22) / 0.32;
      if (absDist > bodyR * 0.78 && absDist < finReach) {
        const edge = Math.sin(u * Math.PI);
        if (edge > 0.12) {
          const dFin = ((finReach - absDist) / (finReach - bodyR * 0.78)) * edge * 0.76;
          if (dFin > density) {
            density = dFin;
            isFin = true;
          }
        }
      }
    }

    if (bestT > 0.80 && bestT <= 1.1) {
      const s = (bestT - 0.80) / 0.30;
      const veilReach = this.maxRadius * lerp(0.18, 1.35, Math.pow(s, 0.75));
      if (absDist <= veilReach) {
        const fork = 0.72 + 0.28 * Math.sin(Math.min(1, absDist / Math.max(1, veilReach)) * Math.PI * 0.85);
        const veilD = (1 - s * 0.42) * fork * 0.78;
        if (veilD > density) {
          density = veilD;
          isFin = true;
        }
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
      out.colorKey = density > 0.45 ? 'carpFinAmber' : 'carpCream';
      out.glow = this.isGlowingDefault && density > 0.35;
    } else {
      const scaleWave = Math.sin(bestT * 26 + (bestSignedDist / Math.max(1, bodyR)) * 5);
      out.colorKey = scaleWave > 0.25 ? 'carpGoldBright' : 'carpGoldDeep';
      out.glow = this.isGlowingDefault && (bestT < 0.25 || density > 0.65);
    }
    return true;
  }
}
