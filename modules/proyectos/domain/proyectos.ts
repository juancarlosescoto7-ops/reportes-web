export type ObraPresupuestaria = {
  id: string;
  nombre: string;
  actividadId: string | null;
};

export type CrearProyectoPayload = {
  nombreProyecto: string;
  codigos: string[];
};

export function normalizarObrasPresupuesto(
  value: unknown
): ObraPresupuestaria[] {
  if (!Array.isArray(value)) return [];

  const obras = new Map<string, ObraPresupuestaria>();

  value.forEach((item) => {
    if (!item || typeof item !== "object") return;

    const row = item as Record<string, unknown>;
    const id = String(row.id ?? "").trim();
    const nombre = String(row.nombre ?? "").trim();

    if (!id || !nombre || normalizarTexto(nombre) === "sin obra") return;

    obras.set(id, {
      id,
      nombre,
      actividadId:
        row.actividad_id === null || row.actividad_id === undefined
          ? null
          : String(row.actividad_id),
    });
  });

  return Array.from(obras.values()).sort((a, b) =>
    a.nombre.localeCompare(b.nombre, "es", {
      numeric: true,
      sensitivity: "base",
    })
  );
}

export function validarCrearProyectoPayload(
  value: unknown
):
  | { ok: true; payload: CrearProyectoPayload }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object") {
    return { ok: false, error: "Debe completar los datos del proyecto." };
  }

  const row = value as Record<string, unknown>;
  const nombreProyecto = String(row.nombreProyecto ?? "").trim();
  const codigos = Array.isArray(row.codigos)
    ? Array.from(
        new Set(
          row.codigos
            .map((codigo) => String(codigo ?? "").trim())
            .filter(Boolean)
        )
      )
    : [];

  if (!nombreProyecto) {
    return { ok: false, error: "Debe ingresar el nombre del proyecto." };
  }

  if (nombreProyecto.length > 300) {
    return {
      ok: false,
      error: "El nombre del proyecto no puede superar 300 caracteres.",
    };
  }

  if (codigos.length === 0) {
    return { ok: false, error: "Debe seleccionar al menos una obra." };
  }

  if (codigos.length > 100) {
    return {
      ok: false,
      error: "No puede vincular más de 100 obras en una sola operación.",
    };
  }

  if (codigos.some((codigo) => codigo.length > 100)) {
    return { ok: false, error: "Uno de los códigos de obra no es válido." };
  }

  return {
    ok: true,
    payload: {
      nombreProyecto,
      codigos,
    },
  };
}

export function normalizarIdProyecto(value: unknown): number | null {
  const candidato =
    value && typeof value === "object" && "id_proyecto" in value
      ? (value as { id_proyecto?: unknown }).id_proyecto
      : value;
  const id = Number(candidato);

  return Number.isInteger(id) && id > 0 ? id : null;
}

export function esRequisitoOrdenInicio(nombre: string) {
  return normalizarTexto(nombre).includes("orden de inicio");
}

function normalizarTexto(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
