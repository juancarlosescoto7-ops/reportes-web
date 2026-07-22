import test from "node:test";
import assert from "node:assert/strict";

import { calcularResumenPresupuestoProyecto } from "./resumenPresupuestoProyecto.ts";

test("suma las partidas vinculadas por id de proyecto", () => {
  const resumen = calcularResumenPresupuestoProyecto({
    idProyecto: 7,
    filas: [
      {
        proyecto_id: 7,
        presupuesto_inicial: "1,000.50",
        presupuesto_vigente: 1_200,
        ejecutado: 300,
        comprometido: 100,
      },
      {
        proyecto_id: "7",
        presupuesto_inicial: 500,
        presupuesto_vigente: 650,
        ejecutado: 200,
        total_comprometido: 75,
      },
      {
        proyecto_id: 8,
        presupuesto_inicial: 9_999,
        presupuesto_vigente: 9_999,
        ejecutado: 9_999,
        comprometido: 9_999,
      },
    ],
  });

  assert.deepEqual(resumen, {
    presupuestoInicial: 1_500.5,
    montoVigente: 1_850,
    montoEjecutado: 500,
    montoComprometido: 175,
    cantidadPartidas: 2,
  });
});

test("usa el codigo como respaldo cuando la fila no contiene id de proyecto", () => {
  const resumen = calcularResumenPresupuestoProyecto({
    idProyecto: 7,
    codigosPresupuestarios: ["01-02-03"],
    filas: [
      {
        codigo: " 01-02-03 ",
        presupuesto_inicial: 100,
        monto_vigente: 120,
        monto_ejecutado: 30,
        monto_comprometido: 10,
      },
      {
        proyecto_id: 8,
        codigo: "01-02-03",
        presupuesto_inicial: 1_000,
      },
    ],
  });

  assert.equal(resumen.presupuestoInicial, 100);
  assert.equal(resumen.montoVigente, 120);
  assert.equal(resumen.montoEjecutado, 30);
  assert.equal(resumen.montoComprometido, 10);
  assert.equal(resumen.cantidadPartidas, 1);
});
