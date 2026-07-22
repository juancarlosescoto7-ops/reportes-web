export type FilaOrdenPagoEstadoDocumento = {
  no_orden: string | number | null;
  fecha: string | null;
  descripcion: string | null;
  tiene_archivo: boolean | null;
  nombre_archivo: string | null;
  ruta_storage: string | null;
};

export type OrdenPagoConDocumento = {
  noOrden: number;
  fecha: string | null;
  descripcion: string;
  rutaDocumento: string | null;
  tieneDocumento: boolean;
};

function normalizarNumeroOrden(value: unknown) {
  const noOrden = Number(value);

  return Number.isInteger(noOrden) && noOrden > 0 ? noOrden : null;
}

function normalizarTexto(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizarOrdenesPagoConDocumento(
  filas: FilaOrdenPagoEstadoDocumento[]
): OrdenPagoConDocumento[] {
  const ordenes = new Map<number, OrdenPagoConDocumento>();

  filas.forEach((fila) => {
    const noOrden = normalizarNumeroOrden(fila.no_orden);

    if (!noOrden) return;

    const actual = ordenes.get(noOrden);
    const fecha = normalizarTexto(fila.fecha) || null;
    const descripcion = normalizarTexto(fila.descripcion);
    const rutaDocumento = normalizarTexto(fila.ruta_storage) || null;
    const tieneDocumento = fila.tiene_archivo === true;

    if (!actual) {
      ordenes.set(noOrden, {
        noOrden,
        fecha,
        descripcion,
        rutaDocumento,
        tieneDocumento,
      });
      return;
    }

    if (!actual.fecha && fecha) actual.fecha = fecha;
    if (!actual.descripcion && descripcion) actual.descripcion = descripcion;

    if (!actual.tieneDocumento && tieneDocumento) {
      actual.tieneDocumento = true;
      actual.rutaDocumento = rutaDocumento;
    } else if (!actual.rutaDocumento && rutaDocumento) {
      actual.rutaDocumento = rutaDocumento;
    }
  });

  return Array.from(ordenes.values()).sort((a, b) => b.noOrden - a.noOrden);
}
