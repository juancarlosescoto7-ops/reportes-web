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