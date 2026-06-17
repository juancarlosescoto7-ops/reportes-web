import { ejecutarRPC } from "@/lib/supabase";

export type BeneficiarioOption = {
  id: string;
  nombre: string;
};

export async function buscarBeneficiarios(
  busqueda: string,
  limite = 20
): Promise<BeneficiarioOption[]> {
  const data = await ejecutarRPC("buscar_beneficiarios", {
    p_busqueda: busqueda.trim(),
    p_limite: limite,
  });

  return (data ?? []).map((row: any) => ({
    id: String(row.id ?? ""),
    nombre: String(row.nombre ?? ""),
  }));
}