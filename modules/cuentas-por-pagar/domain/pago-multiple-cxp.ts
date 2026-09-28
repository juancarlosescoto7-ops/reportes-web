export type CxpConProveedor = {
  beneficiario_id?: string | null;
  beneficiario_nombre?: string | null;
};

/** El abono a la CxP incluye el banco y la retención pendiente de pagar. */
export function calcularDesglosePagoCxp(montoBanco: number, deduccion = 0) {
  const bancoCentavos = Math.round(montoBanco * 100);
  const deduccionCentavos = Math.round(deduccion * 100);
  return {
    monto_banco: bancoCentavos / 100,
    deduccion: deduccionCentavos / 100,
    monto_pago: (bancoCentavos + deduccionCentavos) / 100,
  };
}

export function obtenerErrorDesglosePagoCxp(pago: {
  monto_pago: number;
  deduccion?: number;
  saldo_real?: number;
}) {
  const deduccion = pago.deduccion ?? 0;
  if (!Number.isFinite(pago.monto_pago) || !Number.isFinite(deduccion)) {
    return "Los montos de banco y deducciones deben ser numéricos.";
  }
  if (deduccion < 0 || pago.monto_pago < deduccion) {
    return "Los montos de banco y deducciones no pueden ser negativos.";
  }
  if (Math.round(pago.monto_pago * 100) <= 0) {
    return "Cada CxP debe tener un abono total mayor a cero.";
  }
  if (pago.saldo_real !== undefined &&
      Math.round(pago.monto_pago * 100) > Math.round(pago.saldo_real * 100)) {
    return "La suma de banco y deducciones no puede superar el saldo real de una CxP.";
  }
  return null;
}

export type GrupoProveedorPago<T extends CxpConProveedor> = {
  key: string;
  beneficiarioId: string | null;
  nombre: string;
  cxps: T[];
};

function normalizarTexto(value: string | null | undefined) {
  return value?.trim() || "";
}

export function obtenerClaveProveedorPago(
  cxp: CxpConProveedor,
  indice = 0
) {
  const beneficiarioId = normalizarTexto(cxp.beneficiario_id);

  if (beneficiarioId) {
    return `id:${beneficiarioId}`;
  }

  const nombre = normalizarTexto(cxp.beneficiario_nombre);

  if (nombre) {
    return `nombre:${nombre.toLocaleLowerCase("es-HN")}`;
  }

  return `sin-beneficiario:${indice}`;
}

export function agruparCxpsPorProveedor<T extends CxpConProveedor>(
  cxps: T[]
): GrupoProveedorPago<T>[] {
  const grupos = new Map<string, GrupoProveedorPago<T>>();

  cxps.forEach((cxp, indice) => {
    const key = obtenerClaveProveedorPago(cxp, indice);
    const actual = grupos.get(key);

    if (actual) {
      actual.cxps.push(cxp);
      return;
    }

    grupos.set(key, {
      key,
      beneficiarioId: normalizarTexto(cxp.beneficiario_id) || null,
      nombre: normalizarTexto(cxp.beneficiario_nombre) || "Sin proveedor",
      cxps: [cxp],
    });
  });

  return Array.from(grupos.values());
}

export function esPlanillaPago(cxps: CxpConProveedor[]) {
  return agruparCxpsPorProveedor(cxps).length > 1;
}

export function obtenerErrorChequesPorProveedor(
  proveedores: Array<{ key: string }>,
  chequesPorProveedor: Record<string, string>
) {
  const cheques = proveedores.map((proveedor) =>
    Number(chequesPorProveedor[proveedor.key] ?? "")
  );

  if (cheques.some((cheque) => !Number.isInteger(cheque) || cheque <= 0)) {
    return "Debe ingresar un número de cheque válido para cada proveedor.";
  }

  if (new Set(cheques).size !== cheques.length) {
    return "Cada proveedor debe tener un número de cheque diferente.";
  }

  return null;
}
