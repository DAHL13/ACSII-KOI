import { DENSITY_CHARS } from '../../core/constants.js';
import { clamp, lerp, randRange } from '../../core/math.js';
import { AquaticCreature } from '../creature.js';

export class MantaRay extends AquaticCreature {
  constructor(width, height, depthOverride) {
    const depth = clamp(depthOverride !== undefined ? depthOverride : randRange(0.66, 1.12), 0.6, 1.15);
    const depthNorm = (depth - 0.6) / (1.15 - 0.6);
    const totalLength = 215 * depth * randRange(0.92, 1.08);
    const maxRadius = totalLength * 0.44;

    super(width, height, {
      species: 'mantaRay',
      depth,
      nodeCount: 9,
      totalLength,
      maxRadius,
      baseSpeed: lerp(34, 54, depthNorm) * randRange(0.93, 1.07),
      waveAmplitudeRatio: 0.04,
      waveFrequency: 3.1,
      waveStartT: 0.25,
      wavePow: 1.5,
      swimBaseRate: 2.0,
      swimSpeedRate: 2.8,
      maxTurnRate: 1.45,
      boundingRadius: totalLength * 0.68,
      bboxPad: maxRadius * 1.35,
      maxTailT: 1.06,
      tailExtraProj: 1.4
    });
  }

  wingHalfSpanAt(t) {
    if (t < 0 || t > 1.06) return 0;
    if (t < 0.08) {
      const s = t / 0.08;
      return this.maxRadius * (0.08 + 0.12 * Math.sin(s * Math.PI * 0.5));
    }
    if (t <= 0.62) {
      const flap = 1 + 0.08 * Math.sin(this.swimPhase - t * 3.4);
      const u = (t - 0.08) / 0.54;
      const diamond = u < 0.48 ? u / 0.48 : 1 - (u - 0.48) / 0.52;
      return this.maxRadius * lerp(0.18, 1.0, Math.pow(clamp(diamond, 0, 1), 0.72)) * flap;
    }
    if (t <= 0.76) {
      const s = (t - 0.62) / 0.14;
      return this.maxRadius * lerp(0.18, 0.05, s);
    }
    return this.maxRadius * 0.025;
  }

  evaluateCell(bestT, bestSignedDist, px, py, time, out) {
    const absDist = Math.abs(bestSignedDist);
    const span = this.wingHalfSpanAt(bestT);
    let density = -1;
    let part = 0;

    if (bestT >= 0 && bestT <= 0.09) {
      const lobeDist = Math.abs(absDist - this.maxRadius * 0.14);
      if (lobeDist < this.maxRadius * 0.065) {
        part = 1;
        density = 0.62 * (1 - lobeDist / (this.maxRadius * 0.065));
      }
    }

    if (bestT >= 0.06 && bestT <= 0.68 && absDist <= span) {
      const normLat = absDist / Math.max(1, span);
      if (normLat > 0.84) {
        part = 2;
        density = clamp((1 - normLat) * 4.5, 0.2, 0.76);
      } else {
        part = 0;
        const wingWave = 0.08 * Math.sin(this.swimPhase - normLat * 2.2);
        density = clamp(0.92 - normLat * 0.36 + wingWave, 0.24, 0.98);
        if (normLat > 0.22 && normLat < 0.52 && bestT > 0.22 && bestT < 0.46) {
          const gillPhase = Math.sin(bestT * 38 + normLat * 8);
          if (gillPhase > 0.75) part = 3;
        }
      }
    } else if (bestT > 0.68 && bestT <= 1.05 && absDist <= Math.max(3.6, span)) {
      part = 1;
      density = 0.42 * (1 - (bestT - 0.68) / 0.4);
    }

    if (density <= 0.06) return false;

    const idx = clamp(Math.floor((1 - density) * (DENSITY_CHARS.length - 0.01)), 0, DENSITY_CHARS.length - 1);
    out.char = DENSITY_CHARS[idx];

    if (part === 3) {
      out.colorKey = 'mantaSpot';
      out.glow = this.isGlowingDefault;
    } else if (part === 2) {
      out.colorKey = 'mantaEdge';
      out.glow = this.isGlowingDefault;
    } else if (part === 1) {
      out.colorKey = 'mantaEdge';
      out.glow = false;
    } else {
      out.colorKey = absDist < span * 0.35 ? 'mantaBack' : 'mantaWing';
      out.glow = this.isGlowingDefault && density > 0.75;
    }
    return true;
  }
}
