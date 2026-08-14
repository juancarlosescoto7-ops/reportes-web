export type TipoNivelUbicacionPresupuestaria =
  | "programa"
  | "subprograma"
  | "proyecto"
  | "actividad"
  | "obra"
  | "renglon";

export type NivelUbicacionPresupuestaria = {
  tipo: TipoNivelUbicacionPresupuestaria;
  etiqueta: string;
  codigo: string | null;
  nombre: string | null;
};

export type RenglonContextoPresupuesto = {
  codigoPresupuestario: string;
  objeto: string | null;
  descripcionObjeto: string | null;
  contexto: string | null;
  niveles: NivelUbicacionPresupuestaria[];
  rutaTexto: string;
};

export type ResumenContextosPresupuesto = {
  total: number;
  configurados: number;
  pendientes: RenglonContextoPresupuesto[];
};

type DefinicionNivel = {
  tipo: TipoNivelUbicacionPresupuestaria;
  etiqueta: string;
  codigos: string[];
  nombres: string[];
};

const DEFINICIONES_NIVELES: DefinicionNivel[] = [
  {
    tipo: "programa",
    etiqueta: "Programa",
    codigos: ["programa_id", "programa"],
    nombres: ["programa_nombre", "nombre_programa", "programa"],
  },
  {
    tipo: "subprograma",
    etiqueta: "Subprograma",
    codigos: [
      "sub_programa_id",
      "subprograma_id",
      "sub_programa",
      "subprograma",
    ],
    nombres: [
      "subprograma_nombre",
      "nombre_subprograma",
      "sub_programa_nombre",
      "subprograma",
      "sub_programa",
    ],
  },
  {
    tipo: "proyecto",
    etiqueta: "Proyecto",
    codigos: ["proyecto_id", "proyecto"],
    nombres: ["proyecto_nombre", "nombre_proyecto", "proyecto"],
  },
  {
    tipo: "actividad",
    etiqueta: "Actividad",
    codigos: ["actividad_id", "actividad"],
    nombres: ["actividad_nombre", "nombre_actividad", "actividad"],
  },
  {
    tipo: "obra",
    etiqueta: "Obra",
    codigos: ["obra_id", "obra"],
    nombres: ["obra_nombre", "nombre_obra", "obra"],
  },
];

function limpiar(value: unknown) {
  const texto = String(value ?? "").trim();
  return texto || null;
}

function primerTexto(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const texto = limpiar(row[key]);
    if (texto) return texto;
  }

  return null;
}

function crearNiveles(
  row: Record<string, unknown>,
  codigoPresupuestario: string,
  objeto: string | null,
  descripcionObjeto: string | null
) {
  const niveles = DEFINICIONES_NIVELES.map((definicion) => ({
    tipo: definicion.tipo,
    etiqueta: definicion.etiqueta,
    codigo: primerTexto(row, definicion.codigos),
    nombre: primerTexto(row, definicion.nombres),
  }));

  niveles.push({
    tipo: "renglon",
    etiqueta: "Renglón presupuestario",
    codigo: objeto ?? codigoPresupuestario,
    nombre: descripcionObjeto,
  });

  return niveles;
}

export function crearRutaContextoPresupuesto(
  niveles: NivelUbicacionPresupuestaria[]
) {
  return niveles
    .map((nivel) => {
      const detalle = [nivel.codigo, nivel.nombre]
        .filter((value, index, values) => value && values.indexOf(value) === index)
        .join(" — ");

      return `${nivel.etiqueta}: ${detalle || "No especificado"}`;
    })
    .join(" > ");
}

function crearRenglon(
  row: Record<string, unknown>,
  codigoPresupuestario: string
): RenglonContextoPresupuesto {
  const objeto = primerTexto(row, ["objeto"]);
  const descripcionObjeto = primerTexto(row, ["descripcion_objeto"]);
  const niveles = crearNiveles(
    row,
    codigoPresupuestario,
    objeto,
    descripcionObjeto
  );

  return {
    codigoPresupuestario,
    objeto,
    descripcionObjeto,
    contexto: primerTexto(row, ["contexto_cxp"]),
    niveles,
    rutaTexto: crearRutaContextoPresupuesto(niveles),
  };
}

function puntuarDetalle(renglon: RenglonContextoPresupuesto) {
  return renglon.niveles.reduce(
    (total, nivel) => total + Number(Boolean(nivel.codigo)) + Number(Boolean(nivel.nombre)),
    0
  );
}

function compararRenglones(
  izquierda: RenglonContextoPresupuesto,
  derecha: RenglonContextoPresupuesto
) {
  return izquierda.rutaTexto.localeCompare(derecha.rutaTexto, "es", {
    numeric: true,
    sensitivity: "base",
  });
}

export function resumirContextosPresupuesto(
  rows: Record<string, unknown>[]
): ResumenContextosPresupuesto {
  const porCodigo = new Map<string, RenglonContextoPresupuesto>();

  for (const row of rows) {
    const codigoPresupuestario = primerTexto(row, [
      "codigo",
      "codigo_presupuestario",
    ]);

    if (!codigoPresupuestario) continue;

    const candidato = crearRenglon(row, codigoPresupuestario);
    const actual = porCodigo.get(codigoPresupuestario);

    if (!actual) {
      porCodigo.set(codigoPresupuestario, candidato);
      continue;
    }

    const contexto = actual.contexto ?? candidato.contexto;
    const masDetallado =
      puntuarDetalle(candidato) > puntuarDetalle(actual) ? candidato : actual;

    porCodigo.set(codigoPresupuestario, {
      ...masDetallado,
      contexto,
    });
  }

  const renglones = Array.from(porCodigo.values()).sort(compararRenglones);
  const pendientes = renglones.filter((renglon) => !renglon.contexto);

  return {
    total: renglones.length,
    configurados: renglones.length - pendientes.length,
    pendientes,
  };
}
