import { ejecutarRPC, subirArchivoStorage } from "@/lib/supabase";

export type OrdenPagoSinArchivo = {
  noOrden: number;
  fecha: string | null;
  descripcion: string;
};

type OrdenPagoSinArchivoDB = {
  no_orden: number;
  fecha: string | null;
  descripcion: string | null;
};

function normalizarOrden(item: OrdenPagoSinArchivoDB): OrdenPagoSinArchivo {
  return {
    noOrden: Number(item.no_orden),
    fecha: item.fecha ?? null,
    descripcion: item.descripcion ?? "",
  };
}

export async function obtenerOrdenesPagoSinArchivo(): Promise<
  OrdenPagoSinArchivo[]
> {
  const data = await ejecutarRPC("obtener_ordenes_sin_archivo", {});

  if (!Array.isArray(data)) {
    return [];
  }

  return data
    .map(normalizarOrden)
    .filter((orden) => Number.isFinite(orden.noOrden) && orden.noOrden > 0);
}

export async function subirArchivoOrdenPago(params: {
  archivo: File;
  noOrden: number;
}) {
  const { archivo, noOrden } = params;

  if (!archivo) {
    throw new Error("Debe seleccionar un archivo.");
  }

  if (archivo.type !== "application/pdf") {
    throw new Error("Solo se permiten archivos PDF.");
  }

  const nombreArchivo = `Orden_pago_${noOrden}.pdf`;
  const rutaStorage = `ordenes_pago/${nombreArchivo}`;

  await subirArchivoStorage(
    "ordenes_pago",
    nombreArchivo,
    archivo,
    "application/pdf"
  );

  await ejecutarRPC("insertar_archivo_orden_pago", {
    p_orden_pago: noOrden,
    p_nombre_archivo: nombreArchivo,
    p_ruta_storage: rutaStorage,
  });

  return {
    ok: true,
    nombreArchivo,
    rutaStorage,
  };
}
