import { DEFAULT_PREFS, POMO_STORAGE_KEY, PREFS_STORAGE_KEY, STONES_STORAGE_KEY } from '../src/core/constants.js';
import { t } from '../src/core/i18n.js';
import { angleDiff, clamp, clampInt, dampFactor, lerp, lerpAngle } from '../src/core/math.js';
import { ObjectPool } from '../src/core/object-pool.js';
import { loadPrefs, savePrefs, subscribePrefsChanges } from '../src/core/storage.js';
import { PondEcosystem, SOLAR_KEYS } from '../src/ecosystem/ecosystem.js';
import { PomodoroController } from '../src/productivity/pomodoro.js';
import { RiverStonesManager } from '../src/productivity/river-stones.js';
import { SmartSearchController } from '../src/productivity/smart-search.js';
import {
  createStoneId,
  extractHostname,
  getBangSearchUrl,
  isValidIpv4,
  resolveDirectUrl,
  sanitizeHttpUrl,
  shortenTitle
} from '../src/productivity/url-utils.js';
import { ATLAS_CHARS, GlyphAtlas } from '../src/render/glyph-atlas.js';
import { KoiPondEngine } from '../src/simulation/engine.js';

const reportEl = document.getElementById('test-report');
const summaryEl = document.getElementById('test-summary');
const logEl = document.getElementById('test-log');
const sandboxEl = document.getElementById('sandbox');

const tests = [];
const globalErrors = [];

window.addEventListener('error', (e) => {
  globalErrors.push(e.message || String(e.error || 'Unknown error'));
});
window.addEventListener('unhandledrejection', (e) => {
  globalErrors.push('UnhandledRejection: ' + (e.reason?.message || String(e.reason)));
});

function test(name, fn) {
  tests.push({ name, fn });
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || 'Assertion failed');
}

function assertEqual(actual, expected, msg) {
  if (!Object.is(actual, expected)) {
    throw new Error(`${msg || 'Expected equality'}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
  }
}

test('ObjectPool acquires, overwrites oldest, and respects overwriteOldest=false', () => {
  let id = 0;
  const pool = new ObjectPool(3, () => ({ id: id++, active: false }));
  const a = pool.acquire(false);
  a.active = true;
  const b = pool.acquire(false);
  b.active = true;
  const c = pool.acquire(false);
  c.active = true;
  assertEqual(pool.acquire(false), null, 'Full pool should return null when overwriteOldest=false');
  const reused = pool.acquire(true);
  assertEqual(reused, a, 'Full pool should overwrite oldest item cleanly');
});

test('math utilities clamp, clampInt, lerp, angleDiff, lerpAngle, dampFactor', () => {
  assertEqual(clamp(15, 0, 10), 10);
  assertEqual(clamp(-2, 0, 10), 0);
  assertEqual(clampInt('abc', 5, 25, 12), 12);
  assertEqual(clampInt('99', 5, 25, 12), 25);
  assertEqual(lerp(10, 20, 0.25), 12.5);
  const diff = angleDiff(-Math.PI + 0.1, Math.PI - 0.1);
  assert(Math.abs(diff - 0.2) < 1e-6, `Expected shortest arc ~0.2, got ${diff}`);
  assert(Math.abs(lerpAngle(0, Math.PI / 2, 0.5) - Math.PI / 4) < 1e-6);
  assert(Math.abs(dampFactor(0.5, 1 / 60) - 0.5) < 1e-6);
});

test('url-utils validates safe HTTP/HTTPS URLs and rejects dangerous protocols', () => {
  assertEqual(sanitizeHttpUrl('javascript:alert(1)'), '');
  assertEqual(sanitizeHttpUrl('data:text/html,hi'), '');
  assertEqual(sanitizeHttpUrl('file:///etc/passwd'), '');
  assertEqual(sanitizeHttpUrl('https://user:pass@example.com'), '');
  assertEqual(sanitizeHttpUrl('hello\nworld'), '');
  assertEqual(sanitizeHttpUrl('bareword'), '');
  assertEqual(sanitizeHttpUrl('localhost:3000/app'), 'http://localhost:3000/app');
  assertEqual(sanitizeHttpUrl('github.com/DAHL13'), 'https://github.com/DAHL13');
  assertEqual(extractHostname('https://developer.mozilla.org/es/'), 'developer.mozilla.org');

  assertEqual(isValidIpv4('127.0.0.1'), true);
  assertEqual(isValidIpv4('256.0.0.1'), false);

  assertEqual(resolveDirectUrl('search query'), null);
  assertEqual(resolveDirectUrl('foo.notatld'), null);
  assertEqual(resolveDirectUrl('foo.local:8080'), 'https://foo.local:8080/');
  assertEqual(resolveDirectUrl('localhost:5173'), 'http://localhost:5173/');
  assertEqual(resolveDirectUrl('192.168.1.10'), 'http://192.168.1.10/');
  assertEqual(resolveDirectUrl('github.com'), 'https://github.com/');

  assert(getBangSearchUrl({ prefix: '!mdn', url: '' }, 'es').includes('/es/search?q='));
  assert(getBangSearchUrl({ prefix: '!mdn', url: '' }, 'en').includes('/en-US/search?q='));
  assert(getBangSearchUrl({ prefix: '!w', url: '' }, 'en').includes('en.wikipedia.org'));
  assert(getBangSearchUrl({ prefix: '!w', url: '' }, 'es').includes('es.wikipedia.org'));

  assertEqual(shortenTitle('GitHub - Build software', 'https://github.com'), 'GitHub');
  assert(shortenTitle('VeryLongSiteTitleNameHere', 'https://example.com').endsWith('…'));
  assert(createStoneId().startsWith('stone-'));
});

test('storage loadPrefs validates malformed JSON/arrays, migrates legacy v2, and subscribes', () => {
  localStorage.clear();
  assertEqual(loadPrefs().fishCount, DEFAULT_PREFS.fishCount);

  localStorage.setItem(PREFS_STORAGE_KEY, 'not-json{');
  assertEqual(loadPrefs().biome, 'pond');

  localStorage.setItem(PREFS_STORAGE_KEY, '[]');
  assertEqual(loadPrefs().fishCount, DEFAULT_PREFS.fishCount, 'Array JSON must reset to defaults');

  localStorage.setItem(PREFS_STORAGE_KEY, '42');
  assertEqual(loadPrefs().fishCount, DEFAULT_PREFS.fishCount, 'Primitive JSON must reset to defaults');

  localStorage.removeItem(PREFS_STORAGE_KEY);
  localStorage.setItem('ascii_koi_zen_prefs_v2', JSON.stringify({ biome: 'ocean', fishCount: 99, timeMode: 'bad' }));
  const migrated = loadPrefs();
  assertEqual(migrated.biome, 'ocean');
  assertEqual(migrated.fishCount, 25);
  assertEqual(migrated.timeMode, DEFAULT_PREFS.timeMode);

  let received = null;
  const unsub = subscribePrefsChanges((p) => {
    received = p;
  });
  savePrefs({ ...DEFAULT_PREFS, fishCount: 18, biome: 'ocean' });
  window.dispatchEvent(new StorageEvent('storage', { key: 'unrelated_key' }));
  assertEqual(received, null, 'Unrelated key should not trigger callback');
  window.dispatchEvent(new StorageEvent('storage', { key: PREFS_STORAGE_KEY }));
  assert(received && received.fishCount === 18 && received.biome === 'ocean', 'Matching key should notify');
  unsub();
});

test('i18n interpolates positional placeholders and has fallback translations', () => {
  assert(t('searchInLabel', 'GitHub').includes('GitHub'));
  assert(t('sliderValuetextActive', [12, 8]).includes('12') && t('sliderValuetextActive', [12, 8]).includes('8'));
});

test('GlyphAtlas maintains integer DPR physical cell alignment and grows dynamically', () => {
  const atlas = new GlyphAtlas(1.25);
  assert(Math.abs(atlas.cellStepLogical * atlas.dpr - atlas.cellPx) < 1e-6, 'C-01 DPR physical alignment failed');

  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const keys = atlas.colorKeys;
  let drawn = 0;
  for (let c = 0; c < ATLAS_CHARS.length; c++) {
    for (let k = 0; k < 13 && drawn < 270; k++) {
      atlas.drawGlyph(ctx, ATLAS_CHARS[c], keys[k], false, 32, 32);
      drawn++;
    }
  }
  assert(atlas.rows > 8, `Expected atlas to grow beyond initial 8 rows after ${drawn} glyphs`);
});

test('PondEcosystem configures sunset rain key, rain pool, cherry shower, lilies occlusion, and fireflies', () => {
  assertEqual(SOLAR_KEYS.sunset.rainKey, 'rainSunset');
  const eco = new PondEcosystem(1024, 768, { rainEnabled: true, liliesEnabled: true, firefliesMode: 'auto', timeMode: 'night' });
  assertEqual(eco.rainEnabled, true);
  assertEqual(eco.isFirefliesActive(), true);
  eco.setFirefliesMode('off');
  assertEqual(eco.isFirefliesActive(), false);
  eco.setFirefliesMode('on');
  assertEqual(eco.isFirefliesActive(), true);

  eco.triggerCherryBlossomShower(10);
  eco.update(0.05);
  assert(eco.weatherLayer.cherryShowerRemaining > 0, 'Cherry shower should remain active');

  // Verify petal can float and be queried
  const petal = eco.weatherLayer.petalPool.items[0];
  petal.active = true;
  petal.state = 1;
  petal.x = 200;
  petal.y = 200;
  assertEqual(eco.findNearestFloatingPetal(210, 210, 50), petal);

  assert(eco.getLilyCount() > 0, 'Lilies should initialize');
  const firstLily = eco.liliesLayer.lilies[0];
  const hitIndices = new Int16Array(8);
  const hits = eco.testCircleIntersectsLilies(firstLily.x, firstLily.y, 10, hitIndices);
  assert(hits > 0, 'Circle on lily center should intersect lily');
  assertEqual(eco.isOccludedInList(firstLily.x - firstLily.rx * 0.25, firstLily.y, hitIndices, hits), true);

  eco.setLiliesEnabled(false);
  assertEqual(eco.testCircleIntersectsLilies(firstLily.x, firstLily.y, 10, hitIndices), 0);
});

test('KoiPondEngine + BaitSchool simulation, species targets, pools, and B-04 ripple deduplication', () => {
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 600;
  const atlas = new GlyphAtlas(1);
  const eco = new PondEcosystem(800, 600, { liliesEnabled: false });
  const engine = new KoiPondEngine(canvas, atlas, eco, {
    fishCount: 16,
    species: { koi: true, turtle: true, whaleShark: true, hammerhead: true },
    schoolEnabled: true
  });

  assert(engine.getCreatureCount() > 0, 'Multi-species count should be > 0');
  assertEqual(engine.getMetrics().fps, 60);

  engine.setSpecies({ koi: false, turtle: false, whaleShark: false, hammerhead: false });
  assertEqual(engine.getCreatureCount(), 0, 'Disabling all species must empty active creatures');

  engine.setSpecies({ koi: true });
  engine.syncFishCount(25);
  assertEqual(engine.getCreatureCount(), 25);

  engine.dropMultipleFood(10);
  engine.update(0.016);
  for (const c of engine.creatures) {
    assert(Number.isFinite(c.x) && Number.isFinite(c.y), 'Creature position must remain finite');
  }

  // Test B-04 ripple dedup: clear non-ripple glyphs and isolate one ripple at ':' phase
  for (const r of engine.ripplePool.items) r.active = false;
  for (const f of engine.foodPool.items) f.active = false;
  for (const tr of engine.trailPool.items) tr.active = false;
  engine.creatures = [];
  eco.causticPoints = [];

  engine.spawnRipple(200, 200, 12, 1.0, 0.9);
  const r = engine.ripplePool.items.find((x) => x.active);
  r.age = 0.5; // progress=0.5 => ':' char, tight radius=6

  const seenCells = new Set();
  let duplicateDetected = false;
  const origDraw = atlas.drawGlyph.bind(atlas);
  atlas.drawGlyph = (ctx, ch, colorKey, glow, gx, gy) => {
    if (ch === ':') {
      const k = `${gx},${gy}`;
      if (seenCells.has(k)) duplicateDetected = true;
      seenCells.add(k);
    }
    return origDraw(ctx, ch, colorKey, glow, gx, gy);
  };
  engine.render();
  assert(seenCells.size > 0, 'Expected ripple glyphs to render');
  assertEqual(duplicateDetected, false, 'B-04: ripple render should not draw the same (gx,gy) cell twice in one ripple');
  engine.destroy();
});

test('RiverStonesManager validates URLs, enforces max 8, 2-step reset, and clean destroy', () => {
  localStorage.clear();
  sandboxEl.innerHTML = `
    <div id="dock">
      <div id="list"></div>
      <button id="add">+</button>
      <button id="edit">E</button>
    </div>
    <div id="modal" hidden>
      <form id="form">
        <h2 id="mtitle"></h2>
        <input id="stitle" type="text">
        <input id="surl" type="text">
        <button id="cancel" type="button">Cancel</button>
        <button id="reset" type="button">Restaurar todas</button>
        <button type="submit">Save</button>
      </form>
    </div>
  `;
  const mgr = new RiverStonesManager({
    dockEl: document.getElementById('dock'),
    listEl: document.getElementById('list'),
    addBtn: document.getElementById('add'),
    editBtn: document.getElementById('edit'),
    modalEl: document.getElementById('modal'),
    modalForm: document.getElementById('form'),
    modalTitleEl: document.getElementById('mtitle'),
    titleInput: document.getElementById('stitle'),
    urlInput: document.getElementById('surl'),
    cancelBtn: document.getElementById('cancel'),
    resetBtn: document.getElementById('reset'),
    engine: { spawnRipple() {} }
  });

  assertEqual(mgr.stones.length, 6, 'Should load 6 default stones');
  assert(!sandboxEl.innerHTML.includes('google.com/s2/favicons'), 'Should never use remote google favicon service');

  // Invalid javascript: URL rejected
  mgr.openModal(null);
  document.getElementById('stitle').value = 'Bad';
  document.getElementById('surl').value = 'javascript:alert(1)';
  document.getElementById('form').dispatchEvent(new Event('submit', { cancelable: true }));
  assertEqual(mgr.stones.length, 6, 'Unsafe javascript: URL must not be saved');

  // Add up to 8 stones -> addBtn disabled
  mgr.closeModal();
  for (const url of ['https://example.org', 'https://rust-lang.org']) {
    mgr.openModal(null);
    document.getElementById('stitle').value = 'Test';
    document.getElementById('surl').value = url;
    document.getElementById('form').dispatchEvent(new Event('submit', { cancelable: true }));
  }
  assertEqual(mgr.stones.length, 8);
  assertEqual(document.getElementById('add').disabled, true, 'addBtn must be disabled at MAX_STONES=8');

  // 2-step reset
  const resetBtn = document.getElementById('reset');
  resetBtn.click();
  assertEqual(mgr.confirmResetPending, true);
  assertEqual(mgr.stones.length, 8, 'First click should only arm confirmation');
  resetBtn.click();
  assertEqual(mgr.stones.length, 6, 'Second click should restore default 6 stones');
  assertEqual(localStorage.getItem(STONES_STORAGE_KEY), null);

  mgr.destroy();
  sandboxEl.innerHTML = '';
});

test('SmartSearchController supports leading whitespace bangs, Backspace clear, and chrome.search fallbacks', async () => {
  sandboxEl.innerHTML = `
    <form id="sform">
      <button id="bbadge" type="button" hidden></button>
      <input id="sinput" type="search" placeholder="Search">
    </form>
  `;
  const form = document.getElementById('sform');
  const input = document.getElementById('sinput');
  const badge = document.getElementById('bbadge');

  const assigned = [];
  const origChrome = window.chrome;

  try {
    const ctrl = new SmartSearchController({
      form,
      input,
      badgeEl: badge,
      navigate: (url) => assigned.push(url)
    });

    input.value = '   !gh react';
    input.dispatchEvent(new Event('input'));
    assertEqual(ctrl.activeBang?.prefix, '!gh', 'Leading spaces before !gh must activate bang');
    assertEqual(input.value, 'react', 'Remaining query text must stay in input');
    assertEqual(badge.hidden, false);

    form.dispatchEvent(new Event('submit', { cancelable: true }));
    assertEqual(assigned[0], 'https://github.com/search?q=react');

    input.value = '';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', cancelable: true }));
    assertEqual(ctrl.activeBang, null);
    assertEqual(badge.hidden, true);

    // Chrome search Promise rejection fallback
    window.chrome = {
      runtime: {},
      search: {
        query: () => Promise.reject(new Error('search failed'))
      }
    };
    input.value = 'koi pond';
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    await Promise.resolve();
    await Promise.resolve();
    assertEqual(assigned[1], 'https://www.google.com/search?q=koi%20pond', 'Rejected Promise must fallback to Google');

    // Chrome runtime.lastError callback fallback
    window.chrome = {
      runtime: { lastError: { message: 'failed' } },
      search: {
        query: (_opts, cb) => cb()
      }
    };
    form.dispatchEvent(new Event('submit', { cancelable: true }));
    assertEqual(assigned[2], 'https://www.google.com/search?q=koi%20pond', 'lastError callback must fallback to Google');
  } finally {
    window.chrome = origChrome;
    sandboxEl.innerHTML = '';
  }
});

test('PomodoroController handles start/pause/reset, session completion sakura shower, and catch-up', () => {
  localStorage.clear();
  sandboxEl.innerHTML = `
    <div id="pwidget">
      <button id="pcollapse"></button>
      <span id="ptime"></span>
      <span id="pstatus"></span>
      <svg><circle id="pring" cx="24" cy="24" r="20"/></svg>
      <button id="pplay"></button>
      <button id="preset"></button>
      <button id="ptest"></button>
      <button class="pmode" data-pomo-mode="focus"></button>
      <button class="pmode" data-pomo-mode="break"></button>
    </div>
  `;
  let showerCount = 0;
  const pomo = new PomodoroController({
    widgetEl: document.getElementById('pwidget'),
    collapseBtn: document.getElementById('pcollapse'),
    timeEl: document.getElementById('ptime'),
    statusEl: document.getElementById('pstatus'),
    ringEl: document.getElementById('pring'),
    playBtn: document.getElementById('pplay'),
    resetBtn: document.getElementById('preset'),
    testBtn: document.getElementById('ptest'),
    modeButtons: Array.from(sandboxEl.querySelectorAll('.pmode')),
    ecosystem: {
      triggerCherryBlossomShower: () => {
        showerCount++;
      }
    },
    baseTitle: 'Test Title'
  });

  pomo.start();
  assertEqual(pomo.running, true);
  assert(pomo.endWallClockMs > Date.now(), 'endWallClockMs should be set in the future');
  pomo.pause();
  assertEqual(pomo.running, false);
  pomo.reset();
  assertEqual(pomo.remainingSec, 25 * 60);

  pomo.completeSession();
  assertEqual(showerCount, 1, 'Completing focus session triggers cherry blossom shower');
  assertEqual(pomo.mode, 'break');

  // Expired wall-clock state catch-up
  localStorage.setItem(
    POMO_STORAGE_KEY,
    JSON.stringify({ mode: 'focus', running: true, endWallClockMs: Date.now() - 5000, remainingSec: 10 })
  );
  pomo.loadState(true);
  assertEqual(showerCount, 2, 'Expired running focus session triggers catch-up cherry blossom shower');
  assertEqual(pomo.running, false);
  pomo.destroy();
  sandboxEl.innerHTML = '';
});

async function runAll() {
  let passed = 0;
  let failed = 0;
  for (const tCase of tests) {
    const li = document.createElement('li');
    try {
      await tCase.fn();
      passed++;
      li.className = 'pass';
      li.textContent = `PASS: ${tCase.name}`;
    } catch (err) {
      failed++;
      li.className = 'fail';
      li.textContent = `FAIL: ${tCase.name} -> ${err?.stack || err}`;
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
  document.title = `UNIT:${failed === 0 ? 'PASS' : 'FAIL'}:${passed}/${passed + failed}`;
}

runAll();
