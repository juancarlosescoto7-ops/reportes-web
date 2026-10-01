import "server-only";

import { type NextRequest } from "next/server";
import { puedeAccederAuditoria } from "@/modules/auditoria/domain/acceso-auditoria";
import {
  getSupabaseSessionContext,
  jsonWithCookies,
  supabaseRest,
  type SupabaseSessionContext,
} from "@/shared/infrastructure/supabase-server";

export class ErrorRecomendaciones extends Error {
  constructor(message: string, public status = 500) {
    super(message);
  }
}

export async function solicitarDatosAuditoria<T>(
  context: SupabaseSessionContext,
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await supabaseRest(context, path, {
    ...init,
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const code = data?.code;
    const status = code === "40001" ? 409
      : code === "42501" ? 403
        : code === "22023" || code === "23514" ? 400
          : response.status === 401 ? 401 : 500;
    const message = ["40001", "42501", "22023"].includes(code)
      ? data.message : "No se pudieron guardar o consultar las recomendaciones de auditoría.";
    throw new ErrorRecomendaciones(message, status);
  }
  return data as T;
}

export async function autorizarRecomendaciones(request: NextRequest) {
  const session = await getSupabaseSessionContext(request);
  if (!session.ok) return session;

  // La RPC valida el token en Supabase y obtiene los roles desde la base de datos.
  try {
    const permisos = await solicitarDatosAuditoria<{ rol_codigo: string }[]>(
      session.context, "rpc/obtener_mis_permisos", { method: "POST", body: "{}" }
    );
    if (Array.isArray(permisos) && permisos.some((p) => puedeAccederAuditoria(p.rol_codigo))) {
      return session;
    }
    return {
      ok: false as const,
      response: jsonWithCookies(session.context, { error: "No tiene acceso a auditoría." }, { status: 403 }),
    };
  } catch (error) {
    return { ok: false as const, response: responderErrorAuditoria(session.context, error) };
  }
}

export async function leerSolicitudAuditoria(request: NextRequest) {
  if (Number(request.headers.get("content-length")) > 65_536) {
    throw new ErrorRecomendaciones("La solicitud es demasiado grande.", 413);
  }
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > 65_536) {
    throw new ErrorRecomendaciones("La solicitud es demasiado grande.", 413);
  }
  let data: unknown;
  try { data = JSON.parse(raw); } catch {
    throw new ErrorRecomendaciones("La solicitud no contiene JSON válido.", 400);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new ErrorRecomendaciones("La solicitud no es válida.", 400);
  }
  return data as Record<string, unknown>;
}

export function responderErrorAuditoria(context: SupabaseSessionContext, error: unknown) {
  const conocido = error instanceof ErrorRecomendaciones;
  return jsonWithCookies(context, {
    error: conocido ? error.message : "No se pudo completar la operación. Intente nuevamente.",
  }, { status: conocido ? error.status : 500, headers: { "Cache-Control": "no-store" } });
}
