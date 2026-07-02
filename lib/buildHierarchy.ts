type PresupuestoRow = Record<string, unknown>;

export function buildHierarchy(data: PresupuestoRow[]) {
  const root = new Map();

  for (const row of data) {
    const codigo = String(row.codigo ?? "").trim();
    const objeto = String(row.objeto ?? "").trim();
    const descripcionObjeto = String(row.descripcion_objeto ?? "").trim();

    const nombreCodigo = crearNombreCodigo({
      codigo,
      objeto,
      descripcionObjeto,
    });

    const levels = [
      {
        key: getFirstValue(row, ["programa_id", "programa"]),
        name: getFirstValue(row, ["programa_nombre", "nombre_programa", "programa"]),
        level: "programa",
        meta: {
          programa_id: getFirstValue(row, ["programa_id", "programa"]),
        },
      },
      {
        key: getFirstValue(row, [
          "sub_programa_id",
          "subprograma_id",
          "sub_programa",
          "subprograma",
        ]),
        name: getFirstValue(row, [
          "subprograma_nombre",
          "nombre_subprograma",
          "sub_programa_nombre",
          "subprograma",
        ]),
        level: "subprograma",
        meta: {
          programa_id: getFirstValue(row, ["programa_id", "programa"]),
          sub_programa_id: getFirstValue(row, [
            "sub_programa_id",
            "subprograma_id",
            "sub_programa",
            "subprograma",
          ]),
        },
      },
      {
        key: getFirstValue(row, ["proyecto_id", "proyecto"]),
        name: getFirstValue(row, [
          "proyecto_nombre",
          "nombre_proyecto",
          "proyecto",
        ]),
        level: "proyecto",
        meta: {
          sub_programa_id: getFirstValue(row, [
            "sub_programa_id",
            "subprograma_id",
            "sub_programa",
            "subprograma",
          ]),
          proyecto_id: getFirstValue(row, ["proyecto_id", "proyecto"]),
        },
      },
      {
        key: getFirstValue(row, ["actividad_id", "actividad"]),
        name: getFirstValue(row, [
          "actividad_nombre",
          "nombre_actividad",
          "actividad",
        ]),
        level: "actividad",
        meta: {
          proyecto_id: getFirstValue(row, ["proyecto_id", "proyecto"]),
          actividad_id: getFirstValue(row, ["actividad_id", "actividad"]),
        },
      },
      {
        key: getFirstValue(row, ["obra_id", "obra"]),
        name: getFirstValue(row, ["obra_nombre", "nombre_obra", "obra"]),
        level: "obra",
        meta: {
          actividad_id: getFirstValue(row, ["actividad_id", "actividad"]),
          obra_id: getFirstValue(row, ["obra_id", "obra"]),
        },
      },
      {
        key: row.codigo,
        name: nombreCodigo,
        level: "codigo",
        meta: {
          codigo_presupuestario: row.codigo ?? null,
          obra_id: getFirstValue(row, ["obra_id", "obra"]),
        },
      },
    ];

    let current = root;

    for (const node of levels) {
      if (!node.key) continue;

      const nodeKey = String(node.key).trim();

      if (!current.has(nodeKey)) {
        current.set(nodeKey, {
          id: nodeKey,
          name: node.name ?? nodeKey,
          level: node.level,

          searchText: crearTextoBusqueda(row),

          meta: {
            codigo_presupuestario: null,
            programa_id: null,
            sub_programa_id: null,
            obra_id: null,
            actividad_id: null,
            proyecto_id: null,
            ejercicio_fiscal: null,
            objeto: null,
            descripcion_objeto: null,
            fuente: null,
            tipo_inversion: null,
          },

          kpis: {
            presupuesto_inicial: 0,
            ampliacion: 0,
            disminucion: 0,
            vigente: 0,
            ejecutado: 0,
            comprometido: 0,
          },

          children: new Map(),
        });
      }

      const item = current.get(nodeKey);
      item.name = node.name ?? item.name;
      item.meta = {
        ...item.meta,
        ...node.meta,
      };

      item.kpis.presupuesto_inicial += toNumber(row.presupuesto_inicial);
      item.kpis.ampliacion += toNumber(row.ampliacion);
      item.kpis.disminucion += toNumber(row.disminucion);
      item.kpis.vigente += toNumber(row.presupuesto_vigente);
      item.kpis.ejecutado += toNumber(row.ejecutado);
      item.kpis.comprometido += getComprometido(row);

      if (node.level === "codigo") {
        item.name = nombreCodigo;
        item.searchText = crearTextoBusqueda(row);

        item.meta = {
          codigo_presupuestario: row.codigo ?? null,

          programa_id: getFirstValue(row, ["programa_id", "programa"]),
          sub_programa_id: getFirstValue(row, [
            "sub_programa_id",
            "subprograma_id",
            "sub_programa",
            "subprograma",
          ]),
          obra_id: getFirstValue(row, ["obra_id", "obra"]),
          actividad_id: row.actividad_id ?? row.actividad ?? null,
          proyecto_id: row.proyecto_id ?? row.proyecto ?? null,
          ejercicio_fiscal: row.ejercicio_fiscal ?? null,

          objeto: row.objeto ?? null,
          descripcion_objeto: row.descripcion_objeto ?? null,
          fuente: row.fuente ?? null,
          tipo_inversion: row.tipo_inversion ?? null,
        };
      }

      current = item.children;
    }
  }

  return root;
}

function getFirstValue(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = row[key];

    if (value !== null && value !== undefined && String(value).trim()) {
      return value;
    }
  }

  return null;
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const cleanValue = String(value)
    .replace(/L\./g, "")
    .replace(/,/g, "")
    .trim();

  const numericValue = Number(cleanValue);

  return Number.isFinite(numericValue) ? numericValue : 0;
}

function getComprometido(row: PresupuestoRow) {
  return toNumber(
    row.comprometido ??
      row.total_comprometido ??
      row.saldo_comprometido ??
      row.monto_comprometido ??
      0
  );
}

function crearNombreCodigo({
  codigo,
  objeto,
  descripcionObjeto,
}: {
  codigo: string;
  objeto: string;
  descripcionObjeto: string;
}) {
  if (objeto && descripcionObjeto) {
    return `${codigo} / ${objeto} - ${descripcionObjeto}`;
  }

  if (descripcionObjeto) {
    return `${codigo} / ${descripcionObjeto}`;
  }

  if (objeto) {
    return `${codigo} / ${objeto}`;
  }

  return codigo || "Código sin nombre";
}

function crearTextoBusqueda(row: PresupuestoRow) {
  return [
    row.programa,
    row.subprograma,
    row.proyecto,
    row.actividad,
    row.obra,
    row.codigo,
    row.objeto,
    row.descripcion_objeto,
    row.fuente,
    row.tipo_inversion,
    row.comprometido,
    row.total_comprometido,
    row.saldo_comprometido,
    row.monto_comprometido,
  ]
    .filter(Boolean)
    .join(" ");
}
