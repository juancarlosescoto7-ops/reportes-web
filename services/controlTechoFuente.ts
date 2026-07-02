import { ejecutarRPC } from "@/lib/supabase";

export type ControlTechoFuente = Record<string, unknown>;

export async function obtenerControlTechoPorFuente(): Promise<
  ControlTechoFuente[]
> {
  const data = await ejecutarRPC("obtener_control_techo_por_fuente", {});

  if (!Array.isArray(data)) return [];

  return data as ControlTechoFuente[];
}
