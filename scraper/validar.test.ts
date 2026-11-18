import { describe, expect, test } from "bun:test"
import type { Cartelera, Funcion } from "../src/tipos"
import { leerFixtureCp1252, leerFixtureJson } from "./fixtures/ayudas"
import { parsearGrilla } from "./fuentes/cinemacenter"
import { parsearCinemark } from "./fuentes/cinemark"
import { parsearCinexo } from "./fuentes/cinexo"
import { unificar } from "./unificacion/unificar"
import { validarCartelera } from "./validar"

const ESTADO = { ok: true, actualizado: "2026-11-18T10:00" }
const funcion = (cambios: Partial<Funcion> = {}): Funcion => ({
  cine: "lastipas",
  pelicula: "tt1",
  diaDeCine: "2026-11-18",
  inicio: "2026-11-18T21:30",
  formato: "2D",
  version: "SUB",
  estado: "ok",
  ...cambios,
})
const cartelera = (funciones: Funcion[], cambios: Partial<Cartelera> = {}): Cartelera => ({
  generado: "2026-11-18T10:00",
  fuentes: { cinemark: ESTADO, cinexo: ESTADO, cinemacenter: ESTADO },
  peliculas: [{ id: "tt1", titulo: "MADRE SINIESTRA", idiomaOriginal: "otro", decididoPor: "prueba" }],
  funciones,
  ...cambios,
})

describe("validarCartelera", () => {
  test("una cartelera sana no tiene errores, incluida una trasnoche", () => {
    expect(validarCartelera(cartelera([funcion(), funcion({ diaDeCine: "2026-11-18", inicio: "2026-11-19T00:30" })]))).toEqual([])
  })

  test("detecta funciones de películas que no existen", () => {
    expect(validarCartelera(cartelera([funcion({ pelicula: "tt404" })]))).toEqual(["lastipas 2026-11-18T21:30: la película tt404 no existe"])
  })

  test("detecta valores fuera de lo conocido", () => {
    const errores = validarCartelera(cartelera([funcion({ version: "DOB" as never, cine: "otro" as never, estado: "raro" as never })]))
    expect(errores).toHaveLength(3)
  })

  test("detecta horas mal formadas o que no cuadran con el día de cine", () => {
    expect(validarCartelera(cartelera([funcion({ inicio: "2026-11-18 21:30" })]))[0]).toContain("formato raro")
    expect(validarCartelera(cartelera([funcion({ inicio: "2026-11-19T15:00" })]))[0]).toContain("no cuadra")
    expect(validarCartelera(cartelera([funcion({ inicio: "2026-11-17T21:30" })]))[0]).toContain("no cuadra")
    // Una hora de UTC mal convertida: la trasnoche quedaría tres horas más tarde.
    expect(validarCartelera(cartelera([funcion({ inicio: "2026-11-19T08:00" })]))[0]).toContain("no cuadra")
  })

  test("un conflicto tiene que traer dos versiones distintas", () => {
    expect(validarCartelera(cartelera([funcion({ estado: "conflicto", segun: { cinexo: "SUB" } })]))[0]).toContain("conflicto")
    expect(validarCartelera(cartelera([funcion({ estado: "conflicto", segun: { cinexo: "SUB", cinemacenter: "SUB" } })]))[0]).toContain("conflicto")
  })

  test("detecta películas repetidas, sin título o con idioma inválido", () => {
    const pelicula = { id: "tt1", titulo: "X", idiomaOriginal: "otro" as const, decididoPor: "prueba" }
    expect(validarCartelera(cartelera([], { peliculas: [pelicula, pelicula] }))).toContain("hay ids de película repetidos")
    expect(validarCartelera(cartelera([], { peliculas: [{ ...pelicula, titulo: " " }] }))).toContain("la película tt1 no tiene título")
    expect(validarCartelera(cartelera([], { peliculas: [{ ...pelicula, idiomaOriginal: "fr" as never }] }))[0]).toContain('idioma "fr"')
  })

  test("las respuestas reales de los tres sitios pasan juntas por toda la cadena sin errores", async () => {
    const crudas = [
      ...parsearCinemark((await leerFixtureJson("cinemark_showtimes.json")).data, (await leerFixtureJson("cinemark_movies.json")).data),
      ...parsearCinexo((await leerFixtureJson("cinexo_4000_2026-12-16.json")).data, "altagracia", "https://www.cinealtagracia.com.ar", "2026-12-16"),
      ...parsearGrilla(await leerFixtureCp1252("cinemacenter_grilla_6111.html"), { id: "6111", titulo: "PLUMAS OPERACION RESCATE - 2D CAST" }),
    ]
    const { peliculas, funciones } = await unificar({
      crudas,
      decisiones: new Map(),
      ahora: "2026-11-16T09:00",
      cinemacenterHasta: "2026-11-18",
      tieneVenta: async () => true,
    })
    expect(funciones.length).toBe(crudas.length)
    expect(validarCartelera(cartelera(funciones, { generado: "2026-11-16T09:00", peliculas }))).toEqual([])
  })
})
