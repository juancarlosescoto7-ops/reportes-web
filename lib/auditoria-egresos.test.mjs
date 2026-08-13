import assert from "node:assert/strict";
import test from "node:test";

import {
  agruparEgresosAuditoriaPorMes,
  agruparEgresosAuditoriaPorOrden,
  construirUrlDocumentoAuditoria,
  normalizarReporteAuditoria,
} from "./auditoria-egresos.ts";

const egresos = normalizarReporteAuditoria([
  {
    no_orden: "102",
    fecha: "2026-08-12",
    descripcion: "Pago de materiales",
    proveedor: "Proveedor A",
    cheque: "9001",
    monto_egreso: "1500.50",
    nombre_archivo: "Orden_pago_102.pdf",
    ruta_storage: "ordenes_pago/Orden_pago_102.pdf",
  },
  {
    no_orden: 101,
    fecha: "2026-07-20",
    descripcion: null,
    proveedor: null,
    cheque: null,
    monto_egreso: 250,
    nombre_archivo: null,
    ruta_storage: null,
  },
]);

test("normaliza el reporte sin campos de ejecucion presupuestaria", () => {
  assert.deepEqual(egresos[0], {
    noOrden: 102,
    fecha: "2026-08-12",
    descripcion: "Pago de materiales",
    proveedor: "Proveedor A",
    cheque: "9001",
    montoEgreso: 1500.5,
    nombreDocumento: "Orden_pago_102.pdf",
    rutaDocumento: "ordenes_pago/Orden_pago_102.pdf",
  });
  assert.equal("totalEjecutado" in egresos[0], false);
});

test("agrupa los egresos por mes en orden descendente", () => {
  const grupos = agruparEgresosAuditoriaPorMes(egresos);

  assert.deepEqual(
    grupos.map((grupo) => grupo.id),
    ["2026-08", "2026-07"]
  );
  assert.equal(grupos[0].total, 1500.5);
  assert.equal(grupos[0].cantidadOrdenes, 1);
});

test("mantiene cada cheque y beneficiario en un renglon separado", () => {
  const renglones = normalizarReporteAuditoria(
    Array.from({ length: 30 }, (_, index) => ({
      no_orden: 200,
      fecha: "2026-08-13",
      descripcion: "Pago a 30 beneficiarios",
      proveedor: `Beneficiario ${index + 1}`,
      cheque: String(1001 + index),
      monto_egreso: 10,
      nombre_archivo: "Orden_pago_200.pdf",
      ruta_storage: "ordenes_pago/Orden_pago_200.pdf",
    }))
  );

  assert.equal(renglones.length, 30);
  assert.deepEqual(
    [renglones[0].cheque, renglones[0].proveedor],
    ["1001", "Beneficiario 1"]
  );
  assert.deepEqual(
    [renglones[29].cheque, renglones[29].proveedor],
    ["1030", "Beneficiario 30"]
  );

  const [grupo] = agruparEgresosAuditoriaPorMes(renglones);
  assert.equal(grupo.items.length, 30);
  assert.equal(grupo.cantidadOrdenes, 1);
  assert.equal(grupo.total, 300);

  const ordenes = agruparEgresosAuditoriaPorOrden(renglones);
  assert.equal(ordenes.length, 1);
  assert.equal(ordenes[0].detalles.length, 30);
  assert.equal(ordenes[0].montoEgreso, 300);
});

test("construye el enlace publico de la orden de pago", () => {
  assert.equal(
    construirUrlDocumentoAuditoria(
      "https://ejemplo.supabase.co/",
      "ordenes_pago/Orden_pago_102.pdf"
    ),
    "https://ejemplo.supabase.co/storage/v1/object/public/ordenes_pago/Orden_pago_102.pdf"
  );
});
