import { crearClienteSupabase } from "@/lib/supabase";

export type Permiso = string;

export type PermisoSistema = {
  usuario_id: string;
  nombre_usuario: string;
  cargo: string | null;
  rol_codigo: string;
  rol_nombre: string;
  permiso_codigo: string;
  permiso_nombre: string;
  modulo: string | null;
  ruta: string | null;
};

export type SesionPermisos = {
  usuarioId: string;
  nombreUsuario: string;
  cargo: string | null;
  rolCodigo: string;
  rolNombre: string;
  permisos: string[];
  permisosDetalle: PermisoSistema[];
};

export async function obtenerMisPermisos(): Promise<SesionPermisos | null> {
  const supabase = crearClienteSupabase();

  const { data, error } = await supabase.rpc("obtener_mis_permisos");

  if (error) {
    console.error("Error obteniendo permisos:", error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  const filas = data as PermisoSistema[];
  const primeraFila = filas[0];

  return {
    usuarioId: primeraFila.usuario_id,
    nombreUsuario: primeraFila.nombre_usuario,
    cargo: primeraFila.cargo,
    rolCodigo: primeraFila.rol_codigo,
    rolNombre: primeraFila.rol_nombre,
    permisos: filas.map((item) => item.permiso_codigo),
    permisosDetalle: filas,
  };
}

export function tienePermisoDinamico(
  sesionPermisos: SesionPermisos | null,
  permiso: Permiso
): boolean {
  if (!sesionPermisos) return false;

  return sesionPermisos.permisos.includes(permiso);
}

/**
 * Alias compatible para componentes como ConPermiso.tsx.
 * Mantiene la arquitectura dinámica basada en Supabase.
 */
export function tienePermiso(
  sesionPermisos: SesionPermisos | string[] | null | undefined,
  permiso: Permiso
): boolean {
  if (!sesionPermisos) return false;

  if (Array.isArray(sesionPermisos)) {
    return sesionPermisos.includes(permiso);
  }

  return sesionPermisos.permisos.includes(permiso);
}