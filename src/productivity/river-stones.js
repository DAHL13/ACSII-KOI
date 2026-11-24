import { MAX_STONES, STONES_STORAGE_KEY } from '../core/constants.js';
import { getShortLang, t } from '../core/i18n.js';
import { loadSavedStones, saveStonesList, syncRemoveKey } from '../core/storage.js';
import { createStoneId, extractHostname, sanitizeHttpUrl, shortenTitle } from './url-utils.js';

function getDefaultStones() {
  const wikiHost = getShortLang() === 'en' ? 'en.wikipedia.org' : 'es.wikipedia.org';
  return [
    { id: 'def-gh', title: 'GitHub', url: 'https://github.com' },
    { id: 'def-yt', title: 'YouTube', url: 'https://www.youtube.com' },
    { id: 'def-gm', title: 'Gmail', url: 'https://mail.google.com' },
    { id: 'def-mdn', title: 'MDN', url: 'https://developer.mozilla.org' },
    { id: 'def-wiki', title: 'Wikipedia', url: `https://${wikiHost}` },
    { id: 'def-so', title: 'StackOverflow', url: 'https://stackoverflow.com' }
  ];
}

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

export class RiverStonesManager {
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
    this.onModalToggle = options.onModalToggle || (() => {});

    this.stones = [];
    this.editMode = false;
    this.editingId = null;
    this.draggingId = null;
    this.lastTriggerEl = null;
    this.confirmResetPending = false;
    this.confirmResetTimer = null;
    this.defaultResetLabel = (this.resetBtn.textContent || t('stoneResetAll')).trim();
    this.handleStorage = (e) => {
      if (e && e.key !== null && e.key !== STONES_STORAGE_KEY) return;
      this.initStones();
    };

    this.bindEvents();
    this.initStones();
    window.addEventListener('storage', this.handleStorage);
  }

  bindEvents() {
    this.addBtn.addEventListener('click', () => {
      this.openModal(null);
    });

    this.editBtn.addEventListener('click', () => {
      this.editMode = !this.editMode;
      this.dockEl.classList.toggle('is-editing', this.editMode);
      this.editBtn.setAttribute('aria-pressed', String(this.editMode));
      this.render();
    });

    this.cancelBtn.addEventListener('click', () => {
      this.closeModal();
    });

    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) {
        this.closeModal();
      }
    });

    this.modalEl.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab' || this.modalEl.hidden) return;
      const focusables = Array.from(
        this.modalForm.querySelectorAll('input:not([disabled]), button:not([disabled])')
      ).filter((el) => !el.closest('[hidden]'));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && (document.activeElement === first || !this.modalForm.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !this.modalForm.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    });

    this.urlInput.addEventListener('input', () => {
      this.urlInput.setCustomValidity('');
    });

    this.resetBtn.addEventListener('click', () => {
      if (!this.confirmResetPending) {
        this.confirmResetPending = true;
        this.resetBtn.textContent = t('stoneConfirmReset');
        this.resetBtn.classList.add('is-confirming');
        clearTimeout(this.confirmResetTimer);
        this.confirmResetTimer = setTimeout(() => {
          this.resetConfirmState();
        }, 4000);
        return;
      }

      this.resetConfirmState();
      try {
        localStorage.removeItem(STONES_STORAGE_KEY);
      } catch (_) {}
      syncRemoveKey(STONES_STORAGE_KEY);
      this.closeModal();
      this.editMode = false;
      this.dockEl.classList.remove('is-editing');
      this.editBtn.setAttribute('aria-pressed', 'false');
      this.loadFromTopSitesOrDefaults();
    });

    this.modalForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const title = this.titleInput.value.trim();
      const url = sanitizeHttpUrl(this.urlInput.value);
      if (!url) {
        this.urlInput.setCustomValidity(t('stoneInvalidUrl'));
        this.urlInput.reportValidity();
        this.urlInput.focus();
        return;
      }
      this.urlInput.setCustomValidity('');

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
          id: createStoneId(),
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
    if (saved !== null) {
      this.stones = saved.slice(0, MAX_STONES);
      this.render();
      return;
    }
    this.loadFromTopSitesOrDefaults();
  }

  loadSavedStones() {
    return loadSavedStones();
  }

  saveStones() {
    this.stones = saveStonesList(this.stones);
  }

  setStones(nextStones) {
    if (!Array.isArray(nextStones)) {
      this.loadFromTopSitesOrDefaults();
      return;
    }
    this.stones = nextStones.slice(0, MAX_STONES);
    this.render();
  }

  moveStone(id, delta, restoreFocusDir = null) {
    const idx = this.stones.findIndex((s) => s.id === id);
    if (idx === -1) return false;
    const nextIdx = idx + delta;
    if (nextIdx < 0 || nextIdx >= this.stones.length) return false;
    const updated = this.stones.slice();
    const [item] = updated.splice(idx, 1);
    updated.splice(nextIdx, 0, item);
    this.stones = updated;
    this.saveStones();
    this.render();

    if (restoreFocusDir) {
      const btn = this.listEl.querySelector(
        `[data-stone-id="${id}"] .stone-mini-${restoreFocusDir}`
      );
      if (btn && !btn.disabled) btn.focus();
    }
    return true;
  }

  reorderStone(fromId, toId) {
    if (!fromId || !toId || fromId === toId) return false;
    const fromIdx = this.stones.findIndex((s) => s.id === fromId);
    const toIdx = this.stones.findIndex((s) => s.id === toId);
    if (fromIdx === -1 || toIdx === -1) return false;
    const updated = this.stones.slice();
    const [item] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, item);
    this.stones = updated;
    this.saveStones();
    this.render();
    return true;
  }

  loadFromTopSitesOrDefaults() {
    if (typeof chrome !== 'undefined' && chrome.topSites && typeof chrome.topSites.get === 'function') {
      try {
        chrome.topSites.get((sites) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            this.stones = getDefaultStones();
            this.render();
            return;
          }
          const valid = Array.isArray(sites)
            ? sites
                .map((s) => {
                  const safeUrl = sanitizeHttpUrl(s && s.url);
                  return safeUrl ? { title: s && s.title, url: safeUrl } : null;
                })
                .filter(Boolean)
                .slice(0, 6)
            : [];

          if (valid.length > 0) {
            this.stones = valid.map((s, idx) => ({
              id: 'top-' + idx,
              title: shortenTitle(s.title, s.url),
              url: s.url
            }));
          } else {
            this.stones = getDefaultStones();
          }
          this.render();
        });
        return;
      } catch (_) {
        // Fall through to defaults
      }
    }

    this.stones = getDefaultStones();
    this.render();
  }

  resetConfirmState() {
    this.confirmResetPending = false;
    clearTimeout(this.confirmResetTimer);
    this.confirmResetTimer = null;
    this.resetBtn.textContent = this.defaultResetLabel;
    this.resetBtn.classList.remove('is-confirming');
  }

  openModal(stone) {
    this.lastTriggerEl = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.editingId = stone ? stone.id : null;
    this.modalTitleEl.textContent = stone ? t('stoneEditModalTitle') : t('stoneNewTitle');
    this.titleInput.value = stone ? stone.title : '';
    this.urlInput.value = stone ? stone.url : '';
    this.urlInput.setCustomValidity('');
    this.resetConfirmState();
    this.modalEl.hidden = false;
    this.onModalToggle(true);
    this.titleInput.focus();
  }

  closeModal() {
    this.resetConfirmState();
    this.urlInput.setCustomValidity('');
    this.modalEl.hidden = true;
    this.editingId = null;
    this.onModalToggle(false);
    if (this.lastTriggerEl && this.lastTriggerEl.isConnected) {
      this.lastTriggerEl.focus();
    }
    this.lastTriggerEl = null;
  }

  deleteStone(id) {
    this.stones = this.stones.filter((s) => s.id !== id);
    this.saveStones();
    this.render();
  }

  render() {
    this.listEl.innerHTML = '';

    this.stones.forEach((stone, index) => {
      const safeUrl = sanitizeHttpUrl(stone.url);
      if (!safeUrl) return;

      const wrapper = document.createElement('div');
      wrapper.className = 'river-stone-wrap';
      wrapper.dataset.stoneId = stone.id;
      wrapper.draggable = this.editMode;

      wrapper.addEventListener('dragstart', (e) => {
        if (!this.editMode) {
          e.preventDefault();
          return;
        }
        this.draggingId = stone.id;
        wrapper.classList.add('is-dragging');
        if (e.dataTransfer) {
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('text/plain', stone.id);
        }
      });

      wrapper.addEventListener('dragover', (e) => {
        if (!this.editMode || !this.draggingId || this.draggingId === stone.id) return;
        e.preventDefault();
        wrapper.classList.add('is-drop-target');
      });

      wrapper.addEventListener('dragleave', () => {
        wrapper.classList.remove('is-drop-target');
      });

      wrapper.addEventListener('drop', (e) => {
        e.preventDefault();
        wrapper.classList.remove('is-drop-target');
        const fromId = (e.dataTransfer && e.dataTransfer.getData('text/plain')) || this.draggingId;
        this.draggingId = null;
        if (fromId && fromId !== stone.id) {
          this.reorderStone(fromId, stone.id);
        }
      });

      wrapper.addEventListener('dragend', () => {
        this.draggingId = null;
        wrapper.classList.remove('is-dragging');
        this.listEl.querySelectorAll('.is-drop-target').forEach((el) => el.classList.remove('is-drop-target'));
      });

      const link = document.createElement('a');
      link.className = 'river-stone';
      link.href = safeUrl;
      link.title = `${stone.title} · ${safeUrl}`;
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

      const host = extractHostname(safeUrl);
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

      const hasNativeFavicon =
        typeof chrome !== 'undefined' && chrome.runtime && typeof chrome.runtime.getURL === 'function';

      if (hasNativeFavicon) {
        const img = document.createElement('img');
        img.className = 'stone-favicon';
        img.alt = '';
        img.width = 20;
        img.height = 20;
        img.decoding = 'async';

        img.addEventListener('error', showInitialFallback);
        img.addEventListener('load', () => {
          if (img.naturalWidth === 0) showInitialFallback();
        });

        img.src = chrome.runtime.getURL('/_favicon/?pageUrl=' + encodeURIComponent(safeUrl) + '&size=64');
        iconBox.appendChild(img);
      } else {
        showInitialFallback();
      }

      const label = document.createElement('span');
      label.className = 'stone-title';
      label.textContent = stone.title;

      link.appendChild(iconBox);
      link.appendChild(label);

      const actions = document.createElement('div');
      actions.className = 'stone-edit-actions';

      const moveLeft = document.createElement('button');
      moveLeft.type = 'button';
      moveLeft.className = 'stone-mini-btn stone-mini-left';
      moveLeft.title = t('stoneMoveLeftTitle');
      moveLeft.setAttribute('aria-label', t('stoneMoveLeftAria', stone.title));
      moveLeft.textContent = '‹';
      moveLeft.disabled = index === 0;
      moveLeft.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.moveStone(stone.id, -1, 'left');
      });

      const moveRight = document.createElement('button');
      moveRight.type = 'button';
      moveRight.className = 'stone-mini-btn stone-mini-right';
      moveRight.title = t('stoneMoveRightTitle');
      moveRight.setAttribute('aria-label', t('stoneMoveRightAria', stone.title));
      moveRight.textContent = '›';
      moveRight.disabled = index === this.stones.length - 1;
      moveRight.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.moveStone(stone.id, 1, 'right');
      });

      const editOne = document.createElement('button');
      editOne.type = 'button';
      editOne.className = 'stone-mini-btn';
      editOne.title = t('stoneEditOneTitle');
      editOne.setAttribute('aria-label', t('stoneEditOneAria', stone.title));
      editOne.textContent = '✎';
      editOne.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.openModal(stone);
      });

      const delOne = document.createElement('button');
      delOne.type = 'button';
      delOne.className = 'stone-mini-btn stone-mini-del';
      delOne.title = t('stoneDeleteOneTitle');
      delOne.setAttribute('aria-label', t('stoneDeleteOneAria', stone.title));
      delOne.textContent = '×';
      delOne.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.deleteStone(stone.id);
      });

      actions.appendChild(moveLeft);
      actions.appendChild(moveRight);
      actions.appendChild(editOne);
      actions.appendChild(delOne);

      wrapper.appendChild(link);
      wrapper.appendChild(actions);
      this.listEl.appendChild(wrapper);
    });

    this.addBtn.disabled = this.stones.length >= MAX_STONES;
    requestAnimationFrame(() => this.onLayoutChange());
  }

  destroy() {
    clearTimeout(this.confirmResetTimer);
    window.removeEventListener('storage', this.handleStorage);
  }
}
