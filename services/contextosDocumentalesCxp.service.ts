import { crearClienteSupabase } from "@/lib/supabase";
import {
  CONTEXTOS_DOCUMENTALES_CXP_INICIALES,
  crearCodigoCatalogo,
  normalizarContextoDocumentalCxp,
  type ContextoDocumentalCxp,
  type ContextoDocumentalCxpRow,
  type OrigenContextoDocumental,
  type RequisitoDocumentoContexto,
} from "@/lib/requisitos-documentales-cxp";

export type MetodoAnalisisDocumental = "IA" | "REGLA";

export type ResultadoAnalisisDocumentalCxp = {
  contextos: Array<{ codigo: string; nombre: string }>;
  requisitos: RequisitoDocumentoContexto[];
  confianza: number;
  justificacion: string;
  metodo: MetodoAnalisisDocumental;
  esSugerenciaNueva: boolean;
  contextoSugerido: ContextoDocumentalCxp | null;
  aviso: string | null;
};

export async function listarContextosDocumentalesCxp(): Promise<
  ContextoDocumentalCxp[]
> {
  const supabase = crearClienteSupabase();
  const { data, error } = await supabase
    .from("contextos_documentales_cxp")
    .select(
      "id,codigo,nombre,descripcion,palabras_clave,ejemplos,requisitos,es_general,activo,prioridad,origen"
    )
    .order("prioridad", { ascending: false })
    .order("nombre", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as ContextoDocumentalCxpRow[])
    .map(normalizarContextoDocumentalCxp)
    .filter((item): item is ContextoDocumentalCxp => item !== null);
}

export async function guardarContextoDocumentalCxp(params: {
  nombre: string;
  descripcion: string;
  palabrasClave: string[];
  ejemplos: string[];
  requisitos: RequisitoDocumentoContexto[];
  origen?: OrigenContextoDocumental;
}) {
  const supabase = crearClienteSupabase();
  const nombre = params.nombre.trim();
  const descripcion = params.descripcion.trim();
  const codigo = crearCodigoCatalogo(nombre);
  const requisitos = deduplicarRequisitos(params.requisitos);

  if (!nombre || !codigo) {
    throw new Error("El nombre del contexto es obligatorio.");
  }

  if (!descripcion) {
    throw new Error("Debe indicar cómo reconocer el contexto.");
  }

  if (requisitos.length === 0) {
    throw new Error("Debe agregar al menos un documento requerido.");
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error(userError?.message ?? "No hay una sesión activa.");
  }

  const { data, error } = await supabase
    .from("contextos_documentales_cxp")
    .upsert(
      {
        codigo,
        nombre,
        descripcion,
        palabras_clave: limpiarLista(params.palabrasClave),
        ejemplos: limpiarLista(params.ejemplos),
        requisitos,
        es_general: false,
        activo: true,
        prioridad: 100,
        origen: params.origen ?? "USUARIO",
        fecha_actualizacion: new Date().toISOString(),
        usuario_registro: user.id,
      },
      { onConflict: "codigo" }
    )
    .select(
      "id,codigo,nombre,descripcion,palabras_clave,ejemplos,requisitos,es_general,activo,prioridad,origen"
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const contexto = normalizarContextoDocumentalCxp(
    data as ContextoDocumentalCxpRow
  );

  if (!contexto) {
    throw new Error("Supabase devolvió un contexto incompleto.");
  }

  return contexto;
}

export async function analizarRequisitosDocumentalesCxp(params: {
  descripcion: string;
  tipoCxp: string;
}): Promise<ResultadoAnalisisDocumentalCxp> {
  const response = await fetch("/api/clasificar-requisitos-cxp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      descripcion: params.descripcion.trim(),
      tipoCxp: params.tipoCxp.trim(),
    }),
  });
  const payload = (await response.json().catch(() => null)) as
    | (ResultadoAnalisisDocumentalCxp & { error?: string })
    | null;

  if (!response.ok || !payload) {
    throw new Error(
      payload?.error ?? "No se pudieron identificar los requisitos documentales."
    );
  }

  return payload;
}

export function obtenerAnalisisGeneralInicial(): ResultadoAnalisisDocumentalCxp {
  const general = CONTEXTOS_DOCUMENTALES_CXP_INICIALES[0];

  return {
    contextos: [{ codigo: general.codigo, nombre: general.nombre }],
    requisitos: general.requisitos,
    confianza: 1,
    justificacion:
      "Requisitos generales mientras se identifica el contexto de la cuenta por pagar.",
    metodo: "REGLA",
    esSugerenciaNueva: false,
    contextoSugerido: null,
    aviso: null,
  };
}

function limpiarLista(items: string[]) {
  return Array.from(
    new Set(items.map((item) => item.trim()).filter(Boolean))
  ).slice(0, 50);
}

function deduplicarRequisitos(items: RequisitoDocumentoContexto[]) {
  const requisitos = new Map<string, RequisitoDocumentoContexto>();

  items.forEach((item) => {
    const nombre = item.nombre.trim();
    const codigo = crearCodigoCatalogo(item.codigo || nombre);

    if (!codigo || !nombre) return;

    requisitos.set(codigo, {
      codigo,
      nombre,
      descripcion: item.descripcion.trim(),
    });
  });

  return Array.from(requisitos.values());
}
