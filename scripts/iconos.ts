/**
 * Genera los PNG de los íconos a partir de public/icono.svg, con el Edge o Chrome instalados.
 * Uso: bun run iconos   (NAVEGADOR=chrome para usar Chrome)
 */
import { join } from "node:path"
import { chromium } from "playwright-core"

const PUBLICO = join(import.meta.dir, "..", "public")
const TAMANIOS: Record<string, number> = { "icono-192.png": 192, "icono-512.png": 512, "icono-apple.png": 180 }

const svg = await Bun.file(join(PUBLICO, "icono.svg")).text()
const navegador = await chromium.launch({ channel: process.env.NAVEGADOR ?? "msedge", headless: true })
try {
  for (const [archivo, lado] of Object.entries(TAMANIOS)) {
    const pagina = await navegador.newPage({ viewport: { width: lado, height: lado } })
    await pagina.setContent(`<style>html,body{margin:0}svg{display:block;width:${lado}px;height:${lado}px}</style>${svg}`)
    await pagina.screenshot({ path: join(PUBLICO, archivo), clip: { x: 0, y: 0, width: lado, height: lado } })
    await pagina.close()
    console.log(`${archivo} ${lado}x${lado}`)
  }
} finally {
  await navegador.close()
}
