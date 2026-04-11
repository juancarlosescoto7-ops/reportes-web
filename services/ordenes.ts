import { ejecutarRPC } from "@/lib/supabase";

export async function obtenerEgresosConEjecucion() {
  const data = await ejecutarRPC("obtener_egresos_con_ejecucion");
  return data;
}