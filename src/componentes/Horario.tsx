import { SITIO_ALTA_GRACIA } from "../cines"
import type { Fuente, Funcion, Pelicula } from "../tipos"

/** Solo se anota lo que se aparta de lo normal (subtitulada en 2D), como en la cartelera de un diario. */
function describir(funcion: Funcion, pelicula: Pelicula) {
  const extras = [
    funcion.formato !== "2D" ? funcion.formato.replace(/^2D · /, "") : "",
    funcion.version === "CAST" ? (pelicula.idiomaOriginal === "es" ? "cast." : "cast.?") : "",
  ].filter(Boolean)
  const fuentes = Object.keys(funcion.segun ?? {}) as Fuente[]
  const notas: Record<Funcion["estado"], string | undefined> = {
    ok: undefined,
    conflicto: fuentes.map((fuente) => `${SITIO_ALTA_GRACIA[fuente]} ${funcion.segun?.[fuente]}`).join(", "),
    sospechosa: "sin venta",
    una_fuente: `solo ${fuentes.map((fuente) => SITIO_ALTA_GRACIA[fuente]).join(", ")}`,
  }
  return { extras: extras.join(" "), nota: notas[funcion.estado] }
}

export function Horario({ funcion, pelicula, pasada }: { funcion: Funcion; pelicula: Pelicula; pasada: boolean }) {
  const { extras, nota } = describir(funcion, pelicula)
  const clases = ["horario", `estado-${funcion.estado}`, pasada ? "pasada" : ""].join(" ")
  const titulo = [funcion.sala, nota, pasada ? "ya empezó" : ""].filter(Boolean).join(" · ") || undefined
  const contenido = (
    <>
      <span className="hora">{funcion.inicio.slice(11, 16)}</span>
      {funcion.estado === "conflicto" && <span className="llamada" aria-hidden="true">†</span>}
      {funcion.estado === "sospechosa" && <span className="llamada" aria-hidden="true">?</span>}
      {extras && <span className="extras">{extras}</span>}
      {nota && <span className="horario-nota">({nota})</span>}
    </>
  )
  return (
    <li>
      {funcion.compra ? (
        <a className={clases} href={funcion.compra} target="_blank" rel="noreferrer" title={titulo}>
          {contenido}
        </a>
      ) : (
        <span className={clases} title={titulo}>
          {contenido}
        </span>
      )}
    </li>
  )
}
