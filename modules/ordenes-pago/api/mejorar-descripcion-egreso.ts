import { NextResponse } from "next/server";

type MejorarDescripcionBody = {
  descripcion?: string;
};

export async function POST(req: Request) {
  let body: MejorarDescripcionBody | null;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Solicitud inválida." }, { status: 400 });
  }

  const descripcion =
    typeof body?.descripcion === "string" ? body.descripcion.trim() : "";

  if (!descripcion) {
    return NextResponse.json(
      { error: "Escriba primero la descripción que desea mejorar." },
      { status: 400 }
    );
  }

  // NULA tiene un significado operativo al registrar una orden sin efecto contable.
  if (descripcion.toUpperCase() === "NULA") {
    return NextResponse.json({ descripcion: "NULA" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      { error: "No está configurada la llave de OpenAI." },
      { status: 500 }
    );
  }

  try {
    const respuesta = await fetch("https://api.openai.com/v1/chat/completions", {
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
            content: `Eres un editor de descripciones de egresos municipales.
Tu tarea es mejorar el texto escrito por el usuario, no analizar el contexto ni emitir un diagnóstico.
Corrige ortografía, gramática, puntuación, claridad y fluidez en español formal y administrativo.
Usa el texto como borrador principal. Si incluye indicaciones para pulir la redacción, aplícalas sin copiarlas literalmente en la descripción final.
Conserva el sentido, el objeto y la finalidad del gasto, así como los datos y referencias relevantes aportados.
No inventes conceptos, finalidades, cantidades, montos, porcentajes, fechas, nombres ni referencias. No cambies los datos financieros ni supongas que se trata de una planilla o un pago parcial.
Evita repeticiones y frases de relleno. No agregues análisis, recomendaciones, encabezados, listas, Markdown ni explicaciones sobre los cambios.
Devuelve únicamente JSON válido con la forma {"descripcion":"texto mejorado del egreso"}.`,
          },
          { role: "user", content: JSON.stringify({ descripcion }) },
        ],
        temperature: 0.2,
        max_tokens: 8000,
        response_format: { type: "json_object" },
      }),
    });

    if (!respuesta.ok) {
      return NextResponse.json(
        { error: "No se pudo mejorar la descripción con IA. Intente nuevamente." },
        { status: 502 }
      );
    }

    const resultado = await respuesta.json();
    const opcion = resultado.choices?.[0];
    if (opcion?.finish_reason === "length") {
      return NextResponse.json(
        { error: "La respuesta quedó incompleta. Intente con una descripción más corta." },
        { status: 502 }
      );
    }

    const contenido = opcion?.message?.content;
    const mejorada = typeof contenido === "string" ? JSON.parse(contenido) : null;
    if (typeof mejorada?.descripcion !== "string" || !mejorada.descripcion.trim()) {
      return NextResponse.json(
        { error: "La IA no devolvió una descripción válida. Intente nuevamente." },
        { status: 502 }
      );
    }

    return NextResponse.json({ descripcion: mejorada.descripcion.trim() });
  } catch {
    return NextResponse.json(
      { error: "No se pudo mejorar la descripción. Intente nuevamente." },
      { status: 502 }
    );
  }
}
