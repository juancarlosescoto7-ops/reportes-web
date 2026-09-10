import assert from "node:assert/strict";
import test from "node:test";

import { avanzarSecuencia, normalizarComando } from "./secuencia-teclado.ts";

const base = {
  key: "", code: "", shiftKey: false, ctrlKey: false,
  altKey: false, metaKey: false, repeat: false, isComposing: false,
};

test("reconoce Shift + N seguido de E", () => {
  const inicio = avanzarSecuencia(
    { teclas: "", instante: 0 },
    { ...base, key: "N", code: "KeyN", shiftKey: true },
    ["ne"], 100,
  );
  assert.deepEqual(inicio.estado.teclas, "n");
  assert.equal(inicio.consumir, true);

  const final = avanzarSecuencia(
    inicio.estado,
    { ...base, key: "e", code: "KeyE" },
    ["ne"], 500,
  );
  assert.equal(final.comando, "ne");
  assert.equal(final.estado.teclas, "");
});

test("acepta abreviaciones de acciones de varias letras", () => {
  let estado = { teclas: "", instante: 0 };
  let comando;
  for (const [index, tecla] of [..."guacam"].entries()) {
    const resultado = avanzarSecuencia(
      estado,
      { ...base, key: tecla.toUpperCase(), code: /\d/.test(tecla) ? `Digit${tecla}` : "KeyA", shiftKey: index === 0 },
      ["guacam"], 100 + index * 100,
    );
    estado = resultado.estado;
    comando = resultado.comando;
  }
  assert.equal(comando, "guacam");
});

test("ignora una letra inicial sin Shift y cancela secuencias vencidas", () => {
  assert.equal(avanzarSecuencia(
    { teclas: "", instante: 0 }, { ...base, key: "n", code: "KeyN" }, ["ne"], 100,
  ).consumir, false);

  const resultado = avanzarSecuencia(
    { teclas: "n", instante: 100 }, { ...base, key: "e", code: "KeyE" }, ["ne"], 3000,
  );
  assert.equal(resultado.comando, undefined);
  assert.equal(resultado.estado.teclas, "");
});

test("espera cuando una abreviación completa también inicia otra", () => {
  let estado = { teclas: "", instante: 0 };
  for (const [index, tecla] of [..."imp"].entries()) {
    const resultado = avanzarSecuencia(
      estado,
      { ...base, key: tecla, code: `Key${tecla.toUpperCase()}`, shiftKey: index === 0 },
      ["imp", "impinf"],
      100 + index * 100,
    );
    estado = resultado.estado;
    assert.equal(resultado.comando, undefined);
  }
  assert.equal(estado.teclas, "imp");
});

test("normaliza títulos para los atajos frecuentes", () => {
  assert.equal(normalizarComando("  Generar Expediente PDF  "), "generar expediente pdf");
});
