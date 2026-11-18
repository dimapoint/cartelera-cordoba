const plural = (cantidad: number, singular: string, plural: string) => `${cantidad} ${cantidad === 1 ? singular : plural}`

type Propiedades = { peliculas: number; funciones: number; verDudosas: boolean; alCambiarDudosas: (valor: boolean) => void }

export function Resumen({ peliculas, funciones, verDudosas, alCambiarDudosas }: Propiedades) {
  return (
    <div className="resumen">
      <p className="sutil">
        {plural(peliculas, "película", "películas")}, {plural(funciones, "función", "funciones")}. Subtituladas en 2D salvo indicación.
      </p>
      <label className="casilla">
        <input type="checkbox" checked={verDudosas} onChange={(evento) => alCambiarDudosas(evento.target.checked)} />
        Incluir castellano sin idioma confirmado
      </label>
    </div>
  )
}
