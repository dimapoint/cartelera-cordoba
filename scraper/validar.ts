import { sumarDias } from "../src/fechas"
import type { Cartelera } from "../src/tipos"

const CINES = new Set(["nuevocentro", "patioolmos", "lastipas", "altagracia"])
const ESTADOS = new Set(["ok", "conflicto", "una_fuente", "sospechosa"])
const IDIOMAS = new Set(["es", "otro", "desconocido"])
const MARCA = /^\d{4}-\d\d-\d\dT\d\d:\d\d$/

/**
 * Invariantes del JSON que consume la página. Corre en cada actualización antes de escribir:
 * si algo no cierra, la página sigue con el JSON anterior en vez de mostrar datos rotos.
 */
export function validarCartelera(cartelera: Cartelera): string[] {
  const errores: string[] = []
  if (!MARCA.test(cartelera.generado)) errores.push(`generado raro: ${cartelera.generado}`)
  const ids = new Set(cartelera.peliculas.map((pelicula) => pelicula.id))
  if (ids.size !== cartelera.peliculas.length) errores.push("hay ids de película repetidos")
  for (const pelicula of cartelera.peliculas) {
    if (!pelicula.titulo?.trim()) errores.push(`la película ${pelicula.id} no tiene título`)
    if (!IDIOMAS.has(pelicula.idiomaOriginal)) errores.push(`la película ${pelicula.id} tiene idioma "${pelicula.idiomaOriginal}"`)
  }
  for (const funcion of cartelera.funciones) {
    const donde = `${funcion.cine} ${funcion.inicio}`
    if (!ids.has(funcion.pelicula)) errores.push(`${donde}: la película ${funcion.pelicula} no existe`)
    if (!CINES.has(funcion.cine)) errores.push(`${donde}: cine desconocido`)
    if (funcion.version !== "SUB" && funcion.version !== "CAST") errores.push(`${donde}: versión "${funcion.version}"`)
    if (!ESTADOS.has(funcion.estado)) errores.push(`${donde}: estado "${funcion.estado}"`)
    if (!MARCA.test(funcion.inicio)) {
      errores.push(`${donde}: inicio con formato raro`)
      continue
    }
    const diaReal = funcion.inicio.slice(0, 10)
    // El día de cine es el del inicio, salvo la trasnoche, que es de madrugada del día siguiente.
    const esTrasnoche = diaReal === sumarDias(funcion.diaDeCine, 1) && funcion.inicio.slice(11) < "07:00"
    if (diaReal !== funcion.diaDeCine && !esTrasnoche) errores.push(`${donde}: el día de cine ${funcion.diaDeCine} no cuadra con el inicio`)
    if (funcion.estado === "conflicto") {
      const { cinexo, cinemacenter } = funcion.segun ?? {}
      if (!cinexo || !cinemacenter || cinexo === cinemacenter) errores.push(`${donde}: conflicto sin dos versiones distintas`)
    }
  }
  return errores
}
