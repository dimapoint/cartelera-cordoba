import { join } from "node:path"
import type { FuncionCruda } from "../../src/tipos"

const CARPETA = import.meta.dir

/** Respuestas reales guardadas el 16/11/2026, recortadas. */
export const leerFixture = (nombre: string) => Bun.file(join(CARPETA, nombre)).text()
export const leerFixtureJson = (nombre: string) => Bun.file(join(CARPETA, nombre)).json()
export const leerFixtureCp1252 = async (nombre: string) =>
  new TextDecoder("windows-1252").decode(await Bun.file(join(CARPETA, nombre)).arrayBuffer())

export const crudaDePrueba = (cambios: Partial<FuncionCruda> = {}): FuncionCruda => ({
  fuente: "cinexo",
  cine: "altagracia",
  titulo: "MADRE SINIESTRA",
  diaDeCine: "2026-11-18",
  inicio: "2026-11-18T21:30",
  formato: "2D",
  version: "SUB",
  ...cambios,
})

/** Reemplazo de `traer` que contesta según la URL y anota cada pedido para revisarlo después. */
export function traerFalso(responder: (url: string, opciones?: RequestInit) => string | Promise<string>) {
  const pedidos: { url: string; opciones?: RequestInit }[] = []
  const traer = async (url: string, opciones?: RequestInit) => {
    pedidos.push({ url, opciones })
    return responder(url, opciones)
  }
  return { traer, pedidos }
}
