import { describe, expect, test } from "bun:test"
import { claveDe, contencion, limpiarTitulo, normalizarClave } from "./texto"

describe("limpiarTitulo", () => {
  const casos: [string, string, string[]][] = [
    ["JU-ON: EL GRITO - 2D CAST (RE ESTRENO)", "JU-ON: EL GRITO", ["reestreno"]],
    ["ROCKY 50° ANIVERSARIO", "ROCKY", ["aniversario_50", "reestreno"]],
    ["ROCKY 50 ANIVERSARIO - 2D SUB", "ROCKY", ["aniversario_50", "reestreno"]],
    ["LOS JUEGOS DEL HAMBRE: AMANECER EN LA COSECHA - 2D SUB", "LOS JUEGOS DEL HAMBRE: AMANECER EN LA COSECHA", []],
    ["Avengers: Doomsday 4D+3D XL INFINITY VISION", "Avengers: Doomsday", []],
    ["Godzilla Minus Zero 2D+4D XL ", "Godzilla Minus Zero", []],
    ["Spider-man: Un Nuevo Día 3D", "Spider-man: Un Nuevo Día", []],
    ["AVATAR - 3D SUB (SALA ATMOS)", "AVATAR", []],
    ["VOLVER AL FUTURO (PREESTRENO) - 2D SUB", "VOLVER AL FUTURO", ["preestreno"]],
    // No toca números ni guiones que son parte del título.
    ["TOY STORY 5 - 3D CAST", "TOY STORY 5", []],
    ["MISIÓN: IMPOSIBLE - SENTENCIA FINAL", "MISIÓN: IMPOSIBLE - SENTENCIA FINAL", []],
    ["BLADE RUNNER 2049", "BLADE RUNNER 2049", []],
    // Si el título entero es una marca, no queda vacío.
    ["3D", "3D", []],
    ["BTS WORLD TOUR 'ARIRANG' IN JAKARTA", "BTS WORLD TOUR 'ARIRANG' IN JAKARTA", ["evento"]],
    ["TOSCA - ÓPERA EN VIVO", "TOSCA - ÓPERA EN VIVO", ["evento"]],
    ["", "", []],
  ]
  test.each(casos)("%p", (crudo, titulo, banderas) => expect(limpiarTitulo(crudo)).toEqual({ titulo, banderas }))
})

describe("claves y comparación de títulos", () => {
  test("ignora tildes, signos, mayúsculas y sufijos de versión", () => {
    expect(normalizarClave("¡PLUMAS! OPERACIÓN RESCATE")).toBe("plumas operacion rescate")
    expect(normalizarClave("Ñandú")).toBe("nandu")
    expect(claveDe("CÓMO ROBAR UN BANCO - 2D SUB")).toBe(claveDe("Como robar un banco"))
  })

  test("contención entre títulos de distintos sitios", () => {
    expect(contencion("EBENEZER", "EBENEZER: LOS FANTASMAS DE NAVIDAD - 2D SUB")).toBe(1)
    expect(contencion("El Bosque Salvaje: Wildwood", "WILDWOOD: EL BOSQUE SALVAJE")).toBe(1)
    expect(contencion("MADRE SINIESTRA", "CÓMO ROBAR UN BANCO")).toBe(0)
    expect(contencion("ROCKY", "YO SOY ROCKY")).toBe(1) // por eso el cruce exige además la misma hora
  })

  test("títulos vacíos o de solo palabras vacías no coinciden con nada", () => {
    expect(contencion("", "MADRE SINIESTRA")).toBe(0)
    expect(contencion("EL LA LOS", "EL LA LOS")).toBe(0)
  })
})
