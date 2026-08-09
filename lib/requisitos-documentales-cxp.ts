export type OrigenContextoDocumental =
  | "SISTEMA"
  | "USUARIO"
  | "IA_REVISADA";

export type RequisitoDocumentoContexto = {
  codigo: string;
  nombre: string;
  descripcion: string;
};

export type ContextoDocumentalCxp = {
  id: string | null;
  codigo: string;
  nombre: string;
  descripcion: string;
  palabrasClave: string[];
  ejemplos: string[];
  requisitos: RequisitoDocumentoContexto[];
  esGeneral: boolean;
  activo: boolean;
  prioridad: number;
  origen: OrigenContextoDocumental;
};

export type ContextoDocumentalCxpRow = {
  id?: unknown;
  codigo?: unknown;
  nombre?: unknown;
  descripcion?: unknown;
  palabras_clave?: unknown;
  ejemplos?: unknown;
  requisitos?: unknown;
  es_general?: unknown;
  activo?: unknown;
  prioridad?: unknown;
  origen?: unknown;
};

const REQUISITOS_GENERALES: RequisitoDocumentoContexto[] = [
  {
    codigo: "SOLICITUD",
    nombre: "Solicitud",
    descripcion: "Solicitud que da origen al trámite de pago.",
  },
  {
    codigo: "LIQUIDACION",
    nombre: "Liquidación",
    descripcion: "Liquidación o soporte de cierre de la obligación.",
  },
];

export const CONTEXTOS_DOCUMENTALES_CXP_INICIALES: ContextoDocumentalCxp[] = [
  {
    id: null,
    codigo: "GENERAL",
    nombre: "Requisitos generales",
    descripcion:
      "Respaldo general para cuentas por pagar que todavía no tienen una regla específica.",
    palabrasClave: [],
    ejemplos: [],
    requisitos: REQUISITOS_GENERALES,
    esGeneral: true,
    activo: true,
    prioridad: 0,
    origen: "SISTEMA",
  },
  {
    id: null,
    codigo: "MEDICAMENTOS_CLINICA_MUNICIPAL",
    nombre: "Medicamentos para clínica municipal",
    descripcion:
      "Compra de medicamentos, insumos médicos o productos farmacéuticos destinados a la clínica municipal.",
    palabrasClave: [
      "medicamento",
      "medicamentos",
      "clínica municipal",
      "insumo médico",
      "productos farmacéuticos",
    ],
    ejemplos: ["Compra de medicamentos para la clínica municipal"],
    requisitos: [
      REQUISITOS_GENERALES[0],
      {
        codigo: "ACTA_ENTREGA",
        nombre: "Acta de entrega",
        descripcion: "Constancia de recepción y entrega de los medicamentos.",
      },
    ],
    esGeneral: false,
    activo: true,
    prioridad: 100,
    origen: "SISTEMA",
  },
  {
    id: null,
    codigo: "MATERIALES_PROYECTO",
    nombre: "Materiales para proyecto",
    descripcion:
      "Compra de materiales, suministros o insumos que serán utilizados en un proyecto municipal.",
    palabrasClave: [
      "materiales para proyecto",
      "materiales del proyecto",
      "insumos para proyecto",
      "obra municipal",
    ],
    ejemplos: ["Compra de materiales para un proyecto"],
    requisitos: [
      {
        codigo: "REQUISICION_MATERIALES",
        nombre: "Requisición de materiales",
        descripcion: "Detalle de los materiales requeridos por el proyecto.",
      },
      {
        codigo: "PERFIL_PROYECTO",
        nombre: "Perfil de proyecto",
        descripcion: "Perfil técnico o ficha que sustenta el proyecto.",
      },
    ],
    esGeneral: false,
    activo: true,
    prioridad: 100,
    origen: "SISTEMA",
  },
  {
    id: null,
    codigo: "ALIMENTACION_ACTIVIDAD_INTERNA",
    nombre: "Alimentación para actividad interna",
    descripcion:
      "Compra de alimentos, refrigerios o alimentación para reuniones y actividades internas municipales.",
    palabrasClave: [
      "alimentación",
      "alimentos",
      "refrigerios",
      "actividad interna",
      "reunión interna",
    ],
    ejemplos: ["Compra de alimentación para actividades internas"],
    requisitos: [
      {
        codigo: "MEMORANDUM_ALCALDE",
        nombre: "Memorándum del alcalde",
        descripcion: "Memorándum que autoriza o justifica la actividad.",
      },
      REQUISITOS_GENERALES[0],
      {
        codigo: "LISTADO_ASISTENCIA",
        nombre: "Listado de asistencia",
        descripcion: "Listado de las personas que participaron en la actividad.",
      },
    ],
    esGeneral: false,
    activo: true,
    prioridad: 100,
    origen: "SISTEMA",
  },
  {
    id: null,
    codigo: "CONTRATO",
    nombre: "Contrato",
    descripcion:
      "Pago originado en un contrato de obra, bienes, servicios profesionales u otra relación contractual.",
    palabrasClave: [
      "contrato",
      "contratación",
      "servicios profesionales",
      "contratista",
    ],
    ejemplos: ["Pago de contrato por servicios profesionales"],
    requisitos: [
      {
        codigo: "SOLICITUD_CONTRATO",
        nombre: "Solicitud de contrato",
        descripcion: "Solicitud formal que da inicio a la contratación.",
      },
      REQUISITOS_GENERALES[1],
      {
        codigo: "PERFIL",
        nombre: "Perfil",
        descripcion: "Perfil o alcance que sustenta la contratación.",
      },
    ],
    esGeneral: false,
    activo: true,
    prioridad: 100,
    origen: "SISTEMA",
  },
  {
    id: null,
    codigo: "PASIVO_LABORAL",
    nombre: "Pasivo laboral",
    descripcion:
      "Pago de prestaciones, derechos o liquidación laboral por terminación de una relación de trabajo.",
    palabrasClave: [
      "pasivo laboral",
      "prestaciones laborales",
      "finiquito",
      "renuncia",
      "despido",
      "cesantía",
    ],
    ejemplos: ["Pago de pasivo laboral por renuncia de empleado municipal"],
    requisitos: [
      {
        codigo: "CALCULO_PRESTACIONES",
        nombre: "Cálculo de prestaciones",
        descripcion: "Cálculo detallado de las prestaciones laborales.",
      },
      {
        codigo: "NOTA_RECURSOS_HUMANOS",
        nombre: "Nota de Recursos Humanos",
        descripcion: "Nota emitida por Recursos Humanos que sustenta el trámite.",
      },
      {
        codigo: "FINIQUITO",
        nombre: "Finiquito",
        descripcion: "Documento de finiquito de la relación laboral.",
      },
      {
        codigo: "RENUNCIA_O_DESPIDO",
        nombre: "Renuncia o constancia de despido",
        descripcion:
          "Documento que acredita la renuncia o la decisión de despido, según corresponda.",
      },
    ],
    esGeneral: false,
    activo: true,
    prioridad: 100,
    origen: "SISTEMA",
  },
];

export function esDescripcionCuentaPorPagarNula(value: unknown) {
  return typeof value === "string" && value.trim().toUpperCase() === "NULA";
}

export function crearCodigoCatalogo(value: string) {
  return normalizarTexto(value)
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

export function normalizarContextoDocumentalCxp(
  row: ContextoDocumentalCxpRow
): ContextoDocumentalCxp | null {
  const codigo = crearCodigoCatalogo(String(row.codigo ?? ""));
  const nombre = String(row.nombre ?? "").trim();
  const requisitos = normalizarRequisitos(row.requisitos);

  if (!codigo || !nombre || requisitos.length === 0) return null;

  const origen = String(row.origen ?? "USUARIO").toUpperCase();

  return {
    id: row.id ? String(row.id) : null,
    codigo,
    nombre,
    descripcion: String(row.descripcion ?? "").trim(),
    palabrasClave: normalizarListaTextos(row.palabras_clave),
    ejemplos: normalizarListaTextos(row.ejemplos),
    requisitos,
    esGeneral: row.es_general === true,
    activo: row.activo !== false,
    prioridad: Number.isFinite(Number(row.prioridad))
      ? Number(row.prioridad)
      : 0,
    origen:
      origen === "SISTEMA" ||
      origen === "IA_REVISADA" ||
      origen === "USUARIO"
        ? origen
        : "USUARIO",
  };
}

export function resolverRequisitosContextos(
  contextos: ContextoDocumentalCxp[],
  codigosSeleccionados: string[]
) {
  const codigos = new Set(codigosSeleccionados.map(crearCodigoCatalogo));
  let seleccionados = contextos.filter(
    (contexto) => contexto.activo && codigos.has(contexto.codigo)
  );
  const especificos = seleccionados.filter((contexto) => !contexto.esGeneral);

  if (especificos.length > 0) {
    seleccionados = especificos;
  }

  if (seleccionados.length === 0) {
    const general = obtenerContextoGeneral(contextos);
    seleccionados = general ? [general] : [];
  }

  const requisitos = new Map<string, RequisitoDocumentoContexto>();

  seleccionados.forEach((contexto) => {
    contexto.requisitos.forEach((requisito) => {
      requisitos.set(requisito.codigo, requisito);
    });
  });

  return {
    contextos: seleccionados,
    requisitos: Array.from(requisitos.values()),
  };
}

export function detectarContextosPorReglas(
  descripcion: string,
  contextos: ContextoDocumentalCxp[]
) {
  const texto = normalizarTexto(descripcion);
  const tokens = new Set(texto.split(/\s+/).filter((token) => token.length >= 4));

  const puntuados = contextos
    .filter((contexto) => contexto.activo && !contexto.esGeneral)
    .map((contexto) => {
      const coincidencias = contexto.palabrasClave.reduce((total, palabra) => {
        const clave = normalizarTexto(palabra);
        return total + (clave && texto.includes(clave) ? 3 : 0);
      }, 0);
      const vocabulario = normalizarTexto(
        [contexto.nombre, contexto.descripcion, ...contexto.ejemplos].join(" ")
      )
        .split(/\s+/)
        .filter((token) => token.length >= 5);
      const coincidenciasSemanticas = new Set(vocabulario).size
        ? vocabulario.filter((token) => tokens.has(token)).length
        : 0;

      return {
        codigo: contexto.codigo,
        puntuacion: coincidencias + coincidenciasSemanticas,
      };
    })
    .filter((item) => item.puntuacion >= 3)
    .sort((a, b) => b.puntuacion - a.puntuacion)
    .slice(0, 3);

  if (puntuados.length === 0) {
    return [obtenerContextoGeneral(contextos)?.codigo ?? "GENERAL"];
  }

  const mayor = puntuados[0].puntuacion;
  return puntuados
    .filter((item) => item.puntuacion >= Math.max(3, mayor - 2))
    .map((item) => item.codigo);
}

function obtenerContextoGeneral(contextos: ContextoDocumentalCxp[]) {
  return (
    contextos.find((contexto) => contexto.activo && contexto.esGeneral) ??
    CONTEXTOS_DOCUMENTALES_CXP_INICIALES[0]
  );
}

function normalizarRequisitos(value: unknown) {
  if (!Array.isArray(value)) return [];

  const requisitos = new Map<string, RequisitoDocumentoContexto>();

  value.forEach((item) => {
    if (!item || typeof item !== "object") return;

    const row = item as Record<string, unknown>;
    const nombre = String(row.nombre ?? "").trim();
    const codigo = crearCodigoCatalogo(String(row.codigo ?? nombre));

    if (!codigo || !nombre) return;

    requisitos.set(codigo, {
      codigo,
      nombre,
      descripcion: String(row.descripcion ?? "").trim(),
    });
  });

  return Array.from(requisitos.values());
}

function normalizarListaTextos(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, 50);
}

function normalizarTexto(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
}
