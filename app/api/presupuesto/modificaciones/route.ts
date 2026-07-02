import { type NextRequest } from "next/server";
import {
  getSupabaseSessionContext,
  jsonWithCookies,
  readSupabaseJson,
  type SupabaseSessionContext,
  supabaseRest,
} from "../_utils";

export const dynamic = "force-dynamic";

type ModificacionInput = {
  codigo?: unknown;
  ampliacion?: unknown;
  disminucion?: unknown;
};

type ModificacionesBody = {
  descripcion?: unknown;
  modificaciones?: ModificacionInput[];
};

type UltimoNumeroResponse = {
  ultimo_numero?: number | string | null;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function toNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return 0;

  const parsed = Number(String(value).replace(/,/g, "").trim());

  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

async function obtenerSiguienteNumeroModificacion(
  context: SupabaseSessionContext
) {
  const response = await supabaseRest(
    context,
    "rpc/obtener_ultimo_id_modificacion",
    {
      method: "POST",
      body: "{}",
    }
  );

  const data = await readSupabaseJson(response);

  if (!response.ok) {
    throw new Error(
      `No se pudo obtener el numero de modificacion: ${JSON.stringify(
        data ?? {}
      )}`
    );
  }

  const row = Array.isArray(data)
    ? (data[0] as UltimoNumeroResponse | undefined)
    : (data as UltimoNumeroResponse | null);

  const ultimo = Number(row?.ultimo_numero ?? 0);

  return (Number.isFinite(ultimo) ? ultimo : 0) + 1;
}

export async function POST(request: NextRequest) {
  const session = await getSupabaseSessionContext(request);

  if (!session.ok) return session.response;

  const body = (await request.json().catch(() => ({}))) as ModificacionesBody;
  const descripcion = clean(body.descripcion);
  const modificaciones = Array.isArray(body.modificaciones)
    ? body.modificaciones
    : [];

  if (!descripcion) {
    return jsonWithCookies(
      session.context,
      { error: "Debe ingresar una descripcion." },
      { status: 400 }
    );
  }

  if (modificaciones.length === 0) {
    return jsonWithCookies(
      session.context,
      { error: "No hay modificaciones para registrar." },
      { status: 400 }
    );
  }

  const rows = modificaciones.map((item) => {
    const codigo = clean(item.codigo);
    const ampliacion = toNumber(item.ampliacion);
    const disminucion = toNumber(item.disminucion);

    return {
      codigo,
      ampliacion,
      disminucion,
    };
  });

  const invalid = rows.find(
    (row) =>
      !row.codigo ||
      !Number.isFinite(row.ampliacion) ||
      !Number.isFinite(row.disminucion) ||
      row.ampliacion < 0 ||
      row.disminucion < 0 ||
      (row.ampliacion === 0 && row.disminucion === 0)
  );

  if (invalid) {
    return jsonWithCookies(
      session.context,
      {
        error:
          "Cada modificacion debe tener codigo y monto mayor a cero en ampliacion o disminucion.",
      },
      { status: 400 }
    );
  }

  let idModificacion = 0;

  try {
    idModificacion = await obtenerSiguienteNumeroModificacion(session.context);
  } catch (error) {
    return jsonWithCookies(
      session.context,
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo obtener el numero de modificacion.",
      },
      { status: 500 }
    );
  }

  const payload = rows.map((row) => ({
    descripcion,
    codigo: row.codigo,
    ampliacion: row.ampliacion,
    disminucion: row.disminucion,
    id_modificacion: idModificacion,
  }));

  const response = await supabaseRest(
    session.context,
    "modificaciones_presupuestarias",
    {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    }
  );

  const data = await readSupabaseJson(response);

  if (!response.ok) {
    return jsonWithCookies(
      session.context,
      {
        error: "No se pudieron registrar las modificaciones presupuestarias.",
        detalle: data,
      },
      { status: response.status }
    );
  }

  return jsonWithCookies(session.context, {
    idModificacion,
    registros: payload.length,
    data,
  });
}
