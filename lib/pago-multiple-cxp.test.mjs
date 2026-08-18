import test from "node:test";
import assert from "node:assert/strict";
import {
  agruparCxpsPorProveedor,
  esPlanillaPago,
  obtenerErrorChequesPorProveedor,
} from "./pago-multiple-cxp.ts";

test("agrupa varias CxP del mismo proveedor en un solo proveedor de pago", () => {
  const grupos = agruparCxpsPorProveedor([
    { no_cxp: 1, beneficiario_id: "0801", beneficiario_nombre: "Proveedor A" },
    { no_cxp: 2, beneficiario_id: "0801", beneficiario_nombre: "Proveedor A" },
  ]);

  assert.equal(grupos.length, 1);
  assert.deepEqual(
    grupos[0].cxps.map((cxp) => cxp.no_cxp),
    [1, 2]
  );
  assert.equal(esPlanillaPago(grupos[0].cxps), false);
});

test("exige un cheque valido y diferente para cada proveedor", () => {
  const proveedores = [{ key: "id:0801" }, { key: "id:0802" }];

  assert.equal(
    obtenerErrorChequesPorProveedor(proveedores, {
      "id:0801": "100",
      "id:0802": "100",
    }),
    "Cada proveedor debe tener un número de cheque diferente."
  );
  assert.equal(
    obtenerErrorChequesPorProveedor(proveedores, {
      "id:0801": "100",
      "id:0802": "",
    }),
    "Debe ingresar un número de cheque válido para cada proveedor."
  );
  assert.equal(
    obtenerErrorChequesPorProveedor(proveedores, {
      "id:0801": "100",
      "id:0802": "101",
    }),
    null
  );
});

test("reconoce como planilla una seleccion con proveedores diferentes", () => {
  const cxps = [
    { no_cxp: 10, beneficiario_id: "0801", beneficiario_nombre: "Proveedor A" },
    { no_cxp: 11, beneficiario_id: "0802", beneficiario_nombre: "Proveedor B" },
  ];

  const grupos = agruparCxpsPorProveedor(cxps);

  assert.equal(grupos.length, 2);
  assert.equal(esPlanillaPago(cxps), true);
  assert.deepEqual(
    grupos.map((grupo) => grupo.beneficiarioId),
    ["0801", "0802"]
  );
});
