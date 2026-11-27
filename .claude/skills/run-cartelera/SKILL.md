---
name: run-cartelera
description: Build, run, test and drive the cartelera de subtituladas (horarios en versión original de 4 cines de Córdoba). Use when asked to start the site, run the scraper (`bun run actualizar`), run the tests, build it, take screenshots of the page, open a given day, check one cinema source, check the PWA, or verify a change in the running app.
---

Dos piezas: un scraper (Bun) que baja Cinemark, Cinexo y Cinemacenter y escribe `public/cartelera.json`, y una página React (Vite) que lo muestra.
Para manejar la página: levantá el servidor de Vite y corré `.claude/skills/run-cartelera/driver.ts`, que usa el Edge (o Chrome) instalado vía `playwright-core`, recorre el flujo típico, saca capturas en escritorio y celular, en claro y oscuro, y devuelve un JSON.
Todas las rutas son relativas a la raíz del proyecto. Verificado en Windows 11 con Git Bash.

## Prerequisitos

- Bun 1.4.3 (`bun --version`).
- Microsoft Edge o Google Chrome instalados (el driver no descarga navegadores). Edge es el predeterminado; para Chrome: `NAVEGADOR=chrome`.

## Setup

```bash
bun install
```

## Datos: correr el scraper (pega a los sitios reales)

```bash
bun run actualizar
```

Tarda entre 1 y 3 minutos (pausas por el rate limit de Cinexo y una consulta por cada función de Alta Gracia que no figura en Cinemacenter). Escribe `public/cartelera.json`, `datos/fuentes/*.json` (resguardo por fuente) y `datos/idiomas.json` (cache de idioma original). Salida típica:

```
✓ cinemark: 647 funciones
✓ cinexo: 233 funciones
✓ cinemacenter: 41 funciones
15 películas, 878 funciones (conflictos 0, sospechosas 5, una fuente 1)
```

Si una fuente falla, usa su último resguardo y escribe igual; sale con código 1 solo si la caída es de Cinemark o Cinexo (Cinemacenter es opcional y solo deja una advertencia). Si el JSON nuevo no pasa `validarCartelera`, no lo escribe y sale con 1.

Deja cambios en `datos/` y `public/cartelera.json`. Si solo querías mirar, descartalos (el bot los vuelve a bajar):

```bash
git checkout -- datos public/cartelera.json
```

Una sola fuente, sin el resto de la cadena (Cinemark tarda unos segundos, Cinexo unos 30 s, Cinemacenter unos 5 s):

```bash
bun -e 'import { bajarCinemark } from "./scraper/fuentes/cinemark.ts"; const { funciones } = await bajarCinemark(); console.log(funciones.length, funciones[0])'
bun -e 'import { bajarCinexo } from "./scraper/fuentes/cinexo.ts"; import { ahoraEnCordoba } from "./src/fechas.ts"; const { funciones } = await bajarCinexo(ahoraEnCordoba().slice(0, 10)); console.log(funciones.length, funciones[0])'
bun -e 'import { bajarCinemacenter } from "./scraper/fuentes/cinemacenter.ts"; const { funciones, cubreHasta } = await bajarCinemacenter(); console.log(funciones.length, cubreHasta, funciones[0])'
```

Validar el JSON que está en disco (imprime `[]` si está sano):

```bash
bun -e 'import { validarCartelera } from "./scraper/validar.ts"; console.log(validarCartelera(await Bun.file("public/cartelera.json").json()))'
```

## Run (agent path)

1. Servidor de desarrollo en segundo plano. Con `&` sobrevive entre llamadas de la herramienta Bash:

```bash
bun run dev -- --port 5173 --strictPort > /tmp/cartelera-vite.log 2>&1 &
```

2. Esperar a que responda (curl reintenta solo, sin `sleep`):

```bash
curl -sf --retry 30 --retry-connrefused --retry-delay 1 -o /dev/null http://localhost:5173/ && echo listo
```

3. Manejar la página (tarda unos 5 s). El JSON es largo: guardalo y leé solo lo que necesites.

```bash
bun .claude/skills/run-cartelera/driver.ts > /tmp/driver.json
bun -e 'const r = await Bun.file(process.argv[1]).json(); console.log(r.problemas)' /tmp/driver.json
```

Para revisar un día puntual (una preventa, el día de un reestreno), pasale `DIA`:

```bash
DIA=2026-12-10 bun .claude/skills/run-cartelera/driver.ts > /tmp/driver.json
bun -e 'const r = await Bun.file(process.argv[1]).json(); console.log(JSON.stringify({ diaPedido: r.diaPedido, problemas: r.problemas }, null, 1))' /tmp/driver.json
```

El JSON trae `dias` (fechas `AAAA-MM-DD` de la tira), `meses`, y el estado de cada vista (`primerDia`, `segundoDia`, `ultimoDia`, `diaPedido`, `soloAltaGracia`) con `titulos`, `casillaDudosas`, `funciones`, `tarjetas`, `cines`, `conflictos`, `sospechosas` y `avisosDeFuentes`. En `problemas` anota respuestas HTTP ≥ 400, errores de consola, excepciones, scroll horizontal (escritorio de 1100 px, ventana de 700 px, celular claro y oscuro), el filtro de cines que no filtra y un `DIA` que no está en la tira. Sale con 1 si `problemas` no está vacío.

Capturas en `%TEMP%\cartelera-capturas\` (en Git Bash, `/tmp/cartelera-capturas/`; otra carpeta como segundo argumento). Mirarlas con Read:

- `1-primer-dia.png` escritorio oscuro, `1b-escritorio-claro.png`
- `2-segundo-dia.png`, `2b-ultimo-dia.png` (el día más lejano de la tira), `2c-dia-AAAA-MM-DD.png` (solo con `DIA`)
- `3-solo-alta-gracia.png` (filtro de cines)
- `4-celular-claro.png` y `4b-celular-oscuro.png` (375 px)

Primer argumento opcional: otra URL, por ejemplo la publicada: `bun .claude/skills/run-cartelera/driver.ts https://dimapoint.github.io/cartelera-cordoba/`.

4. Parar el servidor:

```bash
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 5173 -State Listen | ForEach-Object { Stop-Process -Id \$_.OwningProcess -Force }"
```

### Probar la casilla de castellano dudoso

La casilla «Mostrar funciones en castellano de películas sin idioma confirmado» solo aparece si alguna película quedó con idioma `desconocido` y tiene funciones en castellano; con datos sanos no se ve (`casillaDudosas: false`). Para probarla, marcá una película a mano en el JSON servido, recargá y después restaurá el archivo:

```bash
bun -e 'const ruta = "public/cartelera.json"; const c = await Bun.file(ruta).json(); c.peliculas.find(p => p.titulo === "DUNA: PARTE TRES").idiomaOriginal = "desconocido"; await Bun.write(ruta, JSON.stringify(c, null, 1))'
git checkout -- public/cartelera.json
```

Con la casilla tildada, el 15/12 Duna: Parte Tres pasa de 8 a 11 horarios, con las funciones en castellano marcadas `cast.?`. Cambiá el título si esa película ya no está en cartel.

## Run (human path)

```bash
bun run dev
```

Abre en http://localhost:5173/. Ctrl+C para parar. La página lee `public/cartelera.json` tal como está en el repo.

## Test, tipos y build

```bash
bun test
```

138 tests, sin red (fixtures reales en `scraper/fixtures/`, `traer` falso inyectado en cada fuente, servidor local para los reintentos HTTP). Tarda menos de 1 s. Un archivo o un nombre:

```bash
bun test scraper/fuentes/cinexo.test.ts
bun test -t "trasnoche"
```

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

Imprime `instalable` (según `Page.getInstallabilityErrors` de Chrome), cuántas películas abre sin conexión y `problemas`; sale con 1 si algo falla. Tarda unos 2 s. Acepta también la URL publicada. Parar el servidor:

```bash
powershell -NoProfile -Command "Get-NetTCPConnection -LocalPort 4173 -State Listen | ForEach-Object { Stop-Process -Id \$_.OwningProcess -Force }"
```

Para rehacer los íconos tras tocar `public/icono.svg`: `bun run iconos` (usa Edge o Chrome para rasterizar; con el SVG sin cambios produce PNG idénticos byte a byte).

## Gotchas

- **`bun run preview` sirve `dist/`**: tras cambiar código hay que volver a correr `bun run build` o se ve la versión anterior.
- **`instalable.ts` usa un perfil persistente temporal**: con un contexto anónimo de Playwright Chrome responde siempre `in-incognito` y parece que la página no es instalable.
- **Si se cambian las rutas del manifiesto o de `sw.js`, mantenerlas relativas** (`./`): el sitio vive bajo `/cartelera-cordoba/` en GitHub Pages y una ruta que empiece con `/` rompe la instalación.
- **El driver encuentra los días por `data-dia`** (`<button class="dia" data-dia="2026-12-10">`, en `src/componentes/Cabecera.tsx`). Si se saca ese atributo, o si se apunta a un build anterior a ese atributo, `DIA` deja de funcionar y `dias` viene con `null`.
- **La carpeta de capturas no se limpia entre corridas**: un `2c-dia-…png` de una corrida anterior con otro `DIA` sigue ahí. Mirá `capturas` en el JSON para saber cuáles son de esta corrida.
- **Un horario tachado (ya empezó) casi nunca se ve con datos recién bajados**: `unificar` descarta las funciones que ya empezaron al momento de correr el scraper. El tachado aparece cuando el JSON quedó de unas horas antes.
- **Cinemark manda la hora con una "Z" falsa** (`13:40:00.000Z` es 13:40 de Córdoba). Si alguien la convierte desde UTC todo se corre 3 h; `parsearCinemark` falla si una trasnoche cae a las 04:00 o más.
- **Cinexo solo expone las fechas en el payload RSC** (`RSC: 1`). En el HTML común vienen escapadas y la regex no las ve; sin fechas barre 90 días (180 pedidos).
- **Cinemacenter sin la cookie `cityid=1` muestra Mar del Plata**, y su grilla responde 200 vacía si los parámetros están mal. Por eso cero funciones es error. Decodificar como `windows-1252`: las sinopsis traen bytes cp1252.
- **Cinexo publica funciones los martes sin precio** aunque Alta Gracia cierra: quedan `sospechosa` (hora en gris, una "?" y la nota "(sin venta)").
- **Cinemacenter se cuelga seguido desde los servidores de GitHub** (timeouts que agotan los 3 reintentos) aunque desde una PC responda en menos de 1 s. Por eso es una fuente opcional (`FUENTES_OPCIONALES`): su caída no falla la Action ni muestra el cartel rojo. Si `bun run actualizar` local imprime `✗ cinemacenter`, es esto y no un error tuyo.
- **Las funciones "una fuente" son normales a la tarde**: Cinexo saca de su lista las funciones de hoy que ya empezaron y Cinemacenter no, así que aparecen como `una_fuente` (casi siempre en castellano de películas extranjeras, que ni se muestran).
- **Un pedido a Cinexo pasó los 30 s** y tiró toda la fuente: `pedir` reintenta timeouts, 429 y 5xx (3 intentos).
- **Wikidata devuelve 403 con User-Agent de navegador**: usa `AGENTE_WIKIMEDIA`. El buscador de IMDb (`v3.sg.media-imdb.com`) no es oficial.
- **Un reestreno con el año entre paréntesis** (`DUNA (2021)`) se busca en IMDb en ese año ±1 y conserva el año en el título visible. Antes se buscaba desde hace dos años y caía en la secuela nueva: las dos películas quedaban unidas bajo el mismo id. Para ver qué devuelve IMDb: `curl -s "https://v3.sg.media-imdb.com/suggestion/x/duna.json?includeVideos=0"`.
- **La cache de idiomas no se corrige sola**: si `datos/idiomas.json` guardó un id de IMDb equivocado, se sigue usando aunque arregles la búsqueda. Borrá esa entrada y corré `bun run actualizar` para que se vuelva a resolver.
- **Los programas armados por la distribuidora no existen en IMDb** (por ejemplo, "ONE PIECE: DOBLE AVENTURA", dos películas viejas en una función): quedan `desconocido` y el scraper imprime `Idioma desconocido`. Van a `datos/overrides.json`.
- **Idioma original mal o película que sobra**: `datos/overrides.json`, por título como lo publica el cine sin el sufijo de formato: `{ "Cordobeces": { "ocultar": true } }` o `{ "X": { "idiomaOriginal": "es" } }`. Gana sobre todo lo demás.
- **Capturas con pósters en blanco**: las imágenes son `loading=lazy`; el driver las fuerza a cargar antes de capturar y espera 300 ms. En la vista previa de Claude, recién cargada la página, los pósters salen como recuadros vacíos.
- **La tira de días agrupa por mes** (etiquetas "nov", "dic"; en escritorio un bloque por mes cuyos días bajan de renglón cuando no entran, en celular una tira deslizable). Si los días de un mes vuelven a ir en una sola fila sin corte, un mes con más de 12 días ensancha la página: el driver lo marca como scroll horizontal. Las preventas de diciembre existen en los datos pero están lejos de hoy: `DIA=2026-12-17` muestra Avengers y Duna: Parte Tres.
- **La vista previa de Claude es más angosta que la ventana que emula**: con 1100 px, la captura sale recortada a la derecha y parece que la tira se desborda. Para saber si la página de verdad se corre, medí `document.documentElement.scrollWidth` contra `clientWidth`, o usá el driver.
- **La vista previa de Claude puede servir otra carpeta** si el proyecto se movió: si no aparecen los cambios, liberar el puerto 5173 y levantar `bun run dev` desde la carpeta correcta.
- **Locators por `aria-pressed`** cambian al hacer clic: recorrer todos los `.chip` y mirar el atributo de cada uno.

## Troubleshooting

- **`✗ cinexo: The operation timed out. (uso los datos de …)`**: el sitio tardó; ya hay reintentos. Volvé a correr `bun run actualizar`; la página mientras tanto avisa que muestra datos viejos.
- **`Idioma desconocido: "…"`** en la salida del scraper: ni IMDb/Wikidata ni el anexo de películas argentinas lo resolvieron. Sus funciones en castellano quedan ocultas salvo con la casilla de castellano dudoso, que la página solo muestra cuando existe alguna función así (`hayDudosas` en `src/cartelera.ts`). Fijalo en `datos/overrides.json`.
- **`el día AAAA-MM-DD no está en la tira (no tiene funciones visibles)`** en `problemas`: ese día no tiene ninguna función que la página muestre (o ya pasó). Mirá `dias` en el JSON para ver cuáles hay.
- **`error: script "dev" exited with code 143`** al cortar `bun run dev` con `timeout` o `kill`: es la señal de corte, no un error de Vite.
