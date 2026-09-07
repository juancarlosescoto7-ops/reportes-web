import assert from "node:assert/strict";
import test from "node:test";

import {
  agruparOrdenesCompraPorOrdenPago,
  construirTextoDetalleOrdenPago,
  normalizarOrdenesCompraPagadas,
} from "./ordenes-compra-pagadas.ts";

test("conserva cada orden de compra pagada como una relacion independiente", () => {
  const compras = normalizarOrdenesCompraPagadas([
    {
      no_orden_pago: "80",
      no_cxp: "501",
      tipo_movimiento: "Orden de compra",
      debe: "1250.50",
    },
    {
      no_orden_pago: 80,
      no_cxp: 502,
      tipo_movimiento: "Orden de compra",
      debe: 750,
    },
  ]);

  assert.equal(compras.length, 2);
  assert.deepEqual(
    compras.map((compra) => compra.noOrdenCompra),
    [501, 502]
  );

  const agrupadas = agruparOrdenesCompraPorOrdenPago(compras);
  assert.deepEqual(
    agrupadas.get(80)?.map((compra) => compra.noOrdenCompra),
    [501, 502]
  );
});

test("descarta relaciones invalidas y suma filas de una misma CxP", () => {
  const compras = normalizarOrdenesCompraPagadas([
    {
      no_orden_pago: null,
      no_cxp: 501,
      tipo_movimiento: null,
      debe: null,
    },
    {
      no_orden_pago: 80,
      no_cxp: 501,
      tipo_movimiento: "OC",
      debe: 100,
    },
    {
      no_orden_pago: 80,
      no_cxp: 501,
      tipo_movimiento: "OC",
      debe: 125,
    },
  ]);

  assert.equal(compras.length, 1);
  assert.equal(compras[0].montoPago, 225);
});

test("construye un detalle de orden de pago como texto copiable", () => {
  const texto = construirTextoDetalleOrdenPago(
    {
      no_orden: "7511",
      fecha: "2026-07-24",
      descripcion: "Compra de equipo",
      total_haber: 2242.5,
      total_ejecutado: 2242.5,
      diferencia: 0,
      beneficiarios: [
        {
          id: "0801",
          nombre: "Proveedor",
          no_cheque: "420",
          haber: 2242.5,
          ejecuciones: [
            {
              codigo_presupuestario: "1.2.3",
              monto_ejecutado: 2242.5,
            },
          ],
        },
      ],
    },
    [
      {
        noOrdenPago: 7511,
        noOrdenCompra: 5167,
        tipoMovimiento: "ORDEN_COMPRA",
        montoPago: 2242.5,
      },
    ],
    (monto) => `L ${monto.toFixed(2)}`
  );

  assert.match(texto, /ORDEN DE PAGO #7511/);
  assert.match(texto, /Orden de compra #5167/);
  assert.match(texto, /Cheque: 420/);
  assert.match(texto, /1\.2\.3: L 2242\.50/);
});
