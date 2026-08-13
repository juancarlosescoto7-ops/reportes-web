import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizarRutaSistema,
  obtenerRutaInicialSesion,
} from "./ruta-inicial-sesion.ts";

test("normaliza la ruta anterior de auditoria", () => {
  assert.equal(normalizarRutaSistema("reportes/auditoria"), "/auditoria");
  assert.equal(normalizarRutaSistema("/reportes/auditoria/"), "/auditoria");
});

test("inicia el rol AUDITORIA directamente en /auditoria", () => {
  assert.equal(
    obtenerRutaInicialSesion({
      rolCodigo: " auditoría ",
      rutasConfiguradas: ["/reportes/auditoria"],
    }),
    "/auditoria"
  );
});

test("mantiene la prioridad general para los demas roles", () => {
  assert.equal(
    obtenerRutaInicialSesion({
      rolCodigo: "ADMIN",
      rutasConfiguradas: ["/auditoria", "/"],
    }),
    "/"
  );
});
