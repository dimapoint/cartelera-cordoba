/**
 * Comprueba que la página sea instalable y funcione sin conexión, con Edge o Chrome vía playwright-core.
 * Solo sirve contra la versión compilada (en `bun run dev` no se registra el service worker):
 *   bun run build && bun run preview -- --port 4173   (en otra terminal)
 *   bun .claude/skills/run-cartelera/instalable.ts http://localhost:4173/
 * También se puede apuntar a la URL publicada. Sale con 1 si algo falla.
 */
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { chromium } from "playwright-core"

const url = process.argv[2] ?? "http://localhost:4173/"
const problemas: string[] = []
// Un contexto anónimo (browser.newContext) siempre da "in-incognito": hace falta un perfil persistente.
const perfil = await mkdtemp(join(tmpdir(), "cartelera-perfil-"))
const contexto = await chromium.launchPersistentContext(perfil, {
  channel: process.env.NAVEGADOR ?? "msedge",
  headless: true,
  viewport: { width: 390, height: 800 },
})
try {
  const pagina = await contexto.newPage()
  await pagina.goto(url)
  await pagina.waitForSelector(".tarjeta, .vacio", { timeout: 30_000 })
  await pagina.evaluate(() => navigator.serviceWorker.ready)
  // El service worker toma el control de la página recién en la carga siguiente.
  await pagina.reload()
  await pagina.waitForSelector(".tarjeta, .vacio")

  const cdp = await contexto.newCDPSession(pagina)
  const { installabilityErrors } = await cdp.send("Page.getInstallabilityErrors")
  for (const error of installabilityErrors) problemas.push(`no instalable: ${error.errorId} ${JSON.stringify(error.errorArguments)}`)
  const { url: urlManifiesto, errors } = await cdp.send("Page.getAppManifest")
  for (const error of errors) problemas.push(`manifiesto: ${error.message}`)

  await contexto.setOffline(true)
  await pagina.reload()
  await pagina.waitForSelector(".tarjeta, .vacio", { timeout: 15_000 }).catch(() => problemas.push("sin conexión la página no abre"))
  const sinConexion = {
    tarjetas: await pagina.locator(".tarjeta").count(),
    actualizada: await pagina.locator(".volanta").textContent().catch(() => null),
  }
  if (!sinConexion.tarjetas) problemas.push("sin conexión no hay películas")
  console.log(JSON.stringify({ url, manifiesto: urlManifiesto, instalable: installabilityErrors.length === 0, sinConexion, problemas }, null, 2))
} catch (error) {
  problemas.push((error as Error).message)
  console.log(JSON.stringify({ url, problemas }, null, 2))
} finally {
  await contexto.close()
  await rm(perfil, { recursive: true, force: true })
}
process.exit(problemas.length ? 1 : 0)
