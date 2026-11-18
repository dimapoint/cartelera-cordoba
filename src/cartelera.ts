import { sumarDias } from "./fechas"
import type { Cine, Funcion, Pelicula } from "./tipos"

const DIA_SEMANA = new Intl.DateTimeFormat("es-AR", { weekday: "short", timeZone: "UTC" })

/** Subtitulada siempre; castellano solo si la película es hispanohablante (o dudosa, si se pide). */
export function esVisible(funcion: Funcion, pelicula: Pelicula, verDudosas: boolean): boolean {
  const versiones = [funcion.version, ...Object.values(funcion.segun ?? {})]
  if (versiones.includes("SUB") || pelicula.idiomaOriginal === "es") return true
  return verDudosas && pelicula.idiomaOriginal === "desconocido"
}

export function diasConFunciones(funciones: Funcion[]): string[] {
  return [...new Set(funciones.map((funcion) => funcion.diaDeCine))].sort()
}

/** Funciones de un día en los cines elegidos, agrupadas por película y en orden alfabético. */
export function agruparPorPelicula(funciones: Funcion[], peliculas: Map<string, Pelicula>, dia: string, cines: Set<Cine>) {
  const grupos = new Map<string, Funcion[]>()
  for (const funcion of funciones) {
    if (funcion.diaDeCine !== dia || !cines.has(funcion.cine)) continue
    grupos.set(funcion.pelicula, [...(grupos.get(funcion.pelicula) ?? []), funcion])
  }
  return [...grupos]
    .map(([id, delGrupo]) => ({ pelicula: peliculas.get(id)!, funciones: delGrupo }))
    .sort((primero, segundo) => primero.pelicula.titulo.localeCompare(segundo.pelicula.titulo, "es"))
}

export function etiquetaDelDia(dia: string, hoy: string): string {
  if (dia === hoy) return "Hoy"
  if (dia === sumarDias(hoy, 1)) return "Mañana"
  return DIA_SEMANA.format(new Date(`${dia}T12:00:00Z`)).replace(".", "")
}

/** "2026-11-18T15:55" → "18/11 a las 15:55" */
export const formatearMarca = (marca: string) => `${marca.slice(8, 10)}/${marca.slice(5, 7)} a las ${marca.slice(11, 16)}`
