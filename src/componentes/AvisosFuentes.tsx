import { formatearMarca } from "../cartelera"
import { NOMBRE_FUENTE } from "../cines"
import type { EstadoFuente, Fuente } from "../tipos"

/** Avisa qué fuente no respondió en la última actualización y de cuándo son los datos que se muestran. */
export function AvisosFuentes({ fuentes }: { fuentes: Record<Fuente, EstadoFuente> }) {
  const caidas = (Object.entries(fuentes) as [Fuente, EstadoFuente][]).filter(([, estado]) => !estado.ok)
  return caidas.map(([fuente, estado]) => (
    <p key={fuente} className="alerta" role="status">
      {NOMBRE_FUENTE[fuente]} no respondió en la última actualización. Muestro lo que había el{" "}
      {estado.actualizado ? formatearMarca(estado.actualizado) : "(sin datos)"}.
    </p>
  ))
}
