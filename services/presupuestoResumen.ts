import { ejecutarRPC } from "@/lib/supabase";

export async function obtenerResumenPresupuesto() {
  const data = await ejecutarRPC("clasificacion_ejecucion", {});

  return data;
}