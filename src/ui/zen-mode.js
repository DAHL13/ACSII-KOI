export function createZenController(options) {
  const { zenBtn, zenToast, searchInput, onStateChange } = options;

  let enabled = false;
  let toastTimer = null;
  let zenPeekTimer = null;

  function showZenToast() {
    zenToast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      zenToast.classList.remove('is-visible');
    }, 2600);
  }

  function apply(nextEnabled, notify = false) {
    enabled = Boolean(nextEnabled);
    if (enabled) {
      document.documentElement.setAttribute('data-zen', 'true');
    } else {
      document.documentElement.removeAttribute('data-zen');
    }
    document.body.classList.toggle('zen-mode', enabled);
    zenBtn.setAttribute('aria-pressed', String(enabled));

    if (enabled) {
      if (searchInput) searchInput.blur();
      if (notify) showZenToast();
    } else {
      zenToast.classList.remove('is-visible');
    }

    if (onStateChange) {
      onStateChange(enabled);
    }
  }

  function handlePointerMove(e) {
    if (!enabled) return;
    const nearTopRight = e.clientX > window.innerWidth - 220 && e.clientY < 110;
    if (nearTopRight) {
      document.body.classList.add('zen-ui-peek');
      clearTimeout(zenPeekTimer);
      zenPeekTimer = setTimeout(() => {
        document.body.classList.remove('zen-ui-peek');
      }, 1600);
    }
  }

  return {
    apply,
    isEnabled: () => enabled,
    handlePointerMove,
    destroy() {
      clearTimeout(toastTimer);
      clearTimeout(zenPeekTimer);
    }
  };
}
