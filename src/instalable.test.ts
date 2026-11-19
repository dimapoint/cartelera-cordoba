import { describe, expect, test } from "bun:test"
import { join } from "node:path"

const RAIZ = join(import.meta.dir, "..")
const publico = (nombre: string) => Bun.file(join(RAIZ, "public", nombre))

/** Ancho y alto de un PNG, leídos de su cabecera IHDR. */
async function dimensiones(nombre: string) {
  const bytes = new DataView(await publico(nombre).arrayBuffer())
  expect(bytes.getUint32(0)).toBe(0x89504e47) // firma PNG
  return `${bytes.getUint32(16)}x${bytes.getUint32(20)}`
}

describe("instalable como app", () => {
  test("el manifiesto trae lo que Chrome pide y usa rutas relativas (el sitio vive bajo /cartelera-cordoba/)", async () => {
    const manifiesto = await publico("manifest.webmanifest").json()
    expect(manifiesto).toMatchObject({ display: "standalone", start_url: "./", scope: "./", lang: "es-AR" })
    expect(manifiesto.name).toBeTruthy()
    expect(manifiesto.short_name.length).toBeLessThanOrEqual(12)
    expect(manifiesto.background_color).toMatch(/^#[0-9a-f]{6}$/i)
  })

  test("cada ícono declarado existe y mide lo que dice", async () => {
    const { icons } = await publico("manifest.webmanifest").json()
    expect(icons.map((icono: { sizes: string }) => icono.sizes)).toEqual(["192x192", "512x512"])
    for (const icono of icons) {
      expect(icono.src.startsWith("/")).toBe(false)
      expect(await dimensiones(icono.src)).toBe(icono.sizes)
    }
    expect(await dimensiones("icono-apple.png")).toBe("180x180")
  })

  test("la página enlaza el manifiesto y los íconos con rutas que Vite ajusta a la base", async () => {
    const html = await Bun.file(join(RAIZ, "index.html")).text()
    for (const enlace of ['rel="manifest" href="/manifest.webmanifest"', 'rel="icon" href="/icono.svg"', 'rel="apple-touch-icon" href="/icono-apple.png"']) {
      expect(html).toContain(enlace)
    }
  })

  test("el service worker solo guarda GET del propio sitio y borra cachés viejas", async () => {
    const sw = await publico("sw.js").text()
    expect(sw).toContain('request.method !== "GET"')
    expect(sw).toContain("origin !== self.location.origin")
    expect(sw).toContain("caches.delete(nombre)")
  })
})
