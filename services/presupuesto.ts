"use client";

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
  const response = await fetch("/api/supabase/rpc/rpc_presupuesto_base", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_busqueda: normalizarTexto(filtros.busqueda),
      p_fecha_desde: normalizarTexto(filtros.fechaDesde),
      p_fecha_hasta: normalizarTexto(filtros.fechaHasta),
    }),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const detalle =
      data && typeof data === "object" && "message" in data
        ? String(data.message)
        : data && typeof data === "object" && "error" in data
          ? String(data.error)
          : `Error HTTP ${response.status}`;

    throw new Error(`No se pudo cargar el presupuesto: ${detalle}`);
  }

  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}
