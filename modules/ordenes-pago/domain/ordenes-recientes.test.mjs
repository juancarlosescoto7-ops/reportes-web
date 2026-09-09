import assert from "node:assert/strict";
import test from "node:test";
import { ordenarOrdenesRecientes } from "./ordenes-recientes.ts";

test("ordena por consecutivo numérico sin dar prioridad al monto ni al estado", () => {
  const ordenes = [
    { no_orden: "9", fecha: "2026-09-08", diferencia: 5000 },
    { no_orden: "100", fecha: "2026-09-08", diferencia: 0 },
    { no_orden: "10", fecha: "2026-09-08", diferencia: 200 },
  ];
  const resultado = ordenarOrdenesRecientes(ordenes);
  assert.deepEqual(resultado.map((o) => o.no_orden), ["100", "10", "9"]);
  assert.deepEqual(ordenes.map((o) => o.no_orden), ["9", "100", "10"]);
  assert.equal(resultado[0], ordenes[1]);
});

test("una orden nueva con fecha contable anterior aparece primero", () => {
  const ordenes = [
    { no_orden: "101", fecha: "2026-09-08" },
    { no_orden: "102", fecha: "2026-08-31" },
  ];
  assert.equal(ordenarOrdenesRecientes(ordenes)[0].no_orden, "102");
  assert.deepEqual(ordenarOrdenesRecientes([]), []);
});
