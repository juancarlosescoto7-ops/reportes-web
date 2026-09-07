// /services/resumenPorGrupo.ts

import { ejecutarRPC } from "@/shared/infrastructure/supabase";

export type ResumenPorGrupo = {
  Fuente: string;
  Tipo: string;

  MontoPermitido: number;
  MontoEjecutado: number;
  SaldoDisponibleReal: number;

  MontoComprometido: number;
  SaldoDisponibleProyectado: number;

  PorcentajeEjecutado: number;
  PorcentajeUsoProyectado: number;
};

type ResumenPorGrupoRow = {
  fuente?: unknown;
  tipo?: unknown;
  montopermitido?: unknown;
  montoejecutado?: unknown;
  saldodisponiblereal?: unknown;
  montocomprometido?: unknown;
  saldodisponibleproyectado?: unknown;
};

export async function obtenerResumenPorGrupo(): Promise<ResumenPorGrupo[]> {
  try {
    const res = await ejecutarRPC<ResumenPorGrupoRow[]>(
      "rpc_resumen_por_grupo",
      {}
    );

    if (!res || !Array.isArray(res)) {
      console.error("RPC inválida:", res);
      return [];
    }

    return res.map((r) => {
      const montoPermitido = Number(r.montopermitido) || 0;
      const montoEjecutado = Number(r.montoejecutado) || 0;
      const saldoDisponibleReal = Number(r.saldodisponiblereal) || 0;
      const montoComprometido = Number(r.montocomprometido) || 0;
      const saldoDisponibleProyectado =
        Number(r.saldodisponibleproyectado) || 0;

      const porcentajeEjecutado =
        montoPermitido === 0
          ? 0
          : (montoEjecutado / montoPermitido) * 100;

      const porcentajeUsoProyectado =
        montoPermitido === 0
          ? 0
          : ((montoEjecutado + montoComprometido) / montoPermitido) * 100;

      return {
        Fuente: String(r.fuente ?? ""),
        Tipo: String(r.tipo ?? ""),

        MontoPermitido: montoPermitido,
        MontoEjecutado: montoEjecutado,
        SaldoDisponibleReal: saldoDisponibleReal,

        MontoComprometido: montoComprometido,
        SaldoDisponibleProyectado: saldoDisponibleProyectado,

        PorcentajeEjecutado: porcentajeEjecutado,
        PorcentajeUsoProyectado: porcentajeUsoProyectado,
      };
    });
  } catch (error) {
    console.error("Error en obtenerResumenPorGrupo:", error);
    return [];
  }
}
