import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseSessionContext, jsonWithCookies, readSupabaseJson, supabaseRest } from "@/shared/infrastructure/supabase-server";
import { agregarFiltros, obtenerColumna, obtenerTabla, puedeEditarDatos, prepararCambio, seleccion } from "../domain/editor-datos";

async function autorizar(request: NextRequest) {
  const sesion = await getSupabaseSessionContext(request);
  if (!sesion.ok) return sesion;
  // El RPC valida auth.uid() y consulta usuario/rol activos en la base de datos.
  const respuesta = await supabaseRest(sesion.context, "rpc/obtener_mis_permisos", { method: "POST", body: "{}", cache: "no-store" });
  const permisos = await readSupabaseJson(respuesta);
  if (!respuesta.ok || !Array.isArray(permisos) || !permisos.some((p) => puedeEditarDatos(p.rol_codigo, p.usuario_id))) {
    return { ok: false as const, response: jsonWithCookies(sesion.context, { error: "Este módulo es exclusivo de Presupuesto." }, { status: 403 }) };
  }
  return sesion;
}

function entero(valor: string | null, defecto: number, maximo: number) {
  const numero = valor === null ? defecto : Number(valor);
  if (!Number.isSafeInteger(numero) || numero < 0 || numero > maximo) throw new Error("Paginación inválida.");
  return numero;
}

export async function GET(request: NextRequest) {
  try {
    const sesion = await autorizar(request);
    if (!sesion.ok) return sesion.response;
    const url = request.nextUrl.searchParams;
    const tabla = obtenerTabla(url.get("tabla"));
    const valoresColumna = url.get("valores");
    const pagina = entero(url.get("pagina"), 0, 1_000_000);
    const limite = valoresColumna ? 500 : entero(url.get("limite"), 50, 200);
    if (limite < 1) throw new Error("Tamaño de página inválido.");
    const col = obtenerColumna(tabla, valoresColumna || url.get("orden") || "id");
    const direccion = url.get("direccion") || "asc";
    if (!["asc", "desc"].includes(direccion)) throw new Error("Orden inválido.");
    const params = new URLSearchParams({
      select: seleccion(valoresColumna ? [col] : tabla.columnas),
      order: `${col.nombre}.${valoresColumna ? "asc" : direccion}.nullsfirst${col.nombre === "id" ? "" : ",id.asc"}`,
      limit: String(limite), offset: String(pagina * limite),
    });
    const filtros = JSON.parse(url.get("filtros") || "[]");
    agregarFiltros(params, tabla, valoresColumna && Array.isArray(filtros) ? filtros.filter((f) => f?.columna !== valoresColumna) : filtros);
    const respuesta = await supabaseRest(sesion.context, `${tabla.nombre}?${params}`, { cache: "no-store", headers: { Prefer: "count=exact" }, signal: AbortSignal.timeout(30_000) });
    const datos = await readSupabaseJson(respuesta);
    if (!respuesta.ok) return jsonWithCookies(sesion.context, { error: "No se pudieron consultar los datos.", detalle: datos }, { status: respuesta.status });
    const total = Number(respuesta.headers.get("content-range")?.split("/")[1]);
    if (!Array.isArray(datos) || !Number.isFinite(total)) throw new Error("Supabase devolvió una respuesta incompleta.");
    return jsonWithCookies(sesion.context, valoresColumna
      ? { valores: [...new Set(datos.map((fila) => fila[col.nombre]))], siguiente: (pagina + 1) * limite < total ? pagina + 1 : null }
      : { filas: datos, total }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error consultando los datos." }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (request.headers.get("origin") && request.headers.get("origin") !== request.nextUrl.origin) return NextResponse.json({ error: "Origen no permitido." }, { status: 403 });
    const sesion = await autorizar(request);
    if (!sesion.ok) return sesion.response;
    const tabla = obtenerTabla(request.nextUrl.searchParams.get("tabla"));
    const { params, payload } = prepararCambio(tabla, await request.json());
    const respuesta = await supabaseRest(sesion.context, `${tabla.nombre}?${params}`, {
      method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(payload), signal: AbortSignal.timeout(30_000),
    });
    const datos = await readSupabaseJson(respuesta);
    if (!respuesta.ok) return jsonWithCookies(sesion.context, { error: "No se pudo guardar. Revise los valores y las relaciones del registro.", detalle: datos }, { status: respuesta.status });
    if (!Array.isArray(datos) || datos.length !== 1) return jsonWithCookies(sesion.context, { error: "El registro cambió, fue eliminado o ya no tiene permiso. Recargue la tabla y revise los cambios antes de volver a guardar." }, { status: 409 });
    return jsonWithCookies(sesion.context, { fila: datos[0] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Error guardando los cambios." }, { status: 400 });
  }
}
