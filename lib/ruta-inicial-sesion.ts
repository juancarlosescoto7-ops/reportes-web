const RUTA_AUDITORIA = "/auditoria";
const RUTA_REPORTE_OFICINA_MUJER = "/reportes/oficina-mujer";

const RUTAS_PRIORIDAD_GENERALES = [
  "/arqueos",
  "/conversor-sami-saft",
  "/",
  RUTA_REPORTE_OFICINA_MUJER,
  "/controles/proyectos",
  "/reportes/ordenes-de-pago",
  "/reportes/presupuesto",
  "/reportes/compromisos-presupuestarios",
  RUTA_AUDITORIA,
];

export function obtenerRutaInicialSesion({
  rolCodigo,
  rutasConfiguradas,
  rutasAdicionales = [],
}: {
  rolCodigo: string | null | undefined;
  rutasConfiguradas: Array<string | null | undefined>;
  rutasAdicionales?: string[];
}) {
  const esRolAuditoria = normalizarRol(rolCodigo) === "AUDITORIA";
  const rutasPermitidas = Array.from(
    new Set(
      [...rutasAdicionales, ...rutasConfiguradas]
        .map(normalizarRutaSistema)
        .filter((ruta): ruta is string => Boolean(ruta))
    )
  );

  if (esRolAuditoria && !rutasPermitidas.includes(RUTA_AUDITORIA)) {
    rutasPermitidas.unshift(RUTA_AUDITORIA);
  }

  const rutasPrioridad = esRolAuditoria
    ? [RUTA_AUDITORIA]
    : RUTAS_PRIORIDAD_GENERALES;

  return (
    rutasPrioridad.find((ruta) => rutasPermitidas.includes(ruta)) ??
    rutasPermitidas[0] ??
    "/sin-acceso"
  );
}

export function normalizarRutaSistema(
  ruta: string | null | undefined
): string | null {
  const rutaLimpia = String(ruta ?? "").trim();

  if (!rutaLimpia) return null;

  const rutaAbsoluta = rutaLimpia.startsWith("/")
    ? rutaLimpia
    : `/${rutaLimpia}`;
  const rutaSinBarraFinal =
    rutaAbsoluta.length > 1 ? rutaAbsoluta.replace(/\/+$/, "") : rutaAbsoluta;

  if (rutaSinBarraFinal.toLowerCase() === "/reportes/auditoria") {
    return RUTA_AUDITORIA;
  }

  return rutaSinBarraFinal;
}

function normalizarRol(rolCodigo: string | null | undefined) {
  return String(rolCodigo ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}
