import { agruparDiasPorMes, etiquetaDelDia, formatearMarca } from "../cartelera"
import { CINES } from "../cines"
import type { Cine } from "../tipos"

type Propiedades = {
  generado: string
  hoy: string
  dias: string[]
  dia?: string
  alElegirDia: (dia: string) => void
  cinesElegidos: Set<Cine>
  alAlternarCine: (cine: Cine) => void
}

export function Cabecera({ generado, hoy, dias, dia, alElegirDia, cinesElegidos, alAlternarCine }: Propiedades) {
  return (
    <>
      <header className="contenedor cabezal">
        <h1>Cartelera</h1>
        <p className="volanta">Actualizada el {formatearMarca(generado)}</p>
      </header>
      {/* Solo la barra de días y cines queda fija: el cabezal se va con el scroll. */}
      <div className="cabecera">
      <div className="contenedor">
        <nav className="dias" aria-label="Elegir día">
          {agruparDiasPorMes(dias, hoy).map((grupo) => (
            <div key={grupo.mes} className="mes" role="group" aria-label={grupo.nombre}>
              <span className="mes-nombre">{grupo.nombre}</span>
              <div className="mes-dias">
                {grupo.dias.map((opcion) => (
                  <button key={opcion} className="dia" aria-pressed={opcion === dia} onClick={() => alElegirDia(opcion)}>
                    <span className="dia-nombre">{etiquetaDelDia(opcion, hoy)}</span>
                    <span className="dia-numero">{Number(opcion.slice(8, 10))}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="filtros" role="group" aria-label="Cines">
          {CINES.map((cine) => (
            <button key={cine.id} className={`chip cine-${cine.id}`} aria-pressed={cinesElegidos.has(cine.id)} onClick={() => alAlternarCine(cine.id)}>
              <span className="punto" aria-hidden="true" />
              {cine.corto}
            </button>
          ))}
        </div>
      </div>
      </div>
    </>
  )
}
