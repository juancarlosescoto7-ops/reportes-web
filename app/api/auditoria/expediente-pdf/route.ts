import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { combinarArchivosPdf } from "@/lib/combinarArchivosPdf";
import { puedeAccederAuditoria } from "@/lib/acceso-auditoria";
import {
  agruparEgresosAuditoriaPorOrden,
  construirConfirmacionExpediente,
  construirUrlDocumentoAuditoria,
  esConfirmacionExpedienteValida,
  normalizarReporteAuditoria,
  ordenarOrdenesParaExpediente,
  requiereConfirmacionExpediente,
  type FilaReporteAuditoriaDB,
} from "@/lib/auditoria-egresos";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_ARCHIVOS = 200;
const MAX_BYTES_ARCHIVO = 50 * 1024 * 1024;
const MAX_BYTES_TOTAL = 250 * 1024 * 1024;

type SolicitudExpedienteAuditoria = {
  ordenes?: unknown;
  confirmacionVolumen?: unknown;
};

type PermisoUsuarioDB = {
  rol_codigo?: string | null;
};

function texto(value: unknown, maxLength = 300) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function normalizarOrdenesSolicitadas(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map(Number)
        .filter((orden) => Number.isInteger(orden) && orden > 0)
    )
  );
}

function validarUrlDocumento(value: string, supabaseUrl: string) {
  const url = new URL(value);
  const origenSupabase = new URL(supabaseUrl).origin;
  const rutasPermitidas = [
    "/storage/v1/object/public/ordenes_pago/",
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

function nombreDescarga(fechas: Array<string | null>) {
  const fechasValidas = fechas
    .map((fecha) => texto(fecha, 10))
    .filter((fecha) => /^\d{4}-\d{2}-\d{2}$/.test(fecha))
    .sort();
  const primera = fechasValidas.at(0);
  const ultima = fechasValidas.at(-1);
  const periodo = primera
    ? primera === ultima
      ? primera
      : `${primera}-a-${ultima}`
    : "sin-fecha";

  return `expediente-auditoria-${periodo}.pdf`;
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

  const [resultadoPermisos, resultadoSesion] = await Promise.all([
    supabase.rpc("obtener_mis_permisos"),
    supabase.auth.getSession(),
  ]);
  const permisos = Array.isArray(resultadoPermisos.data)
    ? (resultadoPermisos.data as PermisoUsuarioDB[])
    : [];

  if (
    resultadoPermisos.error ||
    !permisos.some((permiso) =>
      puedeAccederAuditoria(permiso.rol_codigo)
    )
  ) {
    return NextResponse.json(
      { error: "No tiene permiso para generar expedientes de auditoria." },
      { status: 403 }
    );
  }

  const accessToken = resultadoSesion.data.session?.access_token;

  if (!accessToken) {
    return NextResponse.json(
      { error: "No hay una sesion activa." },
      { status: 401 }
    );
  }

  let body: SolicitudExpedienteAuditoria;

  try {
    body = (await request.json()) as SolicitudExpedienteAuditoria;
  } catch {
    return NextResponse.json(
      { error: "La solicitud del expediente no es valida." },
      { status: 400 }
    );
  }

  const ordenesSolicitadas = normalizarOrdenesSolicitadas(body.ordenes);

  if (ordenesSolicitadas.length === 0) {
    return NextResponse.json(
      { error: "Seleccione al menos una orden de pago con documento." },
      { status: 400 }
    );
  }

  if (ordenesSolicitadas.length > MAX_ARCHIVOS) {
    return NextResponse.json(
      { error: `El expediente supera el limite tecnico de ${MAX_ARCHIVOS} archivos.` },
      { status: 400 }
    );
  }

  try {
    const { data, error } = await supabase.rpc("reporte_egresos_auditoria");

    if (error) {
      throw new Error("No se pudo consultar la documentacion de auditoria.");
    }

    const ordenesDisponibles = agruparEgresosAuditoriaPorOrden(
      normalizarReporteAuditoria(
        Array.isArray(data) ? (data as FilaReporteAuditoriaDB[]) : []
      )
    );
    const mapaOrdenes = new Map(
      ordenesDisponibles.map((orden) => [orden.noOrden, orden])
    );
    const ordenesNoDisponibles = ordenesSolicitadas.filter(
      (noOrden) => !mapaOrdenes.has(noOrden)
    );

    if (ordenesNoDisponibles.length > 0) {
      return NextResponse.json(
        {
          error:
            "Una o mas ordenes ya no estan disponibles. Actualice la pagina antes de generar el expediente.",
        },
        { status: 409 }
      );
    }

    const ordenes = ordenarOrdenesParaExpediente(
      ordenesSolicitadas.map((noOrden) => mapaOrdenes.get(noOrden)!)
    );
    const ordenesSinDocumento = ordenes.filter(
      (orden) => !orden.rutaDocumento
    );

    if (ordenesSinDocumento.length > 0) {
      return NextResponse.json(
        {
          error:
            "Una o mas ordenes ya no tienen un PDF disponible. Actualice la pagina antes de generar el expediente.",
        },
        { status: 409 }
      );
    }

    if (
      requiereConfirmacionExpediente(ordenes.length) &&
      !esConfirmacionExpedienteValida(
        body.confirmacionVolumen,
        ordenes.length
      )
    ) {
      return NextResponse.json(
        {
          error: `Confirme el volumen escribiendo ${construirConfirmacionExpediente(
            ordenes.length
          )}.`,
          codigo: "CONFIRMACION_VOLUMEN_REQUERIDA",
          cantidadDocumentos: ordenes.length,
        },
        { status: 409 }
      );
    }

    let bytesTotales = 0;

    async function* descargarArchivos() {
      for (const orden of ordenes) {
        const urlDocumento = construirUrlDocumentoAuditoria(
          supabaseUrl,
          orden.rutaDocumento
        );

        if (!urlDocumento) {
          throw new Error(
            `La orden de pago #${orden.noOrden} no tiene un PDF disponible.`
          );
        }

        const nombre = `Orden de pago #${orden.noOrden}`;
        const bytes = await descargarPdf(
          validarUrlDocumento(urlDocumento, supabaseUrl),
          nombre,
          { apikey: supabaseAnonKey, accessToken }
        );
        bytesTotales += bytes.byteLength;

        if (bytesTotales > MAX_BYTES_TOTAL) {
          throw new Error("El expediente supera el limite total de 250 MB.");
        }

        yield { nombre, bytes };
      }
    }

    const { bytes, cantidadPaginas } = await combinarArchivosPdf({
      archivos: descargarArchivos(),
      metadatos: {
        titulo: "Expediente de auditoria",
        asunto: `Ordenes de pago: ${ordenes
          .map((orden) => orden.noOrden)
          .join(", ")}`,
        creador: "Modulo de auditoria",
      },
    });
    const response = new NextResponse(crearStreamPdf(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${nombreDescarga(
          ordenes.map((orden) => orden.fecha)
        )}"`,
        "Cache-Control": "no-store",
        "X-Document-Count": String(ordenes.length),
        "X-Page-Count": String(cantidadPaginas),
      },
    });

    cookieResponse.cookies.getAll().forEach((cookie) => {
      response.cookies.set(cookie);
    });

    return response;
  } catch (error) {
    console.error("Error generando expediente de auditoria:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo generar el expediente de auditoria.",
      },
      { status: 500 }
    );
  }
}
