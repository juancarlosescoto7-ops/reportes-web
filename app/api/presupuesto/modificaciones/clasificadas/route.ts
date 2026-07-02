import { type NextRequest } from "next/server";
import {
  getSupabaseSessionContext,
  jsonWithCookies,
  readSupabaseJson,
  supabaseRest,
} from "../../_utils";

export const dynamic = "force-dynamic";

function clean(value: string | null) {
  const trimmed = String(value ?? "").trim();

  return trimmed || null;
}

function cleanDate(value: string | null) {
  const trimmed = clean(value);

  if (!trimmed) return null;

  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function cleanNumber(value: string | null) {
  const trimmed = clean(value);

  if (!trimmed) return null;

  const parsed = Number(trimmed);

  return Number.isFinite(parsed) ? parsed : null;
}

export async function GET(request: NextRequest) {
  const session = await getSupabaseSessionContext(request);

  if (!session.ok) return session.response;

  const params = request.nextUrl.searchParams;
  const payload = {
    p_busqueda: clean(params.get("busqueda")),
    p_fecha_desde: cleanDate(params.get("fechaDesde")),
    p_fecha_hasta: cleanDate(params.get("fechaHasta")),
    p_fuente: clean(params.get("fuente")),
    p_tipo_inversion: clean(params.get("tipoInversion")),
    p_id_modificacion: cleanNumber(params.get("idModificacion")),
  };

  const response = await supabaseRest(
    session.context,
    "rpc/rpc_modificaciones_presupuestarias_clasificadas",
    {
      method: "POST",
      body: JSON.stringify(payload),
    }
  );
  const data = await readSupabaseJson(response);

  if (!response.ok) {
    return jsonWithCookies(
      session.context,
      {
        error: "No se pudo consultar el resumen de modificaciones.",
        detalle: data,
      },
      { status: response.status }
    );
  }

  return jsonWithCookies(session.context, Array.isArray(data) ? data : []);
}
