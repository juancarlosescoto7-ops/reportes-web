import assert from "node:assert/strict";
import test from "node:test";

import { ATAJOS_NAVEGACION, formatoAtajo } from "./atajos.ts";

test("cada módulo general tiene un comando directo y único", () => {
  const esperados = {
    egresos: "egr",
    compromisos: "cxp",
    presupuesto: "pre",
    proyectos: "pro",
    ingresos: "ing",
    arqueos: "arq",
    "ordenes-pago-documentos": "ordpag",
  };

  for (const [modulo, comando] of Object.entries(esperados)) {
    assert.equal(ATAJOS_NAVEGACION[modulo], comando);
  }

  assert.equal(
    new Set(Object.values(ATAJOS_NAVEGACION)).size,
    Object.values(ATAJOS_NAVEGACION).length,
  );
});

test("muestra el comando con su secuencia completa", () => {
  assert.equal(formatoAtajo(ATAJOS_NAVEGACION.egresos), "Shift + EGR");
  assert.equal(formatoAtajo(ATAJOS_NAVEGACION.compromisos), "Shift + CXP");
});
