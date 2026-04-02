import { ejecutarRPC } from "@/lib/supabase";

export async function obtenerReporteOrdenes() {
  return await ejecutarRPC("obtener_ordenes_sin_archivo");
}