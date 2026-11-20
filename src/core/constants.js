export const CELL_W = 8.5;
export const CELL_H = 11.5;

export const DENSITY_CHARS = ['@', '#', '%', '*', '+', ':', '.'];
export const RIPPLE_CHARS = ['*', '+', ':', '~', '·'];

export const PREFS_STORAGE_KEY = 'ascii_koi_zen_prefs_v3';
export const LEGACY_PREFS_STORAGE_KEY = 'ascii_koi_zen_prefs_v2';
export const STONES_STORAGE_KEY = 'ascii_koi_river_stones_v1';
export const POMO_STORAGE_KEY = 'ascii_koi_pomodoro_v1';
export const CUSTOM_BANGS_STORAGE_KEY = 'ascii_koi_custom_bangs_v1';
export const DAILY_FOCUS_STORAGE_KEY = 'ascii_koi_daily_focus_v1';

export const BIOME_KEYS = ['pond', 'ocean', 'reef', 'winter'];
export const ENV_KEYS = ['lilies', 'currents', 'plankton', 'kelp', 'jellyfish', 'school', 'snow'];
export const SPECIES_KEYS = ['koi', 'turtle', 'whaleShark', 'hammerhead', 'mantaRay', 'giantCarp'];

export const DEFAULT_PREFS = {
  fishCount: 12,
  biome: 'pond',
  species: {
    koi: true,
    turtle: false,
    whaleShark: false,
    hammerhead: false,
    mantaRay: false,
    giantCarp: false
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
  snowEnabled: false,
  ecoMode: 'auto',
  clockFormat: '24h',
  userName: '',
  showDailyFocus: true,
  zenMode: false,
  showClock: true,
  showPerf: false,
  stonesVisible: true,
  pomodoroVisible: true,
  pomodoroCollapsed: false
};
