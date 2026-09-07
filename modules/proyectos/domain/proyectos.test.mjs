import assert from "node:assert/strict";
import test from "node:test";

import {
  esRequisitoOrdenInicio,
  normalizarIdProyecto,
  normalizarObrasPresupuesto,
  validarCrearProyectoPayload,
} from "./proyectos.ts";

test("normaliza, filtra y ordena las obras presupuestarias", () => {
  assert.deepEqual(
    normalizarObrasPresupuesto([
      { id: 3, nombre: "  Zanja pluvial ", actividad_id: 8 },
      { id: 1, nombre: "Sin Obra", actividad_id: 2 },
      { id: 2, nombre: "Aceras", actividad_id: null },
      { id: 2, nombre: "Aceras", actividad_id: null },
      { id: "", nombre: "Registro inválido" },
    ]),
    [
      { id: "2", nombre: "Aceras", actividadId: null },
      { id: "3", nombre: "Zanja pluvial", actividadId: "8" },
    ]
  );
});

test("valida la creación de un proyecto con una o varias obras", () => {
  assert.deepEqual(
    validarCrearProyectoPayload({
      nombreProyecto: "  Mejoramiento vial ",
      codigos: ["10", "10", "11"],
    }),
    {
      ok: true,
      payload: {
        nombreProyecto: "Mejoramiento vial",
        codigos: ["10", "11"],
      },
    }
  );

  assert.equal(
    validarCrearProyectoPayload({ nombreProyecto: "Sin obras", codigos: [] })
      .ok,
    false
  );
});

test("reconoce el id devuelto por el RPC y la orden de inicio", () => {
  assert.equal(normalizarIdProyecto(42), 42);
  assert.equal(normalizarIdProyecto({ id_proyecto: "18" }), 18);
  assert.equal(normalizarIdProyecto("sin-id"), null);
  assert.equal(esRequisitoOrdenInicio("ORDEN DE INICIO"), true);
  assert.equal(esRequisitoOrdenInicio("Orden de inicio del proyecto"), true);
  assert.equal(esRequisitoOrdenInicio("Contrato"), false);
});
