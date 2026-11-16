# ASCII Koi Pond New Tab

Extensión **Manifest V3** interactiva y sin dependencias externas que reemplaza la página de Nueva Pestaña por un estanque zen luminoso en arte ASCII. Construida con HTML5 Canvas, un atlas de glifos pre-renderizados (`OffscreenCanvas`), Object Pooling sin asignaciones en bucle y herramientas de productividad diaria.

**[Descargar última versión (Release)](../../releases/latest)**

---

## Características

- **Peces Koi Articulados y `GlyphAtlas`:**
  - Cada pez Koi nada con una columna vertebral articulada de 12 nodos, ondulación senoidal proporcional a su velocidad y aletas pectorales móviles rasterizadas sobre una cuadrícula nítida adaptada a `devicePixelRatio` (`@`, `#`, `%`, `*`, `+`, `:`, `.`).
  - Atlas de glifos pre-renderizados en `OffscreenCanvas` (`glyph-atlas.js`) con doble estado (`glow` y `flat`), eliminando por completo `fillText()` y `shadowBlur` del bucle principal de animación.
  - Genética ponderada con variedades clásicas (*Kohaku*, *Yamabuki Ogon*, *Showa*, *Asagi*) y variantes raras (*Tancho* 8% y *Koi Fantasma / Butterfly* 7% con aletas y cola un 45% más largas y estela luminosa).
- **Nenúfares con Oclusión 2.5D:**
  - Hojas de loto en ASCII con muesca en `"V"`, deriva suave, rotación, colisiones elásticas y flores de loto en tonos rosa pálido o blanco.
  - Descarte rápido por círculo envolvente (*broad-phase*) y oclusión por glifo (*narrow-phase*) que atenúa al `22%` de opacidad sin brillo cuando un Koi pasa por debajo de una hoja.
- **Ciclo Solar y Clima Dinámico:**
  - Fases solares automáticas o manuales (`Auto`, `Día`, `Tarde`, `Noche`) con cáusticas sutiles de día, reflejos ámbar/magenta al atardecer y luciérnagas ASCII verde-doradas con movimiento browniano por la noche.
  - Interruptor de lluvia suave (`|`, `/`, `'`) que genera micro-ondas circulares `( )` → `(   )` al impactar en el agua.
- **Accesos Directos "Piedras de Río":**
  - Fila inferior de cantos rodados oscuros poblados automáticamente con `chrome.topSites` (con enlaces predeterminados de respaldo), carga de favicons mediante la API nativa `/_favicon/` con respaldo circular por inicial del dominio, ondas de agua al pasar el cursor y edición/alta/eliminación persistida en `localStorage`.
- **Buscador Inteligente (Bangs, URLs directas y búsqueda nativa):**
  - Usa `chrome.search.query()` para respetar el motor de búsqueda predeterminado del navegador (con respaldo automático a Google si no está disponible).
  - Transformación en tiempo real de prefijos Bang en píldoras coloreadas y navegación directa de URLs (`localhost:3000`, `github.com`, `https://...`).
- **Temporizador Pomodoro y Lluvia de Pétalos de Cerezo:**
  - Widget colapsable con anillo circular SVG (*Enfoque 25:00* / *Descanso 05:00*) y botón de previsualización `🌸`.
  - Al completar una sesión de enfoque, activa una lluvia de pétalos de cerezo (`✿`, `❀`, `*`, `~`, `·`) durante 25 segundos usando un Object Pool de 90 pétalos que generan ondas al aterrizar y atraen la curiosidad de los Koi cercanos.
- **Rendimiento y Modo Zen:**
  - Pausa inteligente en segundo plano con Page Visibility API (`visibilitychange`), `deltaTime` acotado (`<= 0.05s`), pools de objetos reutilizables, indicador opcional de FPS/`ms` en tiempo real y **Modo Zen** (`Z` / `Esc`).

---

## Comandos Rápidos de Búsqueda (Bangs)

Escribe un prefijo seguido de un espacio al inicio de la barra de búsqueda para convertirlo en una etiqueta visual. Pulsa `Backspace` con el campo vacío para quitarlo.

| Prefijo | Plataforma | Destino |
| :--- | :--- | :--- |
| `!gh ` | GitHub | `https://github.com/search?q=` |
| `!yt ` | YouTube | `https://www.youtube.com/results?search_query=` |
| `!r ` | Reddit | `https://www.reddit.com/search/?q=` |
| `!mdn ` | MDN Web Docs | `https://developer.mozilla.org/es/search?q=` |
| `!so ` | StackOverflow | `https://stackoverflow.com/search?q=` |
| `!w ` | Wikipedia | `https://es.wikipedia.org/w/index.php?search=` |

---

## Instalación

### Microsoft Edge
1. Descarga el archivo `.zip` más reciente desde **[Releases](../../releases/latest)** y descomprímelo en una carpeta permanente.
2. Abre `edge://extensions` en Microsoft Edge.
3. Activa el **Modo de desarrollador** en el panel lateral o esquina superior.
4. Haz clic en **Cargar descomprimida** y selecciona la carpeta extraída que contiene `manifest.json`.
5. Abre una nueva pestaña. Cuando Edge pregunte si deseas mantener el cambio de Nueva Pestaña, pulsa **"Conservar los cambios"**.

### Google Chrome / Brave / Vivaldi
1. Descarga y descomprime el `.zip` más reciente desde **[Releases](../../releases/latest)**.
2. Abre `chrome://extensions` (o `brave://extensions` / `vivaldi://extensions`).
3. Activa el **Modo de desarrollador** en la esquina superior derecha.
4. Haz clic en **Cargar descomprimida** y selecciona la carpeta extraída.
5. Abre una pestaña nueva para disfrutar del estanque.

---

## Licencia

Distribuido bajo la licencia [MIT](LICENSE).
