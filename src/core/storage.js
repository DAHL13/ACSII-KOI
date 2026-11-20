import {
  BIOME_KEYS,
  CUSTOM_BANGS_STORAGE_KEY,
  DAILY_FOCUS_STORAGE_KEY,
  DEFAULT_PREFS,
  LEGACY_PREFS_STORAGE_KEY,
  PREFS_STORAGE_KEY,
  SPECIES_KEYS,
  STONES_STORAGE_KEY
} from './constants.js';
import { clampInt } from './math.js';
import {
  MAX_CUSTOM_BANGS,
  createStoneId,
  sanitizeCustomBang,
  sanitizeHttpUrl,
  shortenTitle
} from '../productivity/url-utils.js';

const MAX_STONES = 8;
const MAX_USERNAME_LEN = 32;
const MAX_DAILY_FOCUS_LEN = 120;

function cloneDefaultPrefs() {
  return {
    ...DEFAULT_PREFS,
    species: { ...DEFAULT_PREFS.species }
  };
}

function getSyncArea() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
    return chrome.storage.sync;
  }
  return null;
}

export function syncPushKey(key, value) {
  const sync = getSyncArea();
  if (!sync || typeof sync.set !== 'function') return;
  try {
    const maybePromise = sync.set({ [key]: value }, () => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
        // Ignore quota or transient sync errors
      }
    });
    if (maybePromise && typeof maybePromise.catch === 'function') {
      maybePromise.catch(() => {});
    }
  } catch (_) {}
}

export function syncRemoveKey(key) {
  const sync = getSyncArea();
  if (!sync || typeof sync.remove !== 'function') return;
  try {
    const maybePromise = sync.remove(key, () => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) {
        // Ignore transient sync errors
      }
    });
    if (maybePromise && typeof maybePromise.catch === 'function') {
      maybePromise.catch(() => {});
    }
  } catch (_) {}
}

export function normalizePrefs(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return cloneDefaultPrefs();
  }

  const parsedSp =
    parsed.species && typeof parsed.species === 'object' && !Array.isArray(parsed.species)
      ? parsed.species
      : {};

  const species = {};
  for (let i = 0; i < SPECIES_KEYS.length; i++) {
    const k = SPECIES_KEYS[i];
    species[k] = parsedSp[k] !== undefined ? Boolean(parsedSp[k]) : Boolean(DEFAULT_PREFS.species[k]);
  }

  return {
    fishCount: clampInt(parsed.fishCount, 5, 25, DEFAULT_PREFS.fishCount),
    biome: BIOME_KEYS.includes(parsed.biome) ? parsed.biome : DEFAULT_PREFS.biome,
    species,
    firefliesMode: ['auto', 'on', 'off'].includes(parsed.firefliesMode)
      ? parsed.firefliesMode
      : DEFAULT_PREFS.firefliesMode,
    timeMode: ['auto', 'day', 'sunset', 'night'].includes(parsed.timeMode)
      ? parsed.timeMode
      : DEFAULT_PREFS.timeMode,
    rainEnabled: Boolean(parsed.rainEnabled),
    liliesEnabled:
      parsed.liliesEnabled !== undefined ? Boolean(parsed.liliesEnabled) : DEFAULT_PREFS.liliesEnabled,
    currentsEnabled: Boolean(parsed.currentsEnabled),
    planktonEnabled: Boolean(parsed.planktonEnabled),
    kelpEnabled: Boolean(parsed.kelpEnabled),
    jellyfishEnabled: Boolean(parsed.jellyfishEnabled),
    schoolEnabled: Boolean(parsed.schoolEnabled),
    snowEnabled: Boolean(parsed.snowEnabled),
    ecoMode: ['auto', 'on', 'off'].includes(parsed.ecoMode) ? parsed.ecoMode : DEFAULT_PREFS.ecoMode,
    clockFormat: parsed.clockFormat === '12h' ? '12h' : '24h',
    userName:
      typeof parsed.userName === 'string' ? parsed.userName.trim().slice(0, MAX_USERNAME_LEN) : '',
    showDailyFocus:
      parsed.showDailyFocus !== undefined
        ? Boolean(parsed.showDailyFocus)
        : DEFAULT_PREFS.showDailyFocus,
    zenMode: Boolean(parsed.zenMode),
    showClock: parsed.showClock !== undefined ? Boolean(parsed.showClock) : DEFAULT_PREFS.showClock,
    showPerf: Boolean(parsed.showPerf),
    stonesVisible:
      parsed.stonesVisible !== undefined ? Boolean(parsed.stonesVisible) : DEFAULT_PREFS.stonesVisible,
    pomodoroVisible:
      parsed.pomodoroVisible !== undefined
        ? Boolean(parsed.pomodoroVisible)
        : DEFAULT_PREFS.pomodoroVisible,
    pomodoroCollapsed: Boolean(parsed.pomodoroCollapsed)
  };
}

export function loadPrefs() {
  try {
    const raw =
      localStorage.getItem(PREFS_STORAGE_KEY) || localStorage.getItem(LEGACY_PREFS_STORAGE_KEY);
    if (!raw) return cloneDefaultPrefs();
    return normalizePrefs(JSON.parse(raw));
  } catch (_) {
    return cloneDefaultPrefs();
  }
}

export function savePrefs(prefs) {
  const clean = normalizePrefs(prefs);
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(clean));
  } catch (_) {}
  syncPushKey(PREFS_STORAGE_KEY, clean);
}

export function loadDailyFocus() {
  try {
    const raw = localStorage.getItem(DAILY_FOCUS_STORAGE_KEY);
    return typeof raw === 'string' ? raw.slice(0, MAX_DAILY_FOCUS_LEN) : '';
  } catch (_) {
    return '';
  }
}

export function saveDailyFocus(text) {
  const clean = typeof text === 'string' ? text.trim().slice(0, MAX_DAILY_FOCUS_LEN) : '';
  try {
    localStorage.setItem(DAILY_FOCUS_STORAGE_KEY, clean);
  } catch (_) {}
  syncPushKey(DAILY_FOCUS_STORAGE_KEY, clean);
  return clean;
}

function sanitizeCustomBangArray(rawList) {
  if (!Array.isArray(rawList)) return [];
  const seen = new Set();
  const out = [];
  for (let i = 0; i < rawList.length && out.length < MAX_CUSTOM_BANGS; i++) {
    const clean = sanitizeCustomBang(rawList[i]);
    if (!clean || seen.has(clean.prefix)) continue;
    seen.add(clean.prefix);
    out.push(clean);
  }
  return out;
}

export function loadCustomBangs() {
  try {
    const raw = localStorage.getItem(CUSTOM_BANGS_STORAGE_KEY);
    if (!raw) return [];
    return sanitizeCustomBangArray(JSON.parse(raw));
  } catch (_) {
    return [];
  }
}

export function saveCustomBangs(list) {
  const clean = sanitizeCustomBangArray(list);
  try {
    localStorage.setItem(CUSTOM_BANGS_STORAGE_KEY, JSON.stringify(clean));
  } catch (_) {}
  syncPushKey(CUSTOM_BANGS_STORAGE_KEY, clean);
  return clean;
}

function sanitizeStoneArray(rawList) {
  if (!Array.isArray(rawList)) return null;
  const seenIds = new Set();
  const sanitized = [];
  for (let i = 0; i < rawList.length && sanitized.length < MAX_STONES; i++) {
    const item = rawList[i];
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const safeUrl = sanitizeHttpUrl(item.url);
    if (!safeUrl) continue;

    let id = typeof item.id === 'string' && item.id.trim() ? item.id.trim() : createStoneId();
    if (seenIds.has(id)) id = createStoneId();
    seenIds.add(id);

    const rawTitle = typeof item.title === 'string' ? item.title : '';
    sanitized.push({
      id,
      title: shortenTitle(rawTitle, safeUrl),
      url: safeUrl
    });
  }
  return sanitized;
}

export function syncPullAll(handlers = {}) {
  const sync = getSyncArea();
  if (!sync || typeof sync.get !== 'function') return;

  const keys = [
    PREFS_STORAGE_KEY,
    STONES_STORAGE_KEY,
    CUSTOM_BANGS_STORAGE_KEY,
    DAILY_FOCUS_STORAGE_KEY
  ];

  const handleItems = (items) => {
    if (!items || typeof items !== 'object') return;
    if (items[PREFS_STORAGE_KEY] !== undefined) {
      const nextPrefs = normalizePrefs(items[PREFS_STORAGE_KEY]);
      try {
        localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(nextPrefs));
      } catch (_) {}
      if (handlers.onPrefs) handlers.onPrefs(nextPrefs);
    }
    if (items[STONES_STORAGE_KEY] !== undefined) {
      const nextStones = sanitizeStoneArray(items[STONES_STORAGE_KEY]);
      if (nextStones !== null) {
        try {
          localStorage.setItem(STONES_STORAGE_KEY, JSON.stringify(nextStones));
        } catch (_) {}
        if (handlers.onStones) handlers.onStones(nextStones);
      }
    }
    if (items[CUSTOM_BANGS_STORAGE_KEY] !== undefined) {
      const nextBangs = sanitizeCustomBangArray(items[CUSTOM_BANGS_STORAGE_KEY]);
      try {
        localStorage.setItem(CUSTOM_BANGS_STORAGE_KEY, JSON.stringify(nextBangs));
      } catch (_) {}
      if (handlers.onCustomBangs) handlers.onCustomBangs(nextBangs);
    }
    if (items[DAILY_FOCUS_STORAGE_KEY] !== undefined) {
      const nextFocus =
        typeof items[DAILY_FOCUS_STORAGE_KEY] === 'string'
          ? items[DAILY_FOCUS_STORAGE_KEY].trim().slice(0, MAX_DAILY_FOCUS_LEN)
          : '';
      try {
        localStorage.setItem(DAILY_FOCUS_STORAGE_KEY, nextFocus);
      } catch (_) {}
      if (handlers.onDailyFocus) handlers.onDailyFocus(nextFocus);
    }
  };

  try {
    const maybePromise = sync.get(keys, (items) => {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.lastError) return;
      handleItems(items);
    });
    if (maybePromise && typeof maybePromise.then === 'function') {
      maybePromise.then(handleItems).catch(() => {});
    }
  } catch (_) {}
}

export function subscribeSyncChanges(handlers = {}) {
  const onWindowStorage = (e) => {
    const key = e ? e.key : null;
    if (key === null || key === PREFS_STORAGE_KEY) {
      if (handlers.onPrefs) handlers.onPrefs(loadPrefs());
    }
    if (key === null || key === CUSTOM_BANGS_STORAGE_KEY) {
      if (handlers.onCustomBangs) handlers.onCustomBangs(loadCustomBangs());
    }
    if (key === null || key === DAILY_FOCUS_STORAGE_KEY) {
      if (handlers.onDailyFocus) handlers.onDailyFocus(loadDailyFocus());
    }
    if (key === null || key === STONES_STORAGE_KEY) {
      if (handlers.onStones) {
        try {
          const raw = localStorage.getItem(STONES_STORAGE_KEY);
          const clean = raw ? sanitizeStoneArray(JSON.parse(raw)) : null;
          handlers.onStones(clean);
        } catch (_) {}
      }
    }
  };

  window.addEventListener('storage', onWindowStorage);

  let onChromeSyncChange = null;
  if (
    typeof chrome !== 'undefined' &&
    chrome.storage &&
    chrome.storage.onChanged &&
    typeof chrome.storage.onChanged.addListener === 'function'
  ) {
    onChromeSyncChange = (changes, areaName) => {
      if (areaName !== 'sync' || !changes) return;
      if (changes[PREFS_STORAGE_KEY] && changes[PREFS_STORAGE_KEY].newValue !== undefined) {
        const clean = normalizePrefs(changes[PREFS_STORAGE_KEY].newValue);
        try {
          localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(clean));
        } catch (_) {}
        if (handlers.onPrefs) handlers.onPrefs(clean);
      }
      if (changes[STONES_STORAGE_KEY]) {
        const nextVal = changes[STONES_STORAGE_KEY].newValue;
        const clean = nextVal === undefined ? null : sanitizeStoneArray(nextVal);
        try {
          if (clean === null) localStorage.removeItem(STONES_STORAGE_KEY);
          else localStorage.setItem(STONES_STORAGE_KEY, JSON.stringify(clean));
        } catch (_) {}
        if (handlers.onStones) handlers.onStones(clean);
      }
      if (changes[CUSTOM_BANGS_STORAGE_KEY] && changes[CUSTOM_BANGS_STORAGE_KEY].newValue !== undefined) {
        const clean = sanitizeCustomBangArray(changes[CUSTOM_BANGS_STORAGE_KEY].newValue);
        try {
          localStorage.setItem(CUSTOM_BANGS_STORAGE_KEY, JSON.stringify(clean));
        } catch (_) {}
        if (handlers.onCustomBangs) handlers.onCustomBangs(clean);
      }
      if (changes[DAILY_FOCUS_STORAGE_KEY] && changes[DAILY_FOCUS_STORAGE_KEY].newValue !== undefined) {
        const nextFocus =
          typeof changes[DAILY_FOCUS_STORAGE_KEY].newValue === 'string'
            ? changes[DAILY_FOCUS_STORAGE_KEY].newValue.trim().slice(0, MAX_DAILY_FOCUS_LEN)
            : '';
        try {
          localStorage.setItem(DAILY_FOCUS_STORAGE_KEY, nextFocus);
        } catch (_) {}
        if (handlers.onDailyFocus) handlers.onDailyFocus(nextFocus);
      }
    };
    chrome.storage.onChanged.addListener(onChromeSyncChange);
  }

  return () => {
    window.removeEventListener('storage', onWindowStorage);
    if (
      onChromeSyncChange &&
      typeof chrome !== 'undefined' &&
      chrome.storage &&
      chrome.storage.onChanged &&
      typeof chrome.storage.onChanged.removeListener === 'function'
    ) {
      chrome.storage.onChanged.removeListener(onChromeSyncChange);
    }
  };
}

export function subscribePrefsChanges(callback) {
  return subscribeSyncChanges({ onPrefs: callback });
}

export function exportAllConfig() {
  let stones = null;
  try {
    const rawStones = localStorage.getItem(STONES_STORAGE_KEY);
    if (rawStones !== null) {
      stones = sanitizeStoneArray(JSON.parse(rawStones));
    }
  } catch (_) {
    stones = null;
  }

  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    prefs: loadPrefs(),
    stones,
    customBangs: loadCustomBangs(),
    dailyFocus: loadDailyFocus()
  };
}

export function importAllConfig(rawJsonText) {
  try {
    const parsed = typeof rawJsonText === 'string' ? JSON.parse(rawJsonText) : rawJsonText;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, error: 'invalid_root' };
    }
    if (parsed.schemaVersion !== undefined && parsed.schemaVersion !== 1) {
      return { ok: false, error: 'unsupported_version' };
    }

    const hasKnownField =
      parsed.prefs !== undefined ||
      parsed.stones !== undefined ||
      parsed.customBangs !== undefined ||
      parsed.dailyFocus !== undefined;
    if (!hasKnownField) {
      return { ok: false, error: 'empty_backup' };
    }

    const result = {};
    if (parsed.prefs && typeof parsed.prefs === 'object' && !Array.isArray(parsed.prefs)) {
      result.prefs = normalizePrefs(parsed.prefs);
      savePrefs(result.prefs);
    }
    if (Array.isArray(parsed.stones)) {
      result.stones = sanitizeStoneArray(parsed.stones) || [];
      try {
        localStorage.setItem(STONES_STORAGE_KEY, JSON.stringify(result.stones));
      } catch (_) {}
      syncPushKey(STONES_STORAGE_KEY, result.stones);
    }
    if (Array.isArray(parsed.customBangs)) {
      result.customBangs = saveCustomBangs(parsed.customBangs);
    }
    if (typeof parsed.dailyFocus === 'string') {
      result.dailyFocus = saveDailyFocus(parsed.dailyFocus);
    }

    return { ok: true, data: result };
  } catch (_) {
    return { ok: false, error: 'invalid_json' };
  }
}
