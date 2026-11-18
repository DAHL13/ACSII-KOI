(function () {
  'use strict';

  const STORAGE_KEY = 'ascii_koi_zen_prefs_v3';
  const DEFAULT_PREFS = {
    fishCount: 12,
    biome: 'pond',
    species: {
      koi: true,
      turtle: false,
      whaleShark: false,
      hammerhead: false
    },
    firefliesMode: 'auto',
    timeMode: 'auto',
    rainEnabled: false,
    liliesEnabled: true,
    currentsEnabled: false,
    planktonEnabled: false,
    kelpEnabled: false,
    jellyfishEnabled: false,
    schoolEnabled: false,
    zenMode: false,
    showClock: true,
    showPerf: false,
    stonesVisible: true,
    pomodoroVisible: true,
    pomodoroCollapsed: false
  };

  function clampInt(val, min, max, fallback) {
    const n = parseInt(val, 10);
    if (Number.isNaN(n)) return fallback;
    return Math.min(max, Math.max(min, n));
  }

  function loadPrefs() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('ascii_koi_zen_prefs_v2');
      if (!raw) {
        return {
          ...DEFAULT_PREFS,
          species: { ...DEFAULT_PREFS.species }
        };
      }
      const parsed = JSON.parse(raw);
      const parsedSp = parsed.species || {};
      return {
        fishCount: clampInt(parsed.fishCount, 5, 25, DEFAULT_PREFS.fishCount),
        biome: parsed.biome === 'ocean' ? 'ocean' : 'pond',
        species: {
          koi: parsedSp.koi !== undefined ? Boolean(parsedSp.koi) : DEFAULT_PREFS.species.koi,
          turtle: Boolean(parsedSp.turtle),
          whaleShark: Boolean(parsedSp.whaleShark),
          hammerhead: Boolean(parsedSp.hammerhead)
        },
        firefliesMode: ['auto', 'on', 'off'].includes(parsed.firefliesMode)
          ? parsed.firefliesMode
          : DEFAULT_PREFS.firefliesMode,
        timeMode: ['auto', 'day', 'sunset', 'night'].includes(parsed.timeMode)
          ? parsed.timeMode
          : DEFAULT_PREFS.timeMode,
        rainEnabled: Boolean(parsed.rainEnabled),
        liliesEnabled: parsed.liliesEnabled !== undefined ? Boolean(parsed.liliesEnabled) : DEFAULT_PREFS.liliesEnabled,
        currentsEnabled: Boolean(parsed.currentsEnabled),
        planktonEnabled: Boolean(parsed.planktonEnabled),
        kelpEnabled: Boolean(parsed.kelpEnabled),
        jellyfishEnabled: Boolean(parsed.jellyfishEnabled),
        schoolEnabled: Boolean(parsed.schoolEnabled),
        zenMode: Boolean(parsed.zenMode),
        showClock: parsed.showClock !== undefined ? Boolean(parsed.showClock) : DEFAULT_PREFS.showClock,
        showPerf: Boolean(parsed.showPerf),
        stonesVisible: parsed.stonesVisible !== undefined ? Boolean(parsed.stonesVisible) : DEFAULT_PREFS.stonesVisible,
        pomodoroVisible: parsed.pomodoroVisible !== undefined ? Boolean(parsed.pomodoroVisible) : DEFAULT_PREFS.pomodoroVisible,
        pomodoroCollapsed: Boolean(parsed.pomodoroCollapsed)
      };
    } catch (_) {
      return {
        ...DEFAULT_PREFS,
        species: { ...DEFAULT_PREFS.species }
      };
    }
  }

  function savePrefs(prefs) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch (_) {
      // Ignore storage errors
    }
  }

  function getGreeting(hour) {
    if (hour >= 5 && hour < 12) return 'Buenos días';
    if (hour >= 12 && hour < 20) return 'Buenas tardes';
    return 'Buenas noches';
  }

  document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('koi-canvas');
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

    // River stones & modal elements
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

    // Pomodoro elements
    const pomoWidget = document.getElementById('pomodoro-widget');
    const pomoCollapseBtn = document.getElementById('pomo-collapse-btn');
    const pomoTimeEl = document.getElementById('pomo-time');
    const pomoStatusEl = document.getElementById('pomo-status');
    const pomoRingEl = document.getElementById('pomo-ring');
    const pomoPlayBtn = document.getElementById('pomo-play-btn');
    const pomoResetBtn = document.getElementById('pomo-reset-btn');
    const pomoTestBtn = document.getElementById('pomo-test-btn');
    const pomoModeButtons = Array.from(document.querySelectorAll('.pomo-mode-btn'));

    const prefs = loadPrefs();
    let toastTimer = null;
    let zenPeekTimer = null;
    let currentSolarAttr = '';

    const atlas = new window.GlyphAtlas(window.devicePixelRatio || 1);

    const ecosystem = new window.PondEcosystem(window.innerWidth, window.innerHeight, {
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

    const engine = new window.KoiPondEngine(canvas, atlas, ecosystem, {
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

    function applyTimeMode(mode) {
      prefs.timeMode = mode;
      ecosystem.setTimeMode(mode);
      solarButtons.forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.timeMode === mode);
      });
      syncSolarAttribute();
      savePrefs(prefs);
    }

    const SPECIES_SHORT_LABELS = {
      koi: 'Koi',
      turtle: 'Tortugas',
      whaleShark: 'T. Ballena',
      hammerhead: 'T. Martillo'
    };

    function updateFaunaTriggerLabel() {
      const sp = prefs.species;
      const activeKeys = Object.keys(SPECIES_SHORT_LABELS).filter((k) => sp[k]);
      if (activeKeys.length === 0) {
        faunaBtnLabel.textContent = prefs.firefliesMode === 'on' ? 'Luciérnagas' : 'Fauna (0)';
      } else if (activeKeys.length === 1) {
        faunaBtnLabel.textContent = SPECIES_SHORT_LABELS[activeKeys[0]];
      } else {
        faunaBtnLabel.textContent = `Fauna (${activeKeys.length})`;
      }
      fishCountValue.textContent = String(engine.kois.length);
    }

    function applySpecies(nextSpecies) {
      prefs.species = {
        koi: Boolean(nextSpecies.koi),
        turtle: Boolean(nextSpecies.turtle),
        whaleShark: Boolean(nextSpecies.whaleShark),
        hammerhead: Boolean(nextSpecies.hammerhead)
      };
      engine.setSpecies(prefs.species);
      speciesCards.forEach((card) => {
        const active = prefs.species[card.dataset.species];
        card.classList.toggle('is-active', active);
        card.setAttribute('aria-pressed', String(active));
      });
      updateFaunaTriggerLabel();
      savePrefs(prefs);
    }

    function applyFirefliesMode(mode) {
      prefs.firefliesMode = mode;
      ecosystem.setFirefliesMode(mode);
      fireflyModeButtons.forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.fireflies === mode);
      });
      updateFaunaTriggerLabel();
      savePrefs(prefs);
    }

    function setFaunaPopoverOpen(open) {
      faunaPopover.hidden = !open;
      faunaBtn.setAttribute('aria-expanded', String(open));
    }

    function applyFishCount(value) {
      const count = clampInt(value, 5, 25, DEFAULT_PREFS.fishCount);
      prefs.fishCount = count;
      fishSlider.value = String(count);
      engine.syncFishCount(count);
      fishCountValue.textContent = String(engine.kois.length);
      savePrefs(prefs);
    }

    function applyRain(enabled) {
      prefs.rainEnabled = Boolean(enabled);
      ecosystem.setRainEnabled(prefs.rainEnabled);
      rainBtn.setAttribute('aria-pressed', String(prefs.rainEnabled));
      savePrefs(prefs);
    }

    function syncEnvFlags() {
      ecosystem.setLiliesEnabled(prefs.liliesEnabled);
      ecosystem.setCurrentsEnabled(prefs.currentsEnabled);
      ecosystem.setPlanktonEnabled(prefs.planktonEnabled);
      ecosystem.setKelpEnabled(prefs.kelpEnabled);
      ecosystem.setJellyfishEnabled(prefs.jellyfishEnabled);
      engine.setSchoolEnabled(prefs.schoolEnabled);

      const map = {
        lilies: prefs.liliesEnabled,
        currents: prefs.currentsEnabled,
        plankton: prefs.planktonEnabled,
        kelp: prefs.kelpEnabled,
        jellyfish: prefs.jellyfishEnabled,
        school: prefs.schoolEnabled
      };
      envChips.forEach((chip) => {
        const active = Boolean(map[chip.dataset.env]);
        chip.classList.toggle('is-active', active);
        chip.setAttribute('aria-pressed', String(active));
      });
    }

    function applyBiome(biome, applyPreset = true) {
      prefs.biome = biome === 'ocean' ? 'ocean' : 'pond';
      document.documentElement.setAttribute('data-biome', prefs.biome);
      ecosystem.setBiome(prefs.biome);

      biomeButtons.forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.biome === prefs.biome);
      });

      if (applyPreset) {
        if (prefs.biome === 'ocean') {
          prefs.liliesEnabled = false;
          prefs.currentsEnabled = true;
          prefs.planktonEnabled = true;
          prefs.kelpEnabled = true;
          prefs.jellyfishEnabled = true;
          prefs.schoolEnabled = true;
        } else {
          prefs.liliesEnabled = true;
          prefs.currentsEnabled = false;
          prefs.planktonEnabled = false;
          prefs.kelpEnabled = false;
          prefs.jellyfishEnabled = false;
          prefs.schoolEnabled = false;
        }
      }

      syncEnvFlags();
      savePrefs(prefs);
    }

    function applyEnvFlag(envKey, enabled) {
      const val = Boolean(enabled);
      if (envKey === 'lilies') prefs.liliesEnabled = val;
      else if (envKey === 'currents') prefs.currentsEnabled = val;
      else if (envKey === 'plankton') prefs.planktonEnabled = val;
      else if (envKey === 'kelp') prefs.kelpEnabled = val;
      else if (envKey === 'jellyfish') prefs.jellyfishEnabled = val;
      else if (envKey === 'school') prefs.schoolEnabled = val;
      syncEnvFlags();
      savePrefs(prefs);
    }

    function applyStonesVisibility(visible) {
      prefs.stonesVisible = Boolean(visible);
      stonesDock.classList.toggle('is-hidden', !prefs.stonesVisible);
      stonesToggleBtn.setAttribute('aria-pressed', String(prefs.stonesVisible));
      savePrefs(prefs);
      requestAnimationFrame(syncObstacles);
    }

    function applyPomodoroVisibility(visible) {
      prefs.pomodoroVisible = Boolean(visible);
      pomoWidget.classList.toggle('is-hidden', !prefs.pomodoroVisible);
      pomoToggleBtn.setAttribute('aria-pressed', String(prefs.pomodoroVisible));
      savePrefs(prefs);
    }

    function applyClockVisibility(visible) {
      prefs.showClock = visible;
      clockWrap.classList.toggle('is-hidden', !visible);
      clockToggleBtn.setAttribute('aria-pressed', String(visible));
      savePrefs(prefs);
      requestAnimationFrame(syncObstacles);
    }

    function applyPerfVisibility(visible) {
      prefs.showPerf = Boolean(visible);
      perfBadge.hidden = !prefs.showPerf;
      perfBtn.setAttribute('aria-pressed', String(prefs.showPerf));
      if (prefs.showPerf) {
        perfText.textContent = `${engine.fps} FPS · ${engine.frameTimeMs.toFixed(1)} ms`;
      }
      savePrefs(prefs);
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
      document.body.classList.toggle('zen-mode', enabled);
      zenBtn.setAttribute('aria-pressed', String(enabled));
      savePrefs(prefs);

      if (enabled) {
        setFaunaPopoverOpen(false);
        searchInput.blur();
        if (notify) showZenToast();
      } else {
        zenToast.classList.remove('is-visible');
      }

      requestAnimationFrame(syncObstacles);
    }

    function updateClockAndGreeting() {
      const now = new Date();
      const hours = now.getHours();
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const hoursStr = String(hours).padStart(2, '0');

      clockEl.textContent = `${hoursStr}:${minutes}`;
      clockEl.setAttribute('datetime', `${hoursStr}:${minutes}`);
      greetingEl.textContent = getGreeting(hours);

      try {
        dateLabelEl.textContent = now.toLocaleDateString('es-ES', {
          weekday: 'long',
          day: 'numeric',
          month: 'long'
        });
      } catch (_) {
        dateLabelEl.textContent = '';
      }

      if (prefs.timeMode === 'auto') {
        syncSolarAttribute();
      }
    }

    // Initialize Module 3 Productivity Controllers
    new window.RiverStonesManager({
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
      onLayoutChange: syncObstacles
    });

    new window.SmartSearchController({
      form: searchForm,
      input: searchInput,
      badgeEl: bangBadge
    });

    new window.PomodoroController({
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
      collapsed: prefs.pomodoroCollapsed,
      onCollapseChange: (collapsed) => {
        prefs.pomodoroCollapsed = collapsed;
        savePrefs(prefs);
      }
    });

    // Apply initial preferences
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
    updateClockAndGreeting();
    setInterval(updateClockAndGreeting, 1000);

    engine.start();
    requestAnimationFrame(syncObstacles);

    // Fauna & environment popover listeners
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
        const current =
          key === 'lilies' ? prefs.liliesEnabled :
          key === 'currents' ? prefs.currentsEnabled :
          key === 'plankton' ? prefs.planktonEnabled :
          key === 'kelp' ? prefs.kelpEnabled :
          key === 'jellyfish' ? prefs.jellyfishEnabled :
          prefs.schoolEnabled;
        applyEnvFlag(key, !current);
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

    // Top-bar listeners
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

    document.addEventListener('mousemove', (e) => {
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

    document.addEventListener('mouseleave', () => {
      engine.onMouseLeave();
    });

    window.addEventListener('resize', () => {
      requestAnimationFrame(syncObstacles);
    });

    document.addEventListener('keydown', (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName : '';
      const isTyping = activeTag === 'INPUT' || activeTag === 'TEXTAREA';

      if (e.key === 'Escape') {
        if (!faunaPopover.hidden) {
          setFaunaPopoverOpen(false);
          return;
        }
        if (!stoneModal.hidden) {
          stoneModal.hidden = true;
          return;
        }
        if (prefs.zenMode) {
          applyZenMode(false, false);
          return;
        }
      }

      if (!isTyping && (e.key === 'z' || e.key === 'Z')) {
        applyZenMode(!prefs.zenMode, !prefs.zenMode);
      }
    });
  });
})();
