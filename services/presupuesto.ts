import { ejecutarRPC } from "@/lib/supabase";

export type FiltrosPresupuesto = {
  busqueda?: string | null;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
};

function normalizarTexto(value?: string | null) {
  const cleanValue = String(value ?? "").trim();

  return cleanValue || null;
}

export async function obtenerPresupuesto(filtros: FiltrosPresupuesto = {}) {
  const data = await ejecutarRPC("rpc_presupuesto_base", {
    p_busqueda: normalizarTexto(filtros.busqueda),
    p_fecha_desde: normalizarTexto(filtros.fechaDesde),
    p_fecha_hasta: normalizarTexto(filtros.fechaHasta),
  });

  return data;
}
