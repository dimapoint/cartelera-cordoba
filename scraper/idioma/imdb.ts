import { esperar, leerJsonDe, traerTexto } from "../http"
import { normalizarClave } from "../texto"

const TIPOS_PELICULA = new Set(["movie", "tvMovie", "video"])
type Sugerencia = { id: string; qid?: string; y?: number }

/** Busca el id de IMDb (tt…) de un título en castellano con el buscador de sugerencias (no oficial, sin key). */
export async function buscarEnImdb(titulo: string, anioMinimo: number, anioMaximo = Infinity): Promise<string | undefined> {
  const clave = normalizarClave(titulo)
  // "la asistente de la morgue" no sugiere nada; sin el artículo sí (The Mortuary Assistant).
  const variantes = [...new Set([clave, clave.replace(/^(el|la|los|las|un|una) /, "")])]
  for (const variante of variantes) {
    const respuesta = leerJsonDe(await traerTexto(`https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(variante)}.json?includeVideos=0`), "IMDb")
    await esperar(500)
    const elegida = elegirSugerencia(respuesta.d ?? [], anioMinimo, anioMaximo)
    if (elegida) return elegida
  }
  return undefined
}

/** Primera película de las sugerencias dentro del rango de años (por defecto, los últimos años: evita homónimos viejos). */
export function elegirSugerencia(sugerencias: Sugerencia[], anioMinimo: number, anioMaximo = Infinity): string | undefined {
  return sugerencias.find((sugerencia) => {
    const anio = sugerencia.y ?? 0
    return TIPOS_PELICULA.has(sugerencia.qid ?? "") && anio >= anioMinimo && anio <= anioMaximo
  })?.id
}
