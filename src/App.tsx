import { useMemo, useState } from "react"
import { agruparPorPelicula, diasConFunciones, esVisible } from "./cartelera"
import { CINES } from "./cines"
import { AvisosFuentes } from "./componentes/AvisosFuentes"
import { Cabecera } from "./componentes/Cabecera"
import { Pie } from "./componentes/Pie"
import { Resumen } from "./componentes/Resumen"
import { Tarjeta } from "./componentes/Tarjeta"
import { ahoraEnCordoba } from "./fechas"
import type { Cine } from "./tipos"
import { useCartelera } from "./useCartelera"

export function App() {
  const { cartelera, error } = useCartelera()
  const [diaElegido, setDiaElegido] = useState<string>()
  const [cinesElegidos, setCinesElegidos] = useState<Set<Cine>>(() => new Set(CINES.map((cine) => cine.id)))
  const [verDudosas, setVerDudosas] = useState(false)
  const ahora = ahoraEnCordoba()

  const peliculas = useMemo(() => new Map(cartelera?.peliculas.map((pelicula) => [pelicula.id, pelicula])), [cartelera])
  const visibles = useMemo(
    () => (cartelera?.funciones ?? []).filter((funcion) => esVisible(funcion, peliculas.get(funcion.pelicula)!, verDudosas)),
    [cartelera, peliculas, verDudosas],
  )
  const dias = useMemo(() => diasConFunciones(visibles), [visibles])
  const dia = diaElegido && dias.includes(diaElegido) ? diaElegido : dias[0]
  const grupos = useMemo(() => (dia ? agruparPorPelicula(visibles, peliculas, dia, cinesElegidos) : []), [visibles, peliculas, dia, cinesElegidos])

  if (error) return <p className="estado-pagina">No pude cargar la cartelera ({error}).</p>
  if (!cartelera) return <p className="estado-pagina">Cargando cartelera…</p>

  const alternarCine = (cine: Cine) =>
    setCinesElegidos((anteriores) => {
      const siguientes = new Set(anteriores)
      if (!siguientes.delete(cine)) siguientes.add(cine)
      return siguientes
    })

  return (
    <>
      <Cabecera
        generado={cartelera.generado}
        hoy={ahora.slice(0, 10)}
        dias={dias}
        dia={dia}
        alElegirDia={setDiaElegido}
        cinesElegidos={cinesElegidos}
        alAlternarCine={alternarCine}
      />
      <main className="contenedor">
        <AvisosFuentes fuentes={cartelera.fuentes} />
        <Resumen
          peliculas={grupos.length}
          funciones={grupos.reduce((total, grupo) => total + grupo.funciones.length, 0)}
          verDudosas={verDudosas}
          alCambiarDudosas={setVerDudosas}
        />
        {grupos.length === 0 && (
          <div className="vacio">
            <p className="vacio-titulo">No hay funciones en versión original</p>
            <p className="sutil">Probá con otro día o sumá cines al filtro.</p>
          </div>
        )}
        <div className="lista">
          {grupos.map((grupo) => (
            <Tarjeta key={grupo.pelicula.id} pelicula={grupo.pelicula} funciones={grupo.funciones} ahora={ahora} />
          ))}
        </div>
        <Pie />
      </main>
    </>
  )
}
