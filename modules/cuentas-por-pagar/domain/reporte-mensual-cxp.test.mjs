import test from "node:test";
import assert from "node:assert/strict";
import { construirReporteMensualCxp, corteMensual, documentoMensualCxp, periodosCerrados, prepararDocumentoMensualCxp } from "./reporte-mensual-cxp.ts";

const cuenta = (cambios = {}) => ({ id: "1", no_cxp: "100", tipo_movimiento: "ORDEN_COMPRA", fecha: "2026-01-10", descripcion: "Materiales", haber: 1000, debe: 0, estado: "pendiente", fecha_pago: null, fecha_anulacion: null, proveedor_id: "P1", proveedor_nombre: "Proveedor Uno", ...cambios });
const pago = (fecha, monto, cambios = {}) => ({ id: `${fecha}-${monto}`, no_cxp: "100", tipo_movimiento: "ORDEN_COMPRA", accion: "pago_parcial_con_compromiso", metadata: { fecha_pago: fecha, monto_pago: monto }, ...cambios });
const reporte = (cuentas, historial = [], mes = "2026-01") => construirReporteMensualCxp({ cuentas, historial }, mes);

test("conserva una cuenta pendiente en enero aunque se liquidó en febrero", () => {
  const datos = [cuenta({ estado: "pagado", debe: 1000, fecha_pago: "2026-02-10" })];
  assert.equal(reporte(datos).total, 1000);
  assert.equal(reporte(datos, [], "2026-02").cantidad, 0);
});

test("incluye obligaciones arrastradas y excluye las posteriores al cierre", () => {
  assert.equal(reporte([cuenta({ fecha: "2025-12-10" }), cuenta({ id: "2", fecha: "2026-02-01" })]).total, 1000);
});

test("incluye el último día y descuenta únicamente los abonos hasta el corte", () => {
  const resultado = reporte([cuenta({ debe: 500 })], [pago("2026-01-31", 300), pago("2026-02-01", 200)]);
  assert.equal(resultado.total, 700);
  assert.equal(resultado.proveedores[0].cuentas[0].pagado, 300);
});

test("reconstruye saldos parciales antes de una liquidación posterior", () => {
  const datos = [cuenta({ debe: 1000, estado: "pagado", fecha_pago: "2026-03-01" })];
  const pagos = [pago("2026-01-15", 200), pago("2026-02-10", 300), pago("2026-03-01", 500)];
  assert.equal(reporte(datos, pagos).total, 800);
  assert.equal(reporte(datos, pagos, "2026-02").total, 500);
  assert.equal(reporte(datos, pagos, "2026-03").total, 0);
});

test("respeta pagos antiguos depurados sin debe registrado", () => {
  const datos = [cuenta({ debe: 0, estado: "pagado", fecha_pago: "2026-01-31" })];
  assert.equal(reporte(datos).total, 0);
  assert.equal(reporte([cuenta({ debe: 0, estado: "pagado", fecha_pago: "2026-02-01" })]).total, 1000);
});

test("no reparte el total de una orden de pago consolidada entre sus cuentas", () => {
  const datos = [cuenta({ estado: "pagado", fecha_pago: "2026-02-10" })];
  const evento = pago("2026-02-10", 5000, { accion: "pago_multiple_con_compromiso", metadata: { total_pago: 5000, fecha_pago: "2026-02-10" } });
  assert.equal(reporte(datos, [evento]).total, 1000);
});

test("un estado pagado con abono parcial no elimina el saldo", () => {
  assert.equal(reporte([cuenta({ estado: "pagado", debe: 300, fecha_pago: "2026-01-15" })], [pago("2026-01-15", 300)]).total, 700);
});

test("usa la fecha efectiva de anulación y no la fecha de registro", () => {
  const datos = [cuenta({ estado: "anulado", fecha_anulacion: "2026-03-10" })];
  const evento = { ...pago("2026-02-01", 0), accion: "depuracion_anulada", metadata: { fecha_depuracion: "2026-02-01" } };
  assert.equal(reporte(datos, [evento]).total, 1000);
  assert.equal(reporte(datos, [evento], "2026-02").cantidad, 0);
});

test("separa números iguales por tipo y proveedores homónimos por identificación", () => {
  const resultado = reporte([cuenta({ debe: 300 }), cuenta({ id: "2", tipo_movimiento: "CONTRATO", proveedor_id: "P2" })], [pago("2026-01-15", 300)]);
  assert.equal(resultado.proveedores.length, 2);
  assert.equal(resultado.total, 1700);
});

test("acumula dinero en centavos sin errores de coma flotante", () => {
  assert.equal(reporte([cuenta({ haber: 0.1 }), cuenta({ id: "2", haber: 0.2 })]).total, 0.3);
});

test("excluye fechas faltantes, abonos sin historial y diferencias de pagos", () => {
  const faltante = reporte([cuenta({ fecha: null })]);
  assert.deepEqual(faltante.proveedores, []);
  const sinHistorial = reporte([cuenta({ debe: 50 })]);
  assert.deepEqual(sinHistorial.proveedores, []);
  const diferencia = reporte([cuenta({ debe: 50 })], [pago("2026-01-20", 100)]);
  assert.equal(diferencia.total, 0);
  assert.deepEqual(diferencia.proveedores, []);
});

test("no certifica un historial con fechas de pago inválidas", () => {
  const resultado = reporte([cuenta({ debe: 200 })], [pago("2026-02-30", 200)]);
  assert.deepEqual(resultado.proveedores, []);
});

test("una cuenta sin fecha de origen no afecta cierres posteriores a su liquidación", () => {
  const datos = [cuenta({ fecha: null, estado: "pagado", debe: 1000, fecha_pago: "2026-02-10" })];
  assert.deepEqual(reporte(datos).proveedores, []);
  assert.equal(reporte(datos, [], "2026-02").proveedores.length, 0);
});

test("valida el periodo y calcula correctamente meses bisiestos", () => {
  assert.equal(corteMensual("2024-02"), "2024-02-29");
  assert.equal(corteMensual("2026-02"), "2026-02-28");
  assert.equal(corteMensual("2026-12"), "2026-12-31");
  assert.throws(() => corteMensual("2026-13"));
  assert.throws(() => corteMensual("26-01"));
});

test("incluye membrete, mes, certificación y firma y escapa contenido del proveedor", () => {
  const html = documentoMensualCxp(reporte([cuenta({ proveedor_nombre: '<script>alert("x")</script>' })]), "", "2026");
  assert.match(html, /membrete.svg/);
  assert.match(html, /enero de 2026/);
  assert.match(html, /María de los Ángeles Arévalo/);
  assert.match(html, /Tesorera Municipal/);
  assert.match(html, /Francisco Morazán, en el año 2026/);
  assert.ok(!html.includes("<script>"));
});

test("siempre incluye encabezado y firma, sin mencionar cuentas excluidas", () => {
  const datos = reporte([cuenta({ fecha: null, proveedor_nombre: "EXCLUIDO" }), cuenta({ id: "2", proveedor_id: "P2" })]);
  const html = documentoMensualCxp(datos, "", "2026");
  assert.match(html, /La suscrita/);
  assert.match(html, /María de los Ángeles/);
  assert.ok(!/borrador|incidencia|inconsistencia|EXCLUIDO|incompleto/i.test(html));
  assert.deepEqual([...html.matchAll(/<th(?: [^>]*)?>(.*?)<\/th>/g)].map((m) => m[1]), ["No.", "Acreedor", "Monto", "Descripción"]);
});

test("agrupa las obligaciones válidas en una fila por acreedor", () => {
  const datos = reporte([cuenta(), cuenta({ id: "2", no_cxp: "101", haber: 300 }), cuenta({ id: "3", fecha: null, haber: 9000 })]);
  const documento = prepararDocumentoMensualCxp(datos, "2026");
  assert.equal(documento.filas.length, 1);
  assert.equal(documento.filas[0].monto, 1300);
  assert.equal(documento.total, 1300);
  assert.match(documento.filas[0].descripcion, /#100.*\n.*#101/);
});

test("genera automáticamente todos los meses cerrados del año", () => {
  assert.deepEqual(periodosCerrados(2026, "2026-03"), ["2026-01", "2026-02", "2026-03"]);
  assert.equal(periodosCerrados(2025, "2026-03").length, 12);
  assert.deepEqual(periodosCerrados(2027, "2026-03"), []);
});

test("un mes sin deudas produce un reporte explícito de saldo cero", () => {
  const html = documentoMensualCxp(reporte([]), "", "2026");
  assert.match(html, /No se registran cuentas por pagar pendientes/);
  assert.match(html, /L 0\.00/);
});
