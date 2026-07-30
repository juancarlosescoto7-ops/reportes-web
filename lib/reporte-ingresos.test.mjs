import assert from "node:assert/strict";
import test from "node:test";

import { estaIngresoEnRangoDeArqueo } from "./reporte-ingresos.ts";

function crearIngreso(fechaArqueo, fechaDeposito) {
  return {
    fecha_arqueo: fechaArqueo,
    fecha: fechaArqueo,
    descripcion: null,
    total: 100,
    bloque: 1,
    fecha_deposito: fechaDeposito,
    monto: 100,
    tipo_ingreso: "11-001-01",
    cuenta: "Pagadora",
  };
}

test("filtra por la fecha del arqueo y conserva depósitos de meses anteriores", () => {
  const ingreso = crearIngreso("2026-07-10", "2026-06-30");

  assert.equal(
    estaIngresoEnRangoDeArqueo(ingreso, "2026-07-01", "2026-07-31"),
    true
  );
  assert.equal(
    estaIngresoEnRangoDeArqueo(ingreso, "2026-06-01", "2026-06-30"),
    false
  );
});

test("incluye los límites del rango de fechas de arqueo", () => {
  assert.equal(
    estaIngresoEnRangoDeArqueo(
      crearIngreso("2026-07-01", "2026-05-15"),
      "2026-07-01",
      "2026-07-31"
    ),
    true
  );
  assert.equal(
    estaIngresoEnRangoDeArqueo(
      crearIngreso("2026-07-31", "2026-08-02"),
      "2026-07-01",
      "2026-07-31"
    ),
    true
  );
});

test("mantiene compatibilidad con el campo legado de fecha del arqueo", () => {
  const ingreso = {
    ...crearIngreso(null, "2026-06-30"),
    fecha: "2026-07-15",
  };

  assert.equal(
    estaIngresoEnRangoDeArqueo(ingreso, "2026-07-01", "2026-07-31"),
    true
  );
});
