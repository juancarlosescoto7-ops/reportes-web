export type MovimientoDesgloseEgreso = {
  cuenta: string | null;
  haber: number | string | null;
};

export type DesgloseEgreso = {
  bancos: number;
  deducciones: number;
  otrasCuentas: number;
};

export function calcularDesgloseEgreso(movimientos: MovimientoDesgloseEgreso[]): DesgloseEgreso {
  const centavos = { bancos: 0, deducciones: 0, otrasCuentas: 0 };
  for (const movimiento of movimientos) {
    const monto = Number(movimiento.haber ?? 0);
    if (!Number.isFinite(monto)) throw new Error("Un movimiento tiene un monto inválido.");
    const cuenta = (movimiento.cuenta ?? "").trim().toLocaleLowerCase("es-HN");
    const categoria = cuenta === "bancos" ? "bancos"
      : cuenta === "deducciones por pagar" ? "deducciones" : "otrasCuentas";
    centavos[categoria] += Math.round(monto * 100);
  }
  return {
    bancos: centavos.bancos / 100,
    deducciones: centavos.deducciones / 100,
    otrasCuentas: centavos.otrasCuentas / 100,
  };
}
