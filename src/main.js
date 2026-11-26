import {
  BIOME_KEYS,
  DEFAULT_PREFS,
  ENV_KEYS,
  SPACE_ORBIT_SPEEDS,
  SPACE_PALETTE_KEYS
} from './core/constants.js';
import { applyDomI18n, t } from './core/i18n.js';
import { clampInt } from './core/math.js';
import {
  loadCustomBangs,
  loadPrefs,
  normalizePrefs,
  savePrefs,
  subscribeSyncChanges,
  syncPullAll
} from './core/storage.js';
import { PondEcosystem } from './ecosystem/ecosystem.js';
import { PomodoroController } from './productivity/pomodoro.js';
import { RiverStonesManager } from './productivity/river-stones.js';
import { SmartSearchController } from './productivity/smart-search.js';
import { GlyphAtlas } from './render/glyph-atlas.js';
import { KoiPondEngine } from './simulation/engine.js';
import { createClockController } from './ui/clock-greeting.js';
import { createBiomePopoverController } from './ui/biome-popover.js';
import { createFaunaPopoverController } from './ui/fauna-popover.js';
import { createSettingsModalController } from './ui/settings-modal.js';
import { createZenController } from './ui/zen-mode.js';

const BIOME_CONFIG = {
  pond: {
    titleKey: 'pageTitlePond',
    defaults: { lilies: true, currents: false, plankton: false, kelp: false, jellyfish: false, school: false, snow: false }
  },
  ocean: {
    titleKey: 'pageTitleOcean',
    defaults: { lilies: false, currents: true, plankton: true, kelp: true, jellyfish: true, school: true, snow: false }
  },
  reef: {
    titleKey: 'pageTitleReef',
    defaults: { lilies: false, currents: true, plankton: true, kelp: true, jellyfish: true, school: true, snow: false }
  },
  winter: {
    titleKey: 'pageTitleWinter',
    defaults: { lilies: false, currents: false, plankton: false, kelp: false, jellyfish: false, school: false, snow: true }
  },
  space: {
    titleKey: 'pageTitleSpace',
    defaults: { lilies: false, currents: false, plankton: false, kelp: false, jellyfish: false, school: false, snow: false }
  },
  aurora: {
    titleKey: 'pageTitleAurora',
    defaults: { lilies: false, currents: false, plankton: false, kelp: false, jellyfish: false, school: false, snow: false }
  },
  wave: {
    titleKey: 'pageTitleWave',
    defaults: { lilies: false, currents: false, plankton: false, kelp: false, jellyfish: false, school: false, snow: false }
  }
};

function isNonAquaticBiome(biome) {
  return biome === 'space' || biome === 'aurora' || biome === 'wave';
}

let activeApp = null;

export function destroyApp() {
  if (activeApp) {
    activeApp.destroy();
    activeApp = null;
  }
}

export function initApp() {
  applyDomI18n(document);

  const canvas = document.getElementById('koi-canvas');
  const topBar = document.getElementById('top-bar');
  const controlFish = document.querySelector('.control-fish');
  const solarSelector = document.querySelector('.solar-selector');
  const controlToggles = document.querySelector('.control-toggles');
  const centerStage = document.getElementById('center-stage');
  const faunaBtn = document.getElementById('fauna-btn');
  const faunaBtnLabel = document.getElementById('fauna-btn-label');
  const faunaPopover = document.getElementById('fauna-popover');
  const biomeBtn = document.getElementById('biome-btn');
  const biomeBtnSwatch = document.getElementById('biome-btn-swatch');
  const biomeBtnLabel = document.getElementById('biome-btn-label');
  const biomePopover = document.getElementById('biome-popover');
  const spaceOptionsSection = document.getElementById('space-options-section');
  const spacePaletteButtons = Array.from(document.querySelectorAll('.space-palette-btn'));
  const spaceSpeedButtons = Array.from(document.querySelectorAll('.space-speed-btn'));
  const speciesCards = Array.from(document.querySelectorAll('.species-card'));
  const faunaPresets = Array.from(document.querySelectorAll('.fauna-preset-btn'));
  const fireflyModeButtons = Array.from(document.querySelectorAll('.firefly-mode-btn'));
  const biomeButtons = Array.from(document.querySelectorAll('.biome-btn'));
  const envChips = Array.from(document.querySelectorAll('.env-chip'));
  const fishSlider = document.getElementById('fish-count');
  const fishCountValue = document.getElementById('fish-count-value');
  const solarButtons = Array.from(document.querySelectorAll('.solar-btn'));
  const rainBtn = document.getElementById('rain-btn');
  const feedBtn = document.getElementById('feed-btn');
  const feedBtnLabel = document.getElementById('feed-btn-label');
  const pondHintPrefix = document.getElementById('pond-hint-prefix');
  const stonesToggleBtn = document.getElementById('stones-toggle-btn');
  const pomoToggleBtn = document.getElementById('pomo-toggle-btn');
  const clockToggleBtn = document.getElementById('clock-toggle-btn');
  const perfBtn = document.getElementById('perf-btn');
  const perfBadge = document.getElementById('perf-badge');
  const perfText = document.getElementById('perf-text');
  const zenBtn = document.getElementById('zen-btn');
  const zenExitBtn = document.getElementById('zen-exit-btn');
  const zenToast = document.getElementById('zen-toast');
  const settingsBtn = document.getElementById('settings-btn');
  const clockWrap = document.getElementById('clock-wrap');
  const clockEl = document.getElementById('clock');
  const dateLabelEl = document.getElementById('date-label');
  const greetingEl = document.getElementById('greeting');
  const dailyFocusWrap = document.getElementById('daily-focus-wrap');
  const dailyFocusInput = document.getElementById('daily-focus-input');
  const heroCard = document.getElementById('hero-card');
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  const bangBadge = document.getElementById('bang-badge');
  const bangSuggestions = document.getElementById('bang-suggestions');

  const stonesDock = document.getElementById('river-stones-dock');
  const stonesList = document.getElementById('river-stones-list');
  const stoneAddBtn = document.getElementById('stone-add-btn');
  const stoneEditBtn = document.getElementById('stone-edit-btn');
  const stoneModal = document.getElementById('stone-modal');
  const stoneModalForm = document.getElementById('stone-modal-form');
  const stoneModalTitle = document.getElementById('stone-modal-title');
  const stoneTitleInput = document.getElementById('stone-title-input');
  const stoneUrlInput = document.getElementById('stone-url-input');
  const stoneCancelBtn = document.getElementById('stone-cancel-btn');
  const stoneResetBtn = document.getElementById('stone-reset-btn');

  const pomoWidget = document.getElementById('pomodoro-widget');
  const pomoCollapseBtn = document.getElementById('pomo-collapse-btn');
  const pomoTimeEl = document.getElementById('pomo-time');
  const pomoStatusEl = document.getElementById('pomo-status');
  const pomoRingEl = document.getElementById('pomo-ring');
  const pomoPlayBtn = document.getElementById('pomo-play-btn');
  const pomoResetBtn = document.getElementById('pomo-reset-btn');
  const pomoTestBtn = document.getElementById('pomo-test-btn');
  const pomoModeButtons = Array.from(document.querySelectorAll('.pomo-mode-btn'));

  const settingsModal = document.getElementById('settings-modal');
  const settingsCard = settingsModal.querySelector('.settings-modal-card');
  const settingsCloseBtn = document.getElementById('settings-close-btn');
  const settingsUsername = document.getElementById('settings-username');
  const clockFormatButtons = Array.from(document.querySelectorAll('.clock-format-btn'));
  const settingsShowFocus = document.getElementById('settings-show-focus');
  const ecoModeButtons = Array.from(document.querySelectorAll('.eco-mode-btn'));
  const customBangList = document.getElementById('custom-bang-list');
  const bangAddForm = document.getElementById('bang-add-form');
  const bangPrefixInput = document.getElementById('bang-prefix-input');
  const bangNameInput = document.getElementById('bang-name-input');
  const bangUrlInput = document.getElementById('bang-url-input');
  const bangErrorEl = document.getElementById('bang-error');
  const backupExportBtn = document.getElementById('backup-export-btn');
  const backupImportBtn = document.getElementById('backup-import-btn');
  const backupImportInput = document.getElementById('backup-import-input');
  const backupStatusEl = document.getElementById('backup-status');

  let prefs = loadPrefs();
  let customBangs = loadCustomBangs();
  let lastAquaticBiome = isNonAquaticBiome(prefs.biome) ? 'pond' : prefs.biome;
  let lastCosmicBiome = isNonAquaticBiome(prefs.biome) ? prefs.biome : 'space';
  let lastAquaticEnv = null;
  let currentSolarAttr = '';
  let isInitializing = true;
  let obstacleSyncScheduled = false;
  let stoneModalOpen = false;
  let settingsModalOpen = false;
  let pomodoro = null;
  let faunaCtrl = null;
  let biomeCtrl = null;
  let settingsCtrl = null;

  const atlas = new GlyphAtlas(window.devicePixelRatio || 1);

  const ecosystem = new PondEcosystem(window.innerWidth, window.innerHeight, {
    timeMode: prefs.timeMode,
    biome: prefs.biome,
    spacePalette: prefs.spacePalette,
    spaceOrbitSpeed: prefs.spaceOrbitSpeed,
    rainEnabled: prefs.rainEnabled,
    snowEnabled: prefs.snowEnabled,
    liliesEnabled: prefs.liliesEnabled,
    firefliesMode: prefs.firefliesMode,
    currentsEnabled: prefs.currentsEnabled,
    planktonEnabled: prefs.planktonEnabled,
    kelpEnabled: prefs.kelpEnabled,
    jellyfishEnabled: prefs.jellyfishEnabled
  });

  function formatPerfMetrics(fps, frameMs, ecoActive) {
    const base = `${fps} FPS · ${frameMs.toFixed(1)} ms`;
    return ecoActive ? `${base} · ${t('perfEcoTag')}` : base;
  }

  const engine = new KoiPondEngine(canvas, atlas, ecosystem, {
    fishCount: prefs.fishCount,
    species: prefs.species,
    schoolEnabled: prefs.schoolEnabled,
    ecoMode: prefs.ecoMode,
    onMetrics: (fps, frameMs, ecoActive) => {
      if (!prefs.showPerf) return;
      perfText.textContent = formatPerfMetrics(fps, frameMs, ecoActive);
    }
  });

  const ENV_CONFIG = {
    lilies: { prefKey: 'liliesEnabled', apply: (v) => ecosystem.setLiliesEnabled(v) },
    currents: { prefKey: 'currentsEnabled', apply: (v) => ecosystem.setCurrentsEnabled(v) },
    plankton: { prefKey: 'planktonEnabled', apply: (v) => ecosystem.setPlanktonEnabled(v) },
    kelp: { prefKey: 'kelpEnabled', apply: (v) => ecosystem.setKelpEnabled(v) },
    jellyfish: { prefKey: 'jellyfishEnabled', apply: (v) => ecosystem.setJellyfishEnabled(v) },
    school: { prefKey: 'schoolEnabled', apply: (v) => engine.setSchoolEnabled(v) },
    snow: { prefKey: 'snowEnabled', apply: (v) => ecosystem.setSnowEnabled(v) }
  };

  function persistPrefs() {
    if (!isInitializing) {
      savePrefs(prefs);
    }
  }

  function syncInertStates() {
    const zen = Boolean(prefs.zenMode);
    const modal = stoneModalOpen || settingsModalOpen;
    const nonAquatic = isNonAquaticBiome(prefs.biome);
    topBar.inert = zen || modal;
    if (controlFish) controlFish.inert = zen || modal || nonAquatic;
    if (solarSelector) solarSelector.inert = zen || modal || nonAquatic;
    if (controlToggles) controlToggles.inert = zen || modal || nonAquatic;
    centerStage.inert = zen || modal;
    stonesDock.inert = zen || !prefs.stonesVisible || modal;
    pomoWidget.inert = zen || !prefs.pomodoroVisible || modal;
    faunaPopover.inert = zen || !faunaCtrl || !faunaCtrl.isOpen() || modal;
    if (biomePopover) biomePopover.inert = zen || !biomeCtrl || !biomeCtrl.isOpen() || modal;
    zenExitBtn.inert = !zen || modal;
  }

  function syncObstacles() {
    if (prefs.zenMode) {
      engine.setObstacleRect(null);
      engine.setStonesRect(null);
      return;
    }
    const r = heroCard.getBoundingClientRect();
    engine.setObstacleRect({
      left: r.left,
      right: r.right,
      top: r.top,
      bottom: r.bottom,
      width: r.width,
      height: r.height
    });
    if (prefs.stonesVisible) {
      const sr = stonesDock.getBoundingClientRect();
      engine.setStonesRect({
        left: sr.left,
        right: sr.right,
        top: sr.top,
        bottom: sr.bottom,
        width: sr.width,
        height: sr.height
      });
    } else {
      engine.setStonesRect(null);
    }
  }

  function scheduleObstacleSync() {
    if (isInitializing || obstacleSyncScheduled) return;
    obstacleSyncScheduled = true;
    requestAnimationFrame(() => {
      obstacleSyncScheduled = false;
      syncObstacles();
    });
  }

  function syncSolarAttribute() {
    const phase = ecosystem.resolveSolarPhase();
    if (phase !== currentSolarAttr) {
      currentSolarAttr = phase;
      document.documentElement.setAttribute('data-solar', phase);
    }
  }

  function syncEnvFlags() {
    ENV_KEYS.forEach((key) => {
      const cfg = ENV_CONFIG[key];
      cfg.apply(prefs[cfg.prefKey]);
    });
    if (faunaCtrl) faunaCtrl.syncUI();
  }

  function applyTimeMode(mode) {
    prefs.timeMode = mode;
    ecosystem.setTimeMode(mode);
    solarButtons.forEach((btn) => {
      const active = btn.dataset.timeMode === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    syncSolarAttribute();
    persistPrefs();
  }

  function applySpacePalette(palette) {
    const next = SPACE_PALETTE_KEYS.includes(palette) ? palette : DEFAULT_PREFS.spacePalette;
    prefs.spacePalette = next;
    document.documentElement.setAttribute('data-space-palette', next);
    ecosystem.setSpacePalette(next);
    if (biomeCtrl) {
      biomeCtrl.syncUI(prefs.biome, prefs.spacePalette, prefs.spaceOrbitSpeed);
    }
    persistPrefs();
  }

  function applySpaceOrbitSpeed(speed) {
    const num = Number(speed);
    const next = SPACE_ORBIT_SPEEDS.includes(num) ? num : DEFAULT_PREFS.spaceOrbitSpeed;
    prefs.spaceOrbitSpeed = next;
    ecosystem.setSpaceOrbitSpeed(next);
    if (biomeCtrl) {
      biomeCtrl.syncUI(prefs.biome, prefs.spacePalette, prefs.spaceOrbitSpeed);
    }
    persistPrefs();
  }

  function captureAquaticEnv() {
    const snap = {};
    ENV_KEYS.forEach((key) => {
      snap[key] = Boolean(prefs[ENV_CONFIG[key].prefKey]);
    });
    return snap;
  }

  function applyBiome(biome, applyPreset = true) {
    prefs.biome = BIOME_KEYS.includes(biome) ? biome : 'pond';
    document.documentElement.setAttribute('data-biome', prefs.biome);
    ecosystem.setBiome(prefs.biome);

    const nonAquatic = isNonAquaticBiome(prefs.biome);
    if (nonAquatic) {
      lastCosmicBiome = prefs.biome;
      if (faunaCtrl && faunaCtrl.isOpen()) {
        faunaCtrl.setOpen(false);
      }
    } else {
      lastAquaticBiome = prefs.biome;
    }

    const cfg = BIOME_CONFIG[prefs.biome] || BIOME_CONFIG.pond;
    const nextTitle = t(cfg.titleKey);
    if (pomodoro) {
      pomodoro.setBaseTitle(nextTitle);
      pomodoro.setBiome(prefs.biome);
    } else {
      document.title = nextTitle;
    }

    const isSpace = prefs.biome === 'space';
    const isAurora = prefs.biome === 'aurora';
    const isWave = prefs.biome === 'wave';
    if (feedBtnLabel) {
      feedBtnLabel.textContent = t(
        isSpace ? 'spacePulseBtn' : isAurora ? 'auroraPulseBtn' : isWave ? 'waveSwellBtn' : 'feedBtn'
      );
    }
    if (feedBtn) {
      feedBtn.title = t(
        isSpace
          ? 'spacePulseBtnTitle'
          : isAurora
            ? 'auroraPulseBtnTitle'
            : isWave
              ? 'waveSwellBtnTitle'
              : 'feedBtnTitle'
      );
    }
    if (pondHintPrefix) {
      pondHintPrefix.textContent = t(
        isSpace ? 'spaceHintPrefix' : isAurora ? 'auroraHintPrefix' : isWave ? 'waveHintPrefix' : 'pondHintPrefix'
      );
    }

    if (biomeCtrl) {
      biomeCtrl.syncUI(prefs.biome, prefs.spacePalette, prefs.spaceOrbitSpeed);
    } else {
      biomeButtons.forEach((btn) => {
        const active = btn.dataset.biome === prefs.biome;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', String(active));
      });
    }

    if (applyPreset) {
      const envSource = typeof applyPreset === 'object' ? applyPreset : cfg.defaults;
      ENV_KEYS.forEach((key) => {
        prefs[ENV_CONFIG[key].prefKey] = Boolean(envSource[key]);
      });
    }

    syncEnvFlags();
    syncInertStates();
    persistPrefs();
  }

  function applySpecies(nextSpecies) {
    prefs.species = normalizePrefs({ species: nextSpecies }).species;
    if (!isInitializing) {
      engine.setSpecies(prefs.species);
    }
    if (faunaCtrl) faunaCtrl.syncUI();
    persistPrefs();
  }

  function applyFirefliesMode(mode) {
    prefs.firefliesMode = mode;
    ecosystem.setFirefliesMode(mode);
    if (faunaCtrl) faunaCtrl.syncUI();
    persistPrefs();
  }

  function applyFishCount(value) {
    const count = clampInt(value, 5, 25, DEFAULT_PREFS.fishCount);
    prefs.fishCount = count;
    if (!isInitializing) {
      engine.syncFishCount(count);
    }
    if (faunaCtrl) faunaCtrl.syncUI();
    persistPrefs();
  }

  function applyRain(enabled) {
    prefs.rainEnabled = Boolean(enabled);
    ecosystem.setRainEnabled(prefs.rainEnabled);
    rainBtn.setAttribute('aria-pressed', String(prefs.rainEnabled));
    persistPrefs();
  }

  function applyStonesVisibility(visible) {
    prefs.stonesVisible = Boolean(visible);
    stonesDock.classList.toggle('is-hidden', !prefs.stonesVisible);
    stonesToggleBtn.setAttribute('aria-pressed', String(prefs.stonesVisible));
    syncInertStates();
    persistPrefs();
    scheduleObstacleSync();
  }

  function applyPomodoroVisibility(visible) {
    prefs.pomodoroVisible = Boolean(visible);
    pomoWidget.classList.toggle('is-hidden', !prefs.pomodoroVisible);
    pomoToggleBtn.setAttribute('aria-pressed', String(prefs.pomodoroVisible));
    syncInertStates();
    persistPrefs();
  }

  function applyClockVisibility(visible) {
    prefs.showClock = Boolean(visible);
    clockWrap.classList.toggle('is-hidden', !prefs.showClock);
    clockToggleBtn.setAttribute('aria-pressed', String(prefs.showClock));
    persistPrefs();
    scheduleObstacleSync();
  }

  function applyPerfVisibility(visible) {
    prefs.showPerf = Boolean(visible);
    perfBadge.hidden = !prefs.showPerf;
    perfBtn.setAttribute('aria-pressed', String(prefs.showPerf));
    if (prefs.showPerf) {
      const m = engine.getMetrics();
      perfText.textContent = formatPerfMetrics(m.fps, m.frameTimeMs, m.ecoActive);
    }
    persistPrefs();
  }

  const clockCtrl = createClockController({
    clockEl,
    dateLabelEl,
    greetingEl,
    dailyFocusWrap,
    dailyFocusInput,
    onSolarAutoTick: () => {
      if (prefs.timeMode === 'auto') {
        ecosystem.setTimeMode('auto');
        syncSolarAttribute();
      }
    }
  });

  const zenCtrl = createZenController({
    zenBtn,
    zenToast,
    searchInput,
    onStateChange: (enabled) => {
      prefs.zenMode = enabled;
      if (enabled && faunaCtrl) {
        faunaCtrl.setOpen(false);
      }
      if (enabled && biomeCtrl) {
        biomeCtrl.setOpen(false);
      }
      persistPrefs();
      syncInertStates();
      scheduleObstacleSync();
    }
  });

  faunaCtrl = createFaunaPopoverController({
    faunaBtn,
    faunaBtnLabel,
    faunaPopover,
    fishSlider,
    fishCountValue,
    speciesCards,
    faunaPresets,
    envChips,
    fireflyModeButtons,
    envConfig: ENV_CONFIG,
    getPrefs: () => prefs,
    engine,
    onSpeciesChange: applySpecies,
    onEnvToggle: (envKey, enabled) => {
      const cfg = ENV_CONFIG[envKey];
      if (!cfg) return;
      prefs[cfg.prefKey] = Boolean(enabled);
      syncEnvFlags();
      persistPrefs();
    },
    onFirefliesChange: applyFirefliesMode,
    onFishCountChange: applyFishCount,
    onOpenChange: (open) => {
      if (open && biomeCtrl) biomeCtrl.setOpen(false);
    },
    onInertSync: syncInertStates
  });

  biomeCtrl = createBiomePopoverController({
    biomeBtn,
    biomeBtnSwatch,
    biomeBtnLabel,
    biomePopover,
    biomeButtons,
    spaceOptionsSection,
    spacePaletteButtons,
    spaceSpeedButtons,
    onSelectBiome: (biome) => {
      if (biome === prefs.biome) return;
      if (!isNonAquaticBiome(biome)) {
        lastAquaticEnv = null;
      }
      applyBiome(biome, true);
    },
    onSelectSpacePalette: (palette) => applySpacePalette(palette),
    onSelectSpaceSpeed: (speed) => applySpaceOrbitSpeed(speed),
    onOpenChange: (open) => {
      if (open && faunaCtrl) faunaCtrl.setOpen(false);
    },
    onInertSync: syncInertStates
  });

  const riverStones = new RiverStonesManager({
    dockEl: stonesDock,
    listEl: stonesList,
    addBtn: stoneAddBtn,
    editBtn: stoneEditBtn,
    modalEl: stoneModal,
    modalForm: stoneModalForm,
    modalTitleEl: stoneModalTitle,
    titleInput: stoneTitleInput,
    urlInput: stoneUrlInput,
    cancelBtn: stoneCancelBtn,
    resetBtn: stoneResetBtn,
    engine,
    onLayoutChange: scheduleObstacleSync,
    onModalToggle: (open) => {
      stoneModalOpen = Boolean(open);
      syncInertStates();
    }
  });

  const smartSearch = new SmartSearchController({
    form: searchForm,
    input: searchInput,
    badgeEl: bangBadge,
    suggestionsEl: bangSuggestions,
    customBangs
  });

  const initialBaseTitle = t((BIOME_CONFIG[prefs.biome] || BIOME_CONFIG.pond).titleKey);
  pomodoro = new PomodoroController({
    widgetEl: pomoWidget,
    collapseBtn: pomoCollapseBtn,
    timeEl: pomoTimeEl,
    statusEl: pomoStatusEl,
    ringEl: pomoRingEl,
    playBtn: pomoPlayBtn,
    resetBtn: pomoResetBtn,
    testBtn: pomoTestBtn,
    modeButtons: pomoModeButtons,
    ecosystem,
    biome: prefs.biome,
    baseTitle: initialBaseTitle,
    collapsed: prefs.pomodoroCollapsed,
    onCollapseChange: (collapsed) => {
      prefs.pomodoroCollapsed = collapsed;
      savePrefs(prefs);
    }
  });

  function applyAllPrefsFromState(nextPrefs) {
    prefs = normalizePrefs(nextPrefs);
    const prevInit = isInitializing;
    isInitializing = true;
    applyTimeMode(prefs.timeMode);
    applySpacePalette(prefs.spacePalette);
    applySpaceOrbitSpeed(prefs.spaceOrbitSpeed);
    applyBiome(prefs.biome, false);
    applySpecies(prefs.species);
    applyFirefliesMode(prefs.firefliesMode);
    applyFishCount(prefs.fishCount);
    applyRain(prefs.rainEnabled);
    applyStonesVisibility(prefs.stonesVisible);
    applyPomodoroVisibility(prefs.pomodoroVisible);
    applyClockVisibility(prefs.showClock);
    applyPerfVisibility(prefs.showPerf);
    zenCtrl.apply(prefs.zenMode, false);
    engine.setEcoMode(prefs.ecoMode);
    clockCtrl.applyPrefs(prefs);
    if (pomodoro) {
      pomodoro.setCollapsed(Boolean(prefs.pomodoroCollapsed), false);
    }
    isInitializing = prevInit;
    if (!prevInit) {
      engine.setSpecies(prefs.species);
      engine.syncFishCount(prefs.fishCount);
      faunaCtrl.syncUI();
      if (settingsCtrl) settingsCtrl.syncFromPrefs();
      if (prefs.showPerf) {
        const m = engine.getMetrics();
        perfText.textContent = formatPerfMetrics(m.fps, m.frameTimeMs, m.ecoActive);
      }
    }
  }

  settingsCtrl = createSettingsModalController({
    modalEl: settingsModal,
    cardEl: settingsCard,
    triggerBtn: settingsBtn,
    closeBtn: settingsCloseBtn,
    usernameInput: settingsUsername,
    clockFormatButtons,
    showFocusCheckbox: settingsShowFocus,
    ecoModeButtons,
    bangListEl: customBangList,
    bangFormEl: bangAddForm,
    bangPrefixInput,
    bangNameInput,
    bangUrlInput,
    bangErrorEl,
    exportBtn: backupExportBtn,
    importBtn: backupImportBtn,
    importInput: backupImportInput,
    backupStatusEl,
    getPrefs: () => prefs,
    onPrefsPatch: (patch) => {
      prefs = normalizePrefs({ ...prefs, ...patch });
      engine.setEcoMode(prefs.ecoMode);
      clockCtrl.applyPrefs(prefs);
      persistPrefs();
      scheduleObstacleSync();
      if (prefs.showPerf) {
        const m = engine.getMetrics();
        perfText.textContent = formatPerfMetrics(m.fps, m.frameTimeMs, m.ecoActive);
      }
    },
    onCustomBangsChange: (list) => {
      customBangs = list;
      smartSearch.setCustomBangs(list);
    },
    onImportedConfig: (data) => {
      if (data.prefs) applyAllPrefsFromState(data.prefs);
      if (data.stones) riverStones.setStones(data.stones);
      if (data.customBangs) {
        customBangs = data.customBangs;
        smartSearch.setCustomBangs(customBangs);
      }
      if (data.dailyFocus !== undefined) clockCtrl.setDailyFocus(data.dailyFocus);
      scheduleObstacleSync();
    },
    onModalToggle: (open) => {
      settingsModalOpen = Boolean(open);
      syncInertStates();
    }
  });

  applyAllPrefsFromState(prefs);
  isInitializing = false;
  syncInertStates();

  engine.start();
  scheduleObstacleSync();

  const syncHandlers = {
    onPrefs: (syncedPrefs) => {
      applyAllPrefsFromState(syncedPrefs);
      syncInertStates();
      scheduleObstacleSync();
    },
    onStones: (syncedStones) => {
      riverStones.setStones(syncedStones);
    },
    onCustomBangs: (syncedBangs) => {
      customBangs = syncedBangs;
      smartSearch.setCustomBangs(syncedBangs);
      settingsCtrl.setCustomBangs(syncedBangs);
    },
    onDailyFocus: (syncedFocus) => {
      clockCtrl.setDailyFocus(syncedFocus);
    }
  };
  syncPullAll(syncHandlers);
  const unsubscribeSync = subscribeSyncChanges(syncHandlers);

  solarButtons.forEach((btn) => {
    btn.addEventListener('click', () => applyTimeMode(btn.dataset.timeMode));
  });
  rainBtn.addEventListener('click', () => applyRain(!prefs.rainEnabled));
  feedBtn.addEventListener('click', () => engine.dropMultipleFood(8));
  stonesToggleBtn.addEventListener('click', () => applyStonesVisibility(!prefs.stonesVisible));
  pomoToggleBtn.addEventListener('click', () => applyPomodoroVisibility(!prefs.pomodoroVisible));
  clockToggleBtn.addEventListener('click', () => applyClockVisibility(!prefs.showClock));
  perfBtn.addEventListener('click', () => applyPerfVisibility(!prefs.showPerf));
  zenBtn.addEventListener('click', () => zenCtrl.apply(!prefs.zenMode, !prefs.zenMode));
  zenExitBtn.addEventListener('click', () => zenCtrl.apply(false, false));

  const onCanvasClick = (e) => {
    if ((faunaCtrl && faunaCtrl.isOpen()) || (biomeCtrl && biomeCtrl.isOpen())) {
      return;
    }
    engine.dropFood(e.clientX, e.clientY);
  };
  const onPointerMove = (e) => {
    if (e.isPrimary === false) return;
    engine.onMouseMove(e.clientX, e.clientY);
    zenCtrl.handlePointerMove(e);
  };
  const onPointerUp = (e) => {
    if (e.pointerType === 'touch') engine.onMouseLeave();
  };
  const onPointerLeave = () => engine.onMouseLeave();

  canvas.addEventListener('click', onCanvasClick);
  document.addEventListener('pointermove', onPointerMove);
  document.addEventListener('pointerup', onPointerUp);
  document.addEventListener('pointercancel', onPointerLeave);
  document.addEventListener('pointerleave', onPointerLeave);
  window.addEventListener('resize', scheduleObstacleSync);

  const onKeyDown = (e) => {
    const activeEl = document.activeElement;
    const tag = activeEl ? activeEl.tagName : '';
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || (activeEl && activeEl.isContentEditable);

    if (e.key === 'Escape') {
      if (!settingsModal.hidden) {
        settingsCtrl.closeModal();
        return;
      }
      if (faunaCtrl.isOpen()) {
        faunaCtrl.setOpen(false, true);
        return;
      }
      if (biomeCtrl && biomeCtrl.isOpen()) {
        biomeCtrl.setOpen(false, true);
        return;
      }
      if (!stoneModal.hidden) {
        riverStones.closeModal();
        return;
      }
      if (prefs.zenMode) {
        zenCtrl.apply(false, false);
        return;
      }
    }

    if (isTyping || !stoneModal.hidden || !settingsModal.hidden || e.ctrlKey || e.metaKey || e.altKey) {
      return;
    }

    if (e.key === '/') {
      e.preventDefault();
      if (faunaCtrl && faunaCtrl.isOpen()) faunaCtrl.setOpen(false);
      if (biomeCtrl && biomeCtrl.isOpen()) biomeCtrl.setOpen(false);
      if (!prefs.zenMode) searchInput.focus();
    } else if (e.key === 'f' || e.key === 'F') {
      engine.dropMultipleFood(8);
    } else if (e.key === 'r' || e.key === 'R') {
      if (!isNonAquaticBiome(prefs.biome)) {
        applyRain(!prefs.rainEnabled);
      }
    } else if (e.key === 'b' || e.key === 'B') {
      if (isNonAquaticBiome(prefs.biome)) {
        applyBiome(lastAquaticBiome, lastAquaticEnv || true);
      } else {
        lastAquaticEnv = captureAquaticEnv();
        applyBiome(lastCosmicBiome, true);
      }
    } else if (e.key === 'p' || e.key === 'P') {
      if (!prefs.pomodoroVisible) return;
      if (pomodoro.running) pomodoro.pause();
      else pomodoro.start();
    } else if (e.key === 'z' || e.key === 'Z') {
      zenCtrl.apply(!prefs.zenMode, !prefs.zenMode);
    }
  };
  document.addEventListener('keydown', onKeyDown);

  const handle = {
    destroy() {
      canvas.removeEventListener('click', onCanvasClick);
      document.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('pointerup', onPointerUp);
      document.removeEventListener('pointercancel', onPointerLeave);
      document.removeEventListener('pointerleave', onPointerLeave);
      window.removeEventListener('resize', scheduleObstacleSync);
      document.removeEventListener('keydown', onKeyDown);
      unsubscribeSync();
      engine.destroy();
      clockCtrl.destroy();
      zenCtrl.destroy();
      faunaCtrl.destroy();
      if (biomeCtrl) biomeCtrl.destroy();
      riverStones.destroy();
      pomodoro.destroy();
    }
  };
  activeApp = handle;
  return handle;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp, { once: true });
} else {
  initApp();
}
