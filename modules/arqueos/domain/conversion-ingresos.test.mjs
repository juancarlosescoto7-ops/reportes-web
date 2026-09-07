import assert from "node:assert/strict";
import test from "node:test";

import {
  calcularDiferenciaArqueo,
  convertirRegistrosSaftASami,
  montosCuadran,
  normalizarCodigoRubro,
} from "./conversion-ingresos.ts";

const catalogos = {
  rubrosSami: [
    { codigo: "110-01", descripcion: "Impuestos municipales" },
    { codigo: "120-01", descripcion: "Tasas municipales" },
  ],
  rubrosSaft: [
    { codigo: "11111001", descripcion: "Bienes urbanos" },
    { codigo: "11111002", descripcion: "Bienes rurales" },
    { codigo: "11111899", descripcion: "Otros servicios" },
  ],
  equivalencias: [
    { codigo_saft: "11111001", codigo_sami: "110-01" },
    { codigo_saft: "11111002", codigo_sami: "110-01" },
    { codigo_saft: "11111899", codigo_sami: "120-01" },
  ],
};

test("agrupa muchos rubros SAFT dentro de un mismo rubro SAMI", () => {
  const resultado = convertirRegistrosSaftASami(
    [
      {
        fila: 14,
        codigo: "11111001",
        descripcion: "Bienes urbanos",
        valorRecaudado: 6521.85,
      },
      {
        fila: 15,
        codigo: "11111002",
        descripcion: "Bienes rurales",
        valorRecaudado: 27070.37,
      },
      {
        fila: 22,
        codigo: "11111899",
        descripcion: "Otros servicios",
        valorRecaudado: 131250,
      },
    ],
    catalogos
  );

  assert.equal(resultado.sinEquivalencia.length, 0);
  assert.equal(resultado.detallesSami.length, 2);
  assert.deepEqual(resultado.detallesSami[0], {
    codigo: "110-01",
    descripcion: "Impuestos municipales",
    valorRecaudado: 33592.22,
    codigosSaft: ["11111001", "11111002"],
    cantidadRegistros: 2,
  });
  assert.equal(resultado.totalSaft, 164842.22);
  assert.equal(resultado.totalSami, 164842.22);
  assert.equal(resultado.totalSinEquivalencia, 0);
});

test("separa los códigos sin equivalencia para registro manual", () => {
  const resultado = convertirRegistrosSaftASami(
    [
      {
        fila: 20,
        codigo: "99999999",
        descripcion: "Rubro nuevo",
        valorRecaudado: 100.25,
      },
    ],
    catalogos
  );

  assert.deepEqual(resultado.sinEquivalencia, [
    {
      codigo: "99999999",
      descripcion: "Rubro nuevo",
      valorRecaudado: 100.25,
    },
  ]);
  assert.equal(resultado.registros[0].codigoSami, null);
  assert.equal(resultado.totalSaft, 100.25);
  assert.equal(resultado.totalSami, 0);
  assert.equal(resultado.totalSinEquivalencia, 100.25);
});

test("compara los totales por centavos y normaliza códigos de Excel", () => {
  assert.equal(normalizarCodigoRubro(" '001100.0 "), "001100");
  assert.equal(montosCuadran(0.1 + 0.2, 0.3), true);
  assert.equal(montosCuadran(100, 100.01), false);
  assert.equal(calcularDiferenciaArqueo(100, 99.99), -0.01);
});
