type Propiedades = { verDudosas: boolean; alCambiarDudosas: (valor: boolean) => void }

export function FiltroDudosas({ verDudosas, alCambiarDudosas }: Propiedades) {
  return (
    <label className="casilla filtro-dudosas">
      <input type="checkbox" checked={verDudosas} onChange={(evento) => alCambiarDudosas(evento.target.checked)} />
      Mostrar funciones en castellano de películas sin idioma confirmado
    </label>
  )
}
