export function Pie() {
  return (
    <footer className="pie">
      <ul className="leyenda">
        <li>
          <span className="icono icono-conflicto" aria-hidden="true">
            !
          </span>
          Los dos sitios de Alta Gracia no coinciden en el idioma.
        </li>
        <li>
          <span className="icono icono-sospechosa" aria-hidden="true">
            ?
          </span>
          Figura en cinealtagracia.com.ar pero sin venta: ese día el cine suele cerrar.
        </li>
      </ul>
      <p className="sutil">Los horarios salen de los sitios de cada cine. Confirmá en el link antes de ir.</p>
    </footer>
  )
}
