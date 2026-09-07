import { ejecutarRPC } from "@/shared/infrastructure/supabase";

export type ResumenPresupuestoRow = {
  clasificacion_fuente: string;
  clasificacion_tipo_inversion: string;
  total_ejecutado: number;
};

export async function obtenerResumenPresupuesto(): Promise<
  ResumenPresupuestoRow[]
> {
  const data = await ejecutarRPC<ResumenPresupuestoRow[]>(
    "clasificacion_ejecucion",
    {}
  );

  return data;
}
