export type NivelBorrador =
  | "Programa"
  | "SubPrograma"
  | "Proyecto"
  | "Actividad"
  | "Obra";

export type RegistroNivelBorrador = {
  id: string;
  borrador_id: string;
  codigo: string;
  nombre: string;
  fragmento?: string;
  programa_id?: string;
  subprograma_id?: string;
  proyecto_id?: string;
  actividad_id?: string;
};

export type CodigoBorrador = {
  id: string;
  borrador_id: string;
  obra_id: string;
  codigo: string;
  objeto: string;
  fuente: string;
  tipo_inversion: string;
  monto: number | string;
  actualizado_en: string;
};

export type BorradorPresupuesto = {
  id: string;
  anio: number;
  nombre: string;
  estado: "BORRADOR" | "EN_REVISION" | "APROBADO";
  ejercicio_base: number;
  creado_en: string;
  actualizado_en: string;
};

export type FuenteBorrador = {
  id: string;
  fuente: string;
  nombre_fuente: string | null;
  monto_base: number | string;
};

export type TopeBorrador = {
  id: string;
  fuente: string;
  nivel_aplicacion: string;
  id_nivel: string;
  porcentaje_tope: number | string;
};

export type ControlTopeBorrador = {
  fuente: string;
  nivel_aplicacion: string;
  id_nivel: string;
  porcentaje_tope: number | string;
  monto_fuente: number | string;
  monto_permitido: number | string;
  monto_asignado: number | string;
  monto_disponible: number | string;
  porcentaje_usado: number | string;
  estado: string;
};

export type OpcionBorrador = { id: string; nombre: string };
export type RubroIngresoSaft = { codigo: string; descripcion: string };
export type IngresoBorrador = {
  id: string;
  borrador_id: string;
  codigo_saft: string;
  cantidad_negocios: number | string;
  monto_por_negocio: number | string;
  presupuesto_proyectado: number | string;
  actualizado_en: string;
};

export type RespuestaBorrador = {
  borrador: BorradorPresupuesto | null;
  programas: RegistroNivelBorrador[];
  subprogramas: RegistroNivelBorrador[];
  proyectos: RegistroNivelBorrador[];
  actividades: RegistroNivelBorrador[];
  obras: RegistroNivelBorrador[];
  codigos: CodigoBorrador[];
  topes: TopeBorrador[];
  fuentes: FuenteBorrador[];
  controlTechos: ControlTopeBorrador[];
  objetosGasto: OpcionBorrador[];
  rubrosIngresos: RubroIngresoSaft[];
  ingresos: IngresoBorrador[];
};

async function parse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String(data.error)
        : "No se pudo completar la operación.";
    throw new Error(message);
  }
  return data as T;
}

const endpoint = "/api/borrador-presupuesto";

export async function obtenerBorradorPresupuesto(anio: number) {
  return parse<RespuestaBorrador>(
    await fetch(`${endpoint}?anio=${anio}`, { cache: "no-store" }),
  );
}

export async function generarBorradorPresupuesto(input: {
  anio: number;
  ejercicioBase: number;
}) {
  return parse<{ id: string }>(
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "inicializar", ...input }),
    }),
  );
}

export async function crearNivelBorrador(input: {
  borradorId: string;
  nivel: NivelBorrador;
  parentId?: string;
  fragmento: string;
  nombre: string;
}) {
  return parse<{ id: string }>(
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "crear_nivel", ...input }),
    }),
  );
}

export async function crearCodigoBorrador(input: {
  borradorId: string;
  obraId: string;
  objeto: string;
  fuente: string;
  tipoInversion: string;
  monto: number;
}) {
  return parse<{ id: string }>(
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "crear_codigo", ...input }),
    }),
  );
}

export async function guardarIngresoBorrador(input: {
  borradorId: string;
  codigoSaft: string;
  cantidadNegocios: number;
  montoPorNegocio: number;
}) {
  return parse<{ id: string }>(
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "guardar_ingreso", ...input }),
    }),
  );
}

export async function actualizarMontoCodigoBorrador(input: {
  codigoId: string;
  monto: number;
}) {
  return parse<{ id: string }>(
    await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function retirarCodigoBorrador(codigoId: string) {
  return parse<{ id: string }>(
    await fetch(endpoint, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigoId }),
    }),
  );
}
