import assert from "node:assert/strict";
import test from "node:test";
import {
  escucharEgresosRegistrados,
  notificarEgresoRegistrado,
} from "./egresos-events.ts";

test("notifica a la vista abierta y deja de notificar después de desmontarla", (t) => {
  t.mock.method(globalThis, "BroadcastChannel", function () {
    return { postMessage() {}, close() {} };
  });
  globalThis.window = new EventTarget();
  t.after(() => { delete globalThis.window; });
  const recibidos = [];
  const desconectar = escucharEgresosRegistrados((orden) => recibidos.push(orden));
  t.after(desconectar);
  notificarEgresoRegistrado(102);
  notificarEgresoRegistrado("103");
  for (const invalido of [null, undefined, {}, "", "abc", 0, -1, 1.5]) {
    notificarEgresoRegistrado(invalido);
  }
  desconectar();
  notificarEgresoRegistrado(104);
  assert.deepEqual(recibidos, ["102", "103"]);
});

test("recibe órdenes desde otro canal sin duplicar el aviso local", async (t) => {
  globalThis.window = new EventTarget();
  t.after(() => { delete globalThis.window; });
  const recibidos = [];
  const canalExterno = new BroadcastChannel("reportes:egreso-registrado");
  t.after(() => canalExterno.close());
  const recibido = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("No llegó el aviso entre pestañas")), 2000);
    t.after(() => clearTimeout(timeout));
    const desconectar = escucharEgresosRegistrados((orden) => {
      recibidos.push(orden);
      if (orden === "105") resolve();
    });
    t.after(desconectar);
  });
  notificarEgresoRegistrado(104);
  canalExterno.postMessage({ noOrden: "105", origen: "otra-pestana" });
  await recibido;
  assert.deepEqual(recibidos, ["104", "105"]);
});

test("el registro local funciona aunque el navegador no permita canales", (t) => {
  t.mock.method(globalThis, "BroadcastChannel", class {
    constructor() { throw new Error("Canal no disponible"); }
  });
  globalThis.window = new EventTarget();
  t.after(() => { delete globalThis.window; });
  const recibidos = [];
  t.after(escucharEgresosRegistrados((orden) => recibidos.push(orden)));
  assert.doesNotThrow(() => notificarEgresoRegistrado(106));
  assert.deepEqual(recibidos, ["106"]);
});
