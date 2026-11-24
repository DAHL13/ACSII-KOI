import { getUiLocale, t } from '../core/i18n.js';
import { loadDailyFocus, saveDailyFocus } from '../core/storage.js';

function getBaseGreeting(hour) {
  if (hour >= 5 && hour < 12) return t('greetingMorning');
  if (hour >= 12 && hour < 20) return t('greetingAfternoon');
  return t('greetingEvening');
}

export function createClockController(options) {
  const {
    clockEl,
    dateLabelEl,
    greetingEl,
    dailyFocusWrap,
    dailyFocusInput,
    onSolarAutoTick
  } = options;

  let clockFormat = '24h';
  let userName = '';
  let showDailyFocus = true;
  let lastClockKey = '';
  let timerId = null;
  let saveDebounceId = null;

  function formatClockText(hours, mins) {
    if (clockFormat === '12h') {
      const suffix = hours >= 12 ? 'PM' : 'AM';
      const h12 = hours % 12 || 12;
      return `${h12}:${mins} ${suffix}`;
    }
    return `${String(hours).padStart(2, '0')}:${mins}`;
  }

  function update(force = false) {
    const now = new Date();
    const hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const hoursStr = String(hours).padStart(2, '0');
    const locale = getUiLocale();
    const key = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${hoursStr}-${minutes}-${clockFormat}-${userName}-${locale}`;
    if (!force && key === lastClockKey) return;
    lastClockKey = key;

    clockEl.textContent = formatClockText(hours, minutes);
    clockEl.setAttribute('datetime', `${hoursStr}:${minutes}`);

    const baseGreeting = getBaseGreeting(hours);
    greetingEl.textContent = userName ? t('greetingWithName', [baseGreeting, userName]) : baseGreeting;

    try {
      dateLabelEl.textContent = now.toLocaleDateString(locale, {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });
    } catch (_) {
      dateLabelEl.textContent = '';
    }

    if (onSolarAutoTick) {
      onSolarAutoTick();
    }
  }

  function startTimer() {
    if (timerId !== null || document.hidden) return;
    timerId = setInterval(() => update(false), 1000);
  }

  function stopTimer() {
    if (timerId !== null) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function onVisibilityChange() {
    if (document.hidden) {
      stopTimer();
    } else {
      update(false);
      startTimer();
    }
  }

  function syncDailyFocusVisibility() {
    if (dailyFocusWrap) {
      dailyFocusWrap.hidden = !showDailyFocus;
    }
  }

  function setDailyFocus(value) {
    if (!dailyFocusInput || document.activeElement === dailyFocusInput) return;
    const clean = typeof value === 'string' ? value : '';
    if (dailyFocusInput.value !== clean) {
      dailyFocusInput.value = clean;
    }
  }

  function commitDailyFocus() {
    if (!dailyFocusInput) return;
    clearTimeout(saveDebounceId);
    saveDailyFocus(dailyFocusInput.value);
  }

  if (dailyFocusInput) {
    dailyFocusInput.value = loadDailyFocus();
    dailyFocusInput.addEventListener('input', () => {
      clearTimeout(saveDebounceId);
      saveDebounceId = setTimeout(() => {
        saveDailyFocus(dailyFocusInput.value);
      }, 250);
    });
    dailyFocusInput.addEventListener('change', commitDailyFocus);
    dailyFocusInput.addEventListener('blur', commitDailyFocus);
  }

  document.addEventListener('visibilitychange', onVisibilityChange);
  update(true);
  startTimer();

  return {
    applyPrefs(prefs) {
      clockFormat = prefs.clockFormat === '12h' ? '12h' : '24h';
      userName = typeof prefs.userName === 'string' ? prefs.userName.trim() : '';
      showDailyFocus = prefs.showDailyFocus !== undefined ? Boolean(prefs.showDailyFocus) : true;
      syncDailyFocusVisibility();
      update(true);
    },
    setDailyFocus,
    forceUpdate: () => update(true),
    destroy() {
      stopTimer();
      clearTimeout(saveDebounceId);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
  };
}
