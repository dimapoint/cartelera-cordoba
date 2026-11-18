import type { Estado, Fuente, FuncionCruda, Version } from "../../src/tipos"
import { contencion } from "../texto"

export type FuncionCruzada = { cruda: FuncionCruda; estado: Estado; segun?: Partial<Record<Fuente, Version>> }

type Entrada = {
  cinexo: FuncionCruda[] // base: más días y link de compra
  cinemacenter: FuncionCruda[]
  cinemacenterHasta?: string // Cinemacenter solo publica la semana en curso
  tieneVenta: (compra: string) => Promise<boolean>
  mismaPelicula: (una: FuncionCruda, otra: FuncionCruda) => boolean
}

/** Contrasta función por función los dos sitios que publican el cine de Alta Gracia. */
export async function cruzarAltaGracia({ cinexo, cinemacenter, cinemacenterHasta, tieneVenta, mismaPelicula }: Entrada): Promise<FuncionCruzada[]> {
  const sinPareja = new Set(cinemacenter)
  const cruzadas: FuncionCruzada[] = []
  for (const cruda of cinexo) {
    // Los títulos difieren entre sitios ("EBENEZER" / "EBENEZER: LOS FANTASMAS DE NAVIDAD"): la hora exacta desambigua.
    const pareja = [...sinPareja].find(
      (otra) => otra.inicio === cruda.inicio && (contencion(otra.titulo, cruda.titulo) >= 0.75 || mismaPelicula(otra, cruda)),
    )
    if (pareja) {
      sinPareja.delete(pareja)
      const estado = pareja.version === cruda.version ? "ok" : "conflicto"
      cruzadas.push({ cruda, estado, segun: { cinexo: cruda.version, cinemacenter: pareja.version } })
      continue
    }
    // Solo en Cinexo: los martes publica funciones sin precio aunque el cine cierra.
    const venta = cruda.compra ? await tieneVenta(cruda.compra).catch(() => true) : true
    const enSemanaDeCinemacenter = cinemacenterHasta !== undefined && cruda.diaDeCine <= cinemacenterHasta
    if (!venta) cruzadas.push({ cruda, estado: "sospechosa", segun: { cinexo: cruda.version } })
    else if (enSemanaDeCinemacenter) cruzadas.push({ cruda, estado: "una_fuente", segun: { cinexo: cruda.version } })
    else cruzadas.push({ cruda, estado: "ok" })
  }
  for (const cruda of sinPareja) cruzadas.push({ cruda, estado: "una_fuente", segun: { cinemacenter: cruda.version } })
  return cruzadas
}
