import { SITIO_ALTA_GRACIA } from "../cines"
import type { Fuente, Funcion, Pelicula } from "../tipos"

function describir(funcion: Funcion, pelicula: Pelicula) {
  const idioma = funcion.version === "SUB" ? "SUB" : pelicula.idiomaOriginal === "es" ? "CAST" : "CAST ¿?"
  const fuentes = Object.keys(funcion.segun ?? {}) as Fuente[]
  const notas: Record<Funcion["estado"], string | undefined> = {
    ok: undefined,
    conflicto: fuentes.map((fuente) => `${SITIO_ALTA_GRACIA[fuente]}: ${funcion.segun?.[fuente]}`).join(" · "),
    sospechosa: "Sin venta online",
    una_fuente: `Solo en ${fuentes.map((fuente) => SITIO_ALTA_GRACIA[fuente]).join(", ")}`,
  }
  return { idioma, nota: notas[funcion.estado] }
}

/** Un horario como entrada: hora, versión y formato, con aviso si los sitios de Alta Gracia no coinciden. */
export function Horario({ funcion, pelicula, pasada }: { funcion: Funcion; pelicula: Pelicula; pasada: boolean }) {
  const { idioma, nota } = describir(funcion, pelicula)
  const clases = ["horario", `estado-${funcion.estado}`, pasada ? "pasada" : ""].join(" ")
  const titulo = [funcion.sala, nota, pasada ? "ya empezó" : ""].filter(Boolean).join(" · ") || undefined
  const contenido = (
    <>
      <span className="horario-fila">
        <strong className="hora">{funcion.inicio.slice(11, 16)}</strong>
        {funcion.estado === "conflicto" && (
          <span className="icono icono-conflicto" aria-hidden="true">
            !
          </span>
        )}
        {funcion.estado === "sospechosa" && (
          <span className="icono icono-sospechosa" aria-hidden="true">
            ?
          </span>
        )}
      </span>
      <span className="horario-detalle">
        {idioma} · {funcion.formato}
      </span>
      {nota && <span className="horario-nota">{nota}</span>}
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
