import { type NextRequest } from "next/server";
import {
  getSupabaseSessionContext,
  jsonWithCookies,
  readSupabaseJson,
  supabaseRest,
} from "@/app/api/presupuesto/_utils";

export const dynamic = "force-dynamic";

type AsignacionInput = {
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
  orden_pago_id?: unknown;
  asignacion?: unknown;
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

function normalizeAsignacion(
  ordenPagoId: number,
  asignacion: AsignacionInput
) {
  const codigo = cleanString(asignacion.codigo_presupuestario);
  const monto = cleanNumber(asignacion.monto_ejecutado);

  if (!codigo) {
    throw new Error("Todas las asignaciones deben tener codigo presupuestario.");
  }

  if (!Number.isFinite(monto) || monto <= 0) {
    throw new Error("Todas las asignaciones deben tener monto mayor a cero.");
  }

  return {
    orden_pago_id: ordenPagoId,
    codigo_presupuestario: codigo,
    actividad_id: cleanString(asignacion.actividad_id),
    proyecto_id: cleanString(asignacion.proyecto_id),
    monto_ejecutado: monto,
    fecha_ejecucion: cleanString(asignacion.fecha_ejecucion),
    ejercicio_fiscal: cleanInteger(asignacion.ejercicio_fiscal),
    usuario_registro: cleanString(asignacion.usuario_registro) ?? "sistema",
  };
}

export async function GET(request: NextRequest) {
  const session = await getSupabaseSessionContext(request);

  if (!session.ok) return session.response;

  const { searchParams } = new URL(request.url);
  const ordenPagoId = Number(searchParams.get("ordenPagoId"));

  if (!Number.isFinite(ordenPagoId) || ordenPagoId <= 0) {
    return jsonWithCookies(
      session.context,
      { error: "Orden de pago invalida." },
      { status: 400 }
    );
  }

  const response = await supabaseRest(
    session.context,
    [
      "ejecuciones_presupuestarias",
      "?select=id,orden_pago_id,codigo_presupuestario,actividad_id,proyecto_id,monto_ejecutado,fecha_ejecucion,ejercicio_fiscal,usuario_registro",
      `&orden_pago_id=eq.${encodeURIComponent(String(ordenPagoId))}`,
      "&order=id.asc",
    ].join(""),
    { method: "GET" }
  );

  const data = await readSupabaseJson(response);

  if (!response.ok) {
    return jsonWithCookies(
      session.context,
      { error: "No se pudieron cargar las asignaciones.", detalle: data },
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
  const ordenPagoId = Number(body.orden_pago_id);

  if (!id) {
    return jsonWithCookies(
      session.context,
      { error: "Asignacion invalida." },
      { status: 400 }
    );
  }

  if (!Number.isFinite(ordenPagoId) || ordenPagoId <= 0) {
    return jsonWithCookies(
      session.context,
      { error: "Orden de pago invalida." },
      { status: 400 }
    );
  }

  if (!body.asignacion || typeof body.asignacion !== "object") {
    return jsonWithCookies(
      session.context,
      { error: "Debe enviar la asignacion presupuestaria." },
      { status: 400 }
    );
  }

  let payload: ReturnType<typeof normalizeAsignacion>;

  try {
    payload = normalizeAsignacion(ordenPagoId, body.asignacion as AsignacionInput);
  } catch (error) {
    return jsonWithCookies(
      session.context,
      {
        error:
          error instanceof Error
            ? error.message
            : "Asignaciones presupuestarias invalidas.",
      },
      { status: 400 }
    );
  }

  const updateResponse = await supabaseRest(
    session.context,
    [
      "ejecuciones_presupuestarias",
      `?id=eq.${encodeURIComponent(id)}`,
      `&orden_pago_id=eq.${encodeURIComponent(String(ordenPagoId))}`,
    ].join(""),
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify(payload),
    }
  );

  const updateData = await readSupabaseJson(updateResponse);

  if (!updateResponse.ok) {
    return jsonWithCookies(
      session.context,
      {
        error: "No se pudo actualizar la asignacion presupuestaria.",
        detalle: updateData,
      },
      { status: updateResponse.status }
    );
  }

  if (Array.isArray(updateData) && updateData.length === 0) {
    return jsonWithCookies(
      session.context,
      { error: "No se encontro la asignacion seleccionada." },
      { status: 404 }
    );
  }

  return jsonWithCookies(session.context, {
    orden_pago_id: ordenPagoId,
    id,
    data: updateData,
  });
}
