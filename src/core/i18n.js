const FALLBACK_MESSAGES = {
  es: {
    pageTitlePond: 'Nueva pestaña · Estanque Koi',
    pageTitleOcean: 'Nueva pestaña · Mar Abierto',
    perfPlaceholder: '-- FPS · -- ms',
    controlsAria: 'Controles del estanque',
    fishTitle: 'Cantidad de fauna en el estanque',
    faunaBtnTitle: 'Elegir especies y luciérnagas',
    fishSliderAria: 'Densidad de fauna',
    solarGroupAria: 'Momento del día',
    solarAuto: 'Auto',
    solarAutoTitle: 'Ciclo solar automático',
    solarDay: 'Día',
    solarDayTitle: 'Día (07:00 - 17:59)',
    solarSunset: 'Tarde',
    solarSunsetTitle: 'Atardecer (18:00 - 20:29)',
    solarNight: 'Noche',
    solarNightTitle: 'Noche (20:30 - 06:59)',
    biomeGroupAria: 'Hábitat acuático',
    biomePond: 'Estanque',
    biomePondTitle: 'Estanque zen con nenúfares',
    biomeOcean: 'Mar',
    biomeOceanTitle: 'Mar abierto con corrientes, cardumen, medusas y algas',
    rainBtn: 'Lluvia',
    rainBtnTitle: 'Activar o desactivar lluvia suave',
    feedBtn: 'Alimentar',
    feedBtnTitle: 'Soltar comida múltiple en el estanque',
    stonesToggleTitle: 'Mostrar u ocultar piedras de río',
    pomoToggleTitle: 'Mostrar u ocultar Pomodoro',
    clockToggleTitle: 'Mostrar u ocultar reloj',
    perfToggleTitle: 'Mostrar u ocultar FPS y tiempo de render',
    perfToggleAria: 'Indicador de rendimiento',
    zenBtnTitle: 'Modo Zen (Z)',
    zenBtnAria: 'Activar Modo Zen',
    faunaPopoverAria: 'Selector de especies del estanque',
    faunaPopoverTitle: 'Habitantes del estanque',
    presetKoi: 'Solo Koi',
    presetOcean: 'Océano',
    presetAll: 'Todos',
    speciesKoiName: 'Peces Koi',
    speciesKoiDesc: 'Clásicos, Tancho y Fantasma',
    speciesTurtleName: 'Tortugas Marinas',
    speciesTurtleDesc: 'Caparazón dorado y aleteo lento',
    speciesWhaleName: 'Tiburón Ballena',
    speciesWhaleDesc: 'Gigante moteado y sereno',
    speciesHammerName: 'Tiburón Martillo',
    speciesHammerDesc: 'Nado ágil con cefalofoil en T',
    envSectionTitle: 'Entorno y vida marina',
    envLilies: 'Nenúfares',
    envCurrents: 'Corrientes',
    envPlankton: 'Plancton y Burbujas',
    envKelp: 'Algas',
    envJellyfish: 'Medusas',
    envSchool: 'Cardumen',
    firefliesLabel: 'Luciérnagas',
    firefliesGroupAria: 'Modo de luciérnagas',
    firefliesAuto: 'Auto',
    firefliesAutoTitle: 'Solo durante la noche',
    firefliesOn: 'Activas',
    firefliesOnTitle: 'Visibles a cualquier hora',
    firefliesOff: 'Off',
    firefliesOffTitle: 'Ocultas',
    heroAria: 'Saludo y búsqueda',
    searchAria: 'Buscar en la web o mediante prefijos',
    searchPlaceholder: 'Buscar en la web, URL o !gh !yt !r !mdn !so !w...',
    searchInLabel: 'Buscar en $1...',
    searchSubmitAria: 'Buscar',
    bangBadgeTitle: 'Clic o Backspace para quitar prefijo',
    bangRemoveAria: 'Quitar prefijo $1',
    pondHintPrefix: 'Clic en el agua para alimentar · Prefijos:',
    dockAria: 'Accesos directos en piedras de río',
    stoneAddTitle: 'Añadir piedra de río',
    stoneAddAria: 'Añadir acceso directo',
    stoneEditTitle: 'Editar o eliminar piedras',
    stoneEditAria: 'Editar accesos directos',
    stoneNewTitle: 'Nueva piedra de río',
    stoneEditModalTitle: 'Editar piedra de río',
    stoneEditOneTitle: 'Editar enlace',
    stoneDeleteOneTitle: 'Eliminar enlace',
    stoneEditOneAria: 'Editar $1',
    stoneDeleteOneAria: 'Eliminar $1',
    stoneFieldName: 'Nombre corto',
    stoneNamePlaceholder: 'Ej. GitHub',
    stoneFieldUrl: 'URL del sitio',
    stoneUrlPlaceholder: 'Ej. github.com',
    stoneInvalidUrl: 'Introduce una URL válida http:// o https:// (ej. github.com o localhost:3000).',
    stoneResetAll: 'Restaurar todas',
    stoneResetAllTitle: 'Restaurar todos los accesos directos predeterminados',
    stoneConfirmReset: '¿Confirmar?',
    stoneCancel: 'Cancelar',
    stoneSave: 'Guardar',
    stoneDefaultSite: 'Sitio',
    pomoAria: 'Temporizador Pomodoro',
    pomoTitle: 'Pomodoro Zen',
    pomoCollapseTitle: 'Colapsar o expandir Pomodoro',
    pomoCollapseAria: 'Colapsar Pomodoro',
    pomoModeGroupAria: 'Modo Pomodoro',
    pomoFocusMode: 'Enfoque 25m',
    pomoBreakMode: 'Descanso 5m',
    pomoStatusFocusIdle: 'Enfoque zen',
    pomoStatusBreakIdle: 'Descanso breve',
    pomoStatusFocusRun: 'Enfoque activo',
    pomoStatusBreakRun: 'Descansando',
    pomoStatusPaused: 'En pausa',
    pomoStatusComplete: '¡Sesión completada! 🌸',
    pomoStatusReady: 'Listo para enfocar',
    pomoStatusSakura: 'Pétalos de cerezo 🌸',
    pomoStart: 'Iniciar',
    pomoPause: 'Pausar',
    pomoStartAria: 'Iniciar Pomodoro',
    pomoPauseAria: 'Pausar Pomodoro',
    pomoResetTitle: 'Reiniciar',
    pomoResetAria: 'Reiniciar Pomodoro',
    pomoTestTitle: 'Previsualizar lluvia de pétalos de cerezo',
    pomoTestAria: 'Probar lluvia de cerezo',
    pomoDocFocus: 'Enfoque',
    pomoDocBreak: 'Descanso',
    zenExitTitle: 'Salir del Modo Zen (Esc / Z)',
    zenExitAria: 'Salir del Modo Zen',
    zenExitText: 'Salir de Zen',
    zenToastPrefix: 'Modo Zen · Pulsa',
    zenToastSuffix: 'o mueve el cursor arriba a la derecha para volver',
    greetingMorning: 'Buenos días',
    greetingAfternoon: 'Buenas tardes',
    greetingEvening: 'Buenas noches',
    speciesKoiShort: 'Koi',
    speciesTurtleShort: 'Tortugas',
    speciesWhaleShort: 'T. Ballena',
    speciesHammerShort: 'T. Martillo',
    faunaMulti: 'Fauna ($1)',
    faunaZero: 'Fauna (0)',
    sliderValuetextNone: 'Densidad $1, 0 criaturas activas (sin especies seleccionadas)',
    sliderValuetextActive: 'Densidad $1 ($2 criaturas activas)',
    sliderTitleNone: 'Sin especies activas',
    sliderTitleActive: '$1 criaturas activas (densidad $2)'
  },
  en: {
    pageTitlePond: 'New Tab · Koi Pond',
    pageTitleOcean: 'New Tab · Open Ocean',
    perfPlaceholder: '-- FPS · -- ms',
    controlsAria: 'Pond controls',
    fishTitle: 'Fauna density in the pond',
    faunaBtnTitle: 'Choose species and fireflies',
    fishSliderAria: 'Fauna density',
    solarGroupAria: 'Time of day',
    solarAuto: 'Auto',
    solarAutoTitle: 'Automatic solar cycle',
    solarDay: 'Day',
    solarDayTitle: 'Day (07:00 - 17:59)',
    solarSunset: 'Sunset',
    solarSunsetTitle: 'Sunset (18:00 - 20:29)',
    solarNight: 'Night',
    solarNightTitle: 'Night (20:30 - 06:59)',
    biomeGroupAria: 'Aquatic habitat',
    biomePond: 'Pond',
    biomePondTitle: 'Zen pond with lily pads',
    biomeOcean: 'Ocean',
    biomeOceanTitle: 'Open ocean with currents, baitfish, jellyfish, and kelp',
    rainBtn: 'Rain',
    rainBtnTitle: 'Toggle soft rain',
    feedBtn: 'Feed',
    feedBtnTitle: 'Drop multiple food pellets',
    stonesToggleTitle: 'Show or hide river stones',
    pomoToggleTitle: 'Show or hide Pomodoro',
    clockToggleTitle: 'Show or hide clock',
    perfToggleTitle: 'Show or hide FPS and frame render time',
    perfToggleAria: 'Performance indicator',
    zenBtnTitle: 'Zen Mode (Z)',
    zenBtnAria: 'Enable Zen Mode',
    faunaPopoverAria: 'Pond species selector',
    faunaPopoverTitle: 'Pond inhabitants',
    presetKoi: 'Koi Only',
    presetOcean: 'Ocean',
    presetAll: 'All',
    speciesKoiName: 'Koi Fish',
    speciesKoiDesc: 'Classic, Tancho, and Ghost Butterfly',
    speciesTurtleName: 'Sea Turtles',
    speciesTurtleDesc: 'Golden scutes and calm rowing',
    speciesWhaleName: 'Whale Shark',
    speciesWhaleDesc: 'Spotted gentle giant',
    speciesHammerName: 'Hammerhead Shark',
    speciesHammerDesc: 'Agile swimmer with T-shaped cephalofoil',
    envSectionTitle: 'Environment and marine life',
    envLilies: 'Lily Pads',
    envCurrents: 'Currents',
    envPlankton: 'Plankton & Bubbles',
    envKelp: 'Kelp',
    envJellyfish: 'Jellyfish',
    envSchool: 'Baitfish School',
    firefliesLabel: 'Fireflies',
    firefliesGroupAria: 'Fireflies mode',
    firefliesAuto: 'Auto',
    firefliesAutoTitle: 'Visible at night only',
    firefliesOn: 'On',
    firefliesOnTitle: 'Visible at any time',
    firefliesOff: 'Off',
    firefliesOffTitle: 'Hidden',
    heroAria: 'Greeting and search',
    searchAria: 'Search the web or use search bangs',
    searchPlaceholder: 'Search the web, URL, or !gh !yt !r !mdn !so !w...',
    searchInLabel: 'Search $1...',
    searchSubmitAria: 'Search',
    bangBadgeTitle: 'Click or press Backspace to clear bang',
    bangRemoveAria: 'Remove $1 prefix',
    pondHintPrefix: 'Click water to feed · Bangs:',
    dockAria: 'River stone shortcuts',
    stoneAddTitle: 'Add river stone',
    stoneAddAria: 'Add shortcut',
    stoneEditTitle: 'Edit or remove stones',
    stoneEditAria: 'Edit shortcuts',
    stoneNewTitle: 'New river stone',
    stoneEditModalTitle: 'Edit river stone',
    stoneEditOneTitle: 'Edit shortcut',
    stoneDeleteOneTitle: 'Delete shortcut',
    stoneEditOneAria: 'Edit $1',
    stoneDeleteOneAria: 'Delete $1',
    stoneFieldName: 'Short name',
    stoneNamePlaceholder: 'e.g. GitHub',
    stoneFieldUrl: 'Site URL',
    stoneUrlPlaceholder: 'e.g. github.com',
    stoneInvalidUrl: 'Enter a valid http:// or https:// URL (e.g. github.com or localhost:3000).',
    stoneResetAll: 'Reset all',
    stoneResetAllTitle: 'Restore all default shortcuts',
    stoneConfirmReset: 'Confirm?',
    stoneCancel: 'Cancel',
    stoneSave: 'Save',
    stoneDefaultSite: 'Site',
    pomoAria: 'Pomodoro timer',
    pomoTitle: 'Zen Pomodoro',
    pomoCollapseTitle: 'Collapse or expand Pomodoro',
    pomoCollapseAria: 'Collapse Pomodoro',
    pomoModeGroupAria: 'Pomodoro mode',
    pomoFocusMode: 'Focus 25m',
    pomoBreakMode: 'Break 5m',
    pomoStatusFocusIdle: 'Zen focus',
    pomoStatusBreakIdle: 'Short break',
    pomoStatusFocusRun: 'Focusing',
    pomoStatusBreakRun: 'Resting',
    pomoStatusPaused: 'Paused',
    pomoStatusComplete: 'Session complete! 🌸',
    pomoStatusReady: 'Ready to focus',
    pomoStatusSakura: 'Cherry blossoms 🌸',
    pomoStart: 'Start',
    pomoPause: 'Pause',
    pomoStartAria: 'Start Pomodoro',
    pomoPauseAria: 'Pause Pomodoro',
    pomoResetTitle: 'Reset',
    pomoResetAria: 'Reset Pomodoro',
    pomoTestTitle: 'Preview cherry blossom shower',
    pomoTestAria: 'Preview cherry blossoms',
    pomoDocFocus: 'Focus',
    pomoDocBreak: 'Break',
    zenExitTitle: 'Exit Zen Mode (Esc / Z)',
    zenExitAria: 'Exit Zen Mode',
    zenExitText: 'Exit Zen',
    zenToastPrefix: 'Zen Mode · Press',
    zenToastSuffix: 'or move cursor to top-right to return',
    greetingMorning: 'Good morning',
    greetingAfternoon: 'Good afternoon',
    greetingEvening: 'Good evening',
    speciesKoiShort: 'Koi',
    speciesTurtleShort: 'Turtles',
    speciesWhaleShort: 'Whale Shark',
    speciesHammerShort: 'Hammerhead',
    faunaMulti: 'Fauna ($1)',
    faunaZero: 'Fauna (0)',
    sliderValuetextNone: 'Density $1, 0 active creatures (no species selected)',
    sliderValuetextActive: 'Density $1 ($2 active creatures)',
    sliderTitleNone: 'No active species',
    sliderTitleActive: '$1 active creatures (density $2)'
  }
};

export function getUiLocale() {
  if (typeof chrome !== 'undefined' && chrome.i18n && typeof chrome.i18n.getUILanguage === 'function') {
    return chrome.i18n.getUILanguage();
  }
  return (typeof navigator !== 'undefined' && navigator.language) || 'es';
}

export function getShortLang() {
  const loc = String(getUiLocale() || 'es').toLowerCase();
  return loc.startsWith('en') ? 'en' : 'es';
}

export function t(key, subs) {
  const subList = subs === undefined ? undefined : Array.isArray(subs) ? subs.map(String) : [String(subs)];

  if (typeof chrome !== 'undefined' && chrome.i18n && typeof chrome.i18n.getMessage === 'function') {
    const msg = chrome.i18n.getMessage(key, subList);
    if (msg) return msg;
  }

  const lang = getShortLang();
  const dict = FALLBACK_MESSAGES[lang] || FALLBACK_MESSAGES.es;
  let template = dict[key] !== undefined ? dict[key] : FALLBACK_MESSAGES.es[key] || key;

  if (subList && subList.length > 0) {
    template = template.replace(/\$(\d+)/g, (_, idxStr) => {
      const idx = Number(idxStr) - 1;
      return subList[idx] !== undefined ? subList[idx] : '';
    });
  }
  return template;
}

export function applyDomI18n(root = document) {
  if (root === document && document.documentElement) {
    document.documentElement.lang = getShortLang();
  }

  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const val = t(el.dataset.i18n);
    if (val) el.textContent = val;
  });

  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    const val = t(el.dataset.i18nTitle);
    if (val) el.title = val;
  });

  root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
    const val = t(el.dataset.i18nAriaLabel);
    if (val) el.setAttribute('aria-label', val);
  });

  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    const val = t(el.dataset.i18nPlaceholder);
    if (val) el.setAttribute('placeholder', val);
  });
}
