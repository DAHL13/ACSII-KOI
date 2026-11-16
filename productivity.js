(function (global) {
  'use strict';

  const STONES_STORAGE_KEY = 'ascii_koi_river_stones_v1';
  const MAX_STONES = 8;

  const DEFAULT_STONES = [
    { id: 'def-gh', title: 'GitHub', url: 'https://github.com' },
    { id: 'def-yt', title: 'YouTube', url: 'https://www.youtube.com' },
    { id: 'def-gm', title: 'Gmail', url: 'https://mail.google.com' },
    { id: 'def-mdn', title: 'MDN', url: 'https://developer.mozilla.org' },
    { id: 'def-wiki', title: 'Wikipedia', url: 'https://es.wikipedia.org' },
    { id: 'def-so', title: 'StackOverflow', url: 'https://stackoverflow.com' }
  ];

  const ORGANIC_RADII = [
    '24px 20px 26px 22px / 20px 25px 21px 24px',
    '21px 26px 22px 25px / 24px 20px 25px 22px',
    '26px 22px 20px 24px / 22px 26px 24px 20px',
    '22px 24px 26px 20px / 25px 21px 20px 24px',
    '25px 21px 23px 26px / 21px 26px 22px 24px',
    '20px 25px 24px 21px / 24px 22px 26px 20px',
    '26px 20px 22px 25px / 21px 24px 23px 25px',
    '23px 25px 21px 24px / 25px 20px 24px 21px'
  ];

  const BANGS = {
    '!gh': {
      prefix: '!gh',
      label: 'GitHub',
      className: 'bang-gh',
      url: 'https://github.com/search?q='
    },
    '!yt': {
      prefix: '!yt',
      label: 'YouTube',
      className: 'bang-yt',
      url: 'https://www.youtube.com/results?search_query='
    },
    '!r': {
      prefix: '!r',
      label: 'Reddit',
      className: 'bang-r',
      url: 'https://www.reddit.com/search/?q='
    },
    '!mdn': {
      prefix: '!mdn',
      label: 'MDN',
      className: 'bang-mdn',
      url: 'https://developer.mozilla.org/es/search?q='
    },
    '!so': {
      prefix: '!so',
      label: 'StackOverflow',
      className: 'bang-so',
      url: 'https://stackoverflow.com/search?q='
    },
    '!w': {
      prefix: '!w',
      label: 'Wikipedia',
      className: 'bang-w',
      url: 'https://es.wikipedia.org/w/index.php?search='
    }
  };

  function normalizeUrl(rawUrl) {
    const trimmed = String(rawUrl || '').trim();
    if (!trimmed) return '';
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/.*)?$/i.test(trimmed)) {
      return 'http://' + trimmed;
    }
    return 'https://' + trimmed;
  }

  function extractHostname(url) {
    try {
      return new URL(normalizeUrl(url)).hostname;
    } catch (_) {
      return '';
    }
  }

  function shortenTitle(title, url) {
    const raw = (title || '').trim();
    if (raw) {
      const cleaned = raw.split(/\s[-–|·:]\s/)[0].trim();
      return cleaned.length > 14 ? cleaned.slice(0, 13) + '…' : cleaned;
    }
    const host = extractHostname(url).replace(/^www\./, '');
    const base = host.split('.')[0] || 'Sitio';
    return base.charAt(0).toUpperCase() + base.slice(1, 13);
  }

  function resolveDirectUrl(query) {
    const q = query.trim();
    if (!q || /\s/.test(q)) return null;

    if (/^https?:\/\/\S+$/i.test(q)) {
      return q;
    }
    if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?(\/\S*)?$/i.test(q)) {
      return 'http://' + q;
    }
    if (/^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/\S*)?$/i.test(q)) {
      return 'https://' + q;
    }
    return null;
  }

  /* ---------------------------------------------------------
   * 1. River Stones Shortcut Dock
   * --------------------------------------------------------- */
  class RiverStonesManager {
    constructor(options) {
      this.dockEl = options.dockEl;
      this.listEl = options.listEl;
      this.addBtn = options.addBtn;
      this.editBtn = options.editBtn;
      this.modalEl = options.modalEl;
      this.modalForm = options.modalForm;
      this.modalTitleEl = options.modalTitleEl;
      this.titleInput = options.titleInput;
      this.urlInput = options.urlInput;
      this.cancelBtn = options.cancelBtn;
      this.resetBtn = options.resetBtn;
      this.engine = options.engine;
      this.onLayoutChange = options.onLayoutChange || (() => {});

      this.stones = [];
      this.editMode = false;
      this.editingId = null;

      this.bindEvents();
      this.initStones();
    }

    bindEvents() {
      this.addBtn.addEventListener('click', () => {
        this.openModal(null);
      });

      this.editBtn.addEventListener('click', () => {
        this.editMode = !this.editMode;
        this.dockEl.classList.toggle('is-editing', this.editMode);
        this.editBtn.setAttribute('aria-pressed', String(this.editMode));
      });

      this.cancelBtn.addEventListener('click', () => {
        this.closeModal();
      });

      this.modalEl.addEventListener('click', (e) => {
        if (e.target === this.modalEl) {
          this.closeModal();
        }
      });

      this.resetBtn.addEventListener('click', () => {
        try {
          localStorage.removeItem(STONES_STORAGE_KEY);
        } catch (_) {}
        this.closeModal();
        this.editMode = false;
        this.dockEl.classList.remove('is-editing');
        this.editBtn.setAttribute('aria-pressed', 'false');
        this.loadFromTopSitesOrDefaults();
      });

      this.modalForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const title = this.titleInput.value.trim();
        const url = normalizeUrl(this.urlInput.value);
        if (!url) return;

        if (this.editingId) {
          const idx = this.stones.findIndex((s) => s.id === this.editingId);
          if (idx !== -1) {
            this.stones[idx] = {
              id: this.editingId,
              title: shortenTitle(title, url),
              url
            };
          }
        } else if (this.stones.length < MAX_STONES) {
          this.stones.push({
            id: 'stone-' + Date.now(),
            title: shortenTitle(title, url),
            url
          });
        }

        this.saveStones();
        this.render();
        this.closeModal();
      });
    }

    initStones() {
      const saved = this.loadSavedStones();
      if (saved && saved.length > 0) {
        this.stones = saved.slice(0, MAX_STONES);
        this.render();
        return;
      }
      this.loadFromTopSitesOrDefaults();
    }

    loadSavedStones() {
      try {
        const raw = localStorage.getItem(STONES_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return null;
        return parsed.filter((item) => item && item.url);
      } catch (_) {
        return null;
      }
    }

    saveStones() {
      try {
        localStorage.setItem(STONES_STORAGE_KEY, JSON.stringify(this.stones));
      } catch (_) {}
    }

    loadFromTopSitesOrDefaults() {
      if (typeof chrome !== 'undefined' && chrome.topSites && typeof chrome.topSites.get === 'function') {
        try {
          chrome.topSites.get((sites) => {
            if (chrome.runtime && chrome.runtime.lastError) {
              this.stones = DEFAULT_STONES.map((s) => ({ ...s }));
              this.render();
              return;
            }
            const valid = Array.isArray(sites)
              ? sites.filter((s) => s && /^https?:\/\//i.test(s.url)).slice(0, 6)
              : [];

            if (valid.length > 0) {
              this.stones = valid.map((s, idx) => ({
                id: 'top-' + idx,
                title: shortenTitle(s.title, s.url),
                url: s.url
              }));
            } else {
              this.stones = DEFAULT_STONES.map((s) => ({ ...s }));
            }
            this.render();
          });
          return;
        } catch (_) {
          // Fall through to defaults
        }
      }

      this.stones = DEFAULT_STONES.map((s) => ({ ...s }));
      this.render();
    }

    openModal(stone) {
      this.editingId = stone ? stone.id : null;
      this.modalTitleEl.textContent = stone ? 'Editar piedra de río' : 'Nueva piedra de río';
      this.titleInput.value = stone ? stone.title : '';
      this.urlInput.value = stone ? stone.url : '';
      this.modalEl.hidden = false;
      this.titleInput.focus();
    }

    closeModal() {
      this.modalEl.hidden = true;
      this.editingId = null;
    }

    deleteStone(id) {
      this.stones = this.stones.filter((s) => s.id !== id);
      this.saveStones();
      this.render();
    }

    render() {
      this.listEl.innerHTML = '';

      this.stones.forEach((stone, index) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'river-stone-wrap';

        const link = document.createElement('a');
        link.className = 'river-stone';
        link.href = stone.url;
        link.title = `${stone.title} · ${stone.url}`;
        link.style.borderRadius = ORGANIC_RADII[index % ORGANIC_RADII.length];

        link.addEventListener('mouseenter', () => {
          if (!this.engine) return;
          const rect = link.getBoundingClientRect();
          this.engine.spawnRipple(
            rect.left + rect.width * 0.5,
            rect.top + rect.height * 0.5,
            84,
            1.1,
            0.55
          );
        });

        const host = extractHostname(stone.url);
        const iconBox = document.createElement('span');
        iconBox.className = 'stone-icon-wrap';

        const showInitialFallback = () => {
          if (iconBox.querySelector('.stone-fallback')) return;
          iconBox.innerHTML = '';
          const cleanHost = host.replace(/^www\./, '');
          const fallback = document.createElement('span');
          fallback.className = 'stone-fallback';
          fallback.textContent = (cleanHost || stone.title || 'S').charAt(0).toUpperCase();
          iconBox.appendChild(fallback);
        };

        const img = document.createElement('img');
        img.className = 'stone-favicon';
        img.alt = '';
        img.width = 20;
        img.height = 20;
        img.decoding = 'async';

        const remoteUrl = host
          ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`
          : '';
        const hasNativeFavicon =
          typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function';
        let triedRemote = !hasNativeFavicon;

        const handleImgError = () => {
          if (!triedRemote && remoteUrl) {
            triedRemote = true;
            img.src = remoteUrl;
          } else {
            showInitialFallback();
          }
        };

        img.addEventListener('error', handleImgError);
        img.addEventListener('load', () => {
          if (img.naturalWidth === 0) handleImgError();
        });

        if (hasNativeFavicon) {
          img.src = chrome.runtime.getURL('/_favicon/?pageUrl=' + encodeURIComponent(stone.url) + '&size=64');
        } else if (remoteUrl) {
          img.src = remoteUrl;
        } else {
          showInitialFallback();
        }

        if (hasNativeFavicon || remoteUrl) {
          iconBox.appendChild(img);
        }

        const label = document.createElement('span');
        label.className = 'stone-title';
        label.textContent = stone.title;

        link.appendChild(iconBox);
        link.appendChild(label);

        // Edit / Delete overlays in edit mode
        const actions = document.createElement('div');
        actions.className = 'stone-edit-actions';

        const editOne = document.createElement('button');
        editOne.type = 'button';
        editOne.className = 'stone-mini-btn';
        editOne.title = 'Editar enlace';
        editOne.textContent = '✎';
        editOne.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.openModal(stone);
        });

        const delOne = document.createElement('button');
        delOne.type = 'button';
        delOne.className = 'stone-mini-btn stone-mini-del';
        delOne.title = 'Eliminar enlace';
        delOne.textContent = '×';
        delOne.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.deleteStone(stone.id);
        });

        actions.appendChild(editOne);
        actions.appendChild(delOne);

        wrapper.appendChild(link);
        wrapper.appendChild(actions);
        this.listEl.appendChild(wrapper);
      });

      this.addBtn.disabled = this.stones.length >= MAX_STONES;
      requestAnimationFrame(() => this.onLayoutChange());
    }
  }

  /* ---------------------------------------------------------
   * 2. Smart Search & Bangs Parser
   * --------------------------------------------------------- */
  class SmartSearchController {
    constructor(options) {
      this.form = options.form;
      this.input = options.input;
      this.badgeEl = options.badgeEl;
      this.defaultPlaceholder = this.input.placeholder;
      this.activeBang = null;

      this.bindEvents();
    }

    bindEvents() {
      this.input.addEventListener('input', () => {
        if (this.activeBang) return;
        const val = this.input.value;
        const match = val.match(/^(!(?:gh|yt|r|mdn|so|w))\s+(.*)$/i);
        if (match) {
          const bang = BANGS[match[1].toLowerCase()];
          if (bang) {
            this.setBang(bang);
            this.input.value = match[2];
          }
        }
      });

      this.input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && this.activeBang && this.input.value === '') {
          e.preventDefault();
          this.clearBang();
        }
      });

      this.badgeEl.addEventListener('click', () => {
        this.clearBang();
        this.input.focus();
      });

      this.form.addEventListener('submit', (e) => {
        const query = this.input.value.trim();

        if (this.activeBang) {
          e.preventDefault();
          if (!query) {
            this.input.focus();
            return;
          }
          window.location.assign(this.activeBang.url + encodeURIComponent(query));
          return;
        }

        if (!query) {
          e.preventDefault();
          this.input.focus();
          return;
        }

        const directUrl = resolveDirectUrl(query);
        if (directUrl) {
          e.preventDefault();
          window.location.assign(directUrl);
          return;
        }

        e.preventDefault();
        if (typeof chrome !== 'undefined' && chrome.search?.query) {
          try {
            chrome.search.query({ text: query, disposition: 'CURRENT_TAB' });
            return;
          } catch (_) {
            // Fall through to standard Google search fallback
          }
        }
        window.location.href = 'https://www.google.com/search?q=' + encodeURIComponent(query);
      });
    }

    setBang(bang) {
      this.activeBang = bang;
      this.badgeEl.textContent = bang.label;
      this.badgeEl.className = `bang-badge ${bang.className}`;
      this.badgeEl.hidden = false;
      this.input.placeholder = `Buscar en ${bang.label}...`;
    }

    clearBang() {
      this.activeBang = null;
      this.badgeEl.hidden = true;
      this.badgeEl.textContent = '';
      this.badgeEl.className = 'bang-badge';
      this.input.placeholder = this.defaultPlaceholder;
    }
  }

  /* ---------------------------------------------------------
   * 3. Pomodoro Timer Connected to Pond Cherry Blossoms
   * --------------------------------------------------------- */
  class PomodoroController {
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
      this.endTimeMs = 0;
      this.timerId = null;
      this.circumference = 2 * Math.PI * 20;

      this.ringEl.style.strokeDasharray = `${this.circumference}`;
      this.bindEvents();
      this.setCollapsed(Boolean(options.collapsed), false);
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
          this.statusEl.textContent = 'Pétalos de cerezo 🌸';
        }
      });
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
      this.pause();
      this.mode = mode;
      this.remainingSec = this.durations[mode];
      this.modeButtons.forEach((btn) => {
        btn.classList.toggle('is-active', btn.dataset.pomoMode === mode);
      });
      this.statusEl.textContent = mode === 'focus' ? 'Enfoque zen' : 'Descanso breve';
      this.render();
    }

    start() {
      if (this.running) return;
      if (this.remainingSec <= 0) {
        this.remainingSec = this.durations[this.mode];
      }
      this.running = true;
      this.endTimeMs = performance.now() + this.remainingSec * 1000;
      this.statusEl.textContent = this.mode === 'focus' ? 'Enfoque activo' : 'Descansando';
      this.updatePlayIcon();

      this.timerId = setInterval(() => {
        const leftSec = Math.max(0, Math.ceil((this.endTimeMs - performance.now()) / 1000));
        if (leftSec !== this.remainingSec) {
          this.remainingSec = leftSec;
          this.render();
        }
        if (leftSec <= 0) {
          this.completeSession();
        }
      }, 250);
    }

    pause() {
      if (!this.running) return;
      this.running = false;
      clearInterval(this.timerId);
      this.timerId = null;
      this.remainingSec = Math.max(0, Math.ceil((this.endTimeMs - performance.now()) / 1000));
      this.statusEl.textContent = 'En pausa';
      this.updatePlayIcon();
      this.render();
    }

    reset() {
      this.pause();
      this.remainingSec = this.durations[this.mode];
      this.statusEl.textContent = this.mode === 'focus' ? 'Enfoque zen' : 'Descanso breve';
      this.render();
    }

    completeSession() {
      this.pause();
      if (this.mode === 'focus') {
        if (this.ecosystem) {
          this.ecosystem.triggerCherryBlossomShower(25);
        }
        this.mode = 'break';
        this.remainingSec = this.durations.break;
        this.modeButtons.forEach((btn) => {
          btn.classList.toggle('is-active', btn.dataset.pomoMode === 'break');
        });
        this.statusEl.textContent = '¡Sesión completada! 🌸';
      } else {
        this.mode = 'focus';
        this.remainingSec = this.durations.focus;
        this.modeButtons.forEach((btn) => {
          btn.classList.toggle('is-active', btn.dataset.pomoMode === 'focus');
        });
        this.statusEl.textContent = 'Listo para enfocar';
      }
      this.render();
    }

    updatePlayIcon() {
      this.playBtn.setAttribute('aria-label', this.running ? 'Pausar Pomodoro' : 'Iniciar Pomodoro');
      this.playBtn.title = this.running ? 'Pausar' : 'Iniciar';
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
    }
  }

  global.RiverStonesManager = RiverStonesManager;
  global.SmartSearchController = SmartSearchController;
  global.PomodoroController = PomodoroController;
})(window);
