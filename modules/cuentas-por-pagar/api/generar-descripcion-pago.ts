import { NextResponse } from "next/server";
import {
  agruparCxpsPorProveedor,
  esPlanillaPago,
} from "@/modules/cuentas-por-pagar/domain/pago-multiple-cxp";

type CxpPagoContexto = {
  no_cxp?: number;
  tipo_movimiento?: string | null;
  fecha?: string | null;
  descripcion?: string | null;
  cuenta?: string | null;
  monto_obligacion?: number | null;
  no_orden_pago?: number | null;
  monto_pago?: number | null;
  monto_pagado_anterior?: number | null;
  beneficiario_id?: string | null;
  beneficiario_nombre?: string | null;
};

type GenerarDescripcionPagoCxpBody = {
  descripcion_pago?: string | null;
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
      const montoPagadoAnterior = Number(cxp.monto_pagado_anterior);
      const tieneMontosValidos =
        cxp.monto_obligacion != null &&
        cxp.monto_pago != null &&
        cxp.monto_pagado_anterior != null &&
        Number.isFinite(montoObligacion) &&
        montoObligacion > 0 &&
        Number.isFinite(montoPago) &&
        montoPago > 0 &&
        Number.isFinite(montoPagadoAnterior) &&
        montoPagadoAnterior >= 0 &&
        montoPagadoAnterior < montoObligacion;
      const saldoPendiente = tieneMontosValidos
        ? Number(Math.max(montoObligacion - montoPagadoAnterior - montoPago, 0).toFixed(2))
        : null;

      return {
        no_cxp: cxp.no_cxp,
        tipo_movimiento: cxp.tipo_movimiento,
        descripcion: cxp.descripcion,
        cuenta: cxp.cuenta,
        cancela_saldo_pendiente:
          saldoPendiente === null ? null : saldoPendiente === 0,
      };
    });

    const prompt = `
Redacta una descripcion breve, precisa y comun para los egresos de las cuentas por pagar seleccionadas. Describe el concepto del gasto; no hagas un analisis financiero ni del estado de las cuentas.

Devuelve SOLO JSON valido con esta forma:
{
  "descripcion": "descripcion breve del egreso"
}

Reglas:
- Redacta en espanol formal, claro y administrativo.
- Debe servir como descripcion contable/administrativa del pago.
- Si descripcion_pago contiene texto, usalo como borrador y contexto adicional para pulir la descripcion. Puede contener una descripcion previa, detalles de la finalidad del gasto o indicaciones de redaccion del usuario.
- Integra los detalles relevantes de descripcion_pago con las descripciones de las CxP y aplica las indicaciones de redaccion sin copiarlas literalmente al resultado. Conserva la intencion del usuario y mejora la claridad y fluidez.
- Respeta la finalidad, el lugar y las precisiones aportadas por el usuario en descripcion_pago. Si aporta una redaccion final clara y concisa, conservala y corrige solo lo necesario. Si esta vacia, usa las descripciones de las CxP.
- Empieza con "Planilla de pago" cuando tipo_pago sea "planilla"; en los demas casos usa "Pago" cuando la frase lo permita.
- No uses la frase "Pago consolidado".
- Cuando tipo_pago sea "planilla", agrupa el concepto comun sin agregar explicaciones como "comprende obligaciones o contratos de varios proveedores". Para personal que realiza una misma labor, usa "Planilla de pago de personal que labora en ...".
- Cuando tipo_pago sea "pago a proveedor", no lo llames planilla solo por incluir varias CxP del mismo proveedor.
- No menciones proveedor, beneficiario ni nombre de tercero.
- Prioriza explicar que bien, suministro, servicio u obligacion se esta pagando y cual es la finalidad concreta de la compra. Extrae esa finalidad de las descripciones de las CxP y expresala de forma clara y natural.
- Omite montos, porcentajes, saldos y estados contables o administrativos. No uses frases como "Pago del 50% del monto", "saldo pendiente", "pago parcial", "pago total" o "cancelacion de la deuda" para narrar el estado de la cuenta.
- cancela_saldo_pendiente tiene en cuenta los pagos anteriores: si es true, este pago liquida el saldo aunque el importe actual sea menor que el valor original del contrato. Este dato es solo una comprobacion interna, no debe narrarse en la descripcion.
- Cuando el usuario o las descripciones indiquen expresamente el numero de pago y el total, usa la referencia breve "Pago (n/total)" al final. Por ejemplo, un segundo y ultimo pago se expresa como "Pago (2/2)". No deduzcas el numero de cuotas ni el numero de pagos anteriores a partir de porcentajes o importes acumulados.
- Si todas las CxP comparten la misma referencia de pago, escribela una sola vez. Si tienen referencias diferentes, distingue los conceptos de forma breve sin asignarles a todas la misma cuota. Si no se conoce la numeracion, omite la referencia; no inventes "(2/2)".
- Omite numeros de CxP, contratos, ordenes de pago y ordenes de compra, salvo que el usuario solicite incluirlos o sean indispensables para distinguir el gasto.
- Omite las fechas de las CxP y la fecha del pago, salvo que el periodo, ejercicio o fecha sea esencial para identificar la obligacion, el servicio o la finalidad del gasto.
- Omite departamentos, unidades solicitantes y dependencias municipales, salvo que sean indispensables para entender la finalidad de la compra o distinguir obligaciones similares.
- No sustituyas la finalidad de la compra por el nombre del departamento solicitante. Por ejemplo, explica para que se adquiere el bien o servicio, no solamente que fue solicitado por determinado departamento.
- No omitas ninguna CxP seleccionada.
- Conserva los conceptos, finalidades y lugares necesarios para identificar el gasto sin detallar cada contrato por separado.
- Integra conceptos repetidos de forma natural en vez de copiar cada descripcion por separado.
- Si varias CxP tienen el mismo objeto de compra o servicio, redacta una sola idea agrupada: objeto comun, finalidad y lugar.
- Si las descripciones incluyen cantidades diferentes del mismo objeto, puedes resumir el objeto en plural sin enumerar cada cantidad, salvo que la cantidad sea esencial para entender el pago.
- Evita repetir frases como "Compra de" para cada CxP cuando pueden consolidarse en una sola descripcion.
- No incluyas estados operativos, recomendaciones financieras, saldos presupuestarios, compromisos o diagnosticos financieros aunque aparezcan en el texto de origen.
- No inventes datos que no esten en el contexto.
- No uses Markdown, listas con viñetas, tablas ni explicaciones externas.
- Entrega una sola descripcion en prosa, preferiblemente una oracion breve para el concepto y, si se conoce, otra con la referencia del pago. Para un concepto comun, procura no superar 40 palabras. No alargues el texto por el numero de CxP.

Ejemplo de estilo:
Entrada descriptiva:
"Compra de 4 pasteles para celebracion del dia de la Madre en la Municipalidad | | Con orden de compra No. 5093"
"Compra de 3 pasteles para celebracion de dia del padre"
Salida esperada:
"Pago de pasteles para celebracion del dia de la Madre y del dia del Padre en la Municipalidad."

Ejemplo de planilla de personal:
Varias CxP por contratos de personal temporal de mantenimiento del centro turistico "El cerrito". El usuario indica que corresponde al segundo y ultimo pago.
Salida esperada exacta:
"Planilla de pago de personal que labora en mantenimiento de centro turístico \"El cerrito\". Pago (2/2)".
Usa este ejemplo solo como estilo; no copies el lugar, la labor ni la referencia de pago en otros casos si no aparecen en los datos o indicaciones del usuario.

Contexto del pago:
${JSON.stringify(
      {
        tipo_pago: esPlanilla ? "planilla" : "pago a proveedor",
        cantidad_proveedores: gruposProveedores.length,
        descripcion_pago:
          typeof body.descripcion_pago === "string"
            ? body.descripcion_pago.trim() || null
            : null,
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
