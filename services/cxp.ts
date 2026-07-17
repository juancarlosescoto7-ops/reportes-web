import { ejecutarRPC } from "@/lib/supabase";

export type CXP = {
  cxp_id: number;
  fecha: string | null;
  descripcion: string | null;
  no_cxp: number;
  tipo_movimiento: string | null;
  cuenta: string | null;

  beneficiario_id: string | null;
  beneficiario_nombre: string;

  estado_administrativo: string;
  estado_operativo: string;

  haber: number;
  debe?: number;
  monto_comprometido: number;
  saldo_por_comprometer: number;

  no_orden_pago: number | null;
  monto_pagado: number;
  monto_ejecutado_presupuestario: number;
  saldo_por_ejecutar: number;

  /**
   * Campo de compatibilidad temporal con el componente actual.
   * En esta fase representa monto comprometido.
   */
  monto_ejecutado: number;

  /**
   * Estos campos vienen de obtener_bandeja_cxp_unificada.
   * Representan el estado operativo interno de la CxP.
   */
  decision_pago: string;
  motivo_pago: string;

  puede_comprometer: boolean;
  puede_pagar_con_compromiso: boolean;
  puede_pagar_sin_ejecucion: boolean;
  puede_asignar_ejecucion: boolean;
  puede_anular: boolean;

  /**
   * Estos campos vienen de obtener_recomendaciones_cxp.
   * Representan la recomendación financiera real.
   */
  recomendacion_financiera?: string | null;
  motivo_recomendacion_financiera?: string | null;
  codigos_recomendacion_financiera?: string | null;
  monto_recomendacion_base?: number | null;
  monto_comprometido_recomendacion?: number | null;

  /**
   * Compatibilidad con nombres usados anteriormente.
   * Puedes eliminarlos después si el componente ya usa recomendacion_financiera.
   */
  recomendacion_pago?: string | null;
  motivo_recomendacion_pago?: string | null;
  monto_recomendado_pago?: number | null;
  saldo_codigo_minimo?: number | null;
  margen_grupo_minimo?: number | null;
  estado_codigos?: string | null;
  monto_pendiente_codigos?: number | null;
  monto_cubierto_por_codigos?: number | null;
  detalle_codigos?: CxpDetalleCodigo[];
  estado_grupos?: string | null;
  monto_pendiente_grupos?: number | null;
  monto_cubierto_por_grupos?: number | null;
  detalle_grupos?: CxpDetalleGrupo[];
  analisis_riesgo?: string | null;
};

export type CxpDetalleCodigo = {
  codigo_presupuestario?: string | null;
  monto_comprometido?: number | null;
  monto_pendiente?: number | null;
  saldo_codigo_actual?: number | null;
  monto_pendiente_anterior?: number | null;
  saldo_codigo_proyectado?: number | null;
  monto_cubierto?: number | null;
  estado?: string | null;
};

export type CxpDetalleGrupo = {
  fuente?: string | null;
  grupo?: string | null;
  monto_pendiente?: number | null;
  saldo_grupo_actual?: number | null;
  monto_pendiente_anterior?: number | null;
  saldo_grupo_proyectado?: number | null;
  monto_cubierto?: number | null;
  estado?: string | null;
};

export type CxpRecomendacionFinanciera = {
  no_cxp: number;
  tipo_cxp: string | null;
  fecha: string | null;
  descripcion: string | null;
  beneficiario_id: string | null;
  beneficiario_nombre: string | null;
  estado: string | null;
  monto_obligacion: number;
  monto_pagado?: number;
  saldo_real_cxp?: number;
  monto_comprometido: number;
  codigos_presupuestarios: string | null;
  estado_codigos: string | null;
  monto_pendiente_codigos: number;
  monto_cubierto_por_codigos: number;
  detalle_codigos: CxpDetalleCodigo[];
  estado_grupos: string | null;
  monto_pendiente_grupos: number;
  monto_cubierto_por_grupos: number;
  detalle_grupos: CxpDetalleGrupo[];
  analisis_riesgo: string | null;
};

function normalizarTexto(value: string | null | undefined) {
  return (value ?? "").trim();
}

function cxpKey(
  noCxp: number | string,
  tipoMovimiento: string | null | undefined
) {
  return `${noCxp}::${normalizarTexto(tipoMovimiento)}`;
}

function cxpNoKey(noCxp: number | string) {
  return String(noCxp).trim();
}

function esCoberturaSuficiente(estado: string | null | undefined) {
  return normalizarTexto(estado) === "Cobertura suficiente";
}

function construirRecomendacionFinanciera(
  recomendacion: CxpRecomendacionFinanciera
) {
  const codigosSuficientes = esCoberturaSuficiente(
    recomendacion.estado_codigos
  );
  const gruposSuficientes = esCoberturaSuficiente(recomendacion.estado_grupos);
  const montoPendiente = Number(
    recomendacion.monto_pendiente_codigos ??
      recomendacion.saldo_real_cxp ??
      recomendacion.monto_obligacion ??
      0
  );
  const montoCubiertoCodigos = Number(
    recomendacion.monto_cubierto_por_codigos ?? 0
  );
  const montoCubiertoGrupos = Number(
    recomendacion.monto_cubierto_por_grupos ?? 0
  );
  const montoCubierto = Math.min(montoCubiertoCodigos, montoCubiertoGrupos);

  if (montoPendiente <= 0) {
    return "Sin monto pendiente";
  }

  if (codigosSuficientes && gruposSuficientes) {
    return "Pago total";
  }

  if (montoCubierto > 0) {
    return "Pago parcial";
  }

  return "No pagar";
}

function construirMotivoRecomendacion(
  recomendacion: CxpRecomendacionFinanciera
) {
  return [
    recomendacion.analisis_riesgo,
    recomendacion.estado_codigos
      ? `Codigos presupuestarios: ${recomendacion.estado_codigos}.`
      : null,
    recomendacion.estado_grupos
      ? `Grupos financieros: ${recomendacion.estado_grupos}.`
      : null,
  ]
    .filter(Boolean)
    .join(" ");
}

function construirEstadoSinAnalisis(cxp: CXP) {
  if (cxp.estado_operativo === "sin_compromiso") {
    return "Requiere compromiso";
  }

  if (cxp.estado_operativo === "compromiso_parcial") {
    return "Compromiso parcial";
  }

  if (cxp.estado_operativo === "observada") {
    return "Requiere revision";
  }

  if (cxp.estado_operativo === "anulada") {
    return "Anulada";
  }

  return "Sin analisis RPC";
}

export async function obtenerRecomendacionesCXP(): Promise<
  CxpRecomendacionFinanciera[]
> {
  const data = await ejecutarRPC("obtener_recomendaciones_cxp", {});

  return Array.isArray(data) ? (data as CxpRecomendacionFinanciera[]) : [];
}

export async function obtenerCXP(ejercicioFiscal = 2026): Promise<CXP[]> {
  const [cxpsData, recomendacionesData] = await Promise.all([
    ejecutarRPC("obtener_bandeja_cxp_unificada", {
      p_ejercicio_fiscal: ejercicioFiscal,
    }),
    obtenerRecomendacionesCXP(),
  ]);

  const cxps = Array.isArray(cxpsData) ? (cxpsData as CXP[]) : [];

  const recomendacionesMap = new Map<string, CxpRecomendacionFinanciera>();
  const recomendacionesPorNoCxpMap = new Map<
    string,
    CxpRecomendacionFinanciera
  >();

  recomendacionesData.forEach((rec) => {
    recomendacionesMap.set(cxpKey(rec.no_cxp, rec.tipo_cxp), rec);
    const noCxpKey = cxpNoKey(rec.no_cxp);

    if (!recomendacionesPorNoCxpMap.has(noCxpKey)) {
      recomendacionesPorNoCxpMap.set(noCxpKey, rec);
    }
  });

  return cxps.map((cxp) => {
    const recomendacion =
      recomendacionesMap.get(cxpKey(cxp.no_cxp, cxp.tipo_movimiento)) ??
      recomendacionesPorNoCxpMap.get(cxpNoKey(cxp.no_cxp));

    if (!recomendacion) {
      const estadoSinAnalisis = construirEstadoSinAnalisis(cxp);

      return {
        ...cxp,
        recomendacion_financiera: estadoSinAnalisis,
        motivo_recomendacion_financiera:
          "Esta CxP no fue incluida por la RPC obtener_recomendaciones_cxp.",
        codigos_recomendacion_financiera: null,
        monto_recomendacion_base: null,
        monto_comprometido_recomendacion: null,

        recomendacion_pago: estadoSinAnalisis,
        motivo_recomendacion_pago:
          "Esta CxP no fue incluida por la RPC obtener_recomendaciones_cxp.",
        monto_recomendado_pago: null,
        saldo_codigo_minimo: null,
        margen_grupo_minimo: null,
        estado_codigos: estadoSinAnalisis,
        monto_pendiente_codigos: null,
        monto_cubierto_por_codigos: null,
        detalle_codigos: [],
        estado_grupos: estadoSinAnalisis,
        monto_pendiente_grupos: null,
        monto_cubierto_por_grupos: null,
        detalle_grupos: [],
        analisis_riesgo: null,
      };
    }

    const recomendacionFinanciera =
      construirRecomendacionFinanciera(recomendacion);
    const motivoRecomendacion =
      construirMotivoRecomendacion(recomendacion) ||
      "No se registro analisis financiero.";
    const montoBase =
      recomendacion.saldo_real_cxp ??
      recomendacion.monto_pendiente_codigos ??
      recomendacion.monto_obligacion;

    return {
      ...cxp,

      recomendacion_financiera: recomendacionFinanciera,
      motivo_recomendacion_financiera: motivoRecomendacion,
      codigos_recomendacion_financiera:
        recomendacion.codigos_presupuestarios,
      monto_recomendacion_base: montoBase,
      monto_comprometido_recomendacion: recomendacion.monto_comprometido,

      /**
       * Compatibilidad temporal.
       * Esto evita que el componente falle si todavía usa los nombres anteriores.
       */
      recomendacion_pago: recomendacionFinanciera,
      motivo_recomendacion_pago: motivoRecomendacion,
      monto_recomendado_pago: montoBase,
      saldo_codigo_minimo: null,
      margen_grupo_minimo: null,
      estado_codigos: recomendacion.estado_codigos,
      monto_pendiente_codigos: recomendacion.monto_pendiente_codigos,
      monto_cubierto_por_codigos:
        recomendacion.monto_cubierto_por_codigos,
      detalle_codigos: recomendacion.detalle_codigos ?? [],
      estado_grupos: recomendacion.estado_grupos,
      monto_pendiente_grupos: recomendacion.monto_pendiente_grupos,
      monto_cubierto_por_grupos: recomendacion.monto_cubierto_por_grupos,
      detalle_grupos: recomendacion.detalle_grupos ?? [],
      analisis_riesgo: recomendacion.analisis_riesgo,
    };
  });
}

export type AsignarCompromisoCXPInput = {
  no_cxp: number;
  tipo_movimiento: string | null;
  codigo_presupuestario: string;
  monto: number;
  ejercicio_fiscal?: number;
  usuario_registro: string;
  actividad_id?: string;
  proyecto_id?: string;
  fecha_ejecucion?: string;
};

export type AsignarCompromisoCXPResponse = {
  ok: boolean;
  mensaje?: string;
  error?: string;
  no_cxp?: number;
  tipo_movimiento?: string;
  codigo_presupuestario?: string;
  monto_asignado?: number;
  monto_cxp?: number;
  total_comprometido_anterior?: number;
  total_comprometido_nuevo?: number;
  saldo_por_comprometer?: number;
  estado_operativo_resultante?: string;
};

export type CompromisoPresupuestarioCXP = {
  id?: string;
  cxp_id?: number;
  tipo_compromiso?: string | null;
  codigo_presupuestario: string;
  actividad_id: string | null;
  proyecto_id: string | null;
  monto_ejecutado: number;
  fecha_ejecucion?: string | null;
  ejercicio_fiscal?: number | null;
  usuario_registro?: string | null;
};

export async function asignarCompromisoCXP(
  input: AsignarCompromisoCXPInput
): Promise<AsignarCompromisoCXPResponse> {
  const data = await ejecutarRPC("asignar_compromiso_cxp", {
    p_no_cxp: input.no_cxp,
    p_tipo_movimiento: input.tipo_movimiento ?? "",
    p_codigo_presupuestario: input.codigo_presupuestario,
    p_monto: input.monto,
    p_ejercicio_fiscal: input.ejercicio_fiscal ?? 2026,
    p_usuario_registro: input.usuario_registro,
    p_actividad_id: input.actividad_id ?? "",
    p_proyecto_id: input.proyecto_id ?? "",
    p_fecha_ejecucion:
      input.fecha_ejecucion ?? new Date().toISOString().slice(0, 10),
  });

  if (Array.isArray(data)) {
    return data[0] as AsignarCompromisoCXPResponse;
  }

  return data as AsignarCompromisoCXPResponse;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String(data.error)
        : "No se pudo completar la operacion.";

    throw new Error(message);
  }

  return data as T;
}

export async function obtenerCompromisosCXP(input: {
  no_cxp: number;
  tipo_movimiento: string | null;
}) {
  const params = new URLSearchParams({
    noCxp: String(input.no_cxp),
    tipoMovimiento: input.tipo_movimiento ?? "",
  });

  const response = await fetch(
    `/api/compromisos-presupuestarios/asignaciones?${params.toString()}`
  );

  return parseResponse<CompromisoPresupuestarioCXP[]>(response);
}

export async function actualizarCompromisoCXP(input: {
  id: string;
  no_cxp: number;
  tipo_movimiento: string | null;
  compromiso: CompromisoPresupuestarioCXP;
}) {
  const response = await fetch("/api/compromisos-presupuestarios/asignaciones", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return parseResponse<{
    id: string;
    no_cxp: number;
    tipo_movimiento: string;
    data: unknown;
  }>(response);
}

export type PagoMultipleCXPItem = {
  no_cxp: number;
  tipo_movimiento: string | null;
  monto_pago: number;
};

export type ProcesarPagoMultipleCXPInput = {
  cxps: PagoMultipleCXPItem[];
  no_cheque: number;
  usuario_registro: string;
  cuenta?: string;
  fecha_pago: string;
  descripcion_pago: string;
  ejercicio_fiscal?: number;
};

export type ProcesarPagoMultipleCXPResponse = {
  ok: boolean;
  mensaje?: string;
  error?: string;
  no_orden?: number;
  no_cheque?: number;
  total_cxps?: number;
  total_pago?: number;
  total_codigos_presupuestarios?: number;
  monto_ejecutado_presupuestario?: number;
  descripcion?: string;
};

export async function procesarPagoMultipleCXPConCompromiso(
  input: ProcesarPagoMultipleCXPInput
): Promise<ProcesarPagoMultipleCXPResponse> {
  const data = await ejecutarRPC("procesar_pago_multiple_cxp_con_compromiso", {
    p_cxps: input.cxps.map((cxp) => ({
      no_cxp: cxp.no_cxp,
      tipo_movimiento: cxp.tipo_movimiento ?? "",
      monto_pago: cxp.monto_pago,
    })),
    p_no_cheque: input.no_cheque,
    p_usuario_registro: input.usuario_registro,
    p_cuenta: input.cuenta ?? "Bancos",
    p_fecha: input.fecha_pago,
    p_descripcion_pago: input.descripcion_pago,
    p_ejercicio_fiscal: input.ejercicio_fiscal ?? 2026,
  });

  if (Array.isArray(data)) {
    return data[0] as ProcesarPagoMultipleCXPResponse;
  }

  return data as ProcesarPagoMultipleCXPResponse;
}

export type DepurarCxpAccion = "pagada" | "anulada";

export type DepurarCxpEstadoInput = {
  no_cxp: number;
  tipo_movimiento: string | null;
  accion: DepurarCxpAccion;
  fecha: string;
  motivo: string;
  usuario: string;
};

export type DepurarCxpEstadoResponse = {
  ok: boolean;
  mensaje?: string;
  error?: string;
  no_cxp?: number;
  accion?: DepurarCxpAccion;
  fecha?: string;
  estado_actual?: string;
};

export async function depurarCxPEstado(
  input: DepurarCxpEstadoInput
): Promise<DepurarCxpEstadoResponse> {
  const data = await ejecutarRPC("depurar_cxp_estado", {
    p_no_cxp: input.no_cxp,
    p_tipo_movimiento: input.tipo_movimiento ?? "",
    p_accion: input.accion,
    p_fecha: input.fecha,
    p_motivo: input.motivo,
    p_usuario: input.usuario,
  });

  if (Array.isArray(data)) {
    return data[0] as DepurarCxpEstadoResponse;
  }

  return data as DepurarCxpEstadoResponse;
}
