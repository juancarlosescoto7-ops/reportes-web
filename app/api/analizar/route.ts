import { NextResponse } from "next/server";
import { ResultadoIA } from "@/services/analisisIA";

export async function POST(req: Request) {
  try {
    const { data } = await req.json();

    const prompt = `
Eres un analista financiero institucional.

Analiza los siguientes datos de ejecución presupuestaria:

${JSON.stringify(data)}

REGLAS OBLIGATORIAS:
- Responde SOLO en JSON válido
- Máximo 5 hallazgos con acciones a realizar. 
    Ejemplos: 
      - Si en un hallazgo detectas una baja ejecución presupuestaria real pero con el compromiso detectas que se puede realizar una buena ejecución, entonces recomiendas que se paguen las deudas pendientes.  
      - Si en un hallazgo detectas una alta ejecución presupuestaria real pero con el compromiso detectas que se puede realizar una mala ejecución que sobrepase el techo, entonces recomiendas NO calcelar aún esas deudas pendientes. 
- Hallazgos deben ser específicos y accionables
- No agregues texto fuera del JSON

FORMATO EXACTO:

{
  "resumen": "máximo 3 líneas claras",
  "nivel_riesgo": "alto | medio | bajo",
  "hallazgos": [
    "hallazgo 1",
    "hallazgo 2",
    "hallazgo 3"
  ],
  "recomendacion": "acción concreta inmediata"
}
`;

    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [
          { role: "system", content: "Eres un experto en finanzas públicas." },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
      }),
    });

    const raw = await openaiRes.json();

    // 🔍 extracción segura
    const rawContent = raw.choices?.[0]?.message?.content;

    if (!rawContent) {
      return NextResponse.json(
        { error: "Sin contenido IA" },
        { status: 500 }
      );
    }

    // 🧹 limpieza markdown
    const cleanContent = rawContent
      .replace(/```json/g, "")
      .replace(/```/g, "")
      .trim();

    let parsed: ResultadoIA;

    try {
      parsed = JSON.parse(cleanContent);
    } catch (e) {
      return NextResponse.json(
        {
          error: "JSON inválido",
          content: cleanContent,
        },
        { status: 500 }
      );
    }

    // 🔐 validación estructural mínima
    if (
      !parsed.resumen ||
      !parsed.nivel_riesgo ||
      !parsed.recomendacion ||
      !Array.isArray(parsed.hallazgos)
    ) {
      return NextResponse.json(
        {
          error: "Estructura incompleta",
          parsed,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);

  } catch (error) {
    console.error("Error IA:", error);
    return NextResponse.json(
      { error: "Error interno IA" },
      { status: 500 }
    );
  }
}