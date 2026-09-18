import test from "node:test";
import assert from "node:assert/strict";
import { leerRubrosSaftPegados, validarRubroIngresoSaft } from "./rubro-ingreso-saft.ts";

test("permite crear un rubro sin cuenta SAMI y normaliza códigos copiados de Excel", () => {
  assert.deepEqual(validarRubroIngresoSaft(" '001111.0 ", "  Nuevo ingreso  "), {
    codigoSaft: "001111", descripcionSaft: "Nuevo ingreso",
  });
});

test("conserva códigos SAFT alfanuméricos y sus separadores", () => {
  assert.deepEqual(validarRubroIngresoSaft("AB-01/02_3.1", "Ingreso"), {
    codigoSaft: "AB-01/02_3.1", descripcionSaft: "Ingreso",
  });
});

test("rechaza códigos vacíos, espacios interiores, caracteres inválidos y longitudes excesivas", () => {
  for (const codigo of [undefined, {}, 123, "", " ", "12 34", "<123>", "a".repeat(101)]) {
    assert.ok(validarRubroIngresoSaft(codigo, "Ingreso").error);
  }
});

test("requiere una descripción de hasta 500 caracteres", () => {
  for (const descripcion of [undefined, {}, "", "  ", "a".repeat(501)]) {
    assert.ok(validarRubroIngresoSaft("123", descripcion).error);
  }
  assert.equal(validarRubroIngresoSaft("1".repeat(100), "a".repeat(500)).error, undefined);
});

test("lee filas de Excel con encabezados, ceros iniciales y formatos monetarios", () => {
  const filas = leerRubrosSaftPegados("\uFEFFCódigo\tNombre\tMonto\r\n'001111.0\tBienes inmuebles\tL 1,250.50\r\n002\tServicios\t1.250,50\r\n003\tOtros\t0\r\n\t\t\r\n");
  assert.deepEqual(filas.map(({ codigoSaft, monto, error }) => ({ codigoSaft, monto, error })), [
    { codigoSaft: "001111", monto: 1250.5, error: "" },
    { codigoSaft: "002", monto: 1250.5, error: "" },
    { codigoSaft: "003", monto: 0, error: "" },
  ]);
});

test("lee celdas con tabulaciones, saltos de línea y comillas escapadas", () => {
  const [fila] = leerRubrosSaftPegados('001\t"Servicios\nvarios\t""municipales"""\t100,25');
  assert.equal(fila.descripcionSaft, 'Servicios\nvarios\t"municipales"');
  assert.equal(fila.monto, 100.25);
  assert.equal(fila.error, "");
  assert.match(leerRubrosSaftPegados('001\t"Sin cierre\t100')[0].error, /comillas/);
});

test("detecta duplicados después de normalizar los códigos", () => {
  const filas = leerRubrosSaftPegados("001\tUno\t100\n'001.0\tDos\t200");
  assert.ok(filas.every((fila) => fila.error.includes("repetido")));
});

test("rechaza montos vacíos, negativos, mal agrupados o con caracteres extra", () => {
  for (const monto of ["", "-1", "(100)", "1e3", "12,34.56", "12.3456", "NaN", "Infinity", "1 2", "100abc", "999999999999999"]) {
    const [fila] = leerRubrosSaftPegados(`001\tIngreso\t${monto}`);
    assert.equal(fila.monto, null, monto);
    assert.ok(fila.error, monto);
  }
});

test("exige tres columnas y datos completos", () => {
  for (const texto of ["001\tIngreso", "001\tIngreso\t10\textra", "\tIngreso\t10", "001\t\t10"]) {
    assert.ok(leerRubrosSaftPegados(texto)[0].error);
  }
  assert.deepEqual(leerRubrosSaftPegados("\n\t\t\n"), []);
  assert.deepEqual(leerRubrosSaftPegados("Código\tNombre\tMonto"), []);
});

test("acepta miles y centavos sin redondear silenciosamente", () => {
  for (const [texto, esperado] of [["1,234", 1234], ["1.234", 1234], ["1 234,56", 1234.56], ["HNL 1234.56", 1234.56], ["$1,234.56", 1234.56]]) {
    assert.equal(leerRubrosSaftPegados(`001\tIngreso\t${texto}`)[0].monto, esperado);
  }
});
