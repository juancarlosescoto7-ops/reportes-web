import { NextResponse } from "next/server";

type CxpPagoContexto = {
  no_cxp?: number;
  tipo_movimiento?: string | null;
  fecha?: string | null;
  descripcion?: string | null;
  cuenta?: string | null;
  monto_obligacion?: number | null;
  no_orden_pago?: number | null;
  monto_pago?: number | null;
};

type GenerarDescripcionPagoCxpBody = {
  cuenta_pago?: string | null;
  fecha_pago?: string | null;
  total_pago?: number | null;
  cxps?: CxpPagoContexto[];
};

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GenerarDescripcionPagoCxpBody;
    const cxps = Array.isArray(body.cxps) ? body.cxps : [];

    if (cxps.length === 0) {
      return NextResponse.json(
        { error: "Debe enviar al menos una CxP para generar la descripcion." },
        { status: 400 }
      );
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: "No esta configurada la llave de OpenAI." },
        { status: 500 }
      );
    }

    const prompt = `
Redacta una descripcion general para el egreso consolidado de las cuentas por pagar seleccionadas.

Devuelve SOLO JSON valido con esta forma:
{
  "descripcion": "descripcion completa del egreso"
}

Reglas:
- Redacta en espanol formal, claro y administrativo.
- Debe servir como descripcion contable/administrativa del pago.
- Empieza la descripcion con "Pago" cuando la frase lo permita.
- No uses la frase "Pago consolidado".
- No menciones proveedor, beneficiario ni nombre de tercero.
- Enfocate en el contexto descriptivo de las cuentas por pagar: concepto, objeto, finalidad, referencias de CxP u orden de pago y montos del pago.
- No omitas ninguna CxP seleccionada.
- No cortes ni trunques datos relevantes como numeros de CxP, ordenes de pago, beneficiario, conceptos, montos, cuenta o fechas.
- Integra conceptos repetidos de forma natural en vez de copiar cada descripcion por separado.
- Si varias CxP tienen el mismo objeto de compra o servicio, redacta una sola idea agrupada: objeto comun, finalidades o eventos relacionados y referencias de ordenes al final.
- Si las descripciones incluyen cantidades diferentes del mismo objeto, puedes resumir el objeto en plural sin enumerar cada cantidad, salvo que la cantidad sea esencial para entender el pago.
- Si las descripciones mencionan ordenes de compra dentro del texto, conserva esas referencias y agrupalas al final como "con ordenes de compra No. ...".
- Evita repetir frases como "Compra de" para cada CxP cuando pueden consolidarse en una sola descripcion.
- No des protagonismo a estados operativos, recomendaciones financieras, saldos presupuestarios, compromisos o diagnosticos financieros aunque aparezcan indirectamente.
- No inventes datos que no esten en el contexto.
- No uses Markdown, listas con viñetas, tablas ni explicaciones externas.
- Entrega una sola descripcion en prosa. Puede ser extensa si hay muchas CxP, pero debe mantenerse util para un asiento de egreso.

Ejemplo de estilo:
Entrada descriptiva:
"Compra de 4 pasteles para celebracion del dia de la Madre en la Municipalidad | | Con orden de compra No. 5093"
"Compra de 3 pasteles para celebracion de dia del padre"
Salida esperada:
"Compra de pasteles para celebracion del dia de la Madre y del dia del Padre en la Municipalidad, con orden de compra No. 5093."

Contexto del pago:
${JSON.stringify(
  {
    cuenta_pago: body.cuenta_pago ?? null,
    fecha_pago: body.fecha_pago ?? null,
    total_pago: body.total_pago ?? null,
    cxps,
  },
  null,
  2
)}
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
              "Eres un redactor experto en descripciones contables y administrativas municipales.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.2,
        max_tokens: 8000,
        response_format: { type: "json_object" },
      }),
    });

    if (!openaiRes.ok) {
      const errorText = await openaiRes.text();
      console.error("Error OpenAI generar descripcion pago CxP:", errorText);
      return NextResponse.json(
        { error: "No se pudo generar la descripcion con IA." },
        { status: 500 }
      );
    }

    const raw = await openaiRes.json();
    const choice = raw.choices?.[0];
    const rawContent = choice?.message?.content;

    if (choice?.finish_reason === "length") {
      return NextResponse.json(
        {
          error:
            "La IA corto la descripcion por limite de respuesta. Intente con menos CxP seleccionadas.",
        },
        { status: 500 }
      );
    }

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
      const parsed = JSON.parse(cleanContent) as { descripcion?: string };

      if (!parsed.descripcion?.trim()) {
        return NextResponse.json(
          { error: "La IA devolvio una estructura incompleta." },
          { status: 500 }
        );
      }

      return NextResponse.json({ descripcion: parsed.descripcion.trim() });
    } catch {
      return NextResponse.json({ descripcion: cleanContent });
    }
  } catch (error) {
    console.error("Error generar descripcion pago CxP:", error);
    return NextResponse.json(
      { error: "Error interno al generar la descripcion." },
      { status: 500 }
    );
  }
}
