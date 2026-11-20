import { DEFAULT_PREFS, ENV_KEYS } from './core/constants.js';
import { applyDomI18n, getUiLocale, t } from './core/i18n.js';
import { clampInt } from './core/math.js';
import { loadPrefs, savePrefs, subscribePrefsChanges } from './core/storage.js';
import { PondEcosystem } from './ecosystem/ecosystem.js';
import { PomodoroController } from './productivity/pomodoro.js';
import { RiverStonesManager } from './productivity/river-stones.js';
import { SmartSearchController } from './productivity/smart-search.js';
import { GlyphAtlas } from './render/glyph-atlas.js';
import { KoiPondEngine } from './simulation/engine.js';

function getGreeting(hour) {
  if (hour >= 5 && hour < 12) return t('greetingMorning');
  if (hour >= 12 && hour < 20) return t('greetingAfternoon');
  return t('greetingEvening');
}

export function initApp() {
  applyDomI18n(document);

  const canvas = document.getElementById('koi-canvas');
  const topBar = document.getElementById('top-bar');
  const centerStage = document.getElementById('center-stage');
  const faunaBtn = document.getElementById('fauna-btn');
  const faunaBtnLabel = document.getElementById('fauna-btn-label');
  const faunaPopover = document.getElementById('fauna-popover');
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
  const stonesToggleBtn = document.getElementById('stones-toggle-btn');
  const pomoToggleBtn = document.getElementById('pomo-toggle-btn');
  const clockToggleBtn = document.getElementById('clock-toggle-btn');
  const perfBtn = document.getElementById('perf-btn');
  const perfBadge = document.getElementById('perf-badge');
  const perfText = document.getElementById('perf-text');
  const zenBtn = document.getElementById('zen-btn');
  const zenExitBtn = document.getElementById('zen-exit-btn');
  const zenToast = document.getElementById('zen-toast');
  const clockWrap = document.getElementById('clock-wrap');
  const clockEl = document.getElementById('clock');
  const dateLabelEl = document.getElementById('date-label');
  const greetingEl = document.getElementById('greeting');
  const heroCard = document.getElementById('hero-card');
  const searchForm = document.getElementById('search-form');
  const searchInput = document.getElementById('search-input');
  const bangBadge = document.getElementById('bang-badge');

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

  let prefs = loadPrefs();
  let toastTimer = null;
  let zenPeekTimer = null;
  let currentSolarAttr = '';
  let isInitializing = true;
  let obstacleSyncScheduled = false;
  let lastClockKey = '';
  let stoneModalOpen = false;

  const ENV_CONFIG = {
    lilies: {
      prefKey: 'liliesEnabled',
      oceanDefault: false,
      pondDefault: true,
      apply: (v) => ecosystem.setLiliesEnabled(v)
    },
    currents: {
      prefKey: 'currentsEnabled',
      oceanDefault: true,
      pondDefault: false,
      apply: (v) => ecosystem.setCurrentsEnabled(v)
    },
    plankton: {
      prefKey: 'planktonEnabled',
      oceanDefault: true,
      pondDefault: false,
      apply: (v) => ecosystem.setPlanktonEnabled(v)
    },
    kelp: {
      prefKey: 'kelpEnabled',
      oceanDefault: true,
      pondDefault: false,
      apply: (v) => ecosystem.setKelpEnabled(v)
    },
    jellyfish: {
      prefKey: 'jellyfishEnabled',
      oceanDefault: true,
      pondDefault: false,
      apply: (v) => ecosystem.setJellyfishEnabled(v)
    },
    school: {
      prefKey: 'schoolEnabled',
      oceanDefault: true,
      pondDefault: false,
      apply: (v) => engine.setSchoolEnabled(v)
    }
  };

  function persistPrefs() {
    if (!isInitializing) {
      savePrefs(prefs);
    }
  }

  function syncInertStates() {
    const zen = Boolean(prefs.zenMode);
    const modal = stoneModalOpen;
    topBar.inert = zen || modal;
    centerStage.inert = zen || modal;
    stonesDock.inert = zen || !prefs.stonesVisible || modal;
    pomoWidget.inert = zen || !prefs.pomodoroVisible || modal;
    faunaPopover.inert = zen || faunaPopover.hidden || modal;
    zenExitBtn.inert = !zen || modal;
  }

  function syncObstacles() {
    if (prefs.zenMode) {
      engine.setObstacleRect(null);
      engine.setStonesRect(null);
      return;
    }
    const heroRect = heroCard.getBoundingClientRect();
    engine.setObstacleRect({
      left: heroRect.left,
      right: heroRect.right,
      top: heroRect.top,
      bottom: heroRect.bottom,
      width: heroRect.width,
      height: heroRect.height
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

  const atlas = new GlyphAtlas(window.devicePixelRatio || 1);

  const ecosystem = new PondEcosystem(window.innerWidth, window.innerHeight, {
    timeMode: prefs.timeMode,
    biome: prefs.biome,
    rainEnabled: prefs.rainEnabled,
    liliesEnabled: prefs.liliesEnabled,
    firefliesMode: prefs.firefliesMode,
    currentsEnabled: prefs.currentsEnabled,
    planktonEnabled: prefs.planktonEnabled,
    kelpEnabled: prefs.kelpEnabled,
    jellyfishEnabled: prefs.jellyfishEnabled
  });

  const engine = new KoiPondEngine(canvas, atlas, ecosystem, {
    fishCount: prefs.fishCount,
    species: prefs.species,
    schoolEnabled: prefs.schoolEnabled,
    onMetrics: (fps, frameMs) => {
      if (!prefs.showPerf) return;
      perfText.textContent = `${fps} FPS · ${frameMs.toFixed(1)} ms`;
    }
  });

  function syncSolarAttribute() {
    const phase = ecosystem.resolveSolarPhase();
    if (phase !== currentSolarAttr) {
      currentSolarAttr = phase;
      document.documentElement.setAttribute('data-solar', phase);
    }
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

  const SPECIES_SHORT_LABELS = {
    koi: t('speciesKoiShort'),
    turtle: t('speciesTurtleShort'),
    whaleShark: t('speciesWhaleShort'),
    hammerhead: t('speciesHammerShort')
  };

  function syncFishCountAccessibility() {
    const sp = prefs.species;
    const activeSpeciesCount = Object.keys(SPECIES_SHORT_LABELS).filter((k) => sp[k]).length;
    const activeTotal = engine.getCreatureCount();
    fishCountValue.textContent = String(activeTotal);
    if (activeSpeciesCount === 0) {
      fishSlider.setAttribute('aria-valuetext', t('sliderValuetextNone', prefs.fishCount));
      fishCountValue.title = t('sliderTitleNone');
    } else {
      fishSlider.setAttribute('aria-valuetext', t('sliderValuetextActive', [prefs.fishCount, activeTotal]));
      fishCountValue.title = t('sliderTitleActive', [activeTotal, prefs.fishCount]);
    }
  }

  function updateFaunaTriggerLabel() {
    const sp = prefs.species;
    const activeKeys = Object.keys(SPECIES_SHORT_LABELS).filter((k) => sp[k]);
    if (activeKeys.length === 0) {
      faunaBtnLabel.textContent = prefs.firefliesMode === 'on' ? t('firefliesLabel') : t('faunaZero');
    } else if (activeKeys.length === 1) {
      faunaBtnLabel.textContent = SPECIES_SHORT_LABELS[activeKeys[0]];
    } else {
      faunaBtnLabel.textContent = t('faunaMulti', activeKeys.length);
    }
    syncFishCountAccessibility();
  }

  function applySpecies(nextSpecies) {
    prefs.species = {
      koi: Boolean(nextSpecies.koi),
      turtle: Boolean(nextSpecies.turtle),
      whaleShark: Boolean(nextSpecies.whaleShark),
      hammerhead: Boolean(nextSpecies.hammerhead)
    };
    if (!isInitializing) {
      engine.setSpecies(prefs.species);
    }
    speciesCards.forEach((card) => {
      const active = prefs.species[card.dataset.species];
      card.classList.toggle('is-active', active);
      card.setAttribute('aria-pressed', String(active));
    });
    updateFaunaTriggerLabel();
    persistPrefs();
  }

  function applyFirefliesMode(mode) {
    prefs.firefliesMode = mode;
    ecosystem.setFirefliesMode(mode);
    fireflyModeButtons.forEach((btn) => {
      const active = btn.dataset.fireflies === mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    updateFaunaTriggerLabel();
    persistPrefs();
  }

  function setFaunaPopoverOpen(open, restoreFocus = false) {
    faunaPopover.hidden = !open;
    faunaBtn.setAttribute('aria-expanded', String(open));
    syncInertStates();
    if (open) {
      const firstControl = faunaPopover.querySelector('button');
      if (firstControl) firstControl.focus();
    } else if (restoreFocus) {
      faunaBtn.focus();
    }
  }

  function applyFishCount(value) {
    const count = clampInt(value, 5, 25, DEFAULT_PREFS.fishCount);
    prefs.fishCount = count;
    fishSlider.value = String(count);
    if (!isInitializing) {
      engine.syncFishCount(count);
    }
    syncFishCountAccessibility();
    persistPrefs();
  }

  function applyRain(enabled) {
    prefs.rainEnabled = Boolean(enabled);
    ecosystem.setRainEnabled(prefs.rainEnabled);
    rainBtn.setAttribute('aria-pressed', String(prefs.rainEnabled));
    persistPrefs();
  }

  function syncEnvFlags() {
    ENV_KEYS.forEach((key) => {
      const cfg = ENV_CONFIG[key];
      cfg.apply(prefs[cfg.prefKey]);
    });

    envChips.forEach((chip) => {
      const cfg = ENV_CONFIG[chip.dataset.env];
      const active = cfg ? Boolean(prefs[cfg.prefKey]) : false;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', String(active));
    });
  }

  let pomodoro = null;

  function applyBiome(biome, applyPreset = true) {
    prefs.biome = biome === 'ocean' ? 'ocean' : 'pond';
    document.documentElement.setAttribute('data-biome', prefs.biome);
    ecosystem.setBiome(prefs.biome);

    const nextTitle = t(prefs.biome === 'ocean' ? 'pageTitleOcean' : 'pageTitlePond');
    if (pomodoro) {
      pomodoro.setBaseTitle(nextTitle);
    } else {
      document.title = nextTitle;
    }

    biomeButtons.forEach((btn) => {
      const active = btn.dataset.biome === prefs.biome;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    if (applyPreset) {
      const isOcean = prefs.biome === 'ocean';
      ENV_KEYS.forEach((key) => {
        const cfg = ENV_CONFIG[key];
        prefs[cfg.prefKey] = isOcean ? cfg.oceanDefault : cfg.pondDefault;
      });
    }

    syncEnvFlags();
    persistPrefs();
  }

  function applyEnvFlag(envKey, enabled) {
    const cfg = ENV_CONFIG[envKey];
    if (!cfg) return;
    prefs[cfg.prefKey] = Boolean(enabled);
    syncEnvFlags();
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
    prefs.showClock = visible;
    clockWrap.classList.toggle('is-hidden', !visible);
    clockToggleBtn.setAttribute('aria-pressed', String(visible));
    persistPrefs();
    scheduleObstacleSync();
  }

  function applyPerfVisibility(visible) {
    prefs.showPerf = Boolean(visible);
    perfBadge.hidden = !prefs.showPerf;
    perfBtn.setAttribute('aria-pressed', String(prefs.showPerf));
    if (prefs.showPerf) {
      const metrics = engine.getMetrics();
      perfText.textContent = `${metrics.fps} FPS · ${metrics.frameTimeMs.toFixed(1)} ms`;
    }
    persistPrefs();
  }

  function showZenToast() {
    zenToast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      zenToast.classList.remove('is-visible');
    }, 2600);
  }

  function applyZenMode(enabled, notify = false) {
    prefs.zenMode = enabled;
    if (enabled) {
      document.documentElement.setAttribute('data-zen', 'true');
    } else {
      document.documentElement.removeAttribute('data-zen');
    }
    document.body.classList.toggle('zen-mode', enabled);
    zenBtn.setAttribute('aria-pressed', String(enabled));
    persistPrefs();

    if (enabled) {
      setFaunaPopoverOpen(false);
      searchInput.blur();
      if (notify) showZenToast();
    } else {
      zenToast.classList.remove('is-visible');
    }

    syncInertStates();
    scheduleObstacleSync();
  }

  function updateClockAndGreeting() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const hoursStr = String(hours).padStart(2, '0');
    const clockKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${hoursStr}-${minutes}`;
    if (clockKey === lastClockKey) return;
    lastClockKey = clockKey;

    clockEl.textContent = `${hoursStr}:${minutes}`;
    clockEl.setAttribute('datetime', `${hoursStr}:${minutes}`);
    greetingEl.textContent = getGreeting(hours);

    try {
      dateLabelEl.textContent = now.toLocaleDateString(getUiLocale(), {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });
    } catch (_) {
      dateLabelEl.textContent = '';
    }

    if (prefs.timeMode === 'auto') {
      ecosystem.setTimeMode('auto');
      syncSolarAttribute();
    }
  }

  function applyAllPrefsFromState(nextPrefs) {
    prefs = nextPrefs;
    const prevInit = isInitializing;
    isInitializing = true;
    applyTimeMode(prefs.timeMode);
    applyBiome(prefs.biome, false);
    applySpecies(prefs.species);
    applyFirefliesMode(prefs.firefliesMode);
    applyFishCount(prefs.fishCount);
    applyRain(prefs.rainEnabled);
    applyStonesVisibility(prefs.stonesVisible);
    applyPomodoroVisibility(prefs.pomodoroVisible);
    applyClockVisibility(prefs.showClock);
    applyPerfVisibility(prefs.showPerf);
    applyZenMode(prefs.zenMode, false);
    if (pomodoro) {
      pomodoro.setCollapsed(Boolean(prefs.pomodoroCollapsed), false);
    }
    isInitializing = prevInit;
    if (!prevInit) {
      engine.setSpecies(prefs.species);
      engine.syncFishCount(prefs.fishCount);
      syncFishCountAccessibility();
    }
  }

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

  new SmartSearchController({
    form: searchForm,
    input: searchInput,
    badgeEl: bangBadge
  });

  const initialBaseTitle = t(prefs.biome === 'ocean' ? 'pageTitleOcean' : 'pageTitlePond');
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
    baseTitle: initialBaseTitle,
    collapsed: prefs.pomodoroCollapsed,
    onCollapseChange: (collapsed) => {
      prefs.pomodoroCollapsed = collapsed;
      savePrefs(prefs);
    }
  });

  applyAllPrefsFromState(prefs);
  isInitializing = false;
  syncInertStates();
  updateClockAndGreeting();
  setInterval(updateClockAndGreeting, 1000);

  engine.start();
  scheduleObstacleSync();

  subscribePrefsChanges((syncedPrefs) => {
    applyAllPrefsFromState(syncedPrefs);
    syncInertStates();
    scheduleObstacleSync();
  });

  faunaBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setFaunaPopoverOpen(faunaPopover.hidden);
  });

  biomeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      applyBiome(btn.dataset.biome, true);
    });
  });

  envChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const key = chip.dataset.env;
      const cfg = ENV_CONFIG[key];
      if (!cfg) return;
      applyEnvFlag(key, !prefs[cfg.prefKey]);
    });
  });

  speciesCards.forEach((card) => {
    card.addEventListener('click', () => {
      const key = card.dataset.species;
      const next = { ...prefs.species, [key]: !prefs.species[key] };
      applySpecies(next);
    });
  });

  faunaPresets.forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      if (preset === 'koi') {
        applySpecies({ koi: true, turtle: false, whaleShark: false, hammerhead: false });
      } else if (preset === 'ocean') {
        applySpecies({ koi: false, turtle: true, whaleShark: true, hammerhead: true });
      } else if (preset === 'all') {
        applySpecies({ koi: true, turtle: true, whaleShark: true, hammerhead: true });
      }
    });
  });

  fireflyModeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      applyFirefliesMode(btn.dataset.fireflies);
    });
  });

  document.addEventListener('click', (e) => {
    if (!faunaPopover.hidden && !faunaPopover.contains(e.target) && !faunaBtn.contains(e.target)) {
      setFaunaPopoverOpen(false);
    }
  });

  fishSlider.addEventListener('input', (e) => {
    applyFishCount(e.target.value);
  });

  solarButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      applyTimeMode(btn.dataset.timeMode);
    });
  });

  rainBtn.addEventListener('click', () => {
    applyRain(!prefs.rainEnabled);
  });

  feedBtn.addEventListener('click', () => {
    engine.dropMultipleFood(8);
  });

  stonesToggleBtn.addEventListener('click', () => {
    applyStonesVisibility(!prefs.stonesVisible);
  });

  pomoToggleBtn.addEventListener('click', () => {
    applyPomodoroVisibility(!prefs.pomodoroVisible);
  });

  clockToggleBtn.addEventListener('click', () => {
    applyClockVisibility(!prefs.showClock);
  });

  perfBtn.addEventListener('click', () => {
    applyPerfVisibility(!prefs.showPerf);
  });

  zenBtn.addEventListener('click', () => {
    applyZenMode(!prefs.zenMode, !prefs.zenMode);
  });

  zenExitBtn.addEventListener('click', () => {
    applyZenMode(false, false);
  });

  canvas.addEventListener('click', (e) => {
    engine.dropFood(e.clientX, e.clientY);
  });

  document.addEventListener('pointermove', (e) => {
    if (e.isPrimary === false) return;
    engine.onMouseMove(e.clientX, e.clientY);

    if (prefs.zenMode) {
      const nearTopRight = e.clientX > window.innerWidth - 220 && e.clientY < 110;
      if (nearTopRight) {
        document.body.classList.add('zen-ui-peek');
        clearTimeout(zenPeekTimer);
        zenPeekTimer = setTimeout(() => {
          document.body.classList.remove('zen-ui-peek');
        }, 1600);
      }
    }
  });

  document.addEventListener('pointerup', (e) => {
    if (e.pointerType === 'touch') {
      engine.onMouseLeave();
    }
  });

  document.addEventListener('pointercancel', () => {
    engine.onMouseLeave();
  });

  document.addEventListener('pointerleave', () => {
    engine.onMouseLeave();
  });

  window.addEventListener('resize', scheduleObstacleSync);

  document.addEventListener('keydown', (e) => {
    const activeTag = document.activeElement ? document.activeElement.tagName : '';
    const isTyping = activeTag === 'INPUT' || activeTag === 'TEXTAREA';

    if (e.key === 'Escape') {
      if (!faunaPopover.hidden) {
        setFaunaPopoverOpen(false, true);
        return;
      }
      if (!stoneModal.hidden) {
        riverStones.closeModal();
        return;
      }
      if (prefs.zenMode) {
        applyZenMode(false, false);
        return;
      }
    }

    if (
      !isTyping &&
      stoneModal.hidden &&
      !e.ctrlKey &&
      !e.metaKey &&
      !e.altKey &&
      (e.key === 'z' || e.key === 'Z')
    ) {
      applyZenMode(!prefs.zenMode, !prefs.zenMode);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp, { once: true });
} else {
  initApp();
}
