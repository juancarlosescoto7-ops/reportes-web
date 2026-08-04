import test from "node:test";
import assert from "node:assert/strict";
import {
  compactarOpcionesPresupuesto,
  construirSchemaRecomendacionesPresupuesto,
  convertirRespuestaModeloARecomendaciones,
  crearClaveCxp,
  crearRecomendacionDesdeSeleccion,
  esCxpCandidataParaRecomendacion,
  prepararCxpParaRecomendacion,
} from "./recomendaciones-presupuesto-sesion.ts";

test("selecciona una CxP por el haber y no por haber menos debe", () => {
  const cxp = {
    no_cxp: 81,
    tipo_movimiento: "CXP",
    haber: 12500,
    debe: 12500,
    monto_comprometido: 0,
    estado_administrativo: "pendiente",
    puede_comprometer: true,
  };

  assert.equal(esCxpCandidataParaRecomendacion(cxp), true);
  assert.equal(prepararCxpParaRecomendacion(cxp).montoHaber, 12500);
});

test("excluye una CxP que ya tiene compromiso", () => {
  assert.equal(
    esCxpCandidataParaRecomendacion({
      no_cxp: 82,
      haber: 1000,
      monto_comprometido: 1,
      estado_administrativo: "pendiente",
      puede_comprometer: true,
    }),
    false
  );
});

test("compacta la ruta presupuestaria y conserva los ids de compromiso", () => {
  const [opcion] = compactarOpcionesPresupuesto([
    {
      codigo: "1-01-01-001",
      programa_id: "10",
      programa_nombre: "Servicios publicos",
      sub_programa_id: "20",
      subprograma_nombre: "Aseo urbano",
      proyecto_id: "30",
      proyecto_nombre: "Recoleccion",
      actividad_id: "40",
      actividad_nombre: "Operacion de rutas",
      obra_id: "50",
      obra_nombre: "Sin obra",
      objeto: "25600",
      descripcion_objeto: "Combustibles",
      presupuesto_vigente: 100000,
      ejecutado: 20000,
      comprometido: 15000,
      ejercicio_fiscal: 2026,
    },
  ]);

  assert.equal(opcion.clave, "p1");
  assert.equal(opcion.programa, "Servicios publicos");
  assert.equal(opcion.actividadId, "40");
  assert.equal(opcion.proyectoId, "30");
  assert.equal(opcion.saldoDisponible, 65000);
});

test("la recomendacion final solo puede construirse desde una opcion conocida", () => {
  const cxp = {
    claveCxp: crearClaveCxp(81, "CXP"),
    noCxp: 81,
    tipoMovimiento: "CXP",
    fecha: "2026-08-04",
    descripcion: "Compra de combustible",
    beneficiario: "Proveedor",
    cuenta: "2111",
    montoHaber: 12500,
  };
  const [opcion] = compactarOpcionesPresupuesto([
    {
      codigo: "1-01-01-001",
      actividad_id: "40",
      proyecto_id: "30",
      descripcion_objeto: "Combustibles",
      presupuesto_vigente: 100000,
    },
  ]);
  const recomendacion = crearRecomendacionDesdeSeleccion({
    cxp,
    opcion,
    confianza: 87.6,
    explicacion: "Coincide con combustibles.",
  });

  assert.equal(recomendacion.codigoPresupuestario, "1-01-01-001");
  assert.equal(recomendacion.confianza, 88);
  assert.equal(recomendacion.actividadId, "40");
});

test("el esquema exige exactamente una propiedad por cada CxP del lote", () => {
  const cuentas = [
    {
      claveCxp: "81::CXP",
      noCxp: 81,
      tipoMovimiento: "CXP",
      fecha: null,
      descripcion: "Combustible",
      beneficiario: null,
      cuenta: null,
      montoHaber: 1000,
    },
    {
      claveCxp: "82::CXP",
      noCxp: 82,
      tipoMovimiento: "CXP",
      fecha: null,
      descripcion: "Papeleria",
      beneficiario: null,
      cuenta: null,
      montoHaber: 500,
    },
  ];
  const opciones = compactarOpcionesPresupuesto([
    { codigo: "COMB", descripcion_objeto: "Combustibles" },
    { codigo: "PAP", descripcion_objeto: "Papeleria" },
  ]);
  const schema = construirSchemaRecomendacionesPresupuesto(cuentas, opciones);

  assert.deepEqual(schema.properties.recomendaciones.required, [
    "81::CXP",
    "82::CXP",
  ]);
  assert.deepEqual(
    schema.$defs.seleccion_presupuestaria.properties.clave_presupuesto.enum,
    ["p1", "p2"]
  );

  const recomendaciones = convertirRespuestaModeloARecomendaciones(
    {
      recomendaciones: {
        "81::CXP": {
          clave_presupuesto: "p1",
          confianza: 90,
          explicacion: "Coincide con combustible.",
        },
        "82::CXP": {
          clave_presupuesto: "p2",
          confianza: 85,
          explicacion: "Coincide con papeleria.",
        },
      },
    },
    cuentas,
    opciones
  );

  assert.deepEqual(
    recomendaciones.map((item) => item.claveCxp),
    ["81::CXP", "82::CXP"]
  );
  assert.deepEqual(
    recomendaciones.map((item) => item.codigoPresupuestario),
    ["COMB", "PAP"]
  );
});
