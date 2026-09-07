import assert from "node:assert/strict";
import test from "node:test";

import {
  hayCambiosEnIngreso,
  normalizarFechaIngreso,
  validarCorreccionIngreso,
} from "./ingresos-edicion.ts";

const original = {
  cuenta: "Pagadora: 2010092311",
  tipo_ingreso: "11-001-01",
  monto: 1500,
  fecha_deposito: "2026-07-15",
};

test("normaliza fechas de Postgres para el control date", () => {
  assert.equal(
    normalizarFechaIngreso("2026-07-15T00:00:00+00:00"),
    "2026-07-15"
  );
  assert.equal(normalizarFechaIngreso(null), "");
});

test("detecta cambios reales sin considerar decimales equivalentes", () => {
  assert.equal(
    hayCambiosEnIngreso(original, { ...original, monto: 1500.0 }),
    false
  );
  assert.equal(
    hayCambiosEnIngreso(original, {
      ...original,
      cuenta: "Tributarios: 2020718737",
    }),
    true
  );
});

test("exige motivo y confirmación literal antes de corregir", () => {
  const actual = {
    ...original,
    cuenta: "Tributarios: 2020718737",
  };

  assert.match(
    validarCorreccionIngreso({
      original,
      actual,
      motivo: "Error",
      confirmacion: "CORREGIR",
    }),
    /al menos 10/
  );

  assert.match(
    validarCorreccionIngreso({
      original,
      actual,
      motivo: "Cuenta bancaria incorrecta",
      confirmacion: "corregir",
    }),
    /Escriba CORREGIR/
  );

  assert.equal(
    validarCorreccionIngreso({
      original,
      actual,
      motivo: "Cuenta bancaria incorrecta",
      confirmacion: "CORREGIR",
    }),
    null
  );
});

test("rechaza montos inválidos y formularios sin cambios", () => {
  assert.match(
    validarCorreccionIngreso({
      original,
      actual: { ...original, monto: 0 },
      motivo: "Corrección del monto",
      confirmacion: "CORREGIR",
    }),
    /mayor que cero/
  );

  assert.match(
    validarCorreccionIngreso({
      original,
      actual: original,
      motivo: "Cuenta bancaria incorrecta",
      confirmacion: "CORREGIR",
    }),
    /al menos un dato/
  );
});
