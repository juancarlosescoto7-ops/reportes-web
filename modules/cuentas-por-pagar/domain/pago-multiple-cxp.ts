export type CxpConProveedor = {
  beneficiario_id?: string | null;
  beneficiario_nombre?: string | null;
};

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
