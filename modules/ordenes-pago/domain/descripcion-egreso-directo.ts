type MovimientoConRetencion = {
  deduccion: number;
  nombre: string;
  id_beneficiario: string;
};

const formatoMonto = new Intl.NumberFormat("es-HN", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function construirDescripcionEgresoDirecto(
  descripcion: string,
  movimientos: MovimientoConRetencion[]
) {
  const base = descripcion.trim();
  if (base.toUpperCase() === "NULA") return base;

  const retenciones = new Map<string, { nombre: string; centavos: number }>();
  for (const movimiento of movimientos) {
    const monto = Number(movimiento.deduccion);
    if (!Number.isFinite(monto) || monto <= 0) continue;
    const centavos = Math.round(monto * 100);
    if (centavos === 0) continue;

    const id = movimiento.id_beneficiario.trim();
    const nombre = movimiento.nombre.trim();
    const clave = id ? `id:${id}` : `nombre:${nombre}`;
    const anterior = retenciones.get(clave);
    retenciones.set(clave, {
      nombre: nombre || anterior?.nombre || `beneficiario ${id}`,
      centavos: (anterior?.centavos ?? 0) + centavos,
    });
  }

  const frases = Array.from(retenciones.values()).map(
    ({ nombre, centavos }) =>
      `Retención de L ${formatoMonto.format(centavos / 100)} aplicada a ${nombre}.`
  ).filter((frase) => !base.includes(frase));

  if (frases.length === 0) return base;
  const separador = base && !/[.!?]$/.test(base) ? "." : "";
  return [base + separador, ...frases].filter(Boolean).join(" ");
}
