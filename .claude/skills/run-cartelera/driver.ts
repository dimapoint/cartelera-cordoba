/**
 * Maneja la página en un navegador headless (Edge o Chrome ya instalados, vía playwright-core):
 * recorre el flujo típico, saca capturas y termina con un resumen JSON. Sale con 1 si algo falla.
 *
 * Uso: bun .claude/skills/run-cartelera/driver.ts [url] [carpeta_de_capturas]
 *   NAVEGADOR=chrome para usar Chrome en vez de Edge.
 *   DIA=AAAA-MM-DD para abrir además ese día (por ejemplo, una preventa) y capturarlo.
 */
import { mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { chromium, type Page } from "playwright-core"

const url = process.argv[2] ?? "http://localhost:5173/"
const carpeta = process.argv[3] ?? join(tmpdir(), "cartelera-capturas")
await mkdir(carpeta, { recursive: true })

const problemas: string[] = []
const resumen: Record<string, unknown> = { url, carpeta }

async function abrir(pagina: Page) {
  // Los 404 se anotan con su URL; el mensaje de consola equivalente no dice qué recurso falló.
  pagina.on("response", (respuesta) => respuesta.status() >= 400 && problemas.push(`HTTP ${respuesta.status()} en ${respuesta.url()}`))
  pagina.on("console", (mensaje) => {
    if (mensaje.type() === "error" && !mensaje.text().startsWith("Failed to load resource")) problemas.push(`consola: ${mensaje.text()}`)
  })
  pagina.on("pageerror", (error) => problemas.push(`excepción: ${error.message}`))
  await pagina.goto(url)
  // Espera contenido real (tarjetas o el aviso de día vacío) o el error de carga, nunca el "Cargando…".
  await pagina.waitForFunction(
    () => document.querySelector(".tarjeta, .vacio") || document.querySelector(".estado-pagina")?.textContent?.startsWith("No pude"),
    undefined,
    { timeout: 30_000 },
  )
  const error = await pagina.$eval(".estado-pagina", (nodo) => nodo.textContent).catch(() => null)
  if (error) throw new Error(error)
}

/** Fuerza la carga de los pósters (son lazy) y espera las transiciones antes de capturar. */
async function capturar(pagina: Page, nombre: string) {
  await pagina.evaluate(async () => {
    for (const imagen of document.querySelectorAll<HTMLImageElement>("img[loading=lazy]")) imagen.loading = "eager"
    await Promise.all([...document.images].map((imagen) => (imagen.complete ? null : new Promise((listo) => imagen.addEventListener("load", listo, { once: true }) || setTimeout(listo, 3000)))))
  })
  await pagina.waitForTimeout(300)
  const ruta = join(carpeta, `${nombre}.png`)
  await pagina.screenshot({ path: ruta })
  return ruta
}

const estadoDelDia = (pagina: Page) =>
  pagina.evaluate(() => ({
    dia: document.querySelector('.dia[aria-pressed="true"]')?.getAttribute("data-dia"),
    titulos: [...document.querySelectorAll(".tarjeta .titulo")].map((nodo) => nodo.textContent),
    casillaDudosas: Boolean(document.querySelector(".filtro-dudosas")),
    funciones: document.querySelectorAll(".horario").length,
    tarjetas: document.querySelectorAll(".tarjeta").length,
    cines: [...new Set([...document.querySelectorAll(".sala h3")].map((nodo) => nodo.textContent))],
    conflictos: document.querySelectorAll(".estado-conflicto").length,
    sospechosas: document.querySelectorAll(".estado-sospechosa").length,
    avisosDeFuentes: [...document.querySelectorAll(".alerta")].map((nodo) => nodo.textContent),
  }))

/** Anota un problema si el documento es más ancho que la ventana (la página se puede correr de costado). */
async function revisarScrollHorizontal(pagina: Page, donde: string) {
  const { documento, ventana } = await pagina.evaluate(() => ({ documento: document.documentElement.scrollWidth, ventana: document.documentElement.clientWidth }))
  if (documento > ventana) problemas.push(`scroll horizontal en ${donde}: el documento mide ${documento}px y la ventana ${ventana}px`)
}

const navegador = await chromium.launch({ channel: process.env.NAVEGADOR ?? "msedge", headless: true })
try {
  const escritorio = await navegador.newPage({ viewport: { width: 1100, height: 900 }, colorScheme: "dark" })
  await abrir(escritorio)
  // Con muchos días en un mes, la tira tiene que bajar de renglón en vez de ensanchar la página.
  await revisarScrollHorizontal(escritorio, "escritorio")
  resumen.dias = await escritorio.$$eval(".dia", (nodos) => nodos.map((nodo) => nodo.getAttribute("data-dia")))
  resumen.primerDia = await estadoDelDia(escritorio)
  resumen.capturas = [await capturar(escritorio, "1-primer-dia")]

  // Cambiar de día: el segundo de la tira.
  if ((resumen.dias as string[]).length > 1) {
    await escritorio.locator(".dia").nth(1).click()
    await escritorio.waitForFunction(() => document.querySelectorAll('.dia[aria-pressed="true"]').length === 1)
    resumen.segundoDia = await estadoDelDia(escritorio)
    ;(resumen.capturas as string[]).push(await capturar(escritorio, "2-segundo-dia"))
  }

  // El último día de la tira es el más lejano: ahí están las preventas de diciembre.
  resumen.meses = await escritorio.$$eval(".mes-nombre", (nodos) => nodos.map((nodo) => nodo.textContent))
  await escritorio.locator(".dia").last().click()
  await escritorio.waitForFunction(() => document.querySelector(".mes:last-child .dia:last-child")?.getAttribute("aria-pressed") === "true")
  resumen.ultimoDia = await estadoDelDia(escritorio)
  ;(resumen.capturas as string[]).push(await capturar(escritorio, "2b-ultimo-dia"))

  // Un día puntual pedido por DIA=AAAA-MM-DD, para revisar una película o una preventa concreta.
  const pedido = process.env.DIA
  if (pedido) {
    const boton = escritorio.locator(`.dia[data-dia="${pedido}"]`)
    if (await boton.count()) {
      await boton.click()
      await escritorio.waitForFunction((dia) => document.querySelector(`.dia[data-dia="${dia}"]`)?.getAttribute("aria-pressed") === "true", pedido)
      resumen.diaPedido = await estadoDelDia(escritorio)
      ;(resumen.capturas as string[]).push(await capturar(escritorio, `2c-dia-${pedido}`))
    } else problemas.push(`el día ${pedido} no está en la tira (no tiene funciones visibles)`)
  }

  // Filtro de cines: deja solo Alta Gracia y comprueba que no queden horarios de otros cines.
  // Se recorren todos los chips: filtrar por aria-pressed cambia la lista a medida que se hace clic.
  for (const chip of await escritorio.locator(".chip").all()) {
    const elegido = (await chip.getAttribute("aria-pressed")) === "true"
    const esAltaGracia = (await chip.textContent())?.includes("Alta Gracia")
    if (elegido !== esAltaGracia) await chip.click()
  }
  const soloAltaGracia = await estadoDelDia(escritorio)
  resumen.soloAltaGracia = soloAltaGracia
  if (soloAltaGracia.cines.some((cine) => !cine?.includes("Alta Gracia"))) problemas.push(`el filtro dejó otros cines: ${soloAltaGracia.cines}`)
  ;(resumen.capturas as string[]).push(await capturar(escritorio, "3-solo-alta-gracia"))

  const celular = await navegador.newPage({ viewport: { width: 375, height: 812 }, colorScheme: "light", isMobile: true })
  await abrir(celular)
  await revisarScrollHorizontal(celular, "celular")
  ;(resumen.capturas as string[]).push(await capturar(celular, "4-celular-claro"))

  // Las otras dos combinaciones de tema, para no revisar solo escritorio oscuro y celular claro.
  const escritorioClaro = await navegador.newPage({ viewport: { width: 1100, height: 900 }, colorScheme: "light" })
  await abrir(escritorioClaro)
  ;(resumen.capturas as string[]).push(await capturar(escritorioClaro, "1b-escritorio-claro"))
  const celularOscuro = await navegador.newPage({ viewport: { width: 375, height: 812 }, colorScheme: "dark", isMobile: true })
  await abrir(celularOscuro)
  await revisarScrollHorizontal(celularOscuro, "celular oscuro")
  ;(resumen.capturas as string[]).push(await capturar(celularOscuro, "4b-celular-oscuro"))

  // Entre 520 y 760 px la tira usa el diseño de escritorio con menos lugar.
  const angosta = await navegador.newPage({ viewport: { width: 700, height: 900 }, colorScheme: "light" })
  await abrir(angosta)
  await revisarScrollHorizontal(angosta, "ventana de 700px")
} catch (error) {
  problemas.push((error as Error).message)
} finally {
  await navegador.close()
}

resumen.problemas = problemas
console.log(JSON.stringify(resumen, null, 2))
process.exit(problemas.length ? 1 : 0)
