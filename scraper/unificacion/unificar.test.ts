import { describe, expect, test } from "bun:test"
import type { FuncionCruda } from "../../src/tipos"
import { crudaDePrueba as cruda } from "../fixtures/ayudas"
import type { Decision } from "../idioma/tipos"
import { unificar } from "./unificar"

const AHORA = "2026-11-18T10:00"
const decisiones = new Map<string, Decision>([
  ["madre siniestra", { idiomaOriginal: "otro", decididoPor: "prueba", imdb: "tt36586020" }],
  ["la sombra", { idiomaOriginal: "otro", decididoPor: "prueba", imdb: "tt99" }],
  ["the shadow", { idiomaOriginal: "otro", decididoPor: "prueba", imdb: "tt99" }],
  ["cordobeces", { idiomaOriginal: "es", decididoPor: "prueba", oculta: true }],
])
const deCinemacenter = (cambios: Partial<FuncionCruda>) => cruda({ fuente: "cinemacenter", ...cambios })
const conVenta = async () => true

const correr = (crudas: FuncionCruda[], opciones: { cinemacenterHasta?: string; tieneVenta?: (compra: string) => Promise<boolean> } = {}) =>
  unificar({ crudas, decisiones, ahora: AHORA, cinemacenterHasta: "2026-11-18", tieneVenta: conVenta, ...opciones })
const estados = (funciones: { inicio: string; estado: string }[]) => funciones.map((funcion) => [funcion.inicio, funcion.estado])

describe("cruce de Alta Gracia", () => {
  test("si los dos sitios dicen lo mismo, queda ok con las dos versiones a la vista", async () => {
    const { funciones } = await correr([cruda({}), deCinemacenter({})])
    expect(funciones).toHaveLength(1)
    expect(funciones[0]).toMatchObject({ estado: "ok", segun: { cinexo: "SUB", cinemacenter: "SUB" } })
  })

  test("si no coinciden en el idioma, es conflicto y no se esconde", async () => {
    const { funciones } = await correr([cruda({ version: "CAST" }), deCinemacenter({ version: "SUB" })])
    expect(funciones[0]).toMatchObject({ estado: "conflicto", version: "CAST", segun: { cinexo: "CAST", cinemacenter: "SUB" } })
  })

  test("empareja aunque los títulos difieran entre sitios", async () => {
    const { funciones } = await correr([
      cruda({ titulo: "EBENEZER", inicio: "2026-11-18T22:00" }),
      deCinemacenter({ titulo: "EBENEZER: LOS FANTASMAS DE NAVIDAD", inicio: "2026-11-18T22:00" }),
      cruda({ titulo: "El Bosque Salvaje: Wildwood", inicio: "2026-11-18T17:10", version: "CAST" }),
      deCinemacenter({ titulo: "WILDWOOD: EL BOSQUE SALVAJE", inicio: "2026-11-18T17:10", version: "CAST" }),
    ])
    expect(estados(funciones)).toEqual([
      ["2026-11-18T17:10", "ok"],
      ["2026-11-18T22:00", "ok"],
    ])
  })

  test("con dos películas a la misma hora empareja cada una con la suya", async () => {
    const { funciones } = await correr([
      cruda({ titulo: "MADRE SINIESTRA", version: "SUB" }),
      cruda({ titulo: "CÓMO ROBAR UN BANCO", version: "CAST" }),
      deCinemacenter({ titulo: "COMO ROBAR UN BANCO", version: "CAST" }),
      deCinemacenter({ titulo: "MADRE SINIESTRA", version: "SUB" }),
    ])
    expect(funciones.map((funcion) => funcion.estado)).toEqual(["ok", "ok"])
  })

  test("la misma película en varios días se empareja por hora exacta, no por título", async () => {
    // Cinemacenter las lista en otro orden: sin mirar la hora, el miércoles SUB caería contra el jueves CAST.
    const { funciones } = await correr([
      cruda({ diaDeCine: "2026-11-18", inicio: "2026-11-18T21:30", version: "SUB" }),
      cruda({ diaDeCine: "2026-11-19", inicio: "2026-11-19T21:30", version: "CAST" }),
      deCinemacenter({ diaDeCine: "2026-11-19", inicio: "2026-11-19T21:30", version: "CAST" }),
      deCinemacenter({ diaDeCine: "2026-11-18", inicio: "2026-11-18T21:30", version: "SUB" }),
    ])
    expect(funciones.map((funcion) => funcion.estado)).toEqual(["ok", "ok"])
  })

  test("títulos sin palabras en común pero con el mismo IMDb se emparejan", async () => {
    const { funciones } = await correr([cruda({ titulo: "LA SOMBRA" }), deCinemacenter({ titulo: "THE SHADOW" })])
    expect(funciones).toHaveLength(1)
    expect(funciones[0].estado).toBe("ok")
  })

  test("títulos sin nada en común y sin IMDb quedan separados (límite conocido: se ven como una_fuente)", async () => {
    const { funciones } = await correr([cruda({ titulo: "PELÍCULA UNO" }), deCinemacenter({ titulo: "OTRO NOMBRE" })])
    expect(funciones.map((funcion) => funcion.estado)).toEqual(["una_fuente", "una_fuente"])
  })

  test("solo en Cinexo y sin precio es sospechosa; con precio, una_fuente dentro de la semana de Cinemacenter", async () => {
    const tieneVenta = async (compra: string) => compra !== "sin-precio"
    const { funciones } = await correr(
      [cruda({ inicio: "2026-11-18T19:00", compra: "sin-precio" }), cruda({ inicio: "2026-11-18T20:00", compra: "con-precio" })],
      { tieneVenta },
    )
    expect(estados(funciones)).toEqual([
      ["2026-11-18T19:00", "sospechosa"],
      ["2026-11-18T20:00", "una_fuente"],
    ])
  })

  test("fuera de la semana de Cinemacenter no hay con qué comparar: queda ok sin marca", async () => {
    const { funciones } = await correr([cruda({ diaDeCine: "2026-11-24", inicio: "2026-11-24T21:30", compra: "x" })])
    expect(funciones[0]).toMatchObject({ estado: "ok", segun: undefined })
  })

  test("si la consulta de venta falla, no la marca sospechosa sin evidencia", async () => {
    const tieneVenta = async () => {
      throw new Error("timeout")
    }
    const { funciones } = await correr([cruda({ compra: "x" })], { tieneVenta })
    expect(funciones[0].estado).toBe("una_fuente")
  })

  test("sin datos de Cinemacenter (fuente caída desde siempre) no marca nada como una_fuente", async () => {
    const { funciones } = await correr([cruda({ compra: "x" })], { cinemacenterHasta: undefined })
    expect(funciones[0].estado).toBe("ok")
  })

  test("lo que solo publica Cinemacenter también se muestra, marcado", async () => {
    const { funciones } = await correr([deCinemacenter({ titulo: "PLUMAS OPERACION RESCATE", version: "CAST" })])
    expect(funciones[0]).toMatchObject({ estado: "una_fuente", segun: { cinemacenter: "CAST" } })
  })
})

describe("unificar", () => {
  test("los otros cines pasan directo, sin marcas", async () => {
    const { funciones } = await correr([cruda({ fuente: "cinemark", cine: "nuevocentro" }), cruda({ cine: "lastipas" })])
    expect(funciones.map((funcion) => [funcion.cine, funcion.estado, funcion.segun])).toEqual([
      ["lastipas", "ok", undefined],
      ["nuevocentro", "ok", undefined],
    ])
  })

  test("saca las funciones de ayer pero deja la trasnoche de ayer que todavía no empezó", async () => {
    const { funciones } = await correr([
      cruda({ cine: "lastipas", diaDeCine: "2026-11-17", inicio: "2026-11-17T22:00" }),
      cruda({ cine: "lastipas", diaDeCine: "2026-11-17", inicio: "2026-11-18T00:30" }),
    ])
    expect(estados(funciones)).toEqual([]) // a las 10:00 del 18 la trasnoche de las 00:30 ya pasó
    const deMadrugada = await unificar({
      crudas: [cruda({ cine: "lastipas", diaDeCine: "2026-11-17", inicio: "2026-11-18T00:30" })],
      decisiones,
      ahora: "2026-11-18T00:10",
      tieneVenta: conVenta,
    })
    expect(deMadrugada.funciones).toHaveLength(1)
  })

  test("las películas ocultas no aparecen ni en funciones ni en películas", async () => {
    const { funciones, peliculas } = await correr([cruda({ cine: "lastipas", titulo: "Cordobeces" })])
    expect(funciones).toEqual([])
    expect(peliculas).toEqual([])
  })

  test("un mismo IMDb con títulos distintos es una sola película, y completa el póster de otra fuente", async () => {
    const { peliculas, funciones } = await correr([
      cruda({ fuente: "cinemark", cine: "nuevocentro", titulo: "LA SOMBRA" }),
      cruda({ cine: "lastipas", titulo: "THE SHADOW", poster: "https://poster", duracion: 100 }),
    ])
    expect(peliculas).toEqual([{ id: "tt99", titulo: "LA SOMBRA", poster: "https://poster", duracion: 100, idiomaOriginal: "otro", decididoPor: "prueba" }])
    expect(new Set(funciones.map((funcion) => funcion.pelicula))).toEqual(new Set(["tt99"]))
  })

  test("sin decisión de idioma la película queda desconocida, identificada por título", async () => {
    const { peliculas } = await correr([cruda({ cine: "lastipas", titulo: "ALGO NUEVO - 2D SUB" })])
    expect(peliculas[0]).toMatchObject({ id: "titulo:algo nuevo", titulo: "ALGO NUEVO", idiomaOriginal: "desconocido" })
  })

  test("ordena por hora de inicio", async () => {
    const { funciones } = await correr([
      cruda({ cine: "lastipas", inicio: "2026-11-18T22:00" }),
      cruda({ fuente: "cinemark", cine: "nuevocentro", inicio: "2026-11-18T14:00" }),
    ])
    expect(funciones.map((funcion) => funcion.inicio)).toEqual(["2026-11-18T14:00", "2026-11-18T22:00"])
  })
})
