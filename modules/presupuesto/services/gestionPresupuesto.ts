export type NivelPresupuesto =
  | "Programa"
  | "SubPrograma"
  | "Proyecto"
  | "Actividad"
  | "Obra"
  | "Codigo";

export type OpcionPresupuesto = {
  id: string;
  nombre: string;
};

export type CatalogosPresupuesto = {
  objetosGasto: OpcionPresupuesto[];
  fuentesFinanciamiento: OpcionPresupuesto[];
  tiposGasto: OpcionPresupuesto[];
};

export type CrearRegistroPresupuestoInput = {
  nivel: NivelPresupuesto;
  idPadre: string;
  fragmento?: string;
  nombre?: string;
  objeto?: string;
  fuente?: string;
  tipoInversion?: string;
};

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String(data.error)
        : "No se pudo completar la operacion.";

    throw new Error(message);
  }

  return data as T;
}

export async function obtenerNivelPresupuesto(
  nivel: NivelPresupuesto,
  idPadre = ""
) {
  const params = new URLSearchParams({
    nivel,
    idPadre,
  });

  const response = await fetch(`/api/presupuesto/niveles?${params.toString()}`);

  return parseResponse<OpcionPresupuesto[]>(response);
}

export async function obtenerCatalogosPresupuesto() {
  const response = await fetch("/api/presupuesto/catalogos");

  return parseResponse<CatalogosPresupuesto>(response);
}

export async function crearRegistroPresupuesto(
  input: CrearRegistroPresupuestoInput
) {
  const response = await fetch("/api/presupuesto/crear", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return parseResponse<{ id: string; nivel: NivelPresupuesto }>(response);
}
