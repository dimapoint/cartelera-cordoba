import type { EstadoFuente, Fuente, ResultadoFuente } from "../../src/tipos"
import { escribirJson, leerJson, RUTAS } from "../almacen"
import { bajarCinemacenter } from "./cinemacenter"
import { bajarCinemark } from "./cinemark"
import { bajarCinexo } from "./cinexo"

type Guardado = ResultadoFuente & { actualizado: string }
export type Bajadores = Record<Fuente, () => Promise<ResultadoFuente>>

const bajadoresReales = (hoy: string): Bajadores => ({
  cinemark: () => bajarCinemark(),
  cinexo: () => bajarCinexo(hoy),
  cinemacenter: () => bajarCinemacenter(),
})

/**
 * Baja las tres fuentes. Si una se rompe, usa lo último que se bajó bien de ella,
 * así la página no pierde ese cine; el estado avisa desde cuándo son esos datos.
 */
export async function bajarTodas(ahora: string, bajadores = bajadoresReales(ahora.slice(0, 10)), rutaDe = RUTAS.fuente) {
  const resultados = {} as Record<Fuente, ResultadoFuente>
  const estados = {} as Record<Fuente, EstadoFuente>
  for (const [fuente, bajar] of Object.entries(bajadores) as [Fuente, () => Promise<ResultadoFuente>][]) {
    try {
      resultados[fuente] = await bajar()
      estados[fuente] = { ok: true, actualizado: ahora }
      await escribirJson(rutaDe(fuente), { actualizado: ahora, ...resultados[fuente] } satisfies Guardado)
      console.log(`✓ ${fuente}: ${resultados[fuente].funciones.length} funciones`)
    } catch (error) {
      const anterior = await leerJson<Guardado>(rutaDe(fuente), { actualizado: "", funciones: [] })
      resultados[fuente] = anterior
      estados[fuente] = { ok: false, actualizado: anterior.actualizado, error: (error as Error).message }
      console.error(`✗ ${fuente}: ${(error as Error).message} (uso los datos de ${anterior.actualizado || "ninguna corrida"})`)
    }
  }
  return { resultados, estados }
}
