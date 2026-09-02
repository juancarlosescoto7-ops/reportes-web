import { NextResponse } from "next/server";
import {
  agruparCxpsPorProveedor,
  esPlanillaPago,
} from "@/lib/pago-multiple-cxp";

type CxpPagoContexto = {
  no_cxp?: number;
  tipo_movimiento?: string | null;
  fecha?: string | null;
  descripcion?: string | null;
  cuenta?: string | null;
  monto_obligacion?: number | null;
  no_orden_pago?: number | null;
  monto_pago?: number | null;
  beneficiario_id?: string | null;
  beneficiario_nombre?: string | null;
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

    const gruposProveedores = agruparCxpsPorProveedor(cxps);
    const esPlanilla = esPlanillaPago(cxps);
    const cxpsParaModelo = cxps.map((cxp) => {
      const montoObligacion = Number(cxp.monto_obligacion);
      const montoPago = Number(cxp.monto_pago);
      const tieneMontosValidos =
        Number.isFinite(montoObligacion) &&
        montoObligacion > 0 &&
        Number.isFinite(montoPago) &&
        montoPago >= 0;
      const porcentajePago = tieneMontosValidos
        ? Number(((montoPago / montoObligacion) * 100).toFixed(2))
        : null;
      const saldoPendiente = tieneMontosValidos
        ? Number(Math.max(montoObligacion - montoPago, 0).toFixed(2))
        : null;

      return {
        no_cxp: cxp.no_cxp,
        tipo_movimiento: cxp.tipo_movimiento,
        descripcion: cxp.descripcion,
        cuenta: cxp.cuenta,
        monto_obligacion: cxp.monto_obligacion,
        no_orden_pago: cxp.no_orden_pago,
        monto_pago: cxp.monto_pago,
        porcentaje_pagado: porcentajePago,
        saldo_pendiente_estimado: saldoPendiente,
        modalidad_pago:
          porcentajePago === null
            ? "no determinada"
            : porcentajePago >= 99.995
              ? "pago total"
              : "pago parcial o cuota",
      };
    });

    const prompt = `
Redacta una descripcion general comun para los egresos de las cuentas por pagar seleccionadas que pertenecen a una misma orden de pago.

Devuelve SOLO JSON valido con esta forma:
{
  "descripcion": "descripcion completa del egreso"
}

Reglas:
- Redacta en espanol formal, claro y administrativo.
- Debe servir como descripcion contable/administrativa del pago.
- Empieza la descripcion con "Pago" cuando la frase lo permita.
- No uses la frase "Pago consolidado".
- Cuando tipo_pago sea "planilla", identifica expresamente el egreso como una planilla de pago que comprende obligaciones o contratos de varios proveedores.
- Cuando tipo_pago sea "pago a proveedor", no lo llames planilla solo por incluir varias CxP del mismo proveedor.
- No menciones proveedor, beneficiario ni nombre de tercero.
- Prioriza explicar que bien, suministro, servicio u obligacion se esta pagando y cual es la finalidad concreta de la compra. Extrae esa finalidad de las descripciones de las CxP y expresala de forma clara y natural.
- Da prioridad a los datos financieros que explican cuanto y como se paga: monto de la obligacion, monto pagado, porcentaje pagado, saldo pendiente estimado y si corresponde a un pago total o a un pago parcial/cuota.
- Cuando el pago sea parcial, indica el monto pagado y el porcentaje que representa respecto de la obligacion. Puedes describirlo como "pago parcial" o "cuota"; usa "cuota" preferentemente cuando el contexto indique pagos fraccionados o periodicos.
- Cuando el pago cubra la totalidad de la obligacion, indicalo como pago total y evita presentar porcentajes innecesarios como 100% salvo que ayuden a distinguir varias CxP.
- Si hay varias CxP, explica de forma compacta la cobertura de cada una cuando sus porcentajes o modalidades de pago sean diferentes. No confundas el porcentaje individual de una CxP con el porcentaje global del pago.
- Menciona numeros de CxP, ordenes de pago u ordenes de compra solo cuando ayuden a identificar claramente lo pagado. No conviertas la descripcion en una enumeracion de referencias administrativas.
- Omite las fechas de las CxP y la fecha del pago, salvo que el periodo, ejercicio o fecha sea esencial para identificar la obligacion, el servicio o la finalidad del gasto.
- Omite departamentos, unidades solicitantes y dependencias municipales, salvo que sean indispensables para entender la finalidad de la compra o distinguir obligaciones similares.
- No sustituyas la finalidad de la compra por el nombre del departamento solicitante. Por ejemplo, explica para que se adquiere el bien o servicio, no solamente que fue solicitado por determinado departamento.
- No omitas ninguna CxP seleccionada.
- No cortes ni trunques conceptos, finalidades, montos, porcentajes ni referencias que sean necesarias para identificar el pago.
- Integra conceptos repetidos de forma natural en vez de copiar cada descripcion por separado.
- Si varias CxP tienen el mismo objeto de compra o servicio, redacta una sola idea agrupada: objeto comun, finalidades o eventos relacionados y referencias de ordenes al final.
- Si las descripciones incluyen cantidades diferentes del mismo objeto, puedes resumir el objeto en plural sin enumerar cada cantidad, salvo que la cantidad sea esencial para entender el pago.
- Si las descripciones mencionan ordenes de compra dentro del texto, conserva esas referencias y agrupalas al final como "con ordenes de compra No. ...".
- Evita repetir frases como "Compra de" para cada CxP cuando pueden consolidarse en una sola descripcion.
- No des protagonismo a estados operativos, recomendaciones financieras, saldos presupuestarios, compromisos o diagnosticos financieros aunque aparezcan indirectamente. El saldo pendiente estimado de la obligacion si puede mencionarse cuando ayude a explicar el pago parcial.
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
        tipo_pago: esPlanilla ? "planilla" : "pago a proveedor",
        cantidad_proveedores: gruposProveedores.length,
        cuenta_pago: body.cuenta_pago ?? null,
        fecha_pago: body.fecha_pago ?? null,
        total_pago: body.total_pago ?? null,
        cxps: cxpsParaModelo,
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
