import { DEFAULT_PREFS, LEGACY_PREFS_STORAGE_KEY, PREFS_STORAGE_KEY } from './constants.js';
import { clampInt } from './math.js';

function cloneDefaultPrefs() {
  return {
    ...DEFAULT_PREFS,
    species: { ...DEFAULT_PREFS.species }
  };
}

export function loadPrefs() {
  try {
    const raw =
      localStorage.getItem(PREFS_STORAGE_KEY) || localStorage.getItem(LEGACY_PREFS_STORAGE_KEY);
    if (!raw) return cloneDefaultPrefs();

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return cloneDefaultPrefs();
    }

    const parsedSp =
      parsed.species && typeof parsed.species === 'object' && !Array.isArray(parsed.species)
        ? parsed.species
        : {};

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
      liliesEnabled:
        parsed.liliesEnabled !== undefined ? Boolean(parsed.liliesEnabled) : DEFAULT_PREFS.liliesEnabled,
      currentsEnabled: Boolean(parsed.currentsEnabled),
      planktonEnabled: Boolean(parsed.planktonEnabled),
      kelpEnabled: Boolean(parsed.kelpEnabled),
      jellyfishEnabled: Boolean(parsed.jellyfishEnabled),
      schoolEnabled: Boolean(parsed.schoolEnabled),
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
  } catch (_) {
    return cloneDefaultPrefs();
  }
}

export function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch (_) {
    // Ignore storage errors
  }
}

export function subscribePrefsChanges(callback) {
  const onStorage = (e) => {
    if (e && e.key !== null && e.key !== PREFS_STORAGE_KEY) return;
    callback(loadPrefs());
  };
  window.addEventListener('storage', onStorage);
  return () => window.removeEventListener('storage', onStorage);
}
