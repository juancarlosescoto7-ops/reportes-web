import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { puedeAccederAuditoria } from "@/lib/acceso-auditoria";
import {
  normalizarReporteAuditoria,
  type EgresoAuditoria,
  type FilaReporteAuditoriaDB,
} from "@/lib/auditoria-egresos";

type PermisoUsuarioDB = {
  rol_codigo?: string | null;
};

export type ResultadoAuditoriaServidor = {
  autorizado: boolean;
  egresos: EgresoAuditoria[];
};

export async function obtenerReporteAuditoriaServidor(): Promise<
  ResultadoAuditoriaServidor
> {
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

  if (!autorizado) {
    return { autorizado: false, egresos: [] };
  }

  const { data, error } = await supabase.rpc("reporte_egresos_auditoria");

  if (error) {
    throw new Error(`No se pudo cargar el reporte de auditoría: ${error.message}`);
  }

  return {
    autorizado: true,
    egresos: normalizarReporteAuditoria(
      Array.isArray(data) ? (data as FilaReporteAuditoriaDB[]) : []
    ),
  };
}
