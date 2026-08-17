"use client";

import type {
  CategoriaBusquedaUniversal,
  ResultadoBusquedaUniversal,
} from "@/lib/busqueda-universal";

export type ResumenCategoriaAsistente = {
  categoria: CategoriaBusquedaUniversal;
  cantidad: number;
  montoTotal: number;
  metricas: Record<string, number>;
};

export type EvidenciaAsistenteFinanciero = Pick<
  ResultadoBusquedaUniversal,
  | "id"
  | "categoria"
  | "categoriaLabel"
  | "titulo"
  | "subtitulo"
  | "descripcion"
  | "metadatos"
  | "estado"
  | "fecha"
  | "monto"
  | "metricas"
  | "href"
>;

export type TurnoAsistenteFinanciero = {
  pregunta: string;
  respuesta: string;
};

export type RespuestaAsistenteFinanciero = {
  respuesta: string;
  puntos_clave: string[];
  advertencias: string[];
  fuentes: string[];
  preguntas_sugeridas: string[];
};

export function resumirResultadosAsistente(
  resultados: ResultadoBusquedaUniversal[]
): ResumenCategoriaAsistente[] {
  const resumen = new Map<
    CategoriaBusquedaUniversal,
    ResumenCategoriaAsistente
  >();

  resultados.forEach((resultado) => {
    const actual = resumen.get(resultado.categoria) ?? {
      categoria: resultado.categoria,
      cantidad: 0,
      montoTotal: 0,
      metricas: {},
    };

    actual.cantidad += 1;
    actual.montoTotal += numeroSeguro(resultado.monto);

    Object.entries(resultado.metricas ?? {}).forEach(([nombre, valor]) => {
      actual.metricas[nombre] =
        (actual.metricas[nombre] ?? 0) + numeroSeguro(valor);
    });

    resumen.set(resultado.categoria, actual);
  });

  return Array.from(resumen.values()).map((item) => ({
    ...item,
    montoTotal: redondear(item.montoTotal),
    metricas: Object.fromEntries(
      Object.entries(item.metricas).map(([key, value]) => [key, redondear(value)])
    ),
  }));
}

export async function consultarAsistenteFinanciero(input: {
  pregunta: string;
  tema: string;
  totalRelacionados: number;
  resultados: ResultadoBusquedaUniversal[];
  resumenCategorias: ResumenCategoriaAsistente[];
  historial: TurnoAsistenteFinanciero[];
}): Promise<RespuestaAsistenteFinanciero> {
  const response = await fetch("/api/asistente-financiero", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      pregunta: input.pregunta,
      tema: input.tema,
      totalRelacionados: input.totalRelacionados,
      resumenCategorias: input.resumenCategorias,
      historial: input.historial.slice(-4),
      resultados: input.resultados.slice(0, 80).map(serializarEvidencia),
    }),
  });
  const data = (await response.json().catch(() => null)) as
    | (Partial<RespuestaAsistenteFinanciero> & { error?: unknown })
    | null;

  if (!response.ok) {
    throw new Error(
      typeof data?.error === "string"
        ? data.error
        : "No se pudo consultar el asistente financiero."
    );
  }

  if (!data || typeof data.respuesta !== "string") {
    throw new Error("El asistente devolvió una respuesta incompleta.");
  }

  return {
    respuesta: data.respuesta,
    puntos_clave: Array.isArray(data.puntos_clave) ? data.puntos_clave : [],
    advertencias: Array.isArray(data.advertencias) ? data.advertencias : [],
    fuentes: Array.isArray(data.fuentes) ? data.fuentes : [],
    preguntas_sugeridas: Array.isArray(data.preguntas_sugeridas)
      ? data.preguntas_sugeridas
      : [],
  };
}

function serializarEvidencia(
  resultado: ResultadoBusquedaUniversal
): EvidenciaAsistenteFinanciero {
  return {
    id: resultado.id,
    categoria: resultado.categoria,
    categoriaLabel: resultado.categoriaLabel,
    titulo: resultado.titulo,
    subtitulo: resultado.subtitulo,
    descripcion: resultado.descripcion,
    metadatos: resultado.metadatos,
    estado: resultado.estado,
    fecha: resultado.fecha,
    monto: resultado.monto,
    metricas: resultado.metricas,
    href: resultado.href,
  };
}

function numeroSeguro(value: unknown) {
  const numero = Number(value);
  return Number.isFinite(numero) ? numero : 0;
}

function redondear(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
