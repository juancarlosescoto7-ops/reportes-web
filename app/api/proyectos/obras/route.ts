import type { NextRequest } from "next/server";

import {
  getSupabaseSessionContext,
  jsonWithCookies,
  readSupabaseJson,
  supabaseRest,
} from "@/app/api/presupuesto/_utils";
import {
  normalizarIdProyecto,
  normalizarObrasPresupuesto,
  validarCrearProyectoPayload,
} from "@/lib/proyectos";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const sessionResult = await getSupabaseSessionContext(request);

  if (!sessionResult.ok) return sessionResult.response;

  const { context } = sessionResult;
  const response = await supabaseRest(
    context,
    "obras?select=id,nombre,actividad_id&nombre=not.is.null&order=nombre.asc",
    {
      headers: {
        "Range-Unit": "items",
        Range: "0-4999",
      },
    }
  );
  const payload = await readSupabaseJson(response);

  if (!response.ok) {
    return jsonWithCookies(
      context,
      {
        error: obtenerMensajeError(
          payload,
          "No se pudieron consultar las obras del presupuesto."
        ),
      },
      { status: response.status }
    );
  }

  return jsonWithCookies(context, {
    obras: normalizarObrasPresupuesto(payload),
  });
}

export async function POST(request: NextRequest) {
  const sessionResult = await getSupabaseSessionContext(request);

  if (!sessionResult.ok) return sessionResult.response;

  const { context } = sessionResult;
  const body = await request.json().catch(() => null);
  const validacion = validarCrearProyectoPayload(body);

  if (!validacion.ok) {
    return jsonWithCookies(
      context,
      { error: validacion.error },
      { status: 400 }
    );
  }

  const response = await supabaseRest(context, "rpc/crear_proyecto_completo", {
    method: "POST",
    body: JSON.stringify({
      p_nombre_proyecto: validacion.payload.nombreProyecto,
      p_codigos: validacion.payload.codigos,
    }),
  });
  const payload = await readSupabaseJson(response);

  if (!response.ok) {
    return jsonWithCookies(
      context,
      {
        error: obtenerMensajeError(payload, "No se pudo crear el proyecto."),
      },
      { status: response.status }
    );
  }

  const idProyecto = normalizarIdProyecto(payload);

  if (!idProyecto) {
    return jsonWithCookies(
      context,
      { error: "El proyecto fue procesado, pero no devolvió un ID válido." },
      { status: 502 }
    );
  }

  return jsonWithCookies(
    context,
    { idProyecto },
    { status: 201 }
  );
}

function obtenerMensajeError(payload: unknown, fallback: string) {
  if (payload && typeof payload === "object") {
    const row = payload as Record<string, unknown>;
    const message = row.message ?? row.error ?? row.details;

    if (typeof message === "string" && message.trim()) {
      return message;
    }
  }

  return fallback;
}
