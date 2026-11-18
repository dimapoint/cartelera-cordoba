import { describe, expect, test } from "bun:test"
import { leerFixture, leerFixtureJson, traerFalso } from "../fixtures/ayudas"
import { bajarCinexo, fechasPublicadas, parsearCinexo, tieneVenta, type DatosCinexo } from "./cinexo"

const SITIO = "https://www.cinealtagracia.com.ar"
const datos = async (): Promise<DatosCinexo> => (await leerFixtureJson("cinexo_4000_2026-12-16.json")).data
const VACIO = '{"success":true,"message":"","data":{"datos":[],"funciones":[]}}'
const homeConFechas = (...fechas: string[]) =>
  `0:["$","div",{"complejo_id":"4000","dates":${JSON.stringify(fechas.map((fecha) => ({ fecha, fecha_format: fecha.split("-").reverse().join("/") })))}}]`

describe("parsearCinexo", () => {
  test("la trasnoche listada el 16/12 a las 00:01 empieza el 17/12 y subtitulada sale por función", async () => {
    const funciones = parsearCinexo(await datos(), "altagracia", SITIO, "2026-12-16")
    expect(funciones.map((funcion) => [funcion.inicio, funcion.version])).toEqual([
      ["2026-12-16T18:00", "CAST"],
      ["2026-12-16T21:20", "SUB"],
      ["2026-12-17T00:01", "CAST"],
    ])
    expect(funciones.every((funcion) => funcion.diaDeCine === "2026-12-16")).toBe(true)
    expect(funciones[1].compra).toMatch(/^https:\/\/www\.cinealtagracia\.com\.ar\/es-AR\/compra\?cid=4000&fid=\d+&pid=\d+$/)
  })

  test("limpia los espacios del nombre que carga el cine", async () => {
    const original = await datos()
    const conEspacios = { ...original, datos: original.datos.map((pelicula) => ({ ...pelicula, peliculas_nombre: `  ${pelicula.peliculas_nombre}  ` })) }
    expect(parsearCinexo(conEspacios, "altagracia", SITIO, "2026-12-16")[0].titulo).not.toMatch(/^\s|\s$/)
  })

  test("falla con funciones que no cierran", async () => {
    const original = await datos()
    const [funcion] = original.funciones
    const con = (cambios: object) => ({ ...original, funciones: [{ ...funcion, ...cambios }] })
    expect(() => parsearCinexo(con({ codPelicula: "no-existe" }), "altagracia", SITIO, "2026-12-16")).toThrow("no tiene película")
    expect(() => parsearCinexo(con({ subtitulada: "2" }), "altagracia", SITIO, "2026-12-16")).toThrow('subtitulada="2"')
    expect(() => parsearCinexo(con({ hora: "7:30" }), "altagracia", SITIO, "2026-12-16")).toThrow('hora rara "7:30"')
    expect(() => parsearCinexo(con({ hora: "00:30", trasnoche: "0" }), "altagracia", SITIO, "2026-12-16")).toThrow("trasnoche inconsistente")
    expect(() => parsearCinexo(con({ hora: "22:30", trasnoche: "1" }), "altagracia", SITIO, "2026-12-16")).toThrow("trasnoche inconsistente")
  })

  test("falla si cambió la forma de la respuesta", () => {
    expect(() => parsearCinexo({ peliculas: [] } as never, "altagracia", SITIO, "2026-12-16")).toThrow("cambió la forma")
  })
})

describe("fechasPublicadas", () => {
  test("lee las fechas del payload RSC y descarta las de antes de ayer", async () => {
    const { traer, pedidos } = traerFalso(() => homeConFechas("2026-12-14", "2026-12-15", "2026-12-16"))
    expect(await fechasPublicadas(SITIO, "2026-12-16", traer)).toEqual(["2026-12-15", "2026-12-16"])
    expect((pedidos[0].opciones?.headers as Record<string, string>).RSC).toBe("1")
  })

  test("si el payload cambia, barre 90 días desde hoy", async () => {
    for (const payload of ["<html>sin datos</html>", '"dates":[]', '"dates":[{"otra":"cosa"}]']) {
      const { traer } = traerFalso(() => payload)
      const fechas = await fechasPublicadas(SITIO, "2026-12-30", traer)
      expect(fechas).toHaveLength(90)
      expect([fechas[0], fechas[2]]).toEqual(["2026-12-30", "2027-01-01"])
    }
  })
})

describe("bajarCinexo", () => {
  const ENTORNO_RAPIDO = { pausa: 0 }

  test("pide cada fecha de cada complejo con el formato DD/MM/AAAA", async () => {
    const respuesta = await leerFixture("cinexo_4000_2026-12-16.json")
    const { traer, pedidos } = traerFalso((url) => (url.endsWith("/es-AR") ? homeConFechas("2026-12-16") : respuesta))
    const { funciones } = await bajarCinexo("2026-12-16", { ...ENTORNO_RAPIDO, traer })
    const consultas = pedidos.map((pedido) => pedido.url).filter((url) => url.includes("apifront"))
    expect(consultas).toEqual([
      "https://apifront.cinexo.com.ar/mobile/consultas/peliculas/PeliculasConFuncionesYHorarios?idComplejo=1009&fecha=16/12/2026",
      "https://apifront.cinexo.com.ar/mobile/consultas/peliculas/PeliculasConFuncionesYHorarios?idComplejo=4000&fecha=16/12/2026",
    ])
    expect(funciones.filter((funcion) => funcion.cine === "lastipas")).toHaveLength(3)
    expect(funciones.filter((funcion) => funcion.cine === "altagracia")).toHaveLength(3)
  })

  test("con el barrido de respaldo encuentra la fecha con funciones", async () => {
    const respuesta = await leerFixture("cinexo_4000_2026-12-16.json")
    const { traer, pedidos } = traerFalso((url) => (url.endsWith("/es-AR") ? "<html></html>" : url.includes("fecha=16/12/2026") ? respuesta : VACIO))
    const { funciones } = await bajarCinexo("2026-12-10", { ...ENTORNO_RAPIDO, traer })
    expect(pedidos.filter((pedido) => pedido.url.includes("apifront"))).toHaveLength(180)
    expect(funciones).toHaveLength(6)
  })

  test("success=false corta con el mensaje del servidor", async () => {
    const { traer } = traerFalso((url) => (url.endsWith("/es-AR") ? homeConFechas("2026-12-16") : '{"success":false,"message":"Complejo no encontrado"}'))
    await expect(bajarCinexo("2026-12-16", { ...ENTORNO_RAPIDO, traer })).rejects.toThrow("Complejo no encontrado")
  })

  test("un complejo sin ninguna función en todas sus fechas es una rotura", async () => {
    const { traer } = traerFalso((url) => (url.endsWith("/es-AR") ? homeConFechas("2026-12-16") : VACIO))
    await expect(bajarCinexo("2026-12-16", { ...ENTORNO_RAPIDO, traer })).rejects.toThrow("0 funciones en lastipas")
  })
})

describe("tieneVenta", () => {
  const consultar = (payload: string) => tieneVenta("https://compra", { pausa: 0, traer: traerFalso(() => payload).traer })

  test("sin tarifas no hay venta; con tarifas, sí", async () => {
    expect(await consultar('{"functionData":{"datos":[],"tarifas":[]},"butacasData":{}}')).toBe(false)
    expect(await consultar('{"tarifas":[{"_id":"133","descripcion":"GENERAL","precio":"10000"}]}')).toBe(true)
  })

  test("si el payload cambió, no hay evidencia para marcarla sospechosa", async () => {
    expect(await consultar("<html>otra cosa</html>")).toBe(true)
  })

  test("un error de red se propaga (unificar decide qué hacer)", async () => {
    const traer = async () => {
      throw new Error("timeout")
    }
    await expect(tieneVenta("https://compra", { pausa: 0, traer })).rejects.toThrow("timeout")
  })
})
