import { limpiarTitulo, normalizarClave } from "../texto"
import { peliculasArgentinas } from "./anexo"
import { buscarEnImdb } from "./imdb"
import type { CacheIdiomas, Decision, Overrides } from "./tipos"
import { consultarWikidata, decidirPorWikidata, type FilaWikidata } from "./wikidata"

type Pendiente = { titulo: string; banderas: string[] }

/** Fuentes externas; los tests las reemplazan para simular caídas sin red. */
export type ClientesIdioma = {
  buscarEnImdb: (titulo: string, anioMinimo: number) => Promise<string | undefined>
  consultarWikidata: (idsImdb: string[]) => Promise<Map<string, FilaWikidata>>
  peliculasArgentinas: (anios: number[]) => Promise<Set<string>>
}
const CLIENTES: ClientesIdioma = { buscarEnImdb, consultarWikidata, peliculasArgentinas }

/**
 * Decide el idioma original de cada título una sola vez y lo guarda en la cache.
 * Orden: override manual > cache > IMDb → Wikidata > anexo de películas argentinas.
 * Lo que no se resuelve queda "desconocido" y se reintenta en la próxima corrida.
 */
export async function resolverIdiomas(
  titulos: string[],
  cache: CacheIdiomas,
  overrides: Overrides,
  hoy: string,
  clientes = CLIENTES,
): Promise<Map<string, Decision>> {
  const overridesPorClave = new Map(Object.entries(overrides).map(([titulo, valor]) => [normalizarClave(titulo), valor]))
  const decisiones = new Map<string, Decision>()
  const pendientes = new Map<string, Pendiente>()
  for (const crudo of titulos) {
    const { titulo, banderas } = limpiarTitulo(crudo)
    const clave = normalizarClave(titulo)
    if (decisiones.has(clave) || pendientes.has(clave)) continue
    const conocida = decisionConocida(overridesPorClave.get(clave), banderas, cache[clave])
    if (conocida) decisiones.set(clave, conocida)
    else pendientes.set(clave, { titulo, banderas })
  }
  for (const [clave, decision] of await investigar(pendientes, Number(hoy.slice(0, 4)), clientes)) {
    decisiones.set(clave, decision)
    if (decision.idiomaOriginal !== "desconocido") cache[clave] = { ...decision, resuelto: hoy }
    else console.warn(`Idioma desconocido: "${pendientes.get(clave)!.titulo}" (se puede fijar en datos/overrides.json)`)
  }
  return decisiones
}

function decisionConocida(override: Overrides[string] | undefined, banderas: string[], enCache: Decision | undefined): Decision | undefined {
  if (override) {
    return {
      idiomaOriginal: override.idiomaOriginal ?? "desconocido",
      decididoPor: `manual${override.motivo ? `: ${override.motivo}` : ""}`,
      oculta: override.ocultar,
    }
  }
  if (banderas.includes("evento")) return { idiomaOriginal: "otro", decididoPor: "evento (contenido alternativo)" }
  return enCache
}

/** Consulta las fuentes externas para los títulos nuevos. Una fuente caída deja esos títulos sin decidir. */
async function investigar(pendientes: Map<string, Pendiente>, anioActual: number, clientes: ClientesIdioma): Promise<Map<string, Decision>> {
  const resultado = new Map<string, Decision>()
  if (!pendientes.size) return resultado

  const imdbPorClave = new Map<string, string>()
  for (const [clave, { titulo, banderas }] of pendientes) {
    try {
      const imdb = await clientes.buscarEnImdb(titulo, banderas.includes("reestreno") ? 0 : anioActual - 2)
      if (imdb) imdbPorClave.set(clave, imdb)
    } catch (error) {
      console.warn(`IMDb no respondió para "${titulo}": ${(error as Error).message}`)
    }
  }
  let filas = new Map<string, FilaWikidata>()
  try {
    if (imdbPorClave.size) filas = await clientes.consultarWikidata([...new Set(imdbPorClave.values())])
  } catch (error) {
    console.warn(`Wikidata no respondió: ${(error as Error).message}`)
  }

  let argentinas: Set<string> | undefined
  for (const clave of pendientes.keys()) {
    const imdb = imdbPorClave.get(clave)
    let decision = imdb && filas.has(imdb) ? decidirPorWikidata(filas.get(imdb)!) : undefined
    if (!decision) {
      // Los estrenos nacionales chicos no tienen ítem en Wikidata.
      argentinas ??= await clientes.peliculasArgentinas([anioActual, anioActual - 1]).catch((error: Error) => {
        console.warn(`Anexo de películas argentinas no disponible: ${error.message}`)
        return new Set<string>()
      })
      if (argentinas.has(clave)) decision = { idiomaOriginal: "es", decididoPor: "Anexo de películas argentinas" }
    }
    resultado.set(clave, { ...(decision ?? { idiomaOriginal: "desconocido", decididoPor: "sin datos" }), imdb })
  }
  return resultado
}
