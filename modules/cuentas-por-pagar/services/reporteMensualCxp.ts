import { ejecutarRPC } from "@/shared/infrastructure/supabase";
import { construirReporteMensualCxp, corteMensual, type DatosHistoricosCxp } from "../domain/reporte-mensual-cxp";

export async function obtenerReportesMensualesCxp(periodos: string[]) {
  if (!periodos.length) return [];
  const ultimoPeriodo = [...periodos].sort().at(-1)!;
  const datos = await ejecutarRPC<DatosHistoricosCxp>("obtener_datos_reporte_mensual_cxp", {
    p_corte: corteMensual(ultimoPeriodo),
  }, { lanzarError: true });
  if (!datos || !Array.isArray(datos.cuentas) || !Array.isArray(datos.historial)) {
    throw new Error("No se recibió el historial completo de cuentas por pagar.");
  }
  return periodos.map((periodo) => construirReporteMensualCxp(datos, periodo));
}
