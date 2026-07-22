import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ nombreRPC: string }> }
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Faltan variables de entorno de Supabase." },
      { status: 500 }
    );
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
    return NextResponse.json(
      { error: sessionError?.message ?? "No hay sesión activa." },
      { status: 401 }
    );
  }

  const { nombreRPC } = await context.params;
  const payload = await request.json().catch(() => ({}));
  const rangeSolicitado = request.headers.get("range") ?? "";
  const rangeValido = rangeSolicitado.match(/^(\d+)-(\d+)$/);
  const rangeDesde = Number(rangeValido?.[1]);
  const rangeHasta = Number(rangeValido?.[2]);
  const range =
    rangeValido &&
    rangeDesde >= 0 &&
    rangeHasta >= rangeDesde &&
    rangeHasta - rangeDesde < 1_000 &&
    rangeHasta < 100_000
      ? rangeSolicitado
      : "0-5000";

  const supabaseResponse = await fetch(
    `${supabaseUrl}/rest/v1/rpc/${nombreRPC}`,
    {
      method: "POST",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        "Range-Unit": "items",
        Range: range,
        Prefer: "count=exact",
      },
      body: JSON.stringify(payload),
    }
  );

  const text = await supabaseResponse.text();
  const respuestaSinCuerpo = [204, 205, 304].includes(
    supabaseResponse.status
  );

  const finalResponse = new NextResponse(respuestaSinCuerpo ? null : text, {
    status: supabaseResponse.status,
    headers: {
      ...(!respuestaSinCuerpo
        ? {
            "Content-Type":
              supabaseResponse.headers.get("Content-Type") ??
              "application/json",
          }
        : {}),
      ...(supabaseResponse.headers.get("Content-Range")
        ? { "Content-Range": supabaseResponse.headers.get("Content-Range")! }
        : {}),
    },
  });

  cookieResponse.cookies.getAll().forEach((cookie) => {
    finalResponse.cookies.set(cookie);
  });

  return finalResponse;
}
