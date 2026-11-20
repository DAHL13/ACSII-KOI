import { getShortLang, t } from '../core/i18n.js';
import { buildBangQueryUrl, mergeBangs, resolveDirectUrl } from './url-utils.js';

export class SmartSearchController {
  constructor(options) {
    this.form = options.form;
    this.input = options.input;
    this.badgeEl = options.badgeEl;
    this.suggestionsEl = options.suggestionsEl || null;
    this.navigate = options.navigate || ((url) => window.location.assign(url));
    this.defaultPlaceholder = this.input.placeholder;
    this.activeBang = null;
    this.bangMap = mergeBangs(options.customBangs || []);
    this.matchingBangs = [];
    this.selectedIdx = -1;

    this.bindEvents();
  }

  setCustomBangs(customList) {
    this.bangMap = mergeBangs(customList || []);
    if (this.activeBang && !this.bangMap[this.activeBang.prefix]) {
      this.clearBang();
    }
    this.updateSuggestions();
  }

  updateSuggestions() {
    if (!this.suggestionsEl) return;
    if (this.activeBang) {
      this.closeSuggestions();
      return;
    }

    const match = this.input.value.match(/^\s*!([a-z0-9_-]*)$/i);
    if (!match) {
      this.closeSuggestions();
      return;
    }

    const fragment = match[1].toLowerCase();
    const list = Object.values(this.bangMap).filter((b) => b.prefix.slice(1).startsWith(fragment));
    if (list.length === 0) {
      this.closeSuggestions();
      return;
    }

    this.matchingBangs = list;
    this.selectedIdx = 0;
    this.renderSuggestions();
  }

  renderSuggestions() {
    if (!this.suggestionsEl) return;
    this.suggestionsEl.innerHTML = '';
    this.matchingBangs.forEach((bang, idx) => {
      const li = document.createElement('li');
      li.id = `bang-opt-${idx}`;
      li.role = 'option';
      li.className = 'bang-suggest-item' + (idx === this.selectedIdx ? ' is-selected' : '');
      li.setAttribute('aria-selected', String(idx === this.selectedIdx));

      const code = document.createElement('code');
      code.textContent = bang.prefix;
      const lbl = document.createElement('span');
      lbl.textContent = bang.label;

      li.appendChild(code);
      li.appendChild(lbl);
      li.addEventListener('mousedown', (e) => {
        e.preventDefault();
        this.applySuggestion(bang);
      });
      this.suggestionsEl.appendChild(li);
    });

    this.suggestionsEl.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
    if (this.selectedIdx >= 0 && this.matchingBangs[this.selectedIdx]) {
      this.input.setAttribute('aria-activedescendant', `bang-opt-${this.selectedIdx}`);
    } else {
      this.input.removeAttribute('aria-activedescendant');
    }
  }

  closeSuggestions() {
    if (!this.suggestionsEl) return;
    this.suggestionsEl.hidden = true;
    this.suggestionsEl.innerHTML = '';
    this.matchingBangs = [];
    this.selectedIdx = -1;
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
  }

  applySuggestion(bang) {
    if (!bang) return;
    this.setBang(bang);
    this.input.value = '';
    this.closeSuggestions();
    this.input.focus();
  }

  bindEvents() {
    this.input.addEventListener('input', () => {
      if (this.activeBang) return;
      const val = this.input.value;
      const match = val.match(/^\s*(![a-z0-9_-]{1,10})\s+(.*)$/i);
      if (match) {
        const bang = this.bangMap[match[1].toLowerCase()];
        if (bang) {
          this.setBang(bang);
          this.input.value = match[2];
          this.closeSuggestions();
          return;
        }
      }
      this.updateSuggestions();
    });

    this.input.addEventListener('keydown', (e) => {
      if (this.suggestionsEl && !this.suggestionsEl.hidden && this.matchingBangs.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          this.selectedIdx = (this.selectedIdx + 1) % this.matchingBangs.length;
          this.renderSuggestions();
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          this.selectedIdx = (this.selectedIdx - 1 + this.matchingBangs.length) % this.matchingBangs.length;
          this.renderSuggestions();
          return;
        }
        if (e.key === 'Tab' || (e.key === 'Enter' && this.selectedIdx >= 0)) {
          e.preventDefault();
          const chosen = this.matchingBangs[Math.max(0, this.selectedIdx)];
          this.applySuggestion(chosen);
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          this.closeSuggestions();
          return;
        }
      }

      if (e.key === 'Backspace' && this.activeBang && this.input.value === '') {
        e.preventDefault();
        this.clearBang();
      }
    });

    this.input.addEventListener('blur', () => {
      this.closeSuggestions();
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
        this.navigate(buildBangQueryUrl(this.activeBang, query, getShortLang()));
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
        this.navigate(directUrl);
        return;
      }

      e.preventDefault();
      const fallbackUrl = 'https://www.google.com/search?q=' + encodeURIComponent(query);
      if (typeof chrome !== 'undefined' && chrome.search && typeof chrome.search.query === 'function') {
        try {
          const maybePromise = chrome.search.query(
            { text: query, disposition: 'CURRENT_TAB' },
            () => {
              if (chrome.runtime && chrome.runtime.lastError) {
                this.navigate(fallbackUrl);
              }
            }
          );
          if (maybePromise && typeof maybePromise.catch === 'function') {
            maybePromise.catch(() => {
              this.navigate(fallbackUrl);
            });
          }
          return;
        } catch (_) {
          // Fall through to Google search fallback
        }
      }
      this.navigate(fallbackUrl);
    });
  }

  setBang(bang) {
    this.activeBang = bang;
    this.badgeEl.textContent = bang.label;
    this.badgeEl.className = `bang-badge ${bang.className || 'bang-custom'}`;
    this.badgeEl.setAttribute('aria-label', t('bangRemoveAria', bang.label));
    this.badgeEl.hidden = false;
    this.input.placeholder = t('searchInLabel', bang.label);
  }

  clearBang() {
    this.activeBang = null;
    this.badgeEl.hidden = true;
    this.badgeEl.textContent = '';
    this.badgeEl.className = 'bang-badge';
    this.badgeEl.removeAttribute('aria-label');
    this.input.placeholder = this.defaultPlaceholder;
  }
}
