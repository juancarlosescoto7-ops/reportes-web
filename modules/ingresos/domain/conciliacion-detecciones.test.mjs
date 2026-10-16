import test from "node:test";
import assert from "node:assert/strict";
import { conciliarConDetecciones, calcularResumenTotalConciliacion, parsearEstadoCuentaPegado } from "./conciliacion-bancaria.ts";

const cuentaA = "Tributarios: 2020718737";
const cuentaB = "Pagadora: 2010092311";
const opciones = { fechaDesde: "2026-07-01", fechaHasta: "2026-07-31", toleranciaDias: 3, cuentasPropias: [cuentaA, cuentaB] };
function banco(id, importe, cuenta = "2020718737", fecha = "2026-07-15", descripcion = "") {
  return { id, fila: Number(id.replace(/\D/g, "")) || 1, numero: id, fecha, tipo: "", descripcion, referencia: "", agencia: "", cuenta, creditoCentavos: Math.max(0, importe), debitoCentavos: Math.max(0, -importe), saldoCentavos: null };
}
function sistema(id, importe, cuenta = cuentaA, fecha = "2026-07-15") {
  return { id, fecha, fechaArqueo: "2026-07-15", montoCentavos: importe, cuenta };
}
function analizar(bancos, registros = [], extras = {}) {
  return conciliarConDetecciones(bancos, registros, { ...opciones, ...extras });
}

test("clasifica traslados directamente para revisión sin generar notas", () => {
  const bancos = [banco("b1", -10000, "2020718737", undefined, "TRASLADOS"), banco("b2", 10000, "2010092311")];
  const pendiente = analizar(bancos);
  assert.equal(pendiente.sugerencias.length, 1);
  assert.equal(pendiente.sugerencias[0].tipo, "traslado");
  assert.equal(pendiente.resultado.resumen.notasCredito.totalCentavos, 0);
  assert.equal(pendiente.resultado.resumen.notasDebito.totalCentavos, 0);
  assert.equal(pendiente.resultado.resumen.debitosBancarios.totalCentavos, 0);
  assert.equal(pendiente.enRevision.movimientos.length, 2);
  assert.equal(pendiente.resultado.resumen.conciliadosRevision.totalCentavos, 10000);
  assert.equal(pendiente.enRevision.movimientos.reduce((neto, item) => neto + item.creditoCentavos - item.debitoCentavos, 0), 0);
  assert.equal(calcularResumenTotalConciliacion(pendiente.resultado.resumen).requiereRevision, true);
  const confirmado = analizar(bancos, [], { confirmadas: pendiente.sugerencias });
  assert.equal(confirmado.resultado.resumen.creditosBanco.totalCentavos, 0);
  assert.equal(confirmado.resultado.resumen.notasCredito.cantidad, 0);
  assert.equal(confirmado.resultado.debitosBancarios.length, 0);
  assert.equal(confirmado.resultado.resumen.trasladosInternos.totalCentavos, 10000);
  assert.equal(confirmado.confirmadas[0].debito.id, "b1");
  assert.equal(confirmado.confirmadas[0].credito.id, "b2");
  assert.equal(calcularResumenTotalConciliacion(confirmado.resultado.resumen).diferenciaFinalCentavos, 0);
  const deshecho = analizar(bancos, [], { confirmadas: [] });
  assert.deepEqual(deshecho, pendiente);
});

test("no propone traslados en la misma cuenta, cuenta ajena, monto o fecha fuera de tolerancia", () => {
  const debito = banco("b1", -10000, "2020718737", undefined, "traslado");
  for (const credito of [
    banco("b2", 10000),
    banco("b2", 10000, "9999999"),
    banco("b2", 9999, "2010092311"),
    banco("b2", 10000, "2010092311", "2026-07-20"),
  ]) assert.equal(analizar([debito, credito]).sugerencias.length, 0);
});

test("detecta traslados sin descripción por débito y crédito del mismo importe y día", () => {
  for (const descripcion of ["", "Movimiento bancario"]) {
    const bancos = [banco("b1", -10000, "2020718737", undefined, descripcion), banco("b2", 10000, "2010092311")];
    const pendiente = analizar(bancos);
    assert.equal(pendiente.sugerencias.length, 1);
    const traslado = pendiente.sugerencias[0];
    assert.equal(traslado.tipo, "traslado");
    assert.equal(traslado.descripcionTraslado, false);
    assert.equal(traslado.referenciaCompartida, false);
    assert.equal(traslado.reemplazaCoincidencia, false);
    assert.equal(pendiente.resultado.resumen.notasCredito.cantidad, 0);
    assert.equal(pendiente.resultado.resumen.notasDebito.cantidad, 0);
    assert.equal(pendiente.enRevision.movimientos.length, 2);
    const confirmado = analizar(bancos, [], { confirmadas: [traslado] });
    assert.equal(confirmado.resultado.resumen.trasladosInternos.totalCentavos, 10000);
    assert.equal(confirmado.resultado.resumen.creditosBanco.totalCentavos, 0);
    assert.equal(confirmado.enRevision.movimientos.length, 0);
    assert.deepEqual(analizar(bancos), pendiente);
    const descartado = analizar(bancos, [], { descartadas: [traslado.id] });
    assert.equal(descartado.resultado.resumen.notasCredito.totalCentavos, 10000);
    assert.equal(descartado.resultado.resumen.debitosBancarios.totalCentavos, 10000);
  }
});

test("sin descripción exige el mismo día aunque haya tolerancia o referencia compartida", () => {
  const debito = { ...banco("b1", -10000), referencia: "REF-001" };
  const credito = { ...banco("b2", 10000, "2010092311", "2026-07-16"), referencia: "REF-001" };
  assert.equal(analizar([debito, credito], [], { toleranciaDias: 7 }).sugerencias.length, 0);
  const conDescripcion = analizar([{ ...debito, descripcion: "TRASLADOS" }, credito]);
  assert.equal(conDescripcion.sugerencias.length, 1);
  assert.equal(conDescripcion.sugerencias[0].descripcionTraslado, true);
});

test("sin descripción conserva los créditos que ya coinciden con el sistema", () => {
  const bancos = [banco("b1", -10000), banco("b2", 10000, "2010092311")];
  for (const fecha of ["2026-07-15", "2026-07-14"]) {
    const resultado = analizar(bancos, [sistema("s1", 10000, cuentaB, fecha)]);
    assert.equal(resultado.sugerencias.length, 0);
    assert.equal(resultado.enRevision.movimientos.length, 0);
    assert.equal(resultado.resultado.partidas[0].sistema.id, "s1");
    assert.equal(resultado.resultado.resumen.debitosBancarios.totalCentavos, 10000);
  }
});

test("sin descripción conserva las restricciones de cuenta propia e importe exacto", () => {
  const debito = banco("b1", -10000);
  for (const credito of [
    banco("b2", 10000),
    banco("b2", 10000, "9999999"),
    banco("b2", 9999, "2010092311"),
  ]) assert.equal(analizar([debito, credito]).sugerencias.length, 0);
});

test("sin descripción los duplicados quedan para revisión sin reutilizar el débito", () => {
  const bancos = [banco("b1", -10000), banco("b2", 10000, "2010092311"), banco("b3", 10000, "2010092311")];
  const pendiente = analizar(bancos);
  assert.equal(pendiente.sugerencias.length, 2);
  assert.equal(pendiente.enRevision.movimientos.length, 3);
  assert.equal(pendiente.resultado.resumen.notasCredito.cantidad, 0);
  assert.throws(() => analizar(bancos, [], { confirmadas: pendiente.sugerencias }), /dos relaciones/);
  const confirmado = analizar(bancos, [], { confirmadas: [pendiente.sugerencias[0]] });
  assert.equal(confirmado.sugerencias.length, 0);
  assert.equal(confirmado.resultado.resumen.notasCredito.totalCentavos, 10000);
});

test("detecta un traslado desde Excel sin columnas de descripción ni referencia", () => {
  const parseo = parsearEstadoCuentaPegado([
    "Cuenta bancaria\tFecha\tDébitos\tCréditos",
    "2020718737\t15/07/2026\t100\t",
    "2010092311\t15/07/2026\t\t100",
  ].join("\n"), { exigirCuenta: true });
  const pendiente = analizar(parseo.movimientos);
  assert.equal(parseo.filasInvalidas.length, 0);
  assert.equal(pendiente.sugerencias.length, 1);
  assert.equal(pendiente.sugerencias[0].descripcionTraslado, false);
  assert.equal(pendiente.resultado.resumen.notasCredito.cantidad, 0);
  assert.equal(pendiente.enRevision.movimientos.length, 2);
});

test("un traslado que cruza el límite del período no se neutraliza", () => {
  const bancos = [banco("b1", -10000, "2020718737", "2026-07-31", "traslados"), banco("b2", 10000, "2010092311", "2026-08-01")];
  const resultado = analizar(bancos);
  assert.equal(resultado.sugerencias.length, 0);
  assert.equal(resultado.resultado.resumen.debitosBancarios.totalCentavos, 10000);
  assert.equal(resultado.resultado.resumen.creditosBanco.totalCentavos, 0);
});

test("traslados duplicados son alternativas y no pueden consumir dos veces un movimiento", () => {
  const bancos = [banco("b1", -10000, "2020718737", undefined, "traslado"), banco("b2", 10000, "2010092311"), banco("b3", 10000, "2010092311")];
  const pendiente = analizar(bancos);
  assert.equal(pendiente.sugerencias.length, 2);
  assert.throws(() => analizar(bancos, [], { confirmadas: pendiente.sugerencias }), /dos relaciones/);
  const confirmado = analizar(bancos, [], { confirmadas: [pendiente.sugerencias[0]] });
  assert.equal(confirmado.sugerencias.length, 0);
  assert.equal(confirmado.resultado.resumen.notasCredito.totalCentavos, 10000);
});

test("avisa si el traslado sustituye una coincidencia uno a uno y vuelve a evaluar el registro", () => {
  const bancos = [banco("b1", -10000, "2020718737", undefined, "traslados"), banco("b2", 10000, "2010092311")];
  const registros = [sistema("s1", 10000, cuentaB)];
  const pendiente = analizar(bancos, registros);
  assert.equal(pendiente.sugerencias[0].reemplazaCoincidencia, true);
  assert.equal(pendiente.resultado.resumen.perfectos.cantidad, 0);
  assert.equal(pendiente.resultado.resumen.notasDebito.cantidad, 0);
  assert.equal(pendiente.enRevision.depositos[0].id, "s1");
  const confirmado = analizar(bancos, registros, { confirmadas: pendiente.sugerencias });
  assert.equal(confirmado.resultado.resumen.perfectos.cantidad, 0);
  assert.equal(confirmado.resultado.resumen.notasDebito.totalCentavos, 10000);
});

test("detecta tres abonos que suman un total y los cuenta una sola vez al confirmar", () => {
  const bancos = [banco("b1", 3333), banco("b2", 3333), banco("b3", 3334)];
  const registros = [sistema("s1", 10000)];
  const pendiente = analizar(bancos, registros);
  assert.equal(pendiente.sugerencias.length, 1);
  assert.equal(pendiente.sugerencias[0].tipo, "agrupacion");
  assert.equal(pendiente.resultado.resumen.notasCredito.cantidad, 0);
  assert.equal(pendiente.resultado.resumen.notasDebito.cantidad, 0);
  assert.equal(pendiente.enRevision.movimientos.length, 3);
  assert.equal(pendiente.enRevision.depositos.length, 1);
  assert.equal(pendiente.resultado.resumen.creditosBanco.totalCentavos, 10000);
  assert.equal(pendiente.resultado.resumen.depositosSistema.totalCentavos, 10000);
  assert.equal(calcularResumenTotalConciliacion(pendiente.resultado.resumen).conciliado, false);
  const confirmado = analizar(bancos, registros, { confirmadas: pendiente.sugerencias });
  const resumen = confirmado.resultado.resumen;
  assert.deepEqual(resumen.creditosBanco, { cantidad: 3, totalCentavos: 10000 });
  assert.deepEqual(resumen.depositosSistema, { cantidad: 1, totalCentavos: 10000 });
  assert.deepEqual(resumen.agrupados, { cantidad: 1, totalCentavos: 10000 });
  assert.equal(resumen.notasCredito.cantidad, 0);
  assert.equal(resumen.notasDebito.cantidad, 0);
  assert.equal(resumen.diferenciaControlCentavos, 0);
  assert.equal(calcularResumenTotalConciliacion(resumen).conciliado, true);
  assert.deepEqual(analizar(bancos, registros), pendiente);
});

test("solo agrupa la misma cuenta y fechas cercanas, con suma exacta en centavos", () => {
  const registros = [sistema("s1", 10000)];
  for (const segundo of [banco("b2", 6000, "2010092311"), banco("b2", 6000, undefined, "2026-07-20"), banco("b2", 5999)]) {
    assert.equal(analizar([banco("b1", 4000), segundo], registros).sugerencias.length, 0);
  }
});

test("encuentra subconjuntos y muestra varias combinaciones sin aplicarlas automáticamente", () => {
  const bancos = [banco("b1", 4000), banco("b2", 6000), banco("b3", 3000), banco("b4", 7000), banco("b5", 999)];
  const registros = [sistema("s1", 10000)];
  const pendiente = analizar(bancos, registros);
  assert.equal(pendiente.sugerencias.length, 2);
  assert.equal(pendiente.confirmadas.length, 0);
  assert.throws(() => analizar(bancos, registros, { confirmadas: pendiente.sugerencias }), /agrupación confirmada/);
  const confirmado = analizar(bancos, registros, { confirmadas: [pendiente.sugerencias[0]] });
  assert.equal(confirmado.sugerencias.length, 0);
  assert.equal(confirmado.resultado.resumen.notasCredito.totalCentavos, 10999);
});

test("conserva la prioridad de las coincidencias uno a uno y admite depósitos fuera del mes por arqueo", () => {
  const bancos = [banco("b1", 4000, undefined, "2026-08-01"), banco("b2", 6000, undefined, "2026-08-02"), banco("b3", 9000, undefined, "2026-08-01")];
  const registros = [sistema("s1", 10000, cuentaA, "2026-08-01"), sistema("s2", 9000, cuentaA, "2026-08-01")];
  const pendiente = analizar(bancos, registros);
  assert.equal(pendiente.resultado.resumen.perfectos.cantidad, 1);
  assert.equal(pendiente.sugerencias.length, 1);
  const confirmado = analizar(bancos, registros, { confirmadas: pendiente.sugerencias });
  assert.equal(confirmado.resultado.resumen.creditosBanco.totalCentavos, 19000);
  assert.equal(confirmado.resultado.resumen.depositosSistema.totalCentavos, 19000);
});

test("una alternativa de traslado y agrupación no puede usar el mismo crédito", () => {
  const bancos = [banco("b1", -4000, "2010092311", undefined, "traslados"), banco("b2", 4000), banco("b3", 6000)];
  const registros = [sistema("s1", 10000)];
  const pendiente = analizar(bancos, registros);
  assert.equal(pendiente.sugerencias.length, 2);
  assert.throws(() => analizar(bancos, registros, { confirmadas: pendiente.sugerencias }), /dos relaciones/);
  for (const sugerencia of pendiente.sugerencias) {
    const confirmado = analizar(bancos, registros, { confirmadas: [sugerencia] });
    assert.equal(confirmado.sugerencias.length, 0);
  }
});

test("descartar mantiene los movimientos y los totales, reanalizar restaura la sugerencia", () => {
  const bancos = [banco("b1", 4000), banco("b2", 6000)];
  const registros = [sistema("s1", 10000)];
  const pendiente = analizar(bancos, registros);
  const descartado = analizar(bancos, registros, { descartadas: [pendiente.sugerencias[0].id] });
  assert.equal(descartado.sugerencias.length, 0);
  assert.equal(descartado.resultado.resumen.notasCredito.totalCentavos, 10000);
  assert.equal(descartado.resultado.resumen.notasDebito.totalCentavos, 10000);
  assert.equal(analizar(bancos, registros).sugerencias.length, 1);
});

test("una confirmación no puede reutilizar datos alterados o filtros incompatibles", () => {
  const bancos = [banco("b1", 4000), banco("b2", 6000)];
  const registros = [sistema("s1", 10000)];
  const pendiente = analizar(bancos, registros);
  assert.throws(() => analizar([bancos[0], { ...bancos[1], creditoCentavos: 6001 }], registros, { confirmadas: pendiente.sugerencias }), /agrupación confirmada/);
  assert.throws(() => analizar(bancos, registros, { fechaDesde: "2026-08-01", fechaHasta: "2026-08-31", confirmadas: pendiente.sugerencias }), /agrupación confirmada/);
});

test("avisa de búsqueda parcial en lotes grandes y aún reconoce totales completos", () => {
  const bancos = Array.from({ length: 25 }, (_, i) => banco(`b${i + 1}`, 100));
  const parcial = analizar(bancos, [sistema("s1", 200)]);
  assert.ok(parcial.advertenciasDeteccion.length > 0);
  assert.equal(calcularResumenTotalConciliacion(parcial.resultado.resumen).requiereRevision, true);
  const total = analizar(bancos, [sistema("s1", 2500)]);
  assert.equal(total.sugerencias.length, 1);
  assert.equal(total.sugerencias[0].creditos.length, 25);
});

test("detecta traslados y agrupaciones desde una tabla pegada con varias cuentas", () => {
  const parseo = parsearEstadoCuentaPegado([
    "Cuenta bancaria\tFecha\tDébitos\tCréditos\tDescripción\tReferencia",
    "2020718737\t15/07/2026\t100\t\tTRASLADOS\tTR-001",
    "2010092311\t15/07/2026\t\t100\tTRASLADOS\tTR-001",
    "2020718737\t15/07/2026\t\t40\tGobierno central\tGC-001",
    "2020718737\t15/07/2026\t\t60\tGobierno central\tGC-002",
  ].join("\n"), { exigirCuenta: true });
  assert.equal(parseo.filasInvalidas.length, 0);
  const registros = [sistema("s1", 10000)];
  const pendiente = analizar(parseo.movimientos, registros);
  assert.equal(pendiente.sugerencias.length, 2);
  assert.equal(pendiente.resultado.resumen.notasCredito.cantidad, 0);
  assert.equal(pendiente.resultado.resumen.notasDebito.cantidad, 0);
  assert.equal(pendiente.resultado.partidas.length, 0);
  assert.equal(pendiente.enRevision.movimientos.length, 4);
  assert.equal(pendiente.enRevision.depositos.length, 1);
  assert.equal(pendiente.sugerencias.find(item => item.tipo === "traslado").referenciaCompartida, true);
  const confirmado = analizar(parseo.movimientos, registros, { confirmadas: pendiente.sugerencias });
  assert.equal(confirmado.resultado.resumen.notasCredito.cantidad, 0);
  assert.equal(confirmado.resultado.resumen.notasDebito.cantidad, 0);
  assert.equal(confirmado.resultado.resumen.creditosBanco.totalCentavos, 10000);
  assert.equal(confirmado.resultado.resumen.depositosSistema.totalCentavos, 10000);
});

test("alternativas superpuestas reservan cada movimiento una vez y descartar una no libera los compartidos", () => {
  const bancos = [banco("b1", 4000), banco("b2", 6000), banco("b3", 6000), banco("b4", 777)];
  const registros = [sistema("s1", 10000), sistema("s2", 999)];
  const pendiente = analizar(bancos, registros);
  assert.equal(pendiente.sugerencias.length, 2);
  assert.equal(pendiente.enRevision.movimientos.length, 3);
  assert.equal(pendiente.enRevision.depositos.length, 1);
  assert.equal(pendiente.resultado.resumen.conciliadosRevision.totalCentavos, 16000);
  assert.equal(pendiente.resultado.resumen.notasCredito.totalCentavos, 777);
  assert.equal(pendiente.resultado.resumen.notasDebito.totalCentavos, 999);
  const parcial = analizar(bancos, registros, { descartadas: [pendiente.sugerencias[0].id] });
  assert.equal(parcial.enRevision.movimientos.length, 2);
  assert.equal(parcial.enRevision.depositos.length, 1);
  assert.equal(parcial.resultado.resumen.notasCredito.totalCentavos, 6777);
  assert.equal(parcial.resultado.resumen.notasDebito.totalCentavos, 999);
  const descartado = analizar(bancos, registros, { descartadas: pendiente.sugerencias.map(item => item.id) });
  assert.equal(descartado.enRevision.movimientos.length, 0);
  assert.equal(descartado.resultado.resumen.notasCredito.totalCentavos, 16777);
  assert.equal(descartado.resultado.resumen.notasDebito.totalCentavos, 10999);
  for (const analisis of [pendiente, parcial, descartado]) {
    const r = analisis.resultado.resumen;
    assert.equal(r.diferenciaControlCentavos, r.notasCredito.totalCentavos - r.notasDebito.totalCentavos + r.diferenciaRevisionCentavos);
    assert.equal(r.creditosBanco.totalCentavos, 16777);
    assert.equal(r.depositosSistema.totalCentavos, 10999);
  }
});

test("deshacer una confirmación restaura la categoría para revisión y no las notas", () => {
  const bancos = [banco("b1", 4000), banco("b2", 6000)];
  const registros = [sistema("s1", 10000)];
  const pendiente = analizar(bancos, registros);
  const confirmado = analizar(bancos, registros, { confirmadas: pendiente.sugerencias });
  assert.equal(confirmado.enRevision.movimientos.length, 0);
  const deshecho = analizar(bancos, registros, { confirmadas: [] });
  assert.equal(deshecho.enRevision.movimientos.length, 2);
  assert.equal(deshecho.resultado.resumen.notasCredito.cantidad, 0);
  assert.equal(deshecho.resultado.resumen.notasDebito.cantidad, 0);
});
