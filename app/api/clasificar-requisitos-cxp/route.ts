import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  CONTEXTOS_DOCUMENTALES_CXP_INICIALES,
  crearCodigoCatalogo,
  detectarContextosPorReglas,
  esDescripcionCuentaPorPagarNula,
  normalizarContextoDocumentalCxp,
  resolverRequisitosContextos,
  type ContextoDocumentalCxp,
  type ContextoDocumentalCxpRow,
  type RequisitoDocumentoContexto,
} from "@/lib/requisitos-documentales-cxp";
import type { ResultadoAnalisisDocumentalCxp } from "@/services/contextosDocumentalesCxp.service";

export const dynamic = "force-dynamic";

type BodyClasificacion = {
  descripcion?: unknown;
  tipoCxp?: unknown;
};

type SalidaModelo = {
  contextos_codigos: string[];
  confianza: number;
  justificacion: string;
  sugerir_nuevo_contexto: boolean;
  nuevo_contexto: {
    nombre: string;
    descripcion: string;
    palabras_clave: string[];
    requisitos: Array<{ nombre: string; descripcion: string }>;
  };
};

export async function POST(request: NextRequest) {
  try {
    const autenticacion = await crearClienteAutenticado(request);

    if (!autenticacion) {
      return NextResponse.json(
        { error: "No hay una sesión activa." },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as BodyClasificacion;
    const descripcion = String(body.descripcion ?? "").trim();
    const tipoCxp = String(body.tipoCxp ?? "").trim();

    if (descripcion.length < 5) {
      return NextResponse.json(
        {
          error:
            "Escriba una descripción más específica para identificar los requisitos.",
        },
        { status: 400 }
      );
    }

    if (esDescripcionCuentaPorPagarNula(descripcion)) {
      return NextResponse.json({
        contextos: [],
        requisitos: [],
        confianza: 1,
        justificacion:
          "Las cuentas por pagar nulas no requieren clasificación documental.",
        metodo: "REGLA",
        esSugerenciaNueva: false,
        contextoSugerido: null,
        aviso: null,
      } satisfies ResultadoAnalisisDocumentalCxp);
    }

    const contextos = await cargarContextos(autenticacion.supabase);
    const resultadoReglas = crearResultadoPorReglas(descripcion, contextos);

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({
        ...resultadoReglas,
        aviso:
          "No está configurada la llave de OpenAI; se aplicó la coincidencia por reglas.",
      });
    }

    try {
      const salidaModelo = await clasificarConOpenAI({
        descripcion,
        tipoCxp,
        contextos,
      });

      return NextResponse.json(
        crearResultadoIA(salidaModelo, contextos, resultadoReglas)
      );
    } catch (error) {
      console.error("Error OpenAI al clasificar requisitos de CxP:", error);
      return NextResponse.json({
        ...resultadoReglas,
        aviso:
          "La IA no estuvo disponible; se aplicó la coincidencia por reglas del catálogo.",
      });
    }
  } catch (error) {
    console.error("Error al clasificar requisitos de CxP:", error);
    return NextResponse.json(
      { error: "No se pudieron identificar los requisitos documentales." },
      { status: 500 }
    );
  }
}

async function crearClienteAutenticado(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) return null;

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll() {
        // La actualización de cookies de sesión se realiza en proxy.ts.
      },
    },
  });
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  return { supabase, user };
}

async function cargarContextos(
  supabase: Awaited<ReturnType<typeof crearClienteAutenticado>> extends infer T
    ? T extends { supabase: infer S }
      ? S
      : never
    : never
) {
  const { data, error } = await supabase
    .from("contextos_documentales_cxp")
    .select(
      "id,codigo,nombre,descripcion,palabras_clave,ejemplos,requisitos,es_general,activo,prioridad,origen"
    )
    .eq("activo", true)
    .order("prioridad", { ascending: false })
    .limit(100);

  if (error) {
    console.warn(
      "No se pudo leer contextos_documentales_cxp; se usará el catálogo inicial:",
      error.message
    );
    return CONTEXTOS_DOCUMENTALES_CXP_INICIALES;
  }

  const contextos = ((data ?? []) as ContextoDocumentalCxpRow[])
    .map(normalizarContextoDocumentalCxp)
    .filter((item): item is ContextoDocumentalCxp => item !== null);

  if (!contextos.some((contexto) => contexto.esGeneral)) {
    contextos.push(CONTEXTOS_DOCUMENTALES_CXP_INICIALES[0]);
  }

  return contextos;
}

async function clasificarConOpenAI(params: {
  descripcion: string;
  tipoCxp: string;
  contextos: ContextoDocumentalCxp[];
}): Promise<SalidaModelo> {
  const codigos = params.contextos.map((contexto) => contexto.codigo);
  const catalogo = params.contextos.map((contexto) => ({
    codigo: contexto.codigo,
    nombre: contexto.nombre,
    descripcion: contexto.descripcion,
    palabras_clave: contexto.palabrasClave,
    ejemplos: contexto.ejemplos,
    documentos_configurados: contexto.requisitos.map(
      (requisito) => requisito.nombre
    ),
    es_general: contexto.esGeneral,
  }));
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_REQUISITOS_CXP_MODEL ?? "gpt-5.6-luna",
      store: false,
      reasoning: { effort: "low" },
      max_output_tokens: 900,
      input: [
        {
          role: "system",
          content:
            "Clasificas expedientes de cuentas por pagar municipales. Selecciona únicamente códigos del catálogo. Puedes combinar hasta tres contextos específicos cuando todos sean claramente aplicables. Nunca combines GENERAL con un contexto específico. Los documentos configurados son política institucional: no los cambies. Si ningún contexto específico aplica, selecciona GENERAL y sugiere un nuevo contexto reutilizable con documentos administrativos razonables para revisión humana. No presentes una sugerencia como requisito legal confirmado.",
        },
        {
          role: "user",
          content: JSON.stringify({
            cuenta_por_pagar: {
              tipo: params.tipoCxp || null,
              descripcion: params.descripcion,
            },
            catalogo,
          }),
        },
      ],
      text: {
        verbosity: "low",
        format: {
          type: "json_schema",
          name: "clasificacion_requisitos_cxp",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              contextos_codigos: {
                type: "array",
                items: { type: "string", enum: codigos },
              },
              confianza: { type: "number" },
              justificacion: { type: "string" },
              sugerir_nuevo_contexto: { type: "boolean" },
              nuevo_contexto: {
                type: "object",
                additionalProperties: false,
                properties: {
                  nombre: { type: "string" },
                  descripcion: { type: "string" },
                  palabras_clave: {
                    type: "array",
                    items: { type: "string" },
                  },
                  requisitos: {
                    type: "array",
                    items: {
                      type: "object",
                      additionalProperties: false,
                      properties: {
                        nombre: { type: "string" },
                        descripcion: { type: "string" },
                      },
                      required: ["nombre", "descripcion"],
                    },
                  },
                },
                required: [
                  "nombre",
                  "descripcion",
                  "palabras_clave",
                  "requisitos",
                ],
              },
            },
            required: [
              "contextos_codigos",
              "confianza",
              "justificacion",
              "sugerir_nuevo_contexto",
              "nuevo_contexto",
            ],
          },
        },
      },
    }),
  });

  if (!response.ok) {
    const detalle = (await response.text()).slice(0, 1_000);
    throw new Error(`OpenAI respondió ${response.status}: ${detalle}`);
  }

  const raw = (await response.json()) as {
    output?: Array<{
      content?: Array<{ type?: string; text?: string; refusal?: string }>;
    }>;
  };
  const contenido = raw.output
    ?.flatMap((item) => item.content ?? [])
    .find((item) => item.type === "output_text")?.text;

  if (!contenido) {
    throw new Error("La IA no devolvió una clasificación estructurada.");
  }

  return JSON.parse(contenido) as SalidaModelo;
}

function crearResultadoIA(
  salida: SalidaModelo,
  contextos: ContextoDocumentalCxp[],
  fallback: ResultadoAnalisisDocumentalCxp
): ResultadoAnalisisDocumentalCxp {
  const conocidos = new Set(contextos.map((contexto) => contexto.codigo));
  const codigos = Array.isArray(salida.contextos_codigos)
    ? Array.from(
        new Set(salida.contextos_codigos.filter((codigo) => conocidos.has(codigo)))
      ).slice(0, 3)
    : [];
  const resueltos = resolverRequisitosContextos(contextos, codigos);
  const soloGeneral =
    resueltos.contextos.length === 1 && resueltos.contextos[0].esGeneral;
  const sugerido = salida.sugerir_nuevo_contexto
    ? normalizarSugerencia(salida.nuevo_contexto)
    : null;

  if (soloGeneral && sugerido) {
    return {
      contextos: [{ codigo: sugerido.codigo, nombre: sugerido.nombre }],
      requisitos: sugerido.requisitos,
      confianza: limitarConfianza(salida.confianza),
      justificacion: String(salida.justificacion ?? "").trim().slice(0, 500),
      metodo: "IA",
      esSugerenciaNueva: true,
      contextoSugerido: sugerido,
      aviso:
        "La IA propuso un contexto nuevo. Revise los documentos antes de registrar y guárdelo solo si corresponde a la política municipal.",
    };
  }

  if (resueltos.requisitos.length === 0) return fallback;

  return {
    contextos: resueltos.contextos.map((contexto) => ({
      codigo: contexto.codigo,
      nombre: contexto.nombre,
    })),
    requisitos: resueltos.requisitos,
    confianza: limitarConfianza(salida.confianza),
    justificacion: String(salida.justificacion ?? "").trim().slice(0, 500),
    metodo: "IA",
    esSugerenciaNueva: false,
    contextoSugerido: null,
    aviso: null,
  };
}

function crearResultadoPorReglas(
  descripcion: string,
  contextos: ContextoDocumentalCxp[]
): ResultadoAnalisisDocumentalCxp {
  const codigos = detectarContextosPorReglas(descripcion, contextos);
  const resueltos = resolverRequisitosContextos(contextos, codigos);
  const esGeneral = resueltos.contextos.every((contexto) => contexto.esGeneral);

  return {
    contextos: resueltos.contextos.map((contexto) => ({
      codigo: contexto.codigo,
      nombre: contexto.nombre,
    })),
    requisitos: resueltos.requisitos,
    confianza: esGeneral ? 0.35 : 0.7,
    justificacion: esGeneral
      ? "No se encontró una coincidencia específica; se aplicaron los requisitos generales."
      : "Coincidencia obtenida de las palabras clave y ejemplos del catálogo.",
    metodo: "REGLA",
    esSugerenciaNueva: false,
    contextoSugerido: null,
    aviso: null,
  };
}

function normalizarSugerencia(value: SalidaModelo["nuevo_contexto"]) {
  const nombre = String(value?.nombre ?? "").trim().slice(0, 120);
  const descripcion = String(value?.descripcion ?? "").trim().slice(0, 500);
  const requisitos = new Map<string, RequisitoDocumentoContexto>();

  (Array.isArray(value?.requisitos) ? value.requisitos : [])
    .slice(0, 12)
    .forEach((item) => {
    const nombreRequisito = String(item?.nombre ?? "").trim().slice(0, 120);
    const codigo = crearCodigoCatalogo(nombreRequisito);

    if (!nombreRequisito || !codigo) return;

    requisitos.set(codigo, {
      codigo,
      nombre: nombreRequisito,
      descripcion: String(item?.descripcion ?? "").trim().slice(0, 300),
    });
  });

  if (!nombre || !descripcion || requisitos.size === 0) return null;

  return {
    id: null,
    codigo: crearCodigoCatalogo(nombre),
    nombre,
    descripcion,
    palabrasClave: (value.palabras_clave ?? [])
      .map((item) => String(item).trim())
      .filter(Boolean)
      .slice(0, 12),
    ejemplos: [],
    requisitos: Array.from(requisitos.values()),
    esGeneral: false,
    activo: true,
    prioridad: 100,
    origen: "IA_REVISADA" as const,
  };
}

function limitarConfianza(value: unknown) {
  const numero = Number(value);
  if (!Number.isFinite(numero)) return 0;
  return Math.max(0, Math.min(1, numero));
}
