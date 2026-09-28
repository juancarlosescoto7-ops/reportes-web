import assert from "node:assert/strict";
import test from "node:test";
import { calcularDesgloseEgreso } from "./desglose-egreso.ts";
import { construirTextoDetalleOrdenPago } from "./ordenes-compra-pagadas.ts";

test("suma bancos y deducciones de todas las filas de la orden", () => {
  assert.deepEqual(calcularDesgloseEgreso([
    { cuenta: "Bancos", haber: "8750.50" },
    { cuenta: "Deducciones por pagar", haber: "1250.50" },
    { cuenta: "Bancos", haber: 4000 },
    { cuenta: "Deducciones por pagar", haber: 500 },
  ]), { bancos: 12750.5, deducciones: 1750.5, otrasCuentas: 0 });
});

test("conserva centavos y no atribuye otras cuentas a deducciones", () => {
  assert.deepEqual(calcularDesgloseEgreso([
    { cuenta: " bancos ", haber: 0.1 },
    { cuenta: "BANCOS", haber: 0.2 },
    { cuenta: "Caja", haber: 100 },
    { cuenta: "SIN EFECTO CONTABLE", haber: 0 },
  ]), { bancos: 0.3, deducciones: 0, otrasCuentas: 100 });
});

test("una orden sin efecto contable tiene ambos importes en cero", () => {
  assert.deepEqual(calcularDesgloseEgreso([{ cuenta: "SIN EFECTO CONTABLE", haber: 0 }]),
    { bancos: 0, deducciones: 0, otrasCuentas: 0 });
  assert.throws(() => calcularDesgloseEgreso([{ cuenta: "Bancos", haber: "inválido" }]));
});

test("incluye el desglose en el texto completo copiable", () => {
  const orden = {
    no_orden: "8000", fecha: "2026-09-20", descripcion: "Pago de servicios",
    total_haber: 1000, total_ejecutado: 1000, diferencia: 0, beneficiarios: [],
    desglose: { bancos: 875, deducciones: 125, otrasCuentas: 0 },
  };
  const texto = construirTextoDetalleOrdenPago(orden, [], (monto) => `L ${monto.toFixed(2)}`);
  assert.match(texto, /Total egreso: L 1000\.00\nBancos: L 875\.00\nDeducciones: L 125\.00/);
  assert.doesNotMatch(texto, /Otras cuentas:/);
  assert.doesNotMatch(construirTextoDetalleOrdenPago({ ...orden, desglose: null }, [], String), /Bancos:|Deducciones:/);
});
