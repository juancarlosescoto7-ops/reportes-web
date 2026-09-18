import test from "node:test";
import assert from "node:assert/strict";
import { analizarFactibilidadPago } from "./factibilidad-pago.ts";

const pago = (monto = 100, numero = 1, tipo = "Compra") => ({
  no_cxp: numero, tipo_movimiento: tipo, monto_pago: monto, saldo_real: 100,
});
const datos = (numero = 1, disponible = 100, codigo = "001") => ({
  no_cxp: numero, tipo_cxp: "Compra", saldo_real_cxp: 100,
  detalle_codigos: [{ codigo_presupuestario: codigo, monto_pendiente: 100, saldo_codigo_actual: disponible,
    saldo_codigo_proyectado: 0, monto_pendiente_anterior: 9999, monto_comprometido: 9999 }],
  detalle_grupos: [{ fuente: "Transferencias", grupo: "Funcionamiento", monto_pendiente: 100, saldo_grupo_actual: disponible,
    saldo_grupo_proyectado: 0, monto_pendiente_anterior: 9999 }],
});

test("evalúa el monto inicial usando saldos actuales sin descontar compromisos", () => {
  const resultado = analizarFactibilidadPago([pago()], [datos()]);
  assert.equal(resultado.estado, "factible");
  assert.ok(resultado.recursos.every((recurso) => recurso.restante === 0));
});

test("un pago parcial pasa a factible al reducir el importe", () => {
  assert.equal(analizarFactibilidadPago([pago(100)], [datos(1, 60)]).estado, "insuficiente");
  assert.equal(analizarFactibilidadPago([pago(60)], [datos(1, 60)]).estado, "factible");
});

test("suma pagos que comparten código y grupo en lugar de reutilizar su saldo", () => {
  const resultado = analizarFactibilidadPago([pago(60), pago(60, 2)], [datos(), datos(2)]);
  assert.equal(resultado.estado, "insuficiente");
  assert.ok(resultado.cuentas.every((cuenta) => cuenta.estado === "insuficiente"));
  assert.ok(resultado.recursos.every((recurso) => recurso.solicitado === 120 && recurso.restante === -20));
});

test("detecta grupo compartido insuficiente aunque los códigos tengan cobertura", () => {
  const resultado = analizarFactibilidadPago([pago(60), pago(60, 2)], [datos(), datos(2, 100, "002")]);
  assert.equal(resultado.estado, "insuficiente");
  assert.equal(resultado.recursos.filter((recurso) => recurso.restante < 0).length, 1);
});

test("rechaza montos inválidos y utiliza el saldo pendiente recién consultado", () => {
  for (const monto of [0, -1, NaN, Infinity, 100.01, 0.001]) {
    assert.equal(analizarFactibilidadPago([pago(monto)], [datos()]).estado, "invalido");
  }
  assert.equal(analizarFactibilidadPago([pago(90)], [{ ...datos(), saldo_real_cxp: 80 }]).estado, "invalido");
});

test("no confirma factibilidad con datos ausentes o incompletos", () => {
  for (const consulta of [[], [{ ...datos(), detalle_grupos: [] }], [{ ...datos(), detalle_codigos: [{ codigo_presupuestario: "001", monto_pendiente: 100, saldo_codigo_actual: null }] }]]) {
    assert.equal(analizarFactibilidadPago([pago()], consulta).estado, "sin_datos");
  }
  assert.equal(analizarFactibilidadPago([pago()], [{ ...datos(), saldo_real_cxp: 150 }]).estado, "sin_datos");
});

test("diferencia cuentas del mismo número por tipo de movimiento", () => {
  assert.equal(analizarFactibilidadPago([pago(50, 1, "Servicio")], [datos()]).estado, "sin_datos");
});

test("distribuye el pago entre códigos y compara a centavos", () => {
  const consulta = datos();
  consulta.detalle_codigos = [
    { codigo_presupuestario: "001", monto_pendiente: 30, saldo_codigo_actual: 3 },
    { codigo_presupuestario: "002", monto_pendiente: 70, saldo_codigo_actual: 7 },
  ];
  const resultado = analizarFactibilidadPago([pago(10)], [consulta]);
  assert.equal(resultado.estado, "factible");
  assert.deepEqual(resultado.recursos.map((recurso) => recurso.solicitado), [3, 7, 10]);
  assert.equal(analizarFactibilidadPago([pago(10.02)], [consulta]).estado, "insuficiente");
});
