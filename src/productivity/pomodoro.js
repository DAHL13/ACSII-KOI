import { POMO_STORAGE_KEY } from '../core/constants.js';
import { t } from '../core/i18n.js';

export class PomodoroController {
  constructor(options) {
    this.widgetEl = options.widgetEl;
    this.collapseBtn = options.collapseBtn;
    this.timeEl = options.timeEl;
    this.statusEl = options.statusEl;
    this.ringEl = options.ringEl;
    this.playBtn = options.playBtn;
    this.resetBtn = options.resetBtn;
    this.testBtn = options.testBtn;
    this.modeButtons = options.modeButtons;
    this.ecosystem = options.ecosystem;
    this.onCollapseChange = options.onCollapseChange || (() => {});

    this.durations = {
      focus: 25 * 60,
      break: 5 * 60
    };

    this.mode = 'focus';
    this.remainingSec = this.durations.focus;
    this.running = false;
    this.endWallClockMs = 0;
    this.timerId = null;
    this.sakuraStatusTimer = null;
    this.circumference = 2 * Math.PI * 20;
    this.baseDocTitle = options.baseTitle || document.title || t('pageTitlePond');
    this.handleStorage = this.onStorageEvent.bind(this);

    this.ringEl.style.strokeDasharray = `${this.circumference}`;
    this.bindEvents();
    this.setCollapsed(Boolean(options.collapsed), false);
    this.loadState(true);
    window.addEventListener('storage', this.handleStorage);
    this.render();
  }

  setBaseTitle(title) {
    this.baseDocTitle = title || t('pageTitlePond');
    this.render();
  }

  bindEvents() {
    this.collapseBtn.addEventListener('click', () => {
      const next = !this.widgetEl.classList.contains('is-collapsed');
      this.setCollapsed(next, true);
    });

    this.modeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        this.switchMode(btn.dataset.pomoMode);
      });
    });

    this.playBtn.addEventListener('click', () => {
      if (this.running) this.pause();
      else this.start();
    });

    this.resetBtn.addEventListener('click', () => {
      this.reset();
    });

    this.testBtn.addEventListener('click', () => {
      if (this.ecosystem) {
        this.ecosystem.triggerCherryBlossomShower(25);
        this.clearSakuraStatusTimer();
        this.statusEl.textContent = t('pomoStatusSakura');
        this.sakuraStatusTimer = setTimeout(() => {
          this.sakuraStatusTimer = null;
          this.statusEl.textContent = this.getDefaultStatusText();
        }, 4000);
      }
    });
  }

  getDefaultStatusText() {
    if (this.running) {
      return this.mode === 'focus' ? t('pomoStatusFocusRun') : t('pomoStatusBreakRun');
    }
    return this.mode === 'focus' ? t('pomoStatusFocusIdle') : t('pomoStatusBreakIdle');
  }

  syncModeButtons() {
    this.modeButtons.forEach((btn) => {
      const active = btn.dataset.pomoMode === this.mode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  clearSakuraStatusTimer() {
    clearTimeout(this.sakuraStatusTimer);
    this.sakuraStatusTimer = null;
  }

  startTicker() {
    this.stopTicker();
    this.timerId = setInterval(() => {
      const leftSec = Math.max(0, Math.ceil((this.endWallClockMs - Date.now()) / 1000));
      if (leftSec !== this.remainingSec) {
        this.remainingSec = leftSec;
        this.render();
      }
      if (leftSec <= 0) {
        this.completeSession();
      }
    }, 250);
  }

  stopTicker() {
    if (this.timerId !== null) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  saveState() {
    try {
      localStorage.setItem(
        POMO_STORAGE_KEY,
        JSON.stringify({
          mode: this.mode,
          running: this.running,
          endWallClockMs: this.endWallClockMs,
          remainingSec: this.remainingSec
        })
      );
    } catch (_) {}
  }

  loadState(triggerCatchupShower = false) {
    this.stopTicker();
    try {
      const raw = localStorage.getItem(POMO_STORAGE_KEY);
      if (!raw) {
        this.mode = 'focus';
        this.remainingSec = this.durations.focus;
        this.running = false;
        this.endWallClockMs = 0;
        this.syncModeButtons();
        this.statusEl.textContent = this.getDefaultStatusText();
        return;
      }
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return;

      const mode = parsed.mode === 'break' ? 'break' : 'focus';
      const maxDur = this.durations[mode];
      const rawRem = Number(parsed.remainingSec);
      const storedRem = Number.isFinite(rawRem)
        ? Math.min(maxDur, Math.max(0, Math.round(rawRem)))
        : maxDur;
      const endWall = Number(parsed.endWallClockMs);

      if (parsed.running === true && Number.isFinite(endWall) && endWall > 0) {
        const leftSec = Math.max(0, Math.ceil((endWall - Date.now()) / 1000));
        if (leftSec > 0) {
          this.mode = mode;
          this.remainingSec = Math.min(maxDur, leftSec);
          this.running = true;
          this.endWallClockMs = endWall;
          this.syncModeButtons();
          this.statusEl.textContent = this.getDefaultStatusText();
          this.startTicker();
        } else {
          const nextMode = mode === 'focus' ? 'break' : 'focus';
          this.running = false;
          this.endWallClockMs = 0;
          this.mode = nextMode;
          this.remainingSec = this.durations[nextMode];
          this.syncModeButtons();
          this.statusEl.textContent = mode === 'focus' ? t('pomoStatusComplete') : t('pomoStatusReady');
          if (triggerCatchupShower && mode === 'focus' && this.ecosystem) {
            this.ecosystem.triggerCherryBlossomShower(25);
          }
          this.saveState();
        }
        return;
      }

      this.running = false;
      this.endWallClockMs = 0;
      this.mode = mode;
      this.remainingSec = storedRem > 0 ? storedRem : maxDur;
      this.syncModeButtons();
      this.statusEl.textContent =
        this.remainingSec < maxDur ? t('pomoStatusPaused') : this.getDefaultStatusText();
    } catch (_) {}
  }

  onStorageEvent(e) {
    if (e && e.key !== null && e.key !== POMO_STORAGE_KEY) return;
    this.clearSakuraStatusTimer();
    this.loadState(false);
    this.render();
  }

  setCollapsed(collapsed, notify = true) {
    this.widgetEl.classList.toggle('is-collapsed', collapsed);
    this.collapseBtn.setAttribute('aria-expanded', String(!collapsed));
    if (notify) {
      this.onCollapseChange(collapsed);
    }
  }

  switchMode(mode) {
    if (!this.durations[mode]) return;
    this.stopTicker();
    this.clearSakuraStatusTimer();
    this.running = false;
    this.endWallClockMs = 0;
    this.mode = mode;
    this.remainingSec = this.durations[mode];
    this.syncModeButtons();
    this.statusEl.textContent = this.getDefaultStatusText();
    this.saveState();
    this.render();
  }

  start() {
    if (this.running) return;
    this.clearSakuraStatusTimer();
    if (this.remainingSec <= 0) {
      this.remainingSec = this.durations[this.mode];
    }
    this.running = true;
    this.endWallClockMs = Date.now() + this.remainingSec * 1000;
    this.statusEl.textContent = this.getDefaultStatusText();
    this.saveState();
    this.render();
    this.startTicker();
  }

  pause() {
    if (!this.running) return;
    this.clearSakuraStatusTimer();
    this.running = false;
    this.stopTicker();
    this.remainingSec = Math.max(0, Math.ceil((this.endWallClockMs - Date.now()) / 1000));
    this.endWallClockMs = 0;
    this.statusEl.textContent = t('pomoStatusPaused');
    this.saveState();
    this.render();
  }

  reset() {
    this.stopTicker();
    this.clearSakuraStatusTimer();
    this.running = false;
    this.endWallClockMs = 0;
    this.remainingSec = this.durations[this.mode];
    this.statusEl.textContent = this.getDefaultStatusText();
    this.saveState();
    this.render();
  }

  completeSession() {
    this.stopTicker();
    this.clearSakuraStatusTimer();
    this.running = false;
    this.endWallClockMs = 0;
    if (this.mode === 'focus') {
      if (this.ecosystem) {
        this.ecosystem.triggerCherryBlossomShower(25);
      }
      this.mode = 'break';
      this.remainingSec = this.durations.break;
      this.syncModeButtons();
      this.statusEl.textContent = t('pomoStatusComplete');
    } else {
      this.mode = 'focus';
      this.remainingSec = this.durations.focus;
      this.syncModeButtons();
      this.statusEl.textContent = t('pomoStatusReady');
    }
    this.saveState();
    this.render();
  }

  updatePlayIcon() {
    this.playBtn.setAttribute('aria-label', this.running ? t('pomoPauseAria') : t('pomoStartAria'));
    this.playBtn.title = this.running ? t('pomoPause') : t('pomoStart');
    this.playBtn.classList.toggle('is-running', this.running);
  }

  render() {
    const mins = String(Math.floor(this.remainingSec / 60)).padStart(2, '0');
    const secs = String(this.remainingSec % 60).padStart(2, '0');
    this.timeEl.textContent = `${mins}:${secs}`;

    const total = this.durations[this.mode];
    const progress = total > 0 ? this.remainingSec / total : 0;
    const offset = this.circumference * (1 - progress);
    this.ringEl.style.strokeDashoffset = `${offset}`;
    this.updatePlayIcon();

    const docLabel = this.mode === 'focus' ? t('pomoDocFocus') : t('pomoDocBreak');
    document.title = this.running ? `${mins}:${secs} · ${docLabel} — ${this.baseDocTitle}` : this.baseDocTitle;
  }

  destroy() {
    this.stopTicker();
    this.clearSakuraStatusTimer();
    window.removeEventListener('storage', this.handleStorage);
    document.title = this.baseDocTitle;
  }
}
