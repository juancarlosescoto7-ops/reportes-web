import assert from "node:assert/strict";
import test from "node:test";

import { ordenarArchivosExpediente } from "./expedienteProyectoPdf.ts";

test("inserta las ordenes de pago despues de Ejecucion", () => {
  const archivos = ordenarArchivosExpediente({
    requisitos: [
      { id: 1, nombre: "Contrato", url: "https://example.test/1.pdf" },
      { id: 2, nombre: "Ejecución", url: "https://example.test/2.pdf" },
      { id: 3, nombre: "Cierre", url: "https://example.test/3.pdf" },
    ],
    ordenes: [
      {
        id: "20",
        nombre: "Orden de pago #20",
        url: "https://example.test/20.pdf",
      },
      {
        id: "3",
        nombre: "Orden de pago #3",
        url: "https://example.test/3-orden.pdf",
      },
    ],
  });

  assert.deepEqual(
    archivos.map((archivo) => archivo.clave),
    [
      "requisito:1",
      "requisito:2",
      "orden_pago:3",
      "orden_pago:20",
      "requisito:3",
    ]
  );
});

test("omite archivos vacios y duplicados", () => {
  const archivos = ordenarArchivosExpediente({
    requisitos: [
      { id: 1, nombre: "Contrato", url: null },
      { id: 2, nombre: "Ejecucion", url: "https://example.test/2.pdf" },
      { id: 2, nombre: "Ejecucion", url: "https://example.test/repetido.pdf" },
    ],
    ordenes: [
      { id: "7", nombre: "Orden #7", url: "https://example.test/7.pdf" },
      {
        id: "7",
        nombre: "Orden #7 repetida",
        url: "https://example.test/7-repetida.pdf",
      },
    ],
  });

  assert.deepEqual(
    archivos.map((archivo) => archivo.url),
    ["https://example.test/2.pdf", "https://example.test/7.pdf"]
  );
});

test("coloca las ordenes al final si el apartado Ejecucion no existe", () => {
  const archivos = ordenarArchivosExpediente({
    requisitos: [
      { id: 1, nombre: "Inicio", url: "https://example.test/1.pdf" },
      { id: 2, nombre: "Cierre", url: "https://example.test/2.pdf" },
    ],
    ordenes: [
      { id: "9", nombre: "Orden #9", url: "https://example.test/9.pdf" },
    ],
  });

  assert.deepEqual(
    archivos.map((archivo) => archivo.clave),
    ["requisito:1", "requisito:2", "orden_pago:9"]
  );
});

test("respeta la posicion de Ejecucion aunque ese requisito no tenga PDF", () => {
  const archivos = ordenarArchivosExpediente({
    requisitos: [
      { id: 1, nombre: "Inicio", url: "https://example.test/1.pdf" },
      { id: 2, nombre: "Ejecucion", url: null },
      { id: 3, nombre: "Cierre", url: "https://example.test/3.pdf" },
    ],
    ordenes: [
      { id: "9", nombre: "Orden #9", url: "https://example.test/9.pdf" },
    ],
  });

  assert.deepEqual(
    archivos.map((archivo) => archivo.clave),
    ["requisito:1", "orden_pago:9", "requisito:3"]
  );
});
