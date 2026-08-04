import type {
  AntecedenteCompromisoSesion,
  CxpParaRecomendacionSesion,
  OpcionPresupuestoSesion,
  RecomendacionPresupuestoSesion,
} from "@/lib/recomendaciones-presupuesto-sesion";

const TAMANO_LOTE = 30;

type RespuestaLote = {
  recomendaciones?: RecomendacionPresupuestoSesion[];
  error?: string;
};

async function solicitarLote(input: {
  cuentas: CxpParaRecomendacionSesion[];
  opciones: OpcionPresupuestoSesion[];
  antecedentes: AntecedenteCompromisoSesion[];
}) {
  const response = await fetch("/api/recomendaciones-presupuesto-sesion", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
  const data = (await response.json().catch(() => null)) as RespuestaLote | null;

  if (!response.ok) {
    throw new Error(
      data?.error ?? "No se pudieron generar las recomendaciones presupuestarias."
    );
  }

  return data?.recomendaciones ?? [];
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
