import type { Cine, FuncionCruda, ResultadoFuente, Version } from "../../src/tipos"
import { leerJsonDe, traerTexto, type Traer } from "../http"

const BASE = "https://bff.cinemark.com.ar/api/cinema"
const CINES: Record<string, Cine> = { "105": "nuevocentro", "106": "patioolmos" }
const CABECERAS = { country: "AR", Accept: "application/json" } // sin "country" responde 500

export type FilaCinemark = {
  corporateId: string
  movieName: string
  language: { shortName: string }
  theaterId: string
  theaterRoom: string
  sessionId: string
  sessionFormat: string
  sessionDateTime: string
  sessionDisplayDate: string
  isLateNightSession: boolean
}
export type PeliculaCinemark = { corporateId: string; slug: string; title: string; posterUrl?: string; runTime?: number }

export async function bajarCinemark(traer: Traer = traerTexto): Promise<ResultadoFuente> {
  // Un solo pedido trae todos los días cargados de los dos cines.
  const funciones = leerJsonDe(await traer(`${BASE}/showtimes?theater=${Object.keys(CINES).join(",")}`, { headers: CABECERAS }), "Cinemark showtimes")
  const peliculas = leerJsonDe(await traer(`${BASE}/movies`, { headers: CABECERAS }), "Cinemark movies")
  if (!Array.isArray(funciones?.data)) throw new Error("Cinemark: showtimes no trae una lista en data")
  return { funciones: parsearCinemark(funciones.data, Array.isArray(peliculas?.data) ? peliculas.data : []) }
}

function validarFila(fila: FilaCinemark): void {
  const obligatorios = ["corporateId", "theaterId", "sessionId", "sessionFormat", "sessionDisplayDate"] as const
  const faltan: string[] = obligatorios.filter((campo) => !fila?.[campo])
  if (!fila?.language?.shortName) faltan.push("language")
  if (faltan.length) throw new Error(`Cinemark: cambió la forma de la respuesta (faltan ${faltan.join(", ")})`)
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(fila.sessionDateTime ?? "")) throw new Error(`Cinemark: sessionDateTime raro "${fila.sessionDateTime}"`)
  if (!/^\d{4}-\d\d-\d\d$/.test(fila.sessionDisplayDate)) throw new Error(`Cinemark: sessionDisplayDate raro "${fila.sessionDisplayDate}"`)
}

export function parsearCinemark(filas: FilaCinemark[], peliculas: PeliculaCinemark[]): FuncionCruda[] {
  // Dos cines sin ninguna función en todo el horizonte no pasa: es una respuesta rota.
  if (!filas.length) throw new Error("Cinemark: 0 funciones")
  const peliculaPorId = new Map(peliculas.map((pelicula) => [pelicula.corporateId, pelicula]))
  const sesiones = new Map<string, { fila: FilaCinemark; formatos: string[] }>()
  for (const fila of filas) {
    validarFila(fila)
    if (!CINES[fila.theaterId]) throw new Error(`Cinemark: cine desconocido ${fila.theaterId}`)
    const idioma = fila.language.shortName
    if (idioma !== "SUB" && idioma !== "CAST") throw new Error(`Cinemark: valor de idioma nuevo "${idioma}"`)
    // La "Z" de sessionDateTime es falsa: ya es hora de Córdoba. Si un día la corrigen, las trasnoches se corren.
    const hora = fila.sessionDateTime.slice(11, 16)
    if (fila.isLateNightSession && hora >= "04:00") throw new Error(`Cinemark: trasnoche a las ${hora}, ¿cambió la zona horaria?`)
    // En Nuevocentro las butacas D-BOX están dentro de una sala común: misma sesión, dos filas.
    const clave = `${fila.theaterId}/${fila.sessionId}`
    const sesion = sesiones.get(clave)
    if (!sesion) {
      sesiones.set(clave, { fila, formatos: [fila.sessionFormat] })
      continue
    }
    if (sesion.fila.language.shortName !== idioma || sesion.fila.sessionDateTime !== fila.sessionDateTime) {
      throw new Error(`Cinemark: la sesión ${clave} mezcla idioma u hora`)
    }
    sesion.formatos.push(fila.sessionFormat)
  }
  return [...sesiones.values()].map(({ fila, formatos }) => {
    const pelicula = peliculaPorId.get(fila.corporateId)
    const comun = formatos.find((formato) => !formato.includes("DBOX")) ?? formatos[0]
    return {
      fuente: "cinemark",
      cine: CINES[fila.theaterId],
      titulo: pelicula?.title ?? fila.movieName, // movieName a veces viene recortado
      diaDeCine: fila.sessionDisplayDate,
      inicio: fila.sessionDateTime.slice(0, 16),
      formato: formatos.length > 1 ? `${comun} · D-BOX` : comun,
      version: fila.language.shortName as Version,
      sala: `Sala ${fila.theaterRoom}`,
      compra: pelicula ? `https://www.cinemark.com.ar/pelicula/${pelicula.slug}` : undefined,
      poster: pelicula?.posterUrl,
      duracion: pelicula?.runTime,
    }
  })
}
