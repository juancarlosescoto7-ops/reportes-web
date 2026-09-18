export function validarRubroIngresoSaft(codigo: unknown, descripcion: unknown) {
  const codigoSaft = typeof codigo === "string"
    ? codigo.trim().replace(/^'+/, "").replace(/\.0+$/, "")
    : "";
  const descripcionSaft = typeof descripcion === "string" ? descripcion.trim() : "";

  if (!codigoSaft || codigoSaft.length > 100 || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(codigoSaft)) {
    return { error: "El código SAFT no es válido." } as const;
  }
  if (!descripcionSaft || descripcionSaft.length > 500) {
    return { error: "La descripción SAFT es obligatoria y no puede exceder 500 caracteres." } as const;
  }
  return { codigoSaft, descripcionSaft } as const;
}

export type RubroSaftPegado = {
  fila: number;
  codigoSaft: string;
  descripcionSaft: string;
  monto: number | null;
  error: string;
};

// Excel utiliza tabulaciones y encierra en comillas las celdas con saltos de línea.
function leerCeldasExcel(texto: string) {
  const filas: string[][] = [];
  let fila: string[] = [];
  let celda = "";
  let entreComillas = false;
  const source = texto.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"' && (entreComillas || celda === "")) {
      if (entreComillas && source[i + 1] === '"') { celda += '"'; i++; }
      else entreComillas = !entreComillas;
    } else if (!entreComillas && (char === "\t" || char === "\n")) {
      fila.push(celda); celda = "";
      if (char === "\n") { filas.push(fila); fila = []; }
    } else celda += char;
  }
  fila.push(celda);
  filas.push(fila);
  return { filas, entreComillas };
}

function montoExcel(texto: string): number | null {
  const value = texto.trim().replace(/^(?:HNL\s*|L\.?\s*|\$\s*)/i, "").trim();
  let normalized = "";
  if (/^\d+(?:[.,]\d{1,2})?$/.test(value)) normalized = value.replace(",", ".");
  else if (/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(value)) normalized = value.replace(/,/g, "");
  else if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(value)) normalized = value.replace(/\./g, "").replace(",", ".");
  else if (/^\d{1,3}(?:[ \u00a0\u202f]\d{3})+(?:[.,]\d{1,2})?$/.test(value)) normalized = value.replace(/[ \u00a0\u202f]/g, "").replace(",", ".");
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) && Number.isSafeInteger(Math.round(number * 100)) ? number : null;
}

export function leerRubrosSaftPegados(texto: string): RubroSaftPegado[] {
  const { filas, entreComillas } = leerCeldasExcel(texto);
  const result: RubroSaftPegado[] = [];
  const codigos = new Map<string, RubroSaftPegado>();
  const encabezado = (value: string) => value.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  for (const [index, cells] of filas.entries()) {
    if (cells.every((cell) => !cell.trim())) continue;
    const [codigo = "", nombre = "", monto = ""] = cells;
    if (!result.length && ["codigo", "codigo saft"].includes(encabezado(codigo)) && ["nombre", "descripcion"].includes(encabezado(nombre)) && encabezado(monto) === "monto") continue;
    const rubro = validarRubroIngresoSaft(codigo, nombre);
    const cantidad = montoExcel(monto);
    const row: RubroSaftPegado = {
      fila: index + 1,
      codigoSaft: rubro.codigoSaft ?? codigo.trim(),
      descripcionSaft: rubro.descripcionSaft ?? nombre.trim(),
      monto: cantidad,
      error: cells.length !== 3 ? "Copia exactamente tres columnas: Código, Nombre y Monto."
        : rubro.error ?? (cantidad === null ? "Monto inválido: usa un valor no negativo con hasta dos decimales." : ""),
    };
    const anterior = codigos.get(row.codigoSaft);
    if (anterior) {
      row.error ||= `Código repetido en la fila ${anterior.fila}.`;
      anterior.error ||= `Código repetido en la fila ${row.fila}.`;
    } else codigos.set(row.codigoSaft, row);
    result.push(row);
  }
  if (entreComillas && result.length) result[result.length - 1].error = "Hay una celda con comillas sin cerrar. Copia nuevamente las filas de Excel.";
  return result;
}
