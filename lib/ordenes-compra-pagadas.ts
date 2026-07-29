export type FilaOrdenCompraPagada = {
  no_orden_pago: string | number | null;
  no_cxp: string | number | null;
  tipo_movimiento: string | null;
  debe: string | number | null;
};

export type OrdenCompraPagada = {
  noOrdenPago: number;
  noOrdenCompra: number;
  tipoMovimiento: string;
  montoPago: number;
};

export type OrdenPagoParaTexto = {
  no_orden: string | number;
  fecha: string;
  descripcion: string;
  total_haber: number;
  total_ejecutado: number;
  diferencia: number;
  beneficiarios: Array<{
    id: string;
    nombre: string;
    no_cheque: string;
    haber: number;
    ejecuciones: Array<{
      codigo_presupuestario: string;
      monto_ejecutado: number;
    }>;
  }>;
};

function normalizarEnteroPositivo(value: unknown) {
  const numero = Number(value);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

function normalizarNumero(value: unknown) {
  const numero = Number(value);
  return Number.isFinite(numero) ? numero : 0;
}

function normalizarTexto(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizarOrdenesCompraPagadas(
  filas: FilaOrdenCompraPagada[]
): OrdenCompraPagada[] {
  const relaciones = new Map<string, OrdenCompraPagada>();

  filas.forEach((fila) => {
    const noOrdenPago = normalizarEnteroPositivo(fila.no_orden_pago);
    const noOrdenCompra = normalizarEnteroPositivo(fila.no_cxp);

    if (!noOrdenPago || !noOrdenCompra) return;

    const tipoMovimiento = normalizarTexto(fila.tipo_movimiento);
    const key = `${noOrdenPago}::${noOrdenCompra}::${tipoMovimiento}`;
    const actual = relaciones.get(key);

    if (actual) {
      actual.montoPago += normalizarNumero(fila.debe);
      return;
    }

    relaciones.set(key, {
      noOrdenPago,
      noOrdenCompra,
      tipoMovimiento,
      montoPago: normalizarNumero(fila.debe),
    });
  });

  return Array.from(relaciones.values()).sort((a, b) => {
    if (b.noOrdenPago !== a.noOrdenPago) {
      return b.noOrdenPago - a.noOrdenPago;
    }

    return a.noOrdenCompra - b.noOrdenCompra;
  });
}

export function agruparOrdenesCompraPorOrdenPago(
  compras: OrdenCompraPagada[]
) {
  const agrupadas = new Map<number, OrdenCompraPagada[]>();

  compras.forEach((compra) => {
    const actuales = agrupadas.get(compra.noOrdenPago) ?? [];
    agrupadas.set(compra.noOrdenPago, [...actuales, compra]);
  });

  return agrupadas;
}

export function construirTextoDetalleOrdenPago(
  orden: OrdenPagoParaTexto,
  compras: OrdenCompraPagada[],
  formatearMonto: (monto: number) => string
) {
  const lineas = [
    `ORDEN DE PAGO #${orden.no_orden}`,
    `Fecha: ${orden.fecha || "Sin fecha"}`,
    `Descripcion: ${orden.descripcion || "Sin descripcion"}`,
    `Total egreso: ${formatearMonto(orden.total_haber)}`,
    `Total ejecutado: ${formatearMonto(orden.total_ejecutado)}`,
    `Diferencia: ${formatearMonto(orden.diferencia)}`,
    "",
    "ORDENES DE COMPRA PAGADAS",
  ];

  if (compras.length === 0) {
    lineas.push("Sin ordenes de compra vinculadas.");
  } else {
    compras.forEach((compra) => {
      lineas.push(
        [
          `- Orden de compra #${compra.noOrdenCompra}`,
          compra.tipoMovimiento
            ? `Tipo: ${compra.tipoMovimiento}`
            : "Tipo: No indicado",
          `Pagado: ${formatearMonto(compra.montoPago)}`,
        ].join(" | ")
      );
    });
  }

  lineas.push("", "BENEFICIARIOS Y EJECUCION");

  if (orden.beneficiarios.length === 0) {
    lineas.push("Sin beneficiarios registrados.");
  } else {
    orden.beneficiarios.forEach((beneficiario, index) => {
      if (index > 0) lineas.push("");

      lineas.push(
        `- ${beneficiario.nombre || "Beneficiario no identificado"}`,
        `  Identificacion: ${beneficiario.id || "No indicada"}`,
        `  Cheque: ${beneficiario.no_cheque || "No indicado"}`,
        `  Egreso: ${formatearMonto(beneficiario.haber)}`
      );

      if (beneficiario.ejecuciones.length === 0) {
        lineas.push("  Ejecuciones: Sin ejecucion presupuestaria asociada.");
      } else {
        lineas.push("  Ejecuciones:");
        beneficiario.ejecuciones.forEach((ejecucion) => {
          lineas.push(
            `    - ${ejecucion.codigo_presupuestario || "Sin codigo"}: ${formatearMonto(
              ejecucion.monto_ejecutado
            )}`
          );
        });
      }
    });
  }

  return lineas.join("\n");
}
