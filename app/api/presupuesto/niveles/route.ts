import { type NextRequest } from "next/server";
import {
  getSupabaseSessionContext,
  isNivelPresupuesto,
  jsonWithCookies,
  NIVEL_CONFIG,
  readSupabaseJson,
  supabaseRest,
} from "../_utils";

export const dynamic = "force-dynamic";

type NivelRow = {
  id?: string | number | null;
  nombre?: string | null;
  codigo?: string | null;
  objeto?: string | null;
};

function normalizeRows(data: unknown, nivel: string) {
  if (!Array.isArray(data)) return [];

  return data.map((row: NivelRow) => {
    if (nivel === "Codigo") {
      const codigo = String(row.codigo ?? row.id ?? "").trim();
      const descripcion = String(row.objeto ?? "").trim();

      return {
        id: codigo,
        nombre: descripcion ? `${codigo} - ${descripcion}` : codigo,
      };
    }

    return {
      id: String(row.id ?? "").trim(),
      nombre: String(row.nombre ?? row.id ?? "").trim(),
    };
  });
}

export async function GET(request: NextRequest) {
  const session = await getSupabaseSessionContext(request);

  if (!session.ok) return session.response;

  const { searchParams } = new URL(request.url);
  const nivel = searchParams.get("nivel");
  const idPadre = searchParams.get("idPadre") ?? "";

  if (!isNivelPresupuesto(nivel)) {
    return jsonWithCookies(
      session.context,
      { error: "Nivel presupuestario invalido." },
      { status: 400 }
    );
  }

  let path = "";

  if (nivel === "Codigo") {
    if (!idPadre.trim()) {
      return jsonWithCookies(session.context, []);
    }

    path =
      "codigos_presupuesto?select=codigo,objeto&obra_id=eq." +
      encodeURIComponent(idPadre) +
      "&order=codigo.asc";
  } else {
    const config = NIVEL_CONFIG[nivel];
    const filters = [`select=id,nombre`, "order=id.asc"];

    if (config.parentColumn) {
      if (!idPadre.trim()) {
        return jsonWithCookies(session.context, []);
      }

      filters.splice(
        1,
        0,
        `${config.parentColumn}=eq.${encodeURIComponent(idPadre)}`
      );
    }

    path = `${config.table}?${filters.join("&")}`;
  }

  const supabaseResponse = await supabaseRest(session.context, path, {
    method: "GET",
  });

  const data = await readSupabaseJson(supabaseResponse);

  if (!supabaseResponse.ok) {
    return jsonWithCookies(
      session.context,
      { error: "No se pudo cargar el nivel presupuestario.", detalle: data },
      { status: supabaseResponse.status }
    );
  }

  return jsonWithCookies(session.context, normalizeRows(data, nivel));
}
