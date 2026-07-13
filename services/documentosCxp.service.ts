import { crearClienteSupabase } from "@/lib/supabase";

export type TipoDocumentoCxp = "SOLICITUD" | "LIQUIDACION";
export type EstadoDocumentoCxp = "PENDIENTE" | "CUMPLIDO";

export type DocumentoCxpInicial = {
  tipoDocumento: TipoDocumentoCxp;
  cumplido: boolean;
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

const NOMBRES_DOCUMENTOS_CXP: Record<TipoDocumentoCxp, string> = {
  SOLICITUD: "Solicitud",
  LIQUIDACION: "Liquidacion de orden de compra",
};

export const DOCUMENTOS_BASE_CXP: DocumentoCxpInicial[] = [
  { tipoDocumento: "SOLICITUD", cumplido: false },
  { tipoDocumento: "LIQUIDACION", cumplido: false },
];

export async function inicializarDocumentosCxp(params: {
  noCxp: number;
  tipoMovimiento: string | null;
  documentos: DocumentoCxpInicial[];
}) {
  const supabase = crearClienteSupabase();
  const tipoMovimiento = normalizarTipoMovimiento(params.tipoMovimiento);
  const documentosPorTipo = new Map<TipoDocumentoCxp, boolean>(
    params.documentos.map((doc) => [doc.tipoDocumento, doc.cumplido])
  );

  const rows = DOCUMENTOS_BASE_CXP.map((doc) => {
    const cumplido = documentosPorTipo.get(doc.tipoDocumento) ?? doc.cumplido;

    return {
      no_cxp: params.noCxp,
      tipo_movimiento: tipoMovimiento,
      tipo_documento: doc.tipoDocumento,
      nombre_documento: NOMBRES_DOCUMENTOS_CXP[doc.tipoDocumento],
      estado: cumplido ? "CUMPLIDO" : "PENDIENTE",
      fecha_cumplido: cumplido ? new Date().toISOString() : null,
    };
  });

  const { error } = await supabase
    .from("documentos_cxp")
    .upsert(rows, {
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
      row.nombre_documento ?? NOMBRES_DOCUMENTOS_CXP[row.tipo_documento],
    estado: row.estado,
    fechaCumplido: row.fecha_cumplido ?? null,
  }));
}

export async function subsanarDocumentoCxp(params: {
  noCxp: number;
  tipoMovimiento: string | null;
  tipoDocumento: TipoDocumentoCxp;
}) {
  const supabase = crearClienteSupabase();
  const tipoMovimiento = normalizarTipoMovimiento(params.tipoMovimiento);

  const { error } = await supabase.from("documentos_cxp").upsert(
    {
      no_cxp: params.noCxp,
      tipo_movimiento: tipoMovimiento,
      tipo_documento: params.tipoDocumento,
      nombre_documento: NOMBRES_DOCUMENTOS_CXP[params.tipoDocumento],
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

function normalizarTipoMovimiento(value: string | null | undefined) {
  return (value ?? "").trim();
}
