# Repository Guidelines

## Project Structure

This repository combines a Bun and TypeScript scraper with a React and Vite site. The UI lives in `src/`; reusable page sections are in `src/componentes/`. Scraping code is under `scraper/fuentes/`, language resolution under `scraper/idioma/`, and schedule normalization under `scraper/unificacion/`. Tests sit beside the modules they cover. Real response fixtures are in `scraper/fixtures/`. Persistent source caches and manual language overrides live in `datos/`; the site reads the generated `public/cartelera.json`. GitHub Actions configuration is in `.github/workflows/`.

## Development Commands

- `bun install` installs the locked dependencies.
- `bun run dev` starts Vite at `http://localhost:5173/`.
- `bun run actualizar` fetches cinema schedules and refreshes the JSON data. It contacts the live cinema sites and language sources.
- `bun test` runs the offline test suite.
- `bunx tsc --noEmit -p .` checks TypeScript without emitting files.
- `bun run build` builds the deployable site into `dist/`.

## Code Style

Use TypeScript and React in the existing module layout. Follow nearby formatting: two-space indentation, double quotes, semicolons only where surrounding code uses them, and descriptive Spanish names for domain concepts. Use `PascalCase` for React components and types, and `camelCase` for functions and values. Keep source-specific parsing in its cinema module. Put manual language decisions in `datos/overrides.json` rather than embedding one-off title rules in shared logic.

## Tests

Use Bun's built-in test runner. Name test files `*.test.ts` and keep them beside the code they exercise. Scraper tests should use saved fixtures and injected HTTP responses; ordinary tests must not depend on live cinema sites. When changing schedule parsing or visibility rules, cover the relevant boundary case as well as the normal case.

## Commits and Pull Requests

Use Conventional Commits with a Spanish, imperative summary: `tipo(alcance): resumen`, for example `feat(ui): rediseño con estilo de cartelera de diario` or `fix(cinemark): ...`. Types in use are `feat`, `fix`, `refactor`, `test`, `docs`, `chore` and `style`; scopes are usually a module (`ui`, `cinemark`, `cinexo`, `cinemacenter`, `idioma`, `unificacion`, `datos`). Keep each commit focused. Commits made before this convention (and the bot's `Actualizar cartelera` ones in the history) are not rewritten. Pull requests should explain the user-visible change, list verification commands run, and include screenshots for visual changes. Note any schedule-source or language-resolution behavior that changes.

## Data and Secrets

Do not commit credentials, cookies, or personal tokens. Preserve existing cached source data when a fetch fails; the scraper uses it to avoid replacing good schedules with incomplete data. Treat `datos/overrides.json` as the maintained source for manual title decisions.
