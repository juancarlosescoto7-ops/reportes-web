export type CuentaHistoricaCxp = {
  id: string;
  no_cxp: string | null;
  tipo_movimiento: string | null;
  fecha: string | null;
  descripcion: string | null;
  haber: number | string | null;
  debe: number | string | null;
  estado: string | null;
  fecha_pago: string | null;
  fecha_anulacion: string | null;
  proveedor_id: string | null;
  proveedor_nombre: string;
};

export type EventoHistoricoCxp = {
  id: string;
  no_cxp: string | null;
  tipo_movimiento: string | null;
  accion: string;
  metadata: Record<string, unknown> | null;
};

export type DatosHistoricosCxp = {
  cuentas: CuentaHistoricaCxp[];
  historial: EventoHistoricoCxp[];
};

export type RenglonMensualCxp = {
  id: string;
  numero: string;
  tipo: string;
  fecha: string;
  descripcion: string;
  monto: number;
  pagado: number;
  saldo: number;
};

export type ProveedorMensualCxp = {
  id: string;
  nombre: string;
  identificacion: string;
  cuentas: RenglonMensualCxp[];
  total: number;
};

export type ReporteMensualCxp = {
  periodo: string;
  corte: string;
  proveedores: ProveedorMensualCxp[];
  total: number;
  cantidad: number;
};

export function corteMensual(periodo: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo) || Number(periodo.slice(0, 4)) < 1900) {
    throw new Error("Seleccione un mes y año válidos.");
  }
  const [anio, mes] = periodo.split("-").map(Number);
  return new Date(Date.UTC(anio, mes, 0)).toISOString().slice(0, 10);
}

export function nombrePeriodo(periodo: string) {
  corteMensual(periodo);
  return new Intl.DateTimeFormat("es-HN", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${periodo}-01T12:00:00Z`));
}

export function textosCertificacion(periodo: string, anioEmision: string) {
  return {
    apertura: `La suscrita Tesorera de la Municipalidad de Talanga, en el ejercicio de sus facultades, hace del conocimiento las cuentas por pagar correspondientes al mes de ${nombrePeriodo(periodo)}, pendientes de pago al cierre de dicho mes, según los registros municipales y conforme al siguiente detalle:`,
    cierre: `Y para los fines que se estimen convenientes, se extiende la presente en el municipio de Talanga, departamento de Francisco Morazán, en el año ${anioEmision}.`,
    firmante: "María de los Ángeles Arévalo",
    cargo: "Tesorera Municipal",
  };
}

function fechaValida(valor: unknown): valor is string {
  return typeof valor === "string" && /^\d{4}-\d{2}-\d{2}$/.test(valor)
    && Number.isFinite(Date.parse(`${valor}T12:00:00Z`))
    && new Date(`${valor}T12:00:00Z`).toISOString().slice(0, 10) === valor;
}

function centavos(valor: unknown) {
  if (valor !== null && typeof valor !== "number" && typeof valor !== "string") return NaN;
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) && numero >= 0 ? Math.round(numero * 100) : NaN;
}

const clave = (cuenta: { no_cxp: string | null; tipo_movimiento: string | null }) =>
  JSON.stringify([cuenta.no_cxp, cuenta.tipo_movimiento ?? ""]);

function saldoAlCorte(cuenta: CuentaHistoricaCxp, eventos: EventoHistoricoCxp[], corte: string):
  { monto: number; pagado: number; saldo: number } | { motivo: string } | null {
  const monto = centavos(cuenta.haber);
  const debe = centavos(cuenta.debe);
  if (!Number.isFinite(monto) || !Number.isFinite(debe)) return { motivo: "El monto de la cuenta o sus pagos no es válido." };
  if (monto === 0) return null;
  if (fechaValida(cuenta.fecha) && cuenta.fecha > corte) return null;

  const estado = (cuenta.estado ?? "pendiente").toLowerCase().trim();
  if (estado === "anulado" || estado === "anulada") {
    const anulacion = eventos.findLast((evento) => evento.accion === "depuracion_anulada");
    const fecha = anulacion?.metadata?.fecha_depuracion ?? cuenta.fecha_anulacion;
    if (!fechaValida(fecha)) return { motivo: "Falta la fecha efectiva de anulación." };
    if (fecha <= corte) return null;
  }

  // Las cuentas antiguas depuradas como pagadas pueden tener debe = 0.
  // Un estado pagado con 0 < debe < haber conserva saldo, igual que la bandeja de CxP.
  const liquidada = estado === "pagado" && (debe === 0 || debe >= monto);
  if (liquidada && !fechaValida(cuenta.fecha_pago)) return { motivo: "Falta la fecha de liquidación de una cuenta marcada como pagada." };
  if (liquidada && fechaValida(cuenta.fecha) && cuenta.fecha_pago! < cuenta.fecha) return { motivo: "La fecha de pago es anterior a la obligación." };
  if (liquidada && cuenta.fecha_pago! <= corte) return null;
  // Una obligación ya cerrada al corte no necesita fecha de origen para excluirse.
  if (!fechaValida(cuenta.fecha)) return { motivo: "Falta una fecha válida de la obligación para ubicarla en el cierre mensual." };

  const pagos = eventos.filter((evento) => evento.accion === "pago_parcial_con_compromiso");
  let pagado = 0;
  if (pagos.length) {
    let totalHistorial = 0;
    for (const pago of pagos) {
      const fecha = pago.metadata?.fecha_pago;
      const importe = centavos(pago.metadata?.monto_pago);
      if (!fechaValida(fecha) || !Number.isFinite(importe) || importe <= 0 || fecha < cuenta.fecha) {
        return { motivo: "El historial contiene un pago sin fecha o monto válido, o anterior a la obligación." };
      }
      totalHistorial += importe;
      if (fecha <= corte) pagado += importe;
    }
    if (totalHistorial !== debe || totalHistorial > monto) {
      return { motivo: "Los pagos del historial no coinciden con el monto pagado de la cuenta; revise los abonos antes de certificar." };
    }
  } else if (debe > 0 && !liquidada) {
    return { motivo: "Existen abonos sin historial fechado suficiente para reconstruir el saldo mensual." };
  }

  const saldo = monto - pagado;
  return saldo > 0 ? { monto: monto / 100, pagado: pagado / 100, saldo: saldo / 100 } : null;
}

export function construirReporteMensualCxp(datos: DatosHistoricosCxp, periodo: string): ReporteMensualCxp {
  const corte = corteMensual(periodo);
  const historial = new Map<string, EventoHistoricoCxp[]>();
  for (const evento of datos.historial) {
    const key = clave(evento);
    const lista = historial.get(key) ?? [];
    lista.push(evento);
    historial.set(key, lista);
  }
  const grupos = new Map<string, ProveedorMensualCxp>();
  for (const cuenta of datos.cuentas) {
    const resultado = saldoAlCorte(cuenta, historial.get(clave(cuenta)) ?? [], corte);
    if (!resultado || "motivo" in resultado) continue;
    // No combinar proveedores con el mismo nombre ni registros sin identificación.
    const id = cuenta.proveedor_id?.trim() || `sin-proveedor:${cuenta.id}`;
    const grupo = grupos.get(id) ?? {
      id, nombre: cuenta.proveedor_nombre || "Sin proveedor", identificacion: cuenta.proveedor_id ?? "",
      cuentas: [], total: 0,
    };
    grupo.cuentas.push({
      id: cuenta.id, numero: cuenta.no_cxp ?? "—", tipo: cuenta.tipo_movimiento ?? "CxP",
      fecha: cuenta.fecha!, descripcion: cuenta.descripcion ?? "Sin descripción", ...resultado,
    });
    grupo.total = (Math.round(grupo.total * 100) + Math.round(resultado.saldo * 100)) / 100;
    grupos.set(id, grupo);
  }
  const proveedores = [...grupos.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" }) || a.id.localeCompare(b.id));
  for (const grupo of proveedores) grupo.cuentas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.numero.localeCompare(b.numero, "es", { numeric: true }));
  return {
    periodo, corte, proveedores,
    total: proveedores.reduce((suma, grupo) => suma + Math.round(grupo.total * 100), 0) / 100,
    cantidad: proveedores.reduce((suma, grupo) => suma + grupo.cuentas.length, 0),
  };
}

export function periodosCerrados(anio: number, ultimoPeriodo: string) {
  corteMensual(ultimoPeriodo);
  const ultimoAnio = Number(ultimoPeriodo.slice(0, 4));
  if (!Number.isInteger(anio) || anio < 1900 || anio > ultimoAnio) return [];
  const meses = anio === ultimoAnio ? Number(ultimoPeriodo.slice(5)) : 12;
  return Array.from({ length: meses }, (_, indice) => `${anio}-${String(indice + 1).padStart(2, "0")}`);
}

export function prepararDocumentoMensualCxp(reporte: ReporteMensualCxp, anioEmision: string) {
  return {
    periodo: reporte.periodo,
    titulo: "REPORTE MENSUAL DE CUENTAS POR PAGAR",
    subtitulo: `${nombrePeriodo(reporte.periodo)} - Al cierre del ${reporte.corte.split("-").reverse().join("/")}`,
    ...textosCertificacion(reporte.periodo, anioEmision),
    filas: reporte.proveedores.map((grupo, indice) => ({
      numero: indice + 1, acreedor: grupo.nombre, monto: grupo.total,
      descripcion: grupo.cuentas.map((cuenta) => `${cuenta.tipo} #${cuenta.numero}: ${cuenta.descripcion}`).join("\n"),
    })),
    total: reporte.total,
  };
}

export type DocumentoMensualCxp = ReturnType<typeof prepararDocumentoMensualCxp>;

export function documentoMensualCxp(reporte: ReporteMensualCxp, proveedorId: string, anioEmision: string) {
  const escapar = (valor: string) => valor.replace(/[&<>"']/g, (caracter) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[caracter]!);
  const moneda = (valor: number) => `L ${valor.toLocaleString("es-HN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const grupos = reporte.proveedores.filter((grupo) => !proveedorId || grupo.id === proveedorId);
  const documento = prepararDocumentoMensualCxp({ ...reporte, proveedores: grupos, total: grupos.reduce((suma, grupo) => suma + Math.round(grupo.total * 100), 0) / 100 }, anioEmision);
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Cuentas por pagar - ${escapar(nombrePeriodo(reporte.periodo))}</title>
  <style>
    @page { size: letter; margin: 16mm 14mm; }
    * { box-sizing: border-box; } body { margin: 0; background: #eef2f3; color: #172c2b; font: 12px/1.55 Arial, sans-serif; }
    article { max-width: 816px; margin: 0 auto; padding: 44px; background: white; }
    header { text-align: center; border-bottom: 2px solid #125a51; padding-bottom: 16px; }
    header img { display: block; width: 100%; max-height: 130px; object-fit: contain; height: auto; } header p { margin: 8px 0 0; font-size: 11px; letter-spacing: 2px; }
    h1 { text-align: center; font-size: 17px; margin: 24px 0 4px; } .periodo { text-align: center; margin: 0 0 22px; }
    .apertura, .cierre { text-align: justify; } table { border-collapse: collapse; width: 100%; margin: 22px 0; table-layout: fixed; }
    th, td { padding: 8px 6px; border: 1px solid #dce4e1; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
    th { font-size: 11px; background: #edf5f2; } td { font-size: 11px; } .monto { text-align: right; white-space: nowrap; }
    .descripcion { white-space: pre-line; } tfoot { font-weight: bold; background: #f4f7f6; }
    .firma { text-align: center; margin: 66px auto 10px; width: 280px; max-width: 100%; border-top: 1px solid #263d38; padding-top: 8px; }
    .firma strong, .firma span { display: block; } .certificacion { break-inside: avoid; margin-top: 28px; }
    thead { display: table-header-group; } tr { break-inside: avoid; }
    @media print { body { background: white; } article { max-width: none; margin: 0; padding: 0; } * { print-color-adjust: exact; -webkit-print-color-adjust: exact; } }
    @media screen and (max-width: 600px) { article { padding: 20px 12px; } }
  </style></head><body><article>
  <header><img src="/membrete.svg" alt="Municipalidad de Talanga, departamento de Francisco Morazán"><p>TESORERÍA MUNICIPAL</p></header>
  <h1>${documento.titulo}</h1><p class="periodo">${escapar(documento.subtitulo)}</p>
  <p class="apertura">${escapar(documento.apertura)}</p>
  <table><colgroup><col style="width:6%"><col style="width:25%"><col style="width:19%"><col style="width:50%"></colgroup>
  <thead><tr><th>No.</th><th>Acreedor</th><th class="monto">Monto</th><th>Descripción</th></tr></thead>
  <tbody>${documento.filas.map((fila) => `<tr><td>${fila.numero}</td><td>${escapar(fila.acreedor)}</td><td class="monto">${moneda(fila.monto)}</td><td class="descripcion">${escapar(fila.descripcion)}</td></tr>`).join("")}
  ${documento.filas.length ? "" : '<tr><td colspan="4">No se registran cuentas por pagar pendientes al cierre del mes seleccionado.</td></tr>'}</tbody>
  <tfoot><tr><td colspan="2">TOTAL</td><td class="monto">${moneda(documento.total)}</td><td></td></tr></tfoot></table>
  <div class="certificacion"><p class="cierre">${escapar(documento.cierre)}</p><div class="firma"><strong>${escapar(documento.firmante)}</strong><span>${documento.cargo}</span></div></div>
  </article></body></html>`;
}
