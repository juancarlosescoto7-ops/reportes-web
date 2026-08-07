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
      return "La función del módulo de arqueos aún no está instalada en Supabase. Ejecute sql/arqueos_solo_depositos.sql y vuelva a intentarlo.";
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
