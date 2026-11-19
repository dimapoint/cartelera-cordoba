import { formatearMarca, fuentesCriticasCaidas } from "../cartelera"
import { NOMBRE_FUENTE } from "../cines"
import type { EstadoFuente, Fuente } from "../tipos"

/** Avisa qué fuente importante no respondió en la última actualización y de cuándo son los datos que se muestran. */
export function AvisosFuentes({ fuentes }: { fuentes: Record<Fuente, EstadoFuente> }) {
  return fuentesCriticasCaidas(fuentes).map((fuente) => (
    <p key={fuente} className="alerta" role="status">
      {NOMBRE_FUENTE[fuente]} no respondió en la última actualización. Muestro lo que había el{" "}
      {fuentes[fuente].actualizado ? formatearMarca(fuentes[fuente].actualizado) : "(sin datos)"}.
    </p>
  ))
}
