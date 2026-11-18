import { afterAll, beforeAll, describe, expect, test } from "bun:test"
import { leerJsonDe, NAVEGADOR, pedir } from "./http"

const RAPIDO = { intentos: 3, esperaBase: 1, limite: 200 }
const llamadas = new Map<string, number>()
let servidor: ReturnType<typeof Bun.serve>

beforeAll(() => {
  servidor = Bun.serve({
    port: 0,
    async fetch(pedido) {
      const ruta = new URL(pedido.url).pathname
      const numero = (llamadas.get(ruta) ?? 0) + 1
      llamadas.set(ruta, numero)
      if (ruta === "/cae-una-vez") return numero === 1 ? new Response("caído", { status: 503 }) : new Response("bien")
      if (ruta === "/siempre-500") return new Response("caído", { status: 500 })
      if (ruta === "/no-existe") return new Response("no", { status: 404 })
      if (ruta === "/prohibido") return new Response("no", { status: 403 })
      if (ruta === "/limite") return numero === 1 ? new Response("", { status: 429 }) : new Response("bien")
      if (ruta === "/lento-una-vez") {
        if (numero === 1) await Bun.sleep(600)
        return new Response("bien")
      }
      if (ruta === "/agente") return new Response(pedido.headers.get("user-agent"))
      return new Response("bien")
    },
  })
})
afterAll(() => servidor.stop(true))
const direccion = (ruta: string) => `http://localhost:${servidor.port}${ruta}`

describe("pedir", () => {
  test("reintenta un 503 y devuelve la respuesta buena", async () => {
    expect(await (await pedir(direccion("/cae-una-vez"), {}, RAPIDO)).text()).toBe("bien")
    expect(llamadas.get("/cae-una-vez")).toBe(2)
  })

  test("reintenta un 429", async () => {
    expect(await (await pedir(direccion("/limite"), {}, RAPIDO)).text()).toBe("bien")
    expect(llamadas.get("/limite")).toBe(2)
  })

  test("un 404 o 403 falla enseguida, sin reintentar", async () => {
    await expect(pedir(direccion("/no-existe"), {}, RAPIDO)).rejects.toThrow("HTTP 404")
    await expect(pedir(direccion("/prohibido"), {}, RAPIDO)).rejects.toThrow("HTTP 403")
    expect(llamadas.get("/no-existe")).toBe(1)
    expect(llamadas.get("/prohibido")).toBe(1)
  })

  test("un 500 persistente se rinde después de todos los intentos", async () => {
    await expect(pedir(direccion("/siempre-500"), {}, RAPIDO)).rejects.toThrow("HTTP 500")
    expect(llamadas.get("/siempre-500")).toBe(3)
  })

  test("un timeout se reintenta", async () => {
    expect(await (await pedir(direccion("/lento-una-vez"), {}, RAPIDO)).text()).toBe("bien")
    expect(llamadas.get("/lento-una-vez")).toBe(2)
  })

  test("con la red caída el error dice qué URL falló", async () => {
    await expect(pedir("http://127.0.0.1:1/cartelera", {}, RAPIDO)).rejects.toThrow("http://127.0.0.1:1/cartelera")
  })

  test("manda User-Agent de navegador salvo que se pida otro", async () => {
    expect(await (await pedir(direccion("/agente"), {}, RAPIDO)).text()).toBe(NAVEGADOR)
    expect(await (await pedir(direccion("/agente"), { headers: { "User-Agent": "otro/1.0" } }, RAPIDO)).text()).toBe("otro/1.0")
  })
})

describe("leerJsonDe", () => {
  test("una página HTML en lugar de JSON da un error que dice de dónde venía", () => {
    expect(() => leerJsonDe("<!DOCTYPE html><title>Just a moment...</title>", "Cinemark showtimes")).toThrow(
      'Cinemark showtimes: la respuesta no es JSON (empieza con "<!DOCTYPE html>',
    )
  })
})
