import test from "node:test";
import assert from "node:assert/strict";
import {
  calcularEsperaRateLimit,
  interpretarRetryAfterMs,
} from "./reintentos-rate-limit.ts";

test("interpreta Retry-After con segundos decimales", () => {
  assert.equal(interpretarRetryAfterMs("1.821"), 1_821);
});

test("interpreta Retry-After con una fecha HTTP", () => {
  const ahoraMs = Date.parse("2026-08-07T12:00:00.000Z");

  assert.equal(
    interpretarRetryAfterMs("Fri, 07 Aug 2026 12:00:03 GMT", ahoraMs),
    3_000
  );
});

test("usa espera exponencial con jitter cuando no hay Retry-After", () => {
  assert.equal(
    calcularEsperaRateLimit({
      intento: 2,
      retryAfter: null,
      jitterMs: 125,
    }),
    8_125
  );
});

test("trata Retry-After como espera minima y agrega jitter", () => {
  assert.equal(
    calcularEsperaRateLimit({
      intento: 0,
      retryAfter: "1.821",
      jitterMs: 179,
    }),
    2_000
  );
});
