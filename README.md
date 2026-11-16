# ASCII Koi Pond New Tab

An interactive, zero-dependency **Manifest V3** browser extension that replaces your New Tab page with a luminous, living ASCII Koi pond. Built with HTML5 Canvas, a pre-rendered `OffscreenCanvas` glyph atlas, zero-GC object pools, and daily productivity tools.

**[Download Latest Release](../../releases/latest)**

---

## Features

- **Articulated ASCII Koi & `GlyphAtlas` Rendering:**
  - Each Koi swims with a 12-node articulated spine, sinusoidal tail undulation proportional to speed, and movable pectoral fins rendered onto a crisp `devicePixelRatio`-scaled matrix (`@`, `#`, `%`, `*`, `+`, `:`, `.`).
  - Pre-rendered `OffscreenCanvas` glyph atlas (`glyph-atlas.js`) with dual `glow` and `flat` states—zero `fillText()` or `shadowBlur` calls inside the animation loop.
  - Weighted genetics across classic varieties (*Kohaku*, *Yamabuki Ogon*, *Showa*, *Asagi*) and rare variants (*Tancho* 8%, *Phantom Butterfly* 7% with 45% longer fins and luminous trails).
- **2.5D Water Lilies & Occlusion:**
  - Drifting, gently rotating ASCII lily pads with V-notches, elastic pad-to-pad collisions, and pale pink/white lotus flowers.
  - Broad-phase bounding-circle + narrow-phase per-glyph occlusion dims Koi swimming beneath pads to `22%` alpha without glow.
- **Solar Cycle & Dynamic Weather:**
  - Automatic or manual solar phases (`Auto`, `Day`, `Sunset`, `Night`) with drifting water caustics by day, warm twilight shimmer at sunset, and Brownian green-gold ASCII fireflies at night.
  - Toggleable soft diagonal rain (`|`, `/`, `'`) spawning expanding surface micro-ripples (`( )` -> `(   )`).
- **River Stone Shortcuts:**
  - Bottom dock of organic basalt-style pebbles populated via `chrome.topSites` (with curated defaults if unavailable), native MV3 `/_favicon/` loading with domain-initial fallback, water ripples on hover, and full add/edit/delete customization saved to `localStorage`.
- **Smart Search Bar (Bangs, Direct URLs & Native Search):**
  - Uses `chrome.search.query()` to respect your browser's default search engine (with automatic fallback to Google Search if unavailable).
  - Real-time Bang pills inside the search bar and direct URL navigation (`localhost:3000`, `github.com`, `https://...`).
- **Pomodoro Timer & Cherry Blossom Shower:**
  - Collapsible SVG progress-ring Pomodoro (`25:00` Focus / `05:00` Break) with a `🌸` preview button.
  - Completing a focus session triggers a 25-second cherry blossom shower (`✿`, `❀`, `*`, `~`, `·`) powered by a 90-petal object pool; petals ripple upon landing and attract curious Koi.
- **Performance & Zen Mode:**
  - Smart pause via the Page Visibility API (`visibilitychange`), clamped `deltaTime` (`<= 0.05s`), fixed-size object pools, optional real-time FPS/`ms` telemetry badge, and distraction-free **Zen Mode** (`Z` / `Esc`).

---

## Quick Search Commands (Bangs)

Type a prefix followed by a space at the beginning of the search bar to turn it into a colored search pill. Press `Backspace` on an empty input to remove it.

| Prefix | Platform | Target |
| :--- | :--- | :--- |
| `!gh ` | GitHub | `https://github.com/search?q=` |
| `!yt ` | YouTube | `https://www.youtube.com/results?search_query=` |
| `!r ` | Reddit | `https://www.reddit.com/search/?q=` |
| `!mdn ` | MDN Web Docs | `https://developer.mozilla.org/es/search?q=` |
| `!so ` | StackOverflow | `https://stackoverflow.com/search?q=` |
| `!w ` | Wikipedia | `https://es.wikipedia.org/w/index.php?search=` |

---

## Installation

### Microsoft Edge
1. Download the latest `.zip` archive from **[Releases](../../releases/latest)** and extract it to a permanent folder.
2. Open `edge://extensions` in Microsoft Edge.
3. Enable **Developer mode** (left sidebar or top-right toggle).
4. Click **Load unpacked** and select the extracted folder containing `manifest.json`.
5. Open a new tab. When Edge asks whether you want to keep the New Tab extension, click **"Keep changes"** (*"Conservar los cambios"*).

### Google Chrome / Brave / Vivaldi
1. Download and extract the latest `.zip` archive from **[Releases](../../releases/latest)**.
2. Open `chrome://extensions` (or `brave://extensions` / `vivaldi://extensions`).
3. Enable **Developer mode** in the top-right corner.
4. Click **Load unpacked** and select the extracted folder.
5. Open a new tab to enjoy the pond.

---

## License

Released under the [MIT License](LICENSE).
