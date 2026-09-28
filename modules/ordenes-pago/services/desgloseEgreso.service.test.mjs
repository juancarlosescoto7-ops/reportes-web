import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import * as dominio from "../domain/desglose-egreso.ts";

const codigo = ts.transpileModule(readFileSync(new URL("./desgloseEgreso.service.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function entorno(paginas) {
  const llamadas = [];
  const exports = {};
  const consulta = {};
  for (const metodo of ["from", "select", "eq", "order"]) {
    consulta[metodo] = (...args) => { llamadas.push([metodo, ...args]); return consulta; };
  }
  consulta.range = async (...args) => { llamadas.push(["range", ...args]); return paginas.shift(); };
  new Function("require", "exports", codigo)(
    (ruta) => ruta.includes("infrastructure") ? { crearClienteSupabase: () => consulta } : dominio,
    exports
  );
  return { ...exports, llamadas };
}

test("filtra la orden solicitada y suma también los movimientos de la segunda página", async () => {
  const api = entorno([
    { data: Array.from({ length: 500 }, () => ({ cuenta: "Bancos", haber: 10 })) },
    { data: [{ cuenta: "Deducciones por pagar", haber: 100 }] },
  ]);
  assert.deepEqual(await api.obtenerDesgloseEgreso("8000"), { bancos: 5000, deducciones: 100, otrasCuentas: 0 });
  assert.deepEqual(api.llamadas.filter(([metodo]) => metodo === "eq"), [
    ["eq", "no_orden", "8000"], ["eq", "no_orden", "8000"],
  ]);
  assert.deepEqual(api.llamadas.filter(([metodo]) => metodo === "range"), [["range", 0, 499], ["range", 500, 999]]);
});

test("no presenta ceros ni totales parciales cuando no hay datos o falla la consulta", async () => {
  await assert.rejects(entorno([{ data: [] }]).obtenerDesgloseEgreso("8000"));
  await assert.rejects(entorno([
    { data: Array.from({ length: 500 }, () => ({ cuenta: "Bancos", haber: 10 })) },
    { error: { message: "Error de red" } },
  ]).obtenerDesgloseEgreso("8000"));
});
