import assert from "node:assert/strict";
import test from "node:test";

import {
  CONTEXTOS_DOCUMENTALES_CXP_INICIALES,
  crearCodigoCatalogo,
  detectarContextosPorReglas,
  esDescripcionCuentaPorPagarNula,
  normalizarContextoDocumentalCxp,
  resolverRequisitosContextos,
} from "./requisitos-documentales-cxp.ts";

test("reconoce exclusivamente la descripción NULA", () => {
  assert.equal(esDescripcionCuentaPorPagarNula("NULA"), true);
  assert.equal(esDescripcionCuentaPorPagarNula("  nula  "), true);
  assert.equal(esDescripcionCuentaPorPagarNula("Cuenta nula"), false);
  assert.equal(esDescripcionCuentaPorPagarNula("ANULADA"), false);
  assert.equal(esDescripcionCuentaPorPagarNula(null), false);
});

test("los medicamentos para la clínica reemplazan la liquidación por acta de entrega", () => {
  const codigos = detectarContextosPorReglas(
    "Compra de medicamentos para la clínica municipal",
    CONTEXTOS_DOCUMENTALES_CXP_INICIALES
  );
  const resultado = resolverRequisitosContextos(
    CONTEXTOS_DOCUMENTALES_CXP_INICIALES,
    codigos
  );

  assert.deepEqual(
    resultado.requisitos.map((item) => item.codigo),
    ["SOLICITUD", "ACTA_ENTREGA"]
  );
});

test("un pasivo laboral obtiene el expediente específico", () => {
  const codigos = detectarContextosPorReglas(
    "Pago de prestaciones laborales por renuncia",
    CONTEXTOS_DOCUMENTALES_CXP_INICIALES
  );
  const resultado = resolverRequisitosContextos(
    CONTEXTOS_DOCUMENTALES_CXP_INICIALES,
    codigos
  );

  assert.deepEqual(
    resultado.requisitos.map((item) => item.codigo),
    [
      "CALCULO_PRESTACIONES",
      "NOTA_RECURSOS_HUMANOS",
      "FINIQUITO",
      "RENUNCIA_O_DESPIDO",
    ]
  );
});

for (const caso of [
  {
    nombre: "materiales para un proyecto",
    descripcion: "Compra de materiales para un proyecto municipal",
    esperados: ["REQUISICION_MATERIALES", "PERFIL_PROYECTO"],
  },
  {
    nombre: "alimentación para una actividad interna",
    descripcion: "Compra de alimentación y refrigerios para actividad interna",
    esperados: [
      "MEMORANDUM_ALCALDE",
      "SOLICITUD",
      "LISTADO_ASISTENCIA",
    ],
  },
  {
    nombre: "un contrato",
    descripcion: "Pago de contrato por servicios profesionales",
    esperados: ["SOLICITUD_CONTRATO", "LIQUIDACION", "PERFIL"],
  },
]) {
  test(`clasifica ${caso.nombre}`, () => {
    const codigos = detectarContextosPorReglas(
      caso.descripcion,
      CONTEXTOS_DOCUMENTALES_CXP_INICIALES
    );
    const resultado = resolverRequisitosContextos(
      CONTEXTOS_DOCUMENTALES_CXP_INICIALES,
      codigos
    );

    assert.deepEqual(
      resultado.requisitos.map((item) => item.codigo),
      caso.esperados
    );
  });
}

test("combina contextos específicos sin agregar los requisitos generales", () => {
  const resultado = resolverRequisitosContextos(
    CONTEXTOS_DOCUMENTALES_CXP_INICIALES,
    ["GENERAL", "CONTRATO", "MATERIALES_PROYECTO"]
  );

  assert.deepEqual(
    resultado.contextos.map((item) => item.codigo),
    ["MATERIALES_PROYECTO", "CONTRATO"]
  );
  assert.equal(
    resultado.requisitos.some((item) => item.codigo === "SOLICITUD"),
    false
  );
  assert.equal(
    resultado.requisitos.some((item) => item.codigo === "PERFIL_PROYECTO"),
    true
  );
  assert.equal(
    resultado.requisitos.some((item) => item.codigo === "LIQUIDACION"),
    true
  );
});

test("usa requisitos generales cuando no existe una regla aplicable", () => {
  const codigos = detectarContextosPorReglas(
    "Pago de un concepto todavía no catalogado",
    CONTEXTOS_DOCUMENTALES_CXP_INICIALES
  );
  const resultado = resolverRequisitosContextos(
    CONTEXTOS_DOCUMENTALES_CXP_INICIALES,
    codigos
  );

  assert.deepEqual(codigos, ["GENERAL"]);
  assert.deepEqual(
    resultado.requisitos.map((item) => item.codigo),
    ["SOLICITUD", "LIQUIDACION"]
  );
});

test("normaliza filas dinámicas de Supabase y descarta requisitos inválidos", () => {
  const contexto = normalizarContextoDocumentalCxp({
    id: "contexto-1",
    codigo: "mantenimiento vehículos",
    nombre: "Mantenimiento de vehículos",
    descripcion: "Reparación en taller",
    palabras_clave: ["taller", "reparación"],
    ejemplos: ["Cambio de frenos"],
    requisitos: [
      { nombre: "Orden de trabajo", descripcion: "Ingreso al taller" },
      { codigo: "", nombre: "" },
    ],
    es_general: false,
    activo: true,
    prioridad: 25,
    origen: "USUARIO",
  });

  assert.equal(crearCodigoCatalogo("Cálculo de prestaciones"), "CALCULO_DE_PRESTACIONES");
  assert.deepEqual(contexto, {
    id: "contexto-1",
    codigo: "MANTENIMIENTO_VEHICULOS",
    nombre: "Mantenimiento de vehículos",
    descripcion: "Reparación en taller",
    palabrasClave: ["taller", "reparación"],
    ejemplos: ["Cambio de frenos"],
    requisitos: [
      {
        codigo: "ORDEN_DE_TRABAJO",
        nombre: "Orden de trabajo",
        descripcion: "Ingreso al taller",
      },
    ],
    esGeneral: false,
    activo: true,
    prioridad: 25,
    origen: "USUARIO",
  });
});
