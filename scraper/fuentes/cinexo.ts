import { sumarDias } from "../../src/fechas"
import type { Cine, FuncionCruda, ResultadoFuente } from "../../src/tipos"
import { esperar, leerJsonDe, traerTexto, type Traer } from "../http"

const API = "https://apifront.cinexo.com.ar/mobile/consultas/peliculas/PeliculasConFuncionesYHorarios"
const COMPLEJOS: { cine: Cine; id: string; sitio: string }[] = [
  { cine: "lastipas", id: "1009", sitio: "https://www.cordoba.lastipas.com.ar" },
  { cine: "altagracia", id: "4000", sitio: "https://www.cinealtagracia.com.ar" },
]
const DIAS_DE_BARRIDO = 90

type PeliculaCinexo = { peliculas_codigo: string; peliculas_nombre: string; peliculas_duracion?: string; imagen?: string }
type FuncionCinexo = { _id: string; codPelicula: string; hora: string; subtitulada: string; formato: string; trasnoche: string; idUltracine: string }
export type DatosCinexo = { datos: PeliculaCinexo[]; funciones: FuncionCinexo[] }
export type EntornoCinexo = { traer: Traer; pausa: number }
const ENTORNO: EntornoCinexo = { traer: traerTexto, pausa: 600 } // apifront publica ratelimit-policy 120;w=60

export async function bajarCinexo(hoy: string, entorno = ENTORNO): Promise<ResultadoFuente> {
  const funciones: FuncionCruda[] = []
  for (const complejo of COMPLEJOS) {
    const delComplejo: FuncionCruda[] = []
    for (const dia of await fechasPublicadas(complejo.sitio, hoy, entorno.traer)) {
      const [anio, mes, diaDelMes] = dia.split("-")
      const url = `${API}?idComplejo=${complejo.id}&fecha=${diaDelMes}/${mes}/${anio}`
      const respuesta = leerJsonDe(await entorno.traer(url), `Cinexo ${complejo.id} ${dia}`)
      if (respuesta?.success !== true) throw new Error(`Cinexo ${complejo.id} ${dia}: ${respuesta?.message ?? "success no es true"}`)
      delComplejo.push(...parsearCinexo(respuesta.data, complejo.cine, complejo.sitio, dia))
      await esperar(entorno.pausa)
    }
    // Un complejo sin ninguna función en todas las fechas es una respuesta rota, no un cine vacío.
    if (!delComplejo.length) throw new Error(`Cinexo: 0 funciones en ${complejo.cine}`)
    funciones.push(...delComplejo)
  }
  return { funciones }
}

/** Fechas con programación, desde ayer (la trasnoche de ayer figura bajo ayer). */
export async function fechasPublicadas(sitio: string, hoy: string, traer: Traer): Promise<string[]> {
  // La lista viaja en el payload RSC de la home; en el HTML común viene escapada y la regex no la ve.
  const payload = await traer(`${sitio}/es-AR`, { headers: { RSC: "1" } })
  const coincidencia = payload.match(/"dates":(\[[^\]]*\])/)
  const fechas: string[] | undefined = coincidencia
    ? leerJsonDe(coincidencia[1], `Cinexo fechas de ${sitio}`).map((fecha: { fecha?: string }) => fecha.fecha)
    : undefined
  if (fechas?.length && fechas.every((fecha) => /^\d{4}-\d\d-\d\d$/.test(fecha ?? ""))) return fechas.filter((fecha) => fecha >= sumarDias(hoy, -1))
  console.warn(`Cinexo: no encontré la lista de fechas en ${sitio}, barro ${DIAS_DE_BARRIDO} días`)
  // shortcut: barrido fijo (un pedido por día); agrandarlo si aparecen preventas más lejanas
  return Array.from({ length: DIAS_DE_BARRIDO }, (_vacio, indice) => sumarDias(hoy, indice))
}

export function parsearCinexo(datos: DatosCinexo, cine: Cine, sitio: string, dia: string): FuncionCruda[] {
  if (!Array.isArray(datos?.datos) || !Array.isArray(datos?.funciones)) throw new Error(`Cinexo ${dia}: cambió la forma de la respuesta`)
  const peliculas = new Map(datos.datos.map((pelicula) => [pelicula.peliculas_codigo, pelicula]))
  return datos.funciones.map((funcion) => {
    const pelicula = peliculas.get(funcion.codPelicula)
    if (!pelicula?.peliculas_nombre) throw new Error(`Cinexo: la función ${funcion._id} no tiene película`)
    if (funcion.subtitulada !== "0" && funcion.subtitulada !== "1") throw new Error(`Cinexo: subtitulada="${funcion.subtitulada}" en ${funcion._id}`)
    if (!/^\d\d:\d\d$/.test(funcion.hora ?? "")) throw new Error(`Cinexo: hora rara "${funcion.hora}" en ${funcion._id}`)
    // El sitio lista la trasnoche bajo el día anterior y le suma un día si la hora es menor a 06:00.
    const trasnoche = funcion.hora < "06:00"
    if (trasnoche !== (funcion.trasnoche === "1")) throw new Error(`Cinexo: trasnoche inconsistente en la función ${funcion._id}`)
    return {
      fuente: "cinexo",
      cine,
      titulo: pelicula.peliculas_nombre.trim(),
      diaDeCine: dia,
      inicio: `${trasnoche ? sumarDias(dia, 1) : dia}T${funcion.hora}`,
      formato: funcion.formato,
      version: funcion.subtitulada === "1" ? "SUB" : "CAST",
      compra: `${sitio}/es-AR/compra?cid=${funcion.idUltracine}&fid=${funcion._id}&pid=${funcion.codPelicula}`,
      poster: pelicula.imagen || undefined,
      duracion: Number(pelicula.peliculas_duracion) || undefined,
    }
  })
}

/** La página de compra (solo lectura, no reserva) trae las tarifas; sin tarifas la función no se puede comprar. */
export async function tieneVenta(compra: string, entorno = ENTORNO): Promise<boolean> {
  const payload = await entorno.traer(compra, { headers: { RSC: "1" } })
  await esperar(entorno.pausa)
  const posicion = payload.indexOf('"tarifas":')
  // Si cambia el payload no hay evidencia de que falte la venta: no la marco sospechosa.
  if (posicion === -1) return true
  return !payload.startsWith('"tarifas":[]', posicion)
}
