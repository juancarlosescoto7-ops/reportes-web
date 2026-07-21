import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { combinarArchivosPdf } from "@/lib/combinarArchivosPdf";
import { ordenarArchivosExpediente } from "@/lib/expedienteProyectoPdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_ARCHIVOS = 200;
const MAX_BYTES_ARCHIVO = 50 * 1024 * 1024;
const MAX_BYTES_TOTAL = 250 * 1024 * 1024;

type SolicitudExpediente = {
  idProyecto?: unknown;
  nombreProyecto?: unknown;
};

type DocumentoProyectoDB = {
  id_proyecto: number;
  nombre_proyecto: string;
  id_requisito: number;
  nombre_requisito: string;
  url_documento: string | null;
  codigo_presupuestario: string;
};

type OrdenPagoDB = {
  codigo_proyecto: string;
  codigo_obra: string;
  orden_pago_id: string | null;
  url: string | null;
};

function texto(value: unknown, maxLength = 300) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function validarUrlDocumento(value: string, supabaseUrl: string) {
  const url = new URL(value);
  const origenSupabase = new URL(supabaseUrl).origin;
  const rutasPermitidas = [
    "/storage/v1/object/public/documentos/",
    "/storage/v1/object/public/ordenes_pago/",
    "/storage/v1/object/documentos/",
    "/storage/v1/object/ordenes_pago/",
  ];

  if (
    url.origin !== origenSupabase ||
    !rutasPermitidas.some((ruta) => url.pathname.startsWith(ruta))
  ) {
    throw new Error("Uno de los documentos tiene una ubicacion no permitida.");
  }

  return url;
}

function construirUrlStorage(
  ruta: unknown,
  bucket: "documentos" | "ordenes_pago",
  supabaseUrl: string
) {
  const value = texto(ruta, 2_000);
  const baseUrl = supabaseUrl.replace(/\/+$/, "");

  if (!value) return null;

  if (/^https?:\/\//i.test(value)) return value;

  const rutaNormalizada = value.replace(/^\/+/, "");

  if (
    rutaNormalizada.startsWith("documentos/") ||
    rutaNormalizada.startsWith("ordenes_pago/")
  ) {
    return `${baseUrl}/storage/v1/object/public/${rutaNormalizada}`;
  }

  return `${baseUrl}/storage/v1/object/public/${bucket}/${rutaNormalizada}`;
}

async function descargarPdf(
  url: URL,
  nombre: string,
  credenciales: { apikey: string; accessToken: string }
) {
  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      apikey: credenciales.apikey,
      Authorization: `Bearer ${credenciales.accessToken}`,
    },
    signal: AbortSignal.timeout(45_000),
  });

  if (!response.ok) {
    throw new Error(`No se pudo descargar \"${nombre}\".`);
  }

  const contentLength = Number(response.headers.get("content-length") ?? 0);

  if (contentLength > MAX_BYTES_ARCHIVO) {
    throw new Error(`El archivo \"${nombre}\" supera el limite de 50 MB.`);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());

  if (bytes.byteLength > MAX_BYTES_ARCHIVO) {
    throw new Error(`El archivo \"${nombre}\" supera el limite de 50 MB.`);
  }

  const firma = new TextDecoder("ascii").decode(bytes.subarray(0, 5));

  if (firma !== "%PDF-") {
    throw new Error(`El archivo \"${nombre}\" no es un PDF valido.`);
  }

  return bytes;
}

function nombreDescarga(idProyecto: number, nombreProyecto: string) {
  const nombre = nombreProyecto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .toLowerCase();

  return `expediente-proyecto-${idProyecto}${nombre ? `-${nombre}` : ""}.pdf`;
}

function crearStreamPdf(bytes: Uint8Array) {
  const tamanoBloque = 64 * 1024;
  let posicion = 0;

  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (posicion >= bytes.byteLength) {
        controller.close();
        return;
      }

      const fin = Math.min(posicion + tamanoBloque, bytes.byteLength);
      controller.enqueue(bytes.slice(posicion, fin));
      posicion = fin;
    },
  });
}

export async function POST(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Faltan variables de entorno de Supabase." },
      { status: 500 }
    );
  }

  const apiKey = supabaseAnonKey;

  const cookieResponse = NextResponse.next();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "No hay una sesion activa." },
      { status: 401 }
    );
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    return NextResponse.json(
      { error: "No hay una sesion activa." },
      { status: 401 }
    );
  }

  const accessToken = session.access_token;

  try {
    const body = (await request.json()) as SolicitudExpediente;
    const idProyecto = Number(body.idProyecto);
    const nombreSolicitado = texto(body.nombreProyecto);

    if (!Number.isFinite(idProyecto) || idProyecto <= 0) {
      return NextResponse.json(
        { error: "El proyecto seleccionado no es valido." },
        { status: 400 }
      );
    }

    const [resultadoDocumentos, resultadoOrdenes] = await Promise.all([
      supabase.rpc("rpc_proyectos_expediente_codigos", {}),
      supabase.rpc("rpc_codigos_presupuesto_estructura", {}),
    ]);

    if (resultadoDocumentos.error || resultadoOrdenes.error) {
      throw new Error("No se pudo consultar la documentacion del proyecto.");
    }

    const documentos = Array.isArray(resultadoDocumentos.data)
      ? (resultadoDocumentos.data as DocumentoProyectoDB[])
      : [];
    const ordenes = Array.isArray(resultadoOrdenes.data)
      ? (resultadoOrdenes.data as OrdenPagoDB[])
      : [];
    const documentosProyecto = documentos.filter(
      (documento) => Number(documento.id_proyecto) === idProyecto
    );

    if (documentosProyecto.length === 0) {
      return NextResponse.json(
        { error: "No se encontro el proyecto seleccionado." },
        { status: 404 }
      );
    }

    const nombreProyecto =
      texto(documentosProyecto[0]?.nombre_proyecto) || nombreSolicitado;
    const codigosProyecto = new Set(
      documentosProyecto
        .map((documento) => texto(documento.codigo_presupuestario).toUpperCase())
        .filter(Boolean)
    );
    const ordenesProyecto = ordenes.filter((orden) => {
      const idOrden = texto(orden.orden_pago_id, 80);
      const mismoProyecto =
        texto(orden.codigo_proyecto) === String(idProyecto);
      const mismaObra = codigosProyecto.has(
        texto(orden.codigo_obra).toUpperCase()
      );

      return Boolean(idOrden && (mismoProyecto || mismaObra));
    });
    const archivos = ordenarArchivosExpediente({
      requisitos: documentosProyecto.map((documento) => ({
        id: Number(documento.id_requisito),
        nombre: texto(documento.nombre_requisito),
        url: construirUrlStorage(
          documento.url_documento,
          "documentos",
          supabaseUrl
        ),
      })),
      ordenes: ordenesProyecto.map((orden) => ({
        id: texto(orden.orden_pago_id, 80),
        nombre: `Orden de pago #${texto(orden.orden_pago_id, 80)}`,
        url: construirUrlStorage(orden.url, "ordenes_pago", supabaseUrl),
      })),
    });

    if (archivos.length === 0) {
      return NextResponse.json(
        { error: "El proyecto no tiene archivos PDF enlazados." },
        { status: 400 }
      );
    }

    if (archivos.length > MAX_ARCHIVOS) {
      return NextResponse.json(
        { error: `El expediente supera el limite de ${MAX_ARCHIVOS} archivos.` },
        { status: 400 }
      );
    }

    let bytesTotales = 0;
    const urlBaseSupabase = supabaseUrl;

    async function* descargarArchivos() {
      for (const archivo of archivos) {
        const url = validarUrlDocumento(archivo.url, urlBaseSupabase);
        const bytes = await descargarPdf(url, archivo.nombre, {
          apikey: apiKey,
          accessToken,
        });
        bytesTotales += bytes.byteLength;

        if (bytesTotales > MAX_BYTES_TOTAL) {
          throw new Error("El expediente supera el limite total de 250 MB.");
        }

        yield { nombre: archivo.nombre, bytes };
      }
    }

    const {
      bytes: resultado,
      cantidadPaginas,
    } = await combinarArchivosPdf({
      archivos: descargarArchivos(),
      metadatos: {
        titulo: `Expediente - ${
          nombreProyecto || `Proyecto ${idProyecto}`
        }`,
        asunto: `Documentacion del proyecto ${idProyecto}`,
        creador: "Modulo de proyectos",
      },
    });
    const response = new NextResponse(crearStreamPdf(resultado), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nombreDescarga(
          idProyecto,
          nombreProyecto
        )}"`,
        "Cache-Control": "no-store",
        "X-Document-Count": String(archivos.length),
        "X-Page-Count": String(cantidadPaginas),
      },
    });

    cookieResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });

    return response;
  } catch (error) {
    console.error("Error generando expediente PDF:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo generar el expediente PDF.",
      },
      { status: 500 }
    );
  }
}
