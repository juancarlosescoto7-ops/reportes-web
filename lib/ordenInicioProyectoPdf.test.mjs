import assert from "node:assert/strict";
import test from "node:test";

import {
  crearNombreArchivoOrdenInicio,
  formatearFechaOrdenInicio,
  generarOrdenInicioProyectoPdf,
} from "./ordenInicioProyectoPdf.ts";

test("formatea fecha y nombre de archivo de forma estable", () => {
  assert.equal(formatearFechaOrdenInicio("2026-08-11"), "11 de agosto de 2026");
  assert.equal(
    crearNombreArchivoOrdenInicio("OB-17", "Reparación del Centro Comunal"),
    "orden-de-inicio-OB-17-Reparacion-del-Centro-Comunal.pdf"
  );
});

test("genera un PDF carta válido sin depender de logos", async () => {
  const bytes = await generarOrdenInicioProyectoPdf({
    codigoProyecto: "OB-17",
    proyecto: "Reparación del Centro Comunal",
    departamento: "Francisco Morazán",
    municipio: "Talanga",
    ubicacion: "Barrio El Centro, Talanga",
    fuente: "Fondos Municipales",
    monto: 1_250_000.5,
    fecha: "2026-08-11",
    firmas: {
      alcalde: "Alcalde de prueba",
      jefeUtm: "Jefe UTM de prueba",
      contratista: "Contratista de prueba",
    },
  });

  assert.ok(bytes.length > 1_000);
  assert.equal(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
});
