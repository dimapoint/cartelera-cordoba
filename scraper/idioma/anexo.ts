import { AGENTE_WIKIMEDIA, traerTexto } from "../http"
import { claveDe } from "../texto"

/** Claves de los estrenos argentinos de esos años, según los anexos de es.wikipedia. */
export async function peliculasArgentinas(anios: number[]): Promise<Set<string>> {
  const claves = new Set<string>()
  for (const anio of anios) {
    try {
      const pagina = encodeURIComponent(`Anexo:Películas argentinas de ${anio}`)
      const wikitexto = await traerTexto(`https://es.wikipedia.org/w/index.php?title=${pagina}&action=raw`, {
        headers: { "User-Agent": AGENTE_WIKIMEDIA },
      })
      for (const titulo of leerAnexo(wikitexto)) claves.add(claveDe(titulo))
    } catch (error) {
      console.warn(`No pude leer el anexo de películas argentinas de ${anio}: ${(error as Error).message}`)
    }
  }
  return claves
}

/** Títulos de la tabla de estrenos: filas "| ''Título'' || Director || ...". */
export function leerAnexo(wikitexto: string): string[] {
  return [...wikitexto.matchAll(/^\|\s*''(.+?)''\s*\|\|/gm)].map(([, titulo]) => titulo.replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1"))
}
