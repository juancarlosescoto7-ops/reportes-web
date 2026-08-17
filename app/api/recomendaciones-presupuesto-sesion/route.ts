import { NextResponse, type NextRequest } from "next/server";
import {
  CLAVE_SIN_RECOMENDACION_PRESUPUESTO,
  INSTRUCCIONES_RECOMENDACIONES_PRESUPUESTO,
  construirCandidatosPresupuestoPorCxp,
  construirSchemaRecomendacionesPresupuesto,
  convertirRespuestaModeloARecomendaciones,
  describirRutaPresupuestaria,
  type AntecedenteCompromisoSesion,
  type CandidatosPresupuestoPorCxp,
  type CxpParaRecomendacionSesion,
  type OpcionPresupuestoSesion,
} from "@/lib/recomendaciones-presupuesto-sesion";
import {
  getSupabaseSessionContext,
  jsonWithCookies,
} from "@/app/api/presupuesto/_utils";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_CUENTAS = 30;
const MAX_OPCIONES = 900;
const MAX_ANTECEDENTES = 500;
const MAX_BODY_BYTES = 2_500_000;

type Body = {
  cuentas?: CxpParaRecomendacionSesion[];
  opciones?: OpcionPresupuestoSesion[];
  antecedentes?: AntecedenteCompromisoSesion[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function limitarTexto(value: unknown, maxLength = 500) {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();
  return text ? text.slice(0, maxLength) : null;
}

function extraerOutputText(value: unknown) {
  if (!isRecord(value)) return "";

  if (typeof value.output_text === "string") {
    return value.output_text;
  }

  if (!Array.isArray(value.output)) return "";

  return value.output
    .flatMap((item) => {
      if (!isRecord(item) || !Array.isArray(item.content)) return [];

      return item.content.flatMap((content) => {
        if (!isRecord(content)) return [];
        return typeof content.text === "string" ? [content.text] : [];
      });
    })
    .join("");
}

function validarBody(body: Body) {
  const cuentas = Array.isArray(body.cuentas) ? body.cuentas : [];
  const opciones = Array.isArray(body.opciones) ? body.opciones : [];
  const antecedentes = Array.isArray(body.antecedentes)
    ? body.antecedentes
    : [];

  if (cuentas.length === 0 || cuentas.length > MAX_CUENTAS) {
    return `Debe enviar entre 1 y ${MAX_CUENTAS} cuentas por pagar.`;
  }

  if (opciones.length === 0 || opciones.length > MAX_OPCIONES) {
    return `Debe enviar entre 1 y ${MAX_OPCIONES} opciones presupuestarias.`;
  }

  if (antecedentes.length > MAX_ANTECEDENTES) {
    return `Puede enviar hasta ${MAX_ANTECEDENTES} antecedentes.`;
  }

  const clavesCxp = new Set<string>();
  for (const cuenta of cuentas) {
    if (
      !isRecord(cuenta) ||
      typeof cuenta.claveCxp !== "string" ||
      !cuenta.claveCxp.trim() ||
      cuenta.claveCxp.length > 120 ||
      typeof cuenta.noCxp !== "number" ||
      !Number.isFinite(cuenta.noCxp) ||
      typeof cuenta.montoHaber !== "number" ||
      !Number.isFinite(cuenta.montoHaber) ||
      cuenta.montoHaber <= 0 ||
      typeof cuenta.montoPendiente !== "number" ||
      !Number.isFinite(cuenta.montoPendiente) ||
      cuenta.montoPendiente < 0 ||
      clavesCxp.has(cuenta.claveCxp)
    ) {
      return "Hay una cuenta por pagar invalida o duplicada.";
    }

    clavesCxp.add(cuenta.claveCxp);
  }

  const clavesPresupuesto = new Set<string>();
  for (const opcion of opciones) {
    if (
      !isRecord(opcion) ||
      typeof opcion.clave !== "string" ||
      !opcion.clave.trim() ||
      opcion.clave.length > 120 ||
      opcion.clave === CLAVE_SIN_RECOMENDACION_PRESUPUESTO ||
      typeof opcion.codigoPresupuestario !== "string" ||
      !opcion.codigoPresupuestario.trim() ||
      opcion.codigoPresupuestario.length > 200 ||
      clavesPresupuesto.has(opcion.clave)
    ) {
      return "Hay una opcion presupuestaria invalida o duplicada.";
    }

    clavesPresupuesto.add(opcion.clave);
  }

  for (const antecedente of antecedentes) {
    if (
      !isRecord(antecedente) ||
      typeof antecedente.codigoPresupuestario !== "string" ||
      !antecedente.codigoPresupuestario.trim() ||
      antecedente.codigoPresupuestario.length > 200 ||
      (antecedente.descripcion !== null &&
        antecedente.descripcion !== undefined &&
        typeof antecedente.descripcion !== "string") ||
      (antecedente.beneficiario !== null &&
        antecedente.beneficiario !== undefined &&
        typeof antecedente.beneficiario !== "string")
    ) {
      return "Hay un antecedente de compromiso invalido.";
    }
  }

  return null;
}

function construirEntradaModelo(input: {
  cuentas: CxpParaRecomendacionSesion[];
  candidatosPorCxp: CandidatosPresupuestoPorCxp;
}) {
  return {
    cuentas_por_pagar: input.cuentas.map((cuenta) => ({
      clave_cxp: limitarTexto(cuenta.claveCxp, 120),
      numero: cuenta.noCxp,
      tipo_movimiento: limitarTexto(cuenta.tipoMovimiento, 120),
      fecha: limitarTexto(cuenta.fecha, 40),
      descripcion: limitarTexto(cuenta.descripcion),
      beneficiario: limitarTexto(cuenta.beneficiario, 250),
      cuenta_contable: limitarTexto(cuenta.cuenta, 120),
      monto_haber: cuenta.montoHaber,
      saldo_pendiente_cxp: cuenta.montoPendiente,
    })),
    candidatos_por_cxp: input.cuentas.map((cuenta) => ({
      clave_cxp: cuenta.claveCxp,
      candidatos: (input.candidatosPorCxp.get(cuenta.claveCxp) ?? []).map(
        (candidato) => {
          const opcion = candidato.opcion;

          return {
            clave_presupuesto: limitarTexto(opcion.clave, 120),
            codigo: limitarTexto(opcion.codigoPresupuestario, 200),
            ruta_presupuestaria: limitarTexto(
              describirRutaPresupuestaria(opcion),
              1800
            ),
            objeto: limitarTexto(opcion.objeto, 120),
            descripcion_objeto: limitarTexto(opcion.descripcionObjeto),
            contexto_ia: limitarTexto(opcion.contextoCxp, 2000),
            fuente: limitarTexto(opcion.fuente, 200),
            tipo_inversion: limitarTexto(opcion.tipoInversion, 200),
            saldo_disponible: opcion.saldoDisponible,
            saldo_grupo_disponible: opcion.saldoGrupoDisponible,
            ejercicio_fiscal: opcion.ejercicioFiscal,
            evidencia_preseleccion: candidato.evidencia,
            antecedentes_confirmados_relevantes:
              candidato.ejemplosAntecedentes.map((antecedente) => ({
                descripcion: limitarTexto(antecedente.descripcion),
                beneficiario: limitarTexto(antecedente.beneficiario, 250),
                codigo: limitarTexto(
                  antecedente.codigoPresupuestario,
                  200
                ),
              })),
          };
        }
      ),
    })),
  };
}

export async function POST(request: NextRequest) {
  const session = await getSupabaseSessionContext(request);
  if (!session.ok) return session.response;

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) {
    return jsonWithCookies(
      session.context,
      { error: "La solicitud excede el tamano permitido." },
      { status: 413 }
    );
  }

  if (!process.env.OPENAI_API_KEY) {
    return jsonWithCookies(
      session.context,
      { error: "Falta configurar OPENAI_API_KEY." },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) {
    return jsonWithCookies(
      session.context,
      { error: "El cuerpo de la solicitud no es JSON valido." },
      { status: 400 }
    );
  }

  if (new TextEncoder().encode(JSON.stringify(body)).byteLength > MAX_BODY_BYTES) {
    return jsonWithCookies(
      session.context,
      { error: "La solicitud excede el tamano permitido." },
      { status: 413 }
    );
  }

  const bodyError = validarBody(body);
  if (bodyError) {
    return jsonWithCookies(
      session.context,
      { error: bodyError },
      { status: 400 }
    );
  }

  const cuentas = body.cuentas as CxpParaRecomendacionSesion[];
  const opciones = body.opciones as OpcionPresupuestoSesion[];
  const antecedentes = (body.antecedentes ?? []).slice(0, MAX_ANTECEDENTES);
  const model =
    process.env.OPENAI_RECOMENDACIONES_PRESUPUESTO_MODEL ?? "gpt-5.6-luna";
  const candidatosPorCxp = construirCandidatosPresupuestoPorCxp({
    cuentas,
    opciones,
    antecedentes,
  });

  try {
    const openaiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        store: false,
        reasoning: { effort: "medium" },
        instructions: INSTRUCCIONES_RECOMENDACIONES_PRESUPUESTO,
        input: JSON.stringify(
          construirEntradaModelo({ cuentas, candidatosPorCxp })
        ),
        text: {
          verbosity: "low",
          format: {
            type: "json_schema",
            name: "recomendaciones_presupuestarias_sesion",
            strict: true,
            schema: construirSchemaRecomendacionesPresupuesto(
              cuentas,
              opciones,
              antecedentes,
              candidatosPorCxp
            ),
          },
        },
      }),
    });

    const openaiData = (await openaiResponse.json().catch(() => null)) as unknown;

    if (!openaiResponse.ok) {
      const openaiError =
        isRecord(openaiData) && isRecord(openaiData.error)
          ? openaiData.error
          : null;
      const message =
        openaiError
          ? String(openaiError.message ?? "Error consultando la IA.")
          : "Error consultando la IA.";
      const errorCode =
        openaiError && typeof openaiError.code === "string"
          ? openaiError.code
          : null;
      const errorType =
        openaiError && typeof openaiError.type === "string"
          ? openaiError.type
          : null;
      const retryable =
        openaiResponse.status === 429 &&
        errorCode !== "insufficient_quota" &&
        errorType !== "insufficient_quota";
      const retryAfter = openaiResponse.headers.get("Retry-After");

      return jsonWithCookies(
        session.context,
        { error: message, retryable },
        {
          status: openaiResponse.status,
          headers: retryAfter ? { "Retry-After": retryAfter } : undefined,
        }
      );
    }

    const outputText = extraerOutputText(openaiData);
    if (!outputText) {
      throw new Error("La IA no devolvio contenido estructurado.");
    }

    const seleccion = JSON.parse(outputText) as unknown;
    const recomendaciones = convertirRespuestaModeloARecomendaciones(
      seleccion,
      cuentas,
      opciones,
      antecedentes,
      candidatosPorCxp
    );

    return jsonWithCookies(session.context, {
      recomendaciones,
      clavesProcesadas: cuentas.map((cuenta) => cuenta.claveCxp),
    });
  } catch (error) {
    console.error("Error generando recomendaciones presupuestarias:", error);

    return jsonWithCookies(
      session.context,
      {
        error:
          error instanceof Error
            ? error.message
            : "Error inesperado generando recomendaciones.",
      },
      { status: 500 }
    );
  }
}

export function GET() {
  return NextResponse.json({ error: "Metodo no permitido." }, { status: 405 });
}
