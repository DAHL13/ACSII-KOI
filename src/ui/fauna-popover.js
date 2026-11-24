import { t } from '../core/i18n.js';

export function createFaunaPopoverController(options) {
  const {
    faunaBtn,
    faunaBtnLabel,
    faunaPopover,
    fishSlider,
    fishCountValue,
    speciesCards,
    faunaPresets,
    envChips,
    fireflyModeButtons,
    envConfig,
    getPrefs,
    engine,
    onSpeciesChange,
    onEnvToggle,
    onFirefliesChange,
    onFishCountChange,
    onOpenChange,
    onInertSync
  } = options;

  const SPECIES_SHORT_LABELS = {
    koi: t('speciesKoiShort'),
    turtle: t('speciesTurtleShort'),
    whaleShark: t('speciesWhaleShort'),
    hammerhead: t('speciesHammerShort'),
    mantaRay: t('speciesMantaShort'),
    giantCarp: t('speciesCarpShort')
  };

  function syncFishCountAccessibility() {
    const prefs = getPrefs();
    const sp = prefs.species;
    const activeSpeciesCount = Object.keys(SPECIES_SHORT_LABELS).filter((k) => sp[k]).length;
    const activeTotal = engine.getCreatureCount();
    fishCountValue.textContent = String(activeTotal);
    if (activeSpeciesCount === 0) {
      fishSlider.setAttribute('aria-valuetext', t('sliderValuetextNone', prefs.fishCount));
      fishCountValue.title = t('sliderTitleNone');
    } else {
      fishSlider.setAttribute('aria-valuetext', t('sliderValuetextActive', [prefs.fishCount, activeTotal]));
      fishCountValue.title = t('sliderTitleActive', [activeTotal, prefs.fishCount]);
    }
  }

  function updateFaunaTriggerLabel() {
    const prefs = getPrefs();
    const sp = prefs.species;
    const activeKeys = Object.keys(SPECIES_SHORT_LABELS).filter((k) => sp[k]);
    if (activeKeys.length === 0) {
      faunaBtnLabel.textContent = prefs.firefliesMode === 'on' ? t('firefliesLabel') : t('faunaZero');
    } else if (activeKeys.length === 1) {
      faunaBtnLabel.textContent = SPECIES_SHORT_LABELS[activeKeys[0]];
    } else {
      faunaBtnLabel.textContent = t('faunaMulti', activeKeys.length);
    }
    syncFishCountAccessibility();
  }

  function syncUI() {
    const prefs = getPrefs();
    speciesCards.forEach((card) => {
      const active = Boolean(prefs.species[card.dataset.species]);
      card.classList.toggle('is-active', active);
      card.setAttribute('aria-pressed', String(active));
    });

    fireflyModeButtons.forEach((btn) => {
      const active = btn.dataset.fireflies === prefs.firefliesMode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    envChips.forEach((chip) => {
      const cfg = envConfig[chip.dataset.env];
      const active = cfg ? Boolean(prefs[cfg.prefKey]) : false;
      chip.classList.toggle('is-active', active);
      chip.setAttribute('aria-pressed', String(active));
    });

    fishSlider.value = String(prefs.fishCount);
    updateFaunaTriggerLabel();
  }

  function setOpen(open, restoreFocus = false) {
    faunaPopover.hidden = !open;
    faunaBtn.setAttribute('aria-expanded', String(open));
    if (open && onOpenChange) {
      onOpenChange(true);
    }
    onInertSync();
    if (open) {
      const firstControl = faunaPopover.querySelector('button');
      if (firstControl) firstControl.focus();
    } else if (restoreFocus) {
      faunaBtn.focus();
    }
  }

  faunaBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(faunaPopover.hidden);
  });

  speciesCards.forEach((card) => {
    card.addEventListener('click', () => {
      const key = card.dataset.species;
      const prefs = getPrefs();
      onSpeciesChange({ ...prefs.species, [key]: !prefs.species[key] });
    });
  });

  faunaPresets.forEach((btn) => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      if (preset === 'koi') {
        onSpeciesChange({
          koi: true,
          turtle: false,
          whaleShark: false,
          hammerhead: false,
          mantaRay: false,
          giantCarp: false
        });
      } else if (preset === 'ocean') {
        onSpeciesChange({
          koi: false,
          turtle: true,
          whaleShark: true,
          hammerhead: true,
          mantaRay: true,
          giantCarp: false
        });
      } else if (preset === 'reef') {
        onSpeciesChange({
          koi: false,
          turtle: true,
          whaleShark: false,
          hammerhead: false,
          mantaRay: true,
          giantCarp: false
        });
      } else if (preset === 'all') {
        onSpeciesChange({
          koi: true,
          turtle: true,
          whaleShark: true,
          hammerhead: true,
          mantaRay: true,
          giantCarp: true
        });
      }
    });
  });

  envChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const key = chip.dataset.env;
      const cfg = envConfig[key];
      if (!cfg) return;
      onEnvToggle(key, !getPrefs()[cfg.prefKey]);
    });
  });

  fireflyModeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      onFirefliesChange(btn.dataset.fireflies);
    });
  });

  fishSlider.addEventListener('input', (e) => {
    onFishCountChange(e.target.value);
  });

  const onDocClick = (e) => {
    if (!faunaPopover.hidden && !faunaPopover.contains(e.target) && !faunaBtn.contains(e.target)) {
      setOpen(false);
    }
  };
  document.addEventListener('click', onDocClick);

  return {
    setOpen,
    isOpen: () => !faunaPopover.hidden,
    syncUI,
    syncFishCountAccessibility,
    updateFaunaTriggerLabel,
    destroy() {
      document.removeEventListener('click', onDocClick);
    }
  };
}
