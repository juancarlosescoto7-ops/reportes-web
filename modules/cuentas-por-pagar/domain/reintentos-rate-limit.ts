const ESPERA_INICIAL_MS = 2_000;
const ESPERA_MAXIMA_EXPONENCIAL_MS = 30_000;

export function interpretarRetryAfterMs(
  retryAfter: string | null,
  ahoraMs = Date.now()
) {
  if (!retryAfter) return null;

  const segundos = Number(retryAfter);
  if (Number.isFinite(segundos) && segundos >= 0) {
    return Math.ceil(segundos * 1_000);
  }

  const fechaMs = Date.parse(retryAfter);
  if (!Number.isFinite(fechaMs)) return null;

  return Math.max(0, fechaMs - ahoraMs);
}

export function calcularEsperaRateLimit(input: {
  intento: number;
  retryAfter: string | null;
  jitterMs?: number;
  ahoraMs?: number;
}) {
  const esperaIndicada = interpretarRetryAfterMs(
    input.retryAfter,
    input.ahoraMs
  );
  const esperaExponencial = Math.min(
    ESPERA_INICIAL_MS * 2 ** Math.max(0, input.intento),
    ESPERA_MAXIMA_EXPONENCIAL_MS
  );

  return (
    (esperaIndicada ?? esperaExponencial) +
    Math.max(0, Math.floor(input.jitterMs ?? 0))
  );
}
