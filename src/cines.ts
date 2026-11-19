import type { Cine, Fuente } from "./tipos"

export const CINES: { id: Cine; nombre: string; corto: string }[] = [
  { id: "nuevocentro", nombre: "Cinemark Nuevocentro", corto: "Nuevocentro" },
  { id: "patioolmos", nombre: "Cinemark Patio Olmos", corto: "Patio Olmos" },
  { id: "lastipas", nombre: "Las Tipas", corto: "Las Tipas" },
  { id: "altagracia", nombre: "Cinemacenter Alta Gracia", corto: "Alta Gracia" },
]

/** Fuentes cuya caída no importa: Cinexo ya cubre Alta Gracia y Cinemacenter solo sirve para contrastar el idioma. */
export const FUENTES_OPCIONALES: Fuente[] = ["cinemacenter"]

export const NOMBRE_FUENTE: Record<Fuente, string> = {
  cinemark: "Cinemark",
  cinexo: "cinealtagracia.com.ar y Las Tipas",
  cinemacenter: "Cinemacenter",
}

/** Cómo se nombra cada sitio de Alta Gracia cuando no coinciden entre sí. */
export const SITIO_ALTA_GRACIA: Partial<Record<Fuente, string>> = {
  cinexo: "cinealtagracia",
  cinemacenter: "Cinemacenter",
}
