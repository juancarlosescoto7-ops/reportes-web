export const PERMISO_ARQUEOS = "VER_ARQUEOS" as const;
export const ROLES_CON_ACCESO_ARQUEOS = [
  "TESORERIA",
  "PRESUPUESTO",
  "ADMIN",
] as const;

export function puedeGestionarArqueos(
  permisos: readonly string[] | null | undefined,
  rolCodigo: string | null | undefined
): boolean {
  return Boolean(
    permisos?.includes(PERMISO_ARQUEOS) ||
      ROLES_CON_ACCESO_ARQUEOS.some((rol) => rol === rolCodigo)
  );
}
