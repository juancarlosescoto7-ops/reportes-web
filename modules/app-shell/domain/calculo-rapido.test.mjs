import assert from "node:assert/strict";
import test from "node:test";
import { calcular, cifrasEnTexto, leerCifra } from "./calculo-rapido.ts";

test("lee importes del sistema y formatos decimales habituales", () => {
  for (const [texto, esperado] of [
    ["L 1,250.50", 1250.5], ["HNL 1,234,567.89", 1234567.89],
    ["1.250,50", 1250.5], ["1250,50", 1250.5], ["1,250", 1250],
    ["1.250", 1.25], ["1.250.000", 1250000], ["(L 1,250.50)", -1250.5],
    ["−250.75", -250.75], ["15 %", 15], ["0", 0], [".5", 0.5],
    ["1\u00a0250.50", 1250.5], ["1 250,50", 1250.5],
  ]) assert.equal(leerCifra(texto), esperado, texto);
});

test("rechaza datos incompletos, múltiples cifras y formatos inválidos", () => {
  for (const texto of ["", " ", "L", "abc123", "10 + 20", "2026-09-20", "1,23,4", "1.2.3", "1,2.50", "12 34", "Infinity", "9007199254740992"]) {
    assert.equal(leerCifra(texto), null, texto);
  }
});

test("extrae cada cifra por separado sin capturar fragmentos de fechas o códigos", () => {
  const texto = "Disponible: L 1,250.50; ejecutado: L 200.25 (15%)";
  const cifras = cifrasEnTexto(texto);
  assert.deepEqual(cifras.map((cifra) => cifra.valor), [1250.5, 200.25, -15]);
  for (const cifra of cifras) assert.equal(texto.slice(cifra.inicio, cifra.fin), cifra.texto);
  assert.deepEqual(cifrasEnTexto("OP-2026-0123 20/09/2026 ABC123 1,2.50"), []);
});

test("calcula las cuatro operaciones, negativos, cero y decimales sin ruido binario", () => {
  for (const [a, op, b, esperado] of [[1250.5, "+", 200.25, 1450.75], [10, "-", 25, -15], [2.5, "*", 4, 10], [100, "/", 4, 25], [0.1, "+", 0.2, 0.3], [0, "*", 25, 0], [3, "*", -2, -6]]) {
    assert.deepEqual(calcular(a, op, b), { valor: esperado, error: null });
  }
});

test("informa división entre cero y resultados fuera de rango", () => {
  assert.match(calcular(10, "/", 0).error, /cero/);
  assert.match(calcular(Number.MAX_SAFE_INTEGER, "*", 2).error, /límite/);
  assert.equal(calcular(1, "/", 3).valor, 0.333333333333333);
});
