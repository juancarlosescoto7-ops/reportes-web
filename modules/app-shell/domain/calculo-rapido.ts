export type Operacion = "+" | "-" | "*" | "/";

/** Un separador seguido de tres cifras se interpreta como miles (formato es-HN). */
export function leerCifra(texto: string): number | null {
  let limpio = texto.trim().replace(/−/g, "-");
  const contable = limpio.startsWith("(") && limpio.endsWith(")");
  if (contable) limpio = limpio.slice(1, -1).trim();
  limpio = limpio.replace(/^(?:HNL|USD|EUR|L\.?|[$€£])\s*/i, "").replace(/\s*(?:HNL|USD|EUR|[%$€£])$/i, "").trim();
  if (!/^[+-]?(?:\d[\d.,\s]*|[.,]\d+)$/.test(limpio)) return null;
  if (/\s/.test(limpio)) {
    if (!/^[+-]?\d{1,3}(?:[\s\u00a0\u202f]\d{3})+(?:[.,]\d+)?$/.test(limpio)) return null;
    limpio = limpio.replace(/\s/g, "");
  }
  const coma = limpio.lastIndexOf(",");
  const punto = limpio.lastIndexOf(".");
  if (coma >= 0 && punto >= 0) {
    const decimal = coma > punto ? "," : ".";
    const miles = decimal === "," ? "." : ",";
    const [entero, fraccion, extra] = limpio.split(decimal);
    const agrupado = new RegExp(`^[+-]?\\d{1,3}(?:\\${miles}\\d{3})+$`);
    if (extra !== undefined || !agrupado.test(entero) || !/^\d+$/.test(fraccion)) return null;
    limpio = entero.split(miles).join("") + "." + fraccion;
  } else if (coma >= 0) {
    if (/^[+-]?\d{1,3}(?:,\d{3})+$/.test(limpio)) limpio = limpio.replace(/,/g, "");
    else if (/^[+-]?\d*,\d+$/.test(limpio)) limpio = limpio.replace(",", ".");
    else return null;
  } else if ((limpio.match(/\./g) ?? []).length > 1) {
    if (!/^[+-]?\d{1,3}(?:\.\d{3})+$/.test(limpio)) return null;
    limpio = limpio.replace(/\./g, "");
  }
  const valor = Number(limpio) * (contable ? -1 : 1);
  return Number.isFinite(valor) && Math.abs(valor) <= Number.MAX_SAFE_INTEGER ? valor : null;
}

export function calcular(a: number, operacion: Operacion, b: number): { valor: number | null; error: string | null } {
  if (operacion === "/" && b === 0) return { valor: null, error: "No se puede dividir entre cero." };
  const valor = operacion === "+" ? a + b : operacion === "-" ? a - b : operacion === "*" ? a * b : a / b;
  if (!Number.isFinite(valor) || Math.abs(valor) > Number.MAX_SAFE_INTEGER) {
    return { valor: null, error: "El resultado supera el límite de cálculo." };
  }
  return { valor: Number(valor.toPrecision(15)), error: null };
}

export function formatearCifra(valor: number): string {
  return valor.toLocaleString("es-HN", { maximumSignificantDigits: 15 });
}

export function cifrasEnTexto(texto: string) {
  const cifras: { texto: string; valor: number; inicio: number; fin: number }[] = [];
  const patron = /\(?[+\-−]?(?:(?:HNL|USD|EUR|L\.?|[$€£])\s*)?(?:\d[\d.,]*|[.,]\d+)(?:[\u00a0\u202f]\d{3})*(?:\s?%)?\)?/gi;
  for (const match of texto.matchAll(patron)) {
    const inicio = match.index!;
    const fin = inicio + match[0].length;
    // No extraer fragmentos de códigos, fechas ni números mal formados.
    if (/[\p{L}\d_./-]/u.test(texto[inicio - 1] ?? "") || /[\p{L}\d_./-]/u.test(texto[fin] ?? "")) continue;
    const valor = leerCifra(match[0]);
    if (valor !== null) cifras.push({ texto: match[0], valor, inicio, fin });
  }
  return cifras;
}
