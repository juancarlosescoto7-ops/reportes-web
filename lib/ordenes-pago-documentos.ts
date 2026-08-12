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
  nombreDocumento: string | null;
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
    const nombreDocumento = normalizarTexto(fila.nombre_archivo) || null;
    const rutaDocumento = normalizarTexto(fila.ruta_storage) || null;
    const tieneDocumento = fila.tiene_archivo === true;

    if (!actual) {
      ordenes.set(noOrden, {
        noOrden,
        fecha,
        descripcion,
        nombreDocumento,
        rutaDocumento,
        tieneDocumento,
      });
      return;
    }

    if (!actual.fecha && fecha) actual.fecha = fecha;
    if (!actual.descripcion && descripcion) actual.descripcion = descripcion;

    if (tieneDocumento) {
      actual.tieneDocumento = true;
    }

    if (!actual.nombreDocumento && nombreDocumento) {
      actual.nombreDocumento = nombreDocumento;
    }

    if (!actual.rutaDocumento && rutaDocumento) {
      actual.rutaDocumento = rutaDocumento;
    }
  });

  return Array.from(ordenes.values()).sort((a, b) => b.noOrden - a.noOrden);
}

export function obtenerRutaObjetoOrdenPago(params: {
  rutaStorage: string | null;
  nombreArchivo: string | null;
}) {
  const candidatos = [params.rutaStorage, params.nombreArchivo];

  for (const candidato of candidatos) {
    const ruta = normalizarRutaObjeto(candidato);

    if (ruta) return ruta;
  }

  return null;
}

function normalizarRutaObjeto(value: string | null) {
  const texto = normalizarTexto(value);

  if (!texto) return null;

  let ruta = texto;

  if (/^https?:\/\//i.test(ruta)) {
    try {
      ruta = new URL(ruta).pathname;
    } catch {
      return null;
    }
  } else {
    ruta = ruta.split(/[?#]/, 1)[0];
  }

  const marcadores = [
    "/storage/v1/object/public/ordenes_pago/",
    "/storage/v1/object/sign/ordenes_pago/",
    "/storage/v1/object/ordenes_pago/",
    "ordenes_pago/",
  ];
  const marcador = marcadores.find((item) => ruta.includes(item));

  if (marcador) {
    ruta = ruta.slice(ruta.indexOf(marcador) + marcador.length);
  }

  ruta = ruta.replace(/^\/+/, "");

  try {
    ruta = decodeURIComponent(ruta);
  } catch {
    return null;
  }

  if (
    !ruta ||
    ruta.endsWith("/") ||
    ruta.split("/").some((segmento) => segmento === "..")
  ) {
    return null;
  }

  return ruta;
}
