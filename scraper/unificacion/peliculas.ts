import type { FuncionCruda, Pelicula } from "../../src/tipos"
import type { Decision } from "../idioma/tipos"
import { claveDe, limpiarTitulo } from "../texto"

const SIN_DECISION: Decision = { idiomaOriginal: "desconocido", decididoPor: "sin datos" }

/** Título limpio para la página; conserva el año explícito para distinguir "DUNA (2021)" de las secuelas. */
function tituloVisible(crudo: string): string {
  const { titulo, banderas } = limpiarTitulo(crudo)
  const anio = banderas.find((bandera) => bandera.startsWith("anio_"))?.slice("anio_".length)
  return anio ? `${titulo} (${anio})` : titulo
}

/**
 * Identifica la película de cada función. Dos títulos distintos con el mismo id de IMDb
 * son la misma película; sin IMDb, decide el título normalizado.
 */
export function crearRegistroPeliculas(decisiones: Map<string, Decision>) {
  const peliculas = new Map<string, Pelicula>()
  return {
    idDe(cruda: FuncionCruda): string {
      const clave = claveDe(cruda.titulo)
      const decision = decisiones.get(clave) ?? SIN_DECISION
      const id = decision.imdb ?? `titulo:${clave}`
      const existente = peliculas.get(id)
      if (existente) {
        existente.poster ??= cruda.poster
        existente.duracion ??= cruda.duracion
      } else {
        peliculas.set(id, {
          id,
          titulo: tituloVisible(cruda.titulo),
          poster: cruda.poster,
          duracion: cruda.duracion,
          idiomaOriginal: decision.idiomaOriginal,
          decididoPor: decision.decididoPor,
        })
      }
      return id
    },
    usadas(ids: Set<string>): Pelicula[] {
      return [...peliculas.values()].filter((pelicula) => ids.has(pelicula.id))
    },
  }
}
