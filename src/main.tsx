import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { App } from "./App"
import "./estilos.css"

// Solo en la versión publicada: en desarrollo una caché vieja taparía los cambios.
if ("serviceWorker" in navigator && import.meta.env.PROD) navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)

createRoot(document.getElementById("raiz")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
