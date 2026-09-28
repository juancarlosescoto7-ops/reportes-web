import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as pagos from "../domain/pago-multiple-cxp.ts";

const codigo = ts.transpileModule(
  readFileSync(new URL("./generar-descripcion-pago.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }
).outputText;

async function generarContexto(cxps, descripcion_pago = "") {
  const exports = {};
  let contexto;
  new Function("require", "exports", "fetch", "process", codigo)(
    (ruta) => ruta === "next/server"
      ? { NextResponse: { json: (body, init) => Response.json(body, init) } }
      : pagos,
    exports,
    async (_url, init) => {
      const prompt = JSON.parse(init.body).messages[1].content;
      contexto = JSON.parse(prompt.split("Contexto del pago:\n")[1].trim());
      return Response.json({ choices: [{ message: { content: '{"descripcion":"Pago de mantenimiento."}' } }] });
    },
    { env: { OPENAI_API_KEY: "prueba" } }
  );
  const respuesta = await exports.POST(new Request("http://localhost/api/generar-descripcion-pago-cxp", {
    method: "POST",
    body: JSON.stringify({ cxps, descripcion_pago }),
  }));
  assert.equal(respuesta.status, 200);
  return contexto;
}

test("pagar la segunda mitad cancela el saldo de los tres contratos", async () => {
  const contexto = await generarContexto(
    [16000, 16000, 18000].map((monto, indice) => ({
      no_cxp: [171, 177, 186][indice],
      beneficiario_id: String(indice),
      descripcion: "Personal temporal de mantenimiento",
      monto_obligacion: monto,
      monto_pagado_anterior: monto / 2,
      monto_pago: monto / 2,
    })),
    'Personal que labora en mantenimiento de centro turístico "El cerrito". Pago (2/2)'
  );
  assert.equal(contexto.tipo_pago, "planilla");
  assert.equal(contexto.cantidad_proveedores, 3);
  assert.match(contexto.descripcion_pago, /Pago \(2\/2\)/);
  for (const cxp of contexto.cxps) {
    assert.equal(cxp.cancela_saldo_pendiente, true);
    assert.equal(cxp.porcentaje_pagado, undefined);
    assert.equal(cxp.saldo_pendiente_estimado, undefined);
  }
});

test("distingue el primer abono de la cancelación sin inferir cuotas", async () => {
  const contexto = await generarContexto([
    { monto_obligacion: 16000, monto_pagado_anterior: 0, monto_pago: 8000 },
    { monto_obligacion: 16000, monto_pagado_anterior: 0, monto_pago: 16000 },
    { monto_obligacion: 16000, monto_pagado_anterior: 12000, monto_pago: 4000 },
  ]);
  assert.deepEqual(contexto.cxps.map((cxp) => cxp.cancela_saldo_pendiente), [false, true, true]);
  assert.ok(contexto.cxps.every((cxp) => !Object.hasOwn(cxp, "numero_pago")));
});

test("no determina cancelación con datos incompletos o inválidos", async () => {
  const contexto = await generarContexto([
    { monto_obligacion: 16000, monto_pago: 8000 },
    { monto_obligacion: 16000, monto_pagado_anterior: null, monto_pago: 8000 },
    { monto_obligacion: 16000, monto_pagado_anterior: 8000, monto_pago: null },
    { monto_obligacion: 16000, monto_pagado_anterior: -8000, monto_pago: 8000 },
  ]);
  assert.ok(contexto.cxps.every((cxp) => cxp.cancela_saldo_pendiente === null));
});
