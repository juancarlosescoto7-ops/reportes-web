import test from "node:test";
import assert from "node:assert/strict";
import { ejecutarRPCPaginado } from "./rpc-paginado.ts";

test("consulta todas las paginas de una RPC sin detenerse en los primeros 1000", async (t) => {
  const rangos = [];
  const fetchOriginal = globalThis.fetch;

  t.after(() => {
    globalThis.fetch = fetchOriginal;
  });

  globalThis.fetch = async (_url, init) => {
    const rango = init?.headers?.Range;
    rangos.push(rango);

    const desde = Number(String(rango).split("-")[0]);
    const cantidad = desde === 0 ? 1_000 : 205;
    const data = Array.from({ length: cantidad }, (_, index) => ({
      id: desde + index + 1,
    }));

    return new Response(JSON.stringify(data), {
      status: desde === 0 ? 206 : 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Range": `${desde}-${desde + cantidad - 1}/1205`,
      },
    });
  };

  const resultado = await ejecutarRPCPaginado("rpc_prueba");

  assert.equal(resultado.length, 1_205);
  assert.deepEqual(rangos, ["0-999", "1000-1999"]);
});
