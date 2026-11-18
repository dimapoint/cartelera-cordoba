import type { Funcion, FuncionCruda, Pelicula } from "../../src/tipos"
import type { Decision } from "../idioma/tipos"
import { claveDe } from "../texto"
import { cruzarAltaGracia, type FuncionCruzada } from "./alta-gracia"
import { crearRegistroPeliculas } from "./peliculas"

type Entrada = {
  crudas: FuncionCruda[]
  decisiones: Map<string, Decision>
  ahora: string
  cinemacenterHasta?: string
  tieneVenta: (compra: string) => Promise<boolean>
}

const ORDEN_FUENTES = { cinemark: 0, cinexo: 1, cinemacenter: 2 }
const esAltaGraciaDeCinexo = (cruda: FuncionCruda) => cruda.fuente === "cinexo" && cruda.cine === "altagracia"

/** Junta las funciones de todas las fuentes en la forma que consume la página. */
export async function unificar({ crudas, decisiones, ahora, cinemacenterHasta, tieneVenta }: Entrada): Promise<{ peliculas: Pelicula[]; funciones: Funcion[] }> {
  const hoy = ahora.slice(0, 10)
  const vigentes = crudas
    .filter((cruda) => cruda.diaDeCine >= hoy || cruda.inicio >= ahora) // la trasnoche de ayer puede no haber empezado
    .filter((cruda) => !decisiones.get(claveDe(cruda.titulo))?.oculta)
    .sort((primera, segunda) => ORDEN_FUENTES[primera.fuente] - ORDEN_FUENTES[segunda.fuente]) // el primer título visto da nombre
  const registro = crearRegistroPeliculas(decisiones)

  const cruzadas: FuncionCruzada[] = [
    ...vigentes.filter((cruda) => cruda.fuente !== "cinemacenter" && !esAltaGraciaDeCinexo(cruda)).map((cruda) => ({ cruda, estado: "ok" as const })),
    ...(await cruzarAltaGracia({
      cinexo: vigentes.filter(esAltaGraciaDeCinexo),
      cinemacenter: vigentes.filter((cruda) => cruda.fuente === "cinemacenter"),
      cinemacenterHasta,
      tieneVenta,
      mismaPelicula: (una, otra) => registro.idDe(una) === registro.idDe(otra),
    })),
  ]
  const funciones = cruzadas
    .map(({ cruda, estado, segun }) => ({
      cine: cruda.cine,
      pelicula: registro.idDe(cruda),
      diaDeCine: cruda.diaDeCine,
      inicio: cruda.inicio,
      formato: cruda.formato,
      version: cruda.version,
      sala: cruda.sala,
      compra: cruda.compra,
      estado,
      segun,
    }))
    .sort((primera, segunda) => primera.inicio.localeCompare(segunda.inicio) || primera.cine.localeCompare(segunda.cine))
  return { peliculas: registro.usadas(new Set(funciones.map((funcion) => funcion.pelicula))), funciones }
}
