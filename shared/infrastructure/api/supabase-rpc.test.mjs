import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { NextRequest, NextResponse } = require("next/server");
const env = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_KEY: "test-key",
};

function cargarModulo(path, dependencias, fetch) {
  const codigo = ts.transpileModule(
    readFileSync(new URL(path, import.meta.url), "utf8"),
    { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
  ).outputText;
  const exports = {};
  new Function("require", "exports", "fetch", "process", "window", "console", codigo)(
    (nombre) => dependencias[nombre], exports, fetch, { env }, {},
    { error() {}, log() {} }
  );
  return exports;
}

function crearRuta(fetch, session = { access_token: "test-token" }) {
  return cargarModulo("./supabase-rpc.ts", {
    "next/server": { NextResponse },
    "@supabase/ssr": {
      createServerClient: (_url, _key, { cookies }) => ({
        auth: {
          getSession: async () => {
            cookies.setAll([{ name: "session", value: "renewed", options: { httpOnly: true } }]);
            return { data: { session }, error: null };
          },
        },
      }),
    },
  }, fetch).POST;
}

function invocarRuta(post) {
  return post(new NextRequest("http://localhost/api/supabase/rpc/rpc_subsanar_documento_faltante_orden_pago", {
    method: "POST", body: JSON.stringify({ p_documento_id: "test-id" }),
  }), { params: Promise.resolve({ nombreRPC: "rpc_subsanar_documento_faltante_orden_pago" }) });
}

test("un fallo de conexión devuelve 503 con detalle y cookies sin repetir la mutación", async () => {
  let llamadas = 0;
  const response = await invocarRuta(crearRuta(async () => {
    llamadas++;
    throw new TypeError("fetch failed");
  }));
  assert.equal(response.status, 503);
  assert.equal(llamadas, 1);
  assert.equal(response.cookies.get("session")?.value, "renewed");
  const body = await response.json();
  assert.equal(body.code, "SUPABASE_UNAVAILABLE");
  assert.match(body.error, /actualiza los documentos/);
});

test("maneja también la desconexión al leer el cuerpo de Supabase", async () => {
  const response = await invocarRuta(crearRuta(async () => ({
    text: async () => { throw new TypeError("terminated"); },
  })));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, "SUPABASE_UNAVAILABLE");
});

test("conserva errores SQL y el estado HTTP de Supabase", async () => {
  const error = { code: "P0001", message: "No se encontró un documento faltante activo con ese ID." };
  const response = await invocarRuta(crearRuta(async () => Response.json(error, { status: 400 })));
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), error);
});

test("conserva el resultado de la subsanación y sus parámetros", async () => {
  const documento = { id: "test-id", estado: "SUBSANADO" };
  const response = await invocarRuta(crearRuta(async (url, init) => {
    assert.match(url, /rpc_subsanar_documento_faltante_orden_pago$/);
    assert.equal(init.headers.Authorization, "Bearer test-token");
    assert.deepEqual(JSON.parse(init.body), { p_documento_id: "test-id" });
    return Response.json([documento]);
  }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [documento]);
});

test("no ejecuta la RPC sin sesión", async () => {
  const response = await invocarRuta(crearRuta(async () => assert.fail("RPC sin sesión"), null));
  assert.equal(response.status, 401);
});

test("conserva las respuestas 204 sin cuerpo", async () => {
  const response = await invocarRuta(crearRuta(async () => new Response(null, { status: 204 })));
  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
});

function crearCliente(fetch) {
  return cargarModulo("../supabase.ts", { "@supabase/ssr": {} }, fetch).ejecutarRPC;
}

test("el cliente propaga el mensaje de conexión cuando se solicita lanzar el error", async () => {
  const rpc = crearCliente(async () => Response.json({ error: "Comprueba la conexión." }, { status: 503 }));
  await assert.rejects(rpc("rpc_subsanar", {}, { lanzarError: true }), /503 - Comprueba la conexión\./);
});

test("el cliente conserva el mensaje SQL y explica errores de cuerpo vacío", async () => {
  for (const [response, esperado] of [
    [Response.json({ message: "Documento inexistente" }, { status: 400 }), /Documento inexistente/],
    [new Response(null, { status: 500 }), /El servidor no devolvió detalles/],
  ]) {
    await assert.rejects(crearCliente(async () => response)("rpc_subsanar", {}, { lanzarError: true }), esperado);
  }
});

test("mantiene la compatibilidad de los consumidores que esperan una lista vacía ante errores", async () => {
  const rpc = crearCliente(async () => { throw new TypeError("fetch failed"); });
  assert.deepEqual(await rpc("rpc_consulta"), []);
});
