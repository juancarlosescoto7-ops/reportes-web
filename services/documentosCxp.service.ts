import { crearClienteSupabase } from "@/lib/supabase";
import { crearCodigoCatalogo } from "@/lib/requisitos-documentales-cxp";

export type TipoDocumentoCxp = string;
export type EstadoDocumentoCxp = "PENDIENTE" | "CUMPLIDO";
export type OrigenRequisitoCxp = "GENERAL" | "REGLA" | "IA" | "USUARIO";

export type DocumentoCxpInicial = {
  tipoDocumento: TipoDocumentoCxp;
  nombreDocumento: string;
  cumplido: boolean;
};

export type ClasificacionDocumentalCxp = {
  contextoDocumental: string;
  origenRequisito: OrigenRequisitoCxp;
  confianzaIa: number | null;
  justificacionContexto: string | null;
};

export type DocumentoCxp = {
  noCxp: number;
  tipoMovimiento: string;
  tipoDocumento: TipoDocumentoCxp;
  nombreDocumento: string;
  estado: EstadoDocumentoCxp;
  fechaCumplido: string | null;
};

type DocumentoCxpRow = {
  no_cxp: number | string;
  tipo_movimiento: string | null;
  tipo_documento: TipoDocumentoCxp;
  nombre_documento: string | null;
  estado: EstadoDocumentoCxp;
  fecha_cumplido: string | null;
};

export const DOCUMENTOS_BASE_CXP: DocumentoCxpInicial[] = [
  {
    tipoDocumento: "SOLICITUD",
    nombreDocumento: "Solicitud",
    cumplido: false,
  },
  {
    tipoDocumento: "LIQUIDACION",
    nombreDocumento: "Liquidación",
    cumplido: false,
  },
];

export async function inicializarDocumentosCxp(params: {
  noCxp: number;
  tipoMovimiento: string | null;
  documentos: DocumentoCxpInicial[];
  clasificacion?: ClasificacionDocumentalCxp;
}) {
  const supabase = crearClienteSupabase();
  const tipoMovimiento = normalizarTipoMovimiento(params.tipoMovimiento);
  const documentos = deduplicarDocumentos(
    params.documentos.length > 0 ? params.documentos : DOCUMENTOS_BASE_CXP
  );
  const rows = documentos.map((doc) => ({
    no_cxp: params.noCxp,
    tipo_movimiento: tipoMovimiento,
    tipo_documento: doc.tipoDocumento,
    nombre_documento: doc.nombreDocumento,
    estado: doc.cumplido ? "CUMPLIDO" : "PENDIENTE",
    fecha_cumplido: doc.cumplido ? new Date().toISOString() : null,
    contexto_documental:
      params.clasificacion?.contextoDocumental.trim() || null,
    origen_requisito: params.clasificacion?.origenRequisito ?? "GENERAL",
    confianza_ia: params.clasificacion?.confianzaIa ?? null,
    justificacion_contexto:
      params.clasificacion?.justificacionContexto?.trim() || null,
  }));

  const { error } = await supabase.from("documentos_cxp").upsert(rows, {
    onConflict: "no_cxp,tipo_movimiento,tipo_documento",
  });

  if (error) {
    throw new Error(error.message);
  }
}

export async function listarDocumentosCxp(): Promise<DocumentoCxp[]> {
  const supabase = crearClienteSupabase();

  const { data, error } = await supabase
    .from("documentos_cxp")
    .select(
      "no_cxp,tipo_movimiento,tipo_documento,nombre_documento,estado,fecha_cumplido"
    );

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as DocumentoCxpRow[]).map((row) => ({
    noCxp: Number(row.no_cxp),
    tipoMovimiento: normalizarTipoMovimiento(row.tipo_movimiento),
    tipoDocumento: row.tipo_documento,
    nombreDocumento:
      row.nombre_documento ?? formatearCodigoDocumento(row.tipo_documento),
    estado: row.estado,
    fechaCumplido: row.fecha_cumplido ?? null,
  }));
}

export async function subsanarDocumentoCxp(params: {
  noCxp: number;
  tipoMovimiento: string | null;
  tipoDocumento: TipoDocumentoCxp;
  nombreDocumento?: string;
}) {
  const supabase = crearClienteSupabase();
  const tipoMovimiento = normalizarTipoMovimiento(params.tipoMovimiento);
  const tipoDocumento = crearCodigoCatalogo(params.tipoDocumento);

  if (!tipoDocumento) {
    throw new Error("El tipo de documento es obligatorio.");
  }

  const { error } = await supabase.from("documentos_cxp").upsert(
    {
      no_cxp: params.noCxp,
      tipo_movimiento: tipoMovimiento,
      tipo_documento: tipoDocumento,
      nombre_documento:
        params.nombreDocumento?.trim() ||
        formatearCodigoDocumento(tipoDocumento),
      estado: "CUMPLIDO",
      fecha_cumplido: new Date().toISOString(),
    },
    {
      onConflict: "no_cxp,tipo_movimiento,tipo_documento",
    }
  );

  if (error) {
    throw new Error(error.message);
  }
}

function deduplicarDocumentos(documentos: DocumentoCxpInicial[]) {
  const resultado = new Map<string, DocumentoCxpInicial>();

  documentos.forEach((doc) => {
    const tipoDocumento = crearCodigoCatalogo(doc.tipoDocumento);
    const nombreDocumento = doc.nombreDocumento.trim();

    if (!tipoDocumento || !nombreDocumento) return;

    resultado.set(tipoDocumento, {
      tipoDocumento,
      nombreDocumento,
      cumplido: doc.cumplido === true,
    });
  });

  return Array.from(resultado.values());
}

function formatearCodigoDocumento(value: string) {
  const texto = value.toLowerCase().replace(/_/g, " ").trim();
  return texto ? `${texto[0].toUpperCase()}${texto.slice(1)}` : "Documento";
}

function normalizarTipoMovimiento(value: string | null | undefined) {
  return (value ?? "").trim();
}
