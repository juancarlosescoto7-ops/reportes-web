import test from "node:test";
import assert from "node:assert/strict";
import { resumirContextosPresupuesto } from "./contextualizador-presupuesto.ts";

test("presenta la ruta completa de cada renglón pendiente", () => {
  const resultado = resumirContextosPresupuesto([
    {
      codigo: "01-02-03-04-05-35610",
      programa_id: "01",
      programa_nombre: "Administración central",
      sub_programa_id: "02",
      subprograma_nombre: "Servicios generales",
      proyecto_id: "03",
      proyecto_nombre: "Fortalecimiento institucional",
      actividad_id: "04",
      actividad_nombre: "Operación municipal",
      obra_id: "05",
      obra_nombre: "Edificio municipal",
      objeto: "35610",
      descripcion_objeto: "Gasolina",
      contexto_cxp: null,
    },
  ]);

  assert.equal(resultado.total, 1);
  assert.equal(resultado.configurados, 0);
  assert.equal(resultado.pendientes[0].niveles.length, 6);
  assert.match(resultado.pendientes[0].rutaTexto, /Programa: 01 — Administración central/);
  assert.match(resultado.pendientes[0].rutaTexto, /Obra: 05 — Edificio municipal/);
  assert.match(resultado.pendientes[0].rutaTexto, /Renglón presupuestario: 35610 — Gasolina/);
});

test("deduplica el código y cuenta como configurado si alguna fila tiene contexto", () => {
  const resultado = resumirContextosPresupuesto([
    { codigo: "A-01", contexto_cxp: null },
    {
      codigo: "A-01",
      programa_nombre: "Administración",
      contexto_cxp: "Compras administrativas de uso institucional.",
    },
    { codigo: "B-02", contexto_cxp: "  " },
  ]);

  assert.equal(resultado.total, 2);
  assert.equal(resultado.configurados, 1);
  assert.deepEqual(
    resultado.pendientes.map((item) => item.codigoPresupuestario),
    ["B-02"]
  );
});

test("conserva la fila duplicada con la ubicación más detallada", () => {
  const resultado = resumirContextosPresupuesto([
    { codigo: "A-01", objeto: "35610" },
    {
      codigo_presupuestario: "A-01",
      programa_id: "1",
      programa_nombre: "Servicios públicos",
      obra_id: "9",
      obra_nombre: "Mantenimiento vial",
      objeto: "35610",
      descripcion_objeto: "Combustibles",
    },
  ]);

  assert.equal(resultado.pendientes.length, 1);
  assert.equal(resultado.pendientes[0].descripcionObjeto, "Combustibles");
  assert.match(resultado.pendientes[0].rutaTexto, /Mantenimiento vial/);
});
