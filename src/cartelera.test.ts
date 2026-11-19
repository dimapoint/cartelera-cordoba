import { describe, expect, test } from "bun:test"
import { agruparDiasPorMes, agruparPorPelicula, diasConFunciones, esVisible, etiquetaDelDia, formatearMarca, fuentesCriticasCaidas } from "./cartelera"
import { ahoraEnCordoba, sumarDias } from "./fechas"
import type { Cine, Funcion, IdiomaOriginal, Pelicula } from "./tipos"

const pelicula = (idiomaOriginal: IdiomaOriginal, id = "tt1", titulo = "X"): Pelicula => ({ id, titulo, idiomaOriginal, decididoPor: "prueba" })
const funcion = (cambios: Partial<Funcion> = {}): Funcion => ({
  cine: "lastipas",
  pelicula: "tt1",
  diaDeCine: "2026-11-18",
  inicio: "2026-11-18T20:00",
  formato: "2D",
  version: "CAST",
  estado: "ok",
  ...cambios,
})

describe("esVisible: la regla del usuario", () => {
  test("subtitulada siempre se muestra", () => expect(esVisible(funcion({ version: "SUB" }), pelicula("otro"), false)).toBe(true))
  test("castellano de una película extranjera nunca, ni con dudosas", () => expect(esVisible(funcion(), pelicula("otro"), true)).toBe(false))
  test("castellano de una película hispanohablante sí", () => expect(esVisible(funcion(), pelicula("es"), false)).toBe(true))
  test("castellano de idioma desconocido solo si se piden las dudosas", () => {
    expect(esVisible(funcion(), pelicula("desconocido"), false)).toBe(false)
    expect(esVisible(funcion(), pelicula("desconocido"), true)).toBe(true)
  })
  test("un conflicto donde algún sitio dice SUB se muestra, para que el aviso se vea", () => {
    expect(esVisible(funcion({ estado: "conflicto", segun: { cinexo: "CAST", cinemacenter: "SUB" } }), pelicula("otro"), false)).toBe(true)
  })
})

describe("agruparPorPelicula", () => {
  const peliculas = new Map([
    // Ni el largo ni el orden por código (que manda "Á" después de "Z") dan el orden alfabético.
    ["tt1", pelicula("otro", "tt1", "Zoe")],
    ["tt2", pelicula("otro", "tt2", "Ánimas")],
    ["tt3", pelicula("otro", "tt3", "Batman Begins")],
  ])
  const funciones = [
    funcion({ pelicula: "tt1" }),
    funcion({ pelicula: "tt2", cine: "nuevocentro" }),
    funcion({ pelicula: "tt3" }),
    funcion({ pelicula: "tt3", inicio: "2026-11-18T22:00" }),
    funcion({ pelicula: "tt1", diaDeCine: "2026-11-19", inicio: "2026-11-19T20:00" }),
  ]
  const todos = new Set<Cine>(["lastipas", "nuevocentro"])

  test("ordena alfabéticamente respetando tildes", () => {
    expect(agruparPorPelicula(funciones, peliculas, "2026-11-18", todos).map((grupo) => grupo.pelicula.titulo)).toEqual(["Ánimas", "Batman Begins", "Zoe"])
  })
  test("junta las funciones de la misma película", () => {
    expect(agruparPorPelicula(funciones, peliculas, "2026-11-18", todos).find((grupo) => grupo.pelicula.id === "tt3")?.funciones).toHaveLength(2)
  })
  test("filtra por día y por cines elegidos", () => {
    expect(agruparPorPelicula(funciones, peliculas, "2026-11-19", todos).map((grupo) => grupo.pelicula.id)).toEqual(["tt1"])
    expect(agruparPorPelicula(funciones, peliculas, "2026-11-18", new Set<Cine>(["nuevocentro"])).map((grupo) => grupo.pelicula.id)).toEqual(["tt2"])
    expect(agruparPorPelicula(funciones, peliculas, "2026-11-18", new Set())).toEqual([])
  })
})

describe("fuentesCriticasCaidas", () => {
  const bien = { ok: true, actualizado: "2026-11-18T10:00" }
  const mal = { ok: false, actualizado: "2026-11-18T07:00", error: "timeout" }

  test("Cinemacenter caído no cuenta: ni avisa en la página ni hace fallar la Action", () => {
    expect(fuentesCriticasCaidas({ cinemark: bien, cinexo: bien, cinemacenter: mal })).toEqual([])
  })
  test("Cinemark o Cinexo caídos sí cuentan, aunque Cinemacenter también lo esté", () => {
    expect(fuentesCriticasCaidas({ cinemark: mal, cinexo: bien, cinemacenter: mal })).toEqual(["cinemark"])
    expect(fuentesCriticasCaidas({ cinemark: mal, cinexo: mal, cinemacenter: bien })).toEqual(["cinemark", "cinexo"])
  })
  test("con todo bien no hay nada que avisar", () => {
    expect(fuentesCriticasCaidas({ cinemark: bien, cinexo: bien, cinemacenter: bien })).toEqual([])
  })
})

describe("días y fechas", () => {
  test("días únicos y ordenados", () => {
    expect(diasConFunciones([funcion({ diaDeCine: "2026-11-20" }), funcion(), funcion()])).toEqual(["2026-11-18", "2026-11-20"])
  })
  test("Hoy, Mañana (también a fin de mes) y el día de la semana", () => {
    expect(etiquetaDelDia("2026-11-30", "2026-11-30")).toBe("Hoy")
    expect(etiquetaDelDia("2026-12-01", "2026-11-30")).toBe("Mañana")
    expect(etiquetaDelDia("2026-11-19", "2026-11-16")).toBe("jue")
  })
  test("agrupa los días por mes, también cuando hay un hueco de semanas, y anota el año solo si cambia", () => {
    const grupos = agruparDiasPorMes(["2026-11-30", "2026-12-01", "2026-12-02", "2026-12-15", "2026-12-29", "2027-01-02"], "2026-11-18")
    expect(grupos.map((grupo) => [grupo.nombre, grupo.dias.length])).toEqual([["nov", 1], ["dic", 4], ["ene 2027", 1]])
    expect(grupos[1].dias).toEqual(["2026-12-01", "2026-12-02", "2026-12-15", "2026-12-29"])
    expect(agruparDiasPorMes([], "2026-11-18")).toEqual([])
  })
  test("sumarDias cruza meses, años y febrero", () => {
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01")
    expect(sumarDias("2026-03-01", -1)).toBe("2026-02-28")
    expect(sumarDias("2028-03-01", -1)).toBe("2028-02-29")
  })
  test("la hora de Córdoba es UTC-3 y cambia de día a las 03:00 UTC", () => {
    expect(ahoraEnCordoba(new Date("2026-11-18T02:30:00Z"))).toBe("2026-11-17T23:30")
    expect(ahoraEnCordoba(new Date("2026-11-18T03:00:00Z"))).toBe("2026-11-18T00:00")
  })
  test("formatea la marca de actualización", () => expect(formatearMarca("2026-11-18T15:55")).toBe("18/11 a las 15:55"))
})
