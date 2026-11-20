export const ATLAS_CHARS = [
  '@', '#', '%', '*', '+', ':', '.', '~', '|', '/', "'", '(', ')', '·', 'o', '✿', '❀',
  '≈', '-', '>', '<', '°', '❄'
];

export const PALETTE_COLORS = {
  kohakuWhite: '#f4f8ff',
  tanchoWhite: '#ffffff',
  crimson: '#ff2a4b',
  vermilion: '#ff3b2f',
  goldOgon: '#ffc83d',
  goldHighlight: '#ffea94',
  sumiCharcoal: '#2b3447',
  sumiFin: '#52607a',
  asagiBlue: '#2563eb',
  asagiLight: '#93c5fd',
  asagiOrange: '#ff7a2f',
  ghostCyan: '#bae6fd',
  ghostBright: '#e0f7ff',
  ghostFin: '#67e8f9',
  kohakuFin: '#c9def8',
  goldFin: '#fde08d',
  eyeDark: '#070c16',

  lilyRimDay: '#1f5c43',
  lilyMidDay: '#2d7a58',
  lilyVeinDay: '#52b788',
  lilyRimSunset: '#214d42',
  lilyMidSunset: '#2f6b56',
  lilyVeinSunset: '#62a886',
  lilyRimNight: '#16382c',
  lilyMidNight: '#1f4d3b',
  lilyVeinNight: '#3a7a60',

  lotusPink: '#fbcfe8',
  lotusPinkDeep: '#f9a8d4',
  lotusWhite: '#fff5f7',
  lotusStamen: '#fde047',

  fireflyGreen: '#bef264',
  fireflyGold: '#fde047',
  rainDay: '#bae6fd',
  rainSunset: '#f8c8e0',
  rainNight: '#94c6f5',

  waterCyan: '#7dd3fc',
  waterBlue: '#38bdf8',
  waterAmber: '#fbbf24',
  waterMagenta: '#f472b6',
  pelletGold: '#fde68a',

  sakuraLight: '#ffb7c5',
  sakuraDeep: '#ff8fa3',
  sakuraPale: '#fff0f3',

  turtleShellDark: '#1b4332',
  turtleShellMid: '#2d6a4f',
  turtleScuteGold: '#e9c46a',
  turtleSkin: '#52b788',
  turtleFinTip: '#74c69d',

  whaleBack: '#2c5364',
  whaleFlank: '#3b6e8c',
  whaleSpot: '#e0f4ff',
  whaleFin: '#5b8fa8',

  hammerDark: '#475569',
  hammerMid: '#64748b',
  hammerEdge: '#cbd5e1',
  hammerFin: '#54647a',

  planktonCyan: '#00f5d4',
  planktonBlue: '#38bdf8',
  bubblePearl: '#e0f7ff',
  currentTeal: '#2dd4bf',
  currentDeep: '#0ea5e9',
  baitSilver: '#cbd5e1',
  baitNeon: '#67e8f9',
  jellyBell: '#c084fc',
  jellyRim: '#f0abfc',
  jellyTentacle: '#818cf8',
  kelpDark: '#113b36',
  kelpMid: '#1b5e50',
  kelpTip: '#2e8b72',

  mantaBack: '#1e293b',
  mantaWing: '#334155',
  mantaEdge: '#94a3b8',
  mantaSpot: '#e2e8f0',

  carpGoldDeep: '#f59e0b',
  carpGoldBright: '#fde047',
  carpFinAmber: '#fdba74',
  carpCream: '#fef3c7',

  reefCoral: '#fb7185',
  reefAmber: '#f59e0b',
  reefTeal: '#2dd4bf',
  snowWhite: '#f8fafc',
  snowBlue: '#bae6fd',
  iceCyan: '#67e8f9'
};

const LOGICAL_CELL = 22;
const ATLAS_COLS = 32;
const INITIAL_ROWS = 8;
const FONT_SPEC = '600 12px "Cascadia Code", "JetBrains Mono", "Fira Code", Consolas, monospace';

export class GlyphAtlas {
  constructor(dpr = window.devicePixelRatio || 1) {
    this.dpr = 0;
    this.cellLogical = LOGICAL_CELL;
    this.cellStepLogical = LOGICAL_CELL;
    this.cellPx = 0;
    this.canvas = null;
    this.actx = null;
    this.rows = INITIAL_ROWS;
    this.glowEnabled = true;
    this.capacity = ATLAS_COLS * INITIAL_ROWS;
    this.nextSlot = 0;

    // Fast numeric index lookups to avoid string concatenation or object allocation at draw time
    this.charIndex = Object.create(null);
    for (let i = 0; i < ATLAS_CHARS.length; i++) {
      this.charIndex[ATLAS_CHARS[i]] = i;
    }

    this.colorKeys = Object.keys(PALETTE_COLORS);
    this.colorIndex = Object.create(null);
    for (let i = 0; i < this.colorKeys.length; i++) {
      this.colorIndex[this.colorKeys[i]] = i;
    }

    this.charCount = ATLAS_CHARS.length;
    this.slotLookup = new Int16Array(this.charCount * this.colorKeys.length * 2);
    this.slotLookup.fill(-1);
    this.ensureDpr(dpr);
  }

  ensureDpr(dpr) {
    const normalizedDpr = Math.max(1, Math.min(dpr || 1, 2.5));
    if (Math.abs(normalizedDpr - this.dpr) < 0.01 && this.canvas) {
      return false;
    }
    this.dpr = normalizedDpr;
    this.buildAtlas();
    return true;
  }

  createCanvas(widthPx, heightPx) {
    if (typeof OffscreenCanvas !== 'undefined') {
      return new OffscreenCanvas(widthPx, heightPx);
    }
    const el = document.createElement('canvas');
    el.width = widthPx;
    el.height = heightPx;
    return el;
  }

  buildAtlas() {
    const cellPx = Math.ceil(this.cellLogical * this.dpr);
    const cellStepLogical = cellPx / this.dpr;
    this.cellPx = cellPx;
    this.cellStepLogical = cellStepLogical;

    this.rows = INITIAL_ROWS;
    this.glowEnabled = true;
    this.capacity = ATLAS_COLS * INITIAL_ROWS;
    this.nextSlot = 0;
    this.slotLookup.fill(-1);

    const offscreen = this.createCanvas(ATLAS_COLS * cellPx, this.rows * cellPx);
    const actx = offscreen.getContext('2d');
    actx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    actx.font = FONT_SPEC;
    actx.textAlign = 'center';
    actx.textBaseline = 'middle';

    this.canvas = offscreen;
    this.actx = actx;
  }

  growAtlas() {
    const nextRows = this.rows * 2;
    const nextCanvas = this.createCanvas(ATLAS_COLS * this.cellPx, nextRows * this.cellPx);
    const nextCtx = nextCanvas.getContext('2d');
    // Copy already-rasterized physical pixels 1:1 before setting DPR transform
    nextCtx.setTransform(1, 0, 0, 1, 0, 0);
    nextCtx.drawImage(this.canvas, 0, 0);
    nextCtx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    nextCtx.font = FONT_SPEC;
    nextCtx.textAlign = 'center';
    nextCtx.textBaseline = 'middle';

    this.canvas = nextCanvas;
    this.actx = nextCtx;
    this.rows = nextRows;
    this.capacity = ATLAS_COLS * nextRows;
  }

  rasterizeGlyph(char, rIdx, isGlowing, key) {
    if (this.nextSlot >= this.capacity) {
      this.growAtlas();
    }
    const slot = this.nextSlot++;
    const col = slot & 31;
    const row = slot >> 5;
    const step = this.cellStepLogical;
    const actx = this.actx;
    const hex = PALETTE_COLORS[this.colorKeys[rIdx]];

    actx.save();
    actx.beginPath();
    actx.rect(col * step, row * step, step, step);
    actx.clip();
    actx.fillStyle = hex;
    actx.shadowBlur = isGlowing ? 5.5 : 0;
    actx.shadowColor = isGlowing ? hex : 'transparent';
    actx.fillText(char, (col + 0.5) * step, (row + 0.5) * step);
    actx.restore();

    this.slotLookup[key] = slot;
    return slot;
  }

  setGlowEnabled(enabled) {
    this.glowEnabled = Boolean(enabled);
  }

  drawGlyph(ctx, char, colorKey, isGlowing, x, y, scale = 1) {
    const cIdx = this.charIndex[char];
    const rIdx = this.colorIndex[colorKey];
    if (cIdx === undefined || rIdx === undefined) return;

    const effectiveGlow = Boolean(isGlowing && this.glowEnabled);
    const key = ((rIdx * this.charCount + cIdx) << 1) | (effectiveGlow ? 1 : 0);
    let slot = this.slotLookup[key];
    if (slot === -1) {
      slot = this.rasterizeGlyph(char, rIdx, effectiveGlow, key);
    }

    const col = slot & 31;
    const row = slot >> 5;
    const cp = this.cellPx;
    const sx = col * cp;
    const sy = row * cp;
    const size = this.cellStepLogical * scale;
    const half = size * 0.5;

    ctx.drawImage(this.canvas, sx, sy, cp, cp, x - half, y - half, size, size);
  }
}
