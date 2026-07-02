import { crearClienteSupabase, ejecutarRPC } from "@/lib/supabase";

export type BeneficiarioOption = {
  id: string;
  nombre: string;
};

type BeneficiarioRow = {
  id?: string | number | null;
  nombre?: string | null;
};

export async function buscarBeneficiarios(
  busqueda: string,
  limite = 20
): Promise<BeneficiarioOption[]> {
  const data = await ejecutarRPC("buscar_beneficiarios", {
    p_busqueda: busqueda.trim(),
    p_limite: limite,
  });

  return ((data ?? []) as BeneficiarioRow[]).map((row) => ({
    id: String(row.id ?? ""),
    nombre: String(row.nombre ?? ""),
  }));
}

export async function crearBeneficiario(input: {
  id: string;
  nombre: string;
}): Promise<BeneficiarioOption> {
  const id = input.id.trim();
  const nombre = input.nombre.trim();

  if (!id) {
    throw new Error("Debe ingresar el ID del beneficiario.");
  }

  if (!nombre) {
    throw new Error("Debe ingresar el nombre del beneficiario.");
  }

  const supabase = crearClienteSupabase();

  const { data, error } = await supabase
    .from("beneficiarios")
    .insert({
      id,
      nombre,
    })
    .select("id, nombre")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    id: String(data.id ?? ""),
    nombre: String(data.nombre ?? ""),
  };
}
