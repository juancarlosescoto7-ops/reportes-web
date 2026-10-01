import { type NextRequest } from "next/server";
// Las recomendaciones y sus permisos pertenecen al módulo de auditoría.
import { esMesAuditoria, INSTRUCCIONES_RESUMEN_AUDITORIA, VERSION_INFORME_AUDITORIA, type ContextoMensualAuditoria, type ResumenMensualAuditoria } from "@/modules/auditoria/domain/recomendaciones-auditoria";
import { autorizarRecomendaciones, ErrorRecomendaciones, leerSolicitudAuditoria, responderErrorAuditoria, solicitarDatosAuditoria } from "@/modules/auditoria/services/recomendaciones.server";
import { jsonWithCookies, type SupabaseSessionContext } from "@/shared/infrastructure/supabase-server";

async function obtenerContexto(context: SupabaseSessionContext, mes: unknown) {
  if (!esMesAuditoria(mes)) throw new ErrorRecomendaciones("Seleccione un mes válido (AAAA-MM).", 400);
  const contexto = await solicitarDatosAuditoria<ContextoMensualAuditoria>(context, "rpc/auditoria_contexto_mensual", {
    method: "POST", body: JSON.stringify({ p_mes: `${mes}-01` }),
  });
  return {
    ...contexto,
    desactualizado: contexto.desactualizado || Boolean(contexto.resumen &&
      (contexto.resumen.version_informe ?? 1) < VERSION_INFORME_AUDITORIA),
  };
}

export async function GET(request: NextRequest) {
  const session = await autorizarRecomendaciones(request);
  if (!session.ok) return session.response;
  try {
    const contexto = await obtenerContexto(session.context, request.nextUrl.searchParams.get("mes"));
    return jsonWithCookies(session.context, contexto, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return responderErrorAuditoria(session.context, error);
  }
}

type RespuestaModelo = {
  status?: string;
  model?: string;
  usage?: Record<string, unknown>;
  output?: { type?: string; content?: { type?: string; text?: string }[] }[];
};

export async function POST(request: NextRequest) {
  const session = await autorizarRecomendaciones(request);
  if (!session.ok) return session.response;
  try {
    const body = await leerSolicitudAuditoria(request);
    const contexto = await obtenerContexto(session.context, body.mes);
    if (!contexto.fuentes.length) {
      throw new ErrorRecomendaciones("Guarde al menos una recomendación en una orden de este mes antes de generar el resumen.", 400);
    }
    // Reutiliza la última generación si sus fuentes siguen vigentes.
    if (contexto.resumen && !contexto.desactualizado) {
      return jsonWithCookies(session.context, contexto, { headers: { "Cache-Control": "no-store" } });
    }
    if (!process.env.OPENAI_API_KEY) {
      throw new ErrorRecomendaciones("El servicio de informes no está configurado. Contacte al administrador del sistema.", 503);
    }
    const input = JSON.stringify({
      mes: contexto.mes,
      total_ordenes_mes: contexto.total_ordenes,
      ordenes_con_recomendaciones: contexto.fuentes.length,
      ordenes: contexto.fuentes,
    });
    // Nunca recorta ni omite recomendaciones para hacer caber un mes.
    if (new TextEncoder().encode(input).byteLength > 300_000) {
      throw new ErrorRecomendaciones("Las recomendaciones de este mes superan la capacidad de una generación. No se generó un resumen parcial.", 413);
    }
    const modelo = process.env.OPENAI_AUDITORIA_MODEL ?? "gpt-5.6-luna";
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: modelo,
        store: false,
        instructions: INSTRUCCIONES_RESUMEN_AUDITORIA,
        input,
        reasoning: { effort: "medium" },
        max_output_tokens: 8_000,
      }),
      signal: AbortSignal.timeout(150_000),
    });
    const data = await response.json().catch(() => null) as RespuestaModelo | null;
    if (!response.ok) {
      throw new ErrorRecomendaciones(response.status === 429
        ? "El servicio de informes alcanzó su límite de uso. Intente más tarde o contacte al administrador."
        : "No se pudieron preparar las recomendaciones generales. Intente nuevamente.", response.status === 429 ? 429 : 502);
    }
    if (data?.status !== "completed") {
      throw new ErrorRecomendaciones("No se completaron las recomendaciones generales. Intente nuevamente; no se guardó contenido parcial.", 502);
    }
    const resumen = (data.output ?? [])
      .filter((item) => item.type === "message")
      .flatMap((item) => item.content ?? [])
      .filter((item) => item.type === "output_text" && typeof item.text === "string")
      .map((item) => item.text).join("\n").trim();
    if (!resumen || resumen.length > 50_000) {
      throw new ErrorRecomendaciones("No se obtuvieron recomendaciones generales válidas. Intente nuevamente.", 502);
    }
    // El trigger compara las fuentes actuales con la huella y conserva su copia exacta.
    const guardados = await solicitarDatosAuditoria<ResumenMensualAuditoria[]>(
      session.context, "auditoria_resumenes_mensuales", {
        method: "POST", headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          mes: `${contexto.mes}-01`, resumen,
          huella_fuentes: contexto.huella_fuentes,
          fuentes: contexto.fuentes, total_ordenes: contexto.total_ordenes,
          modelo: data.model ?? modelo, uso_tokens: data.usage ?? {},
          version_informe: VERSION_INFORME_AUDITORIA,
        }),
      }
    );
    if (!guardados[0]) throw new ErrorRecomendaciones("No se pudo guardar el resumen generado.");
    return jsonWithCookies(session.context, { ...contexto, resumen: guardados[0], desactualizado: false },
      { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      return responderErrorAuditoria(session.context, new ErrorRecomendaciones("La generación tardó demasiado. Intente nuevamente.", 504));
    }
    return responderErrorAuditoria(session.context, error);
  }
}
