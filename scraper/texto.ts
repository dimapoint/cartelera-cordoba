// Marcas de formato o versión que los cines pegan al título ("2D CAST", "4D+3D XL INFINITY VISION").
const MARCAS = new Set([
  "2D", "3D", "4D", "4DX", "IMAX", "XD", "XL", "DBOX", "D-BOX", "ATMOS", "DOLBY", "PREMIER", "PREMIUM",
  "COMFORT", "SUB", "SUBT", "SUBTITULADA", "SUBTITULADO", "CAST", "CASTELLANO", "DOB", "DOBLADA",
  "DOBLADO", "ESP", "ESPAÑOL", "VOS", "VOSE", "VO", "DIGITAL", "HFR", "SCREENX", "MACRO", "XE",
  "E-MOTION", "DIG", "INFINITY", "VISION", "HD",
])
const PARENTESIS = /\s*[\(\[]([^\)\]]*)[\)\]]\s*/g
const REESTRENO = /\bRE[\s-]?ESTRENO\b|\bANIVERSARIO\b|\bREMASTERIZAD[AO]\b|\bVERSI[OÓ]N EXTENDIDA\b/i
const ANIVERSARIO = /\s+\d+\s*°?\s*ANIVERSARIO\s*$|\s+-\s*\d+\s*AÑOS\s*$/i
const EVENTO = /\b(WORLD TOUR|TOUR|EN VIVO|LIVE|CONCIERTO|OPERA|BALLET|BOLSHOI)\b|ÓPERA/i
const PALABRAS_VACIAS = new Set(["el", "la", "los", "las", "de", "del", "un", "una", "y", "en", "a"])

/** Clave de comparación: sin tildes ni signos, en minúsculas. */
export function normalizarClave(texto: string): string {
  return texto
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^0-9a-z]+/g, " ")
    .trim()
}

const esMarca = (palabra: string) => palabra.toUpperCase().split("+").every((parte) => MARCAS.has(parte))

/** Saca sufijos de formato/versión y detecta reestrenos y eventos. */
export function limpiarTitulo(crudo: string): { titulo: string; banderas: string[] } {
  let titulo = crudo.normalize("NFC").trim()
  const banderas = new Set<string>()
  for (const [, contenido] of titulo.matchAll(PARENTESIS)) {
    if (REESTRENO.test(contenido)) banderas.add("reestreno")
    else if (/PRE[\s-]?ESTRENO|AVANT|PREMIERE|PREVENTA/i.test(contenido)) banderas.add("preestreno")
  }
  titulo = titulo.replace(PARENTESIS, " ").trim()
  // Corta el último " - " solo si todo lo que sigue son marcas: no rompe "MISIÓN: IMPOSIBLE - SENTENCIA FINAL".
  const corte = titulo.lastIndexOf(" - ")
  if (corte !== -1) {
    const cola = titulo.slice(corte + 3).trim()
    if (cola && cola.split(/\s+/).every(esMarca)) titulo = titulo.slice(0, corte).trim()
  }
  const palabras = titulo.split(/\s+/)
  while (palabras.length > 1 && esMarca(palabras[palabras.length - 1])) palabras.pop()
  titulo = palabras.join(" ")
  const aniversario = titulo.match(ANIVERSARIO)
  if (aniversario) {
    banderas.add("reestreno")
    banderas.add(`aniversario_${aniversario[0].match(/\d+/)![0]}`)
    titulo = titulo.replace(ANIVERSARIO, "").trim()
  }
  if (REESTRENO.test(titulo)) banderas.add("reestreno")
  if (EVENTO.test(titulo)) banderas.add("evento")
  return { titulo, banderas: [...banderas].sort() }
}

/** Clave de una película a partir del título crudo que publica cualquier cine. */
export const claveDe = (titulo: string) => normalizarClave(limpiarTitulo(titulo).titulo)

/** Qué parte de las palabras del título más corto aparece en el otro (0 a 1). */
export function contencion(tituloA: string, tituloB: string): number {
  const palabras = (titulo: string) =>
    new Set(normalizarClave(limpiarTitulo(titulo).titulo).split(" ").filter((palabra) => palabra && !PALABRAS_VACIAS.has(palabra)))
  const conjuntoA = palabras(tituloA)
  const conjuntoB = palabras(tituloB)
  if (!conjuntoA.size || !conjuntoB.size) return 0
  const comunes = [...conjuntoA].filter((palabra) => conjuntoB.has(palabra)).length
  return comunes / Math.min(conjuntoA.size, conjuntoB.size)
}
