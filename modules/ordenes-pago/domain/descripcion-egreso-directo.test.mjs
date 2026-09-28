import assert from "node:assert/strict";
import test from "node:test";
import { construirDescripcionEgresoDirecto } from "./descripcion-egreso-directo.ts";

const movimiento = (id, nombre, deduccion) => ({ id_beneficiario: id, nombre, deduccion });

test("agrega la retención al concepto del egreso con monto y beneficiario", () => {
  assert.equal(
    construirDescripcionEgresoDirecto("Pago de mantenimiento", [movimiento("1", "Ana López", 1250.5)]),
    "Pago de mantenimiento. Retención de L 1,250.50 aplicada a Ana López."
  );
});

test("agrupa por ID y conserva por separado las retenciones de distintos beneficiarios", () => {
  assert.equal(
    construirDescripcionEgresoDirecto("Planilla de pago.", [
      movimiento("1", "Ana López", 100.1),
      movimiento("1", "Ana López", 200.2),
      movimiento("2", "Luis Pérez", 450),
      movimiento("3", "Mario Ruiz", 0),
    ]),
    "Planilla de pago. Retención de L 300.30 aplicada a Ana López. Retención de L 450.00 aplicada a Luis Pérez."
  );
});

test("usa las deducciones de filas separadas importadas desde CSV", () => {
  const movimientos = [movimiento("1", "Ana López", 0), movimiento("1", "Ana López", 100)];
  const descripcion = "Pago de mantenimiento.";
  assert.equal(construirDescripcionEgresoDirecto(descripcion, movimientos),
    "Pago de mantenimiento. Retención de L 100.00 aplicada a Ana López.");
  assert.equal(construirDescripcionEgresoDirecto(descripcion, movimientos.slice(0, 1)), descripcion);
});

test("no duplica una frase de retención ya incluida", () => {
  const movimientos = [movimiento("1", "Ana López", 100)];
  const descripcion = construirDescripcionEgresoDirecto("Pago de mantenimiento.", movimientos);
  assert.equal(construirDescripcionEgresoDirecto(descripcion, movimientos), descripcion);
});

test("omite montos no positivos o inválidos y respeta las órdenes nulas", () => {
  const movimientos = [0, -1, NaN, Infinity].map((monto) => movimiento("1", "Ana López", monto));
  assert.equal(construirDescripcionEgresoDirecto("Pago de mantenimiento.", movimientos), "Pago de mantenimiento.");
  assert.equal(construirDescripcionEgresoDirecto("NULA", [movimiento("1", "Ana López", 100)]), "NULA");
});

test("identifica por ID cuando una fila importada no trae nombre", () => {
  assert.equal(construirDescripcionEgresoDirecto("Pago de mantenimiento.", [movimiento("001", "", 100)]),
    "Pago de mantenimiento. Retención de L 100.00 aplicada a beneficiario 001.");
});
