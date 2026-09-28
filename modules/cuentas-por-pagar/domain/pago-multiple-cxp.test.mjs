import test from "node:test";
import assert from "node:assert/strict";
import {
  agruparCxpsPorProveedor,
  esPlanillaPago,
  obtenerErrorChequesPorProveedor,
  calcularDesglosePagoCxp,
  obtenerErrorDesglosePagoCxp,
} from "./pago-multiple-cxp.ts";

test("el abono suma banco y deducciones conservando centavos", () => {
  assert.deepEqual(calcularDesglosePagoCxp(875, 125), {
    monto_banco: 875, deduccion: 125, monto_pago: 1000,
  });
  assert.equal(calcularDesglosePagoCxp(0.1, 0.2).monto_pago, 0.3);
  assert.equal(calcularDesglosePagoCxp(500).monto_pago, 500);
});

test("permite abonos parciales y pagos solo con deducciones", () => {
  for (const [banco, deduccion] of [[875, 125], [400, 100], [0, 1000], [1000, 0]]) {
    assert.equal(obtenerErrorDesglosePagoCxp({ ...calcularDesglosePagoCxp(banco, deduccion), saldo_real: 1000 }), null);
  }
});

test("rechaza excesos, montos negativos, no numéricos y abonos de cero", () => {
  for (const [banco, deduccion] of [[1000, 1], [-1, 100], [100, -1], [NaN, 1], [1, Infinity], [0, 0]]) {
    assert.ok(obtenerErrorDesglosePagoCxp({ ...calcularDesglosePagoCxp(banco, deduccion), saldo_real: 1000 }));
  }
});

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
