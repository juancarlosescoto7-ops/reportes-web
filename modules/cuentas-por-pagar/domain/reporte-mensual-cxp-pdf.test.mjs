import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { generarReportesMensualesCxpPdf } from "./reporte-mensual-cxp-pdf.ts";
import { construirReporteMensualCxp, prepararDocumentoMensualCxp } from "./reporte-mensual-cxp.ts";

const membrete = await sharp(await readFile(new URL("../../../public/membrete.svg", import.meta.url))).resize({ width: 2400 }).png().toBuffer();
const documento = (periodo) => prepararDocumentoMensualCxp(construirReporteMensualCxp({ cuentas: [], historial: [] }, periodo), "2026");

test("cada mes comienza en una página independiente, incluso sin cuentas", async () => {
  const bytes = await generarReportesMensualesCxpPdf([documento("2026-01"), documento("2026-02")], membrete);
  const pdf = await PDFDocument.load(bytes);
  assert.equal(pdf.getPageCount(), 2);
  assert.deepEqual(pdf.getPage(0).getSize(), { width: 612, height: 792 });
});

test("paginas extensas no impiden generar el PDF ni separar el siguiente mes", async () => {
  const enero = documento("2026-01");
  enero.filas = [{ numero: 1, acreedor: "Proveedor de prueba", monto: 1250.5, descripcion: "Descripción de una compra municipal de materiales. ".repeat(200) }];
  enero.total = 1250.5;
  const individual = await PDFDocument.load(await generarReportesMensualesCxpPdf([enero], membrete));
  const conjunto = await PDFDocument.load(await generarReportesMensualesCxpPdf([enero, documento("2026-02")], membrete));
  assert.ok(individual.getPageCount() > 1);
  assert.equal(conjunto.getPageCount(), individual.getPageCount() + 1);
});
