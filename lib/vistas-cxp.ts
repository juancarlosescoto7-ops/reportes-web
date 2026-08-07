export type CxpClasificable = {
  no_cxp: number;
  tipo_movimiento?: string | null;
  fecha?: string | null;
  monto_comprometido?: number | null;
  estado_operativo?: string | null;
};

export type GrupoCxpCronologico<T extends CxpClasificable> = {
  key: string;
  tipo: string;
  items: T[];
};

function normalizarTipo(value: string | null | undefined) {
  return value?.trim() || "Sin tipo";
}

export function estaCxpComprometida(cxp: CxpClasificable) {
  return (
    Number(cxp.monto_comprometido ?? 0) > 0 ||
    cxp.estado_operativo === "compromiso_parcial" ||
    cxp.estado_operativo === "compromiso_total"
  );
}

export function separarCxpPorCompromiso<T extends CxpClasificable>(items: T[]) {
  const sinCompromiso: T[] = [];
  const comprometidas: T[] = [];

  for (const item of items) {
    if (estaCxpComprometida(item)) {
      comprometidas.push(item);
    } else {
      sinCompromiso.push(item);
    }
  }

  return { sinCompromiso, comprometidas };
}

export function ordenarCxpPorNumero<T extends CxpClasificable>(items: T[]) {
  return [...items].sort((a, b) => {
    const comparacionNumero = a.no_cxp - b.no_cxp;
    if (comparacionNumero !== 0) return comparacionNumero;

    const comparacionFecha = String(a.fecha ?? "").localeCompare(
      String(b.fecha ?? "")
    );
    if (comparacionFecha !== 0) return comparacionFecha;

    return normalizarTipo(a.tipo_movimiento).localeCompare(
      normalizarTipo(b.tipo_movimiento),
      "es-HN",
      { sensitivity: "base" }
    );
  });
}

export function agruparCxpCronologicamente<T extends CxpClasificable>(
  items: T[]
): GrupoCxpCronologico<T>[] {
  const grupos = new Map<string, T[]>();

  for (const item of items) {
    const tipo = normalizarTipo(item.tipo_movimiento);
    const actuales = grupos.get(tipo) ?? [];
    actuales.push(item);
    grupos.set(tipo, actuales);
  }

  return Array.from(grupos.entries())
    .sort(([tipoA], [tipoB]) =>
      tipoA.localeCompare(tipoB, "es-HN", {
        numeric: true,
        sensitivity: "base",
      })
    )
    .map(([tipo, registros]) => ({
      key: tipo.toLocaleLowerCase("es-HN"),
      tipo,
      items: ordenarCxpPorNumero(registros),
    }));
}
