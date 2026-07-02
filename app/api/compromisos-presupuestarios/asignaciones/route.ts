import { type NextRequest } from "next/server";
import {
  getSupabaseSessionContext,
  jsonWithCookies,
  readSupabaseJson,
  supabaseRest,
} from "@/app/api/presupuesto/_utils";

export const dynamic = "force-dynamic";

type CompromisoInput = {
  codigo_presupuestario?: unknown;
  actividad_id?: unknown;
  proyecto_id?: unknown;
  monto_ejecutado?: unknown;
  fecha_ejecucion?: unknown;
  ejercicio_fiscal?: unknown;
  usuario_registro?: unknown;
};

type ActualizarBody = {
  id?: unknown;
  no_cxp?: unknown;
  tipo_movimiento?: unknown;
  compromiso?: unknown;
};

function cleanString(value: unknown) {
  const text = String(value ?? "").trim();

  return text || null;
}

function cleanNumber(value: unknown) {
  const number = Number(value);

  return Number.isFinite(number) ? number : Number.NaN;
}

function cleanInteger(value: unknown) {
  const number = Number(value);

  return Number.isFinite(number) ? Math.trunc(number) : null;
}

function normalizeCompromiso(input: CompromisoInput) {
  const codigo = cleanString(input.codigo_presupuestario);
  const monto = cleanNumber(input.monto_ejecutado);

  if (!codigo) {
    throw new Error("El compromiso debe tener codigo presupuestario.");
  }

  if (!Number.isFinite(monto) || monto <= 0) {
    throw new Error("El compromiso debe tener monto mayor a cero.");
  }

  return {
    codigo_presupuestario: codigo,
    actividad_id: cleanString(input.actividad_id),
    proyecto_id: cleanString(input.proyecto_id),
    monto_ejecutado: monto,
    fecha_ejecucion: cleanString(input.fecha_ejecucion),
    ejercicio_fiscal: cleanInteger(input.ejercicio_fiscal) ?? 2026,
    usuario_registro: cleanString(input.usuario_registro) ?? "sistema",
  };
}

export async function GET(request: NextRequest) {
  const session = await getSupabaseSessionContext(request);

  if (!session.ok) return session.response;

  const { searchParams } = new URL(request.url);
  const noCxp = Number(searchParams.get("noCxp"));
  const tipoMovimiento = searchParams.get("tipoMovimiento") ?? "";

  if (!Number.isFinite(noCxp) || noCxp <= 0) {
    return jsonWithCookies(
      session.context,
      { error: "CxP invalida." },
      { status: 400 }
    );
  }

  const response = await supabaseRest(
    session.context,
    [
      "compromisos_presupuestarios",
      "?select=id,cxp_id,tipo_compromiso,codigo_presupuestario,actividad_id,proyecto_id,monto_ejecutado,fecha_ejecucion,ejercicio_fiscal,usuario_registro",
      `&cxp_id=eq.${encodeURIComponent(String(noCxp))}`,
      `&tipo_compromiso=eq.${encodeURIComponent(tipoMovimiento)}`,
      "&order=id.asc",
    ].join(""),
    { method: "GET" }
  );

  const data = await readSupabaseJson(response);

  if (!response.ok) {
    return jsonWithCookies(
      session.context,
      { error: "No se pudieron cargar los compromisos.", detalle: data },
      { status: response.status }
    );
  }

  return jsonWithCookies(session.context, Array.isArray(data) ? data : []);
}

export async function PATCH(request: NextRequest) {
  const session = await getSupabaseSessionContext(request);

  if (!session.ok) return session.response;

  const body = (await request.json().catch(() => ({}))) as ActualizarBody;
  const id = cleanString(body.id);
  const noCxp = Number(body.no_cxp);
  const tipoMovimiento = cleanString(body.tipo_movimiento) ?? "";

  if (!id) {
    return jsonWithCookies(
      session.context,
      { error: "Compromiso invalido." },
      { status: 400 }
    );
  }

  if (!Number.isFinite(noCxp) || noCxp <= 0) {
    return jsonWithCookies(
      session.context,
      { error: "CxP invalida." },
      { status: 400 }
    );
  }

  if (!body.compromiso || typeof body.compromiso !== "object") {
    return jsonWithCookies(
      session.context,
      { error: "Debe enviar el compromiso presupuestario." },
      { status: 400 }
    );
  }

  let payload: ReturnType<typeof normalizeCompromiso>;

  try {
    payload = normalizeCompromiso(body.compromiso as CompromisoInput);
  } catch (error) {
    return jsonWithCookies(
      session.context,
      {
        error:
          error instanceof Error
            ? error.message
            : "Compromiso presupuestario invalido.",
      },
      { status: 400 }
    );
  }

  const response = await supabaseRest(
    session.context,
    [
      "compromisos_presupuestarios",
      `?id=eq.${encodeURIComponent(id)}`,
      `&cxp_id=eq.${encodeURIComponent(String(noCxp))}`,
      `&tipo_compromiso=eq.${encodeURIComponent(tipoMovimiento)}`,
    ].join(""),
    {
      method: "PATCH",
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
      { error: "No se pudo actualizar el compromiso.", detalle: data },
      { status: response.status }
    );
  }

  if (Array.isArray(data) && data.length === 0) {
    return jsonWithCookies(
      session.context,
      { error: "No se encontro el compromiso seleccionado." },
      { status: 404 }
    );
  }

  return jsonWithCookies(session.context, {
    id,
    no_cxp: noCxp,
    tipo_movimiento: tipoMovimiento,
    data,
  });
}
