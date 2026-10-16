import test from "node:test";
import assert from "node:assert/strict";
import { eliminarArqueoCompleto } from "./arqueos.service.ts";

const input = { id: "7c5079d5-912c-4440-9615-9c1602d111fa", motivo: " Registro duplicado ", confirmacion: " ELIMINAR " };

test("elimina el arqueo por ID en una sola petición sin depender de filtros", async (t) => {
  let llamadas = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    llamadas++;
    assert.equal(url, "/api/supabase/rpc/eliminar_arqueo_con_depositos");
    assert.equal(options.method, "POST");
    assert.deepEqual(JSON.parse(options.body), {
      p_id: input.id, p_motivo: "Registro duplicado", p_confirmacion: "ELIMINAR",
    });
    return Response.json({ ok: true, id_arqueo: input.id, depositos_eliminados: 3 });
  });
  await eliminarArqueoCompleto(input);
  assert.equal(llamadas, 1);
});

test("muestra los errores de permisos o dependencias sin informar éxito", async (t) => {
  t.mock.method(globalThis, "fetch", async () => Response.json({ message: "No tiene autorización." }, { status: 403 }));
  await assert.rejects(eliminarArqueoCompleto(input), /No tiene autorización/);
});

test("rechaza respuestas ambiguas o correspondientes a otro arqueo", async (t) => {
  for (const respuesta of [null, {}, { ok: false }, { ok: true, id_arqueo: "otro" }]) {
    const mock = t.mock.method(globalThis, "fetch", async () => Response.json(respuesta));
    await assert.rejects(eliminarArqueoCompleto(input), /No se pudo confirmar/);
    mock.mock.restore();
  }
});

test("no reintenta automáticamente cuando se interrumpe la conexión", async (t) => {
  const mock = t.mock.method(globalThis, "fetch", async () => { throw new Error("Conexión interrumpida"); });
  await assert.rejects(eliminarArqueoCompleto(input), /Conexión interrumpida/);
  assert.equal(mock.mock.callCount(), 1);
});
