import { type NextRequest } from "next/server";
import {
  getSupabaseSessionContext,
  jsonWithCookies,
  readSupabaseJson,
  type SupabaseSessionContext,
  supabaseRest,
} from "../_utils";

export const dynamic = "force-dynamic";

type CatalogoRow = Record<string, unknown>;

const FUENTES_FINANCIAMIENTO = [
  { id: "15-013-01", nombre: "15-013-01" },
  { id: "11-001-01", nombre: "11-001-01" },
  { id: "12-001-01", nombre: "12-001-01" },
];

const TIPOS_GASTO = [
  { id: "10", nombre: "10 - Gasto Corriente" },
  { id: "20", nombre: "20 - Gasto de Capital" },
];

function getString(row: CatalogoRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];

    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }

  return "";
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function formatObjetoNombre(id: string, descripcion: string) {
  if (!descripcion) return id;

  const startsWithId = new RegExp(
    `^${escapeRegExp(id)}(?:\\s*[-:]\\s*|\\s+|$)`,
    "i"
  ).test(descripcion);

  return startsWithId ? descripcion : `${id} - ${descripcion}`;
}

function normalizeObjetos(rows: unknown) {
  if (!Array.isArray(rows)) return [];

  const seen = new Set<string>();

  return rows
    .map((row: CatalogoRow) => {
      const id = getString(row, [
        "objeto_del_gasto",
        "id",
        "objeto",
        "codigo",
      ]);
      const descripcion = getString(row, [
        "descripcion",
        "descripcion_objeto",
        "nombre",
      ]);

      return {
        id,
        nombre: formatObjetoNombre(id, descripcion),
      };
    })
    .filter((row) => {
      if (!row.id || seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    })
    .sort((a, b) => {
      return a.id.localeCompare(b.id, "es-HN", {
        numeric: true,
        sensitivity: "base",
      });
    });
}

async function obtenerObjetosDesdeCatalogo(context: SupabaseSessionContext) {
  const fuentes = [
    {
      path: "rpc/obtener_objetos_gasto",
      init: { method: "POST", body: "{}" },
    },
    {
      path: "catalogo_objetos_gasto?select=id,descripcion,nombre&order=id.asc",
      init: { method: "GET" },
    },
    {
      path: "objetos_gasto?select=id,descripcion,nombre&order=id.asc",
      init: { method: "GET" },
    },
    {
      path: "objetos_del_gasto?select=id,descripcion,nombre&order=id.asc",
      init: { method: "GET" },
    },
    {
      path: "codigos_presupuesto?select=objeto&order=objeto.asc",
      init: { method: "GET" },
    },
  ] satisfies { path: string; init: RequestInit }[];

  for (const { path, init } of fuentes) {
    const response = await supabaseRest(context, path, init);

    if (!response.ok) continue;

    const data = await readSupabaseJson(response);
    const objetos = normalizeObjetos(data);

    if (objetos.length > 0) return objetos;
  }

  return [];
}

export async function GET(request: NextRequest) {
  const session = await getSupabaseSessionContext(request);

  if (!session.ok) return session.response;

  const objetosGasto = await obtenerObjetosDesdeCatalogo(session.context);

  return jsonWithCookies(session.context, {
    objetosGasto,
    fuentesFinanciamiento: FUENTES_FINANCIAMIENTO,
    tiposGasto: TIPOS_GASTO,
  });
}
