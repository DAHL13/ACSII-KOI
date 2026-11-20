import { PREFS_STORAGE_KEY } from '../src/core/constants.js';
import { t } from '../src/core/i18n.js';

const reportEl = document.getElementById('test-report');
const summaryEl = document.getElementById('test-summary');
const logEl = document.getElementById('test-log');

const results = [];
const globalErrors = [];

window.addEventListener('error', (e) => {
  globalErrors.push(e.message || String(e.error || 'Unknown error'));
});
window.addEventListener('unhandledrejection', (e) => {
  globalErrors.push('UnhandledRejection: ' + (e.reason?.message || String(e.reason)));
});

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, msg) {
  if (!Object.is(actual, expected)) {
    throw new Error(`${msg || 'Expected equality'}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  }
}

async function check(name, fn) {
  try {
    await fn();
    results.push({ ok: true, name });
  } catch (err) {
    results.push({ ok: false, name, err: err?.stack || String(err) });
  }
}

async function main() {
  localStorage.clear();

  const res = await fetch('/index.html');
  assert(res.ok, 'Failed to fetch /index.html');
  const html = await res.text();
  const parsed = new DOMParser().parseFromString(html, 'text/html');

  // Inject real index.html body before importing src/main.js
  for (const node of Array.from(parsed.body.childNodes)) {
    if (node.nodeName === 'SCRIPT') continue;
    document.body.insertBefore(document.importNode(node, true), reportEl);
  }

  const { destroyApp } = await import('../src/main.js');
  await new Promise((r) => requestAnimationFrame(() => r()));

  try {

  await check('Startup DOM hydration & dead element cleanup', () => {
    assert(document.getElementById('clock').textContent.trim().length > 0, 'Clock must be populated');
    assert(document.getElementById('greeting').textContent.trim().length > 0, 'Greeting must be populated');
    assertEqual(document.querySelectorAll('#river-stones-list .river-stone').length, 6, '6 default river stones rendered');
    assertEqual(document.getElementById('lilies-btn'), null, 'Dead #lilies-btn id must be absent');
    assertEqual(document.querySelectorAll('.control-label').length, 0, 'No .control-label elements in DOM');
  });

  await check('Biome & solar toggles update attributes, document title, and ARIA states', () => {
    const oceanBtn = document.querySelector('.biome-btn[data-biome="ocean"]');
    oceanBtn.click();
    assertEqual(document.documentElement.getAttribute('data-biome'), 'ocean');
    assertEqual(oceanBtn.getAttribute('aria-pressed'), 'true');
    assertEqual(document.title, t('pageTitleOcean'), `Expected ocean title, got ${document.title}`);

    const dayBtn = document.querySelector('.solar-btn[data-time-mode="day"]');
    dayBtn.click();
    assertEqual(document.documentElement.getAttribute('data-solar'), 'day');
    assertEqual(dayBtn.getAttribute('aria-pressed'), 'true');
  });

  await check('Fauna popover open/close updates aria-expanded, inert, and restores focus', () => {
    const faunaBtn = document.getElementById('fauna-btn');
    const faunaPopover = document.getElementById('fauna-popover');
    faunaBtn.click();
    assertEqual(faunaPopover.hidden, false);
    assertEqual(faunaBtn.getAttribute('aria-expanded'), 'true');
    assertEqual(faunaPopover.inert, false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assertEqual(faunaPopover.hidden, true);
    assertEqual(faunaBtn.getAttribute('aria-expanded'), 'false');
    assertEqual(document.activeElement, faunaBtn);
  });

  await check('Zero-species selection & fireflies label synchronization', () => {
    for (const card of document.querySelectorAll('.species-card.is-active')) {
      card.click();
    }
    assertEqual(document.getElementById('fish-count-value').textContent, '0');
    assert(document.getElementById('fish-count').getAttribute('aria-valuetext').includes('0'));
    document.querySelector('.firefly-mode-btn[data-fireflies="on"]').click();
    assertEqual(document.getElementById('fauna-btn-label').textContent, t('firefliesLabel'));
  });

  await check('Zen Mode toggles inert across regions and ignores typing Z in search input', () => {
    const searchInput = document.getElementById('search-input');
    searchInput.focus();
    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true }));
    assertEqual(document.body.classList.contains('zen-mode'), false, 'Typing Z in search must not activate Zen');

    searchInput.blur();
    document.body.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', bubbles: true }));
    assertEqual(document.documentElement.getAttribute('data-zen'), 'true');
    assertEqual(document.getElementById('top-bar').inert, true);
    assertEqual(document.getElementById('center-stage').inert, true);
    assertEqual(document.getElementById('zen-exit-btn').inert, false);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assertEqual(document.documentElement.getAttribute('data-zen'), null);
    assertEqual(document.getElementById('top-bar').inert, false);
    assertEqual(document.getElementById('zen-exit-btn').inert, true);
  });

  await check('River stone modal sets inert on background, traps Tab focus, and restores trigger focus', () => {
    const addBtn = document.getElementById('stone-add-btn');
    const modal = document.getElementById('stone-modal');
    addBtn.focus();
    addBtn.click();
    assertEqual(modal.hidden, false);
    assertEqual(document.getElementById('top-bar').inert, true);

    const cancelBtn = document.getElementById('stone-cancel-btn');
    const saveBtn = modal.querySelector('.stone-btn-save');
    const titleInput = document.getElementById('stone-title-input');
    saveBtn.focus();
    modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    assertEqual(document.activeElement, titleInput, 'Tab on last modal focusable must wrap to first input');

    modal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }));
    assertEqual(document.activeElement, saveBtn, 'Shift+Tab on first modal input must wrap to last button');

    cancelBtn.click();
    assertEqual(modal.hidden, true);
    assertEqual(document.getElementById('top-bar').inert, false);
    assertEqual(document.activeElement, addBtn);
  });

  await check('PointerEvents interaction on document and canvas', () => {
    document.dispatchEvent(new PointerEvent('pointermove', { clientX: 250, clientY: 250, isPrimary: true }));
    document.getElementById('koi-canvas').dispatchEvent(new MouseEvent('click', { clientX: 300, clientY: 300 }));
    document.dispatchEvent(new PointerEvent('pointerup', { pointerType: 'touch' }));
  });

  await check('Cross-tab storage sync updates UI prefs live', () => {
    const next = JSON.parse(localStorage.getItem(PREFS_STORAGE_KEY) || '{}');
    next.biome = 'pond';
    next.timeMode = 'sunset';
    next.fishCount = 21;
    next.species = { koi: true, turtle: false, whaleShark: false, hammerhead: false };
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new StorageEvent('storage', { key: PREFS_STORAGE_KEY }));

    assertEqual(document.documentElement.getAttribute('data-biome'), 'pond');
    assertEqual(document.documentElement.getAttribute('data-solar'), 'sunset');
    assertEqual(document.getElementById('fish-count').value, '21');
    assertEqual(document.getElementById('fish-count-value').textContent, '21');
  });

  await check('Reef & Winter biomes, new species (mantaRay, giantCarp), and snow chip', () => {
    document.querySelector('.biome-btn[data-biome="reef"]').click();
    assertEqual(document.documentElement.getAttribute('data-biome'), 'reef');
    assertEqual(document.title, t('pageTitleReef'));

    document.querySelector('.biome-btn[data-biome="winter"]').click();
    assertEqual(document.documentElement.getAttribute('data-biome'), 'winter');
    assertEqual(document.title, t('pageTitleWinter'));
    assertEqual(document.querySelector('.env-chip[data-env="snow"]').getAttribute('aria-pressed'), 'true');

    document.querySelector('.species-card[data-species="mantaRay"]').click();
    document.querySelector('.species-card[data-species="giantCarp"]').click();
    assert(Number(document.getElementById('fish-count-value').textContent) > 0);
  });

  await check('Settings modal: username greeting, 12h clock, daily focus, eco mode, and custom bangs', () => {
    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    settingsBtn.focus();
    settingsBtn.click();
    assertEqual(settingsModal.hidden, false);
    assertEqual(document.getElementById('top-bar').inert, true);

    const closeBtn = document.getElementById('settings-close-btn');
    const importBtn = document.getElementById('backup-import-btn');
    importBtn.focus();
    settingsModal.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }));
    assertEqual(document.activeElement, closeBtn, 'Tab from last control in settings modal must wrap to closeBtn');

    const userInput = document.getElementById('settings-username');
    userInput.value = 'Kai';
    userInput.dispatchEvent(new Event('input'));
    assert(document.getElementById('greeting').textContent.includes('Kai'), 'Greeting must display custom user name');

    document.querySelector('.clock-format-btn[data-clock-format="12h"]').click();
    const clk = document.getElementById('clock').textContent;
    assert(clk.includes('AM') || clk.includes('PM'), `Expected 12h AM/PM clock, got ${clk}`);

    const focusCheckbox = document.getElementById('settings-show-focus');
    focusCheckbox.checked = false;
    focusCheckbox.dispatchEvent(new Event('change'));
    assertEqual(document.getElementById('daily-focus-wrap').hidden, true);
    focusCheckbox.checked = true;
    focusCheckbox.dispatchEvent(new Event('change'));
    assertEqual(document.getElementById('daily-focus-wrap').hidden, false);

    document.querySelector('.eco-mode-btn[data-eco-mode="on"]').click();
    assertEqual(document.querySelector('.eco-mode-btn[data-eco-mode="on"]').getAttribute('aria-pressed'), 'true');

    document.getElementById('bang-prefix-input').value = '!npm';
    document.getElementById('bang-name-input').value = 'npm';
    document.getElementById('bang-url-input').value = 'https://www.npmjs.com/search?q={q}';
    document.getElementById('bang-add-form').dispatchEvent(new Event('submit', { cancelable: true }));
    assert(document.getElementById('custom-bang-list').textContent.includes('!npm'));

    closeBtn.click();
    assertEqual(settingsModal.hidden, true);
    assertEqual(document.getElementById('top-bar').inert, false);
    assertEqual(document.activeElement, settingsBtn);
  });

  await check('Search bang autocomplete & global keyboard shortcuts (/, F, R, P)', () => {
    const searchInput = document.getElementById('search-input');
    const suggestions = document.getElementById('bang-suggestions');
    searchInput.value = '!np';
    searchInput.dispatchEvent(new Event('input'));
    assertEqual(suggestions.hidden, false);
    searchInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }));
    assertEqual(document.getElementById('bang-badge').textContent, 'npm');
    document.getElementById('bang-badge').click();

    searchInput.blur();
    document.body.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true }));
    assertEqual(document.activeElement, searchInput, 'Shortcut / should focus search input');

    searchInput.blur();
    const rainBefore = document.getElementById('rain-btn').getAttribute('aria-pressed');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }));
    assert(document.getElementById('rain-btn').getAttribute('aria-pressed') !== rainBefore, 'Shortcut R should toggle rain');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true }));
    assertEqual(document.getElementById('pomo-play-btn').classList.contains('is-running'), true);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', bubbles: true }));
    assertEqual(document.getElementById('pomo-play-btn').classList.contains('is-running'), false);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', bubbles: true }));
  });

  await check('River stone reorder controls & responsive overflow check', () => {
    const firstTitleBefore = document.querySelector('#river-stones-list .stone-title').textContent;
    const editBtn = document.getElementById('stone-edit-btn');
    editBtn.click();
    document.querySelector('#river-stones-list .stone-mini-right').click();
    const secondTitleAfter = document.querySelectorAll('#river-stones-list .stone-title')[1].textContent;
    assertEqual(secondTitleAfter, firstTitleBefore, 'Clicking move-right must swap stone into second position');
    editBtn.click();

    assert(
      document.documentElement.scrollWidth <= window.innerWidth + 1,
      `Horizontal overflow detected: scrollWidth=${document.documentElement.scrollWidth} > innerWidth=${window.innerWidth}`
    );
  });

  let passed = 0;
  let failed = 0;
  for (const r of results) {
    const li = document.createElement('li');
    if (r.ok) {
      passed++;
      li.className = 'pass';
      li.textContent = `PASS: ${r.name}`;
    } else {
      failed++;
      li.className = 'fail';
      li.textContent = `FAIL: ${r.name} -> ${r.err}`;
    }
    logEl.appendChild(li);
  }
  for (const ge of globalErrors) {
    failed++;
    const li = document.createElement('li');
    li.className = 'fail';
    li.textContent = `EXCEPTION: ${ge}`;
    logEl.appendChild(li);
  }

  reportEl.dataset.status = 'done';
  reportEl.dataset.pass = String(passed);
  reportEl.dataset.fail = String(failed);
  summaryEl.textContent = `PASS=${passed}\nFAIL=${failed}`;
  document.title = `UI:${failed === 0 ? 'PASS' : 'FAIL'}:${passed}/${passed + failed}`;
  } finally {
    destroyApp();
  }
}

main().catch((err) => {
  reportEl.dataset.status = 'done';
  reportEl.dataset.fail = '1';
  summaryEl.textContent = `FATAL: ${err?.stack || err}`;
});
