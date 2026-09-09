import test from "node:test";
import assert from "node:assert/strict";
import { validarRubroIngresoSaft } from "./rubro-ingreso-saft.ts";

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
