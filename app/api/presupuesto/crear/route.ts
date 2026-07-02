import { type NextRequest } from "next/server";
import {
  getSupabaseSessionContext,
  isNivelPresupuesto,
  jsonWithCookies,
  NIVEL_CONFIG,
  readSupabaseJson,
  type NivelPresupuesto,
  type SupabaseSessionContext,
  supabaseRest,
} from "../_utils";

export const dynamic = "force-dynamic";

type CrearPresupuestoBody = {
  nivel?: unknown;
  idPadre?: unknown;
  fragmento?: unknown;
  nombre?: unknown;
  objeto?: unknown;
  fuente?: unknown;
  tipoInversion?: unknown;
};

type NivelEstructural = Exclude<NivelPresupuesto, "Codigo">;

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function isNivelEstructural(nivel: NivelPresupuesto): nivel is NivelEstructural {
  return nivel !== "Codigo";
}

function construirIdFinal({
  nivel,
  idPadre,
  fragmento,
  objeto,
  fuente,
  tipoInversion,
}: {
  nivel: string;
  idPadre: string;
  fragmento: string;
  objeto: string;
  fuente: string;
  tipoInversion: string;
}) {
  if (nivel === "Codigo") {
    return `${idPadre} ${objeto} ${fuente} ${tipoInversion}`.trim();
  }

  if (!idPadre) return fragmento;

  return `${idPadre} ${fragmento}`.trim();
}

function crearPayload({
  nivel,
  idPadre,
  idFinal,
  nombre,
  objeto,
  fuente,
  tipoInversion,
}: {
  nivel: string;
  idPadre: string;
  idFinal: string;
  nombre: string;
  objeto: string;
  fuente: string;
  tipoInversion: string;
}) {
  if (nivel === "Codigo") {
    return {
      codigo: idFinal,
      objeto,
      fuente,
      tipo_inversion: tipoInversion,
      obra_id: idPadre,
    };
  }

  if (!isNivelPresupuesto(nivel) || !isNivelEstructural(nivel)) {
    throw new Error("Nivel estructural invalido.");
  }

  const config = NIVEL_CONFIG[nivel];

  return {
    id: idFinal,
    nombre,
    ...(config.parentColumn ? { [config.parentColumn]: idPadre } : {}),
  };
}

async function existeRegistro({
  context,
  nivel,
  idFinal,
}: {
  context: SupabaseSessionContext;
  nivel: NivelPresupuesto;
  idFinal: string;
}) {
  const path =
    nivel === "Codigo"
      ? `codigos_presupuesto?select=codigo&codigo=eq.${encodeURIComponent(
          idFinal
        )}`
      : `${NIVEL_CONFIG[nivel].table}?select=id&id=eq.${encodeURIComponent(
          idFinal
        )}`;

  const response = await supabaseRest(context, path, {
    method: "GET",
  });

  const data = await readSupabaseJson(response);

  if (!response.ok) {
    throw new Error(
      `No se pudo validar duplicado: ${JSON.stringify(data ?? {})}`
    );
  }

  return Array.isArray(data) && data.length > 0;
}

export async function POST(request: NextRequest) {
  const session = await getSupabaseSessionContext(request);

  if (!session.ok) return session.response;

  const body = (await request.json().catch(() => ({}))) as CrearPresupuestoBody;
  const nivel = clean(body.nivel);
  const idPadre = clean(body.idPadre);
  const fragmento = clean(body.fragmento);
  const nombre = clean(body.nombre);
  const objeto = clean(body.objeto);
  const fuente = clean(body.fuente);
  const tipoInversion = clean(body.tipoInversion);

  if (!isNivelPresupuesto(nivel)) {
    return jsonWithCookies(
      session.context,
      { error: "Nivel presupuestario invalido." },
      { status: 400 }
    );
  }

  if (nivel !== "Programa" && !idPadre) {
    return jsonWithCookies(
      session.context,
      { error: "Debe seleccionar el nivel padre." },
      { status: 400 }
    );
  }

  if (nivel === "Codigo") {
    if (!objeto || !fuente || !tipoInversion) {
      return jsonWithCookies(
        session.context,
        { error: "Faltan datos obligatorios para crear el codigo." },
        { status: 400 }
      );
    }
  } else {
    if (!fragmento) {
      return jsonWithCookies(
        session.context,
        { error: "Debe ingresar el codigo del nivel." },
        { status: 400 }
      );
    }

    if (!nombre) {
      return jsonWithCookies(
        session.context,
        { error: "Debe ingresar el nombre del nivel." },
        { status: 400 }
      );
    }
  }

  const idFinal = construirIdFinal({
    nivel,
    idPadre,
    fragmento,
    objeto,
    fuente,
    tipoInversion,
  });

  try {
    const existe = await existeRegistro({
      context: session.context,
      nivel,
      idFinal,
    });

    if (existe) {
      return jsonWithCookies(
        session.context,
        { error: `Ya existe un registro con ID: ${idFinal}` },
        { status: 409 }
      );
    }
  } catch (error) {
    return jsonWithCookies(
      session.context,
      {
        error:
          error instanceof Error
            ? error.message
            : "No se pudo validar duplicados.",
      },
      { status: 500 }
    );
  }

  const table =
    nivel === "Codigo"
      ? "codigos_presupuesto"
      : NIVEL_CONFIG[nivel].table;

  const payload = crearPayload({
    nivel,
    idPadre,
    idFinal,
    nombre,
    objeto,
    fuente,
    tipoInversion,
  });

  const response = await supabaseRest(session.context, table, {
    method: "POST",
    headers: {
      Prefer: "return=representation",
    },
    body: JSON.stringify(payload),
  });

  const data = await readSupabaseJson(response);

  if (!response.ok) {
    return jsonWithCookies(
      session.context,
      { error: "No se pudo crear el registro presupuestario.", detalle: data },
      { status: response.status }
    );
  }

  return jsonWithCookies(session.context, {
    id: idFinal,
    nivel,
    data,
  });
}
