import { getShortLang, t } from '../core/i18n.js';
import { BANGS, getBangSearchUrl, resolveDirectUrl } from './url-utils.js';

export class SmartSearchController {
  constructor(options) {
    this.form = options.form;
    this.input = options.input;
    this.badgeEl = options.badgeEl;
    this.navigate = options.navigate || ((url) => window.location.assign(url));
    this.defaultPlaceholder = this.input.placeholder;
    this.activeBang = null;

    this.bindEvents();
  }

  bindEvents() {
    this.input.addEventListener('input', () => {
      if (this.activeBang) return;
      const val = this.input.value;
      const match = val.match(/^\s*(!(?:gh|yt|r|mdn|so|w))\s+(.*)$/i);
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
        const bangBaseUrl = getBangSearchUrl(this.activeBang, getShortLang());
        this.navigate(bangBaseUrl + encodeURIComponent(query));
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
    this.badgeEl.className = `bang-badge ${bang.className}`;
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
