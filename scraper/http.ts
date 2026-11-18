export const NAVEGADOR =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
// Wikimedia rechaza con 403 el User-Agent de navegador: pide uno que identifique al cliente.
export const AGENTE_WIKIMEDIA = "cartelera-cordoba/0.1 (uso personal, bajo volumen)"

export type Reintentos = { intentos: number; esperaBase: number; limite: number }
const REINTENTOS: Reintentos = { intentos: 3, esperaBase: 3000, limite: 30_000 }

/** Trae el cuerpo de una URL como texto. Las fuentes lo reciben por parámetro para poder testearlas sin red. */
export type Traer = (url: string, opciones?: RequestInit) => Promise<string>

/** GET/POST con reintentos para timeouts, red caída, 429 y 5xx; un 4xx falla enseguida. */
export async function pedir(url: string, opciones: RequestInit = {}, reintentos = REINTENTOS): Promise<Response> {
  let ultimoError = new Error(`sin intentos en ${url}`)
  for (let intento = 1; intento <= reintentos.intentos; intento++) {
    if (intento > 1) await Bun.sleep(reintentos.esperaBase * intento)
    let respuesta: Response
    try {
      respuesta = await fetch(url, {
        ...opciones,
        headers: { "User-Agent": NAVEGADOR, ...(opciones.headers as Record<string, string> | undefined) },
        signal: AbortSignal.timeout(reintentos.limite),
      })
    } catch (error) {
      ultimoError = new Error(`${(error as Error).message} en ${url}`)
      continue
    }
    if (respuesta.ok) return respuesta
    ultimoError = new Error(`HTTP ${respuesta.status} en ${url}`)
    if (respuesta.status < 500 && respuesta.status !== 429) break
  }
  throw ultimoError
}

export const traerTexto: Traer = async (url, opciones) => (await pedir(url, opciones)).text()
export const esperar = (milisegundos: number) => (milisegundos > 0 ? Bun.sleep(milisegundos) : Promise.resolve())

/** JSON.parse con un mensaje que dice de dónde venía la respuesta rota. */
export function leerJsonDe(texto: string, origen: string): any {
  try {
    return JSON.parse(texto)
  } catch {
    throw new Error(`${origen}: la respuesta no es JSON (empieza con "${texto.slice(0, 60)}")`)
  }
}
