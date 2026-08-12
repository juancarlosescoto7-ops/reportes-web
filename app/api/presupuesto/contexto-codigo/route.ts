import { type NextRequest } from "next/server";
import {
  getSupabaseSessionContext,
  jsonWithCookies,
  readSupabaseJson,
  supabaseRest,
} from "../_utils";

export const dynamic = "force-dynamic";

const MAX_CONTEXTO_LENGTH = 2000;

type ActualizarContextoBody = {
  codigo?: unknown;
  contexto?: unknown;
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

export async function GET(request: NextRequest) {
  const session = await getSupabaseSessionContext(request);

  if (!session.ok) return session.response;

  const response = await supabaseRest(
    session.context,
    "codigos_presupuesto?select=codigo,contexto_cxp&order=codigo.asc",
    { method: "GET", cache: "no-store" }
  );
  const data = await readSupabaseJson(response);

  if (!response.ok) {
    return jsonWithCookies(
      session.context,
      { error: "No se pudieron consultar los contextos presupuestarios.", detalle: data },
      { status: response.status }
    );
  }

  return jsonWithCookies(session.context, Array.isArray(data) ? data : []);
}

export async function PATCH(request: NextRequest) {
  const session = await getSupabaseSessionContext(request);

  if (!session.ok) return session.response;

  const body = (await request.json().catch(() => null)) as
    | ActualizarContextoBody
    | null;
  const codigo = clean(body?.codigo);
  const contexto = clean(body?.contexto);

  if (!codigo) {
    return jsonWithCookies(
      session.context,
      { error: "Debe indicar el codigo presupuestario." },
      { status: 400 }
    );
  }

  if (contexto.length > MAX_CONTEXTO_LENGTH) {
    return jsonWithCookies(
      session.context,
      { error: `El contexto no puede exceder ${MAX_CONTEXTO_LENGTH} caracteres.` },
      { status: 400 }
    );
  }

  const path =
    "codigos_presupuesto?codigo=eq." +
    encodeURIComponent(codigo) +
    "&select=codigo,contexto_cxp";
  const response = await supabaseRest(session.context, path, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ contexto_cxp: contexto || null }),
  });
  const data = await readSupabaseJson(response);

  if (!response.ok) {
    return jsonWithCookies(
      session.context,
      { error: "No se pudo guardar el contexto presupuestario.", detalle: data },
      { status: response.status }
    );
  }

  if (!Array.isArray(data) || data.length === 0) {
    return jsonWithCookies(
      session.context,
      { error: "No se encontro el codigo presupuestario." },
      { status: 404 }
    );
  }

  return jsonWithCookies(session.context, data[0]);
}
