import type { CXP } from "@/modules/cuentas-por-pagar/services/cxp";
import type { Orden } from "@/modules/ordenes-pago/services/ordenes.service";

export type RenglonPresupuesto = Record<string, unknown>;

export function numero(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

export function obtenerCxpSinComprometer(cxps: CXP[]) {
  return cxps.filter((cxp) => {
    const saldo = numero(cxp.saldo_por_comprometer);
    return cxp.estado_administrativo === "pendiente" && saldo > 0;
  });
}

export function obtenerEgresosSinComprometer(ordenes: Orden[]) {
  return ordenes.filter((orden) => numero(orden.diferencia) > 0.005);
}

export function obtenerRenglonesSinFondos(rows: RenglonPresupuesto[]) {
  const unicos = new Map<string, RenglonPresupuesto>();

  rows.forEach((row, index) => {
    const codigo = String(row.codigo ?? row.codigo_presupuestario ?? "").trim();
    if (!codigo) return;

    const vigente = numero(row.presupuesto_vigente ?? row.vigente);
    const ejecutado = numero(row.ejecutado ?? row.total_ejecutado);
    const comprometido = numero(
      row.comprometido ?? row.total_comprometido ?? row.monto_comprometido
    );
    const saldo = vigente - ejecutado - comprometido;

    if (saldo <= 0.005) {
      unicos.set(codigo || `renglon-${index}`, { ...row, saldo_calculado: saldo });
    }
  });

  return Array.from(unicos.values());
}

export function calcularPorcentajePendiente(pendientes: number, revisados: number) {
  if (revisados <= 0) return 0;
  return Math.min(100, Math.round((pendientes / revisados) * 100));
}
