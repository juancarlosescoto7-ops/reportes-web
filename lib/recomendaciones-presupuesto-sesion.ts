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
  fuente: string | null;
  tipoInversion: string | null;
  presupuestoVigente: number;
  ejecutado: number;
  comprometido: number;
  saldoDisponible: number;
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
  proyectoId: string | null;
  actividadId: string | null;
  obraId: string | null;
  ejercicioFiscal: number | null;
  saldoDisponible: number;
  confianza: number;
  explicacion: string;
};

type SeleccionPresupuestoModelo = {
  clave_presupuesto: string;
  confianza: number;
  explicacion: string;
};

type CxpCandidata = {
  no_cxp: number;
  tipo_movimiento?: string | null;
  fecha?: string | null;
  descripcion?: string | null;
  beneficiario_nombre?: string | null;
  cuenta?: string | null;
  haber?: number | null;
  monto_comprometido?: number | null;
  estado_administrativo?: string | null;
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
  return (
    cxp.estado_administrativo === "pendiente" &&
    cxp.puede_comprometer === true &&
    numberValue(cxp.haber) > 0 &&
    numberValue(cxp.monto_comprometido) <= 0
  );
}

export function prepararCxpParaRecomendacion(
  cxp: CxpCandidata
): CxpParaRecomendacionSesion {
  return {
    claveCxp: crearClaveCxp(cxp.no_cxp, cxp.tipo_movimiento),
    noCxp: cxp.no_cxp,
    tipoMovimiento: textValue(cxp.tipo_movimiento),
    fecha: textValue(cxp.fecha),
    descripcion: textValue(cxp.descripcion),
    beneficiario: textValue(cxp.beneficiario_nombre),
    cuenta: textValue(cxp.cuenta),
    montoHaber: numberValue(cxp.haber),
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
      fuente,
      tipoInversion,
      presupuestoVigente,
      ejecutado,
      comprometido,
      saldoDisponible: presupuestoVigente - ejecutado - comprometido,
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
  confianza: number;
  explicacion: string;
}): RecomendacionPresupuestoSesion {
  const { cxp, opcion } = input;

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
    proyectoId: opcion.proyectoId,
    actividadId: opcion.actividadId,
    obraId: opcion.obraId,
    ejercicioFiscal: opcion.ejercicioFiscal,
    saldoDisponible: opcion.saldoDisponible,
    confianza: Math.max(0, Math.min(100, Math.round(input.confianza))),
    explicacion: input.explicacion.trim(),
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
        required: ["clave_presupuesto", "confianza", "explicacion"],
        properties: {
          clave_presupuesto: {
            type: "string",
            enum: opciones.map((opcion) => opcion.clave),
          },
          confianza: { type: "integer", minimum: 0, maximum: 100 },
          explicacion: { type: "string" },
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

    if (
      !Number.isFinite(seleccion.confianza) ||
      typeof seleccion.explicacion !== "string"
    ) {
      throw new Error("La IA devolvio campos incompletos.");
    }

    return crearRecomendacionDesdeSeleccion({
      cxp: cuenta,
      opcion,
      confianza: seleccion.confianza,
      explicacion: seleccion.explicacion,
    });
  });
}
