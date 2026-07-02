import { NextResponse } from "next/server";

type GenerarDocumentoFaltanteBody = {
  documento: {
    nombreDocumento?: string;
    observacion?: string | null;
    noOrden?: number | string;
    ordenLabel?: string | null;
    descripcionOrden?: string | null;
    fechaOrden?: string | null;
    totalEgreso?: number | null;
  };
  respuestas: {
    fechaDocumento?: string;
    dirigidoA?: string;
    firmadoPor?: string;
    informacionAdicional?: string;
  };
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GenerarDocumentoFaltanteBody;

    if (!body?.documento?.nombreDocumento || !body?.documento?.noOrden) {
      return NextResponse.json(
        { error: "Datos insuficientes para generar el documento." },
        { status: 400 }
      );
    }

    const prompt = `
Redacta el documento pendiente indicado en "nombreDocumento", basado en la informacion disponible de la orden de pago.

Devuelve SOLO JSON valido con esta forma:
{
  "texto": "contenido completo editable del documento"
}

Reglas:
- Redacta en espanol formal, claro y administrativo.
- El objetivo es generar el documento pendiente en si mismo, no explicar, resumir ni justificar por que falta.
- No debes enfocarte en el contexto de un tipo de documento en particular; adapta la estructura al nombre del documento pendiente.
- Usa "nombreDocumento" como guia principal para decidir la forma del documento.
- No uses frases, formatos ni estructuras predeterminadas que no correspondan al nombreDocumento.
- Si nombreDocumento dice "Contrato", genera un contrato. Si dice "Constancia", genera una constancia. Si dice "Perfil", genera un perfil. Si dice "Acta", genera un acta. Si dice "Solicitud", genera una solicitud. Aplica esta logica a cualquier otro nombreDocumento.
- No conviertas todos los documentos en constancias, solicitudes u oficios. El tipo documental debe ser exactamente el que se solicita.
- Usa la informacion de la orden de pago como base factual: concepto, cantidad, objeto, finalidad, proveedor, referencias y cualquier dato util.
- No copies la descripcion de la orden de pago de forma literal si puede redactarse de forma mas natural.
- No inventes nombres, cargos, fechas, numeros o datos que no esten en el contexto.
- Si falta un dato importante, usa una marca editable entre corchetes, por ejemplo [Departamento], [Nombre], [Cargo] o [Finalidad].
- Usa la informacion adicional del usuario para completar o precisar el documento.
- El texto debe caber razonablemente en papel carta.
- No incluyas membrete, HTML, Markdown, tablas ni firmas graficas.
- Incluye fecha, destinatario, cuerpo, cierre y linea de firma solo cuando corresponda al documento pendiente.

Contexto del documento faltante:
${JSON.stringify(body.documento, null, 2)}

Respuestas del usuario:
${JSON.stringify(body.respuestas, null, 2)}
`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "system",
            content:
              "Eres un redactor experto en documentos administrativos municipales.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.25,
      }),
    });

    if (!openaiRes.ok) {
      const errorText = await openaiRes.text();
      console.error("Error OpenAI generar documento:", errorText);
      return NextResponse.json(
        { error: "No se pudo generar el documento con IA." },
        { status: 500 }
      );
    }

    const raw = await openaiRes.json();
    const rawContent = raw.choices?.[0]?.message?.content;

    if (!rawContent) {
      return NextResponse.json(
        { error: "La IA no devolvio contenido." },
        { status: 500 }
      );
    }

    const cleanContent = rawContent
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    try {
      const parsed = JSON.parse(cleanContent) as { texto?: string };

      if (!parsed.texto?.trim()) {
        return NextResponse.json(
          { error: "La IA devolvio una estructura incompleta." },
          { status: 500 }
        );
      }

      return NextResponse.json({ texto: parsed.texto.trim() });
    } catch {
      return NextResponse.json({ texto: cleanContent });
    }
  } catch (error) {
    console.error("Error generar documento faltante:", error);
    return NextResponse.json(
      { error: "Error interno al generar documento." },
      { status: 500 }
    );
  }
}
