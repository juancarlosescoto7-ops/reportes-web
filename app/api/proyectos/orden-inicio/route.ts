import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";

import {
  getSupabaseSessionContext,
  withCookies,
} from "@/app/api/presupuesto/_utils";
import {
  crearNombreArchivoOrdenInicio,
  generarOrdenInicioProyectoPdf,
  type DatosOrdenInicioProyecto,
} from "@/lib/ordenInicioProyectoPdf";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const sessionResult = await getSupabaseSessionContext(request);

    if (!sessionResult.ok) return sessionResult.response;

    const { context } = sessionResult;
    const body = await request.json().catch(() => null);
    const validacion = validarDatos(body);

    if (!validacion.ok) {
      return withCookies(
        context,
        NextResponse.json({ error: validacion.error }, { status: 400 })
      );
    }

    const recursos = await obtenerRecursosDocumento();
    const pdfBytes = await generarOrdenInicioProyectoPdf(
      validacion.datos,
      recursos
    );
    const nombreArchivo = crearNombreArchivoOrdenInicio(
      validacion.datos.codigoProyecto,
      validacion.datos.proyecto
    );

    return withCookies(
      context,
      new NextResponse(Buffer.from(pdfBytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${nombreArchivo}"`,
          "Cache-Control": "no-store",
        },
      })
    );
  } catch (error) {
    console.error("Error generando orden de inicio:", error);
    return NextResponse.json(
      { error: "No se pudo generar la orden de inicio." },
      { status: 500 }
    );
  }
}

async function obtenerRecursosDocumento() {
  const membretePath = path.join(process.cwd(), "public", "membrete.svg");
  const membreteSvg = await readFile(membretePath);
  const membretePng = await sharp(membreteSvg, { density: 300 })
    .png()
    .toBuffer();

  return {
    membrete: new Uint8Array(membretePng),
  };
}

function validarDatos(
  value: unknown
):
  | { ok: true; datos: DatosOrdenInicioProyecto }
  | { ok: false; error: string } {
  if (!value || typeof value !== "object") {
    return { ok: false, error: "Debe completar los datos del documento." };
  }

  const row = value as Record<string, unknown>;
  const firmasValue =
    row.firmas && typeof row.firmas === "object"
      ? (row.firmas as Record<string, unknown>)
      : {};
  const datos: DatosOrdenInicioProyecto = {
    codigoProyecto: limpiar(row.codigoProyecto),
    proyecto: limpiar(row.proyecto),
    departamento: limpiar(row.departamento),
    municipio: limpiar(row.municipio),
    ubicacion: limpiar(row.ubicacion),
    fuente: limpiar(row.fuente),
    monto: Number(row.monto),
    fecha: limpiar(row.fecha),
    firmas: {
      alcalde: limpiar(firmasValue.alcalde),
      jefeUtm: limpiar(firmasValue.jefeUtm),
      contratista: limpiar(firmasValue.contratista),
    },
  };

  const requeridos: Array<[string, string]> = [
    ["código del proyecto", datos.codigoProyecto],
    ["proyecto", datos.proyecto],
    ["departamento", datos.departamento],
    ["municipio", datos.municipio],
    ["ubicación", datos.ubicacion],
    ["fuente", datos.fuente],
    ["fecha", datos.fecha],
  ];
  const faltante = requeridos.find(([, campo]) => !campo);

  if (faltante) {
    return { ok: false, error: `Debe completar el campo ${faltante[0]}.` };
  }

  if (
    requeridos.some(([, campo]) => campo.length > 500) ||
    Object.values(datos.firmas).some((campo) => campo.length > 200)
  ) {
    return { ok: false, error: "Uno de los campos supera el tamaño permitido." };
  }

  if (!Number.isFinite(datos.monto) || datos.monto < 0) {
    return { ok: false, error: "El monto vigente no es válido." };
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha)) {
    return { ok: false, error: "La fecha no tiene un formato válido." };
  }

  return { ok: true, datos };
}

function limpiar(value: unknown) {
  return String(value ?? "").trim();
}
