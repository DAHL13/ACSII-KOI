import { t } from '../core/i18n.js';

export function createBiomePopoverController(options) {
  const {
    biomeBtn,
    biomeBtnSwatch,
    biomeBtnLabel,
    biomePopover,
    biomeButtons,
    spaceOptionsSection,
    spacePaletteButtons = [],
    spaceSpeedButtons = [],
    onSelectBiome,
    onSelectSpacePalette,
    onSelectSpaceSpeed,
    onOpenChange,
    onInertSync
  } = options;

  function getBiomeMeta(biome) {
    if (biome === 'ocean') return { label: t('biomeOcean'), swatchClass: 'swatch swatch-ocean' };
    if (biome === 'reef') return { label: t('biomeReef'), swatchClass: 'swatch swatch-reef' };
    if (biome === 'winter') return { label: t('biomeWinter'), swatchClass: 'swatch swatch-winter' };
    if (biome === 'space') return { label: t('biomeSpace'), swatchClass: 'swatch swatch-space' };
    if (biome === 'aurora') return { label: t('biomeAurora'), swatchClass: 'swatch swatch-aurora' };
    if (biome === 'wave') return { label: t('biomeWave'), swatchClass: 'swatch swatch-wave' };
    return { label: t('biomePond'), swatchClass: 'swatch swatch-pond' };
  }

  function syncUI(biome, spacePalette = 'gold', spaceOrbitSpeed = 1) {
    const meta = getBiomeMeta(biome);
    if (biomeBtnLabel) biomeBtnLabel.textContent = meta.label;
    if (biomeBtnSwatch) biomeBtnSwatch.className = meta.swatchClass;

    biomeButtons.forEach((btn) => {
      const active = btn.dataset.biome === biome;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    if (spaceOptionsSection) {
      spaceOptionsSection.hidden = biome !== 'space';
    }

    spacePaletteButtons.forEach((btn) => {
      const active = btn.dataset.spacePalette === spacePalette;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });

    spaceSpeedButtons.forEach((btn) => {
      const active = Number(btn.dataset.spaceSpeed) === Number(spaceOrbitSpeed);
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  function setOpen(open, restoreFocus = false) {
    biomePopover.hidden = !open;
    biomeBtn.setAttribute('aria-expanded', String(open));
    if (open && onOpenChange) {
      onOpenChange(true);
    }
    onInertSync();
    if (open) {
      const firstControl = biomePopover.querySelector('button');
      if (firstControl) firstControl.focus();
    } else if (restoreFocus) {
      biomeBtn.focus();
    }
  }

  biomeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    setOpen(biomePopover.hidden);
  });

  biomeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextBiome = btn.dataset.biome;
      if (onSelectBiome) {
        onSelectBiome(nextBiome);
      }
      setOpen(false);
    });
  });

  spacePaletteButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (onSelectSpacePalette) {
        onSelectSpacePalette(btn.dataset.spacePalette);
      }
    });
  });

  spaceSpeedButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (onSelectSpaceSpeed) {
        onSelectSpaceSpeed(Number(btn.dataset.spaceSpeed));
      }
    });
  });

  const onDocClick = (e) => {
    if (!biomePopover.hidden && !biomePopover.contains(e.target) && !biomeBtn.contains(e.target)) {
      setOpen(false);
    }
  };
  document.addEventListener('click', onDocClick);

  return {
    setOpen,
    isOpen: () => !biomePopover.hidden,
    syncUI,
    destroy() {
      document.removeEventListener('click', onDocClick);
    }
  };
}
