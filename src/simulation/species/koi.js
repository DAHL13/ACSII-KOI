import { DENSITY_CHARS } from '../../core/constants.js';
import { clamp, lerp, randRange } from '../../core/math.js';
import { AquaticCreature } from '../creature.js';

export const VARIETY_COLOR_KEYS = {
  kohaku: { base: 'kohakuWhite', spotA: 'vermilion', spotB: 'crimson', fin: 'kohakuFin', eye: 'eyeDark' },
  yamabuki: { base: 'goldOgon', spotA: 'goldHighlight', spotB: 'goldOgon', fin: 'goldFin', eye: 'eyeDark' },
  showa: { base: 'sumiCharcoal', spotA: 'vermilion', spotB: 'tanchoWhite', fin: 'sumiFin', eye: 'eyeDark' },
  asagi: { base: 'asagiBlue', spotA: 'asagiOrange', spotB: 'asagiLight', fin: 'asagiOrange', eye: 'eyeDark' },
  tancho: { base: 'tanchoWhite', spotA: 'crimson', spotB: 'tanchoWhite', fin: 'kohakuFin', eye: 'eyeDark' },
  butterfly: { base: 'ghostCyan', spotA: 'ghostBright', spotB: 'ghostFin', fin: 'ghostFin', eye: 'eyeDark' }
};

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

export class KoiFish extends AquaticCreature {
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
