import { CINES } from "../cines"
import type { Funcion, Pelicula } from "../tipos"
import { Horario } from "./Horario"

/** Una película con sus horarios del día, una línea por cine, como en la cartelera del diario. */
export function Tarjeta({ pelicula, funciones, ahora }: { pelicula: Pelicula; funciones: Funcion[]; ahora: string }) {
  const cines = CINES.filter((cine) => funciones.some((funcion) => funcion.cine === cine.id))
  return (
    <article className="tarjeta">
      {pelicula.poster ? <img className="poster" src={pelicula.poster} alt="" loading="lazy" /> : <div className="poster poster-vacio" aria-hidden="true" />}
      <div className="tarjeta-cuerpo">
        <h2 className="titulo">{pelicula.titulo}</h2>
        <p className="datos">
          {pelicula.duracion && <span>{pelicula.duracion} min</span>}
          {pelicula.idiomaOriginal === "es" && <span className="marca-castellano">Hablada en castellano</span>}
          {pelicula.idiomaOriginal === "desconocido" && <span>Idioma original sin confirmar</span>}
        </p>
        {cines.map((cine) => (
          <section key={cine.id} className={`sala cine-${cine.id}`}>
            <h3>
              <span className="punto" aria-hidden="true" />
              {cine.corto}
            </h3>
            <ul className="horarios">
              {funciones
                .filter((funcion) => funcion.cine === cine.id)
                .map((funcion) => (
                  <Horario key={`${funcion.inicio}-${funcion.sala}-${funcion.compra}`} funcion={funcion} pelicula={pelicula} pasada={funcion.inicio < ahora} />
                ))}
            </ul>
          </section>
        ))}
      </div>
    </article>
  )
}
