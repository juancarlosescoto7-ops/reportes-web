export type DepositoArqueoInput = {
  monto: number;
  tipo_ingreso: string;
  cuenta: string;
  fecha_deposito: string;
};

export type CrearArqueoInput = {
  fecha: string;
  descripcion: string;
  depositos: DepositoArqueoInput[];
};

export async function eliminarArqueoCompleto(input: {
  id: string;
  motivo: string;
  confirmacion: string;
}): Promise<void> {
  const response = await fetch("/api/supabase/rpc/eliminar_arqueo_con_depositos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      p_id: input.id,
      p_motivo: input.motivo.trim(),
      p_confirmacion: input.confirmacion.trim(),
    }),
  });
  const data: unknown = await response.json().catch(() => null);
  const resultado = data && typeof data === "object"
    ? data as { ok?: unknown; id_arqueo?: unknown; message?: unknown; error?: unknown }
    : null;

  if (!response.ok) {
    const detalle = resultado?.message ?? resultado?.error;
    throw new Error(typeof detalle === "string"
      ? detalle
      : `No se pudo eliminar el arqueo (${response.status}).`);
  }
  if (resultado?.ok !== true || resultado.id_arqueo !== input.id) {
    throw new Error("No se pudo confirmar la eliminación. Actualice el reporte antes de volver a intentarlo.");
  }
}

async function obtenerDetalleErrorCrearArqueo(response: Response) {
  const data: unknown = await response.json().catch(() => null);

  if (data && typeof data === "object") {
    const detalle = data as {
      code?: unknown;
      message?: unknown;
      error?: unknown;
      details?: unknown;
    };

    if (detalle.code === "PGRST202") {
      return "La función del módulo de arqueos aún no está instalada en Supabase. Ejecute modules/arqueos/database/arqueos_solo_depositos.sql y vuelva a intentarlo.";
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

  return `No se pudo registrar el arqueo (${response.status}).`;
}

export async function crearArqueoCompleto(
  input: CrearArqueoInput
): Promise<string> {
  const response = await fetch(
    "/api/supabase/rpc/crear_arqueo_con_depositos",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_fecha: input.fecha,
        p_descripcion: input.descripcion,
        p_depositos: input.depositos.map((deposito) => ({
          monto: Number(deposito.monto),
          tipo_ingreso: deposito.tipo_ingreso,
          cuenta: deposito.cuenta,
          fecha_deposito: deposito.fecha_deposito,
        })),
      }),
    }
  );

  if (!response.ok) {
    throw new Error(await obtenerDetalleErrorCrearArqueo(response));
  }

  const data: unknown = await response.json();

  if (typeof data === "string") {
    return data;
  }

  if (Array.isArray(data)) {
    return String(data[0] ?? "");
  }

  if (data && typeof data === "object") {
    const resultado = data as {
      id?: unknown;
      crear_arqueo_con_depositos?: unknown;
      resultado?: unknown;
    };

    return String(
      resultado.id ??
        resultado.crear_arqueo_con_depositos ??
        resultado.resultado ??
        ""
    );
  }

  return "";
}
