import assert from "node:assert/strict";
import test from "node:test";

import { resumirResultadosAsistente } from "../services/asistenteFinanciero.ts";

test("resume cada categoría sin mezclar presupuesto, egresos y CxP", () => {
  const resumen = resumirResultadosAsistente([
    {
      categoria: "presupuesto",
      monto: 100000,
      metricas: {
        presupuesto_vigente: 100000,
        ejecutado: 25000,
        comprometido: 10000,
        disponible: 65000,
      },
    },
    {
      categoria: "egreso",
      monto: 25000,
      metricas: { total_egreso: 25000 },
    },
    {
      categoria: "cuenta-por-pagar",
      monto: 10000,
      metricas: { obligacion: 10000, pagado: 0 },
    },
  ]);

  assert.deepEqual(resumen, [
    {
      categoria: "presupuesto",
      cantidad: 1,
      montoTotal: 100000,
      metricas: {
        presupuesto_vigente: 100000,
        ejecutado: 25000,
        comprometido: 10000,
        disponible: 65000,
      },
    },
    {
      categoria: "egreso",
      cantidad: 1,
      montoTotal: 25000,
      metricas: { total_egreso: 25000 },
    },
    {
      categoria: "cuenta-por-pagar",
      cantidad: 1,
      montoTotal: 10000,
      metricas: { obligacion: 10000, pagado: 0 },
    },
  ]);
});
