import assert from "node:assert/strict";
import test from "node:test";

import { puedeAccederReporteOficinaMujer } from "./acceso-oficina-mujer.ts";

test("autoriza los roles solicitados y el codigo administrativo legado", () => {
  for (const rolCodigo of [
    "OFICINA_MUJER",
    "PRESUPUESTO",
    "ADMINISTRADOR",
    "ADMIN",
  ]) {
    assert.equal(puedeAccederReporteOficinaMujer({ rolCodigo }), true);
  }

  assert.equal(
    puedeAccederReporteOficinaMujer({ rolCodigo: "TESORERIA" }),
    false
  );
});

test("autoriza al usuario OFICINA_MUJER aunque tenga otro rol", () => {
  assert.equal(
    puedeAccederReporteOficinaMujer({
      rolCodigo: "CONSULTA",
      nombreUsuario: " oficina mujer ",
    }),
    true
  );
});
