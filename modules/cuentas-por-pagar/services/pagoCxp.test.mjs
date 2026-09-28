import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as dominio from "../domain/pago-multiple-cxp.ts";

const codigo = ts.transpileModule(readFileSync(new URL("./cxp.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

test("envía el total y las deducciones de cada CxP en una única RPC", async () => {
  const llamadas = [];
  const exports = {};
  new Function("require", "exports", codigo)((nombre) => nombre.includes("domain/") ? dominio : {
    ejecutarRPC: async (...args) => { llamadas.push(args); return { ok: true, no_orden: 12 }; },
  }, exports);
  const input = {
    cxps: [
      { no_cxp: 1, tipo_movimiento: "Compra", monto_pago: 1000, deduccion: 125, no_cheque: 10 },
      { no_cxp: 2, tipo_movimiento: null, monto_pago: 500, no_cheque: 11 },
    ],
    usuario_registro: "prueba", fecha_pago: "2026-09-24", descripcion_pago: "Pago de prueba",
  };
  assert.deepEqual(await exports.procesarPagoMultipleCXPConCompromiso(input), { ok: true, no_orden: 12 });
  assert.equal(llamadas.length, 1);
  assert.equal(llamadas[0][0], "procesar_pago_multiple_cxp_con_compromiso");
  assert.deepEqual(llamadas[0][1].p_cxps, [input.cxps[0], { ...input.cxps[1], tipo_movimiento: "", deduccion: 0 }]);
  await assert.rejects(exports.procesarPagoMultipleCXPConCompromiso({ ...input,
    cxps: [{ ...input.cxps[0], deduccion: 1001 }],
  }));
  assert.equal(llamadas.length, 1);
});
