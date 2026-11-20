# Política de Privacidad · ASCII Koi Pond New Tab

**Última actualización:** 2026-11-19

**ASCII Koi Pond New Tab** es una extensión de navegador **Manifest V3** diseñada para funcionar de manera completamente local en tu equipo, sin servidores propios ni telemetría.

## Datos tratados y almacenamiento

- **Preferencias de usuario (`localStorage` + `chrome.storage.sync`):** Se guardan localmente en tu navegador (y se sincronizan entre tus dispositivos mediante tu perfil del navegador si está habilitado) preferencias de apariencia y simulación (`ascii_koi_zen_prefs_v3`, con lectura de migración heredada desde `ascii_koi_zen_prefs_v2`, incluyendo bioma, formato horario, nombre de saludo, modo Eco y Modo Zen), tus accesos directos personalizados (`ascii_koi_river_stones_v1`), tus bangs personalizados HTTPS (`ascii_koi_custom_bangs_v1`), tu objetivo diario (`ascii_koi_daily_focus_v1`) y el estado del temporizador (`ascii_koi_pomodoro_v1`). Estos datos nunca se envían a servidores externos propios ni de terceros.
- **Respaldo manual:** Puedes exportar o importar tus ajustes locales en formato JSON de forma 100% offline.
- **Sin analíticas ni rastreo:** La extensión no incluye SDKs de analítica, seguimiento, publicidad ni llamadas de red en segundo plano (`connect-src 'none'` en el `content_security_policy` del manifiesto).

## Permisos del navegador (`manifest.json`)

- **`storage`:** Utilizado exclusivamente mediante `chrome.storage.sync` para sincronizar entre tus dispositivos las preferencias, piedras de río, bangs personalizados y objetivo diario.
- **`topSites`:** Se utiliza únicamente de forma local al inicializar los accesos directos ("Piedras de Río") si todavía no has personalizado tu lista, mostrando solo URLs seguras (`http:` / `https:`).
- **`favicon`:** Se utiliza exclusivamente de forma local a través del endpoint interno del navegador (`/_favicon/`) para mostrar los iconos de tus accesos directos, sin consultar servicios externos de favicons.
- **`search`:** Se utiliza únicamente cuando envías explícitamente una consulta en la barra de búsqueda sin prefijo bang ni URL directa, delegando la búsqueda al motor predeterminado de tu navegador mediante `chrome.search.query()`.

## Navegación externa iniciada por el usuario

Solo se produce tráfico saliente cuando tú decides navegar haciendo clic en un acceso directo o enviando una búsqueda o URL directa (por ejemplo, usando prefijos `!gh`, `!yt`, `!r`, `!mdn`, `!so`, `!w`).

## Contacto

Para dudas o reportes relacionados con la extensión o esta política, puedes abrir un *issue* en el repositorio oficial: <https://github.com/DAHL13/ACSII-KOI/issues>.
