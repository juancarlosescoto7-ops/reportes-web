import { crearClienteSupabase, ejecutarRPC } from "@/lib/supabase";

export type ActualizarIngresoInput = {
  id: string;
  monto: number;
  tipo_ingreso: string;
  cuenta: string;
  fecha_deposito: string;
  motivo: string;
  confirmacion: string;
};

export type ActualizarIngresoResultado = {
  ok: true;
  id: string;
  id_arqueo: string | null;
};

export type IngresoReporte = {
  id_arqueo?: string | number | null;
  id_deposito?: string | number | null;
  fecha_arqueo?: string | null;
  fecha: string | null;
  descripcion: string | null;
  total: number | null;
  bloque: number | null;
  fecha_deposito: string | null;
  monto: number | null;
  tipo_ingreso: string | null;
  cuenta: string | null;
};

export async function obtenerReporteIngresos(): Promise<IngresoReporte[]> {
  const data = await ejecutarRPC("reporte_arqueo_detallado_todos", {});

  return Array.isArray(data) ? (data as IngresoReporte[]) : [];
}

export async function obtenerReporteIngresosEstricto(): Promise<
  IngresoReporte[]
> {
  const limite = 1_000;
  const maximoPaginas = 100;
  const registros: IngresoConArqueo[] = [];
  const supabase = crearClienteSupabase();

  for (let pagina = 0; pagina < maximoPaginas; pagina += 1) {
    const desde = pagina * limite;
    const { data, error, count } = await supabase
      .from("ingresos")
      .select(
        `
          id,
          fecha,
          monto,
          tipo_ingreso,
          cuenta,
          id_arqueo,
          fecha_deposito,
          arqueos!inner (
            id,
            fecha,
            total,
            descripcion
          )
        `,
        { count: "exact" }
      )
      .order("created_at", { ascending: false })
      .range(desde, desde + limite - 1);

    if (error) {
      throw new Error(
        `No se pudieron cargar los ingresos con sus identificadores. ${error.message}`
      );
    }

    if (!Array.isArray(data)) {
      throw new Error("El reporte de ingresos devolvio un formato inesperado.");
    }

    registros.push(...(data as unknown as IngresoConArqueo[]));

    if (
      data.length < limite ||
      (count !== null && Number.isFinite(count) && registros.length >= count)
    ) {
      return convertirIngresosReporte(registros);
    }
  }

  throw new Error(
    "El reporte de ingresos supera el límite seguro de 100,000 registros."
  );
}

type ArqueoRelacionado = {
  id: string | number;
  fecha: string | null;
  total: number | null;
  descripcion: string | null;
};

type IngresoConArqueo = {
  id: string | number;
  fecha: string | null;
  monto: number | null;
  tipo_ingreso: string | null;
  cuenta: string | null;
  id_arqueo: string | number | null;
  fecha_deposito: string | null;
  arqueos: ArqueoRelacionado | ArqueoRelacionado[] | null;
};

function obtenerArqueoRelacionado(
  value: IngresoConArqueo["arqueos"]
): ArqueoRelacionado | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function convertirIngresosReporte(
  registros: IngresoConArqueo[]
): IngresoReporte[] {
  const bloquesPorArqueo = new Map<string, number>();

  return registros.map((ingreso) => {
    const arqueo = obtenerArqueoRelacionado(ingreso.arqueos);
    const idArqueo = ingreso.id_arqueo ?? arqueo?.id ?? null;
    const arqueoKey = String(idArqueo ?? "sin-arqueo");
    const bloque = (bloquesPorArqueo.get(arqueoKey) ?? 0) + 1;
    bloquesPorArqueo.set(arqueoKey, bloque);

    return {
      id_arqueo: idArqueo,
      id_deposito: ingreso.id,
      fecha_arqueo: arqueo?.fecha ?? null,
      fecha: arqueo?.fecha ?? ingreso.fecha,
      descripcion: arqueo?.descripcion ?? null,
      total: arqueo?.total ?? null,
      bloque,
      fecha_deposito: ingreso.fecha_deposito,
      monto: ingreso.monto,
      tipo_ingreso: ingreso.tipo_ingreso,
      cuenta: ingreso.cuenta,
    };
  });
}

async function obtenerDetalleError(response: Response) {
  const data: unknown = await response.json().catch(() => null);

  if (data && typeof data === "object") {
    const detalle = data as {
      code?: unknown;
      message?: unknown;
      error?: unknown;
      details?: unknown;
    };

    if (detalle.code === "PGRST202") {
      return "La función de corrección aún no está instalada en Supabase. Ejecute sql/actualizar_ingreso.sql y vuelva a intentarlo.";
    }

    for (const value of [
      detalle.message,
      detalle.error,
      detalle.details,
    ]) {
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }

  return `La solicitud fue rechazada (${response.status}).`;
}

export async function actualizarIngreso(
  input: ActualizarIngresoInput
): Promise<ActualizarIngresoResultado> {
  const response = await fetch("/api/supabase/rpc/actualizar_ingreso", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      p_id: input.id,
      p_monto: Number(input.monto),
      p_tipo_ingreso: input.tipo_ingreso.trim(),
      p_cuenta: input.cuenta.trim(),
      p_fecha_deposito: input.fecha_deposito,
      p_motivo: input.motivo.trim(),
      p_confirmacion: input.confirmacion.trim(),
    }),
  });

  if (!response.ok) {
    throw new Error(await obtenerDetalleError(response));
  }

  const data: unknown = await response.json();

  if (
    !data ||
    typeof data !== "object" ||
    (data as { ok?: unknown }).ok !== true
  ) {
    throw new Error("La corrección no devolvió una confirmación válida.");
  }

  const resultado = data as {
    id?: unknown;
    id_arqueo?: unknown;
  };

  return {
    ok: true,
    id: String(resultado.id ?? input.id),
    id_arqueo:
      resultado.id_arqueo === null || resultado.id_arqueo === undefined
        ? null
        : String(resultado.id_arqueo),
  };
}
