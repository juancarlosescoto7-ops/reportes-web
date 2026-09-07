export const RUTA_REPORTE_OFICINA_MUJER = "/reportes/oficina-mujer";

export const ROLES_CON_ACCESO_OFICINA_MUJER = [
  "OFICINA_MUJER",
  "PRESUPUESTO",
  "ADMINISTRADOR",
  "ADMIN",
] as const;

export const USUARIOS_CON_ACCESO_OFICINA_MUJER = ["OFICINA_MUJER"] as const;

export function puedeAccederReporteOficinaMujer({
  rolCodigo,
  nombreUsuario,
}: {
  rolCodigo: string | null | undefined;
  nombreUsuario?: string | null | undefined;
}) {
  const rol = normalizarIdentificador(rolCodigo);
  const usuario = normalizarIdentificador(nombreUsuario);

  return (
    ROLES_CON_ACCESO_OFICINA_MUJER.some(
      (rolPermitido) => rolPermitido === rol
    ) ||
    USUARIOS_CON_ACCESO_OFICINA_MUJER.some(
      (usuarioPermitido) => usuarioPermitido === usuario
    )
  );
}

function normalizarIdentificador(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}
