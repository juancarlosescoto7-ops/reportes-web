import { type NextRequest } from "next/server";
import { MAX_RECOMENDACIONES_AUDITORIA, type RecomendacionAuditoria } from "@/modules/auditoria/domain/recomendaciones-auditoria";
import { autorizarRecomendaciones, ErrorRecomendaciones, leerSolicitudAuditoria, responderErrorAuditoria, solicitarDatosAuditoria } from "@/modules/auditoria/services/recomendaciones.server";
import { jsonWithCookies } from "@/shared/infrastructure/supabase-server";

export async function GET(request: NextRequest) {
  const session = await autorizarRecomendaciones(request);
  if (!session.ok) return session.response;
  try {
    const noOrden = Number(request.nextUrl.searchParams.get("noOrden"));
    if (!Number.isSafeInteger(noOrden) || noOrden <= 0) {
      throw new ErrorRecomendaciones("Indique una orden válida.", 400);
    }
    const filas = await solicitarDatosAuditoria<RecomendacionAuditoria[]>(session.context,
      `auditoria_recomendaciones?no_orden=eq.${noOrden}&select=*`);
    return jsonWithCookies(session.context, { recomendacion: filas[0] ?? null },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return responderErrorAuditoria(session.context, error);
  }
}

export async function POST(request: NextRequest) {
  const session = await autorizarRecomendaciones(request);
  if (!session.ok) return session.response;
  try {
    const body = await leerSolicitudAuditoria(request);
    if (typeof body.noOrden !== "number" || !Number.isSafeInteger(body.noOrden) || body.noOrden <= 0 ||
      typeof body.recomendaciones !== "string" || body.recomendaciones.length > MAX_RECOMENDACIONES_AUDITORIA ||
      typeof body.version !== "number" || !Number.isSafeInteger(body.version) || body.version < 0) {
      throw new ErrorRecomendaciones("Indique una orden válida y recomendaciones de hasta 10,000 caracteres.", 400);
    }
    const recomendacion = await solicitarDatosAuditoria<RecomendacionAuditoria>(
      session.context, "rpc/auditoria_guardar_recomendacion", {
        method: "POST",
        body: JSON.stringify({ p_no_orden: body.noOrden, p_recomendaciones: body.recomendaciones.trim(), p_version: body.version }),
      }
    );
    return jsonWithCookies(session.context, { recomendacion }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return responderErrorAuditoria(session.context, error);
  }
}
