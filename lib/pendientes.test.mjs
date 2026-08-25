import assert from "node:assert/strict";
import test from "node:test";

import {
  calcularPorcentajePendiente,
  obtenerCxpSinComprometer,
  obtenerEgresosSinComprometer,
  obtenerRenglonesSinFondos,
} from "./pendientes.ts";

test("solo conserva CxP pendientes con saldo por comprometer", () => {
  const rows = [
    { estado_administrativo: "pendiente", saldo_por_comprometer: 500 },
    { estado_administrativo: "pendiente", saldo_por_comprometer: 0 },
    { estado_administrativo: "pagada", saldo_por_comprometer: 200 },
  ];

  assert.equal(obtenerCxpSinComprometer(rows).length, 1);
});

test("solo conserva egresos con diferencia positiva", () => {
  const rows = [{ diferencia: 100 }, { diferencia: 0 }, { diferencia: -10 }];
  assert.equal(obtenerEgresosSinComprometer(rows).length, 1);
});

test("detecta y desduplica renglones con saldo agotado", () => {
  const rows = [
    { codigo: "100", presupuesto_vigente: 1000, ejecutado: 800, comprometido: 200 },
    { codigo: "100", presupuesto_vigente: 1000, ejecutado: 800, comprometido: 200 },
    { codigo: "200", presupuesto_vigente: 1000, ejecutado: 400, comprometido: 100 },
  ];

  assert.deepEqual(
    obtenerRenglonesSinFondos(rows).map((row) => row.codigo),
    ["100"]
  );
});

test("calcula el porcentaje pendiente con limites seguros", () => {
  assert.equal(calcularPorcentajePendiente(12, 40), 30);
  assert.equal(calcularPorcentajePendiente(2, 0), 0);
  assert.equal(calcularPorcentajePendiente(20, 10), 100);
});
