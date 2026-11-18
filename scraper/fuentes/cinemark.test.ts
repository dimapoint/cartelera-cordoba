import { describe, expect, test } from "bun:test"
import { leerFixture, leerFixtureJson, traerFalso } from "../fixtures/ayudas"
import { bajarCinemark, parsearCinemark, type FilaCinemark } from "./cinemark"

const filas = async (): Promise<FilaCinemark[]> => (await leerFixtureJson("cinemark_showtimes.json")).data
const peliculas = async () => (await leerFixtureJson("cinemark_movies.json")).data

describe("parsearCinemark", () => {
  test("junta la fila D-BOX con su función común y deja la hora local", async () => {
    const funciones = parsearCinemark(await filas(), await peliculas())
    expect(funciones).toHaveLength(3)
    const conDbox = funciones.find((funcion) => funcion.cine === "nuevocentro" && funcion.inicio === "2026-11-16T13:40")!
    expect(conDbox).toMatchObject({ formato: "2D · D-BOX", version: "SUB", sala: "Sala 3", diaDeCine: "2026-11-16" })
    expect(conDbox.compra).toBe("https://www.cinemark.com.ar/pelicula/ebenezer-los-fantasmas-de-navidad")
  })

  test("la trasnoche del 16/12 a las 00:00 es del día de cine 15/12", async () => {
    const trasnoche = parsearCinemark(await filas(), await peliculas()).find((funcion) => funcion.inicio === "2026-12-16T00:00")!
    expect(trasnoche.diaDeCine).toBe("2026-12-15")
  })

  test("sin ficha de la película usa movieName y no inventa link", async () => {
    const trasnoche = parsearCinemark(await filas(), []).find((funcion) => funcion.inicio === "2026-12-16T00:00")!
    expect(trasnoche).toMatchObject({ titulo: "AVENGERS: DOOMSDAY", compra: undefined, poster: undefined })
  })

  test("una respuesta vacía es una rotura", () => {
    expect(() => parsearCinemark([], [])).toThrow("0 funciones")
  })

  test("detecta que cambió la forma de la respuesta", async () => {
    const [fila] = await filas()
    expect(() => parsearCinemark([{ ...fila, language: undefined as never }], [])).toThrow("faltan language")
    expect(() => parsearCinemark([{ ...fila, theaterId: undefined as never }], [])).toThrow("faltan theaterId")
    expect(() => parsearCinemark([{ ...fila, sessionDateTime: "16/11/2026 13:40" }], [])).toThrow("sessionDateTime raro")
    expect(() => parsearCinemark([{ ...fila, sessionDisplayDate: "16/11/2026" }], [])).toThrow("sessionDisplayDate raro")
  })

  test("falla con valores que no conoce", async () => {
    const [fila] = await filas()
    expect(() => parsearCinemark([{ ...fila, language: { shortName: "DOB" } }], [])).toThrow('idioma nuevo "DOB"')
    expect(() => parsearCinemark([{ ...fila, theaterId: "999" }], [])).toThrow("cine desconocido 999")
  })

  test("falla si la Z deja de ser falsa y la trasnoche se corre de hora", async () => {
    const [fila] = await filas()
    expect(() => parsearCinemark([{ ...fila, isLateNightSession: true, sessionDateTime: "2026-12-16T05:00:00.000Z" }], [])).toThrow("trasnoche")
  })

  test("falla si las dos filas de una misma sesión no coinciden", async () => {
    const [dbox, comun] = await filas()
    expect(() => parsearCinemark([dbox, { ...comun, language: { shortName: "CAST" } }], [])).toThrow("mezcla idioma u hora")
    expect(() => parsearCinemark([dbox, { ...comun, sessionDateTime: "2026-11-16T15:00:00.000Z" }], [])).toThrow("mezcla idioma u hora")
  })
})

describe("bajarCinemark", () => {
  test("pide los dos cines con el header country y arma las funciones", async () => {
    const showtimes = await leerFixture("cinemark_showtimes.json")
    const movies = await leerFixture("cinemark_movies.json")
    const { traer, pedidos } = traerFalso((url) => (url.includes("/showtimes") ? showtimes : movies))
    const { funciones } = await bajarCinemark(traer)
    expect(funciones).toHaveLength(3)
    expect(pedidos[0].url).toBe("https://bff.cinemark.com.ar/api/cinema/showtimes?theater=105,106")
    expect(pedidos.every((pedido) => (pedido.opciones?.headers as Record<string, string>).country === "AR")).toBe(true)
  })

  test("una página de Cloudflare en lugar de JSON da un error claro", async () => {
    const { traer } = traerFalso(() => "<html>Checking your browser</html>")
    await expect(bajarCinemark(traer)).rejects.toThrow("Cinemark showtimes: la respuesta no es JSON")
  })

  test("si showtimes no trae una lista, falla", async () => {
    const { traer } = traerFalso(() => '{"error":"Country undefined not implemented"}')
    await expect(bajarCinemark(traer)).rejects.toThrow("no trae una lista")
  })

  test("si falla la forma de movies sigue con los nombres de showtimes", async () => {
    const showtimes = await leerFixture("cinemark_showtimes.json")
    const { traer } = traerFalso((url) => (url.includes("/showtimes") ? showtimes : '{"data":null}'))
    const { funciones } = await bajarCinemark(traer)
    expect(funciones.every((funcion) => funcion.titulo && funcion.compra === undefined)).toBe(true)
  })
})
