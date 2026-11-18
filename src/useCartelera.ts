import { useEffect, useState } from "react"
import type { Cartelera } from "./tipos"

/** Carga public/cartelera.json, que genera `bun run actualizar`. */
export function useCartelera() {
  const [cartelera, setCartelera] = useState<Cartelera>()
  const [error, setError] = useState("")
  useEffect(() => {
    fetch("cartelera.json", { cache: "no-cache" })
      .then((respuesta) => (respuesta.ok ? respuesta.json() : Promise.reject(new Error(`HTTP ${respuesta.status}`))))
      .then(setCartelera)
      .catch((motivo: Error) => setError(motivo.message))
  }, [])
  return { cartelera, error }
}
