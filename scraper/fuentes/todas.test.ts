import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Fuente } from "../../src/tipos"
import { crudaDePrueba } from "../fixtures/ayudas"
import { bajarTodas, type Bajadores } from "./todas"

let carpeta = ""
const rutaDe = (fuente: Fuente) => join(carpeta, `${fuente}.json`)
beforeEach(async () => {
  carpeta = await mkdtemp(join(tmpdir(), "cartelera-"))
})
afterEach(() => rm(carpeta, { recursive: true, force: true }))

const funciona = (titulo: string) => async () => ({ funciones: [crudaDePrueba({ titulo })] })
const seRompe = (mensaje: string) => async () => {
  throw new Error(mensaje)
}

describe("bajarTodas", () => {
  test("guarda lo que se bajó bien de cada fuente", async () => {
    const bajadores: Bajadores = { cinemark: funciona("A"), cinexo: funciona("B"), cinemacenter: funciona("C") }
    const { estados } = await bajarTodas("2026-11-18T15:00", bajadores, rutaDe)
    expect(Object.values(estados).every((estado) => estado.ok)).toBe(true)
    expect((await Bun.file(rutaDe("cinexo")).json()).actualizado).toBe("2026-11-18T15:00")
  })

  test("una fuente rota usa lo último que anduvo y avisa desde cuándo", async () => {
    await bajarTodas("2026-11-18T12:00", { cinemark: funciona("A"), cinexo: funciona("VIEJA"), cinemacenter: funciona("C") }, rutaDe)
    const { resultados, estados } = await bajarTodas(
      "2026-11-18T15:00",
      { cinemark: funciona("A2"), cinexo: seRompe("timeout"), cinemacenter: funciona("C2") },
      rutaDe,
    )
    expect(estados.cinexo).toEqual({ ok: false, actualizado: "2026-11-18T12:00", error: "timeout" })
    expect(resultados.cinexo.funciones[0].titulo).toBe("VIEJA")
    expect(resultados.cinemacenter.funciones[0].titulo).toBe("C2") // la rotura no frena a las que vienen después
    expect((await Bun.file(rutaDe("cinexo")).json()).actualizado).toBe("2026-11-18T12:00") // no pisa el resguardo
  })

  test("una fuente rota sin corridas anteriores queda vacía, sin romper el resto", async () => {
    const { resultados, estados } = await bajarTodas("2026-11-18T15:00", { cinemark: seRompe("HTTP 500"), cinexo: funciona("B"), cinemacenter: funciona("C") }, rutaDe)
    expect(estados.cinemark).toEqual({ ok: false, actualizado: "", error: "HTTP 500" })
    expect(resultados.cinemark.funciones).toEqual([])
    expect(estados.cinexo.ok).toBe(true)
  })
})
