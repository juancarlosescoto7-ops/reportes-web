import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { combinarContextosConPresupuesto } from "@/lib/contextos-presupuesto";
import type { FiltrosPresupuesto } from "./presupuesto";

function normalizarTexto(value?: string | null) {
  const cleanValue = String(value ?? "").trim();

  return cleanValue || null;
}

export async function obtenerPresupuestoServidor(
  filtros: FiltrosPresupuesto = {}
): Promise<Record<string, unknown>[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Faltan variables de entorno de Supabase.");
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // Los Server Components solo pueden leer cookies. El proxy se encarga
        // de refrescar la sesion y persistir las cookies antes del renderizado.
      },
    },
  });

  const [presupuestoResult, contextosResult] = await Promise.all([
    supabase.rpc("rpc_presupuesto_base", {
      p_busqueda: normalizarTexto(filtros.busqueda),
      p_fecha_desde: normalizarTexto(filtros.fechaDesde),
      p_fecha_hasta: normalizarTexto(filtros.fechaHasta),
    }),
    supabase.from("codigos_presupuesto").select("codigo,contexto_cxp"),
  ]);
  const { data, error } = presupuestoResult;

  if (error) {
    throw new Error(`No se pudo cargar el presupuesto: ${error.message}`);
  }

  const presupuesto = Array.isArray(data)
    ? (data as Record<string, unknown>[])
    : [];
  const contextos = contextosResult.error
    ? []
    : (contextosResult.data ?? []);

  return combinarContextosConPresupuesto(presupuesto, contextos);
}
