import {
  normalizarOrdenesPagoConDocumento,
  type FilaOrdenPagoEstadoDocumento,
  type OrdenPagoConDocumento,
} from "@/lib/ordenes-pago-documentos";
import { crearClienteSupabase } from "@/lib/supabase";

export type { OrdenPagoConDocumento };

export const MENSAJE_ORDEN_CON_DOCUMENTO =
  "Esta orden de pago ya tiene un documento cargado. No se permite reemplazarlo.";

export class OrdenPagoConDocumentoError extends Error {
  constructor() {
    super(MENSAJE_ORDEN_CON_DOCUMENTO);
    this.name = "OrdenPagoConDocumentoError";
  }
}

async function ejecutarRPCOrdenPago<T>(nombreRPC: string, payload = {}) {
  const response = await fetch(
    `/api/supabase/rpc/${encodeURIComponent(nombreRPC)}`,
    {
      method: "POST",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const detalle =
      data && typeof data === "object" && "message" in data
        ? String(data.message)
        : data && typeof data === "object" && "error" in data
          ? String(data.error)
        : `Error ${response.status}`;

    throw new Error(`No se pudo ejecutar ${nombreRPC}: ${detalle}`);
  }

  return data as T;
}

export async function obtenerOrdenesPagoConEstadoDocumento(): Promise<
  OrdenPagoConDocumento[]
> {
  const data = await ejecutarRPCOrdenPago<FilaOrdenPagoEstadoDocumento[]>(
    "obtener_ordenes_sin_archivo"
  );

  return normalizarOrdenesPagoConDocumento(
    Array.isArray(data) ? data : []
  );
}

async function validarOrdenSinDocumento(noOrden: number) {
  const ordenes = await obtenerOrdenesPagoConEstadoDocumento();
  const orden = ordenes.find((item) => item.noOrden === noOrden);

  if (orden?.tieneDocumento) {
    throw new OrdenPagoConDocumentoError();
  }
}

function esConflictoDeArchivo(error: unknown) {
  if (!(error instanceof Error)) return false;

  return /(?:\b409\b|already exists|duplicate|duplicado|ya existe)/i.test(
    error.message
  );
}

async function crearArchivoOrdenPagoStorage(
  nombreArchivo: string,
  archivo: File
) {
  const supabase = crearClienteSupabase();
  const { error } = await supabase.storage
    .from("ordenes_pago")
    .upload(nombreArchivo, archivo, {
      contentType: "application/pdf",
      upsert: false,
    });

  if (error) {
    throw new Error(`Error subiendo archivo: ${error.message}`);
  }
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

  if (!Number.isInteger(noOrden) || noOrden <= 0) {
    throw new Error("La orden de pago no es válida.");
  }

  await validarOrdenSinDocumento(noOrden);

  const nombreArchivo = `Orden_pago_${noOrden}.pdf`;
  const rutaStorage = `ordenes_pago/${nombreArchivo}`;

  try {
    await crearArchivoOrdenPagoStorage(nombreArchivo, archivo);
  } catch (error) {
    if (esConflictoDeArchivo(error)) {
      throw new OrdenPagoConDocumentoError();
    }

    throw error;
  }

  try {
    await ejecutarRPCOrdenPago("insertar_archivo_orden_pago", {
      p_orden_pago: noOrden,
      p_nombre_archivo: nombreArchivo,
      p_ruta_storage: rutaStorage,
    });
  } catch (error) {
    if (esConflictoDeArchivo(error)) {
      throw new OrdenPagoConDocumentoError();
    }

    throw error;
  }

  return {
    ok: true,
    nombreArchivo,
    rutaStorage,
  };
}
