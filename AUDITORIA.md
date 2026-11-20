# Auditoría Técnica y Plan de Mejora — ASCII Koi Pond New Tab (`v2.0.0`)

**Fecha de auditoría:** 2026-11-19  
**Versión / Commit auditado:** `v2.0.0` (`f6463e4` en rama `main`, `manifest_version: 3`)  
**Alcance:** Revisión completa de código fuente, manifiesto de extensión, estilos, accesibilidad, seguridad/privacidad, rendimiento/batería, física de simulación, empaquetado de releases y documentación. *(No se modificó ningún archivo fuente existente durante esta auditoría).*

---

## 1. Resumen Ejecutivo y Alcance

**ASCII Koi Pond New Tab** es una extensión de navegador Manifest V3 sin dependencias de terceros ni proceso de compilación, que sustituye la Nueva Pestaña por un ecosistema acuático procedural renderizado en arte ASCII mediante `HTML5 Canvas` y un atlas pre-renderizado (`OffscreenCanvas`), junto con herramientas de productividad (*Piedras de Río*, buscador inteligente con *bangs* y temporizador Pomodoro).

La base del proyecto es creativa y muestra decisiones técnicas acertadas para su escala actual, pero presenta **3 riesgos críticos** que afectan la fidelidad visual en monitores HiDPI fraccionarios (como el 125% predeterminado en Windows), la validación de URLs persistidas y la privacidad declarada frente a tiendas de extensiones, además de **10 riesgos altos** y **13 hallazgos medios/bajos** en rendimiento CPU/GPU, precisión física a altas tasas de refresco (>60 Hz), accesibilidad (WCAG 2.1), arquitectura monolítica y ausencia de pruebas automatizadas.

### Inventario del Proyecto Auditado

| Archivo | Líneas | Tamaño | Rol |
| :--- | ---: | ---: | :--- |
| [`koi-engine.js`](koi-engine.js) | 1,977 | 69,332 B | Motor de simulación, clases de especies, *boids*, cardumen y bucle principal |
| [`styles.css`](styles.css) | 1,516 | 31,399 B | Temas solares, *glassmorphism*, barra superior, dock, modal, Pomodoro y responsive |
| [`ecosystem.js`](ecosystem.js) | 1,232 | 41,681 B | Ciclo solar, cáusticas, nenúfares/loto, lluvia, pétalos sakura, luciérnagas y mar abierto |
| [`productivity.js`](productivity.js) | 671 | 20,725 B | Piedras de Río (`topSites` + `localStorage`), buscador/bangs y Pomodoro |
| [`ui.js`](ui.js) | 663 | 22,626 B | Orquestación DOM, preferencias, Modo Zen, reloj y eventos globales |
| [`index.html`](index.html) | 347 | 18,144 B | Estructura HTML de Nueva Pestaña, popover de fauna, modal y Pomodoro |
| [`glyph-atlas.js`](glyph-atlas.js) | 197 | 5,553 B | Pre-renderizado de glifos (`22` caracteres × `2` estados × `69` colores) |
| [`README.md`](README.md) | 94 | 6,129 B | Documentación de usuario en español y capturas |
| [`LICENSE`](LICENSE) | 21 | 1,084 B | Licencia MIT |
| [`manifest.json`](manifest.json) | 15 | 532 B | Manifiesto Manifest V3 (`permissions`: `topSites`, `search`, `favicon`) |
| **Total código/docs** | **6,733** | **217,735 B** | **4,740 líneas JS** · 1,516 CSS · 347 HTML · 130 config/docs |

> **Activos adicionales inspeccionados:** 3 iconos PNG (`icons/icon16.png` 16×16, `icon48.png` 48×48, `icon128.png` 128×128), 6 capturas en [`docs/`](docs/) (`1024×640`), y 3 archivos locales `.zip` (`v1.0.0`, `v1.1.0`, `v2.0.0`).

### Resumen de Hallazgos por Severidad y Eje

| Severidad | Cantidad | IDs | Ejes Principales |
| :--- | :---: | :--- | :--- |
| **Crítico** | 3 | `C-01` – `C-03` | Renderizado HiDPI fraccionario, validación de URLs/esquemas, fuga de privacidad |
| **Alto** | 10 | `A-01` – `A-10` | Correctitud buscador, cuello de botella CPU/VRAM/GPU, Pomodoro, encapsulación, WCAG, monolitos, testing/CI |
| **Medio** | 6 | `M-01` – `M-06` | Bugs funcionales, física dependiente de FPS, trabajo redundante, MV3 hardening, UX/ARIA/responsive, acoplamiento/i18n |
| **Bajo / Mejora** | 7 | `B-01` – `B-07` | FOUC inicial, CSS inefectivo, código muerto, overdraw, ergonomía de búsqueda/CSS, docs |

### Fortalezas Actuales del Proyecto

- **Cero dependencias externas en tiempo de ejecución:** Todo el motor, UI y gráficos corren de forma autónoma sin frameworks ni CDNs de scripts.
- **Uso de `OffscreenCanvas` y `Object Pooling`:** Evita llamar a `fillText()` y `shadowBlur` en cada frame y pre-asigna la mayoría de partículas (`rainPool`, `rainRipplePool`, `petalPool`, `planktonPool`, `bubblePool`, `foodPool`, `ripplePool`, `trailPool`, `baitPool`).
- **Ahorro en segundo plano:** Pausa el bucle `requestAnimationFrame` mediante `visibilitychange` ([`koi-engine.js`](koi-engine.js#L1340-L1357)) y acota `dt <= 0.05s` ([`koi-engine.js`](koi-engine.js#L1657)) para evitar saltos tras suspender o cambiar de pestaña.
- **Prevención base de XSS en datos del usuario:** El renderizado de Piedras de Río construye nodos DOM con `document.createElement` y `textContent` ([`productivity.js`](productivity.js#L284-L398)) en lugar de interpolar HTML con `innerHTML`.
- **Superficie de permisos acotada:** `manifest.json` solicita únicamente `topSites`, `search` y `favicon`, sin `host_permissions` amplios ni `tabs`.

---

## 2. Riesgos Críticos (Prioridad Inmediata)

### `C-01` · Desalineación acumulativa en `GlyphAtlas` con DPR fraccionarios (Windows 125%, 175%, 225% y zoom 110%/133%)
- **Ubicación:** [`glyph-atlas.js`](glyph-atlas.js#L129-L193) (`buildAtlas()` líneas 129–177 y `drawGlyph()` líneas 180–193).
- **Causa raíz:**  
  `buildAtlas()` calcula el tamaño físico entero de celda con `Math.ceil`:
  ```js
  const cellPx = Math.ceil(this.cellLogical * this.dpr); // línea 129
  ```
  Sin embargo, inmediatamente aplica `actx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)` (línea 145) y dibuja los caracteres usando coordenadas lógicas sin ajustar al `Math.ceil`:
  - `cy = r * 22 + 11` (línea 156) → posición física real `r * (22 * dpr) + 11 * dpr`.
  - `cxFlat = c * 22 + 11` (línea 163) y `cxGlow = (c + 22) * 22 + 11` (línea 172).
  
  Luego, `drawGlyph()` recorta el atlas usando múltiplos exactos de `cellPx` (`sx = col * cellPx`, `sy = rIdx * cellPx`, líneas 186–188). Cuando `22 * dpr` no es entero, cada fila y columna acumula un error de `(Math.ceil(22 * dpr) - 22 * dpr)` píxeles físicos respecto al recorte.
- **Impacto cuantificado:**  
  Con `22` caracteres (`44` columnas: `0..43`) y `69` colores (`filas 0..68`):

  | `dpr` | Escala / Zoom típico | `22 × dpr` exacto | `cellPx` (`ceil`) | Deriva / celda | Deriva fila `68` (`kelpTip`) | Deriva col `43` (`°` glow) | Dimensiones Atlas (px) | VRAM aprox. (RGBA) |
  | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
  | `1.0` | Monitor 100% | `22.00` | `22` | `0.00 px` | `0.0 px` | `0.0 px` | `968 × 1518` | `5.61 MB` |
  | `1.1` | Zoom navegador 110% | `24.20` | `25` | `0.80 px` | **`54.4 px`** (~2.2 celdas) | **`34.4 px`** (>1.3 celdas) | `1100 × 1725` | `7.24 MB` |
  | `1.25` | **Windows 125% (común en laptops)** | `27.50` | `28` | `0.50 px` | **`34.0 px`** (>1.2 celdas) | **`21.5 px`** | `1232 × 1932` | `9.08 MB` |
  | `1.333` | Zoom navegador 133% | `29.33` | `30` | `0.67 px` | **`45.8 px`** (>1.5 celdas) | **`29.0 px`** | `1320 × 2070` | `10.42 MB` |
  | `1.5` | Windows 150% | `33.00` | `33` | `0.00 px` | `0.0 px` | `0.0 px` | `1452 × 2277` | `12.61 MB` |
  | `1.75` | Windows 175% | `38.50` | `39` | `0.50 px` | **`34.0 px`** | **`21.5 px`** | `1716 × 2691` | `17.62 MB` |
  | `2.0` | Retina / 4K 200% | `44.00` | `44` | `0.00 px` | `0.0 px` | `0.0 px` | `1936 × 3036` | `22.42 MB` |
  | `2.25` | Windows 225% | `49.50` | `50` | `0.50 px` | **`34.0 px`** | **`21.5 px`** | `2200 × 3450` | `28.95 MB` |
  | `2.5` | Tope `Math.min(dpr, 2.5)` | `55.00` | `55` | `0.00 px` | `0.0 px` | `0.0 px` | `2420 × 3795` | `35.03 MB` |

  En `dpr=1.25` (y `1.1`, `1.333`, `1.75`, `2.25`), los colores y glifos de la mitad inferior y derecha del atlas (especialmente fauna marina nueva como tortugas, tiburones, plancton, burbujas, medusas y algas en filas `44..68`, y caracteres `~`, `·`, `✿`, `❀`, `≈`, `>`, `<`, `°`) se recortan desplazados, cortando caracteres a la mitad o tomando el color de la fila siguiente/anterior.
- **Remedio recomendado:**  
  Calcular el paso lógico real correspondiente a `cellPx`:
  ```js
  const cellPx = Math.ceil(this.cellLogical * this.dpr);
  const cellStepLogical = cellPx / this.dpr;
  ```
  Posicionar los centros al dibujar en `buildAtlas()` en `(c + 0.5) * cellStepLogical` y `(r + 0.5) * cellStepLogical`, y en `drawGlyph()` dibujar con `size = cellStepLogical * scale`. Así cada celda del atlas coincide exactamente con `col * cellPx` y `rIdx * cellPx` sin sangrado subpíxel para cualquier DPR.

---

### `C-02` · Falta de validación estricta de URLs y esquemas en "Piedras de Río"
- **Ubicación:** [`productivity.js`](productivity.js#L66-L74) (`normalizeUrl`), [`productivity.js`](productivity.js#L170-L196) (`modalForm` submit), [`productivity.js`](productivity.js#L209-L219) (`loadSavedStones`), [`productivity.js`](productivity.js#L290) (`link.href = stone.url`), [`index.html`](index.html#L322) (`#stone-url-input`).
- **Causa raíz:**
  1. `loadSavedStones()` únicamente filtra con `item && item.url`, sin comprobar que `item.url` sea `string` ni restringir el esquema a `http:` / `https:`. Cualquier dato manipulado o importado/corrupto en `localStorage` con `javascript:alert(...)`, `data:text/html,...`, `file://`, `chrome://` o `blob:` se asigna directamente a `<a href="...">` en el DOM (línea 290).
  2. `normalizeUrl()` (líneas 66–74) usa heurísticas con `RegExp` pero **nunca valida con `new URL()`**, permitiendo guardar cadenas inválidas con espacios (`"mi sitio web"` → `"https://mi sitio web"`), caracteres de control, credenciales embebidas (`https://user:pass@host`) o puertos malformados.
  3. `#stone-url-input` (`type="text"`) carece de `maxlength` y el submit retorna en silencio (`if (!url) return;`, línea 174) sin mostrar retroalimentación de error al usuario.
- **Impacto:** Riesgo de ejecución/navegación a esquemas peligrosos desde almacenamiento persistente o entradas engañosas, enlaces rotos guardados sin aviso y degradación silenciosa del dock.
- **Remedio recomendado:**
  - Implementar un validador único `sanitizeHttpUrl(rawUrl)`:
    - Rechazar cadenas vacías o con espacios/caracteres de control.
    - Aplicar prefijo `http://` (solo para `localhost`, `127.0.0.1`, `0.0.0.0`, `[::1]`) o `https://` si falta esquema.
    - Parsear con `new URL(candidate)`, exigir `parsed.protocol === 'http:' || parsed.protocol === 'https:'`, `parsed.hostname` no vacío y ausencia de `username`/`password` embebidos.
  - Aplicar `sanitizeHttpUrl()` tanto en `modalForm` (mostrando error con `setCustomValidity()` / `reportValidity()`) como al hidratar entradas en `loadSavedStones()`.
  - Agregar `maxlength="2048"` a `#stone-url-input`.

---

### `C-03` · Fuga de privacidad no declarada de dominios visitados hacia Google (`www.google.com/s2/favicons`)
- **Ubicación:** [`productivity.js`](productivity.js#L327-L358) vs [`README.md`](README.md#L3) (*"sin dependencias externas"*) y [`README.md`](README.md#L47).
- **Causa raíz:**  
  Si `/_favicon/` devuelve error o `naturalWidth === 0` (por ejemplo, si el usuario aún no tiene favicon cacheado en el perfil o en entornos fuera de Chrome), `handleImgError` dispara automáticamente:
  ```js
  img.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=64`;
  ```
  Esto transmite los nombres de dominio provenientes de `chrome.topSites` (incluidos portales corporativos, intranets locales, paneles de administración o dominios sensibles de desarrollo) a servidores de Google sin consentimiento ni aviso al usuario.
- **Impacto:**
  - Contradice la declaración explícita de *"sin dependencias externas"* en `README.md`.
  - En Chrome Web Store y Microsoft Edge Add-ons, el uso de `topSites` combinado con transmisión de hostnames a un endpoint remoto puede desencadenar rechazo en revisión o exigir declaración de privacidad y divulgación prominente de transferencia de historial/navegación.
- **Remedio recomendado:**
  - Eliminar el fallback remoto a `www.google.com/s2/favicons` y pasar directamente al fallback local de inicial circular (`showInitialFallback()`, líneas 310–318), que ya existe, funciona offline y respeta la privacidad.
  - Si se quisiera mantener un servicio remoto opcional, desactivarlo por defecto bajo una preferencia explícita (*opt-in*) y documentarlo en `PRIVACY.md` y `README.md`.

---

## 3. Riesgos Altos

### `A-01` · Falsos positivos masivos en `resolveDirectUrl()` con búsquedas técnicas y de código
- **Ubicación:** [`productivity.js`](productivity.js#L95-L109).
- **Causa raíz:** La expresión regular `/^[a-z0-9-]+(\.[a-z0-9-]+)+(:\d+)?(\/\S*)?$/i` clasifica cualquier cadena sin espacios que contenga un punto como URL navegable directa.
- **Impacto:** Al tratarse de una extensión orientada a desarrolladores (con bangs `!gh`, `!mdn`, `!so`), consultas comunes como `console.log`, `node.js`, `styles.css`, `package.json`, `v2.0.0`, `1.2.3`, `React.useEffect` o `foo.bar` redirigen al navegador a `https://console.log`, `https://styles.css`, etc., en lugar de ejecutar la búsqueda en el motor predeterminado. Tampoco reconoce direcciones IPv6 como `[::1]:3000`.
- **Remedio recomendado:** Requerir al menos una de las siguientes señales para navegar directamente: (a) protocolo explícito `https?://`, (b) `localhost` o IPv4/IPv6 válida, (c) puerto explícito o ruta (`host:port` / `host/path`) con TLD alfabético ≥2 caracteres que no coincida con extensiones de archivo comunes (`.js`, `.ts`, `.css`, `.json`, `.py`, `.md`, etc.) cuando no haya esquema ni `/`, o (d) validar el TLD final contra la lista real o heurística estricta (`/[a-z]{2,24}$/i` excluyendo extensiones técnicas sin ruta).

### `A-02` · Cuello de botella CPU en rasterizado ASCII (`AquaticCreature.render`, `isOccludedInList` y `renderLilyPad`)
- **Ubicación:** [`koi-engine.js`](koi-engine.js#L445-L546) (`AquaticCreature.render`), [`ecosystem.js`](ecosystem.js#L600-L619) (`isOccludedInList`), [`ecosystem.js`](ecosystem.js#L1128-L1191) (`renderLilyPad`).
- **Causa raíz y métricas:**
  1. **Sin clipping al viewport ni rechazo temprano en `AquaticCreature.render()`:** Itera toda la caja delimitadora `[startCol..endCol] × [startRow..endRow]` incluso si parte del animal está fuera de pantalla. Un `WhaleShark` grande (`totalLength` hasta ~`325 px`, `bboxPad` hasta ~`127 px`, `14` segmentos) abarca una caja de ~`2,000` a ~`3,200+` celdas (`CELL_W = 8.5`, `CELL_H = 11.5`), realizando entre **~28,000 y ~45,000 evaluaciones punto-segmento por frame** (con `16–25` criaturas mixtas o múltiples tiburones, fácilmente **200,000–350,000+ iteraciones/frame**).
  2. **`Math.sqrt(dSq)` dentro del bucle interno de segmentos** ([`koi-engine.js`](koi-engine.js#L524)): se llama cada vez que se encuentra una distancia menor en lugar de guardar `bestCrossSign` y calcular una única raíz cuadrada al terminar los `14` segmentos.
  3. **Recálculo trigonométrico por celda en oclusión** ([`ecosystem.js`](ecosystem.js#L608-L609)): `isOccludedInList()` ejecuta `Math.cos(-l.angle)` y `Math.sin(-l.angle)` en cada celda de pez cercana a un nenúfar, cuando `l.angle` es constante durante todo el frame.
  4. **Re-rasterización total de nenúfares cada frame** ([`ecosystem.js`](ecosystem.js#L1128-L1191)): cada nenúfar ejecuta `Math.atan2`, `Math.sqrt` y `Math.sin` por cada celda de su diámetro en todos los frames pese a que su geometría es rígida (solo rota y traslada).
- **Remedio recomendado:**
  - Acotar `startCol..endCol` y `startRow..endRow` al rango visible `[0..ceil(width/CELL_W)]` y `[0..ceil(height/CELL_H)]`.
  - Calcular `Math.sqrt(bestDistSq)` una sola vez después del bucle `for (i = 0; i < segCount; i++)`, y descartar pronto si `bestDistSq > maxPossibleRadiusSq`.
  - Precalcular `l.cosNegAngle` y `l.sinNegAngle` al final de `updateLilies()`.
  - Cachear la cuadrícula rasterizada o sprite `OffscreenCanvas` de cada nenúfar en `initLilies()` (o re-rasterizar solo cada ~2–3° de rotación) para reemplazar ~`1,000` `drawGlyph` + `atan2` por un único `ctx.drawImage` rotado (o cuadrícula precomputada).

### `A-03` · Consumo elevado de VRAM y bloqueo inicial del hilo principal en `GlyphAtlas`
- **Ubicación:** [`glyph-atlas.js`](glyph-atlas.js#L126-L178).
- **Causa raíz:** Cada pestaña nueva construye de forma síncrona y anticipada (*eager*) todo el producto cartesiano de `22` caracteres × `2` estados (`flat` y `glow`) × `69` colores = **`3,036` celdas**, de las cuales **`1,518` ejecutan `shadowBlur = 5.5`** sobre `OffscreenCanvas` al abrir `index.html`.
- **Impacto cuantificado:**
  - En `dpr=2`, cada pestaña nueva asigna un atlas de `1936 × 3036` px (**`22.42 MB` de VRAM**); en `dpr=2.5`, **`35.03 MB`**, además del canvas principal fullscreen (`3840 × 2160 × 4 B ≈ 31.6 MB` en pantalla Full HD a DPR 2). Con varias pestañas nuevas abiertas en el navegador, el consumo pasivo de memoria gráfica escala rápidamente a cientos de MB.
  - Si un usuario abre Nueva Pestaña solo en modo *Estanque + Koi*, más del 60% del atlas (colores de mar abierto, tortugas, tiburones, etc.) jamás se utiliza.
- **Remedio recomendado:** Cambiar a un **atlas perezoso (*on-demand*)** con empaquetado por índice en caché (`Map` o tabla plana `(char, colorKey, glow) -> slotIndex`): rasterizar cada combinación únicamente la primera vez que `drawGlyph()` la solicita, reservando un atlas compacto que crece por bloques o mantiene ~256–512 slots activos. Esto reduce la latencia inicial de `DOMContentLoaded` y ahorra >75–85% de VRAM en escenarios normales.

### `A-04` · Sobrecarga GPU/batería por múltiples `backdrop-filter: blur()` sobre canvas transparente a 60 FPS y falta de `prefers-reduced-motion`
- **Ubicación:** [`styles.css`](styles.css#L153) (y líneas `430`, `552`, `589`, `625`, `767`, `895`, `927`, `1026`, `1267`), [`koi-engine.js`](koi-engine.js#L1227) (`getContext('2d', { alpha: true })`), [`koi-engine.js`](koi-engine.js#L1654-L1678).
- **Causa raíz:**
  1. Existen **10 reglas CSS** con `backdrop-filter: blur(6px..18px)` que en operación normal mantienen **~11 a 14 superficies simultáneas** con desenfoque en tiempo real (`.control-pill`, `.search-form`, `.pomodoro-widget`, hasta `8` `.river-stone`, `2` `.stone-ctrl-btn`, más `.perf-badge` / `.fauna-popover` opcionales) sobre un canvas que se repinta a **60–144 FPS**.
  2. El canvas usa `{ alpha: true }` sobre un gradiente CSS radial en `body`, forzando composición *alpha-blending* de pantalla completa cada frame.
  3. No existe ninguna media query `@media (prefers-reduced-motion: reduce)` ni selector de límite de FPS / modo ahorro de batería.
- **Impacto:** Alto uso de GPU integrada y mayor drenaje de batería en portátiles cuando se deja una pestaña nueva abierta, además de potencial mareo o incomodidad para usuarios con sensibilidad al movimiento.
- **Remedio recomendado:**
  - Respetar `@media (prefers-reduced-motion: reduce)` y `window.matchMedia('(prefers-reduced-motion: reduce)')` reduciendo/pausando animaciones ambientales y desactivando transiciones bruscas.
  - Consolidar el `backdrop-filter` de las piedras en un único contenedor `.river-stones-dock` (o limitar el blur solo en hover/paneles principales) y añadir un toggle de **Modo Eco** (30 FPS + sin `backdrop-filter`).
  - Evaluar dibujar el gradiente de fondo en una capa cacheada dentro del canvas con `{ alpha: false }` para evitar composición alfa por frame contra el compositor CSS.

### `A-05` · Desbordamiento silencioso de `_intersectingLilies` (`Uint8Array(16)`) con riesgo de `TypeError` fatal
- **Ubicación:** [`koi-engine.js`](koi-engine.js#L166), [`ecosystem.js`](ecosystem.js#L584-L619).
- **Causa raíz:** `AquaticCreature` reserva `this._intersectingLilies = new Uint8Array(16)`. En `testCircleIntersectsLilies()` (`ecosystem.js:593`), cada intersección escribe `outIndices[hitCount++] = i` **sin verificar `hitCount < outIndices.length`**. En un `Uint8Array`, escribir en el índice `16+` se descarta silenciosamente (no asigna propiedad), pero `hitCount` sigue incrementándose; luego `isOccludedInList()` (`ecosystem.js:601-602`) lee `this.lilies[indices[i]]` donde `indices[16]` es `undefined`, provocando `TypeError: Cannot read properties of undefined (reading 'x')` dentro del bucle `requestAnimationFrame`.
- **Impacto:** Aunque hoy `initLilies()` genera entre 4 y 7 nenúfares (`ecosystem.js:302`), cualquier futura expansión, preset o parámetro que eleve los nenúfares a >16 rompería todo el motor de renderizado sin recuperación.
- **Remedio recomendado:** Guardar `if (hitCount < outIndices.length)` en `testCircleIntersectsLilies()` o dimensionar el buffer dinámicamente a `Math.max(16, ecosystem.lilies.length)`.

### `A-06` · Limitaciones funcionales en `PomodoroController` (sin persistencia, `performance.now()`, sin `destroy()` y estado sobreescrito)
- **Ubicación:** [`productivity.js`](productivity.js#L505-L666).
- **Causa raíz:**
  1. El temporizador calcula `this.endTimeMs = performance.now() + this.remainingSec * 1000` (línea 592) y vive solo en memoria de la pestaña actual. `performance.now()` no persiste al recargar ni al abrir otra Nueva Pestaña, y en algunos sistemas operativos puede pausarse durante la suspensión del equipo.
  2. No existe método `destroy()` para limpiar `this.timerId = setInterval(...)` (línea 596).
  3. Cuando el temporizador completa en segundo plano o estando minimizado, no actualiza `document.title` ni dispara sonido opcional o notificación visual persistente.
  4. Al hacer clic en el botón de previsualización `🌸` (`#pomo-test-btn`, líneas 558–563), sobrescribe `this.statusEl.textContent = 'Pétalos de cerezo 🌸'` sin restaurarlo nunca, borrando `'Enfoque activo'` o `'En pausa'` si había una sesión en curso.
- **Impacto:** Como la Nueva Pestaña suele usarse como punto de partida antes de navegar a otro sitio, un Pomodoro que no persiste ni sincroniza entre pestañas pierde casi toda su utilidad real.
- **Remedio recomendado:**
  - Persistir `{ mode, running, endWallClockMs, remainingSec }` en `localStorage` (usando `Date.now()` para tiempo absoluto) y escuchar el evento `window.addEventListener('storage', ...)` para sincronizar automáticamente todas las pestañas nuevas abiertas.
  - Actualizar `document.title` mientras corre el temporizador (ej. `24:59 · Enfoque — Estanque Koi`).
  - Añadir `destroy()` para limpiar el intervalo y evitar sobrescribir `statusEl` permanentemente con el botón `🌸` (restaurar el estado previo tras unos segundos o solo mostrarlo si está inactivo).

### `A-07` · Violación de encapsulación al cerrar `#stone-modal` con `Escape`
- **Ubicación:** [`ui.js`](ui.js#L452) y [`ui.js`](ui.js#L648-L651) vs [`productivity.js`](productivity.js#L270-L273).
- **Causa raíz:** En `ui.js:452`, `new window.RiverStonesManager(...)` se instancia sin guardar referencia en una variable. Al pulsar `Escape` (`ui.js:649`), el manejador global hace directamente `stoneModal.hidden = true` en lugar de llamar a `riverStones.closeModal()`.
- **Impacto:** `this.editingId` en `RiverStonesManager` queda sin restablecer a `null` si se cerró un diálogo de edición con `Escape`, además de impedir centralizar la devolución del foco al botón que abrió el modal.
- **Remedio recomendado:** Guardar `const riverStones = new window.RiverStonesManager(...)` en `ui.js` y delegar el cierre en `Escape` a `riverStones.closeModal()`.

### `A-08` · Brechas importantes de Accesibilidad (WCAG 2.1 / 2.2)
- **Ubicación:** [`styles.css`](styles.css#L205) (`#L468`, `#L969`), [`index.html`](index.html#L143) (`#L226`, `#L313`), [`productivity.js`](productivity.js#L261-L273) (`#L485-L499`), [`ui.js`](ui.js#L409-L424).
- **Causa raíz:**
  1. **Eliminación de foco visible:** `.range-slider` (línea 205), `.search-input` (línea 468) y `.stone-field input` (línea 969) declaran `outline: none`, y la mayoría de botones (`.solar-btn`, `.biome-btn`, `.icon-btn`, `.river-stone`, `.species-card`, `.env-chip`) carecen de estilos `:focus-visible` nítidos.
  2. **Control interactivo no semántico:** `#bang-badge` ([`index.html`](index.html#L226)) es un `<span hidden>` con listener `click` ([`productivity.js`](productivity.js#L441)); los usuarios de teclado y lectores de pantalla no pueden activarlo ni identificarlo como botón para quitar el bang.
  3. **Gestión de foco en diálogos y popovers:** `#stone-modal` tiene `role="dialog" aria-modal="true"` ([`index.html`](index.html#L313)), pero no implementa *focus trap* (el `Tab` escapa al fondo oculto) ni restaura el foco al disparador al cerrarse. Lo mismo ocurre con `#fauna-popover` (no enfoca su contenido al abrir ni devuelve el foco a `#fauna-btn` al cerrar con `Esc`).
  4. **Elementos alcanzables en Modo Zen:** En Modo Zen ([`styles.css`](styles.css#L524-L538), `730–735`, `1032–1037`), `.top-bar`, `.center-stage`, `.river-stones-dock` y `.pomodoro-widget` solo usan `opacity: 0; pointer-events: none;`, por lo que **siguen activos en el orden de tabulación (`Tab`) y visibles para lectores de pantalla**.
- **Remedio recomendado:**
  - Añadir reglas `:focus-visible` de alto contraste (`outline: 2px solid var(--accent); outline-offset: 2px;`) en todos los controles y eliminar `outline: none` sin alternativa visible.
  - Convertir `#bang-badge` en `<button type="button">` con `aria-label="Quitar prefijo de búsqueda ..."`.
  - Usar el atributo nativo `inert` (soportado ampliamente en Chromium moderno) en los paneles ocultos durante el Modo Zen y debajo de `#stone-modal`, además de implementar *focus trap* y retorno de foco al elemento previo.

### `A-09` · Arquitectura monolítica, espacio global contaminado y duplicación de `ObjectPool`
- **Ubicación:** [`koi-engine.js`](koi-engine.js) (`1,977` líneas), [`styles.css`](styles.css) (`1,516` líneas), [`ecosystem.js`](ecosystem.js) (`1,232` líneas), [`productivity.js`](productivity.js) (`671` líneas), [`ui.js`](ui.js) (`663` líneas), [`index.html`](index.html#L8-L12).
- **Causa raíz:**
  1. Tres archivos superan el umbral saludable de ~1,000 líneas (`koi-engine.js` casi lo duplica con `1,977`), mezclando física de *boids*, geometría de 4 especies, cardumen, renderizador ASCII, métricas FPS y manejo de puntero en un solo archivo.
  2. La comunicación entre los 5 scripts depende del orden estricto de `<script defer>` en `index.html` y contamina el objeto global (`window.GlyphAtlas`, `window.PondEcosystem`, `window.KoiPondEngine`, `window.RiverStonesManager`, `window.SmartSearchController`, `window.PomodoroController`).
  3. **Duplicación estructural:**
     - **7 bucles casi idénticos de búsqueda de slot libre en pool circular** copiados y pegados: 4 en `ecosystem.js` (`spawnPlankton`, `spawnBubble`, `spawnRainRipple`, `spawnFallingPetal`) y 3 en `koi-engine.js` (`activateFoodSlot`, `spawnRipple`, `spawnTrailGlyph`).
     - Funciones y constantes duplicadas entre `koi-engine.js` y `ecosystem.js`: `CELL_W = 8.5`, `CELL_H = 11.5`, `clamp()`, `randRange()`, y normalización angular (`lerpAngle` vs `angleDiff`).
- **Remedio recomendado:** Migrar a **ES Modules nativos** (`<script type="module" src="src/main.js"></script>`), que no requieren bundler ni dependencias en Manifest V3, junto con una clase genérica `ObjectPool` y módulos enfocados (ver Sección 6).

### `A-10` · Ausencia total de pruebas automatizadas, linting, CI/CD y empaquetado reproducible
- **Ubicación:** Todo el repositorio y archivos comprimidos locales (`ascii-koi-pond-v1.0.0.zip`, `v1.1.0.zip`, `v2.0.0.zip`).
- **Evidencia observada:**
  - No existe ningún framework ni script de pruebas (unitarias o E2E), ni configuración de `ESLint` / `Stylelint` / `HTMLHint`, ni workflows en `.github/workflows/`.
  - **Incidente real verificado en los `.zip` locales:** Al inspeccionar las entradas de los paquetes en este entorno Windows, `ascii-koi-pond-v1.0.0.zip` y `ascii-koi-pond-v1.1.0.zip` contienen rutas con barra invertida de Windows (`icons\icon128.png`, `icons\icon16.png`, `icons\icon48.png`), las cuales fallan o generan archivos literales con `\` en extractores POSIX (macOS/Linux) y validadores de Chrome Web Store. Aunque en `ascii-koi-pond-v2.0.0.zip` se corrigió a `icons/icon128.png`, no existe script versionado que prevenga la regresión en el próximo release ni que verifique que los `.zip` locales coincidan con `git archive` (sin archivos basura).
- **Remedio recomendado:**
  - Añadir suite ligera de pruebas (p. ej. `node --test` o test runner sin dependencias en CI) cubriendo matemáticas de `GlyphAtlas` (varios DPR), `sanitizeHttpUrl()`, `resolveDirectUrl()`, `BANGS`, `loadPrefs()`, `computeSpeciesTargets()` y `ObjectPool`.
  - Añadir `scripts/package.ps1` / `Makefile` y GitHub Actions que validen `manifest.json`, lint, tests y generen el `.zip` con rutas POSIX (`/`) excluyendo `docs/`, `*.zip` y `.git`.

---

## 4. Riesgos Medios

### `M-01` · Bugs funcionales activos en controles, clima y Dock
1. **Color de lluvia incorrecto en atardecer ([`ecosystem.js`](ecosystem.js#L36)):** `SOLAR_KEYS.sunset` define `rainKey: 'rainNight'` en lugar de `'rainSunset'`, dejando sin efecto el color `#f8c8e0` definido específicamente en [`glyph-atlas.js`](glyph-atlas.js#L46).
2. **`Ctrl+Z` / `Cmd+Z` activa Modo Zen por error ([`ui.js`](ui.js#L658)):** El atajo `if (!isTyping && (e.key === 'z' || e.key === 'Z'))` no comprueba `!e.ctrlKey && !e.metaKey && !e.altKey`. Pulsar `Ctrl+Z` fuera de un input activa o desactiva el Modo Zen accidentalmente.
3. **Imposibilidad de dejar 0 Piedras de Río ([`productivity.js`](productivity.js#L201)):** `if (saved && saved.length > 0)` trata un array vacío `[]` (cuando el usuario elimina todos sus accesos directos) como si no hubiera datos guardados, restaurando automáticamente `topSites` o `DEFAULT_STONES` en la siguiente pestaña. Debe comprobar `if (Array.isArray(saved))` (distinguiendo `null` de `[]`).
4. **Botón "Restaurar" destructivo sin confirmación ([`index.html`](index.html#L325), [`productivity.js`](productivity.js#L159-L168)):** Dentro del modal de creación/edición de una sola piedra existe un botón `#stone-reset-btn` ("Restaurar") que borra inmediatamente `localStorage` y destruye todas las piedras personalizadas del usuario sin confirmación previa ni relación con el formulario individual. Conviene moverlo al modo edición del dock o exigir confirmación.

### `M-02` · Física dependiente del framerate (`dt`), `resize()` incompleto y colisiones con brechas
1. **Amortiguamiento no independiente de la tasa de refresco:** Múltiples velocidades usan factores multiplicativos fijos por frame en lugar de escalarlos con `dt`:
   - [`ecosystem.js`](ecosystem.js#L649-L650): `f.vx *= 0.975; f.vy *= 0.975;` (luciérnagas)
   - [`ecosystem.js`](ecosystem.js#L744-L745): `p.vx *= 0.992; p.vy *= 0.992;` (pétalos)
   - [`ecosystem.js`](ecosystem.js#L788-L789): `j.vx = j.vx * 0.95 + ...` (medusas)
   - [`ecosystem.js`](ecosystem.js#L818-L819): `pl.vx *= 0.94; pl.vy *= 0.94;` (plancton)
   - [`ecosystem.js`](ecosystem.js#L848-L849): `l.vx *= 0.99; l.vy *= 0.99;` (nenúfares)
   - [`koi-engine.js`](koi-engine.js#L1707-L1708): `p.vx *= 0.96;` (estelas) y líneas `1719–1720`: `f.vx *= 0.97;` (comida).  
   En monitores de **120 Hz / 144 Hz / 240 Hz**, la fricción ocurre 2×–4× más rápido por segundo que a 60 Hz. **Remedio:** reemplazar `v *= f` por `v *= Math.pow(f, dt * 60)` o `v *= Math.exp(-k * dt)`.
2. **`resize()` sin debounce, sin detección dinámica de cambio de DPR y reubicación parcial:**
   - [`koi-engine.js`](koi-engine.js#L1359-L1377) y [`ecosystem.js`](ecosystem.js#L264-L278) reconstruyen causticas, corrientes, algas, lluvia y canvas en cada evento `resize` continuo al arrastrar la ventana.
   - Si el usuario arrastra la ventana a un monitor secundario con distinto DPR sin redimensionar el viewport lógico (o cambia el zoom del navegador), no hay listener sobre `matchMedia('(resolution: ...)')` que llame a `resize()`/`ensureDpr()`.
   - `resize()` no acota las posiciones de peces, medusas, luciérnagas, cardumen ni `targetY` de pétalos cayendo; además en viewports estrechos (`width < 140`), `randRange(70, Math.max(140, width - 70))` ([`koi-engine.js`](koi-engine.js#L137-L138)) coloca criaturas fuera de la pantalla.
3. **Orden de resolución de colisiones en `updateLilies()` ([`ecosystem.js`](ecosystem.js#L838-L932)):** Primero resuelve bordes y `obstacleRect`, y *después* resuelve colisiones nenúfar–nenúfar, por lo que dos nenúfares pueden empujarse mutuamente encima del buscador central o fuera de la pantalla. Tampoco evitan `stonesRect`.
4. **Medusas ignoran `obstacleRect` y omiten `j.scale`:** El comentario en [`ecosystem.js`](ecosystem.js#L781) indica *"away from central search box"*, pero el código nunca comprueba `this.obstacleRect`; en `renderSingleJellyfish` ([`ecosystem.js`](ecosystem.js#L1036-L1037)) los glifos `*` del borde omiten `* j.scale` en `+ cos * 4` / `+ sin * 4`.

### `M-03` · Trabajo redundante en el bucle de animación y en el arranque
1. **Instanciación de `new Date()` 60–144 veces por segundo:** En [`ecosystem.js`](ecosystem.js#L623-L625), cuando `timeMode === 'auto'`, `update()` llama a `resolveSolarPhase()` cada frame creando un objeto `Date` nuevo; basta comprobarlo cada 15–30 s o cuando `ui.js` actualiza el reloj.
2. **Ordenamiento innecesario por frame:** [`koi-engine.js`](koi-engine.js#L1755) ejecuta `this.kois.sort((a, b) => a.depth - b.depth)` en cada frame aunque `depth` jamás cambia tras crear la criatura; debería ejecutarse únicamente dentro de `syncPopulation()`.
3. **Cascada de escrituras y cálculos en arranque ([`ui.js`](ui.js#L493-L505)):** Durante `DOMContentLoaded`, se llaman secuencialmente 11 funciones `apply*()`, provocando **11 llamadas síncronas a `localStorage.setItem()`**, **3 invocaciones de `syncPopulation()`** (`applyBiome`/`applySpecies`/`applyFishCount`) y **3 `requestAnimationFrame(syncObstacles)`** redundantes antes del primer frame.
4. **Polling de reloj cada segundo sin segundos visibles ([`ui.js`](ui.js#L505)):** `setInterval(updateClockAndGreeting, 1000)` formatea `toLocaleDateString('es-ES', ...)` cada 1,000 ms aunque la UI solo muestra `HH:MM`. Conviene alinear el timer al cambio de minuto o comprobar si cambió `minutes`.

### `M-04` · Hardening de Manifest V3, manejo de errores en Chrome APIs y robustez de almacenamiento
1. **Manifiesto mínimo sin endurecimiento explícito ([`manifest.json`](manifest.json)):**
   - Carece de `"minimum_chrome_version": "104"` (requerida para `"favicon"` y `/_favicon/` en MV3; en navegadores Chromium antiguos o forks compatibles el permiso falla silenciosamente o impide instalar).
   - No declara explícitamente `"content_security_policy": { "extension_pages": "script-src 'self'; object-src 'none';" }` como buena práctica de defensa en profundidad.
2. **Sin manejo de rechazo en `chrome.search.query()` ([`productivity.js`](productivity.js#L473-L481)):** En MV3 `chrome.search.query()` retorna una Promesa (además de poder poblar `chrome.runtime.lastError`). Si falla de forma asíncrona tras el `return;`, el error no es capturado por el `try/catch` síncrono y no cae al fallback de Google.
3. **Generación de IDs con `Date.now()` ([`productivity.js`](productivity.js#L187)):** `id: 'stone-' + Date.now()` puede colisionar en operaciones rápidas o automatizadas; usar `crypto.randomUUID()`.
4. **Validación laxa al parsear `localStorage` ([`ui.js`](ui.js#L46)):** `loadPrefs()` no comprueba `parsed && typeof parsed === 'object' && !Array.isArray(parsed)` (si el valor guardado fuera `"null"`, `123` o `[]`, `parsed.fishCount` fallaría en el primer caso o pasaría silenciosamente en los demás).

### `M-05` · UX, Contraste visual, Semántica ARIA y Diseño Responsive
1. **Desincronización del slider de población vs contador visible ([`index.html`](index.html#L36-L46), [`ui.js`](ui.js#L251), [`koi-engine.js`](koi-engine.js#L1420-L1456)):** El slider está fijado entre `5` y `25`, pero `#fish-count-value` muestra `engine.kois.length`. Al elegir solo *Tiburón Ballena*, aunque el usuario mueva el slider entre `13` y `25`, el contador permanece atascado en `3` o `4` (`clamp(Math.round(total * 0.2), 1, 4)`) y con `0` especies activas muestra `0` aunque el slider esté en `12`. Conviene etiquetar claramente el slider como *"Densidad"* o mostrar `"3 activos (escala 15)"` / ajustar el rango visible según especie.
2. **Contraste insuficiente en texto secundario y botón Zen ([`styles.css`](styles.css#L34) `#L53`, `#L72`, `#L566`):**
   - Medido sobre el fondo real de cada tema, `--text-muted` no alcanza el mínimo WCAG 2.1 AA de **4.5:1** para texto normal:
     - **Noche (`#05080f`):** `rgba(155, 180, 212, 0.46)` → **2.73:1** (`2.77:1` sobre radial-1).
     - **Atardecer (`#0d0b1a`):** `rgba(220, 184, 196, 0.52)` → **3.62:1** (`3.55:1` sobre radial-1).
     - **Día (`#081424`):** `rgba(165, 210, 238, 0.54)` → **4.13:1** (`3.73:1` sobre radial-1).
   - `.zen-exit-btn` en estado pasivo (`opacity: 0.18`) tiene apenas **1.26:1** de contraste sobre `#05080f`.
   - Fuentes por debajo de `12px` en `.pomo-time` (`10px`), `.species-desc` (`10.5px`), `.stone-title` (`11px`), y botones `.stone-mini-btn` de `18 × 18 px` (por debajo de `24 × 24 px` de WCAG 2.2 Target Size Minimum) y sin `aria-label` contextual (solo texto `"✎"` y `"×"` en [`productivity.js`](productivity.js#L375-L386)).
3. **Semántica ARIA incompleta:**
   - Grupos excluyentes (`.solar-selector`, `.biome-selector`, `.firefly-modes`, `.pomo-modes`) usan `.is-active` visualmente pero carecen de `aria-pressed` o `role="radiogroup"` + `aria-checked`.
   - `#pomo-status` carece de `aria-live="polite"`.
4. **Solapamientos e interacción táctil en Responsive:**
   - En anchos entre `~900px` y `~1280px`, `#perf-badge` (`position: fixed; top: 20px; left: 20px`) puede solaparse con `.top-bar` centrada (`z-index: 22` encima de `20`).
   - En pantallas `< 860px`, `.top-bar` oculta etiquetas (`display: none` en `.toggle-btn span`, `.action-btn span`) y aplica `overflow-x: auto` sin indicador de desplazamiento, recortando botones si el viewport es menor de ~`560px`.
   - En alturas bajas (`< 640px`), `.center-stage` centrado verticalmente puede solapar con `.top-bar` y `.river-stones-dock`.
   - Los eventos del lienzo y peek zen solo escuchan `click` y `mousemove` ([`ui.js`](ui.js#L612-L633)), ignorando `pointermove` / pantallas táctiles.

### `M-06` · Acoplamiento entre módulos, ausencia de `i18n` y estado aislado por pestaña
1. **Acceso directo a internos entre capas:** `ui.js` lee directamente `engine.kois.length`, `engine.fps` y `engine.frameTimeMs`; `koi-engine.js` lee directamente `ecosystem.petalPool`, `ecosystem.petalPoolSize` y `ecosystem.planktonEnabled`. Asimismo, `ui.js` repite 3 veces una cascada de 6 `if/else` para las banderas de entorno (`lilies`, `currents`, `plankton`, `kelp`, `jellyfish`, `school`) en las líneas `310–322`, `356–366` y `522–534`.
2. **Idioma hardcodeado e inconsistente:** `manifest.json` está en inglés, mientras toda la UI, `toLocaleDateString('es-ES', ...)`, `es.wikipedia.org` y `developer.mozilla.org/es/` están fijos en español sin usar `_locales/` ni `chrome.i18n.getMessage()`.
3. **Preferencias y Piedras sin sincronización entre pestañas/dispositivos:** Al usar solo `localStorage` sin escuchar el evento `storage` ni ofrecer `chrome.storage.sync`, cambiar un tema o piedra en una pestaña no actualiza otras pestañas abiertas ni se respalda en la cuenta del navegador.

---

## 5. Riesgos Bajos, Deuda Técnica Menor y Código Muerto

### `B-01` · Parpadeo inicial de estado (*FOUC / FOUState*) al abrir una pestaña nueva
- **Ubicación:** [`index.html`](index.html#L2) (`data-solar="night"`), [`index.html`](index.html#L215) (`00:00`), [`index.html`](index.html#L219) (`"Buenas tardes"`).
- **Impacto:** Al cargar con preferencia Día, Modo Zen o fuera de la tarde, la página muestra brevemente fondo nocturno, `00:00` y `"Buenas tardes"` antes de que `DOMContentLoaded` ejecute `ui.js`. Aplicar la lectura síncrona mínima de `data-solar`, `data-biome` y clase `zen-mode` en un pequeño script inline/head (o módulo temprano) evita el destello.

### `B-02` · Transición CSS inefectiva sobre `radial-gradient()`
- **Ubicación:** [`styles.css`](styles.css#L113-L122).
- **Detalle:** `transition: background 0.9s ease` no interpola gradientes CSS (`radial-gradient(...)`) con variables personalizadas salvo usando `@property` para colores individuales o alternando opacidad entre pseudo-elementos/capas. Actualmente el cambio de Día/Tarde/Noche salta abruptamente en el fondo base.

### `B-03` · Código muerto identificado (5 elementos verificados)
Se verificó estáticamente en todo el código fuente la existencia de los siguientes elementos sin referencias o sin efecto:

| Elemento | Ubicación | Estado |
| :--- | :--- | :--- |
| `AquaticCreature.prototype.sampleCell()` | [`koi-engine.js`](koi-engine.js#L441-L443) | Método stub nunca llamado ni sobreescrito (las subclases implementan `evaluateCell`). |
| `PALETTE_COLORS.rainSunset` (`#f8c8e0`) | [`glyph-atlas.js`](glyph-atlas.js#L46) | Sin uso debido al bug de `ecosystem.js:36` (`rainKey: 'rainNight'`). |
| `.control-label` | [`styles.css`](styles.css#L174-L182) | Clase CSS sin ningún elemento HTML o JS que la utilice. |
| `id="lilies-btn"` | [`index.html`](index.html#L190) | ID HTML no referenciado ni en JS ni en CSS (el controlador usa `.env-chip`). |
| `jellyfish[i].depth` | [`ecosystem.js`](ecosystem.js#L433) | Propiedad asignada en `initJellyfish()` y nunca leída en física o render. |

### `B-04` · *Overdraw* de ondas en radios pequeños
- **Ubicación:** [`koi-engine.js`](koi-engine.js#L1941-L1947).
- **Detalle:** En ondas con `radius` pequeño, `stepAngle = Math.max(0.18, CELL_W / radius)` y la discretización a `(gx, gy)` hacen que múltiples ángulos consecutivos dibujen el mismo glifo sobre la misma celda en el mismo frame, aumentando innecesariamente el alpha acumulado y las llamadas a `drawGlyph()`.

### `B-05` · Detalles ergonómicos en `SmartSearchController`
- **Ubicación:** [`productivity.js`](productivity.js#L424), [`index.html`](index.html#L221).
- **Detalle:** El regex `/^(!(?:gh|yt|r|mdn|so|w))\s+(.*)$/i` no admite espacios iniciales si el usuario pega `" !gh query"`. Además, el atributo `action="https://www.google.com/search"` del `<form>` actúa como respaldo si fallara JS, aunque hoy `submit` siempre hace `e.preventDefault()`.

### `B-06` · Consistencia documental y metadatos para tiendas
- **Ubicación:** [`index.html`](index.html#L6) (`#L15`), [`koi-engine.js`](koi-engine.js#L1243), [`README.md`](README.md#L5) (`#L77`, `#L84`), raíz del repo.
- **Detalle:**
  - Nomenclatura heredada de la v1: el array `this.kois` contiene tortugas y tiburones, el canvas se llama `#koi-canvas` y el `<title>` es siempre `"Nueva pestaña · Estanque Koi"` incluso en bioma *Mar*.
  - En `README.md`, los enlaces relativos `../../releases/latest` funcionan en el README raíz de GitHub, pero pueden romperse si se visualiza el archivo desde subcarpetas o paquetes locales.
  - Falta un archivo `PRIVACY.md` y documentación de justificación de permisos (`topSites`, `search`, `favicon`) requerida habitualmente al enviar a Chrome Web Store / Edge Add-ons.

### `B-07` · Ergonomía CSS menor
- **Ubicación:** [`styles.css`](styles.css#L108).
- **Detalle:** `user-select: none;` global en `html, body` impide seleccionar el texto del saludo o la fecha (aunque los `<input>` permiten selección en Chromium, es mejor aplicarlo únicamente a controles UI y `#koi-canvas`). Falta también degradado amable si el soporte de `backdrop-filter` está desactivado en GPU/navegador.

---

## 6. Puntos de Mejora Estratégicos y Propuesta de Arquitectura

### A. Arquitectura Modular con ES Modules Nativos (Cero Dependencias, Cero Bundler)

Para eliminar el acoplamiento global, reducir los archivos de >1,200–1,900 líneas y facilitar pruebas unitarias manteniendo la filosofía *vanilla* sin `node_modules`, se recomienda la siguiente estructura:

```text
ASII-KOI/
├── manifest.json
├── index.html                    # Carga única: <script type="module" src="src/main.js"></script>
├── _locales/
│   ├── es/messages.json          # Soporte i18n nativo MV3 (ES / EN)
│   └── en/messages.json
├── styles/
│   ├── tokens.css                # Variables solares, biomas y contraste AA verificado
│   ├── base.css                  # Reset, canvas, prefers-reduced-motion
│   ├── topbar.css                # Barra superior, popover de fauna y perf-badge
│   ├── stage.css                 # Reloj, buscador y badges Bang
│   └── widgets.css               # Piedras de río, modal y Pomodoro
├── src/
│   ├── main.js                   # Bootstrapping y wiring entre módulos
│   ├── core/
│   │   ├── constants.js          # CELL_W, CELL_H, límites y defaults
│   │   ├── math.js               # clamp, lerp, randRange, angleDiff, damp(dt)
│   │   ├── object-pool.js        # Clase ObjectPool<T> única (reemplaza 7 implementaciones)
│   │   └── storage.js            # Validación de esquema, load/save prefs y sync entre pestañas
│   ├── render/
│   │   └── glyph-atlas.js        # Atlas perezoso (on-demand) con paso físico exacto (C-01, A-03)
│   ├── simulation/
│   │   ├── creature.js           # Clase base AquaticCreature (boids + rasterizador optimizado)
│   │   ├── species/
│   │   │   ├── koi.js
│   │   │   ├── turtle.js
│   │   │   ├── whale-shark.js
│   │   │   └── hammerhead.js
│   │   ├── bait-school.js        # Cardumen separado del motor principal
│   │   └── engine.js             # Bucle principal, métricas y eventos de puntero
│   ├── ecosystem/
│   │   ├── solar.js              # Fases solares con caché temporal (sin new Date() por frame)
│   │   ├── lilies.js             # Física + caché OffscreenCanvas para nenúfares y oclusión
│   │   ├── weather.js            # Lluvia, micro-ondas y pétalos sakura
│   │   ├── ocean.js              # Corrientes, rayos, algas, medusas, plancton y burbujas
│   │   └── ecosystem.js          # Fachada coordinadora de capas subacuática/superficie/atmósfera
│   ├── productivity/
│   │   ├── url-utils.js          # sanitizeHttpUrl() y resolveDirectUrl() testeables en Node
│   │   ├── river-stones.js       # Dock de accesos directos (sin fuga a google.com/s2)
│   │   ├── smart-search.js       # Bangs y wrapper seguro para chrome.search.query
│   │   └── pomodoro.js           # Temporizador persistente con Date.now() y sync multi-pestaña
│   └── ui/
│       ├── controls.js           # Tabla declarativa para toggles y controles de fauna/entorno
│       ├── modal.js              # Focus trap, restauración de foco e inert
│       ├── zen.js                # Modo Zen accesible (inert + Ctrl+Z seguro)
│       └── clock.js              # Reloj eficiente actualizado por cambio de minuto
├── tests/                        # Pruebas unitarias con node:test (sin dependencias externas)
├── scripts/
│   └── package.ps1               # Empaquetado POSIX limpio y validación de manifest/archivos
└── .github/workflows/ci.yml      # Lint + tests + verificación de zip en cada push/PR
```

### B. Hoja de Ruta de Remediación Priorizada

| Fase | Alcance | Hallazgos cubiertos | Impacto esperado |
| :--- | :--- | :--- | :--- |
| **Fase 1 · Seguridad, Privacidad y Bugs Críticos** | Corregir deriva DPR en `GlyphAtlas`, sanitización estricta de URLs (`http`/`https`), eliminar envío de dominios a Google S2, proteger `_intersectingLilies`, arreglar `rainSunset`, `Ctrl+Z`, `saved = []` y `closeModal()` en `Escape`. | `C-01`, `C-02`, `C-03`, `A-05`, `A-07`, `M-01` | Estabilidad visual en HiDPI Windows, cumplimiento de privacidad en tiendas, prevención de URLs inseguras y cero crashes silenciosos. |
| **Fase 2 · Rendimiento, Física y Productividad** | Optimizar `AquaticCreature.render()` (clipping + `sqrt` único) e `isOccludedInList()`, cachear nenúfares, convertir `GlyphAtlas` a caché perezosa, normalizar amortiguamiento por `dt` (120–240 Hz), eliminar `new Date()` y `sort()` por frame, consolidar `backdrop-filter`, y persistir Pomodoro entre pestañas. | `A-01`, `A-02`, `A-03`, `A-04`, `A-06`, `M-02`, `M-03` | Reducción drástica de CPU/VRAM/batería, física idéntica a 60/144 Hz, búsqueda sin falsos positivos y Pomodoro realmente usable. |
| **Fase 3 · Accesibilidad, UX y Responsive** | `:focus-visible` global, convertir `#bang-badge` a `<button>`, `inert` en Modo Zen, *focus trap* en modal/popover, mejorar contraste de `--text-muted` y `.zen-exit-btn` a ≥4.5:1, `@media (prefers-reduced-motion)`, Pointer Events táctiles y ajustar solapamientos de `#perf-badge`/dock. | `A-08`, `M-05`, `B-01`, `B-02`, `B-07` | Cumplimiento WCAG 2.1 AA, navegabilidad completa con teclado/lector de pantalla y soporte móvil/táctil real. |
| **Fase 4 · Refactorización Modular, i18n, Tests y CI** | Migrar a ES Modules nativos + `ObjectPool` único, endurecer `manifest.json`, añadir `_locales/` (`es`/`en`), sync de preferencias, suite de tests unitarios, script de empaquetado POSIX y `PRIVACY.md`. | `A-09`, `A-10`, `M-04`, `M-06`, `B-03` – `B-06` | Base mantenible (<350 líneas por archivo), regresiones bloqueadas en CI y releases `.zip` reproducibles. |

### C. Checklist de Verificación Recomendada Post-Correcciones

- [ ] **HiDPI Fraccionario:** Probar visualmente con zoom del navegador al `110%`, `125%`, `133%` y `175%` comprobando que las algas (`kelpTip`), tortugas, tiburones y pétalos `🌸` no presenten recorte desplazado ni cambio de color.
- [ ] **Red y Privacidad:** Abrir DevTools → *Network* con filtros limpios y verificar **0 peticiones externas** al cargar Nueva Pestaña incluso con un acceso directo cuyo `/_favicon/` falle.
- [ ] **Seguridad de Piedras:** Intentar inyectar manualmente `javascript:alert(1)` y `data:text/html,...` en `localStorage['ascii_koi_river_stones_v1']` y confirmar que `loadSavedStones()` los descarta.
- [ ] **Tasa de Refresco y Visibilidad:** Verificar física equivalente en pantalla a 60 Hz y 120/144 Hz, y confirmar pausa a 0% CPU al cambiar de pestaña.
- [ ] **Teclado y Accesibilidad:** Navegar toda la página usando únicamente `Tab`, `Shift+Tab`, `Enter`, `Space` y `Esc` (incluyendo Zen Mode, `#fauna-popover`, `#stone-modal` y `#bang-badge`); validar `Ctrl+Z` fuera de inputs.
- [ ] **Empaquetado Release:** Validar que el `.zip` generado solo incluya rutas con `/` (POSIX), omita `docs/` y `tests/`, y pase carga descomprimida en Chrome y Edge.
