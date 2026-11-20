import { MAX_CUSTOM_BANGS, sanitizeCustomBang } from '../productivity/url-utils.js';
import { t } from '../core/i18n.js';
import {
  exportAllConfig,
  importAllConfig,
  loadCustomBangs,
  saveCustomBangs
} from '../core/storage.js';

export function createSettingsModalController(options) {
  const {
    modalEl,
    cardEl,
    triggerBtn,
    closeBtn,
    usernameInput,
    clockFormatButtons,
    showFocusCheckbox,
    ecoModeButtons,
    bangListEl,
    bangFormEl,
    bangPrefixInput,
    bangNameInput,
    bangUrlInput,
    bangErrorEl,
    exportBtn,
    importBtn,
    importInput,
    backupStatusEl,
    getPrefs,
    onPrefsPatch,
    onCustomBangsChange,
    onImportedConfig,
    onModalToggle
  } = options;

  let customBangs = loadCustomBangs();
  let lastTriggerEl = null;

  function renderCustomBangs() {
    bangListEl.innerHTML = '';
    if (customBangs.length === 0) {
      const empty = document.createElement('li');
      empty.className = 'settings-bang-empty';
      empty.textContent = t('bangEmptyList');
      bangListEl.appendChild(empty);
      return;
    }

    customBangs.forEach((b) => {
      const li = document.createElement('li');
      li.className = 'settings-bang-item';

      const code = document.createElement('code');
      code.textContent = b.prefix;

      const label = document.createElement('span');
      label.className = 'settings-bang-name';
      label.textContent = b.label;

      const url = document.createElement('span');
      url.className = 'settings-bang-url';
      url.textContent = b.url;

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'settings-bang-del';
      del.textContent = '×';
      del.setAttribute('aria-label', t('bangDeleteAria', b.prefix));
      del.addEventListener('click', () => {
        customBangs = saveCustomBangs(customBangs.filter((x) => x.prefix !== b.prefix));
        renderCustomBangs();
        if (onCustomBangsChange) onCustomBangsChange(customBangs);
      });

      li.appendChild(code);
      li.appendChild(label);
      li.appendChild(url);
      li.appendChild(del);
      bangListEl.appendChild(li);
    });
  }

  function syncFromPrefs() {
    const prefs = getPrefs();
    if (usernameInput && document.activeElement !== usernameInput) {
      usernameInput.value = prefs.userName || '';
    }
    clockFormatButtons.forEach((btn) => {
      const active = btn.dataset.clockFormat === (prefs.clockFormat === '12h' ? '12h' : '24h');
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    if (showFocusCheckbox) {
      showFocusCheckbox.checked = prefs.showDailyFocus !== false;
    }
    ecoModeButtons.forEach((btn) => {
      const active = btn.dataset.ecoMode === prefs.ecoMode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  function openModal() {
    lastTriggerEl = document.activeElement instanceof HTMLElement ? document.activeElement : triggerBtn;
    syncFromPrefs();
    renderCustomBangs();
    if (bangErrorEl) bangErrorEl.textContent = '';
    if (backupStatusEl) backupStatusEl.textContent = '';
    modalEl.hidden = false;
    onModalToggle(true);
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    if (modalEl.hidden) return;
    modalEl.hidden = true;
    onModalToggle(false);
    if (lastTriggerEl && lastTriggerEl.isConnected) {
      lastTriggerEl.focus();
    }
    lastTriggerEl = null;
  }

  function handleImportJsonText(rawText) {
    const res = importAllConfig(rawText);
    if (!res.ok) {
      if (backupStatusEl) {
        backupStatusEl.textContent = t('backupImportErr');
        backupStatusEl.dataset.state = 'error';
      }
      return res;
    }
    if (res.data.customBangs) {
      customBangs = res.data.customBangs;
      renderCustomBangs();
    }
    syncFromPrefs();
    if (backupStatusEl) {
      backupStatusEl.textContent = t('backupImportOk');
      backupStatusEl.dataset.state = 'ok';
    }
    if (onImportedConfig) onImportedConfig(res.data);
    return res;
  }

  triggerBtn.addEventListener('click', openModal);
  closeBtn.addEventListener('click', closeModal);

  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) closeModal();
  });

  modalEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab' || modalEl.hidden) return;
    const focusables = Array.from(
      cardEl.querySelectorAll('input:not([disabled]):not([hidden]), button:not([disabled])')
    ).filter((el) => !el.closest('[hidden]') && el.type !== 'file');
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && (document.activeElement === first || !cardEl.contains(document.activeElement))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (document.activeElement === last || !cardEl.contains(document.activeElement))) {
      e.preventDefault();
      first.focus();
    }
  });

  if (usernameInput) {
    usernameInput.addEventListener('input', () => {
      onPrefsPatch({ userName: usernameInput.value.trim().slice(0, 32) });
    });
  }

  clockFormatButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      onPrefsPatch({ clockFormat: btn.dataset.clockFormat === '12h' ? '12h' : '24h' });
      syncFromPrefs();
    });
  });

  if (showFocusCheckbox) {
    showFocusCheckbox.addEventListener('change', () => {
      onPrefsPatch({ showDailyFocus: Boolean(showFocusCheckbox.checked) });
    });
  }

  ecoModeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.ecoMode;
      if (['auto', 'on', 'off'].includes(mode)) {
        onPrefsPatch({ ecoMode: mode });
        syncFromPrefs();
      }
    });
  });

  if (bangFormEl) {
    bangFormEl.addEventListener('submit', (e) => {
      e.preventDefault();
      const sanitized = sanitizeCustomBang({
        prefix: bangPrefixInput.value,
        label: bangNameInput.value,
        url: bangUrlInput.value
      });
      const duplicate = sanitized && customBangs.some((b) => b.prefix === sanitized.prefix);
      if (!sanitized || duplicate || customBangs.length >= MAX_CUSTOM_BANGS) {
        if (bangErrorEl) bangErrorEl.textContent = t('bangInvalidError');
        return;
      }
      if (bangErrorEl) bangErrorEl.textContent = '';
      customBangs = saveCustomBangs([...customBangs, sanitized]);
      bangPrefixInput.value = '';
      bangNameInput.value = '';
      bangUrlInput.value = '';
      renderCustomBangs();
      if (onCustomBangsChange) onCustomBangsChange(customBangs);
    });
  }

  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      try {
        const json = JSON.stringify(exportAllConfig(), null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'ascii-koi-backup.json';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 500);
        if (backupStatusEl) {
          backupStatusEl.textContent = t('backupExportOk');
          backupStatusEl.dataset.state = 'ok';
        }
      } catch (_) {}
    });
  }

  if (importBtn && importInput) {
    importBtn.addEventListener('click', () => {
      importInput.value = '';
      importInput.click();
    });
    importInput.addEventListener('change', async () => {
      const file = importInput.files && importInput.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        handleImportJsonText(text);
      } catch (_) {
        if (backupStatusEl) {
          backupStatusEl.textContent = t('backupImportErr');
          backupStatusEl.dataset.state = 'error';
        }
      }
    });
  }

  return {
    openModal,
    closeModal,
    syncFromPrefs,
    setCustomBangs(list) {
      customBangs = Array.isArray(list) ? list : [];
      renderCustomBangs();
    },
    getCustomBangs: () => customBangs,
    handleImportJsonText
  };
}
