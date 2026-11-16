(function () {
  'use strict';

  const STORAGE_KEY = 'ascii_koi_zen_prefs_v3';
  const DEFAULT_PREFS = {
    fishCount: 12,
    timeMode: 'auto',
    rainEnabled: false,
    liliesEnabled: true,
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
      if (!raw) return { ...DEFAULT_PREFS };
      const parsed = JSON.parse(raw);
      return {
        fishCount: clampInt(parsed.fishCount, 5, 25, DEFAULT_PREFS.fishCount),
        timeMode: ['auto', 'day', 'sunset', 'night'].includes(parsed.timeMode)
          ? parsed.timeMode
          : DEFAULT_PREFS.timeMode,
        rainEnabled: Boolean(parsed.rainEnabled),
        liliesEnabled: parsed.liliesEnabled !== undefined ? Boolean(parsed.liliesEnabled) : DEFAULT_PREFS.liliesEnabled,
        zenMode: Boolean(parsed.zenMode),
        showClock: parsed.showClock !== undefined ? Boolean(parsed.showClock) : DEFAULT_PREFS.showClock,
        showPerf: Boolean(parsed.showPerf),
        stonesVisible: parsed.stonesVisible !== undefined ? Boolean(parsed.stonesVisible) : DEFAULT_PREFS.stonesVisible,
        pomodoroVisible: parsed.pomodoroVisible !== undefined ? Boolean(parsed.pomodoroVisible) : DEFAULT_PREFS.pomodoroVisible,
        pomodoroCollapsed: Boolean(parsed.pomodoroCollapsed)
      };
    } catch (_) {
      return { ...DEFAULT_PREFS };
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
    const fishSlider = document.getElementById('fish-count');
    const fishCountValue = document.getElementById('fish-count-value');
    const solarButtons = Array.from(document.querySelectorAll('.solar-btn'));
    const rainBtn = document.getElementById('rain-btn');
    const liliesBtn = document.getElementById('lilies-btn');
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
      rainEnabled: prefs.rainEnabled,
      liliesEnabled: prefs.liliesEnabled
    });

    const engine = new window.KoiPondEngine(canvas, atlas, ecosystem, {
      fishCount: prefs.fishCount,
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

    function applyFishCount(value) {
      const count = clampInt(value, 5, 25, DEFAULT_PREFS.fishCount);
      prefs.fishCount = count;
      fishSlider.value = String(count);
      fishCountValue.textContent = String(count);
      engine.syncFishCount(count);
      savePrefs(prefs);
    }

    function applyRain(enabled) {
      prefs.rainEnabled = Boolean(enabled);
      ecosystem.setRainEnabled(prefs.rainEnabled);
      rainBtn.setAttribute('aria-pressed', String(prefs.rainEnabled));
      savePrefs(prefs);
    }

    function applyLilies(enabled) {
      prefs.liliesEnabled = Boolean(enabled);
      ecosystem.setLiliesEnabled(prefs.liliesEnabled);
      liliesBtn.setAttribute('aria-pressed', String(prefs.liliesEnabled));
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
    applyFishCount(prefs.fishCount);
    applyRain(prefs.rainEnabled);
    applyLilies(prefs.liliesEnabled);
    applyStonesVisibility(prefs.stonesVisible);
    applyPomodoroVisibility(prefs.pomodoroVisible);
    applyClockVisibility(prefs.showClock);
    applyPerfVisibility(prefs.showPerf);
    applyZenMode(prefs.zenMode, false);
    updateClockAndGreeting();
    setInterval(updateClockAndGreeting, 1000);

    engine.start();
    requestAnimationFrame(syncObstacles);

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

    liliesBtn.addEventListener('click', () => {
      applyLilies(!prefs.liliesEnabled);
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
