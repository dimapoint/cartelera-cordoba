import { fuentesCriticasCaidas } from "../src/cartelera"
import { ahoraEnCordoba } from "../src/fechas"
import type { Cartelera } from "../src/tipos"
import { escribirJson, leerJson, RUTAS } from "./almacen"
import { tieneVenta } from "./fuentes/cinexo"
import { bajarTodas } from "./fuentes/todas"
import { resolverIdiomas } from "./idioma/resolver"
import type { CacheIdiomas, Overrides } from "./idioma/tipos"
import { unificar } from "./unificacion/unificar"
import { validarCartelera } from "./validar"

const ahora = ahoraEnCordoba()
const { resultados, estados } = await bajarTodas(ahora)
const crudas = Object.values(resultados).flatMap((resultado) => resultado.funciones)

const cache = await leerJson<CacheIdiomas>(RUTAS.cacheIdiomas, {})
const overrides = await leerJson<Overrides>(RUTAS.overrides, {})
const decisiones = await resolverIdiomas(crudas.map((cruda) => cruda.titulo), cache, overrides, ahora.slice(0, 10))
await escribirJson(RUTAS.cacheIdiomas, cache)

const { peliculas, funciones } = await unificar({ crudas, decisiones, ahora, cinemacenterHasta: resultados.cinemacenter.cubreHasta, tieneVenta })
const cartelera: Cartelera = { generado: ahora, fuentes: estados, peliculas, funciones }
const errores = validarCartelera(cartelera)
if (errores.length) {
  // No piso el JSON anterior: la página sigue mostrando la última cartelera sana.
  console.error(`La cartelera nueva no pasa la validación (${errores.length} errores):\n${errores.slice(0, 20).join("\n")}`)
  process.exit(1)
}
await escribirJson(RUTAS.cartelera, cartelera)

const contar = (estado: string) => funciones.filter((funcion) => funcion.estado === estado).length
console.log(
  `${peliculas.length} películas, ${funciones.length} funciones` +
    ` (conflictos ${contar("conflicto")}, sospechosas ${contar("sospechosa")}, una fuente ${contar("una_fuente")})`,
)
// Una fuente opcional caída solo deja una advertencia en el log de la Action.
for (const [fuente, estado] of Object.entries(estados)) {
  if (!estado.ok && process.env.GITHUB_ACTIONS) console.log(`::warning title=${fuente} no respondió::${estado.error}`)
}
// Falla la corrida si se cayó una fuente que importa, para que GitHub avise por mail.
if (fuentesCriticasCaidas(estados).length) process.exitCode = 1
