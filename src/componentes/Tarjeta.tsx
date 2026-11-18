import { CINES } from "../cines"
import type { Funcion, Pelicula } from "../tipos"
import { Horario } from "./Horario"

/** Una película con sus horarios del día, agrupados por cine. */
export function Tarjeta({ pelicula, funciones, ahora }: { pelicula: Pelicula; funciones: Funcion[]; ahora: string }) {
  const cines = CINES.filter((cine) => funciones.some((funcion) => funcion.cine === cine.id))
  return (
    <article className="tarjeta">
      {pelicula.poster ? (
        <img className="poster" src={pelicula.poster} alt="" loading="lazy" />
      ) : (
        <div className="poster poster-vacio" aria-hidden="true">
          {pelicula.titulo.slice(0, 1)}
        </div>
      )}
      <div className="tarjeta-cuerpo">
        <h2 className="titulo">{pelicula.titulo}</h2>
        <p className="datos">
          {pelicula.duracion && <span>{pelicula.duracion} min</span>}
          {pelicula.idiomaOriginal === "es" && <span className="etiqueta etiqueta-castellano">Hablada en castellano</span>}
          {pelicula.idiomaOriginal === "desconocido" && <span className="etiqueta">Idioma por confirmar</span>}
        </p>
        {cines.map((cine) => (
          <section key={cine.id} className={`sala cine-${cine.id}`}>
            <h3>
              <span className="punto" aria-hidden="true" />
              {cine.nombre}
            </h3>
            <ul className="horarios">
              {funciones
                .filter((funcion) => funcion.cine === cine.id)
                .map((funcion) => (
                  <Horario key={`${funcion.inicio}-${funcion.compra}`} funcion={funcion} pelicula={pelicula} pasada={funcion.inicio < ahora} />
                ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  )
}
