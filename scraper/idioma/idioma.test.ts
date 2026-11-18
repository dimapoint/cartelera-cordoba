import { describe, expect, test } from "bun:test"
import { leerAnexo } from "./anexo"
import { elegirSugerencia } from "./imdb"
import { resolverIdiomas, type ClientesIdioma } from "./resolver"
import type { CacheIdiomas } from "./tipos"
import { decidirPorWikidata, type FilaWikidata } from "./wikidata"

describe("decidirPorWikidata", () => {
  test("decide por idioma original, nunca por país", () => {
    expect(decidirPorWikidata({ idiomas: ["es"], idiomasTitulo: [] })?.idiomaOriginal).toBe("es")
    expect(decidirPorWikidata({ idiomas: ["ja"], idiomasTitulo: ["ja"] })?.idiomaOriginal).toBe("otro")
    expect(decidirPorWikidata({ idiomas: ["th", "en"], idiomasTitulo: [] })?.idiomaOriginal).toBe("otro")
  })

  test("con español y otro idioma desempata el título original", () => {
    // Caballo salvaje nueve (Wild Horse Nine): inglés y español, título original en inglés.
    expect(decidirPorWikidata({ idiomas: ["es", "en"], idiomasTitulo: ["en"] })?.idiomaOriginal).toBe("otro")
    expect(decidirPorWikidata({ idiomas: ["es", "en"], idiomasTitulo: ["es"] })?.idiomaOriginal).toBe("es")
    expect(decidirPorWikidata({ idiomas: ["es", "en"], idiomasTitulo: [] })).toBeUndefined()
  })

  test("sin idioma original usa el del título; sin nada, no decide", () => {
    expect(decidirPorWikidata({ idiomas: [], idiomasTitulo: ["es"] })?.idiomaOriginal).toBe("es")
    expect(decidirPorWikidata({ idiomas: [], idiomasTitulo: ["en", "es"] })?.idiomaOriginal).toBe("otro")
    expect(decidirPorWikidata({ idiomas: [], idiomasTitulo: [] })).toBeUndefined()
  })
})

describe("elegirSugerencia", () => {
  const sugerencias = [
    { id: "tt1", qid: "movie", y: 1947 },
    { id: "tt2", qid: "short", y: 2025 },
    { id: "nm9" },
    { id: "tt3", qid: "movie", y: 2025 },
  ]
  test("descarta homónimos viejos, cortos y personas", () => expect(elegirSugerencia(sugerencias, 2024)).toBe("tt3"))
  test("en un reestreno acepta cualquier año", () => expect(elegirSugerencia(sugerencias, 0)).toBe("tt1"))
  test("sin candidatas no inventa", () => expect(elegirSugerencia([{ id: "tt2", qid: "short", y: 2025 }], 2024)).toBeUndefined())
})

describe("leerAnexo", () => {
  test("lee títulos, con y sin enlace", () => {
    const wikitexto = [
      '| rowspan="2" style="text-align:center;" |19',
      "| ''Carne'' || Tomás Marichal Urbán || Drama || Cine",
      "|-",
      "| ''[[La casa (película de 2025)|La casa]]'' || Gustavo Triviño || Drama",
      "| ''[[Perfume]]'' || Lucía S. Ruiz || Documental",
    ].join("\n")
    expect(leerAnexo(wikitexto)).toEqual(["Carne", "La casa", "Perfume"])
  })
  test("una página sin la tabla no devuelve nada", () => expect(leerAnexo("{{Esbozo}}\nTexto suelto")).toEqual([]))
})

/** Clientes falsos que anotan cada consulta. */
function clientesFalsos(respuestas: { imdb?: Record<string, string>; wikidata?: Record<string, FilaWikidata>; argentinas?: string[] } = {}) {
  const consultas = { imdb: [] as [string, number][], wikidata: [] as string[][], anexo: 0 }
  const clientes: ClientesIdioma = {
    buscarEnImdb: async (titulo, anioMinimo) => {
      consultas.imdb.push([titulo, anioMinimo])
      if (titulo === "ROTA") throw new Error("HTTP 503")
      return respuestas.imdb?.[titulo]
    },
    consultarWikidata: async (ids) => {
      consultas.wikidata.push(ids)
      if (!respuestas.wikidata) throw new Error("Wikidata caído")
      return new Map(Object.entries(respuestas.wikidata).filter(([id]) => ids.includes(id)))
    },
    peliculasArgentinas: async () => {
      consultas.anexo++
      return new Set(respuestas.argentinas ?? [])
    },
  }
  return { clientes, consultas }
}

describe("resolverIdiomas", () => {
  const HOY = "2026-11-18"

  test("el override manda y no consulta nada; ocultar se propaga", async () => {
    const { clientes, consultas } = clientesFalsos()
    const decisiones = await resolverIdiomas(
      ["LA CASA - 2D CAST", "Cordobeces"],
      {},
      { "La Casa": { idiomaOriginal: "es", motivo: "argentina" }, CORDOBECES: { ocultar: true } },
      HOY,
      clientes,
    )
    expect(decisiones.get("la casa")).toMatchObject({ idiomaOriginal: "es", decididoPor: "manual: argentina" })
    expect(decisiones.get("cordobeces")).toMatchObject({ idiomaOriginal: "desconocido", oculta: true })
    expect(consultas).toEqual({ imdb: [], wikidata: [], anexo: 0 })
  })

  test("eventos y títulos en cache no se consultan", async () => {
    const { clientes, consultas } = clientesFalsos()
    const cache: CacheIdiomas = {
      "godzilla minus zero": { idiomaOriginal: "otro", decididoPor: "Wikidata", imdb: "tt34384661", resuelto: "2026-11-01" },
    }
    const decisiones = await resolverIdiomas(["GODZILLA MINUS ZERO - 2D SUB", "BTS WORLD TOUR 'ARIRANG' IN JAKARTA"], cache, {}, HOY, clientes)
    expect(decisiones.get("godzilla minus zero")?.imdb).toBe("tt34384661")
    expect(decisiones.get("bts world tour arirang in jakarta")?.decididoPor).toContain("evento")
    expect(consultas.imdb).toEqual([])
  })

  test("el mismo título con distintos sufijos se consulta una sola vez", async () => {
    const { clientes, consultas } = clientesFalsos({ imdb: { "MADRE SINIESTRA": "tt1" }, wikidata: { tt1: { idiomas: ["en"], idiomasTitulo: [] } } })
    await resolverIdiomas(["MADRE SINIESTRA - 2D SUB", "MADRE SINIESTRA - 2D CAST", "Madre siniestra"], {}, {}, HOY, clientes)
    expect(consultas.imdb).toEqual([["MADRE SINIESTRA", 2024]])
    expect(consultas.wikidata).toEqual([["tt1"]])
  })

  test("un reestreno busca sin límite de año", async () => {
    const { clientes, consultas } = clientesFalsos()
    await resolverIdiomas(["ROCKY 50° ANIVERSARIO"], {}, {}, HOY, clientes)
    expect(consultas.imdb[0]).toEqual(["ROCKY", 0])
  })

  test("si IMDb falla para un título, ese queda desconocido sin cachear y los demás se resuelven", async () => {
    const { clientes } = clientesFalsos({ imdb: { BIEN: "tt2" }, wikidata: { tt2: { idiomas: ["es"], idiomasTitulo: [] } } })
    const cache: CacheIdiomas = {}
    const decisiones = await resolverIdiomas(["ROTA", "BIEN"], cache, {}, HOY, clientes)
    expect(decisiones.get("rota")?.idiomaOriginal).toBe("desconocido")
    expect(decisiones.get("bien")).toMatchObject({ idiomaOriginal: "es", imdb: "tt2" })
    expect(Object.keys(cache)).toEqual(["bien"])
    expect(cache.bien.resuelto).toBe(HOY)
  })

  test("con Wikidata caído cae al anexo argentino, que se pide una sola vez", async () => {
    const { clientes, consultas } = clientesFalsos({ imdb: { CARNE: "tt3", OTRA: "tt4" }, argentinas: ["carne"] })
    const decisiones = await resolverIdiomas(["CARNE", "OTRA", "TERCERA"], {}, {}, HOY, clientes)
    expect(decisiones.get("carne")).toMatchObject({ idiomaOriginal: "es", decididoPor: "Anexo de películas argentinas", imdb: "tt3" })
    expect(decisiones.get("otra")?.idiomaOriginal).toBe("desconocido")
    expect(decisiones.get("tercera")?.idiomaOriginal).toBe("desconocido")
    expect(consultas.anexo).toBe(1)
  })

  test("con el anexo caído no explota: queda desconocido", async () => {
    const { clientes } = clientesFalsos()
    clientes.peliculasArgentinas = async () => {
      throw new Error("HTTP 502")
    }
    const decisiones = await resolverIdiomas(["ALGO"], {}, {}, HOY, clientes)
    expect(decisiones.get("algo")?.idiomaOriginal).toBe("desconocido")
  })

  test("IMDb encuentra la película pero Wikidata no tiene el ítem: prueba el anexo", async () => {
    const { clientes } = clientesFalsos({ imdb: { "RECEN POR MÍ": "tt5" }, wikidata: {}, argentinas: ["recen por mi"] })
    const decisiones = await resolverIdiomas(["RECEN POR MÍ"], {}, {}, HOY, clientes)
    expect(decisiones.get("recen por mi")).toMatchObject({ idiomaOriginal: "es", imdb: "tt5" })
  })
})
