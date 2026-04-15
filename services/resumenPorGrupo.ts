// /services/resumenPorGrupo.ts

import { ejecutarRPC } from "@/lib/supabase";

export type ResumenPorGrupo = {
  Fuente: string;
  Tipo: string;
  MontoPermitido: number;
  MontoEjecutado: number;
  PorcentajeEjecutado: number;
};

export async function obtenerResumenPorGrupo(): Promise<ResumenPorGrupo[]> {
  try {
    const res = await ejecutarRPC("rpc_resumen_por_grupo", {});

    // Validación estructural
    if (!res || !Array.isArray(res)) {
      console.error("RPC inválida:", res);
      return [];
    }

    // Normalización (clave del sistema)
    return res.map((r: any) => ({
      Fuente: r.fuente ?? "",
      Tipo: r.tipo ?? "",
      MontoPermitido: Number(r.montopermitido) || 0,
      MontoEjecutado: Number(r.montoejecutado) || 0,
      PorcentajeEjecutado: Number(r.porcentajeejecutado) || 0,
    }));

  } catch (error) {
    console.error("Error en obtenerResumenPorGrupo:", error);
    return [];
  }
}