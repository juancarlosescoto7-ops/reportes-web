import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { puedeAccederReporteOficinaMujer } from "@/lib/acceso-oficina-mujer";
import {
  normalizarReporteOficinaMujer,
  type FilaPresupuestoOficinaMujerDB,
  type FilaResumenGrupoOficinaMujerDB,
  type ReporteOficinaMujer,
} from "@/lib/reporte-oficina-mujer";

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

  const [presupuestoResult, gruposResult] = await Promise.all([
    supabase.rpc("rpc_presupuesto_base", {
      p_busqueda: null,
      p_fecha_desde: null,
      p_fecha_hasta: null,
    }),
    supabase.rpc("rpc_resumen_por_grupo"),
  ]);

  if (presupuestoResult.error) {
    throw new Error(
      `No se pudo cargar el presupuesto de Oficina de la Mujer: ${presupuestoResult.error.message}`
    );
  }

  if (gruposResult.error) {
    throw new Error(
      `No se pudo cargar el ejecutable general del grupo: ${gruposResult.error.message}`
    );
  }

  const filasPresupuesto = Array.isArray(presupuestoResult.data)
    ? (presupuestoResult.data as FilaPresupuestoOficinaMujerDB[])
    : [];
  const filasGrupos = Array.isArray(gruposResult.data)
    ? (gruposResult.data as FilaResumenGrupoOficinaMujerDB[])
    : [];
  const reporte = normalizarReporteOficinaMujer(
    filasPresupuesto,
    filasGrupos
  );

  console.info(
    "[reporte-oficina-mujer] datos normalizados",
    JSON.stringify({
      filasPresupuesto: filasPresupuesto.length,
      filasGrupos: filasGrupos.length,
      grupo: reporte.grupo,
      nivelEje: reporte.nivelEje,
      ejes: reporte.ejes.length,
    })
  );

  return { autorizado: true, reporte };
}
