import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularResumenTotalConciliacion,
  conciliarDepositos,
  limitarResultadoConciliacionAlPeriodo,
  montoACentavos,
  montoCoincideConBusqueda,
  normalizarFechaBancaria,
  normalizarCuentaBancaria,
  parsearEstadoCuentaPegado,
} from "./conciliacion-bancaria.ts";

function banco(fila, fecha, creditoCentavos, debitoCentavos = 0) {
  return {
    id: `b-${fila}`,
    fila,
    numero: String(fila),
    fecha,
    tipo: "DEP",
    descripcion: "Movimiento bancario",
    referencia: `R-${fila}`,
    agencia: "Talanga",
    debitoCentavos,
    creditoCentavos,
    saldoCentavos: null,
  };
}

function sistema(id, fecha, montoCentavos) {
  return {
    id,
    fecha,
    montoCentavos,
    cuenta: "Tributarios: 2020718737",
  };
}

test("reconoce la columna de cuenta y conserva cuentas en créditos y débitos", () => {
  for (const encabezado of ["Cuenta", "Cuenta bancaria", "Número de cuenta", "No. cuenta"]) {
    const resultado = parsearEstadoCuentaPegado([
      `Fecha\tDébitos\tCréditos\t${encabezado}`,
      "20/07/2026\t\t100\t2020718737",
      "20/07/2026\t25\t\tPagadora: 2010092311",
    ].join("\n"), { exigirCuenta: true });
    assert.equal(resultado.filasInvalidas.length, 0);
    assert.deepEqual(resultado.movimientos.map(item => item.cuenta), ["2020718737", "Pagadora: 2010092311"]);
  }
});

test("la conciliación general exige columna de cuenta y cuenta en cada movimiento", () => {
  assert.throws(() => parsearEstadoCuentaPegado(
    "Fecha\tDébitos\tCréditos\n20/07/2026\t\t100",
    { exigirCuenta: true }
  ), /columna "Cuenta bancaria"/);
  const resultado = parsearEstadoCuentaPegado(
    "Cuenta\tFecha\tDébitos\tCréditos\n\t20/07/2026\t\t100\n\t20/07/2026\t25\t",
    { exigirCuenta: true }
  );
  assert.equal(resultado.movimientos.length, 0);
  assert.deepEqual(resultado.filasInvalidas.map(item => item.fila), [2, 3]);
  assert.ok(resultado.filasInvalidas.every(item => /Cuenta bancaria vacía/.test(item.motivo)));
});

test("una cuenta seleccionada admite el formato anterior y rechaza cuentas distintas o vacías", () => {
  const opciones = { cuentaPredeterminada: "Tributarios: 2020718737" };
  const anterior = parsearEstadoCuentaPegado(
    "Fecha\tDébitos\tCréditos\n20/07/2026\t\t100", opciones
  );
  assert.equal(anterior.movimientos[0].cuenta, opciones.cuentaPredeterminada);
  const conCuentas = parsearEstadoCuentaPegado([
    "Cuenta\tFecha\tDébitos\tCréditos",
    "2020718737\t20/07/2026\t\t100",
    "2010092311\t20/07/2026\t\t100",
    "\t20/07/2026\t\t100",
  ].join("\n"), opciones);
  assert.equal(conCuentas.movimientos.length, 1);
  assert.equal(conCuentas.filasInvalidas.length, 2);
  assert.match(conCuentas.filasInvalidas[0].motivo, /no corresponde/);
});

test("normaliza números de cuenta sin perder ceros iniciales", () => {
  assert.equal(normalizarCuentaBancaria("Tributarios: 2020718737"), normalizarCuentaBancaria("2020-718737"));
  assert.equal(normalizarCuentaBancaria("Cuenta: 00123"), normalizarCuentaBancaria("00123"));
  assert.notEqual(normalizarCuentaBancaria("00123"), normalizarCuentaBancaria("123"));
  assert.notEqual(normalizarCuentaBancaria("Cuenta A"), normalizarCuentaBancaria("Cuenta B"));
});

test("no mezcla cuentas con la misma fecha y monto ni las marca ambiguas entre sí", () => {
  const movimientos = [
    { ...banco(2, "2026-07-01", 10000), cuenta: "2010092311" },
    { ...banco(3, "2026-07-01", 10000), cuenta: "2020718737" },
  ];
  const depositos = [
    sistema("a-tributarios", "2026-07-01", 10000),
    { ...sistema("z-pagadora", "2026-07-01", 10000), cuenta: "Pagadora: 2010092311" },
  ];
  const resultado = conciliarDepositos(movimientos, depositos);
  assert.equal(resultado.resumen.perfectos.cantidad, 2);
  assert.equal(resultado.partidas.find(item => item.banco.fila === 2).sistema.id, "z-pagadora");
  assert.ok(resultado.partidas.every(item => !item.esAmbiguo));
});

test("prefiere fecha cercana de la misma cuenta a fecha exacta de otra cuenta", () => {
  const resultado = conciliarDepositos([
    { ...banco(2, "2026-07-01", 10000), cuenta: "2010092311" },
    { ...banco(3, "2026-07-02", 10000), cuenta: "2020718737" },
  ], [
    sistema("tributarios", "2026-07-01", 10000),
    { ...sistema("pagadora", "2026-07-02", 10000), cuenta: "Pagadora: 2010092311" },
  ]);
  assert.equal(resultado.resumen.perfectos.cantidad, 0);
  assert.equal(resultado.resumen.porRevisar.cantidad, 2);
  assert.ok(resultado.partidas.every(item => !item.esAmbiguo));
  for (const partida of resultado.partidas) {
    assert.equal(normalizarCuentaBancaria(partida.banco.cuenta), normalizarCuentaBancaria(partida.sistema.cuenta));
  }
});

test("conserva cuentas sin contraparte como notas y débitos informativos", () => {
  const resultado = conciliarDepositos([
    { ...banco(2, "2026-07-01", 10000), cuenta: "9999999999" },
    { ...banco(3, "2026-07-01", 0, 500), cuenta: "9999999999" },
  ], [sistema("tributarios", "2026-07-01", 10000)]);
  assert.equal(resultado.resumen.perfectos.cantidad, 0);
  assert.equal(resultado.resumen.porRevisar.cantidad, 0);
  assert.equal(resultado.resumen.notasCredito.totalCentavos, 10000);
  assert.equal(resultado.resumen.notasDebito.totalCentavos, 10000);
  assert.equal(resultado.partidas.find(item => item.estado === "nota_credito").banco.cuenta, "9999999999");
  assert.equal(resultado.debitosBancarios[0].cuenta, "9999999999");
});

test("el motor rechaza cuentas ausentes al conciliar varias cuentas", () => {
  assert.throws(() => conciliarDepositos([banco(2, "2026-07-01", 10000)], [
    sistema("a", "2026-07-01", 10000),
    { ...sistema("b", "2026-07-01", 10000), cuenta: "Pagadora: 2010092311" },
  ]), /no tiene cuenta bancaria/);
  assert.throws(() => conciliarDepositos([
    { ...banco(2, "2026-07-01", 10000), cuenta: "2020718737" },
  ], [{ ...sistema("a", "2026-07-01", 10000), cuenta: "" }]), /depósito interno a no tiene cuenta/);
});

test("parsea el texto tabulado copiado desde Excel", () => {
  const texto = [
    "No.\tFecha\tTipo\tDescripción\tReferencia\tAgencia\tDébitos\tCréditos\tSaldo",
    "1\t20/07/2026\tDEP\tDepósito diario\tREF-1\t001\t\t1,234.56\t5,000.00",
    "2\t21/07/2026\tND\tComisión\tREF-2\t001\t25,00\t\t4.975,00",
  ].join("\n");

  const resultado = parsearEstadoCuentaPegado(texto);

  assert.equal(resultado.movimientos.length, 2);
  assert.equal(resultado.filasInvalidas.length, 0);
  assert.equal(resultado.movimientos[0].fecha, "2026-07-20");
  assert.equal(resultado.movimientos[0].creditoCentavos, 123456);
  assert.equal(resultado.movimientos[1].debitoCentavos, 2500);
  assert.equal(resultado.movimientos[1].saldoCentavos, 497500);
});

test("normaliza fechas y montos bancarios comunes", () => {
  assert.equal(normalizarFechaBancaria("2026-07-20"), "2026-07-20");
  assert.equal(normalizarFechaBancaria("20-07-26"), "2026-07-20");
  assert.equal(normalizarFechaBancaria("46223"), "2026-07-20");
  assert.equal(montoACentavos("L 1.234,56"), 123456);
  assert.equal(montoACentavos("1,234.56"), 123456);
  assert.equal(montoACentavos("1,234"), 123400);
});

test("busca montos parciales con o sin separadores", () => {
  assert.equal(montoCoincideConBusqueda(2_172_912, "21"), true);
  assert.equal(montoCoincideConBusqueda(2_172_912, "21,729"), true);
  assert.equal(montoCoincideConBusqueda(2_172_912, "21729"), true);
  assert.equal(montoCoincideConBusqueda(2_172_912, "L 21,729.12"), true);
  assert.equal(montoCoincideConBusqueda(2_172_912, "21,729.10"), false);
});

test("detecta filas inválidas e ignora filas sin movimiento", () => {
  const texto = [
    "Fecha;Débitos;Créditos;Descripción",
    "20/07/2026;10;20;Dos importes",
    "21/07/2026;;;Saldo inicial",
    "fecha;débitos;créditos;descripción",
  ].join("\n");
  const resultado = parsearEstadoCuentaPegado(texto);

  assert.equal(resultado.movimientos.length, 0);
  assert.equal(resultado.filasInvalidas.length, 1);
  assert.equal(resultado.filasIgnoradas.length, 2);
});

test("clasifica perfectos, revisión, notas y débitos bancarios", () => {
  const movimientos = [
    banco(2, "2026-07-01", 10000),
    banco(3, "2026-07-05", 20000),
    banco(4, "2026-07-10", 30000),
    banco(5, "2026-07-11", 0, 2500),
  ];
  const depositos = [
    sistema("s-1", "2026-07-01", 10000),
    sistema("s-2", "2026-07-03", 20000),
    sistema("s-3", "2026-07-12", 40000),
  ];
  const resultado = conciliarDepositos(movimientos, depositos, 3);

  assert.equal(resultado.resumen.perfectos.cantidad, 1);
  assert.equal(resultado.resumen.porRevisar.cantidad, 1);
  assert.equal(resultado.resumen.notasCredito.cantidad, 1);
  assert.equal(resultado.resumen.notasDebito.cantidad, 1);
  assert.equal(resultado.resumen.debitosBancarios.cantidad, 1);
  assert.equal(resultado.resumen.diferenciaControlCentavos, -10000);
});

test("prioriza coincidencias exactas antes de fechas cercanas", () => {
  const movimientos = [
    banco(2, "2026-07-01", 10000),
    banco(3, "2026-07-02", 10000),
  ];
  const depositos = [
    sistema("s-exacto", "2026-07-01", 10000),
    sistema("s-cercano", "2026-07-04", 10000),
  ];
  const resultado = conciliarDepositos(movimientos, depositos, 3);

  const perfecto = resultado.partidas.find((item) => item.estado === "perfecto");
  const revisar = resultado.partidas.find((item) => item.estado === "revisar");
  assert.equal(perfecto?.sistema?.id, "s-exacto");
  assert.equal(perfecto?.banco?.fila, 2);
  assert.equal(revisar?.sistema?.id, "s-cercano");
  assert.equal(revisar?.banco?.fila, 3);
});

test("el matching cercano maximiza pares antes de minimizar días", () => {
  const movimientos = [
    banco(2, "2026-07-05", 10000),
    banco(3, "2026-07-07", 10000),
  ];
  const depositos = [
    sistema("s-1", "2026-07-01", 10000),
    sistema("s-2", "2026-07-06", 10000),
  ];
  const resultado = conciliarDepositos(movimientos, depositos, 5);

  assert.equal(resultado.resumen.porRevisar.cantidad, 2);
  assert.equal(resultado.resumen.notasCredito.cantidad, 0);
  assert.equal(resultado.resumen.notasDebito.cantidad, 0);
});

test("entre soluciones máximas elige la menor diferencia total", () => {
  const movimientos = [
    banco(2, "2026-07-02", 10000),
    banco(3, "2026-07-03", 10000),
    banco(4, "2026-07-12", 10000),
  ];
  const depositos = [
    sistema("s-1", "2026-07-01", 10000),
    sistema("s-2", "2026-07-11", 10000),
  ];
  const resultado = conciliarDepositos(movimientos, depositos, 20);
  const revisiones = resultado.partidas.filter((item) => item.estado === "revisar");

  assert.deepEqual(
    revisiones.map((item) => item.banco?.fila).sort(),
    [2, 4]
  );
  assert.equal(
    revisiones.reduce((total, item) => total + (item.diferenciaDias ?? 0), 0),
    2
  );
});

test("maneja duplicados uno a uno de forma estable", () => {
  const movimientos = [
    banco(2, "2026-07-01", 10000),
    banco(3, "2026-07-01", 10000),
    banco(4, "2026-07-01", 10000),
  ];
  const depositos = [
    sistema("s-1", "2026-07-01", 10000),
    sistema("s-2", "2026-07-01", 10000),
  ];
  const resultado = conciliarDepositos(movimientos, depositos, 3);

  assert.equal(resultado.resumen.perfectos.cantidad, 2);
  assert.equal(resultado.resumen.notasCredito.cantidad, 1);
  assert.ok(
    resultado.partidas
      .filter((item) => item.estado === "perfecto")
      .every((item) => item.esAmbiguo)
  );
  assert.equal(
    resultado.partidas.find((item) => item.estado === "nota_credito")
      ?.esAmbiguo,
    true
  );
});

test("rechaza comillas sin cerrar sin absorber movimientos posteriores", () => {
  const texto = [
    "Fecha\tDébitos\tCréditos\tDescripción",
    '20/07/2026\t\t100.00\t"Descripción sin cierre',
    "21/07/2026\t\t200.00\tSegundo depósito",
  ].join("\n");

  assert.throws(
    () => parsearEstadoCuentaPegado(texto),
    /comillas sin cerrar/
  );
});

test("detecta encabezados TSV aunque una línea previa tenga muchas comas", () => {
  const texto = [
    "Municipalidad, Talanga, Francisco, Morazán, Honduras, Estado, Bancario, Mensual, Julio",
    "Fecha\tDébitos\tCréditos\tDescripción",
    '20/07/2026\t\t100.00\tCompra de tubo 2" galvanizado',
  ].join("\n");
  const resultado = parsearEstadoCuentaPegado(texto);

  assert.equal(resultado.movimientos.length, 1);
  assert.match(resultado.movimientos[0].descripcion, /2"/);
});

test("valida montos antes de normalizarlos", () => {
  assert.equal(montoACentavos("-"), 0);
  assert.equal(montoACentavos("—"), 0);
  assert.equal(montoACentavos("L. 1,234.56"), 123456);
  assert.equal(montoACentavos("1e3"), null);
  assert.equal(montoACentavos("abc 123"), null);
  assert.equal(montoACentavos("1-234"), null);
});

test("rechaza fechas con sufijos y aplica pivote a años de dos dígitos", () => {
  assert.equal(normalizarFechaBancaria("2026-07-20basura"), null);
  assert.equal(normalizarFechaBancaria("31/12/99"), "1999-12-31");
  assert.equal(normalizarFechaBancaria("29/02/2025"), null);
  assert.equal(normalizarFechaBancaria("29/02/2024"), "2024-02-29");
});

test("exige encabezados de débitos y créditos", () => {
  assert.throws(
    () =>
      parsearEstadoCuentaPegado(
        "Fecha\tCréditos\tDescripción\n20/07/2026\t100\tDepósito"
      ),
    /Débitos/
  );
});

test("solo marca cercano ambiguo cuando hay más de un candidato elegible", () => {
  const resultado = conciliarDepositos(
    [
      banco(2, "2026-07-01", 10000),
      banco(3, "2026-07-10", 10000),
    ],
    [
      sistema("s-1", "2026-07-02", 10000),
      sistema("s-2", "2026-07-09", 10000),
    ],
    2
  );

  assert.equal(resultado.resumen.porRevisar.cantidad, 2);
  assert.ok(
    resultado.partidas
      .filter((item) => item.estado === "revisar")
      .every((item) => !item.esAmbiguo)
  );
});

test("las métricas mantienen las identidades de control", () => {
  const resultado = conciliarDepositos(
    [
      banco(2, "2026-07-01", 10000),
      banco(3, "2026-07-04", 20000),
      banco(4, "2026-07-08", 30000),
    ],
    [
      sistema("s-1", "2026-07-01", 10000),
      sistema("s-2", "2026-07-03", 20000),
      sistema("s-3", "2026-07-09", 40000),
    ],
    3
  );
  const resumen = resultado.resumen;

  assert.equal(
    resumen.creditosBanco.totalCentavos,
    resumen.perfectos.totalCentavos +
      resumen.porRevisar.totalCentavos +
      resumen.notasCredito.totalCentavos
  );
  assert.equal(
    resumen.depositosSistema.totalCentavos,
    resumen.perfectos.totalCentavos +
      resumen.porRevisar.totalCentavos +
      resumen.notasDebito.totalCentavos
  );
  assert.equal(
    resumen.diferenciaControlCentavos,
    resumen.notasCredito.totalCentavos - resumen.notasDebito.totalCentavos
  );
});

test("permite match cercano al cruzar el borde del período sin crear ND externa", () => {
  const base = conciliarDepositos(
    [banco(2, "2026-07-01", 10000)],
    [
      sistema("s-buffer-match", "2026-06-30", 10000),
      sistema("s-buffer-sin-match", "2026-06-29", 20000),
      sistema("s-periodo", "2026-07-10", 30000),
    ],
    3
  );
  const resultado = limitarResultadoConciliacionAlPeriodo(
    base,
    "2026-07-01",
    "2026-07-31"
  );

  assert.equal(resultado.resumen.porRevisar.cantidad, 1);
  assert.equal(resultado.resumen.notasDebito.cantidad, 1);
  assert.equal(resultado.resumen.depositosSistema.cantidad, 2);
  assert.ok(
    !resultado.partidas.some(
      (item) => item.sistema?.id === "s-buffer-sin-match"
    )
  );
  assert.equal(
    resultado.resumen.diferenciaControlCentavos,
    resultado.resumen.notasCredito.totalCentavos -
      resultado.resumen.notasDebito.totalCentavos
  );
});

test("permite cruce inverso con banco fuera y registro dentro del período", () => {
  const base = conciliarDepositos(
    [
      banco(2, "2026-06-30", 10000),
      banco(3, "2026-06-28", 20000),
    ],
    [sistema("s-periodo", "2026-07-01", 10000)],
    3
  );
  const resultado = limitarResultadoConciliacionAlPeriodo(
    base,
    "2026-07-01",
    "2026-07-31"
  );

  assert.equal(resultado.resumen.porRevisar.cantidad, 1);
  assert.equal(resultado.resumen.notasCredito.cantidad, 0);
  assert.equal(resultado.resumen.creditosBanco.cantidad, 1);
  assert.equal(resultado.resumen.depositosSistema.cantidad, 1);
  assert.ok(!resultado.partidas.some((item) => item.banco?.fila === 3));
  assert.equal(resultado.resumen.diferenciaControlCentavos, 0);
});

test("limita los registros del sistema por fecha de arqueo y concilia depósitos atrasados", () => {
  const depositoAtrasado = {
    ...sistema("s-arqueo-abril", "2026-03-05", 10000),
    fechaArqueo: "2026-04-10",
  };
  const depositoFuera = {
    ...sistema("s-arqueo-marzo", "2026-04-15", 20000),
    fechaArqueo: "2026-03-31",
  };
  const base = conciliarDepositos(
    [banco(2, "2026-03-05", 10000)],
    [depositoAtrasado, depositoFuera],
    3
  );
  const resultado = limitarResultadoConciliacionAlPeriodo(
    base,
    "2026-04-01",
    "2026-04-30"
  );

  assert.equal(resultado.resumen.perfectos.cantidad, 1);
  assert.equal(resultado.resumen.notasDebito.cantidad, 0);
  assert.equal(resultado.resumen.depositosSistema.cantidad, 1);
  assert.equal(resultado.resumen.creditosBanco.cantidad, 1);
  assert.ok(
    resultado.partidas.some(
      (item) => item.sistema?.id === "s-arqueo-abril" && item.banco?.fila === 2
    )
  );
  assert.ok(
    !resultado.partidas.some((item) => item.sistema?.id === "s-arqueo-marzo")
  );
});

test("construye el resumen total sistema más NC menos ND igual banco", () => {
  const resultado = conciliarDepositos(
    [
      banco(2, "2026-07-01", 10000),
      banco(3, "2026-07-05", 30000),
    ],
    [
      sistema("s-match", "2026-07-01", 10000),
      sistema("s-nd", "2026-07-08", 20000),
    ],
    2
  );
  const total = calcularResumenTotalConciliacion(resultado.resumen);

  assert.equal(total.totalSistemaCentavos, 30000);
  assert.equal(total.notasCreditoCentavos, 30000);
  assert.equal(total.notasDebitoCentavos, 20000);
  assert.equal(total.totalSistemaAjustadoCentavos, 40000);
  assert.equal(total.totalBancoCentavos, 40000);
  assert.equal(total.diferenciaFinalCentavos, 0);
  assert.equal(total.conciliado, true);
});
