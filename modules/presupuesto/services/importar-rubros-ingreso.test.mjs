import test from "node:test";
import assert from "node:assert/strict";
import { importarRubrosIngresoBorrador } from "./borradorPresupuesto.ts";

test("guarda el monto como proyección total y reintenta sin duplicar filas creadas o guardadas", async (t) => {
  const peticiones = [];
  let fallar = true;
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    const body = JSON.parse(init.body);
    peticiones.push(body);
    if (fallar && body.codigoSaft === "002" && body.accion === "guardar_ingreso") {
      return Response.json({ error: "Fallo temporal" }, { status: 500 });
    }
    return Response.json({ id: body.codigoSaft });
  });
  const estados = new Map();
  const input = {
    borradorId: "borrador-prueba",
    rubros: [{ codigoSaft: "001", descripcionSaft: "Primero", monto: 1250.5 }, { codigoSaft: "002", descripcionSaft: "Segundo", monto: 0 }],
    estados,
    onProgress() {},
  };
  await assert.rejects(importarRubrosIngresoBorrador(input), /002.*monto sigue pendiente/);
  assert.equal(estados.get("001"), "guardado");
  assert.equal(estados.get("002"), "creado");
  assert.deepEqual(peticiones[1], { accion: "guardar_ingreso", borradorId: "borrador-prueba", codigoSaft: "001", cantidadNegocios: 1, montoPorNegocio: 1250.5 });
  fallar = false;
  await importarRubrosIngresoBorrador(input);
  assert.equal(peticiones.length, 5);
  assert.equal(peticiones[4].accion, "guardar_ingreso");
  assert.equal(peticiones[4].codigoSaft, "002");
  assert.equal(peticiones[4].montoPorNegocio, 0);
  assert.equal(estados.get("002"), "guardado");
});

test("detiene el lote si falla la creación sin intentar guardar su monto", async (t) => {
  const peticiones = [];
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    peticiones.push(JSON.parse(init.body));
    return Response.json({ error: "Código existente" }, { status: 409 });
  });
  const estados = new Map();
  await assert.rejects(importarRubrosIngresoBorrador({
    borradorId: "prueba", estados, onProgress() {},
    rubros: [{ codigoSaft: "001", descripcionSaft: "Ingreso", monto: 10 }, { codigoSaft: "002", descripcionSaft: "Otro", monto: 20 }],
  }), /001.*Código existente/);
  assert.equal(peticiones.length, 1);
  assert.equal(estados.size, 0);
});
