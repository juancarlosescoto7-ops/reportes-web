import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizarOrdenesPagoConDocumento,
  obtenerRutaObjetoOrdenPago,
} from "./ordenes-pago-documentos.ts";

test("lee el estado documental directamente desde la RPC", () => {
  const ordenes = normalizarOrdenesPagoConDocumento([
    {
      no_orden: "102",
      fecha: "2026-07-20",
      descripcion: "Pago de materiales",
      tiene_archivo: true,
      nombre_archivo: "Orden_pago_102.pdf",
      ruta_storage: "ordenes_pago/Orden_pago_102.pdf",
    },
    {
      no_orden: 101,
      fecha: "2026-07-19",
      descripcion: "Pago de servicios",
      tiene_archivo: false,
      nombre_archivo: null,
      ruta_storage: null,
    },
  ]);

  assert.deepEqual(ordenes, [
    {
      noOrden: 102,
      fecha: "2026-07-20",
      descripcion: "Pago de materiales",
      nombreDocumento: "Orden_pago_102.pdf",
      rutaDocumento: "ordenes_pago/Orden_pago_102.pdf",
      tieneDocumento: true,
    },
    {
      noOrden: 101,
      fecha: "2026-07-19",
      descripcion: "Pago de servicios",
      nombreDocumento: null,
      rutaDocumento: null,
      tieneDocumento: false,
    },
  ]);
});

test("descarta numeros de orden nulos o invalidos", () => {
  const ordenes = normalizarOrdenesPagoConDocumento([
    {
      no_orden: null,
      fecha: null,
      descripcion: null,
      tiene_archivo: true,
      nombre_archivo: "sin-orden.pdf",
      ruta_storage: "ordenes_pago/sin-orden.pdf",
    },
    {
      no_orden: 0,
      fecha: null,
      descripcion: null,
      tiene_archivo: false,
      nombre_archivo: null,
      ruta_storage: null,
    },
  ]);

  assert.deepEqual(ordenes, []);
});

test("si la RPC repite una orden conserva el estado con archivo", () => {
  const ordenes = normalizarOrdenesPagoConDocumento([
    {
      no_orden: 300,
      fecha: null,
      descripcion: null,
      tiene_archivo: false,
      nombre_archivo: null,
      ruta_storage: null,
    },
    {
      no_orden: 300,
      fecha: "2026-07-21",
      descripcion: "Orden documentada",
      tiene_archivo: true,
      nombre_archivo: "Orden_pago_300.pdf",
      ruta_storage: "ordenes_pago/Orden_pago_300.pdf",
    },
  ]);

  assert.deepEqual(ordenes, [
    {
      noOrden: 300,
      fecha: "2026-07-21",
      descripcion: "Orden documentada",
      nombreDocumento: "Orden_pago_300.pdf",
      rutaDocumento: "ordenes_pago/Orden_pago_300.pdf",
      tieneDocumento: true,
    },
  ]);
});

test("obtiene la ruta relativa del objeto desde una ruta o URL de Storage", () => {
  assert.equal(
    obtenerRutaObjetoOrdenPago({
      rutaStorage: "ordenes_pago/carpeta/Orden_pago_102.pdf",
      nombreArchivo: null,
    }),
    "carpeta/Orden_pago_102.pdf"
  );

  assert.equal(
    obtenerRutaObjetoOrdenPago({
      rutaStorage:
        "https://ejemplo.supabase.co/storage/v1/object/public/ordenes_pago/Orden_pago_103.pdf",
      nombreArchivo: null,
    }),
    "Orden_pago_103.pdf"
  );
});

test("usa el nombre de archivo cuando no hay una ruta de Storage", () => {
  assert.equal(
    obtenerRutaObjetoOrdenPago({
      rutaStorage: null,
      nombreArchivo: "Orden_pago_104.pdf",
    }),
    "Orden_pago_104.pdf"
  );
});
