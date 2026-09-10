// Cuenta de Presupuesto verificada en usuarios_sistema. Conserva su rol ADMIN
// para los demás módulos; esta excepción no autoriza a otros administradores.
export const USUARIO_PRESUPUESTO_ID = "7f159497-8e76-4312-b29c-5df422e5ca1a";

/** @param {unknown} rol @param {unknown} [usuarioId] */
export function puedeEditarDatos(rol, usuarioId) {
  const codigo = typeof rol === "string" ? rol.trim().toUpperCase() : "";
  return codigo === "PRESUPUESTO" ||
    (codigo === "ADMIN" && usuarioId === USUARIO_PRESUPUESTO_ID);
}
