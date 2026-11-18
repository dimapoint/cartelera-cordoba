import { join } from "node:path"
import type { Fuente } from "../src/tipos"

const RAIZ = join(import.meta.dir, "..")

/** Archivos que el scraper lee y escribe; todos se commitean para que la próxima corrida los encuentre. */
export const RUTAS = {
  fuente: (fuente: Fuente) => join(RAIZ, "datos", "fuentes", `${fuente}.json`),
  cacheIdiomas: join(RAIZ, "datos", "idiomas.json"),
  overrides: join(RAIZ, "datos", "overrides.json"),
  cartelera: join(RAIZ, "public", "cartelera.json"),
}

export async function leerJson<Tipo>(ruta: string, porDefecto: Tipo): Promise<Tipo> {
  return (await Bun.file(ruta).exists()) ? Bun.file(ruta).json() : porDefecto
}

export async function escribirJson(ruta: string, datos: unknown): Promise<void> {
  await Bun.write(ruta, `${JSON.stringify(datos, null, 1)}\n`)
}
