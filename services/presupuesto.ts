import { ejecutarRPC } from "@/lib/supabase";

export async function obtenerPresupuesto() {
  const data = await ejecutarRPC("rpc_presupuesto_base", {
    p_busqueda: null,
  });

  return data;
}