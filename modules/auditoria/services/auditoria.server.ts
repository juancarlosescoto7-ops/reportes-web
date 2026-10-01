import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { puedeAccederAuditoria } from "@/modules/auditoria/domain/acceso-auditoria";
import { type RecomendacionAuditoria } from "@/modules/auditoria/domain/recomendaciones-auditoria";
import {
  normalizarReporteAuditoria,
  type EgresoAuditoria,
  type FilaReporteAuditoriaDB,
} from "@/modules/auditoria/domain/auditoria-egresos";

type PermisoUsuarioDB = {
  rol_codigo?: string | null;
};

export type ResultadoAuditoriaServidor = {
  autorizado: boolean;
  egresos: EgresoAuditoria[];
  recomendaciones: RecomendacionAuditoria[];
};

export async function obtenerAccesoAuditoriaServidor() {
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
        // El proxy actualiza la sesión antes de renderizar esta ruta.
      },
    },
  });

  const { data: permisos, error: errorPermisos } = await supabase.rpc(
    "obtener_mis_permisos"
  );

  if (errorPermisos) {
    throw new Error(
      `No se pudo validar el acceso al módulo de auditoría: ${errorPermisos.message}`
    );
  }

  const filasPermisos = Array.isArray(permisos)
    ? (permisos as PermisoUsuarioDB[])
    : [];
  const autorizado = filasPermisos.some((fila) =>
    puedeAccederAuditoria(fila.rol_codigo)
  );

  return { supabase, autorizado };
}

export async function obtenerReporteAuditoriaServidor(): Promise<ResultadoAuditoriaServidor> {
  const { supabase, autorizado } = await obtenerAccesoAuditoriaServidor();

  if (!autorizado) {
    return { autorizado: false, egresos: [], recomendaciones: [] };
  }

  const [{ data, error }, recomendaciones] = await Promise.all([
    supabase.rpc("reporte_egresos_auditoria"),
    supabase.rpc("auditoria_obtener_recomendaciones"),
  ]);

  if (error) {
    throw new Error(`No se pudo cargar el reporte de auditoría: ${error.message}`);
  }

  if (recomendaciones.error) {
    throw new Error(`No se pudieron cargar las recomendaciones: ${recomendaciones.error.message}`);
  }

  return {
    autorizado: true,
    recomendaciones: (recomendaciones.data ?? []) as RecomendacionAuditoria[],
    egresos: normalizarReporteAuditoria(
      Array.isArray(data) ? (data as FilaReporteAuditoriaDB[]) : []
    ),
  };
}
