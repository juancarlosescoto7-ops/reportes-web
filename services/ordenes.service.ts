import { ejecutarRPC } from "@/lib/supabase";

export type Ejecucion = {
  id: string;
  codigo_presupuestario: string;
  monto_ejecutado: number;
};

export type Beneficiario = {
  id: string;
  nombre: string;
  no_cheque: string;
  haber: number;
  ejecuciones: Ejecucion[];
};

export type Orden = {
  orden_pago_id?: number;
  no_orden: string;
  fecha: string;
  descripcion: string;
  beneficiarios: Beneficiario[];
  total_haber: number;
  total_ejecutado: number;
  diferencia: number;
};

function obtenerBeneficiarioEjecucion(orden: Orden): Beneficiario {
  const idTecnico = "__ejecucion_presupuestaria__";

  let ben = orden.beneficiarios.find((b) => b.id === idTecnico);

  if (!ben) {
    ben = {
      id: idTecnico,
      nombre: "Ejecución presupuestaria",
      no_cheque: "",
      haber: 0,
      ejecuciones: [],
    };

    orden.beneficiarios.push(ben);
  }

  return ben;
}

export async function obtenerOrdenesEstructuradas(): Promise<Orden[]> {
  const data = await ejecutarRPC("obtener_egresos_con_ejecucion", {});

  const map = new Map<string, Orden>();

  for (const row of data) {
    const ordenId = String(row.no_orden);

    if (!map.has(ordenId)) {
      map.set(ordenId, {
        orden_pago_id: row.orden_pago_id ? Number(row.orden_pago_id) : undefined,
        no_orden: ordenId,
        fecha: row.fecha,
        descripcion: row.descripcion,
        beneficiarios: [],
        total_haber: 0,
        total_ejecutado: 0,
        diferencia: 0,
      });
    }

    const orden = map.get(ordenId)!;

    if (!orden.orden_pago_id && row.orden_pago_id) {
      orden.orden_pago_id = Number(row.orden_pago_id);
    }

    // 🔵 HABER / EGRESOS
    if (row.tipo_fila === "HABER") {
      let ben = orden.beneficiarios.find(
        (b) => b.id === String(row.beneficiario_id)
      );

      if (!ben) {
        ben = {
          id: String(row.beneficiario_id ?? ""),
          nombre: row.id_beneficiario ?? "Beneficiario no identificado",
          no_cheque: row.no_cheque ?? "",
          haber: 0,
          ejecuciones: [],
        };

        orden.beneficiarios.push(ben);
      }

      const valor = Number(row.haber || 0);

      ben.haber += valor;
      orden.total_haber += valor;
    }

    // 🟢 EJECUCIONES PRESUPUESTARIAS
    if (row.tipo_fila === "EJECUCION") {
      const ejec: Ejecucion = {
        id: String(row.id),
        codigo_presupuestario: row.codigo_presupuestario,
        monto_ejecutado: Number(row.monto_ejecutado || 0),
      };

      let ben: Beneficiario | undefined;

      if (row.beneficiario_id) {
        ben = orden.beneficiarios.find(
          (b) => b.id === String(row.beneficiario_id)
        );
      }

      if (!ben) {
        ben = obtenerBeneficiarioEjecucion(orden);
      }

      ben.ejecuciones.push(ejec);

      orden.total_ejecutado += ejec.monto_ejecutado;
    }
  }

  return Array.from(map.values()).map((o) => ({
    ...o,
    diferencia: o.total_haber - o.total_ejecutado,
  }));
}