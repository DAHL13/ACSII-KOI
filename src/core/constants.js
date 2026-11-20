export const CELL_W = 8.5;
export const CELL_H = 11.5;

export const DENSITY_CHARS = ['@', '#', '%', '*', '+', ':', '.'];
export const RIPPLE_CHARS = ['*', '+', ':', '~', '·'];

export const PREFS_STORAGE_KEY = 'ascii_koi_zen_prefs_v3';
export const LEGACY_PREFS_STORAGE_KEY = 'ascii_koi_zen_prefs_v2';
export const STONES_STORAGE_KEY = 'ascii_koi_river_stones_v1';
export const POMO_STORAGE_KEY = 'ascii_koi_pomodoro_v1';

export const ENV_KEYS = ['lilies', 'currents', 'plankton', 'kelp', 'jellyfish', 'school'];
export const SPECIES_KEYS = ['koi', 'turtle', 'whaleShark', 'hammerhead'];

export const DEFAULT_PREFS = {
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
