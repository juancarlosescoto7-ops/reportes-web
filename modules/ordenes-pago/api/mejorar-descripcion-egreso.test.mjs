import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const codigo = ts.transpileModule(
  readFileSync(new URL("./mejorar-descripcion-egreso.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText;

function entorno({ contenido = '{"descripcion":"Pago de medicamentos para ayudas sociales."}', motivo = "stop", status = 200, apiKey = "prueba" } = {}) {
  const llamadas = [];
  const exports = {};
  new Function("require", "exports", "fetch", "process", codigo)(
    () => ({ NextResponse: { json: (body, init) => Response.json(body, init) } }),
    exports,
    async (url, init) => {
      llamadas.push({ url, body: JSON.parse(init.body) });
      return Response.json({ choices: [{ finish_reason: motivo, message: { content: contenido } }] }, { status });
    },
    { env: { OPENAI_API_KEY: apiKey } }
  );
  return { POST: exports.POST, llamadas };
}

function solicitud(body) {
  return new Request("http://localhost/api/mejorar-descripcion-egreso", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

test("mejora el borrador con sus indicaciones y entrega texto editable", async () => {
  const api = entorno();
  const descripcion = "  compra de medicamentos para ayudas sociales. Mejorar redacción.  ";
  const respuesta = await api.POST(solicitud({ descripcion }));
  assert.equal(respuesta.status, 200);
  assert.deepEqual(await respuesta.json(), { descripcion: "Pago de medicamentos para ayudas sociales." });
  assert.deepEqual(JSON.parse(api.llamadas[0].body.messages[1].content), { descripcion: descripcion.trim() });
});

test("rechaza descripciones ausentes o inválidas sin consultar IA", async () => {
  const api = entorno();
  for (const body of [null, {}, { descripcion: "  " }, { descripcion: 42 }]) {
    assert.equal((await api.POST(solicitud(body))).status, 400);
  }
  assert.equal((await api.POST(new Request("http://localhost", { method: "POST", body: "{" }))).status, 400);
  assert.equal(api.llamadas.length, 0);
});

test("conserva NULA sin modificar su significado operativo ni consultar IA", async () => {
  const api = entorno({ apiKey: "" });
  const respuesta = await api.POST(solicitud({ descripcion: " nula " }));
  assert.deepEqual(await respuesta.json(), { descripcion: "NULA" });
  assert.equal(api.llamadas.length, 0);
});

test("rechaza respuestas incompletas o inválidas para no reemplazar el borrador", async () => {
  for (const opciones of [
    { motivo: "length" },
    { contenido: null },
    { contenido: "No es JSON" },
    { contenido: '{"descripcion":" "}' },
    { contenido: '{"descripcion":42}' },
    { status: 429 },
  ]) {
    const respuesta = await entorno(opciones).POST(solicitud({ descripcion: "Pago de medicamentos" }));
    assert.equal(respuesta.status, 502);
    const body = await respuesta.json();
    assert.ok(body.error);
    assert.equal(body.descripcion, undefined);
  }
});

test("informa la falta de configuración sin consultar IA", async () => {
  const api = entorno({ apiKey: "" });
  assert.equal((await api.POST(solicitud({ descripcion: "Pago de medicamentos" }))).status, 500);
  assert.equal(api.llamadas.length, 0);
});
