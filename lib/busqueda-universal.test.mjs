import assert from "node:assert/strict";
import test from "node:test";

import {
  buscarEnIndiceUniversal,
  construirIndiceBusquedaUniversal,
  extraerTemaConsulta,
} from "./busqueda-universal.ts";

const fuentes = {
  ordenes: [
    {
      orden_pago_id: 55,
      no_orden: "120",
      fecha: "2026-08-14",
      descripcion: "Compra de materiales eléctricos",
      total_haber: 12500,
      total_ejecutado: 12500,
      diferencia: 0,
      beneficiarios: [
        {
          id: "RTN-001",
          nombre: "Comercial La Estrella",
          no_cheque: "804",
          haber: 12500,
          ejecuciones: [
            {
              codigo_presupuestario: "01-02-300",
              monto_ejecutado: 12500,
            },
          ],
        },
      ],
    },
  ],
  cuentasPorPagar: [
    {
      cxp_id: 9,
      fecha: "2026-08-14",
      descripcion: "Factura por materiales",
      no_cxp: 44,
      tipo_movimiento: "OC",
      cuenta: "Proveedores",
      beneficiario_id: "RTN-001",
      beneficiario_nombre: "Comercial La Estrella",
      estado_administrativo: "pendiente",
      estado_operativo: "comprometida",
      haber: 12500,
      debe: 0,
      monto_comprometido: 12500,
      saldo_por_comprometer: 0,
      no_orden_pago: 120,
      monto_pagado: 0,
      monto_ejecutado_presupuestario: 0,
      saldo_por_ejecutar: 12500,
      detalle_codigos: [{ codigo_presupuestario: "01-02-300" }],
    },
  ],
  documentosPendientes: [
    {
      documentoId: "doc-1",
      noOrden: 120,
      nombreDocumento: "Constancia fiscal",
      observacion: "Falta firma",
      fechaRegistro: "2026-08-14T10:00:00Z",
      usuarioRegistro: "tesoreria",
      fechaOrden: "2026-08-14",
      descripcionOrden: "Compra de materiales eléctricos",
      totalEgreso: 12500,
    },
  ],
  ordenesDocumentales: [
    {
      noOrden: 120,
      fecha: "2026-08-14",
      descripcion: "Compra de materiales eléctricos",
      nombreDocumento: "Orden_pago_120.pdf",
      rutaDocumento: "ordenes_pago/Orden_pago_120.pdf",
      tieneDocumento: true,
    },
  ],
  presupuesto: [
    {
      programa_id: "10",
      programa_nombre: "Desarrollo humano",
      sub_programa_id: "20",
      subprograma_nombre: "Bienestar comunitario",
      proyecto_id: "30",
      proyecto_nombre: "Fomento al deporte",
      actividad_id: "40",
      actividad_nombre: "Escuelas de Deportes",
      obra_id: "50",
      obra_nombre: "Cancha municipal",
      codigo: "01-02-300",
      objeto: "35610",
      descripcion_objeto: "Material deportivo",
      presupuesto_vigente: 90000,
      ejecutado: 12500,
      contexto_cxp: "Implementos para actividades deportivas",
    },
  ],
};

test("relaciona un proveedor con egresos, CxP y documentos de su orden", () => {
  const indice = construirIndiceBusquedaUniversal(fuentes);
  const resultados = buscarEnIndiceUniversal(indice, "Comercial La Estrella");

  assert.deepEqual(
    new Set(resultados.map((resultado) => resultado.categoria)),
    new Set([
      "egreso",
      "cuenta-por-pagar",
      "documento-pendiente",
      "orden-de-pago",
    ])
  );
});

test("encuentra montos escritos con formato contable", () => {
  const indice = construirIndiceBusquedaUniversal(fuentes);
  const resultados = buscarEnIndiceUniversal(indice, "L 12,500.00");

  assert.ok(resultados.length >= 5);
  assert.ok(
    resultados.some(
      (resultado) => resultado.categoria === "presupuesto" && resultado.monto === 90000
    )
  );
  assert.ok(
    resultados.some(
      (resultado) => resultado.categoria === "egreso" && resultado.monto === 12500
    )
  );
});

test("entiende fechas ISO, locales y con el mes en español", () => {
  const indice = construirIndiceBusquedaUniversal(fuentes);

  assert.ok(buscarEnIndiceUniversal(indice, "2026-08-14").length >= 4);
  assert.ok(buscarEnIndiceUniversal(indice, "14/08/2026").length >= 4);
  assert.ok(buscarEnIndiceUniversal(indice, "14 agosto 2026").length >= 4);
});

test("los resultados llevan al módulo y registro correspondiente", () => {
  const indice = construirIndiceBusquedaUniversal(fuentes);
  const documento = buscarEnIndiceUniversal(indice, "Constancia fiscal")[0];

  assert.equal(
    documento.href,
    "/reportes/ordenes-de-pago?orden=120&documentos=120"
  );
});

test("propaga el contexto presupuestario a todos los registros relacionados", () => {
  const indice = construirIndiceBusquedaUniversal(fuentes);
  const resultados = buscarEnIndiceUniversal(indice, "Deportes");

  assert.deepEqual(
    new Set(resultados.map((resultado) => resultado.categoria)),
    new Set([
      "presupuesto",
      "egreso",
      "cuenta-por-pagar",
      "documento-pendiente",
      "orden-de-pago",
    ])
  );
});

test("extrae el tema útil de una pregunta conversacional", () => {
  assert.equal(
    extraerTemaConsulta('Necesito saber el presupuesto de "Educación"'),
    "educacion"
  );
  assert.equal(
    extraerTemaConsulta("Muéstrame todo lo relacionado con Deportes"),
    "deportes"
  );
});
