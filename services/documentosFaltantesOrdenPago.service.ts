import { ejecutarRPC } from "@/lib/supabase";

export type EstadoDocumentoOrdenPago = "FALTANTE" | "SUBSANADO";

export type DocumentoFaltanteOrdenPago = {
  id: string;
  noOrden: number;
  nombreDocumento: string;
  observacion: string | null;
  estado: EstadoDocumentoOrdenPago;
  fechaRegistro: string;
  fechaSubsanado: string | null;
  usuarioRegistro?: string | null;
  usuarioSubsana?: string | null;
};

export type ResumenDocumentosOrdenPago = {
  noOrden: number;
  totalDocumentos: number;
  totalFaltantes: number;
  totalSubsanados: number;
};

type DocumentoFaltanteOrdenPagoDB = {
  id: string;
  no_orden: number;
  nombre_documento: string;
  observacion: string | null;
  estado: EstadoDocumentoOrdenPago;
  fecha_registro: string;
  fecha_subsanado: string | null;
  usuario_registro?: string | null;
  usuario_subsana?: string | null;
};

type ResumenDocumentosOrdenPagoDB = {
  no_orden: number;
  total_documentos: number;
  total_faltantes: number;
  total_subsanados: number;
};

function normalizarDocumento(
  item: DocumentoFaltanteOrdenPagoDB
): DocumentoFaltanteOrdenPago {
  return {
    id: item.id,
    noOrden: Number(item.no_orden),
    nombreDocumento: item.nombre_documento ?? "",
    observacion: item.observacion ?? null,
    estado: item.estado,
    fechaRegistro: item.fecha_registro,
    fechaSubsanado: item.fecha_subsanado ?? null,
    usuarioRegistro: item.usuario_registro ?? null,
    usuarioSubsana: item.usuario_subsana ?? null,
  };
}

function normalizarResumen(
  item: ResumenDocumentosOrdenPagoDB
): ResumenDocumentosOrdenPago {
  return {
    noOrden: Number(item.no_orden),
    totalDocumentos: Number(item.total_documentos) || 0,
    totalFaltantes: Number(item.total_faltantes) || 0,
    totalSubsanados: Number(item.total_subsanados) || 0,
  };
}

export async function agregarDocumentoFaltanteOrdenPago(params: {
  noOrden: number;
  nombreDocumento: string;
  observacion?: string | null;
  usuarioRegistro?: string | null;
}): Promise<DocumentoFaltanteOrdenPago | null> {
  const res = await ejecutarRPC("rpc_agregar_documento_faltante_orden_pago", {
    p_no_orden: params.noOrden,
    p_nombre_documento: params.nombreDocumento,
    p_observacion: params.observacion ?? null,
    p_usuario_registro: params.usuarioRegistro ?? null,
  });

  if (!Array.isArray(res) || res.length === 0) {
    console.error("RPC inválida al agregar documento faltante:", res);
    return null;
  }

  return normalizarDocumento(res[0]);
}

export async function listarDocumentosFaltantesOrdenPago(
  noOrden: number
): Promise<DocumentoFaltanteOrdenPago[]> {
  const res = await ejecutarRPC("rpc_listar_documentos_faltantes_orden_pago", {
    p_no_orden: noOrden,
  });

  if (!Array.isArray(res)) {
    console.error("RPC inválida al listar documentos faltantes:", res);
    return [];
  }

  return res.map(normalizarDocumento);
}

export async function subsanarDocumentoFaltanteOrdenPago(params: {
  documentoId: string;
  usuarioSubsana?: string | null;
}): Promise<DocumentoFaltanteOrdenPago | null> {
  const res = await ejecutarRPC("rpc_subsanar_documento_faltante_orden_pago", {
    p_documento_id: params.documentoId,
    p_usuario_subsana: params.usuarioSubsana ?? null,
  });

  if (!Array.isArray(res) || res.length === 0) {
    console.error("RPC inválida al subsanar documento faltante:", res);
    return null;
  }

  return normalizarDocumento(res[0]);
}

export async function obtenerResumenDocumentosFaltantesOrdenPago(): Promise<
  ResumenDocumentosOrdenPago[]
> {
  const res = await ejecutarRPC(
    "rpc_resumen_documentos_faltantes_orden_pago",
    {}
  );

  if (!Array.isArray(res)) {
    console.error("RPC inválida al obtener resumen documental:", res);
    return [];
  }

  return res.map(normalizarResumen);
}

export type DocumentoFaltanteBandeja = {
  documentoId: string;
  noOrden: number;
  nombreDocumento: string;
  observacion: string | null;
  estado: "FALTANTE";
  fechaRegistro: string;
  usuarioRegistro: string | null;
  fechaOrden: string | null;
  descripcionOrden: string | null;
  totalEgreso: number;
};

type DocumentoFaltanteBandejaDB = {
  documento_id: string;
  no_orden: number;
  nombre_documento: string;
  observacion: string | null;
  estado: "FALTANTE";
  fecha_registro: string;
  usuario_registro: string | null;
  fecha_orden: string | null;
  descripcion_orden: string | null;
  total_egreso: number;
};

function normalizarDocumentoBandeja(
  item: DocumentoFaltanteBandejaDB
): DocumentoFaltanteBandeja {
  return {
    documentoId: item.documento_id,
    noOrden: Number(item.no_orden),
    nombreDocumento: item.nombre_documento ?? "",
    observacion: item.observacion ?? null,
    estado: item.estado,
    fechaRegistro: item.fecha_registro,
    usuarioRegistro: item.usuario_registro ?? null,
    fechaOrden: item.fecha_orden ?? null,
    descripcionOrden: item.descripcion_orden ?? null,
    totalEgreso: Number(item.total_egreso) || 0,
  };
}

export async function obtenerBandejaDocumentosFaltantesOrdenesPago(): Promise<
  DocumentoFaltanteBandeja[]
> {
  const res = await ejecutarRPC(
    "rpc_bandeja_documentos_faltantes_ordenes_pago",
    {}
  );

  if (!Array.isArray(res)) {
    console.error("RPC inválida al obtener bandeja documental:", res);
    return [];
  }

  return res.map(normalizarDocumentoBandeja);
}