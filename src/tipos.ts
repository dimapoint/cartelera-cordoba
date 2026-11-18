export type Cine = "nuevocentro" | "patioolmos" | "lastipas" | "altagracia"
export type Fuente = "cinemark" | "cinexo" | "cinemacenter"
export type Version = "SUB" | "CAST"
export type Estado = "ok" | "conflicto" | "una_fuente" | "sospechosa"
export type IdiomaOriginal = "es" | "otro" | "desconocido"

/** Una función tal como la publica una fuente, antes de unificar. */
export type FuncionCruda = {
  fuente: Fuente
  cine: Cine
  titulo: string
  diaDeCine: string // AAAA-MM-DD; la trasnoche cuenta para el día anterior
  inicio: string // AAAA-MM-DDTHH:MM real, hora de Córdoba
  formato: string
  version: Version
  sala?: string
  compra?: string
  poster?: string
  duracion?: number
}

export type ResultadoFuente = {
  funciones: FuncionCruda[]
  cubreHasta?: string // último día que publica la fuente (Cinemacenter solo publica la semana en curso)
}

export type Funcion = {
  cine: Cine
  pelicula: string
  diaDeCine: string
  inicio: string
  formato: string
  version: Version
  sala?: string
  compra?: string
  estado: Estado
  segun?: Partial<Record<Fuente, Version>>
}

export type Pelicula = {
  id: string
  titulo: string
  poster?: string
  duracion?: number
  idiomaOriginal: IdiomaOriginal
  decididoPor: string
}

export type EstadoFuente = { ok: boolean; actualizado: string; error?: string }

export type Cartelera = {
  generado: string
  fuentes: Record<Fuente, EstadoFuente>
  peliculas: Pelicula[]
  funciones: Funcion[]
}
