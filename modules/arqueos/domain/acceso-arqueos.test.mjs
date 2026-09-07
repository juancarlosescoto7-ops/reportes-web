import assert from "node:assert/strict";
import test from "node:test";

import {
  PERMISO_ARQUEOS,
  ROLES_CON_ACCESO_ARQUEOS,
  puedeGestionarArqueos,
} from "./acceso-arqueos.ts";

test("autoriza el módulo mediante su permiso independiente", () => {
  assert.equal(PERMISO_ARQUEOS, "VER_ARQUEOS");
  assert.equal(puedeGestionarArqueos(["VER_ARQUEOS"], "CONSULTA"), true);
  assert.equal(
    puedeGestionarArqueos(
      ["VER_INGRESOS", "VER_ARQUEOS"],
      "CONSULTA"
    ),
    true
  );
});

test("muestra arqueos automáticamente a los roles operativos", () => {
  assert.deepEqual(ROLES_CON_ACCESO_ARQUEOS, [
    "TESORERIA",
    "PRESUPUESTO",
    "ADMIN",
  ]);
  assert.equal(puedeGestionarArqueos([], "TESORERIA"), true);
  assert.equal(puedeGestionarArqueos([], "PRESUPUESTO"), true);
  assert.equal(puedeGestionarArqueos([], "ADMIN"), true);
});

test("no hereda el acceso del módulo de ingresos para otros roles", () => {
  assert.equal(puedeGestionarArqueos(["VER_INGRESOS"], "CONSULTA"), false);
  assert.equal(puedeGestionarArqueos([], "UTM"), false);
  assert.equal(puedeGestionarArqueos(null, null), false);
});
