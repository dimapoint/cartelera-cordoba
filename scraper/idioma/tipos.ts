import type { IdiomaOriginal } from "../../src/tipos"

export type Decision = { idiomaOriginal: IdiomaOriginal; decididoPor: string; imdb?: string; oculta?: boolean }

/** datos/overrides.json: título como lo publica el cine → idioma forzado u ocultar la película. */
export type Overrides = Record<string, { idiomaOriginal?: IdiomaOriginal; ocultar?: boolean; motivo?: string }>

/** datos/idiomas.json: decisiones ya tomadas, por clave de título. */
export type CacheIdiomas = Record<string, Decision & { resuelto: string }>
