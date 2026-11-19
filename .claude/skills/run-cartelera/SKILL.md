---
name: run-cartelera
description: Build, run, test and drive the cartelera VOS (horarios en versión original de 4 cines de Córdoba). Use when asked to start the site, run the scraper (`bun run actualizar`), run the tests, build it, take screenshots of the page, check one cinema source, or verify a change in the running app.
---

Dos piezas: un scraper (Bun) que baja Cinemark, Cinexo y Cinemacenter y escribe `public/cartelera.json`, y una página React (Vite) que lo muestra.
Para manejar la página: levantá el servidor de Vite y corré `.claude/skills/run-cartelera/driver.ts`, que usa el Edge (o Chrome) instalado vía `playwright-core`, recorre el flujo típico, saca capturas y devuelve un JSON.
Todas las rutas son relativas a la raíz del proyecto. Verificado en Windows 11 con Git Bash.

## Prerequisitos

- Bun 1.4.3 (`bun --version`).
- Microsoft Edge o Google Chrome instalados (el driver no descarga navegadores). Para Chrome: `NAVEGADOR=chrome`.

## Setup

```bash
bun install
```

## Datos: correr el scraper (pega a los sitios reales)

```bash
bun run actualizar
```

Tarda de 2 a 3 minutos (pausas por el rate limit de Cinexo y una consulta por cada función de Alta Gracia que no figura en Cinemacenter). Escribe `public/cartelera.json`, `datos/fuentes/*.json` (resguardo por fuente) y `datos/idiomas.json` (cache de idioma original). Salida típica:

```
✓ cinemark: 671 funciones
✓ cinexo: 300 funciones
✓ cinemacenter: 9 funciones
27 películas, 970 funciones (conflictos 0, sospechosas 10, una fuente 0)
```

Si una fuente falla, usa su último resguardo y escribe igual; sale con código 1 solo si la caída es de Cinemark o Cinexo (Cinemacenter es opcional y solo deja una advertencia). Si el JSON nuevo no pasa `validarCartelera`, no lo escribe y sale con 1.

Una sola fuente, sin el resto de la cadena:

```bash
bun -e 'import { bajarCinemark } from "./scraper/fuentes/cinemark.ts"; const { funciones } = await bajarCinemark(); console.log(funciones.length, funciones[0])'
```

Validar el JSON que está en disco:

```bash
bun -e 'import { validarCartelera } from "./scraper/validar.ts"; console.log(validarCartelera(await Bun.file("public/cartelera.json").json()))'
```

## Run (agent path)

1. Servidor de desarrollo en segundo plano (con la herramienta Bash, `run_in_background`; o con `&`):

```bash
bun run dev -- --port 5173 --strictPort > /tmp/cartelera-vite.log 2>&1 &
```

2. Esperar a que responda (curl reintenta solo, sin `sleep`):

```bash
curl -sf --retry 30 --retry-connrefused --retry-delay 1 -o /dev/null http://localhost:5173/ && echo listo
```

3. Manejar la página:

```bash
bun .claude/skills/run-cartelera/driver.ts
```

Imprime un JSON con los días, el estado de cada vista (`tarjetas`, `funciones`, `cines`, `conflictos`, `sospechosas`, avisos de fuentes caídas) y `problemas` (respuestas HTTP ≥ 400, errores de consola, excepciones, scroll horizontal en celular, filtro de cines que no filtra). Sale con 1 si `problemas` no está vacío.
Capturas en `%TEMP%\cartelera-capturas\` (en Git Bash `/tmp` es `%TEMP%`: `/tmp/cartelera-capturas/`; otra carpeta como segundo argumento):
`1-primer-dia.png` (escritorio oscuro), `2-segundo-dia.png`, `3-solo-alta-gracia.png` (filtro de cines), `4-celular-claro.png` (375 px). Mirarlas con Read.
Primer argumento opcional: otra URL (por ejemplo, la de GitHub Pages).

4. Parar el servidor:

```bash
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5173 -State Listen | ForEach-Object { Stop-Process -Id \$_.OwningProcess -Force }"
```

## Run (human path)

```bash
bun run dev
```

Abre en http://localhost:5173/. Ctrl+C para parar. La página lee `public/cartelera.json`: sin correr antes `bun run actualizar` no hay datos.

## Test, tipos y build

```bash
bun test
```

129 tests, sin red (fixtures reales en `scraper/fixtures/`, `traer` falso inyectado en cada fuente, servidor local para los reintentos HTTP). Tarda menos de 1 s.

```bash
bunx tsc --noEmit -p .
bun run build
```

`build` deja el sitio en `dist/` con `base: "./"`, listo para GitHub Pages. La publicación la hace `.github/workflows/actualizar.yml` (cron, scraper, commit de datos, build y deploy).

## Instalable (PWA)

La página se puede instalar (manifiesto, íconos y un service worker de red primero que la deja abrir sin señal con los últimos horarios vistos). El service worker solo se registra en la versión compilada, nunca en `bun run dev`. Para comprobar instalabilidad y modo sin conexión:

```bash
bun run build
bun run preview -- --port 4173 --strictPort > /tmp/preview.log 2>&1 &
curl -sf --retry 30 --retry-connrefused --retry-delay 1 -o /dev/null http://localhost:4173/ && echo listo
bun .claude/skills/run-cartelera/instalable.ts http://localhost:4173/
```

Imprime `instalable` (según `Page.getInstallabilityErrors` de Chrome), cuántas películas abre sin conexión y `problemas`; sale con 1 si algo falla. Acepta también la URL publicada. Parar el servidor con el mismo `Stop-Process` de arriba, cambiando el puerto a 4173.

Para rehacer los íconos tras tocar `public/icono.svg`: `bun run iconos` (usa Edge o Chrome para rasterizar).

## Gotchas

- **`instalable.ts` usa un perfil persistente temporal**: con un contexto anónimo de Playwright Chrome responde siempre `in-incognito` y parece que la página no es instalable.
- **Si se cambian las rutas del manifiesto o de `sw.js`, mantenerlas relativas** (`./`): el sitio vive bajo `/cartelera-cordoba/` en GitHub Pages y una ruta que empiece con `/` rompe la instalación.

- **Cinemark manda la hora con una "Z" falsa** (`13:40:00.000Z` es 13:40 de Córdoba). Si alguien la convierte desde UTC todo se corre 3 h; `parsearCinemark` falla si una trasnoche cae a las 04:00 o más.
- **Cinexo solo expone las fechas en el payload RSC** (`RSC: 1`). En el HTML común vienen escapadas y la regex no las ve; sin fechas barre 90 días (180 pedidos).
- **Cinemacenter sin la cookie `cityid=1` muestra Mar del Plata**, y su grilla responde 200 vacía si los parámetros están mal. Por eso cero funciones es error. Decodificar como `windows-1252`: las sinopsis traen bytes cp1252.
- **Cinexo publica funciones los martes sin precio** aunque Alta Gracia cierra: quedan `sospechosa` (borde punteado, "Sin venta online").
- **Un pedido a Cinexo pasó los 30 s** y tiró toda la fuente: `pedir` reintenta timeouts, 429 y 5xx (3 intentos).
- **Wikidata devuelve 403 con User-Agent de navegador**: usa `AGENTE_WIKIMEDIA`. El buscador de IMDb (`v3.sg.media-imdb.com`) no es oficial.
- **Idioma original mal o película que sobra**: `datos/overrides.json`, por título como lo publica el cine: `{ "Cordobeces": { "ocultar": true } }` o `{ "X": { "idiomaOriginal": "es" } }`. Gana sobre todo lo demás.
- **Capturas con pósters en blanco**: las imágenes son `loading=lazy`; el driver las fuerza a cargar antes de capturar. Las pastillas de día tienen transición de 0,15 s: el driver espera antes de la captura.
- **La tira de días agrupa por mes** (etiquetas "nov", "dic"; un renglón por mes en escritorio, una tira deslizable en celular). Las preventas de diciembre existen en los datos pero están lejos de hoy: para ver una, hacer clic en su día (por ejemplo, el 17/12) y comprobar que aparezcan Avengers y Duna.
- **La vista previa de Claude puede servir otra carpeta** si el proyecto se movió: si no aparecen los cambios, liberar el puerto 5173 y levantar `bun run dev` desde la carpeta correcta.
- **Locators por `aria-pressed`** cambian al hacer clic: recorrer todos los `.chip` y mirar el atributo de cada uno.

## Troubleshooting

- **`✗ cinexo: The operation timed out. (uso los datos de …)`**: el sitio tardó; ya hay reintentos. Volvé a correr `bun run actualizar`; la página mientras tanto avisa que muestra datos viejos.
- **`Idioma desconocido: "…"`** en la salida del scraper: ni IMDb/Wikidata ni el anexo de películas argentinas lo resolvieron. Sus funciones en castellano quedan ocultas salvo con "Incluir castellano sin idioma confirmado". Fijalo en `datos/overrides.json`.
