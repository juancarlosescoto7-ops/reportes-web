import test from "node:test";
import assert from "node:assert/strict";
import { combinarContextosConPresupuesto } from "./contextos-presupuesto.ts";

test("combina el contexto de CxP con las filas del presupuesto", () => {
  const resultado = combinarContextosConPresupuesto(
    [
      { codigo: "A-01", presupuesto_vigente: 100 },
      { codigo: "B-02", presupuesto_vigente: 200 },
    ],
    [
      {
        codigo: "A-01",
        contexto_cxp: "Combustible para vehiculos municipales.",
      },
    ]
  );

  assert.equal(
    resultado[0].contexto_cxp,
    "Combustible para vehiculos municipales."
  );
  assert.equal(resultado[1].contexto_cxp, null);
});
