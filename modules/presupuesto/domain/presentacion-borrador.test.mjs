import test from "node:test";
import assert from "node:assert/strict";
import { construirPresentacionBorrador } from "./presentacion-borrador.ts";

function datos() {
  return {
    borrador: { id: "b", anio: 2027, estado: "BORRADOR" },
    programas: [{ id: "p11", codigo: "11", nombre: "Infraestructura" }, { id: "p1", codigo: "01", nombre: "Administración" }],
    subprogramas: [], proyectos: [], actividades: [], obras: [], codigos: [], topes: [], objetosGasto: [],
    rubrosIngresos: [{ codigo: "001", descripcion: "Bienes inmuebles" }, { codigo: "002", descripcion: "Servicios" }, { codigo: "003", descripcion: "Pendiente" }],
    ingresos: [{ codigo_saft: "001", presupuesto_proyectado: "100.10" }, { codigo_saft: "002", presupuesto_proyectado: "20.20" }],
    fuentes: [{ id: "f", fuente: "11-001-01", monto_base: "1000" }, { id: "p", fuente: "15-013-01", monto_base: "999" }, { id: "o", fuente: "12-001-01", monto_base: "500" }],
    controlTechos: [
      { fuente: "11-001-01", nivel_aplicacion: "tipo_inversion", id_nivel: "10", monto_permitido: "100", monto_disponible: "70", porcentaje_tope: 10 },
      { fuente: "15-013-01", nivel_aplicacion: "tipo_inversion", id_nivel: "10", monto_permitido: "72.18", porcentaje_tope: 60 },
      { fuente: "15-013-01", nivel_aplicacion: "tipo_inversion", id_nivel: "20", monto_permitido: "48.12", porcentaje_tope: 40 },
      { fuente: "11-001-01", nivel_aplicacion: "programa", id_nivel: "011", monto_permitido: "300", porcentaje_tope: 30 },
    ],
  };
}

test("los ingresos propios proceden de los rubros y no duplican la fuente ni los techos", () => {
  const modelo = construirPresentacionBorrador(datos());
  assert.equal(modelo.propios, 120.3);
  assert.equal(modelo.transferencias, 1000);
  assert.equal(modelo.total, 1120.3);
  assert.equal(modelo.sinProyeccion, 1);
  assert.equal(modelo.otrasFuentes.length, 1);
  assert.equal(modelo.ingresos[0].nombre, "Bienes inmuebles");
});

test("asocia techos compartidos por tipo y techo de transferencia por programa normalizado", () => {
  const modelo = construirPresentacionBorrador(datos());
  assert.equal(modelo.funcionamiento[0].codigo, "01");
  assert.equal(modelo.inversion[0].codigo, "11");
  assert.deepEqual(modelo.techosFuncionamiento.map((item) => item.techo.monto_permitido), ["100", "72.18"]);
  assert.equal(modelo.techoInversionPropios.techo.monto_permitido, "48.12");
  assert.equal(modelo.techosPrograma.get("p11").monto_permitido, "300");
  assert.equal(modelo.techosPrograma.get("p1"), null);
});

test("distingue proyecciones pendientes de un cero registrado", () => {
  const data = datos();
  data.ingresos = [];
  data.fuentes = [];
  const pendiente = construirPresentacionBorrador(data);
  assert.equal(pendiente.propios, null);
  assert.equal(pendiente.transferencias, null);
  assert.equal(pendiente.total, null);
  data.ingresos = [{ codigo_saft: "001", presupuesto_proyectado: 0 }];
  data.fuentes = [{ fuente: "11-001-01", monto_base: 0 }];
  const cero = construirPresentacionBorrador(data);
  assert.equal(cero.propios, 0);
  assert.equal(cero.transferencias, 0);
  assert.equal(cero.total, 0);
});

test("conserva todas las ramas sin inventar ni distribuir montos de gasto", () => {
  const data = datos();
  data.subprogramas = [{ id: "s", programa_id: "p11", codigo: "11 0", nombre: "SIN SUBPROGRAMA" }];
  data.proyectos = [{ id: "py", subprograma_id: "s", codigo: "11 0 1", nombre: "Red vial" }];
  data.actividades = [{ id: "a", proyecto_id: "py", codigo: "11 0 1 0", nombre: "SIN ACTIVIDAD" }];
  data.obras = [{ id: "o", actividad_id: "a", codigo: "11 0 1 0 1", nombre: "Mejoramiento de calle" }];
  data.codigos = [{ id: "c", obra_id: "o", codigo: "11 0 1 0 1 123", objeto: "123", monto: 0 }];
  data.objetosGasto = [{ id: "123", nombre: "Materiales" }];
  data.programas.push({ id: "p9", codigo: "09", nombre: "Otro programa" });
  const modelo = construirPresentacionBorrador(data);
  const objeto = modelo.inversion[0].hijos[0].hijos[0].hijos[0].hijos[0].hijos[0];
  assert.equal(objeto.nombre, "Materiales");
  assert.equal(objeto.nivel, "Objeto del gasto");
  assert.equal("monto" in objeto, false);
  assert.equal(modelo.otros[0].codigo, "09");
  assert.equal(modelo.tieneAsignaciones, false);
  data.codigos[0].monto = 1;
  assert.equal(construirPresentacionBorrador(data).tieneAsignaciones, true);
});

test("identifica ramas incompletas y datos monetarios inválidos", () => {
  const data = datos();
  data.subprogramas = [{ id: "sin-padre", programa_id: "inexistente", codigo: "20 1", nombre: "Rama" }];
  data.ingresos[0].presupuesto_proyectado = "inválido";
  const modelo = construirPresentacionBorrador(data);
  assert.equal(modelo.ramasSinPadre, 1);
  assert.equal(modelo.propios, null);
  assert.equal(modelo.total, null);
});
