import { type NextRequest } from "next/server";
import { validarRubroIngresoSaft } from "@/modules/presupuesto/domain/rubro-ingreso-saft";

import {
  getSupabaseSessionContext,
  jsonWithCookies,
  readSupabaseJson,
  supabaseRest,
} from "@/shared/infrastructure/supabase-server";

type Body = Record<string, unknown>;

const LEVEL_RPC: Record<string, { rpc: string; parentKey?: string }> = {
  Programa: { rpc: "crear_programa_borrador" },
  SubPrograma: { rpc: "crear_subprograma_borrador", parentKey: "p_programa_id" },
  Proyecto: { rpc: "crear_proyecto_borrador", parentKey: "p_subprograma_id" },
  Actividad: { rpc: "crear_actividad_borrador", parentKey: "p_proyecto_id" },
  Obra: { rpc: "crear_obra_borrador", parentKey: "p_actividad_id" },
};

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function parseYear(value: unknown) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 2000 && number <= 2200 ? number : null;
}

function parseAmount(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function errorMessage(data: unknown, fallback: string) {
  return data && typeof data === "object" && "message" in data
    ? String(data.message)
    : fallback;
}

async function read(response: Response, fallback: string) {
  const data = await readSupabaseJson(response);
  if (!response.ok) throw new Error(errorMessage(data, fallback));
  return data;
}

export async function GET(request: NextRequest) {
  const session = await getSupabaseSessionContext(request);
  if (!session.ok) return session.response;

  const anio = parseYear(new URL(request.url).searchParams.get("anio"));
  if (!anio) {
    return jsonWithCookies(session.context, { error: "Debe indicar un año válido." }, { status: 400 });
  }

  try {
    const headers = { "Range-Unit": "items", Range: "0-4999" };
    const headerData = await read(
      await supabaseRest(
        session.context,
        `borradores_presupuesto?select=id,anio,nombre,estado,ejercicio_base,creado_en,actualizado_en&anio=eq.${anio}&limit=1`,
        { cache: "no-store" },
      ),
      "No se pudo consultar el borrador.",
    );
    const borrador = Array.isArray(headerData) ? headerData[0] ?? null : null;

    if (!borrador || typeof borrador !== "object" || !("id" in borrador)) {
      return jsonWithCookies(session.context, {
        borrador: null,
        programas: [],
        subprogramas: [],
        proyectos: [],
        actividades: [],
        obras: [],
        codigos: [],
        topes: [],
        fuentes: [],
        controlTechos: [],
        objetosGasto: [],
        rubrosIngresos: [],
        ingresos: [],
      });
    }

    const id = encodeURIComponent(String(borrador.id));
    const paths = [
      `borrador_programas?select=id,borrador_id,codigo,nombre&borrador_id=eq.${id}&order=codigo.asc`,
      `borrador_subprogramas?select=id,borrador_id,programa_id,fragmento,codigo,nombre&borrador_id=eq.${id}&order=codigo.asc`,
      `borrador_proyectos?select=id,borrador_id,subprograma_id,fragmento,codigo,nombre&borrador_id=eq.${id}&order=codigo.asc`,
      `borrador_actividades?select=id,borrador_id,proyecto_id,fragmento,codigo,nombre&borrador_id=eq.${id}&order=codigo.asc`,
      `borrador_obras?select=id,borrador_id,actividad_id,fragmento,codigo,nombre&borrador_id=eq.${id}&order=codigo.asc`,
      `borrador_codigos_presupuesto?select=id,borrador_id,obra_id,codigo,objeto,fuente,tipo_inversion,monto,actualizado_en&borrador_id=eq.${id}&activo=eq.true&order=codigo.asc`,
      `borrador_presupuesto_topes?select=id,fuente,nivel_aplicacion,id_nivel,porcentaje_tope&borrador_id=eq.${id}&order=fuente.asc,id_nivel.asc`,
      `borrador_presupuesto_fuentes?select=id,fuente,nombre_fuente,monto_base&borrador_id=eq.${id}&order=fuente.asc`,
      "catalogo_objetos_gasto?select=objeto_del_gasto,descripcion&order=objeto_del_gasto.asc",
      "rubros_ingresos_saft?select=codigo,descripcion&order=codigo.asc",
      `borrador_presupuesto_ingresos?select=id,borrador_id,codigo_saft,cantidad_negocios,monto_por_negocio,presupuesto_proyectado,actualizado_en&borrador_id=eq.${id}&order=codigo_saft.asc`,
    ];
    const responses = await Promise.all([
      ...paths.map((path) => supabaseRest(session.context, path, { headers })),
      supabaseRest(session.context, "rpc/obtener_control_techos_borrador", {
        method: "POST",
        body: JSON.stringify({ p_borrador_id: String(borrador.id) }),
      }),
    ]);
    const values = await Promise.all(
      responses.map((response, index) =>
        read(
          response,
          index === 11
            ? "No se pudo calcular el consumo de techos."
            : "No se pudo cargar la estructura del borrador.",
        ),
      ),
    );
    const objetosGasto = Array.isArray(values[8])
      ? values[8].map((row) => {
          const item = row as Record<string, unknown>;
          const code = clean(item.objeto_del_gasto);
          return {
            id: code,
            nombre: [code, clean(item.descripcion)].filter(Boolean).join(" - "),
          };
        })
      : [];

    return jsonWithCookies(session.context, {
      borrador,
      programas: values[0],
      subprogramas: values[1],
      proyectos: values[2],
      actividades: values[3],
      obras: values[4],
      codigos: values[5],
      topes: values[6],
      fuentes: values[7],
      objetosGasto,
      rubrosIngresos: values[9],
      ingresos: values[10],
      controlTechos: values[11],
    });
  } catch (error) {
    return jsonWithCookies(
      session.context,
      { error: error instanceof Error ? error.message : "No se pudo consultar el borrador." },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const session = await getSupabaseSessionContext(request);
  if (!session.ok) return session.response;

  const body = (await request.json().catch(() => ({}))) as Body;
  const accion = clean(body.accion) || "inicializar";
  let rpc = "";
  let payload: Record<string, unknown> = {};

  if (accion === "inicializar") {
    const anio = parseYear(body.anio);
    const base = parseYear(body.ejercicioBase);
    if (!anio || !base || anio <= base) {
      return jsonWithCookies(session.context, { error: "El año del borrador debe ser posterior al ejercicio base." }, { status: 400 });
    }
    rpc = "crear_borrador_presupuesto";
    payload = { p_anio: anio, p_ejercicio_base: base };
  } else if (accion === "crear_nivel") {
    const nivel = clean(body.nivel);
    const config = LEVEL_RPC[nivel];
    const borradorId = clean(body.borradorId);
    const fragmento = clean(body.fragmento);
    const nombre = clean(body.nombre);
    const parentId = clean(body.parentId);
    if (!config || !borradorId || !fragmento || !nombre || (config.parentKey && !parentId)) {
      return jsonWithCookies(session.context, { error: "Debe completar el nivel, su código, nombre y nivel padre." }, { status: 400 });
    }
    rpc = config.rpc;
    payload = { p_borrador_id: borradorId, p_nombre: nombre };
    if (nivel === "Programa") payload.p_codigo = fragmento;
    else {
      payload.p_fragmento = fragmento;
      payload[config.parentKey!] = parentId;
    }
  } else if (accion === "crear_codigo") {
    const monto = parseAmount(body.monto);
    if (!clean(body.borradorId) || !clean(body.obraId) || !clean(body.objeto) || !clean(body.fuente) || !clean(body.tipoInversion) || monto === null) {
      return jsonWithCookies(session.context, { error: "Debe completar obra, objeto, fuente, tipo y monto." }, { status: 400 });
    }
    rpc = "crear_codigo_presupuesto_borrador";
    payload = {
      p_borrador_id: clean(body.borradorId),
      p_obra_id: clean(body.obraId),
      p_objeto: clean(body.objeto),
      p_fuente: clean(body.fuente),
      p_tipo_inversion: clean(body.tipoInversion),
      p_monto: monto,
    };
  } else if (accion === "crear_rubro_ingreso") {
    const rubro = validarRubroIngresoSaft(body.codigoSaft, body.descripcionSaft);
    if (!clean(body.borradorId) || rubro.error) {
      return jsonWithCookies(session.context, { error: rubro.error || "Debe indicar el borrador." }, { status: 400 });
    }
    rpc = "crear_rubro_ingreso_borrador";
    payload = {
      p_borrador_id: clean(body.borradorId),
      p_codigo_saft: rubro.codigoSaft,
      p_descripcion_saft: rubro.descripcionSaft,
    };
  } else if (accion === "guardar_ingreso") {
    const cantidad = Number(body.cantidadNegocios);
    const tarifa = parseAmount(body.montoPorNegocio);
    if (!clean(body.borradorId) || !clean(body.codigoSaft) || !Number.isSafeInteger(cantidad) || cantidad < 0 || tarifa === null) {
      return jsonWithCookies(session.context, { error: "El rubro, la cantidad de negocios y el monto a cobrar no son válidos." }, { status: 400 });
    }
    rpc = "guardar_ingreso_borrador";
    payload = {
      p_borrador_id: clean(body.borradorId),
      p_codigo_saft: clean(body.codigoSaft),
      p_cantidad_negocios: cantidad,
      p_monto_por_negocio: tarifa,
    };
  } else {
    return jsonWithCookies(session.context, { error: "Operación no reconocida." }, { status: 400 });
  }

  const response = await supabaseRest(session.context, `rpc/${rpc}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = await readSupabaseJson(response);
  if (!response.ok) {
    return jsonWithCookies(session.context, { error: errorMessage(data, "No se pudo completar la operación.") }, { status: response.status });
  }
  return jsonWithCookies(session.context, { id: data }, { status: 201 });
}

export async function PATCH(request: NextRequest) {
  const session = await getSupabaseSessionContext(request);
  if (!session.ok) return session.response;
  const body = (await request.json().catch(() => ({}))) as Body;
  const codigoId = clean(body.codigoId);
  const monto = parseAmount(body.monto);
  if (!codigoId || monto === null) {
    return jsonWithCookies(session.context, { error: "El código o el monto no son válidos." }, { status: 400 });
  }
  const response = await supabaseRest(session.context, "rpc/actualizar_monto_codigo_borrador", {
    method: "POST",
    body: JSON.stringify({ p_codigo_id: codigoId, p_monto: monto }),
  });
  const data = await readSupabaseJson(response);
  if (!response.ok) {
    return jsonWithCookies(session.context, { error: errorMessage(data, "No se pudo actualizar el monto.") }, { status: response.status });
  }
  return jsonWithCookies(session.context, { id: data });
}

export async function DELETE(request: NextRequest) {
  const session = await getSupabaseSessionContext(request);
  if (!session.ok) return session.response;
  const body = (await request.json().catch(() => ({}))) as Body;
  const codigoId = clean(body.codigoId);
  if (!codigoId) {
    return jsonWithCookies(session.context, { error: "Debe indicar el código." }, { status: 400 });
  }
  const response = await supabaseRest(session.context, "rpc/desactivar_codigo_borrador", {
    method: "POST",
    body: JSON.stringify({ p_codigo_id: codigoId }),
  });
  const data = await readSupabaseJson(response);
  if (!response.ok) {
    return jsonWithCookies(session.context, { error: errorMessage(data, "No se pudo retirar el código.") }, { status: response.status });
  }
  return jsonWithCookies(session.context, { id: data });
}
