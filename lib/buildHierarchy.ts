export function buildHierarchy(data: any[]) {
  const root = new Map();

  for (const row of data) {
    const levels = [
      { key: row.programa, level: "programa" },
      { key: row.subprograma, level: "subprograma" },
      { key: row.proyecto, level: "proyecto" },
      { key: row.actividad, level: "actividad" },
      { key: row.obra, level: "obra" },
      { key: row.codigo, level: "codigo" },
    ];

    let current = root;

    for (const node of levels) {
      if (!node.key) continue;

      if (!current.has(node.key)) {
        current.set(node.key, {
          id: node.key,
          name: node.key,
          level: node.level,

          meta: {
            codigo_presupuestario: null,
            actividad_id: null,
            proyecto_id: null,
            ejercicio_fiscal: null,
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

      const item = current.get(node.key);

      item.kpis.presupuesto_inicial += Number(row.presupuesto_inicial || 0);
      item.kpis.ampliacion += Number(row.ampliacion || 0);
      item.kpis.disminucion += Number(row.disminucion || 0);
      item.kpis.vigente += Number(row.presupuesto_vigente || 0);
      item.kpis.ejecutado += Number(row.ejecutado || 0);
      item.kpis.comprometido += Number(row.comprometido || 0);

      if (node.level === "codigo") {
        item.meta = {
          codigo_presupuestario: row.codigo ?? null,
          actividad_id: row.actividad_id ?? row.actividad ?? null,
          proyecto_id: row.proyecto_id ?? row.proyecto ?? null,
          ejercicio_fiscal: row.ejercicio_fiscal ?? null,
        };
      }

      current = item.children;
    }
  }

  return root;
}