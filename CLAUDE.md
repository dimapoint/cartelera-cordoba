# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Cartelera de cine en versión original para Córdoba: un scraper (Bun) baja los horarios de cuatro cines, decide qué funciones le sirven al usuario y escribe `public/cartelera.json`; una página React (Vite) lo muestra. Se publica en GitHub Pages (`dimapoint/cartelera-cordoba`). Las guías de estilo, commits y datos están en `AGENTS.md`; las instrucciones para levantar y manejar la app con un navegador están en el skill `.claude/skills/run-cartelera/`.

## Comandos

```bash
bun install
bun run dev                  # Vite en http://localhost:5173/ (lee public/cartelera.json)
bun run actualizar           # pega a los sitios reales; 2 a 3 min; sale con 1 si alguna fuente falló
bun test                     # offline, sin red
bun test scraper/fuentes/cinexo.test.ts          # un archivo
bun test -t "trasnoche"                          # tests por nombre
bunx tsc --noEmit -p .       # no hay linter: los tipos son el chequeo estático
bun run build                # deja el sitio en dist/ con base relativa
bun .claude/skills/run-cartelera/driver.ts       # maneja la página con Edge/Chrome y saca capturas (necesita el dev server)
```

Siempre Bun, nunca npm ni npx.

## Arquitectura

La regla de negocio es una sola: se muestra toda función subtitulada (`SUB`), y una en castellano (`CAST`) solo si la película es hispanohablante. Está implementada en `esVisible` (`src/cartelera.ts`) y depende de `Pelicula.idiomaOriginal`, que decide el scraper.

`scraper/actualizar.ts` encadena el pipeline completo:

1. **`fuentes/todas.ts` → `bajarTodas`** llama a las tres fuentes y guarda cada resultado en `datos/fuentes/*.json`. Si una falla, usa su último resguardo y deja `EstadoFuente.ok = false`, para que la página siga mostrando ese cine con un aviso. Cada fuente devuelve `FuncionCruda[]` (`src/tipos.ts`):
   - `cinemark.ts`: un único JSON (`bff.cinemark.com.ar`) para Nuevocentro y Patio Olmos.
   - `cinexo.ts`: la API `apifront.cinexo.com.ar` por fecha para Las Tipas y Alta Gracia; las fechas salen del payload RSC de la home.
   - `cinemacenter.ts`: HTML en cp1252 de Alta Gracia, solo la semana en curso (`cubreHasta`).
2. **`idioma/resolver.ts` → `resolverIdiomas`** decide una sola vez el idioma original de cada título, en este orden: override manual (`datos/overrides.json`), cache (`datos/idiomas.json`), IMDb→Wikidata (idioma original P364, nunca el país) y el anexo de películas argentinas de es.wikipedia. Lo que no se resuelve queda `desconocido` y se reintenta en la próxima corrida. Los clientes se inyectan por parámetro para los tests.
3. **`unificacion/unificar.ts`** descarta lo ya empezado y lo marcado `ocultar`, identifica cada película (el id de IMDb une títulos distintos) y delega en `alta-gracia.ts`, que cruza Cinexo con Cinemacenter función por función y asigna `Funcion.estado`: `ok`, `conflicto`, `una_fuente` o `sospechosa` (sin precio en la página de compra de Cinexo).
4. **`validar.ts`** es una compuerta: si el JSON nuevo no cumple sus invariantes, no se escribe y la página conserva el anterior.

Alta Gracia es el único cine con dos fuentes que pueden discrepar en el idioma: ese caso se muestra con aviso, nunca se esconde.

La página (`src/`) es estática: `useCartelera` carga el JSON, `cartelera.ts` concentra las reglas puras (visibilidad, agrupado por película y por mes) y los componentes solo dibujan.

## Convenciones que cuestan descubrir

- **`diaDeCine` e `inicio` son distintos.** La trasnoche (00:00 a 06:00) pertenece al día de cine anterior pero empieza el día calendario siguiente. Cada fuente lo resuelve a su manera y `validar.ts` lo comprueba.
- **Las horas de Cinemark traen una `Z` falsa**: ya son hora de Córdoba. `parsearCinemark` falla si una trasnoche cae a las 04:00 o más (señal de que corrigieron la zona horaria).
- **Cero funciones es un error, no una semana sin cine.** Cinemacenter responde 200 con la grilla vacía ante parámetros mal formados, y las tres fuentes lanzan excepción en ese caso.
- **Las fuentes reciben `traer` o `entorno` por parámetro** (`http.ts` define `Traer`); los tests usan respuestas reales guardadas en `scraper/fixtures/` y nunca la red.
- **Una decisión puntual sobre un título va en `datos/overrides.json`** (`ocultar` o `idiomaOriginal`), no como regla en la lógica compartida.
- **`datos/` y `public/cartelera.json` se commitean**: el historial de git muestra cuándo un cine cambió el idioma de una función.

## Despliegue

`.github/workflows/actualizar.yml` corre al empujar a `main` y por cron (10, 13, 16, 19 y 22 h de Córdoba): tests, scraper, commit de los datos por el bot, build y deploy a Pages. Si una fuente falló, publica igual y el último paso falla a propósito para que llegue el mail. Como el bot commitea a `main`, hacer `git pull --rebase` antes de cada push. Los commits siguen Conventional Commits en español (`feat(ui): ...`, `fix(cinexo): ...`); el detalle está en `AGENTS.md`.

## Diseño

La interfaz imita la cartelera de un diario (serif editorial, mono para horarios, filetes finos, sin radios, sombras ni píldoras). Mantener ese concepto al tocar `src/estilos.css`, y verificar con capturas en escritorio y celular, en claro y oscuro.
