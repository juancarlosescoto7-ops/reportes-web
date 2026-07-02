import { ejecutarRPC } from "@/lib/supabase";

export type InsertarEjecucionPresupuestariaPayload = {
  orden_pago_id: number;
  codigo_presupuestario: string;
  actividad_id: string | null;
  proyecto_id: string | null;
  monto_ejecutado: number;
  fecha_ejecucion?: string | null;
  ejercicio_fiscal?: number | null;
  usuario_registro?: string | null;
};

export type AsignacionEjecucionPresupuestaria = {
  id?: string;
  orden_pago_id?: number;
  codigo_presupuestario: string;
  actividad_id: string | null;
  proyecto_id: string | null;
  monto_ejecutado: number;
  fecha_ejecucion?: string | null;
  ejercicio_fiscal?: number | null;
  usuario_registro?: string | null;
};

export async function insertarEjecucionPresupuestaria(
  payload: InsertarEjecucionPresupuestariaPayload
) {
  const data = await ejecutarRPC("rpc_insertar_ejecucion_presupuestaria", {
    p_orden_pago_id: payload.orden_pago_id,
    p_codigo_presupuestario: payload.codigo_presupuestario,
    p_actividad_id: payload.actividad_id,
    p_proyecto_id: payload.proyecto_id,
    p_monto_ejecutado: payload.monto_ejecutado,
    p_fecha_ejecucion: payload.fecha_ejecucion ?? null,
    p_ejercicio_fiscal: payload.ejercicio_fiscal ?? null,
    p_usuario_registro: payload.usuario_registro ?? null,
  });

  return data;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String(data.error)
        : "No se pudo completar la operacion.";

    throw new Error(message);
  }

  return data as T;
}

export async function obtenerAsignacionesEjecucionOrden(
  ordenPagoId: number
) {
  const params = new URLSearchParams({
    ordenPagoId: String(ordenPagoId),
  });

  const response = await fetch(
    `/api/ejecuciones-presupuestarias/asignaciones?${params.toString()}`
  );

  return parseResponse<AsignacionEjecucionPresupuestaria[]>(response);
}

export async function actualizarAsignacionEjecucionOrden(input: {
  id: string;
  orden_pago_id: number;
  asignacion: AsignacionEjecucionPresupuestaria;
}) {
  const response = await fetch("/api/ejecuciones-presupuestarias/asignaciones", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return parseResponse<{
    id: string;
    orden_pago_id: number;
    data: unknown;
  }>(response);
}
