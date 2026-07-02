export type ModificacionPresupuestoInput = {
  codigo: string;
  ampliacion: number;
  disminucion: number;
};

export type ModificacionPresupuestariaClasificada = {
  id: number;
  id_modificacion: number;
  created_at: string;
  fecha: string;
  descripcion: string | null;
  programa: string | null;
  subprograma: string | null;
  proyecto: string | null;
  actividad: string | null;
  obra: string | null;
  codigo: string | null;
  objeto: string | null;
  descripcion_objeto: string | null;
  fuente: string | null;
  tipo_inversion: string | null;
  ampliacion: number | string | null;
  disminucion: number | string | null;
  movimiento_neto: number | string | null;
  tipo_movimiento: string | null;
  estado_clasificacion: string | null;
};

export type FiltrosModificacionesClasificadas = {
  busqueda?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  fuente?: string;
  tipoInversion?: string;
  idModificacion?: string;
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

export async function registrarModificacionesPresupuesto({
  descripcion,
  modificaciones,
}: {
  descripcion: string;
  modificaciones: ModificacionPresupuestoInput[];
}) {
  const response = await fetch("/api/presupuesto/modificaciones", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      descripcion,
      modificaciones,
    }),
  });

  return parseResponse<{
    idModificacion: number;
    registros: number;
  }>(response);
}

export async function obtenerModificacionesClasificadas(
  filtros: FiltrosModificacionesClasificadas = {}
) {
  const params = new URLSearchParams();

  Object.entries(filtros).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  const query = params.toString();
  const response = await fetch(
    `/api/presupuesto/modificaciones/clasificadas${query ? `?${query}` : ""}`
  );

  return parseResponse<ModificacionPresupuestariaClasificada[]>(response);
}
