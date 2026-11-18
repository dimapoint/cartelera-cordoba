import { AGENTE_WIKIMEDIA, leerJsonDe, traerTexto } from "../http"
import type { Decision } from "./tipos"

export type FilaWikidata = { idiomas: string[]; idiomasTitulo: string[] }

/** Idioma original (P364) y del título original (P1476) de muchas películas en una sola consulta, por id de IMDb. */
export async function consultarWikidata(idsImdb: string[]): Promise<Map<string, FilaWikidata>> {
  const consulta = `SELECT ?imdb (GROUP_CONCAT(DISTINCT ?codigo; separator="|") AS ?idiomas)
    (GROUP_CONCAT(DISTINCT LANG(?titulo); separator="|") AS ?idiomasTitulo) WHERE {
    VALUES ?imdb { ${idsImdb.map((identificador) => `"${identificador}"`).join(" ")} }
    ?item wdt:P345 ?imdb .
    OPTIONAL { ?item wdt:P364 ?idioma . ?idioma wdt:P218 ?codigo . }
    OPTIONAL { ?item wdt:P1476 ?titulo . }
  } GROUP BY ?imdb`
  const texto = await traerTexto("https://query.wikidata.org/sparql", {
    method: "POST",
    headers: { "User-Agent": AGENTE_WIKIMEDIA, Accept: "application/sparql-results+json", "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ query: consulta }),
  })
  const respuesta = leerJsonDe(texto, "Wikidata")
  if (!Array.isArray(respuesta?.results?.bindings)) throw new Error("Wikidata: cambió la forma de la respuesta")
  const lista = (valor?: { value: string }) => (valor?.value ?? "").split("|").filter(Boolean)
  return new Map(
    respuesta.results.bindings.map((fila: Record<string, { value: string }>) => [
      fila.imdb.value,
      { idiomas: lista(fila.idiomas), idiomasTitulo: lista(fila.idiomasTitulo) },
    ]),
  )
}

/** Manda el idioma original (P364), nunca el país: Digger es coproducción con México y está en inglés. */
export function decidirPorWikidata(fila: FilaWikidata): Decision | undefined {
  const tituloEnEspaniol = fila.idiomasTitulo.length ? fila.idiomasTitulo.every((codigo) => codigo === "es") : undefined
  if (fila.idiomas.length) {
    if (fila.idiomas.every((codigo) => codigo === "es")) return { idiomaOriginal: "es", decididoPor: "Wikidata (idioma original)" }
    if (!fila.idiomas.includes("es")) return { idiomaOriginal: "otro", decididoPor: `Wikidata (idioma original: ${fila.idiomas.join(", ")})` }
    // Español y otro idioma (Caballo salvaje nueve: inglés y español, filmada en Chile): desempata el título original.
    if (tituloEnEspaniol === undefined) return undefined
    return { idiomaOriginal: tituloEnEspaniol ? "es" : "otro", decididoPor: `Wikidata (idiomas ${fila.idiomas.join(", ")}; título original)` }
  }
  if (tituloEnEspaniol === undefined) return undefined
  return { idiomaOriginal: tituloEnEspaniol ? "es" : "otro", decididoPor: "Wikidata (idioma del título original)" }
}
