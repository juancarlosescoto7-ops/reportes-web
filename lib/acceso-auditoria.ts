export const ROLES_CON_ACCESO_AUDITORIA = [
  "AUDITORIA",
  "ADMIN",
  "PRESUPUESTO",
] as const;

export function puedeAccederAuditoria(
  rolCodigo: string | null | undefined
): boolean {
  const rolNormalizado = normalizarCodigoRol(rolCodigo);

  return ROLES_CON_ACCESO_AUDITORIA.some(
    (rolPermitido) => rolPermitido === rolNormalizado
  );
}

function normalizarCodigoRol(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}
