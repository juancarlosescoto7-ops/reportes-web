export type PresupuestoRawRow = Record<string, unknown>;

export type OpcionPresupuestoSesion = {
  clave: string;
  codigoPresupuestario: string;
  programa: string | null;
  subprograma: string | null;
  proyecto: string | null;
  actividad: string | null;
  obra: string | null;
  programaId: string | null;
  subprogramaId: string | null;
  proyectoId: string | null;
  actividadId: string | null;
  obraId: string | null;
  objeto: string | null;
  descripcionObjeto: string | null;
  contextoCxp: string | null;
  fuente: string | null;
  tipoInversion: string | null;
  presupuestoVigente: number;
  ejecutado: number;
  comprometido: number;
  saldoDisponible: number;
  saldoGrupoDisponible: number | null;
  ejercicioFiscal: number | null;
};

export type CxpParaRecomendacionSesion = {
  claveCxp: string;
  noCxp: number;
  tipoMovimiento: string | null;
  fecha: string | null;
  descripcion: string | null;
  beneficiario: string | null;
  cuenta: string | null;
  montoHaber: number;
  montoPendiente: number;
};

export type AntecedenteCompromisoSesion = {
  descripcion: string | null;
  beneficiario: string | null;
  codigoPresupuestario: string;
};

export type RecomendacionPresupuestoSesion = {
  claveCxp: string;
  noCxp: number;
  tipoMovimiento: string | null;
  codigoPresupuestario: string;
  programa: string | null;
  subprograma: string | null;
  proyecto: string | null;
  actividad: string | null;
  obra: string | null;
  objeto: string | null;
  descripcionObjeto: string | null;
  proyectoId: string | null;
  actividadId: string | null;
  obraId: string | null;
  ejercicioFiscal: number | null;
  resumenCriterio: string;
  confianza: number;
  viabilidadFinanciera: ViabilidadFinancieraProyectada;
};

export type ViabilidadFinancieraProyectada =
  | "Pago total"
  | "Pago parcial"
  | "No pagar"
  | "Sin monto pendiente"
  | "Por validar";

export type ResumenGrupoParaViabilidad = {
  Fuente: string;
  Tipo: string;
  SaldoDisponibleProyectado: number;
};

type DatosRutaPresupuestaria = Pick<
  OpcionPresupuestoSesion,
  | "codigoPresupuestario"
  | "programa"
  | "subprograma"
  | "proyecto"
  | "actividad"
  | "obra"
  | "programaId"
  | "subprogramaId"
  | "proyectoId"
  | "actividadId"
  | "obraId"
  | "objeto"
  | "descripcionObjeto"
>;

type SeleccionPresupuestoModelo = {
  clave_presupuesto: string;
  resumen_criterio: string;
  confianza: number;
};

type CxpCandidata = {
  no_cxp: number;
  tipo_movimiento?: string | null;
  fecha?: string | null;
  descripcion?: string | null;
  beneficiario_nombre?: string | null;
  cuenta?: string | null;
  haber?: number | null;
  debe?: number | null;
  monto_pagado?: number | null;
  monto_comprometido?: number | null;
  estado_administrativo?: string | null;
  estado_operativo?: string | null;
  puede_comprometer?: boolean | null;
};

function textValue(value: unknown) {
  if (value === null || value === undefined) return null;

  const text = String(value).trim();
  return text || null;
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstText(row: PresupuestoRawRow, keys: string[]) {
  for (const key of keys) {
    const value = textValue(row[key]);
    if (value) return value;
  }

  return null;
}

export function describirRutaPresupuestaria(
  opcion: DatosRutaPresupuestaria
) {
  const niveles = [
    ["Código presupuestario", opcion.codigoPresupuestario, null],
    ["Programa", opcion.programaId, opcion.programa],
    ["Subprograma", opcion.subprogramaId, opcion.subprograma],
    ["Proyecto", opcion.proyectoId, opcion.proyecto],
    ["Actividad", opcion.actividadId, opcion.actividad],
    ["Obra", opcion.obraId, opcion.obra],
    ["Renglón presupuestario", opcion.objeto, opcion.descripcionObjeto],
  ];

  return niveles
    .map(([etiqueta, codigo, nombre]) => {
      const detalle = [codigo, nombre]
        .filter((value, index, values) => value && values.indexOf(value) === index)
        .join(" — ");

      return `${etiqueta}: ${detalle || "No especificado"}`;
    })
    .join(" > ");
}

function numberValue(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const parsed = Number(
    String(value ?? "")
      .replace(/L\./gi, "")
      .replace(/,/g, "")
      .trim()
  );

  return Number.isFinite(parsed) ? parsed : 0;
}

function resumirCriterio(value: string) {
  const palabras = value.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  const resumen = palabras.slice(0, 18).join(" ");

  return palabras.length > 18 ? `${resumen}…` : resumen;
}

function nullableNumber(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function committedValue(row: PresupuestoRawRow) {
  return numberValue(
    row.comprometido ??
      row.total_comprometido ??
      row.saldo_comprometido ??
      row.monto_comprometido ??
      0
  );
}

export function crearClaveCxp(
  noCxp: number | string,
  tipoMovimiento: string | null | undefined
) {
  return `${String(noCxp).trim()}::${String(tipoMovimiento ?? "").trim()}`;
}

export function esCxpCandidataParaRecomendacion(cxp: CxpCandidata) {
  const estadoAdministrativo = normalizarClaveGrupo(
    cxp.estado_administrativo
  );
  const estadoOperativo = normalizarClaveGrupo(cxp.estado_operativo);
  const estaPendiente =
    estadoAdministrativo === "pendiente" ||
    estadoOperativo === "sin_compromiso";

  return (
    estaPendiente &&
    numberValue(cxp.haber) > 0 &&
    numberValue(cxp.monto_comprometido) <= 0
  );
}

export function prepararCxpParaRecomendacion(
  cxp: CxpCandidata
): CxpParaRecomendacionSesion {
  const montoHaber = numberValue(cxp.haber);
  const montoPagado = numberValue(cxp.debe ?? cxp.monto_pagado);

  return {
    claveCxp: crearClaveCxp(cxp.no_cxp, cxp.tipo_movimiento),
    noCxp: cxp.no_cxp,
    tipoMovimiento: textValue(cxp.tipo_movimiento),
    fecha: textValue(cxp.fecha),
    descripcion: textValue(cxp.descripcion),
    beneficiario: textValue(cxp.beneficiario_nombre),
    cuenta: textValue(cxp.cuenta),
    montoHaber,
    montoPendiente: Math.max(montoHaber - montoPagado, 0),
  };
}

function fechaComparable(value: string | null) {
  const fechaIso = value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  return fechaIso ?? "9999-12-31";
}

export function ordenarCuentasPorAntiguedad(
  cuentas: CxpParaRecomendacionSesion[]
) {
  return [...cuentas].sort((a, b) => {
    const comparacionFecha = fechaComparable(a.fecha).localeCompare(
      fechaComparable(b.fecha)
    );

    if (comparacionFecha !== 0) return comparacionFecha;

    const comparacionNumero = a.noCxp - b.noCxp;
    if (comparacionNumero !== 0) return comparacionNumero;

    return a.claveCxp.localeCompare(b.claveCxp);
  });
}

function normalizarClaveGrupo(value: string | null | undefined) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function claveGrupo(fuente: string, tipo: string) {
  return `${normalizarClaveGrupo(fuente)}::${normalizarClaveGrupo(tipo)}`;
}

function resolverGrupoOpcion(opcion: OpcionPresupuestoSesion) {
  const fuenteOriginal = textValue(opcion.fuente);
  const tipoOriginal = textValue(opcion.tipoInversion);

  if (!fuenteOriginal || !tipoOriginal) return null;

  const fuenteNormalizada = normalizarClaveGrupo(fuenteOriginal);
  const tipoNormalizado = normalizarClaveGrupo(tipoOriginal);
  const esTransferencias =
    fuenteNormalizada === "11-001-01" ||
    fuenteNormalizada.includes("transferencias");
  const esFondosPropios =
    fuenteNormalizada === "15-013-01" ||
    fuenteNormalizada.includes("fondos propios");
  const esFuncionamiento =
    tipoNormalizado === "10" ||
    tipoNormalizado.includes("gastos de funcionamiento");
  const esInversion =
    tipoNormalizado === "20" || tipoNormalizado.includes("gastos de inversion");

  const fuente = esTransferencias
    ? "Transferencias"
    : esFondosPropios
      ? "Fondos propios"
      : fuenteOriginal;
  let tipo = tipoOriginal;

  if (esFuncionamiento) {
    tipo = "Gastos de funcionamiento";
  } else if (esFondosPropios && esInversion) {
    tipo = "Gastos de inversion";
  } else if (esTransferencias && esInversion && opcion.programa) {
    tipo = opcion.programa;
  }

  return { fuente, tipo };
}

export function incorporarSaldosGrupoPresupuesto(
  opciones: OpcionPresupuestoSesion[],
  grupos: ResumenGrupoParaViabilidad[]
) {
  const saldos = new Map<string, number>();

  grupos.forEach((grupo) => {
    const saldo = Number(grupo.SaldoDisponibleProyectado);

    if (Number.isFinite(saldo)) {
      saldos.set(claveGrupo(grupo.Fuente, grupo.Tipo), saldo);
    }
  });

  return opciones.map((opcion) => {
    const grupo = resolverGrupoOpcion(opcion);
    const saldoGrupoDisponible = grupo
      ? (saldos.get(claveGrupo(grupo.fuente, grupo.tipo)) ?? null)
      : null;

    return { ...opcion, saldoGrupoDisponible };
  });
}

export function proyectarRecomendacionFinanciera(input: {
  montoPendiente: number;
  saldoCodigoDisponible: number;
  saldoGrupoDisponible: number | null;
}): ViabilidadFinancieraProyectada {
  const montoPendiente = Math.max(Number(input.montoPendiente) || 0, 0);
  const saldoCodigo = Math.max(Number(input.saldoCodigoDisponible) || 0, 0);

  if (montoPendiente <= 0) {
    return "Sin monto pendiente";
  }

  if (
    input.saldoGrupoDisponible === null ||
    !Number.isFinite(Number(input.saldoGrupoDisponible))
  ) {
    return "Por validar";
  }

  const saldoGrupo = Math.max(Number(input.saldoGrupoDisponible), 0);
  const montoCubierto = Math.min(saldoCodigo, saldoGrupo);

  if (montoCubierto + 0.005 >= montoPendiente) {
    return "Pago total";
  }

  if (montoCubierto > 0) {
    return "Pago parcial";
  }

  return "No pagar";
}

export function compactarOpcionesPresupuesto(
  rows: PresupuestoRawRow[]
): OpcionPresupuestoSesion[] {
  const opciones = new Map<
    string,
    Omit<OpcionPresupuestoSesion, "clave">
  >();

  for (const row of rows) {
    const codigoPresupuestario = firstText(row, [
      "codigo",
      "codigo_presupuestario",
    ]);

    if (!codigoPresupuestario) continue;

    const programaId = firstText(row, ["programa_id", "programa"]);
    const subprogramaId = firstText(row, [
      "sub_programa_id",
      "subprograma_id",
      "sub_programa",
      "subprograma",
    ]);
    const proyectoId = firstText(row, ["proyecto_id", "proyecto"]);
    const actividadId = firstText(row, ["actividad_id", "actividad"]);
    const obraId = firstText(row, ["obra_id", "obra"]);
    const programa = firstText(row, [
      "programa_nombre",
      "nombre_programa",
      "programa",
    ]);
    const subprograma = firstText(row, [
      "subprograma_nombre",
      "nombre_subprograma",
      "sub_programa_nombre",
      "subprograma",
      "sub_programa",
    ]);
    const proyecto = firstText(row, [
      "proyecto_nombre",
      "nombre_proyecto",
      "proyecto",
    ]);
    const actividad = firstText(row, [
      "actividad_nombre",
      "nombre_actividad",
      "actividad",
    ]);
    const obra = firstText(row, ["obra_nombre", "nombre_obra", "obra"]);
    const objeto = firstText(row, ["objeto"]);
    const descripcionObjeto = firstText(row, ["descripcion_objeto"]);
    const contextoCxp = firstText(row, ["contexto_cxp"]);
    const fuente = firstText(row, ["fuente"]);
    const tipoInversion = firstText(row, ["tipo_inversion"]);
    const ejercicioFiscal = nullableNumber(row.ejercicio_fiscal);

    const identity = [
      codigoPresupuestario,
      programaId,
      subprogramaId,
      proyectoId,
      actividadId,
      obraId,
      ejercicioFiscal,
    ].join("|");

    const presupuestoVigente = numberValue(row.presupuesto_vigente);
    const ejecutado = numberValue(row.ejecutado);
    const comprometido = committedValue(row);
    const actual = opciones.get(identity);

    if (actual) {
      actual.presupuestoVigente += presupuestoVigente;
      actual.ejecutado += ejecutado;
      actual.comprometido += comprometido;
      actual.saldoDisponible =
        actual.presupuestoVigente - actual.ejecutado - actual.comprometido;
      continue;
    }

    opciones.set(identity, {
      codigoPresupuestario,
      programa,
      subprograma,
      proyecto,
      actividad,
      obra,
      programaId,
      subprogramaId,
      proyectoId,
      actividadId,
      obraId,
      objeto,
      descripcionObjeto,
      contextoCxp,
      fuente,
      tipoInversion,
      presupuestoVigente,
      ejecutado,
      comprometido,
      saldoDisponible: presupuestoVigente - ejecutado - comprometido,
      saldoGrupoDisponible: null,
      ejercicioFiscal,
    });
  }

  return Array.from(opciones.values()).map((opcion, index) => ({
    clave: `p${index + 1}`,
    ...opcion,
  }));
}

export function crearRecomendacionDesdeSeleccion(input: {
  cxp: CxpParaRecomendacionSesion;
  opcion: OpcionPresupuestoSesion;
  resumenCriterio: string;
  confianza: number;
}): RecomendacionPresupuestoSesion {
  const { cxp, opcion } = input;
  const resumenCriterio =
    resumirCriterio(input.resumenCriterio) ||
    resumirCriterio(
      `Coincide con ${
        opcion.descripcionObjeto ??
        opcion.objeto ??
        "la estructura presupuestaria seleccionada"
      }.`
    );

  return {
    claveCxp: cxp.claveCxp,
    noCxp: cxp.noCxp,
    tipoMovimiento: cxp.tipoMovimiento,
    codigoPresupuestario: opcion.codigoPresupuestario,
    programa: opcion.programa,
    subprograma: opcion.subprograma,
    proyecto: opcion.proyecto,
    actividad: opcion.actividad,
    obra: opcion.obra,
    objeto: opcion.objeto,
    descripcionObjeto: opcion.descripcionObjeto,
    proyectoId: opcion.proyectoId,
    actividadId: opcion.actividadId,
    obraId: opcion.obraId,
    ejercicioFiscal: opcion.ejercicioFiscal,
    resumenCriterio,
    confianza: Math.max(0, Math.min(100, Math.round(input.confianza))),
    viabilidadFinanciera: proyectarRecomendacionFinanciera({
      montoPendiente: cxp.montoPendiente ?? cxp.montoHaber,
      saldoCodigoDisponible: opcion.saldoDisponible,
      saldoGrupoDisponible: opcion.saldoGrupoDisponible,
    }),
  };
}

export function construirSchemaRecomendacionesPresupuesto(
  cuentas: CxpParaRecomendacionSesion[],
  opciones: OpcionPresupuestoSesion[]
) {
  const clavesCxp = cuentas.map((cuenta) => cuenta.claveCxp);

  return {
    type: "object",
    additionalProperties: false,
    required: ["recomendaciones"],
    properties: {
      recomendaciones: {
        type: "object",
        additionalProperties: false,
        required: clavesCxp,
        properties: Object.fromEntries(
          clavesCxp.map((claveCxp) => [
            claveCxp,
            { $ref: "#/$defs/seleccion_presupuestaria" },
          ])
        ),
      },
    },
    $defs: {
      seleccion_presupuestaria: {
        type: "object",
        additionalProperties: false,
        required: ["clave_presupuesto", "resumen_criterio", "confianza"],
        properties: {
          clave_presupuesto: {
            type: "string",
            enum: opciones.map((opcion) => opcion.clave),
          },
          resumen_criterio: { type: "string" },
          confianza: { type: "integer", minimum: 0, maximum: 100 },
        },
      },
    },
  };
}

export function convertirRespuestaModeloARecomendaciones(
  value: unknown,
  cuentas: CxpParaRecomendacionSesion[],
  opciones: OpcionPresupuestoSesion[]
) {
  if (!isRecordValue(value)) {
    throw new Error("La IA no devolvio recomendaciones validas.");
  }

  const selecciones = value.recomendaciones;

  if (!isRecordValue(selecciones)) {
    throw new Error("La IA no devolvio recomendaciones validas.");
  }

  const opcionMap = new Map(opciones.map((opcion) => [opcion.clave, opcion]));

  return cuentas.map((cuenta) => {
    const item = selecciones[cuenta.claveCxp];

    if (!isRecordValue(item)) {
      throw new Error(
        `La IA no devolvio una recomendacion para la CxP ${cuenta.noCxp}.`
      );
    }

    const seleccion = item as SeleccionPresupuestoModelo;
    const opcion = opcionMap.get(seleccion.clave_presupuesto);

    if (!opcion) {
      throw new Error(
        `La IA devolvio una opcion presupuestaria invalida para la CxP ${cuenta.noCxp}.`
      );
    }

    if (typeof seleccion.resumen_criterio !== "string") {
      throw new Error("La IA no devolvio el resumen de la recomendacion.");
    }

    if (!Number.isFinite(seleccion.confianza)) {
      throw new Error("La IA no devolvio la confianza de la recomendacion.");
    }

    return crearRecomendacionDesdeSeleccion({
      cxp: cuenta,
      opcion,
      resumenCriterio: seleccion.resumen_criterio,
      confianza: seleccion.confianza,
    });
  });
}
