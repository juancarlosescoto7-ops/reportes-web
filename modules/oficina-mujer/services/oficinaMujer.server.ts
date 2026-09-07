import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { puedeAccederReporteOficinaMujer } from "@/modules/oficina-mujer/domain/acceso-oficina-mujer";
import type { ReporteOficinaMujer } from "@/modules/oficina-mujer/domain/reporte-oficina-mujer";

type PermisoUsuarioDB = {
  nombre_usuario?: string | null;
  rol_codigo?: string | null;
};

export type ResultadoOficinaMujerServidor = {
  autorizado: boolean;
  reporte: ReporteOficinaMujer | null;
};

export async function obtenerReporteOficinaMujerServidor(): Promise<
  ResultadoOficinaMujerServidor
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
        // El proxy refresca y persiste la sesion antes de renderizar la ruta.
      },
    },
  });

  const { data: permisos, error: errorPermisos } = await supabase.rpc(
    "obtener_mis_permisos"
  );

  if (errorPermisos) {
    throw new Error(
      `No se pudo validar el acceso al reporte de Oficina de la Mujer: ${errorPermisos.message}`
    );
  }

  const filasPermisos = Array.isArray(permisos)
    ? (permisos as PermisoUsuarioDB[])
    : [];
  const autorizado = filasPermisos.some((fila) =>
    puedeAccederReporteOficinaMujer({
      rolCodigo: fila.rol_codigo,
      nombreUsuario: fila.nombre_usuario,
    })
  );

  if (!autorizado) {
    return { autorizado: false, reporte: null };
  }

  const { data, error } = await supabase.rpc("rpc_reporte_oficina_mujer");

  if (error) {
    throw new Error(
      `No se pudo cargar el reporte de Oficina de la Mujer: ${error.message}`
    );
  }

  if (!esReporteOficinaMujer(data)) {
    throw new Error(
      "La RPC de Oficina de la Mujer devolvio una respuesta invalida."
    );
  }

  return { autorizado: true, reporte: data };
}

function esReporteOficinaMujer(value: unknown): value is ReporteOficinaMujer {
  if (!value || typeof value !== "object") return false;

  const reporte = value as Partial<ReporteOficinaMujer> & { error?: unknown };

  return (
    !reporte.error &&
    typeof reporte.grupo === "string" &&
    typeof reporte.nivelEje === "string" &&
    typeof reporte.montoVigenteGrupo === "number" &&
    typeof reporte.ejecutableGeneralGrupo === "number" &&
    typeof reporte.montoEjecutadoGrupo === "number" &&
    typeof reporte.montoComprometidoGrupo === "number" &&
    typeof reporte.saldoEjecutableGrupo === "number" &&
    Array.isArray(reporte.ejes)
  );
}
