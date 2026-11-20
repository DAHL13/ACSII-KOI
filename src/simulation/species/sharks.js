import { DENSITY_CHARS } from '../../core/constants.js';
import { clamp, lerp, randRange } from '../../core/math.js';
import { AquaticCreature } from '../creature.js';

export class SharkCreature extends AquaticCreature {
  sharkTailRadius(t) {
    if (t < 0.68 || t > this.maxTailT) return 0;
    const s = clamp((t - 0.68) / (this.maxTailT - 0.68), 0, 1);
    const rawR = this.maxRadius * lerp(0.28, 0.05, Math.pow(s, 0.85));
    return Math.max(rawR, t < 0.96 ? 4.6 : 2.8);
  }

  evaluateSharkAppendages(bestT, bestSignedDist, absDist, bodyR, pecReachMult) {
    let density = -1;
    let kind = 0;

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

export class WhaleShark extends SharkCreature {
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

export class HammerheadShark extends SharkCreature {
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
