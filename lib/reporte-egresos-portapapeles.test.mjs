import assert from "node:assert/strict";
import test from "node:test";

import { construirTablaReporteEgresosParaExcel } from "./reporte-egresos-portapapeles.ts";

test("construye una tabla tabulada lista para pegar en Excel", () => {
  const tabla = construirTablaReporteEgresosParaExcel([
    {
      noOrden: "00041",
      fecha: "01/07/2026",
      descripcion: "Pago de energía\ny agua",
      cheque: "00091",
      beneficiario: "Proveedor municipal",
      monto: 1000.5,
    },
    {
      noOrden: "42",
      fecha: "02/07/2026",
      descripcion: "=SUM(A1:A2)",
      cheque: "92",
      beneficiario: "Otro proveedor",
      monto: 250,
    },
  ]);

  const filas = tabla.texto.split("\r\n");

  assert.equal(
    filas[0],
    "No. de orden\tFecha\tDescripción\tCheque\tBeneficiario\tMonto"
  );
  assert.equal(
    filas[1],
    "'00041\t01/07/2026\tPago de energía y agua\t'00091\tProveedor municipal\t1000.50"
  );
  assert.match(filas[2], /\t'=SUM\(A1:A2\)\t/);
  assert.equal(filas[3], "\t\t\t\tTotal\t1250.50");
  assert.equal(tabla.total, 1250.5);
});

test("genera una alternativa HTML con texto seguro y montos numericos", () => {
  const tabla = construirTablaReporteEgresosParaExcel([
    {
      noOrden: "1",
      fecha: "01/07/2026",
      descripcion: "Pago <urgente>",
      cheque: "2",
      beneficiario: "A & B",
      monto: 125.25,
    },
  ]);

  assert.match(tabla.html, /Pago &lt;urgente&gt;/);
  assert.match(tabla.html, /A &amp; B/);
  assert.match(tabla.html, /mso-number-format:'0\.00'/);
  assert.match(tabla.html, />125\.25<\/td>/);
});
