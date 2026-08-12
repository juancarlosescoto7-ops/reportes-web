import assert from "node:assert/strict";
import test from "node:test";

import { puedeAccederAuditoria } from "./acceso-auditoria.ts";

test("autoriza exclusivamente los roles del modulo de auditoria", () => {
  assert.equal(puedeAccederAuditoria("AUDITORIA"), true);
  assert.equal(puedeAccederAuditoria("ADMIN"), true);
  assert.equal(puedeAccederAuditoria("PRESUPUESTO"), true);
  assert.equal(puedeAccederAuditoria("TESORERIA"), false);
  assert.equal(puedeAccederAuditoria("CONSULTA"), false);
  assert.equal(puedeAccederAuditoria(null), false);
});

test("normaliza espacios, mayusculas y acentos del codigo de rol", () => {
  assert.equal(puedeAccederAuditoria(" auditoría "), true);
  assert.equal(puedeAccederAuditoria("presupuesto"), true);
});
