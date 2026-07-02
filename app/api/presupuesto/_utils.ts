import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export type NivelPresupuesto =
  | "Programa"
  | "SubPrograma"
  | "Proyecto"
  | "Actividad"
  | "Obra"
  | "Codigo";

export type SupabaseSessionContext = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  accessToken: string;
  cookieResponse: NextResponse;
};

export const NIVEL_CONFIG: Record<
  Exclude<NivelPresupuesto, "Codigo">,
  {
    table: string;
    parentColumn: string | null;
  }
> = {
  Programa: {
    table: "programas",
    parentColumn: null,
  },
  SubPrograma: {
    table: "subprogramas",
    parentColumn: "programa_id",
  },
  Proyecto: {
    table: "proyectos",
    parentColumn: "sub_programa_id",
  },
  Actividad: {
    table: "actividades",
    parentColumn: "proyecto_id",
  },
  Obra: {
    table: "obras",
    parentColumn: "actividad_id",
  },
};

export function isNivelPresupuesto(value: unknown): value is NivelPresupuesto {
  return (
    value === "Programa" ||
    value === "SubPrograma" ||
    value === "Proyecto" ||
    value === "Actividad" ||
    value === "Obra" ||
    value === "Codigo"
  );
}

export async function getSupabaseSessionContext(
  request: NextRequest
): Promise<
  | { ok: true; context: SupabaseSessionContext }
  | { ok: false; response: NextResponse }
> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Faltan variables de entorno de Supabase." },
        { status: 500 }
      ),
    };
  }

  const cookieResponse = NextResponse.next();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session?.access_token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: sessionError?.message ?? "No hay sesion activa." },
        { status: 401 }
      ),
    };
  }

  return {
    ok: true,
    context: {
      supabaseUrl,
      supabaseAnonKey,
      accessToken: session.access_token,
      cookieResponse,
    },
  };
}

export async function supabaseRest(
  context: SupabaseSessionContext,
  path: string,
  init?: RequestInit
) {
  return fetch(`${context.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: context.supabaseAnonKey,
      Authorization: `Bearer ${context.accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export function withCookies(
  context: SupabaseSessionContext,
  response: NextResponse
) {
  context.cookieResponse.cookies.getAll().forEach((cookie) => {
    response.cookies.set(cookie);
  });

  return response;
}

export function jsonWithCookies(
  context: SupabaseSessionContext,
  body: unknown,
  init?: ResponseInit
) {
  return withCookies(context, NextResponse.json(body, init));
}

export async function readSupabaseJson(response: Response) {
  const text = await response.text();

  if (!text.trim()) return null;

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
