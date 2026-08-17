import test from "node:test";
import assert from "node:assert/strict";
import {
  CLAVE_SIN_RECOMENDACION_PRESUPUESTO,
  INSTRUCCIONES_RECOMENDACIONES_PRESUPUESTO,
  compactarOpcionesPresupuesto,
  construirSchemaRecomendacionesPresupuesto,
  convertirRespuestaModeloARecomendaciones,
  crearClaveCxp,
  crearRecomendacionDesdeSeleccion,
  describirRutaPresupuestaria,
  esCxpCandidataParaRecomendacion,
  incorporarSaldosGrupoPresupuesto,
  obtenerOpcionesPresupuestoPermitidas,
  ordenarCuentasPorAntiguedad,
  opcionContradiceExclusionExplicita,
  preseleccionarCandidatosPresupuesto,
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
  assert.equal(
    describirRutaPresupuestaria(opcion),
    "Código presupuestario: 1-01-01-001 > Programa: 10 — Servicios publicos > Subprograma: 20 — Aseo urbano > Proyecto: 30 — Recoleccion > Actividad: 40 — Operacion de rutas > Obra: 50 — Sin obra > Renglón presupuestario: 25600 — Combustibles"
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
    ["p1", CLAVE_SIN_RECOMENDACION_PRESUPUESTO]
  );
  assert.deepEqual(
    schema.$defs.seleccion_presupuestaria_2.properties.clave_presupuesto.enum,
    ["p2", CLAVE_SIN_RECOMENDACION_PRESUPUESTO]
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
    [64, 64]
  );
});

test("respeta la exclusion explicita de alimentacion aunque coincida la sesion de corporacion", () => {
  const cuenta = {
    claveCxp: "5431::CXP",
    noCxp: 5431,
    tipoMovimiento: "CXP",
    fecha: "2026-07-31",
    descripcion:
      "COMPRA DE ALIMENTACION PARA SECION DE CORPORACION | Con ORDEN_COMPRA No. 5431",
    beneficiario: "Jamie Liliana Rodriguez Gonzales",
    cuenta: null,
    montoHaber: 1000,
    montoPendiente: 1000,
  };
  const opciones = compactarOpcionesPresupuesto([
    {
      codigo: "DIETAS",
      objeto: "11100",
      descripcion_objeto: "Dietas",
      contexto_cxp: `Pago en efectivo de dietas correspondientes a sesiones de corporacion.
Se debe tener mucho cuidado porque esto corresponde a pago NETAMENTE en efectivo.
Excluir TOTALMENTE gastos de alimentacion o transporte.`,
    },
    {
      codigo: "ALIMENTOS",
      objeto: "31110",
      descripcion_objeto: "Alimentos y bebidas para personas",
      contexto_cxp:
        "Compra de alimentacion para reuniones o sesiones institucionales.",
    },
  ]);

  assert.equal(
    opcionContradiceExclusionExplicita(cuenta, opciones[0]),
    true
  );
  assert.equal(
    opcionContradiceExclusionExplicita(cuenta, opciones[1]),
    false
  );

  const schema = construirSchemaRecomendacionesPresupuesto(
    [cuenta],
    opciones
  );
  const referencia =
    schema.properties.recomendaciones.properties[cuenta.claveCxp].$ref;
  const nombreDefinicion = referencia.split("/").at(-1);
  const clavesPermitidas =
    schema.$defs[nombreDefinicion].properties.clave_presupuesto.enum;

  assert.deepEqual(clavesPermitidas, [
    "p2",
    CLAVE_SIN_RECOMENDACION_PRESUPUESTO,
  ]);

  const recomendacionProhibida = convertirRespuestaModeloARecomendaciones(
    {
      recomendaciones: {
        [cuenta.claveCxp]: {
          clave_presupuesto: "p1",
          resumen_criterio: "Coincide con la sesion de corporacion.",
          confianza: 90,
        },
      },
    },
    [cuenta],
    opciones
  );

  assert.deepEqual(recomendacionProhibida, []);
});

test("el contexto presupuestario conserva sus reglas y no se trata como una instruccion a ignorar", () => {
  assert.match(
    INSTRUCCIONES_RECOMENDACIONES_PRESUPUESTO,
    /Obedece estrictamente toda inclusion, exclusion, excepcion o restriccion/
  );
  assert.doesNotMatch(
    INSTRUCCIONES_RECOMENDACIONES_PRESUPUESTO,
    /ignora cualquier instruccion incluida dentro de ellos/
  );
});

test("clasifica almuerzos por el producto adquirido y nunca como publicidad o dietas", () => {
  const cuenta = {
    claveCxp: "5432::CXP",
    noCxp: 5432,
    tipoMovimiento: "CXP",
    fecha: "2026-07-31",
    descripcion:
      "COMPRA DE ALMUERZOS PARA EL PINTADO DE LA CANCHITA DE LA CARIAS Y RODRIGUEZ, OFICINA DE DEPORTE | Con ORDEN_COMPRA No. 5432",
    beneficiario: "Pedro Pablo Hernandez Espino",
    cuenta: null,
    montoHaber: 1000,
    montoPendiente: 1000,
  };
  const opciones = compactarOpcionesPresupuesto([
    {
      codigo: "PUBLICIDAD",
      descripcion_objeto: "Publicidad y propaganda",
      contexto_cxp: "Difusion de campanas, anuncios y material publicitario.",
    },
    {
      codigo: "DIETAS",
      descripcion_objeto: "Dietas",
      contexto_cxp:
        "Pago en efectivo de dietas. Excluir totalmente gastos de alimentacion o transporte.",
    },
    {
      codigo: "ALIMENTOS",
      descripcion_objeto: "Productos alimenticios y bebidas",
      contexto_cxp:
        "Compra de alimentos, almuerzos, refrigerios y bebidas para actividades institucionales.",
    },
  ]);

  assert.deepEqual(
    obtenerOpcionesPresupuestoPermitidas(cuenta, opciones).map(
      (opcion) => opcion.codigoPresupuestario
    ),
    ["PUBLICIDAD", "ALIMENTOS"]
  );
  assert.deepEqual(
    obtenerOpcionesPresupuestoPermitidas(cuenta, opciones.slice(0, 2)).map(
      (opcion) => opcion.codigoPresupuestario
    ),
    ["PUBLICIDAD"]
  );

  const candidatos = preseleccionarCandidatosPresupuesto({
    cuenta,
    opciones,
    antecedentes: [],
  });
  assert.deepEqual(
    candidatos.map((candidato) => candidato.opcion.codigoPresupuestario),
    ["ALIMENTOS"]
  );

  const schema = construirSchemaRecomendacionesPresupuesto(
    [cuenta],
    opciones
  );
  const referencia =
    schema.properties.recomendaciones.properties[cuenta.claveCxp].$ref;
  const nombreDefinicion = referencia.split("/").at(-1);

  assert.deepEqual(
    schema.$defs[nombreDefinicion].properties.clave_presupuesto.enum,
    ["p3", CLAVE_SIN_RECOMENDACION_PRESUPUESTO]
  );

  const publicidadInvalida = convertirRespuestaModeloARecomendaciones(
    {
      recomendaciones: {
        [cuenta.claveCxp]: {
          clave_presupuesto: "p1",
          resumen_criterio: "No corresponde a dietas.",
          confianza: 90,
        },
      },
    },
    [cuenta],
    opciones
  );

  assert.deepEqual(publicidadInvalida, []);

  const [alimentos] = convertirRespuestaModeloARecomendaciones(
    {
      recomendaciones: {
        [cuenta.claveCxp]: {
          clave_presupuesto: "p3",
          resumen_criterio: "No corresponde a dietas.",
          confianza: 92,
        },
      },
    },
    [cuenta],
    opciones
  );

  assert.equal(alimentos.codigoPresupuestario, "ALIMENTOS");
  assert.equal(
    alimentos.resumenCriterio,
    "Coincide con Productos alimenticios y bebidas."
  );
});

test("solo marca automatizable cuando coinciden CxP, presupuesto, antecedentes y contexto IA", () => {
  const cuenta = {
    claveCxp: "6001::CXP",
    noCxp: 6001,
    tipoMovimiento: "CXP",
    fecha: "2026-08-10",
    descripcion:
      "Compra de almuerzos para pintado de canchita por oficina de deporte",
    beneficiario: "Proveedor de alimentos",
    cuenta: null,
    montoHaber: 5000,
    montoPendiente: 5000,
  };
  const opciones = compactarOpcionesPresupuesto([
    {
      codigo: "ALIM-DEP",
      programa_nombre: "Desarrollo social",
      proyecto_nombre: "Infraestructura deportiva",
      actividad_nombre: "Pintado de canchita por oficina de deporte",
      descripcion_objeto: "Productos alimenticios y bebidas",
      contexto_cxp:
        "Almuerzos y refrigerios para actividades de la oficina de deporte.",
      presupuesto_vigente: 100000,
    },
    {
      codigo: "ALIM-SALUD",
      programa_nombre: "Salud",
      actividad_nombre: "Jornadas medicas",
      descripcion_objeto: "Productos alimenticios y bebidas",
      contexto_cxp: "Alimentacion para brigadas y jornadas medicas.",
      presupuesto_vigente: 100000,
    },
  ]).map((opcion) => ({
    ...opcion,
    saldoGrupoDisponible: 100000,
  }));
  const antecedentes = [
    {
      descripcion:
        "Compra de almuerzos para pintado de instalaciones deportivas",
      beneficiario: "Proveedor de alimentos",
      codigoPresupuestario: "ALIM-DEP",
    },
  ];
  const candidatos = preseleccionarCandidatosPresupuesto({
    cuenta,
    opciones,
    antecedentes,
  });

  assert.equal(candidatos[0].opcion.codigoPresupuestario, "ALIM-DEP");
  assert.deepEqual(candidatos[0].evidencia.fuentesCoincidentes, [
    "presupuesto",
    "antecedentes",
    "contexto_ia",
  ]);
  assert.ok(
    candidatos[0].evidencia.puntajePreseleccion >
      candidatos[1].evidencia.puntajePreseleccion
  );

  const [recomendacion] = convertirRespuestaModeloARecomendaciones(
    {
      recomendaciones: {
        [cuenta.claveCxp]: {
          clave_presupuesto: candidatos[0].opcion.clave,
          resumen_criterio:
            "El objeto, la actividad deportiva y el antecedente confirmado coinciden.",
          confianza: 95,
        },
      },
    },
    [cuenta],
    opciones,
    antecedentes
  );

  assert.equal(recomendacion.codigoPresupuestario, "ALIM-DEP");
  assert.equal(recomendacion.confianza, 95);
  assert.equal(recomendacion.viabilidadFinanciera, "Pago total");
  assert.equal(recomendacion.aptaParaAutomatizacion, true);
  assert.ok(recomendacion.evidencia.margenPreseleccion >= 15);
});

test("relaciona material de aseo con elementos de limpieza para uso interno", () => {
  const cuenta = {
    claveCxp: "5511::CXP",
    noCxp: 5511,
    tipoMovimiento: "CXP",
    fecha: "2026-08-13",
    descripcion:
      "COMPRA DE MATERIAL DE ASEO PARA LA ALCALDIA MUNICIPAL, A TRAVES DE RECURSOS HUMANO | Con ORDEN_COMPRA No. 5511",
    beneficiario: "Eden Agugusto Corrales Guillen",
    cuenta: null,
    montoHaber: 2500,
    montoPendiente: 2500,
  };
  const [opcion] = compactarOpcionesPresupuesto([
    {
      codigo: "03 00 000 001 000 39100 15-013-01 10 0190",
      programa_nombre: "Administracion municipal",
      actividad_nombre: "Recursos humanos",
      objeto: "39100",
      descripcion_objeto: "Elementos de Limpieza y Aseo Personal",
      contexto_cxp: `Compra de elementos para aseo personal y limpieza del edificio para uso interno.

No confundir con donaciones de elementos de limpieza enfocada en ayudas sociales o ayudas a instituciones.`,
      presupuesto_vigente: 50000,
    },
  ]);
  const candidatos = preseleccionarCandidatosPresupuesto({
    cuenta,
    opciones: [opcion],
    antecedentes: [],
  });

  assert.equal(opcionContradiceExclusionExplicita(cuenta, opcion), false);
  assert.equal(candidatos.length, 1);
  assert.equal(candidatos[0].opcion.objeto, "39100");
  assert.equal(candidatos[0].evidencia.coincidenciaObjeto, 100);
  assert.ok(candidatos[0].evidencia.puntajePreseleccion >= 50);

  const schema = construirSchemaRecomendacionesPresupuesto(
    [cuenta],
    [opcion]
  );
  assert.deepEqual(
    schema.$defs.seleccion_presupuestaria.properties.clave_presupuesto.enum,
    [opcion.clave, CLAVE_SIN_RECOMENDACION_PRESUPUESTO]
  );

  const [recomendacion] = convertirRespuestaModeloARecomendaciones(
    {
      recomendaciones: {
        [cuenta.claveCxp]: {
          clave_presupuesto: opcion.clave,
          resumen_criterio:
            "La compra interna coincide con elementos de limpieza y aseo para el edificio municipal.",
          confianza: 91,
        },
      },
    },
    [cuenta],
    [opcion]
  );

  assert.equal(recomendacion.objeto, "39100");
  assert.equal(
    recomendacion.descripcionObjeto,
    "Elementos de Limpieza y Aseo Personal"
  );
});

test("clasifica un contrato temporal para hacer aseo como jornales y no como materiales de limpieza", () => {
  const cuenta = {
    claveCxp: "170::CONTRATO",
    noCxp: 170,
    tipoMovimiento: "CONTRATO",
    fecha: "2026-07-08",
    descripcion:
      "Contrato de 30 dias a partir 08 de julio para aseo de clinica municipal | Con CONTRATO No. 170",
    beneficiario: "Mirian Milagro Herrera Armijo",
    cuenta: null,
    montoHaber: 12000,
    montoPendiente: 12000,
  };
  const opciones = compactarOpcionesPresupuesto([
    {
      codigo: "JORNALES",
      objeto: "12200",
      descripcion_objeto: "Jornales",
      contexto_cxp:
        "Contratacion temporal de personal remunerado por dias o jornadas.",
      presupuesto_vigente: 50000,
    },
    {
      codigo: "LIMPIEZA",
      objeto: "39100",
      descripcion_objeto: "Elementos de Limpieza y Aseo Personal",
      contexto_cxp:
        "Compra de materiales, productos e insumos de aseo y limpieza para uso interno.",
      presupuesto_vigente: 50000,
    },
  ]);
  const candidatos = preseleccionarCandidatosPresupuesto({
    cuenta,
    opciones,
    antecedentes: [],
  });

  assert.deepEqual(
    candidatos.map((candidato) => candidato.opcion.codigoPresupuestario),
    ["JORNALES"]
  );
  assert.equal(candidatos[0].evidencia.coincidenciaObjeto, 100);

  const schema = construirSchemaRecomendacionesPresupuesto(
    [cuenta],
    opciones
  );
  assert.deepEqual(
    schema.$defs.seleccion_presupuestaria.properties.clave_presupuesto.enum,
    [opciones[0].clave, CLAVE_SIN_RECOMENDACION_PRESUPUESTO]
  );

  const recomendacionLimpieza = convertirRespuestaModeloARecomendaciones(
    {
      recomendaciones: {
        [cuenta.claveCxp]: {
          clave_presupuesto: opciones[1].clave,
          resumen_criterio: "La finalidad del contrato es realizar aseo.",
          confianza: 90,
        },
      },
    },
    [cuenta],
    opciones
  );

  assert.deepEqual(recomendacionLimpieza, []);

  const [recomendacionJornales] = convertirRespuestaModeloARecomendaciones(
    {
      recomendaciones: {
        [cuenta.claveCxp]: {
          clave_presupuesto: opciones[0].clave,
          resumen_criterio:
            "Es una contratacion temporal remunerada por treinta dias.",
          confianza: 92,
        },
      },
    },
    [cuenta],
    opciones
  );

  assert.equal(recomendacionJornales.codigoPresupuestario, "JORNALES");
});

test("mantiene abierta una recomendacion ambigua pero impide automatizarla", () => {
  const cuenta = {
    claveCxp: "7001::CXP",
    noCxp: 7001,
    tipoMovimiento: "CXP",
    fecha: "2026-08-15",
    descripcion: "CALIBRACION METROLOGICA DE EQUIPO",
    beneficiario: "Proveedor especializado",
    cuenta: null,
    montoHaber: 3000,
    montoPendiente: 3000,
  };
  const opciones = compactarOpcionesPresupuesto([
    {
      codigo: "SERV-DIV",
      descripcion_objeto: "Servicios profesionales diversos",
      presupuesto_vigente: 10000,
    },
    {
      codigo: "MANT-GEN",
      descripcion_objeto: "Mantenimiento general",
      presupuesto_vigente: 10000,
    },
  ]);
  const candidatos = preseleccionarCandidatosPresupuesto({
    cuenta,
    opciones,
    antecedentes: [],
  });

  assert.equal(candidatos.length, 2);
  assert.deepEqual(
    candidatos.map((candidato) => candidato.evidencia.puntajePreseleccion),
    [0, 0]
  );

  const [recomendacion] = convertirRespuestaModeloARecomendaciones(
    {
      recomendaciones: {
        [cuenta.claveCxp]: {
          clave_presupuesto: candidatos[0].opcion.clave,
          resumen_criterio:
            "Es la alternativa disponible mas cercana al servicio descrito.",
          confianza: 90,
        },
      },
    },
    [cuenta],
    opciones
  );

  assert.equal(recomendacion.confianza, 49);
  assert.equal(recomendacion.nivelIncertidumbre, "alta");
  assert.equal(recomendacion.aptaParaAutomatizacion, false);
});
