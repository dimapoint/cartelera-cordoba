import { sumarDias } from "../../src/fechas"
import type { FuncionCruda, ResultadoFuente, Version } from "../../src/tipos"
import { esperar, pedir, type Traer } from "../http"

const SITIO = "https://www.cinemacenter.com.ar"
const ALTA_GRACIA = { ciudad: "1", cine: "9" }
// El '">' final evita el seleccionarMovie(...) del onload del <head>, que duplicaría el primer show.
const SHOW = /seleccionarMovie\('[^']*','[^']*',(\d+),(\d+),(\d+)\)">(.*?)<\/a>/g
const DIA = /<div class="day">([^<]+)<\/div>\s*<ul class="hours">(.*?)<\/ul>/gs
const HORA = /<li class='([a-z]*)'>(?:<a [^>]*>)?(\d{1,2}:\d{2})(?:<\/a>)?<\/li>/g
const TITULO = /^(.*?)\s+-\s+(\S+)\s+([A-Z]+)\s*(\(.*\))?$/
const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"]
const ENTIDADES: Record<string, string> = {
  amp: "&", quot: '"', apos: "'", nbsp: " ", middot: "·", iquest: "¿", iexcl: "¡",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", uuml: "ü",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", Uuml: "Ü",
}
// El sitio dice ISO-8859-1 pero las sinopsis traen bytes cp1252: windows-1252 decodifica las dos cosas.
const DECODIFICADOR = new TextDecoder("windows-1252")

type Show = { id: string; titulo: string }
export type EntornoCinemacenter = { traer: Traer; pausa: number }
const traerCp1252: Traer = async (url, opciones) => DECODIFICADOR.decode(await (await pedir(url, opciones)).arrayBuffer())
const ENTORNO: EntornoCinemacenter = { traer: traerCp1252, pausa: 500 }

const desescapar = (texto: string) =>
  texto.replace(/&(#\d+|[a-zA-Z]+);/g, (entidad, nombre: string) =>
    nombre.startsWith("#") ? String.fromCharCode(Number(nombre.slice(1))) : (ENTIDADES[nombre] ?? entidad))

export async function bajarCinemacenter(entorno = ENTORNO): Promise<ResultadoFuente> {
  // Sin la cookie el sitio muestra Mar del Plata.
  const horarios = await entorno.traer(`${SITIO}/horarios`, { headers: { Cookie: `cityid=${ALTA_GRACIA.ciudad}` } })
  const { shows, cubreHasta } = parsearHorarios(horarios)
  const funciones: FuncionCruda[] = []
  for (const show of shows) {
    const grilla = await entorno.traer(`${SITIO}/modules/parts/ajax_horariosShow.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `showId=${show.id}&cityId=${ALTA_GRACIA.ciudad}&cinemaId=${ALTA_GRACIA.cine}`,
    })
    funciones.push(...parsearGrilla(grilla, show))
    await esperar(entorno.pausa)
  }
  // La grilla responde 200 y vacía si cambian los parámetros: cero funciones es una rotura, no una semana sin cine.
  if (!funciones.length) throw new Error("Cinemacenter: 0 funciones en Alta Gracia")
  return { funciones, cubreHasta }
}

export function parsearHorarios(html: string): { shows: Show[]; cubreHasta: string } {
  if (!/id="divTitleCity">Alta Gracia</.test(html)) throw new Error("Cinemacenter: la página no quedó en Alta Gracia")
  const shows = [...html.matchAll(SHOW)].map(([, cine, id, ciudad, titulo]) => {
    if (cine !== ALTA_GRACIA.cine || ciudad !== ALTA_GRACIA.ciudad) throw new Error(`Cinemacenter: show ${id} de otro cine (${cine})`)
    return { id, titulo: desescapar(titulo).trim() }
  })
  if (!shows.length) throw new Error("Cinemacenter: no encontré shows en /horarios")
  const limite = html.match(/class="datelimit">DESDE EL [\d/]+ AL <em>(\d\d)\/(\d\d)\/(\d{4})<\/em>/)
  if (!limite) throw new Error("Cinemacenter: no encontré el rango de la semana")
  return { shows, cubreHasta: `${limite[3]}-${limite[2]}-${limite[1]}` }
}

export function parsearGrilla(html: string, show: Show): FuncionCruda[] {
  const partes = show.titulo.match(TITULO)
  if (!partes) throw new Error(`Cinemacenter: título sin versión "${show.titulo}"`)
  const [, titulo, formato, idioma] = partes
  if (idioma !== "SUB" && idioma !== "CAST") throw new Error(`Cinemacenter: valor de idioma nuevo "${idioma}"`)
  const funciones: FuncionCruda[] = []
  for (const [, textoDia, horas] of html.matchAll(DIA)) {
    const fecha = desescapar(textoDia).match(/(\d+)\s+de\s+(\w+)\s+de\s+(\d{4})/i)
    const mes = fecha ? MESES.indexOf(fecha[2].toLowerCase()) + 1 : 0
    if (!fecha || !mes) throw new Error(`Cinemacenter: fecha rara "${textoDia}"`)
    const dia = `${fecha[3]}-${String(mes).padStart(2, "0")}-${fecha[1].padStart(2, "0")}`
    const encontradas = [...horas.matchAll(HORA)]
    if (encontradas.length !== (horas.match(/<li\b/g) ?? []).length) throw new Error(`Cinemacenter: horario sin reconocer en ${show.id}`)
    for (const [, clase, horaCruda] of encontradas) {
      const hora = horaCruda.padStart(5, "0")
      // "late" es trasnoche; la madrugada también cae al día siguiente, como hace el buscador del sitio.
      const trasnoche = clase === "late" || hora < "07:00"
      funciones.push({
        fuente: "cinemacenter",
        cine: "altagracia",
        titulo,
        diaDeCine: dia,
        inicio: `${trasnoche ? sumarDias(dia, 1) : dia}T${hora}`,
        formato,
        version: idioma as Version,
        compra: `${SITIO}/ficha/${show.id}`,
      })
    }
  }
  return funciones
}
