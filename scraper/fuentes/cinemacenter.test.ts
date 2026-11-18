import { describe, expect, test } from "bun:test"
import { leerFixtureCp1252, traerFalso } from "../fixtures/ayudas"
import { bajarCinemacenter, parsearGrilla, parsearHorarios } from "./cinemacenter"

const PLUMAS = { id: "6111", titulo: "PLUMAS OPERACION RESCATE - 2D CAST" }
const GRILLA_VACIA = `<div class="datelimit">DESDE EL 12/11/2026 AL <em>18/11/2026</em></div>
<ul class="dates movie-schedules"><li class="buy-confirm"><a href="#" class="buy-confirm-btn">COMPRAR ONLINE</a></li></ul>`
const grilla = (dia: string, ...horas: string[]) =>
  `<ul class="dates movie-schedules"><li><div class="day">${dia}</div><ul class="hours">${horas.join("")}</ul></li></ul>`
const encabezado = (cuerpo: string) =>
  `<div id="divTitleCity">Alta Gracia</div><div class="datelimit">DESDE EL 12/11/2026 AL <em>18/11/2026</em></div>${cuerpo}`

describe("parsearHorarios", () => {
  test("lee los 9 shows reales de Alta Gracia y el fin de la semana", async () => {
    const { shows, cubreHasta } = parsearHorarios(await leerFixtureCp1252("cinemacenter_horarios.html"))
    expect(shows).toHaveLength(9) // el seleccionarMovie del onload del <head> no cuenta
    expect(new Set(shows.map((show) => show.id)).size).toBe(9)
    expect(cubreHasta).toBe("2026-11-18")
    expect(shows.find((show) => show.id === "6107")?.titulo).toBe("COMO ROBAR UN BANCO - 2D SUB")
  })

  test("falla si el sitio quedó en otra ciudad (sin la cookie muestra Mar del Plata)", () => {
    expect(() => parsearHorarios('<div id="divTitleCity">Mar del Plata</div>')).toThrow("no quedó en Alta Gracia")
  })

  test("falla sin shows, sin rango de semana o con shows de otro cine", () => {
    expect(() => parsearHorarios(encabezado(""))).toThrow("no encontré shows")
    expect(() =>
      parsearHorarios(`<div id="divTitleCity">Alta Gracia</div><a href="javascript:seleccionarMovie('A','B',9,1,1)">X - 2D SUB</a>`),
    ).toThrow("rango de la semana")
    expect(() => parsearHorarios(encabezado(`<a href="javascript:seleccionarMovie('A','B',38,6091,23)">X - 2D SUB</a>`))).toThrow("de otro cine")
  })

  test("desescapa entidades en los títulos", () => {
    const { shows } = parsearHorarios(encabezado(`<a href="javascript:seleccionarMovie('A','B',9,1,1)">ANIQUILACI&Oacute;N - 2D CAST</a>`))
    expect(shows[0].titulo).toBe("ANIQUILACIÓN - 2D CAST")
  })
})

describe("parsearGrilla", () => {
  test("lee la grilla real de un show", async () => {
    const funciones = parsearGrilla(await leerFixtureCp1252("cinemacenter_grilla_6111.html"), PLUMAS)
    expect(funciones.map((funcion) => funcion.inicio)).toEqual(["2026-11-16T16:50", "2026-11-16T19:00", "2026-11-18T16:50", "2026-11-18T19:00"])
    expect(funciones[0]).toMatchObject({ titulo: "PLUMAS OPERACION RESCATE", version: "CAST", formato: "2D", diaDeCine: "2026-11-16" })
  })

  test("la trasnoche y la madrugada caen al día siguiente; las 23:00 no", () => {
    const html = grilla(
      "Mi&eacute;rcoles 18 de Noviembre de 2026",
      "<li class=''>23:00</li>",
      "<li class='late'>00:30</li>",
      "<li class=''>1:10</li>",
      `<li class='special'><a href="javascript:selectTime4Buy('9','1','1','2','x')">14:00</a></li>`,
    )
    expect(parsearGrilla(html, PLUMAS).map((funcion) => funcion.inicio)).toEqual([
      "2026-11-18T23:00",
      "2026-11-19T00:30",
      "2026-11-19T01:10",
      "2026-11-18T14:00",
    ])
  })

  test("entiende el día con la entidad en mayúsculas que manda el buscador", () => {
    expect(parsearGrilla(grilla("S&AACUTE;BADO 14 DE NOVIEMBRE DE 2026", "<li class=''>21:30</li>"), PLUMAS)[0].diaDeCine).toBe("2026-11-14")
  })

  test("falla con un horario que no reconoce en vez de perderlo en silencio", () => {
    expect(() => parsearGrilla(grilla("Lunes 16 de Noviembre de 2026", "<li class='late special'>00:30</li>"), PLUMAS)).toThrow("sin reconocer")
    expect(() => parsearGrilla(grilla("Lunes 16 de Noviembre de 2026", '<li class="nuevo">21:30</li>'), PLUMAS)).toThrow("sin reconocer")
  })

  test("falla con fechas o versiones que no conoce", () => {
    expect(() => parsearGrilla(grilla("Lunes 16 de Brumario de 2026", "<li class=''>21:30</li>"), PLUMAS)).toThrow("fecha rara")
    expect(() => parsearGrilla(grilla("Lunes", "<li class=''>21:30</li>"), PLUMAS)).toThrow("fecha rara")
    expect(() => parsearGrilla("", { id: "1", titulo: "MADRE SINIESTRA" })).toThrow("título sin versión")
    expect(() => parsearGrilla("", { id: "1", titulo: "MADRE SINIESTRA - 2D VOSE" })).toThrow('idioma nuevo "VOSE"')
  })

  test("una grilla sin días no inventa funciones", () => {
    expect(parsearGrilla(GRILLA_VACIA, PLUMAS)).toEqual([])
  })
})

describe("bajarCinemacenter", () => {
  test("manda la cookie de Alta Gracia y un POST por show", async () => {
    const horarios = await leerFixtureCp1252("cinemacenter_horarios.html")
    const grillaPlumas = await leerFixtureCp1252("cinemacenter_grilla_6111.html")
    const { traer, pedidos } = traerFalso((url, opciones) =>
      url.endsWith("/horarios") ? horarios : String(opciones?.body).includes("showId=6111&") ? grillaPlumas : GRILLA_VACIA,
    )
    const { funciones, cubreHasta } = await bajarCinemacenter({ pausa: 0, traer })
    expect((pedidos[0].opciones?.headers as Record<string, string>).Cookie).toBe("cityid=1")
    expect(pedidos.slice(1).map((pedido) => [pedido.opciones?.method, pedido.opciones?.body])).toContainEqual(["POST", "showId=6111&cityId=1&cinemaId=9"])
    expect(pedidos).toHaveLength(10)
    expect(funciones).toHaveLength(4)
    expect(cubreHasta).toBe("2026-11-18")
  })

  test("si todas las grillas vuelven vacías (parámetros cambiados) es una rotura", async () => {
    const horarios = await leerFixtureCp1252("cinemacenter_horarios.html")
    const { traer } = traerFalso((url) => (url.endsWith("/horarios") ? horarios : GRILLA_VACIA))
    await expect(bajarCinemacenter({ pausa: 0, traer })).rejects.toThrow("0 funciones")
  })
})
