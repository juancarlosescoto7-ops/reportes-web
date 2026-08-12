"use client";

import {
  combinarContextosConPresupuesto,
  type ContextoCodigoPresupuesto,
} from "@/lib/contextos-presupuesto";

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
  const [response, contextos] = await Promise.all([
    fetch("/api/supabase/rpc/rpc_presupuesto_base", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_busqueda: normalizarTexto(filtros.busqueda),
        p_fecha_desde: normalizarTexto(filtros.fechaDesde),
        p_fecha_hasta: normalizarTexto(filtros.fechaHasta),
      }),
    }),
    obtenerContextosCodigosPresupuesto().catch(() => []),
  ]);

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

  const presupuesto = Array.isArray(data)
    ? (data as Record<string, unknown>[])
    : [];

  return combinarContextosConPresupuesto(presupuesto, contextos);
}

export async function obtenerContextosCodigosPresupuesto() {
  const response = await fetch("/api/presupuesto/contexto-codigo", {
    cache: "no-store",
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error("No se pudieron cargar los contextos presupuestarios.");
  }

  return Array.isArray(data) ? (data as ContextoCodigoPresupuesto[]) : [];
}

export async function actualizarContextoCodigoPresupuesto(input: {
  codigo: string;
  contexto: string;
}) {
  const response = await fetch("/api/presupuesto/contexto-codigo", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String(data.error)
        : "No se pudo guardar el contexto presupuestario.";

    throw new Error(message);
  }

  return data as ContextoCodigoPresupuesto;
}
