export type FilaReporteAuditoriaDB = {
  no_orden: string | number | null;
  fecha: string | null;
  descripcion: string | null;
  proveedor: string | null;
  cheque: string | null;
  monto_egreso: string | number | null;
  nombre_archivo: string | null;
  ruta_storage: string | null;
};

export type EgresoAuditoria = {
  noOrden: number;
  fecha: string | null;
  descripcion: string;
  proveedor: string;
  cheque: string;
  montoEgreso: number;
  nombreDocumento: string | null;
  rutaDocumento: string | null;
};

export type OrdenAuditoria = {
  noOrden: number;
  fecha: string | null;
  descripcion: string;
  montoEgreso: number;
  nombreDocumento: string | null;
  rutaDocumento: string | null;
  detalles: EgresoAuditoria[];
};

export type GrupoMensualAuditoria = {
  id: string;
  titulo: string;
  total: number;
  cantidadOrdenes: number;
  items: EgresoAuditoria[];
};

export function normalizarReporteAuditoria(
  filas: FilaReporteAuditoriaDB[]
): EgresoAuditoria[] {
  return filas
    .map((fila) => {
      const noOrden = Number(fila.no_orden);
      const montoEgreso = Number(fila.monto_egreso);

      if (!Number.isInteger(noOrden) || noOrden <= 0) return null;

      return {
        noOrden,
        fecha: textoLimpio(fila.fecha) || null,
        descripcion: textoLimpio(fila.descripcion) || "Sin descripción",
        proveedor: textoLimpio(fila.proveedor) || "Sin proveedor identificado",
        cheque: textoLimpio(fila.cheque) || "Sin cheque",
        montoEgreso: Number.isFinite(montoEgreso) ? montoEgreso : 0,
        nombreDocumento: textoLimpio(fila.nombre_archivo) || null,
        rutaDocumento: textoLimpio(fila.ruta_storage) || null,
      } satisfies EgresoAuditoria;
    })
    .filter((fila): fila is EgresoAuditoria => fila !== null)
    .sort(compararEgresosDescendente);
}

export function agruparEgresosAuditoriaPorMes(
  egresos: EgresoAuditoria[]
): GrupoMensualAuditoria[] {
  const grupos = new Map<string, GrupoMensualAuditoria>();

  egresos.forEach((egreso) => {
    const id = obtenerClaveMes(egreso.fecha);
    const grupo = grupos.get(id) ?? {
      id,
      titulo: obtenerTituloMes(id),
      total: 0,
      cantidadOrdenes: 0,
      items: [],
    };

    grupo.total += egreso.montoEgreso;
    grupo.items.push(egreso);
    grupos.set(id, grupo);
  });

  return Array.from(grupos.values())
    .map((grupo) => ({
      ...grupo,
      cantidadOrdenes: new Set(grupo.items.map((item) => item.noOrden)).size,
      items: [...grupo.items].sort(compararEgresosDescendente),
    }))
    .sort((a, b) => {
      if (a.id === "sin-fecha") return 1;
      if (b.id === "sin-fecha") return -1;
      return b.id.localeCompare(a.id);
    });
}

export function agruparEgresosAuditoriaPorOrden(
  egresos: EgresoAuditoria[]
): OrdenAuditoria[] {
  const ordenes = new Map<number, OrdenAuditoria>();

  egresos.forEach((egreso) => {
    const orden = ordenes.get(egreso.noOrden) ?? {
      noOrden: egreso.noOrden,
      fecha: egreso.fecha,
      descripcion: egreso.descripcion,
      montoEgreso: 0,
      nombreDocumento: egreso.nombreDocumento,
      rutaDocumento: egreso.rutaDocumento,
      detalles: [],
    };

    orden.montoEgreso += egreso.montoEgreso;
    orden.detalles.push(egreso);

    if (!orden.nombreDocumento && egreso.nombreDocumento) {
      orden.nombreDocumento = egreso.nombreDocumento;
    }

    if (!orden.rutaDocumento && egreso.rutaDocumento) {
      orden.rutaDocumento = egreso.rutaDocumento;
    }

    ordenes.set(egreso.noOrden, orden);
  });

  return Array.from(ordenes.values()).sort((a, b) => {
    const diferenciaFecha = textoLimpio(b.fecha).localeCompare(
      textoLimpio(a.fecha)
    );

    return diferenciaFecha || b.noOrden - a.noOrden;
  });
}

export function obtenerClaveMes(fecha: string | null | undefined) {
  const match = textoLimpio(fecha).match(/^(\d{4})-(\d{1,2})/);

  if (!match) return "sin-fecha";

  const year = Number(match[1]);
  const month = Number(match[2]);

  if (!Number.isInteger(year) || month < 1 || month > 12) {
    return "sin-fecha";
  }

  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

export function construirUrlDocumentoAuditoria(
  supabaseUrl: string,
  rutaDocumento: string | null
) {
  const ruta = textoLimpio(rutaDocumento);

  if (!ruta) return null;
  if (/^https?:\/\//i.test(ruta)) return ruta;

  const base = supabaseUrl.replace(/\/+$/, "");
  const rutaNormalizada = ruta.replace(/^\/+/, "");

  if (rutaNormalizada.startsWith("ordenes_pago/")) {
    return `${base}/storage/v1/object/public/${rutaNormalizada}`;
  }

  return `${base}/storage/v1/object/public/ordenes_pago/${rutaNormalizada}`;
}

function textoLimpio(value: unknown) {
  return String(value ?? "").trim();
}

function obtenerTituloMes(id: string) {
  if (id === "sin-fecha") return "Sin fecha registrada";

  const [year, month] = id.split("-").map(Number);
  const titulo = new Intl.DateTimeFormat("es-HN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, 1)));

  return titulo.charAt(0).toUpperCase() + titulo.slice(1);
}

function compararEgresosDescendente(a: EgresoAuditoria, b: EgresoAuditoria) {
  const fechaA = textoLimpio(a.fecha);
  const fechaB = textoLimpio(b.fecha);
  const diferenciaFecha = fechaB.localeCompare(fechaA);

  return diferenciaFecha || b.noOrden - a.noOrden;
}
