const RELOJ_CORDOBA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Cordoba",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
})

/** Fecha y hora actual en Córdoba como AAAA-MM-DDTHH:MM, el mismo formato que `inicio`. */
export function ahoraEnCordoba(momento = new Date()): string {
  const partes = Object.fromEntries(RELOJ_CORDOBA.formatToParts(momento).map((parte) => [parte.type, parte.value]))
  return `${partes.year}-${partes.month}-${partes.day}T${partes.hour}:${partes.minute}`
}

export function sumarDias(dia: string, cantidad: number): string {
  const fecha = new Date(`${dia}T12:00:00Z`)
  fecha.setUTCDate(fecha.getUTCDate() + cantidad)
  return fecha.toISOString().slice(0, 10)
}
