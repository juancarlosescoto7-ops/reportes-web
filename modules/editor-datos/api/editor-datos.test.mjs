import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as dominio from "../domain/editor-datos.ts";

// Ejecuta los handlers reales con el límite de red sustituido por respuestas controladas.
const codigo = ts.transpileModule(readFileSync(new URL("./editor-datos.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
function entorno({ rol = "PRESUPUESTO", usuarioId, sesion = true, respuesta = [{ id: "001", nombre: "Nuevo" }], status = 200 } = {}) {
  const llamadas = [];
  const json = (datos, init) => Response.json(datos, init);
  const infraestructura = {
    getSupabaseSessionContext: async () => sesion ? { ok: true, context: {} } : { ok: false, response: json({ error: "Sin sesión" }, { status: 401 }) },
    jsonWithCookies: (_ctx, datos, init) => json(datos, init),
    readSupabaseJson: async (res) => res.json(),
    supabaseRest: async (_ctx, ruta, init) => {
      llamadas.push({ ruta, init });
      return ruta.startsWith("rpc/") ? json([{ rol_codigo: rol, usuario_id: usuarioId }]) : json(respuesta, { status, headers: { "content-range": "0-0/51" } });
    },
  };
  const modulo = { exports: {} };
  new Function("require", "exports", "module", codigo)((ruta) => ruta === "next/server" ? { NextResponse: { json } } : ruta.includes("supabase-server") ? infraestructura : dominio, modulo.exports, modulo);
  return { ...modulo.exports, llamadas };
}
function solicitud(method = "GET", query = "tabla=beneficiarios", cuerpo) {
  const request = new Request(`http://localhost/api/editor-datos?${query}`, { method, ...(cuerpo ? { body: JSON.stringify(cuerpo), headers: { "content-type": "application/json" } } : {}) });
  request.nextUrl = new URL(request.url);
  return request;
}

test("GET y PATCH deniegan otros roles antes de consultar tablas", async () => {
  for (const rol of ["ADMIN", "TESORERIA", "AUDITORIA", "CONSULTA", "UTM"]) {
    const api = entorno({ rol });
    assert.equal((await api.GET(solicitud())).status, 403);
    assert.equal((await api.PATCH(solicitud("PATCH", "tabla=beneficiarios", {}))).status, 403);
    assert.ok(api.llamadas.every((c) => c.ruta === "rpc/obtener_mis_permisos"));
  }
  assert.equal((await entorno({ sesion: false }).GET(solicitud())).status, 401);
});

test("GET aplica paginación y filtros en Supabase y devuelve el total", async () => {
  const api = entorno();
  const filtros = JSON.stringify([{ columna: "nombre", operador: "contiene", valor: "Nuevo" }]);
  const response = await api.GET(solicitud("GET", new URLSearchParams({ tabla: "beneficiarios", pagina: "1", limite: "50", filtros }).toString()));
  assert.equal(response.status, 200);
  assert.equal((await response.json()).total, 51);
  const params = new URLSearchParams(api.llamadas.at(-1).ruta.split("?")[1]);
  assert.equal(params.get("offset"), "50");
  assert.equal(params.get("nombre"), "ilike.%Nuevo%");
});

test("PATCH confirma un registro y detecta conflictos o errores reales", async () => {
  const cuerpo = { original: { id: "001", nombre: "Anterior" }, cambios: { nombre: "Nuevo" } };
  const api = entorno();
  assert.equal((await api.PATCH(solicitud("PATCH", "tabla=beneficiarios", cuerpo))).status, 200);
  assert.equal(api.llamadas.at(-1).init.method, "PATCH");
  assert.deepEqual(JSON.parse(api.llamadas.at(-1).init.body), { nombre: "Nuevo" });
  assert.equal((await entorno({ respuesta: [] }).PATCH(solicitud("PATCH", "tabla=beneficiarios", cuerpo))).status, 409);
  assert.equal((await entorno({ respuesta: { message: "foreign key violation" }, status: 409 }).PATCH(solicitud("PATCH", "tabla=beneficiarios", cuerpo))).status, 409);
  const sinId = entorno();
  assert.equal((await sinId.PATCH(solicitud("PATCH", "tabla=beneficiarios", { original: { nombre: "x" }, cambios: { nombre: "y" } }))).status, 400);
  assert.equal(sinId.llamadas.length, 1);
});
