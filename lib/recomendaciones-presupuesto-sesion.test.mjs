import test from "node:test";
import assert from "node:assert/strict";
import {
  compactarOpcionesPresupuesto,
  construirSchemaRecomendacionesPresupuesto,
  convertirRespuestaModeloARecomendaciones,
  crearClaveCxp,
  crearRecomendacionDesdeSeleccion,
  esCxpCandidataParaRecomendacion,
  incorporarSaldosGrupoPresupuesto,
  ordenarCuentasPorAntiguedad,
  prepararCxpParaRecomendacion,
  proyectarRecomendacionFinanciera,
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
  assert.equal(prepararCxpParaRecomendacion(cxp).montoPendiente, 0);
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

test("recomienda una CxP pendiente aunque aun no pueda comprometerse", () => {
  assert.equal(
    esCxpCandidataParaRecomendacion({
      no_cxp: 83,
      haber: 1000,
      monto_comprometido: 0,
      estado_administrativo: "PENDIENTE",
      puede_comprometer: false,
    }),
    true
  );
});

test("prioriza las CxP mas antiguas y deja las que no tienen fecha al final", () => {
  const cuentas = ordenarCuentasPorAntiguedad([
    {
      claveCxp: "90::CXP",
      noCxp: 90,
      tipoMovimiento: "CXP",
      fecha: null,
      descripcion: null,
      beneficiario: null,
      cuenta: null,
      montoHaber: 100,
      montoPendiente: 100,
    },
    {
      claveCxp: "20::CXP",
      noCxp: 20,
      tipoMovimiento: "CXP",
      fecha: "2026-01-15",
      descripcion: null,
      beneficiario: null,
      cuenta: null,
      montoHaber: 100,
      montoPendiente: 100,
    },
    {
      claveCxp: "10::CXP",
      noCxp: 10,
      tipoMovimiento: "CXP",
      fecha: "2025-12-01",
      descripcion: null,
      beneficiario: null,
      cuenta: null,
      montoHaber: 100,
      montoPendiente: 100,
    },
  ]);

  assert.deepEqual(
    cuentas.map((cuenta) => cuenta.noCxp),
    [10, 20, 90]
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
      contexto_cxp: "Compra de gasolina y diesel para la flota municipal.",
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
  assert.equal(opcion.saldoGrupoDisponible, null);
  assert.equal(
    opcion.contextoCxp,
    "Compra de gasolina y diesel para la flota municipal."
  );
});

test("incorpora el saldo proyectado del grupo financiero", () => {
  const opciones = compactarOpcionesPresupuesto([
    {
      codigo: "FUNC",
      programa_nombre: "Administracion",
      fuente: "11-001-01",
      tipo_inversion: "10",
    },
    {
      codigo: "INV",
      programa_nombre: "Infraestructura",
      fuente: "11-001-01",
      tipo_inversion: "20",
    },
  ]);
  const enriquecidas = incorporarSaldosGrupoPresupuesto(opciones, [
    {
      Fuente: "Transferencias",
      Tipo: "Gastos de funcionamiento",
      SaldoDisponibleProyectado: 25000,
    },
    {
      Fuente: "Transferencias",
      Tipo: "Infraestructura",
      SaldoDisponibleProyectado: 40000,
    },
  ]);

  assert.equal(enriquecidas[0].saldoGrupoDisponible, 25000);
  assert.equal(enriquecidas[1].saldoGrupoDisponible, 40000);
});

test("proyecta la recomendacion financiera con cobertura de codigo y grupo", () => {
  assert.equal(
    proyectarRecomendacionFinanciera({
      montoPendiente: 1000,
      saldoCodigoDisponible: 1500,
      saldoGrupoDisponible: 1200,
    }),
    "Pago total"
  );
  assert.equal(
    proyectarRecomendacionFinanciera({
      montoPendiente: 1000,
      saldoCodigoDisponible: 800,
      saldoGrupoDisponible: 500,
    }),
    "Pago parcial"
  );
  assert.equal(
    proyectarRecomendacionFinanciera({
      montoPendiente: 1000,
      saldoCodigoDisponible: 0,
      saldoGrupoDisponible: 500,
    }),
    "No pagar"
  );
  assert.equal(
    proyectarRecomendacionFinanciera({
      montoPendiente: 1000,
      saldoCodigoDisponible: 1500,
      saldoGrupoDisponible: null,
    }),
    "Por validar"
  );
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
    montoPendiente: 12500,
  };
  const [opcion] = compactarOpcionesPresupuesto([
    {
      codigo: "1-01-01-001",
      actividad_id: "40",
      proyecto_id: "30",
      objeto: "25600",
      descripcion_objeto: "Combustibles",
      presupuesto_vigente: 100000,
      fuente: "11-001-01",
      tipo_inversion: "10",
    },
  ]);
  const [opcionConGrupo] = incorporarSaldosGrupoPresupuesto([opcion], [
    {
      Fuente: "Transferencias",
      Tipo: "Gastos de funcionamiento",
      SaldoDisponibleProyectado: 50000,
    },
  ]);
  const recomendacion = crearRecomendacionDesdeSeleccion({
    cxp,
    opcion: opcionConGrupo,
    resumenCriterio:
      "La compra coincide directamente con el objeto del gasto destinado a combustibles.",
    confianza: 91,
  });

  assert.equal(recomendacion.codigoPresupuestario, "1-01-01-001");
  assert.equal(recomendacion.objeto, "25600");
  assert.equal(recomendacion.descripcionObjeto, "Combustibles");
  assert.equal(recomendacion.actividadId, "40");
  assert.equal(
    recomendacion.resumenCriterio,
    "La compra coincide directamente con el objeto del gasto destinado a combustibles."
  );
  assert.equal(recomendacion.viabilidadFinanciera, "Pago total");
  assert.equal(recomendacion.confianza, 91);
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
      montoPendiente: 1000,
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
      montoPendiente: 500,
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
  assert.deepEqual(schema.$defs.seleccion_presupuestaria.required, [
    "clave_presupuesto",
    "resumen_criterio",
    "confianza",
  ]);

  const recomendaciones = convertirRespuestaModeloARecomendaciones(
    {
      recomendaciones: {
        "81::CXP": {
          clave_presupuesto: "p1",
          resumen_criterio: "Coincide con la compra de combustible.",
          confianza: 94,
        },
        "82::CXP": {
          clave_presupuesto: "p2",
          resumen_criterio: "Coincide con la compra de papeleria.",
          confianza: 78,
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
  assert.deepEqual(
    recomendaciones.map((item) => item.resumenCriterio),
    [
      "Coincide con la compra de combustible.",
      "Coincide con la compra de papeleria.",
    ]
  );
  assert.deepEqual(
    recomendaciones.map((item) => item.confianza),
    [94, 78]
  );
});
