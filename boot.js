(function () {
  'use strict';

  try {
    const raw =
      localStorage.getItem('ascii_koi_zen_prefs_v3') ||
      localStorage.getItem('ascii_koi_zen_prefs_v2');
    const parsed = raw ? JSON.parse(raw) : null;
    const prefs = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};

    let phase = prefs.timeMode;
    if (phase !== 'day' && phase !== 'sunset' && phase !== 'night') {
      const now = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();
      if (mins >= 420 && mins < 1080) phase = 'day';
      else if (mins >= 1080 && mins < 1230) phase = 'sunset';
      else phase = 'night';
    }

    const validBiomes = { pond: true, ocean: true, reef: true, winter: true, space: true, aurora: true, wave: true };
    const validSpacePalettes = { gold: true, quasar: true, violet: true };
    const root = document.documentElement;
    root.setAttribute('data-solar', phase);
    root.setAttribute('data-biome', validBiomes[prefs.biome] ? prefs.biome : 'pond');
    root.setAttribute(
      'data-space-palette',
      validSpacePalettes[prefs.spacePalette] ? prefs.spacePalette : 'gold'
    );
    if (prefs.zenMode) {
      root.setAttribute('data-zen', 'true');
    }
  } catch (_) {}
})();
