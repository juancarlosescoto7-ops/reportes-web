import assert from "node:assert/strict";
import test from "node:test";

import { normalizarReporteOficinaMujer } from "./reporte-oficina-mujer.ts";

test("distribuye el ejecutable general según el vigente y descuenta ejecución y compromiso", () => {
  const reporte = normalizarReporteOficinaMujer(
    [
      {
        programa_nombre: "Oficina de la Mujer",
        subprograma_nombre: "Gestión social",
        proyecto_nombre: "Eje 1 - Prevención",
        presupuesto_vigente: 300,
        ejecutado: 40,
        comprometido: 20,
      },
      {
        programa_nombre: "OFICINA DE LA MUJER",
        subprograma_nombre: "Gestión social",
        proyecto_nombre: "Eje 2 - Autonomía económica",
        presupuesto_vigente: 700,
        ejecutado: 100,
        total_comprometido: 50,
      },
      {
        programa_nombre: "Servicios públicos",
        proyecto_nombre: "Eje ajeno",
        presupuesto_vigente: 9999,
        ejecutado: 9999,
      },
    ],
    [
      {
        fuente: "Transferencias",
        tipo: "Oficina de la Mujer",
        montopermitido: 500,
      },
    ]
  );

  assert.equal(reporte.nivelEje, "Proyecto");
  assert.equal(reporte.montoVigenteGrupo, 1000);
  assert.equal(reporte.ejecutableGeneralGrupo, 500);
  assert.equal(reporte.ejes.length, 2);

  const [eje1, eje2] = reporte.ejes;
  assert.equal(eje1.porcentajeEjecutable, 30);
  assert.equal(eje1.montoEjecutable, 150);
  assert.equal(eje1.saldoEjecutable, 90);
  assert.equal(eje2.porcentajeEjecutable, 70);
  assert.equal(eje2.montoEjecutable, 350);
  assert.equal(eje2.saldoEjecutable, 200);
  assert.equal(reporte.saldoEjecutableGrupo, 290);
});

test("usa el primer nivel con varios valores cuando los nombres no incluyen Eje", () => {
  const reporte = normalizarReporteOficinaMujer(
    [
      {
        programa_nombre: "Oficina Municipal de la Mujer",
        subprograma_nombre: "Prevención",
        presupuesto_vigente: 60,
      },
      {
        programa_nombre: "Oficina Municipal de la Mujer",
        subprograma_nombre: "Participación",
        presupuesto_vigente: 40,
      },
    ],
    [{ tipo: "Oficina Municipal de la Mujer", montopermitido: 80 }]
  );

  assert.equal(reporte.nivelEje, "Subprograma");
  assert.deepEqual(
    reporte.ejes.map((eje) => eje.porcentajeEjecutable),
    [40, 60]
  );
  assert.equal(reporte.saldoEjecutableGrupo, 80);
});

test("encuentra Oficina de la Mujer aunque el grupo esté en proyecto", () => {
  const reporte = normalizarReporteOficinaMujer(
    [
      {
        programa_nombre: "Desarrollo social",
        subprograma_nombre: "Inclusión",
        proyecto_nombre: "Oficina Municipal de la Mujer",
        actividad_nombre: "Eje 1 - Prevención de violencia",
        presupuesto_vigente: 250,
        ejecutado: 25,
      },
      {
        programa_nombre: "Desarrollo social",
        subprograma_nombre: "Inclusión",
        proyecto_nombre: "Oficina Municipal de la Mujer",
        actividad_nombre: "Eje 2 - Autonomía económica",
        presupuesto_vigente: 750,
        comprometido: 50,
      },
    ],
    [{ tipo: "Oficina de la Mujer", montopermitido: 400 }]
  );

  assert.equal(reporte.grupo, "Oficina Municipal de la Mujer");
  assert.equal(reporte.nivelEje, "Actividad");
  assert.equal(reporte.ejes.length, 2);
  assert.deepEqual(
    reporte.ejes.map((eje) => eje.porcentajeEjecutable),
    [25, 75]
  );
  assert.equal(reporte.saldoEjecutableGrupo, 325);
});
