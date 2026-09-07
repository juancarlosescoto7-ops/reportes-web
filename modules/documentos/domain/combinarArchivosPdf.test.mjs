import assert from "node:assert/strict";
import test from "node:test";

import { PDFDocument } from "pdf-lib";

import { combinarArchivosPdf } from "./combinarArchivosPdf.ts";

async function crearPdf(anchos) {
  const pdf = await PDFDocument.create();
  anchos.forEach((ancho) => pdf.addPage([ancho, 500]));
  return pdf.save();
}

test("combina todas las paginas en el orden recibido", async () => {
  const primero = await crearPdf([101, 102]);
  const segundo = await crearPdf([201]);
  const resultado = await combinarArchivosPdf({
    archivos: [
      { nombre: "Primero", bytes: primero },
      { nombre: "Segundo", bytes: segundo },
    ],
    metadatos: {
      titulo: "Expediente de prueba",
      asunto: "Validacion",
      creador: "Pruebas",
    },
  });
  const combinado = await PDFDocument.load(resultado.bytes);

  assert.equal(resultado.cantidadPaginas, 3);
  assert.deepEqual(
    combinado.getPages().map((pagina) => pagina.getWidth()),
    [101, 102, 201]
  );
  assert.equal(combinado.getTitle(), "Expediente de prueba");
});

test("identifica el archivo que no puede incorporarse", async () => {
  await assert.rejects(
    combinarArchivosPdf({
      archivos: [
        {
          nombre: "Documento protegido",
          bytes: new TextEncoder().encode("no es un pdf"),
        },
      ],
      metadatos: {
        titulo: "Expediente",
        asunto: "Validacion",
        creador: "Pruebas",
      },
    }),
    /Documento protegido/
  );
});
