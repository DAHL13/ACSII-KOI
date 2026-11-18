(function (global) {
  'use strict';

  const ATLAS_CHARS = [
    '@', '#', '%', '*', '+', ':', '.', '~', '|', '/', "'", '(', ')', '·', 'o', '✿', '❀',
    '≈', '-', '>', '<', '°'
  ];

  const PALETTE_COLORS = {
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
    kelpTip: '#2e8b72'
  };

  const LOGICAL_CELL = 22;
  const FONT_SPEC = '600 12px "Cascadia Code", "JetBrains Mono", "Fira Code", Consolas, monospace';

  class GlyphAtlas {
    constructor(dpr = window.devicePixelRatio || 1) {
      this.dpr = 0;
      this.cellLogical = LOGICAL_CELL;
      this.cellPx = 0;
      this.canvas = null;

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

    buildAtlas() {
      const cols = this.charCount * 2; // glow + flat per character
      const rows = this.colorKeys.length;
      const cellPx = Math.ceil(this.cellLogical * this.dpr);
      this.cellPx = cellPx;

      const widthPx = cols * cellPx;
      const heightPx = rows * cellPx;

      let offscreen;
      if (typeof OffscreenCanvas !== 'undefined') {
        offscreen = new OffscreenCanvas(widthPx, heightPx);
      } else {
        offscreen = document.createElement('canvas');
        offscreen.width = widthPx;
        offscreen.height = heightPx;
      }

      const actx = offscreen.getContext('2d');
      actx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      actx.clearRect(0, 0, cols * this.cellLogical, rows * this.cellLogical);
      actx.font = FONT_SPEC;
      actx.textAlign = 'center';
      actx.textBaseline = 'middle';

      const halfCell = this.cellLogical * 0.5;

      for (let r = 0; r < rows; r++) {
        const key = this.colorKeys[r];
        const hex = PALETTE_COLORS[key];
        const cy = r * this.cellLogical + halfCell;

        // 1. Flat (crisp, zero shadowBlur)
        actx.shadowBlur = 0;
        actx.fillStyle = hex;
        for (let c = 0; c < this.charCount; c++) {
          const ch = ATLAS_CHARS[c];
          const cxFlat = c * this.cellLogical + halfCell;
          actx.fillText(ch, cxFlat, cy);
        }

        // 2. Bioluminescent glow state
        actx.shadowColor = hex;
        actx.shadowBlur = 5.5;
        for (let c = 0; c < this.charCount; c++) {
          const ch = ATLAS_CHARS[c];
          const cxGlow = (c + this.charCount) * this.cellLogical + halfCell;
          actx.fillText(ch, cxGlow, cy);
        }
      }

      this.canvas = offscreen;
    }

    drawGlyph(ctx, char, colorKey, isGlowing, x, y, scale = 1) {
      const cIdx = this.charIndex[char];
      const rIdx = this.colorIndex[colorKey];
      if (cIdx === undefined || rIdx === undefined) return;

      const col = isGlowing ? cIdx + this.charCount : cIdx;
      const cp = this.cellPx;
      const sx = col * cp;
      const sy = rIdx * cp;
      const size = this.cellLogical * scale;
      const half = size * 0.5;

      ctx.drawImage(this.canvas, sx, sy, cp, cp, x - half, y - half, size, size);
    }
  }

  global.GlyphAtlas = GlyphAtlas;
})(window);
