import test from "node:test";
import assert from "node:assert/strict";
import {
  agruparCxpCronologicamente,
  separarCxpPorCompromiso,
} from "./vistas-cxp.ts";

test("clasifica las CxP por tipo y ordena cada grupo por numero ascendente", () => {
  const grupos = agruparCxpCronologicamente([
    { no_cxp: 20, tipo_movimiento: "Proveedor", fecha: "2026-02-01" },
    { no_cxp: 8, tipo_movimiento: "Planilla", fecha: "2026-01-01" },
    { no_cxp: 3, tipo_movimiento: "Proveedor", fecha: "2025-12-01" },
    { no_cxp: 1, tipo_movimiento: null, fecha: "2025-11-01" },
  ]);

  assert.deepEqual(
    grupos.map((grupo) => grupo.tipo),
    ["Planilla", "Proveedor", "Sin tipo"]
  );
  assert.deepEqual(
    grupos.find((grupo) => grupo.tipo === "Proveedor")?.items.map(
      (cxp) => cxp.no_cxp
    ),
    [3, 20]
  );
});

test("separa las CxP comprometidas de las no comprometidas", () => {
  const resultado = separarCxpPorCompromiso([
    { no_cxp: 1, monto_comprometido: 0, estado_operativo: "sin_compromiso" },
    { no_cxp: 2, monto_comprometido: 500, estado_operativo: "compromiso_total" },
    { no_cxp: 3, monto_comprometido: 0, estado_operativo: "compromiso_parcial" },
  ]);

  assert.deepEqual(
    resultado.sinCompromiso.map((cxp) => cxp.no_cxp),
    [1]
  );
  assert.deepEqual(
    resultado.comprometidas.map((cxp) => cxp.no_cxp),
    [2, 3]
  );
});
