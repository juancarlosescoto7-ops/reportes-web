import type {
  AntecedenteCompromisoSesion,
  CxpParaRecomendacionSesion,
  OpcionPresupuestoSesion,
  RecomendacionPresupuestoSesion,
} from "@/lib/recomendaciones-presupuesto-sesion";
import { calcularEsperaRateLimit } from "@/lib/reintentos-rate-limit";

const TAMANO_LOTE = 30;
const MAX_REINTENTOS_RATE_LIMIT = 5;
const MAX_TIEMPO_REINTENTOS_MS = 60_000;
const JITTER_MAXIMO_MS = 250;

type RespuestaLote = {
  recomendaciones?: RecomendacionPresupuestoSesion[];
  error?: string;
  retryable?: boolean;
};

function esperar(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

async function solicitarLote(input: {
  cuentas: CxpParaRecomendacionSesion[];
  opciones: OpcionPresupuestoSesion[];
  antecedentes: AntecedenteCompromisoSesion[];
}) {
  let tiempoEsperadoMs = 0;

  for (let intento = 0; ; intento += 1) {
    const response = await fetch("/api/recomendaciones-presupuesto-sesion", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });
    const data = (await response
      .json()
      .catch(() => null)) as RespuestaLote | null;

    if (response.ok) {
      return data?.recomendaciones ?? [];
    }

    const mensaje =
      data?.error ??
      "No se pudieron generar las recomendaciones presupuestarias.";
    const puedeReintentar =
      response.status === 429 && data?.retryable === true;

    if (!puedeReintentar || intento >= MAX_REINTENTOS_RATE_LIMIT) {
      throw new Error(mensaje);
    }

    const esperaMs = calcularEsperaRateLimit({
      intento,
      retryAfter: response.headers.get("Retry-After"),
      jitterMs: Math.random() * JITTER_MAXIMO_MS,
    });

    if (tiempoEsperadoMs + esperaMs > MAX_TIEMPO_REINTENTOS_MS) {
      throw new Error(mensaje);
    }

    tiempoEsperadoMs += esperaMs;
    await esperar(esperaMs);
  }
}

export async function generarRecomendacionesPresupuestoSesion(input: {
  cuentas: CxpParaRecomendacionSesion[];
  opciones: OpcionPresupuestoSesion[];
  antecedentes: AntecedenteCompromisoSesion[];
  onLote?: (input: {
    recomendaciones: RecomendacionPresupuestoSesion[];
    procesadas: number;
    total: number;
  }) => void;
}) {
  const resultado: RecomendacionPresupuestoSesion[] = [];

  for (let index = 0; index < input.cuentas.length; index += TAMANO_LOTE) {
    const lote = input.cuentas.slice(index, index + TAMANO_LOTE);
    const recomendaciones = await solicitarLote({
      cuentas: lote,
      opciones: input.opciones,
      antecedentes: input.antecedentes,
    });

    resultado.push(...recomendaciones);
    input.onLote?.({
      recomendaciones,
      procesadas: Math.min(index + lote.length, input.cuentas.length),
      total: input.cuentas.length,
    });
  }

  return resultado;
}
