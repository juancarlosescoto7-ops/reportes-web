export type CategoriaBusquedaUniversal =
  | "modulo"
  | "accion"
  | "egreso"
  | "cuenta-por-pagar"
  | "documento-pendiente"
  | "orden-de-pago"
  | "presupuesto"
  | "ingreso";

export type ResultadoBusquedaUniversal = {
  id: string;
  categoria: CategoriaBusquedaUniversal;
  categoriaLabel: string;
  titulo: string;
  subtitulo: string;
  descripcion: string;
  metadatos: string[];
  estado?: string;
  fecha?: string | null;
  monto?: number | null;
  metricas?: Record<string, number | null>;
  href: string;
  textoBusqueda: string;
};

type OrdenFuente = {
  orden_pago_id?: number;
  no_orden: string;
  fecha: string;
  descripcion: string;
  total_haber: number;
  total_ejecutado: number;
  diferencia: number;
  beneficiarios: Array<{
    id: string;
    nombre: string;
    no_cheque: string;
    haber: number;
    ejecuciones: Array<{
      codigo_presupuestario: string;
      actividad_id?: string | null;
      obra_id?: string | null;
      proyecto_id?: string | null;
      monto_ejecutado: number;
    }>;
  }>;
};

type CxpFuente = {
  cxp_id: number;
  fecha: string | null;
  descripcion: string | null;
  no_cxp: number;
  tipo_movimiento: string | null;
  cuenta: string | null;
  beneficiario_id: string | null;
  beneficiario_nombre: string;
  estado_administrativo: string;
  estado_operativo: string;
  haber: number;
  debe?: number;
  monto_comprometido: number;
  saldo_por_comprometer: number;
  no_orden_pago: number | null;
  monto_pagado: number;
  monto_ejecutado_presupuestario: number;
  saldo_por_ejecutar: number;
  recomendacion_financiera?: string | null;
  codigos_recomendacion_financiera?: string | null;
  detalle_codigos?: Array<{
    codigo_presupuestario?: string | null;
  }>;
};

type DocumentoPendienteFuente = {
  documentoId: string;
  noOrden: number;
  nombreDocumento: string;
  observacion: string | null;
  fechaRegistro: string;
  usuarioRegistro: string | null;
  fechaOrden: string | null;
  descripcionOrden: string | null;
  totalEgreso: number;
};

type OrdenDocumentalFuente = {
  noOrden: number;
  fecha: string | null;
  descripcion: string;
  nombreDocumento: string | null;
  rutaDocumento: string | null;
  tieneDocumento: boolean;
};

type IngresoFuente = {
  id_arqueo?: string | number | null;
  id_deposito?: string | number | null;
  fecha_arqueo?: string | null;
  fecha: string | null;
  descripcion: string | null;
  total: number | null;
  bloque: number | null;
  fecha_deposito: string | null;
  monto: number | null;
  tipo_ingreso: string | null;
  cuenta: string | null;
};

type CompraPagadaFuente = {
  noOrdenPago: number;
  noOrdenCompra: number;
  tipoMovimiento: string;
  montoPago: number;
};

export type FuentesBusquedaUniversal = {
  ordenes?: OrdenFuente[];
  cuentasPorPagar?: CxpFuente[];
  documentosPendientes?: DocumentoPendienteFuente[];
  ordenesDocumentales?: OrdenDocumentalFuente[];
  ingresos?: IngresoFuente[];
  comprasPagadas?: CompraPagadaFuente[];
  presupuesto?: Record<string, unknown>[];
};

const ETIQUETAS: Record<CategoriaBusquedaUniversal, string> = {
  modulo: "Módulos del sistema",
  accion: "Acciones y funciones",
  egreso: "Egresos",
  "cuenta-por-pagar": "Cuentas por pagar",
  "documento-pendiente": "Documentos pendientes",
  "orden-de-pago": "Órdenes de pago y archivos",
  presupuesto: "Presupuesto",
  ingreso: "Ingresos",
};

export type ContextoCatalogoNavegacion = {
  permisos: readonly string[];
  rolCodigo?: string | null;
  nombreUsuario?: string | null;
};

type EntradaCatalogoNavegacion = {
  id: string;
  categoria: "modulo" | "accion";
  titulo: string;
  subtitulo: string;
  descripcion: string;
  href: string;
  terminos: string[];
  permisoCodigo?: string;
  rolesCodigo?: readonly string[];
  accesoOficinaMujer?: boolean;
};

const ROLES_ARQUEOS = ["TESORERIA", "PRESUPUESTO", "ADMIN"] as const;
const ROLES_AUDITORIA = ["AUDITORIA", "ADMIN", "PRESUPUESTO"] as const;
const ROLES_OFICINA_MUJER = [
  "OFICINA_MUJER",
  "PRESUPUESTO",
  "ADMINISTRADOR",
  "ADMIN",
] as const;

const CATALOGO_NAVEGACION: EntradaCatalogoNavegacion[] = [
  {
    id: "inicio",
    categoria: "modulo",
    titulo: "Inicio",
    subtitulo: "Panel principal",
    descripcion: "Abre el tablero general del sistema.",
    href: "/",
    terminos: ["dashboard", "tablero", "principal", "home", "ruta inicio"],
    permisoCodigo: "VER_DASHBOARD",
  },
  {
    id: "egresos",
    categoria: "modulo",
    titulo: "Egresos",
    subtitulo: "Módulo de egresos",
    descripcion: "Consulta órdenes de pago, beneficiarios, cheques y ejecución presupuestaria.",
    href: "/reportes/ordenes-de-pago",
    terminos: [
      "gastos",
      "pagos",
      "ordenes de pago",
      "reporte egresos",
      "EgresosReport",
      "/reportes/ordenes-de-pago",
    ],
    permisoCodigo: "VER_EGRESOS",
  },
  {
    id: "nuevo-egreso",
    categoria: "accion",
    titulo: "Nuevo egreso",
    subtitulo: "Registrar un egreso",
    descripcion: "Abre directamente el formulario de Nuevo egreso.",
    href: "/reportes/ordenes-de-pago?accion=nuevo-egreso",
    terminos: [
      "crear egreso",
      "agregar egreso",
      "registrar pago",
      "formulario nuevo egreso",
      "NuevoEgresoModal",
    ],
    permisoCodigo: "VER_EGRESOS",
  },
  {
    id: "pantalla-compartida",
    categoria: "modulo",
    titulo: "Pantalla compartida",
    subtitulo: "Egresos y compromisos en una sola vista",
    descripcion: "Abre la vista operativa compartida de Tesorería y Presupuesto.",
    href: "/reportes/pantalla-compartida",
    terminos: ["vista compartida", "tesoreria presupuesto", "monitor"],
    permisoCodigo: "VER_EGRESOS",
  },
  {
    id: "presupuesto",
    categoria: "modulo",
    titulo: "Presupuesto",
    subtitulo: "Explorador presupuestario",
    descripcion: "Consulta programas, actividades, obras, objetos y ejecución del presupuesto.",
    href: "/reportes/presupuesto",
    terminos: [
      "partidas",
      "programas",
      "actividades",
      "obras",
      "objetos del gasto",
      "PresupuestoExplorer",
      "/reportes/presupuesto",
    ],
    permisoCodigo: "VER_PRESUPUESTO",
  },
  {
    id: "modificaciones-presupuesto",
    categoria: "accion",
    titulo: "Modificaciones presupuestarias",
    subtitulo: "Gestionar modificaciones del presupuesto",
    descripcion: "Abre el módulo de presupuesto y sus herramientas de modificación.",
    href: "/reportes/presupuesto",
    terminos: ["modificar presupuesto", "traslado", "ampliacion", "disminucion"],
    permisoCodigo: "VER_PRESUPUESTO",
  },
  {
    id: "compromisos",
    categoria: "modulo",
    titulo: "Compromisos",
    subtitulo: "Cuentas por pagar",
    descripcion: "Consulta compromisos presupuestarios, saldos y cuentas por pagar.",
    href: "/reportes/compromisos-presupuestarios",
    terminos: [
      "cxp",
      "cuentas por pagar",
      "deudas",
      "CXPDashboard",
      "/reportes/compromisos-presupuestarios",
    ],
    permisoCodigo: "VER_COMPROMISOS",
  },
  {
    id: "nueva-cxp",
    categoria: "accion",
    titulo: "Nueva cuenta por pagar",
    subtitulo: "Registrar una CxP",
    descripcion: "Abre directamente el formulario de Nueva CxP.",
    href: "/reportes/compromisos-presupuestarios?accion=nueva-cxp",
    terminos: [
      "nueva cxp",
      "crear cxp",
      "crear cuenta por pagar",
      "formulario cuenta por pagar",
      "FormCrearCuentaPorPagar",
    ],
    permisoCodigo: "VER_COMPROMISOS",
  },
  {
    id: "proyectos",
    categoria: "modulo",
    titulo: "Proyectos",
    subtitulo: "Control documental de proyectos",
    descripcion: "Consulta proyectos, requisitos, órdenes y expedientes documentales.",
    href: "/controles/proyectos",
    terminos: ["expedientes", "documentos proyectos", "DocumentacionProyectos"],
    permisoCodigo: "VER_PROYECTOS",
  },
  {
    id: "nuevo-proyecto",
    categoria: "accion",
    titulo: "Nuevo proyecto",
    subtitulo: "Crear un proyecto",
    descripcion: "Abre directamente el formulario para crear un proyecto.",
    href: "/controles/proyectos?accion=nuevo-proyecto",
    terminos: ["crear proyecto", "agregar proyecto", "CrearProyectoModal"],
    permisoCodigo: "VER_PROYECTOS",
  },
  {
    id: "ordenes-pago-documentos",
    categoria: "modulo",
    titulo: "Órdenes de pago",
    subtitulo: "Control de archivos de órdenes",
    descripcion: "Consulta el estado documental y los PDF de las órdenes de pago.",
    href: "/controles/ordenes-pago",
    terminos: ["documentos", "archivos", "pdf", "DocumentacionOrdenesPago"],
    permisoCodigo: "VER_ORDENES-PAGO",
  },
  {
    id: "cargar-pdf-orden",
    categoria: "accion",
    titulo: "Cargar PDF de orden de pago",
    subtitulo: "Adjuntar archivo a una orden",
    descripcion: "Abre el control documental para seleccionar una orden y cargar su PDF.",
    href: "/controles/ordenes-pago?accion=cargar-pdf",
    terminos: ["subir pdf", "adjuntar documento", "archivo orden", "escanear orden"],
    permisoCodigo: "VER_ORDENES-PAGO",
  },
  {
    id: "ingresos",
    categoria: "modulo",
    titulo: "Ingresos",
    subtitulo: "Reporte y control de ingresos",
    descripcion: "Consulta depósitos, arqueos, recaudación y cuentas de ingreso.",
    href: "/ingresos",
    terminos: ["depositos", "recaudacion", "IngresosReport", "corregir ingreso"],
    permisoCodigo: "VER_INGRESOS",
  },
  {
    id: "arqueos",
    categoria: "modulo",
    titulo: "Arqueos",
    subtitulo: "Arqueos de ingresos",
    descripcion: "Registra y consulta el arqueo diario de ingresos.",
    href: "/arqueos",
    terminos: ["caja", "arqueo diario", "AsistenteArqueo"],
    permisoCodigo: "VER_ARQUEOS",
    rolesCodigo: ROLES_ARQUEOS,
  },
  {
    id: "nuevo-arqueo",
    categoria: "accion",
    titulo: "Nuevo arqueo",
    subtitulo: "Registrar un arqueo de ingresos",
    descripcion: "Abre el asistente para iniciar un nuevo arqueo.",
    href: "/arqueos",
    terminos: ["crear arqueo", "registrar arqueo", "iniciar arqueo"],
    permisoCodigo: "VER_ARQUEOS",
    rolesCodigo: ROLES_ARQUEOS,
  },
  {
    id: "conversor-saft-sami",
    categoria: "modulo",
    titulo: "Conversor SAFT–SAMI",
    subtitulo: "Conversión de archivos de ingresos",
    descripcion: "Convierte archivos entre los formatos SAFT y SAMI.",
    href: "/conversor-sami-saft",
    terminos: ["convertir archivo", "excel", "saft", "sami", "ConversorSamiSaft"],
    permisoCodigo: "VER_ARQUEOS",
    rolesCodigo: ROLES_ARQUEOS,
  },
  {
    id: "auditoria",
    categoria: "modulo",
    titulo: "Auditoría",
    subtitulo: "Auditoría de egresos",
    descripcion: "Consulta trazabilidad, cambios y evidencia documental de los egresos.",
    href: "/auditoria",
    terminos: ["revision", "trazabilidad", "control", "AuditoriaEgresos"],
    rolesCodigo: ROLES_AUDITORIA,
  },
  {
    id: "oficina-mujer",
    categoria: "modulo",
    titulo: "Oficina de la Mujer",
    subtitulo: "Reporte presupuestario especializado",
    descripcion: "Abre el reporte de presupuesto de la Oficina de la Mujer.",
    href: "/reportes/oficina-mujer",
    terminos: ["mujer", "equidad", "reporte oficina mujer"],
    accesoOficinaMujer: true,
  },
];

export function construirIndiceNavegacion(
  contexto: ContextoCatalogoNavegacion
): ResultadoBusquedaUniversal[] {
  return CATALOGO_NAVEGACION.filter((entrada) =>
    puedeAccederEntrada(entrada, contexto)
  ).map((entrada) =>
    crearResultado({
      id: `navegacion:${entrada.id}`,
      categoria: entrada.categoria,
      titulo: entrada.titulo,
      subtitulo: entrada.subtitulo,
      descripcion: entrada.descripcion,
      metadatos: [entrada.categoria === "modulo" ? "Abrir módulo" : "Ejecutar acción"],
      href: entrada.href,
      terminos: [...entrada.terminos, entrada.href],
    })
  );
}

function puedeAccederEntrada(
  entrada: EntradaCatalogoNavegacion,
  contexto: ContextoCatalogoNavegacion
) {
  const rol = normalizarIdentificadorAcceso(contexto.rolCodigo);
  const usuario = normalizarIdentificadorAcceso(contexto.nombreUsuario);
  const porPermiso = Boolean(
    entrada.permisoCodigo && contexto.permisos.includes(entrada.permisoCodigo)
  );
  const porRol = Boolean(
    entrada.rolesCodigo?.some(
      (rolPermitido) => normalizarIdentificadorAcceso(rolPermitido) === rol
    )
  );
  const porOficinaMujer = Boolean(
    entrada.accesoOficinaMujer &&
      (ROLES_OFICINA_MUJER.includes(
        rol as (typeof ROLES_OFICINA_MUJER)[number]
      ) || usuario === "OFICINA_MUJER")
  );

  return porPermiso || porRol || porOficinaMujer;
}

function normalizarIdentificadorAcceso(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

type PresupuestoRelacionado = {
  id: string;
  codigo: string;
  actividadId: string;
  obraId: string;
  proyectoId: string;
  titulo: string;
  ruta: string;
  contexto: string;
  terminos: unknown[];
  row: Record<string, unknown>;
};

const MESES = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

const PALABRAS_CONSULTA = new Set([
  "a",
  "al",
  "algo",
  "con",
  "comprometido",
  "comprometida",
  "cual",
  "cuales",
  "cuanto",
  "cuantos",
  "cuenta",
  "cuentas",
  "dato",
  "datos",
  "de",
  "del",
  "documento",
  "documentos",
  "disponible",
  "ejecutado",
  "egreso",
  "egresos",
  "el",
  "en",
  "es",
  "esta",
  "estan",
  "hay",
  "ha",
  "ingreso",
  "ingresos",
  "inicial",
  "la",
  "las",
  "lo",
  "los",
  "me",
  "mostrar",
  "monto",
  "muestrame",
  "necesito",
  "orden",
  "ordenes",
  "pagar",
  "para",
  "por",
  "presupuesto",
  "presupuestario",
  "presupuestaria",
  "que",
  "quiero",
  "relacionado",
  "relacionada",
  "saber",
  "saldo",
  "se",
  "sobre",
  "tenemos",
  "todo",
  "un",
  "una",
  "vigente",
]);

export function normalizarBusqueda(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function extraerTemaConsulta(pregunta: string) {
  return normalizarBusqueda(pregunta)
    .replace(/[^a-z0-9ñ./-]+/g, " ")
    .split(" ")
    .filter((parte) => parte.length > 1 && !PALABRAS_CONSULTA.has(parte))
    .join(" ")
    .trim();
}

export function construirIndiceBusquedaUniversal(
  fuentes: FuentesBusquedaUniversal
): ResultadoBusquedaUniversal[] {
  const ordenes = fuentes.ordenes ?? [];
  const ordenesPorNumero = new Map(
    ordenes.map((orden) => [Number(orden.no_orden), orden])
  );
  const comprasPorOrden = agruparPor(
    fuentes.comprasPagadas ?? [],
    (compra) => compra.noOrdenPago
  );
  const presupuestoRelacionado = construirRelacionesPresupuesto(
    fuentes.presupuesto ?? []
  );
  const presupuestoPorCodigo = agruparPor(
    presupuestoRelacionado,
    (item) => item.codigo
  );
  const resultados: ResultadoBusquedaUniversal[] = [];

  presupuestoRelacionado.forEach((item) => {
    const inicial = obtenerNumero(item.row.presupuesto_inicial);
    const vigente = obtenerNumero(item.row.presupuesto_vigente);
    const ejecutado = obtenerNumero(item.row.ejecutado);
    const comprometido = obtenerNumero(
      item.row.comprometido ??
        item.row.total_comprometido ??
        item.row.saldo_comprometido ??
        item.row.monto_comprometido
    );
    const disponible =
      vigente === null
        ? null
        : vigente - (ejecutado ?? 0) - (comprometido ?? 0);

    resultados.push(
      crearResultado({
        id: `presupuesto-${item.id}`,
        categoria: "presupuesto",
        titulo: item.titulo,
        subtitulo: item.ruta || "Estructura presupuestaria",
        descripcion: item.contexto || "Partida del presupuesto municipal",
        metadatos: compactar([
          textoDato(item.row.fuente, "Fuente"),
          textoDato(item.row.tipo_inversion, "Inversión"),
          inicial === null ? null : `Inicial ${formatearMonto(inicial)}`,
          vigente === null ? null : `Vigente ${formatearMonto(vigente)}`,
          ejecutado === null ? null : `Ejecutado ${formatearMonto(ejecutado)}`,
          comprometido === null
            ? null
            : `Comprometido ${formatearMonto(comprometido)}`,
          disponible === null
            ? null
            : `Disponible ${formatearMonto(disponible)}`,
        ]),
        estado: "Presupuesto vigente",
        fecha: null,
        monto: vigente,
        metricas: {
          presupuesto_inicial: inicial,
          presupuesto_vigente: vigente,
          ejecutado,
          comprometido,
          disponible,
        },
        href: crearHref("/reportes/presupuesto", { buscar: item.codigo }),
        terminos: [
          "presupuesto partida renglon programa subprograma proyecto actividad obra",
          ...item.terminos,
          ...[
            item.row.presupuesto_inicial,
            item.row.ampliacion,
            item.row.disminucion,
            item.row.presupuesto_vigente,
            item.row.ejecutado,
            item.row.comprometido,
            item.row.total_comprometido,
          ].flatMap(variantesMonto),
        ],
      })
    );
  });

  ordenes.forEach((orden) => {
    const numeroOrden = Number(orden.no_orden);
    const beneficiarios = orden.beneficiarios
      .map((beneficiario) => beneficiario.nombre)
      .filter(Boolean);
    const compras = comprasPorOrden.get(numeroOrden) ?? [];
    const rutasPresupuesto = obtenerPresupuestoDeOrden(
      orden,
      presupuestoPorCodigo
    );
    const terminosBeneficiarios = orden.beneficiarios.flatMap((beneficiario) => [
      beneficiario.id,
      beneficiario.nombre,
      beneficiario.no_cheque,
      ...variantesMonto(beneficiario.haber),
      ...beneficiario.ejecuciones.flatMap((ejecucion) => [
        ejecucion.codigo_presupuestario,
        ...variantesMonto(ejecucion.monto_ejecutado),
      ]),
    ]);

    resultados.push(
      crearResultado({
        id: `egreso-${orden.no_orden}`,
        categoria: "egreso",
        titulo: `Orden de pago #${orden.no_orden}`,
        subtitulo:
          beneficiarios.join(", ") || "Beneficiario no identificado",
        descripcion: orden.descripcion || "Sin descripción",
        metadatos: compactar([
          formatearFecha(orden.fecha),
          formatearMonto(orden.total_haber),
          `${orden.beneficiarios.length} beneficiario(s)`,
          rutasPresupuesto[0]?.ruta || null,
        ]),
        estado: "Egreso registrado",
        fecha: orden.fecha,
        monto: orden.total_haber,
        metricas: {
          total_egreso: orden.total_haber,
          total_ejecutado: orden.total_ejecutado,
          diferencia: orden.diferencia,
        },
        href: crearHref("/reportes/ordenes-de-pago", {
          orden: orden.no_orden,
        }),
        terminos: [
          "egreso orden pago cheque beneficiario proveedor",
          orden.no_orden,
          orden.orden_pago_id,
          orden.descripcion,
          ...variantesFecha(orden.fecha),
          ...variantesMonto(orden.total_haber),
          ...variantesMonto(orden.total_ejecutado),
          ...variantesMonto(orden.diferencia),
          ...terminosBeneficiarios,
          ...rutasPresupuesto.flatMap((item) => item.terminos),
          ...compras.flatMap((compra) => [
            compra.noOrdenCompra,
            compra.tipoMovimiento,
            ...variantesMonto(compra.montoPago),
          ]),
        ],
      })
    );
  });

  (fuentes.cuentasPorPagar ?? []).forEach((cxp) => {
    const rutasPresupuesto = obtenerPresupuestoDeCxp(
      cxp,
      ordenesPorNumero,
      presupuestoPorCodigo
    );

    resultados.push(
      crearResultado({
        id: `cxp-${cxp.cxp_id}`,
        categoria: "cuenta-por-pagar",
        titulo: `Cuenta por pagar #${cxp.no_cxp}`,
        subtitulo: cxp.beneficiario_nombre || "Proveedor no identificado",
        descripcion: cxp.descripcion || "Sin descripción",
        metadatos: compactar([
          formatearFecha(cxp.fecha),
          formatearMonto(cxp.haber),
          cxp.no_orden_pago ? `Orden #${cxp.no_orden_pago}` : null,
          rutasPresupuesto[0]?.ruta || null,
        ]),
        estado: cxp.estado_administrativo || cxp.estado_operativo,
        fecha: cxp.fecha,
        monto: cxp.haber,
        metricas: {
          obligacion: cxp.haber,
          pagado: cxp.monto_pagado,
          comprometido: cxp.monto_comprometido,
          saldo_por_comprometer: cxp.saldo_por_comprometer,
          saldo_por_ejecutar: cxp.saldo_por_ejecutar,
        },
        href: crearHref("/reportes/compromisos-presupuestarios", {
          cxp: cxp.cxp_id,
        }),
        terminos: [
          "cuenta por pagar cxp proveedor beneficiario compromiso",
          cxp.cxp_id,
          cxp.no_cxp,
          cxp.tipo_movimiento,
          cxp.cuenta,
          cxp.beneficiario_id,
          cxp.beneficiario_nombre,
          cxp.descripcion,
          cxp.estado_administrativo,
          cxp.estado_operativo,
          cxp.no_orden_pago,
          cxp.recomendacion_financiera,
          cxp.codigos_recomendacion_financiera,
          ...rutasPresupuesto.flatMap((item) => item.terminos),
          ...variantesFecha(cxp.fecha),
          ...[
            cxp.haber,
            cxp.debe,
            cxp.monto_comprometido,
            cxp.saldo_por_comprometer,
            cxp.monto_pagado,
            cxp.monto_ejecutado_presupuestario,
            cxp.saldo_por_ejecutar,
          ].flatMap(variantesMonto),
        ],
      })
    );
  });

  (fuentes.documentosPendientes ?? []).forEach((documento) => {
    const orden = ordenesPorNumero.get(documento.noOrden);
    const nombres = nombresBeneficiarios(orden);
    const rutasPresupuesto = orden
      ? obtenerPresupuestoDeOrden(orden, presupuestoPorCodigo)
      : [];

    resultados.push(
      crearResultado({
        id: `documento-pendiente-${documento.documentoId}`,
        categoria: "documento-pendiente",
        titulo: documento.nombreDocumento || "Documento pendiente",
        subtitulo: `Orden de pago #${documento.noOrden}`,
        descripcion:
          documento.observacion ||
          documento.descripcionOrden ||
          orden?.descripcion ||
          "Sin observación",
        metadatos: compactar([
          formatearFecha(documento.fechaOrden ?? documento.fechaRegistro),
          formatearMonto(documento.totalEgreso || orden?.total_haber),
          nombres || null,
          rutasPresupuesto[0]?.ruta || null,
        ]),
        estado: "Pendiente",
        fecha: documento.fechaOrden ?? documento.fechaRegistro,
        monto: documento.totalEgreso || orden?.total_haber || null,
        metricas: {
          total_egreso: documento.totalEgreso || orden?.total_haber || null,
        },
        href: crearHref("/reportes/ordenes-de-pago", {
          orden: documento.noOrden,
          documentos: documento.noOrden,
        }),
        terminos: [
          "documento requisito faltante pendiente orden pago archivo",
          documento.documentoId,
          documento.noOrden,
          documento.nombreDocumento,
          documento.observacion,
          documento.usuarioRegistro,
          documento.descripcionOrden,
          orden?.descripcion,
          nombres,
          ...rutasPresupuesto.flatMap((item) => item.terminos),
          ...variantesFecha(documento.fechaRegistro),
          ...variantesFecha(documento.fechaOrden),
          ...variantesMonto(documento.totalEgreso),
          ...variantesMonto(orden?.total_haber),
        ],
      })
    );
  });

  (fuentes.ordenesDocumentales ?? []).forEach((ordenDocumental) => {
    const orden = ordenesPorNumero.get(ordenDocumental.noOrden);
    const nombres = nombresBeneficiarios(orden);
    const rutasPresupuesto = orden
      ? obtenerPresupuestoDeOrden(orden, presupuestoPorCodigo)
      : [];
    const tieneDocumento = ordenDocumental.tieneDocumento;

    resultados.push(
      crearResultado({
        id: `orden-documental-${ordenDocumental.noOrden}`,
        categoria: "orden-de-pago",
        titulo: `Orden de pago #${ordenDocumental.noOrden}`,
        subtitulo: tieneDocumento
          ? ordenDocumental.nombreDocumento || "PDF disponible"
          : "Archivo pendiente de cargar",
        descripcion:
          ordenDocumental.descripcion || orden?.descripcion || "Sin descripción",
        metadatos: compactar([
          formatearFecha(ordenDocumental.fecha ?? orden?.fecha),
          formatearMonto(orden?.total_haber),
          nombres || null,
          rutasPresupuesto[0]?.ruta || null,
        ]),
        estado: tieneDocumento ? "Con archivo" : "Sin archivo",
        fecha: ordenDocumental.fecha ?? orden?.fecha ?? null,
        monto: orden?.total_haber ?? null,
        metricas: {
          total_egreso: orden?.total_haber ?? null,
        },
        href: crearHref("/controles/ordenes-pago", {
          orden: ordenDocumental.noOrden,
        }),
        terminos: [
          "orden pago archivo pdf documento",
          ordenDocumental.noOrden,
          ordenDocumental.descripcion,
          ordenDocumental.nombreDocumento,
          ordenDocumental.rutaDocumento,
          tieneDocumento ? "con archivo disponible cargado" : "sin archivo pendiente",
          orden?.descripcion,
          nombres,
          ...rutasPresupuesto.flatMap((item) => item.terminos),
          ...variantesFecha(ordenDocumental.fecha ?? orden?.fecha),
          ...variantesMonto(orden?.total_haber),
        ],
      })
    );
  });

  (fuentes.ingresos ?? []).forEach((ingreso, index) => {
    const identificador = ingreso.id_deposito ?? `fila-${index}`;
    const fecha = ingreso.fecha_deposito ?? ingreso.fecha_arqueo ?? ingreso.fecha;
    const monto = ingreso.monto ?? ingreso.total;

    resultados.push(
      crearResultado({
        id: `ingreso-${identificador}`,
        categoria: "ingreso",
        titulo: ingreso.tipo_ingreso || `Ingreso #${identificador}`,
        subtitulo: ingreso.cuenta || "Cuenta no indicada",
        descripcion: ingreso.descripcion || "Ingreso registrado",
        metadatos: compactar([
          formatearFecha(fecha),
          formatearMonto(monto),
          ingreso.id_arqueo ? `Arqueo ${ingreso.id_arqueo}` : null,
        ]),
        estado: "Ingreso registrado",
        fecha,
        monto,
        metricas: {
          monto_ingreso: ingreso.monto,
          total_arqueo: ingreso.total,
        },
        href: crearHref("/ingresos", {
          buscar: ingreso.id_deposito ?? fecha ?? ingreso.tipo_ingreso ?? "",
        }),
        terminos: [
          "ingreso deposito arqueo recaudacion cuenta",
          ingreso.id_arqueo,
          ingreso.id_deposito,
          ingreso.descripcion,
          ingreso.tipo_ingreso,
          ingreso.cuenta,
          ingreso.bloque,
          ...variantesFecha(ingreso.fecha),
          ...variantesFecha(ingreso.fecha_arqueo),
          ...variantesFecha(ingreso.fecha_deposito),
          ...variantesMonto(ingreso.monto),
          ...variantesMonto(ingreso.total),
        ],
      })
    );
  });

  return resultados;
}

export function buscarEnIndiceUniversal(
  indice: ResultadoBusquedaUniversal[],
  consulta: string,
  limite = 60
) {
  const termino = normalizarBusqueda(consulta);

  if (!termino) return [];

  const partes = termino.split(" ").filter(Boolean);

  return indice
    .map((resultado) => ({
      resultado,
      puntaje: puntuarResultado(resultado, termino, partes),
    }))
    .filter((item) => item.puntaje > 0)
    .sort((a, b) => {
      if (b.puntaje !== a.puntaje) return b.puntaje - a.puntaje;

      return String(b.resultado.fecha ?? "").localeCompare(
        String(a.resultado.fecha ?? "")
      );
    })
    .slice(0, limite)
    .map((item) => item.resultado);
}

export function agruparResultadosBusqueda(
  resultados: ResultadoBusquedaUniversal[]
) {
  const grupos = new Map<
    CategoriaBusquedaUniversal,
    ResultadoBusquedaUniversal[]
  >();

  resultados.forEach((resultado) => {
    const actuales = grupos.get(resultado.categoria) ?? [];
    grupos.set(resultado.categoria, [...actuales, resultado]);
  });

  return Array.from(grupos.entries()).map(([categoria, items]) => ({
    categoria,
    label: ETIQUETAS[categoria],
    items,
  }));
}

function crearResultado(input: Omit<ResultadoBusquedaUniversal, "categoriaLabel" | "textoBusqueda"> & {
  terminos: unknown[];
}): ResultadoBusquedaUniversal {
  return {
    id: input.id,
    categoria: input.categoria,
    categoriaLabel: ETIQUETAS[input.categoria],
    titulo: input.titulo,
    subtitulo: input.subtitulo,
    descripcion: input.descripcion,
    metadatos: input.metadatos,
    estado: input.estado,
    fecha: input.fecha,
    monto: input.monto,
    metricas: input.metricas,
    href: input.href,
    textoBusqueda: normalizarBusqueda(
      [input.titulo, input.subtitulo, input.descripcion, ...input.terminos]
        .filter((value) => value !== null && value !== undefined && value !== "")
        .join(" ")
    ),
  };
}

function puntuarResultado(
  resultado: ResultadoBusquedaUniversal,
  termino: string,
  partes: string[]
) {
  const titulo = normalizarBusqueda(resultado.titulo);
  const subtitulo = normalizarBusqueda(resultado.subtitulo);
  const descripcion = normalizarBusqueda(resultado.descripcion);
  const texto = resultado.textoBusqueda;

  if (!partes.every((parte) => texto.includes(parte))) return 0;
  if (titulo === termino) return 120;
  if (subtitulo === termino) return 110;
  if (titulo.startsWith(termino)) return 100;
  if (subtitulo.startsWith(termino)) return 90;
  if (titulo.includes(termino)) return 80;
  if (subtitulo.includes(termino)) return 70;
  if (descripcion.includes(termino)) return 60;
  if (texto.includes(termino)) return 50;

  return 30 + Math.min(partes.length, 10);
}

function construirRelacionesPresupuesto(rows: Record<string, unknown>[]) {
  return rows
    .map<PresupuestoRelacionado | null>((row, index) => {
      const codigo = primerTexto(row, ["codigo", "codigo_presupuestario"]);

      if (!codigo) return null;

      const programa = primerTexto(row, [
        "programa_nombre",
        "nombre_programa",
        "programa",
      ]);
      const subprograma = primerTexto(row, [
        "subprograma_nombre",
        "nombre_subprograma",
        "sub_programa_nombre",
        "subprograma",
        "sub_programa",
      ]);
      const proyecto = primerTexto(row, [
        "proyecto_nombre",
        "nombre_proyecto",
        "proyecto",
      ]);
      const actividad = primerTexto(row, [
        "actividad_nombre",
        "nombre_actividad",
        "actividad",
      ]);
      const obra = primerTexto(row, [
        "obra_nombre",
        "nombre_obra",
        "obra",
      ]);
      const objeto = primerTexto(row, ["objeto"]);
      const descripcionObjeto = primerTexto(row, ["descripcion_objeto"]);
      const contexto = primerTexto(row, ["contexto_cxp"]);
      const tituloRenglon = [objeto, descripcionObjeto]
        .filter(Boolean)
        .join(" - ");
      const ruta = [programa, subprograma, proyecto, actividad, obra]
        .filter(Boolean)
        .join(" › ");
      const actividadId = primerTexto(row, ["actividad_id", "actividad"]);
      const obraId = primerTexto(row, ["obra_id", "obra"]);
      const proyectoId = primerTexto(row, ["proyecto_id", "proyecto"]);

      return {
        id: [codigo, proyectoId, actividadId, obraId, index]
          .filter(Boolean)
          .join("-"),
        codigo,
        actividadId,
        obraId,
        proyectoId,
        titulo: tituloRenglon ? `${codigo} · ${tituloRenglon}` : codigo,
        ruta,
        contexto,
        terminos: [
          codigo,
          programa,
          subprograma,
          proyecto,
          actividad,
          obra,
          objeto,
          descripcionObjeto,
          contexto,
          row.programa_id,
          row.sub_programa_id,
          row.subprograma_id,
          row.proyecto_id,
          row.actividad_id,
          row.obra_id,
          row.ejercicio_fiscal,
          row.fuente,
          row.tipo_inversion,
        ],
        row,
      };
    })
    .filter((item): item is PresupuestoRelacionado => item !== null);
}

function obtenerPresupuestoDeOrden(
  orden: OrdenFuente,
  presupuestoPorCodigo: Map<string, PresupuestoRelacionado[]>
) {
  const relacionados = orden.beneficiarios.flatMap((beneficiario) =>
    beneficiario.ejecuciones.flatMap((ejecucion) => {
      const candidatos =
        presupuestoPorCodigo.get(String(ejecucion.codigo_presupuestario).trim()) ??
        [];

      if (candidatos.length <= 1) return candidatos;

      const puntajes = candidatos.map((item) => ({
        item,
        puntaje:
          puntuarCoincidenciaId(item.actividadId, ejecucion.actividad_id) +
          puntuarCoincidenciaId(item.obraId, ejecucion.obra_id) +
          puntuarCoincidenciaId(item.proyectoId, ejecucion.proyecto_id),
      }));
      const mejorPuntaje = Math.max(...puntajes.map((item) => item.puntaje));

      return mejorPuntaje > 0
        ? puntajes
            .filter((item) => item.puntaje === mejorPuntaje)
            .map((item) => item.item)
        : candidatos;
    })
  );

  return deduplicarPresupuesto(relacionados);
}

function obtenerPresupuestoDeCxp(
  cxp: CxpFuente,
  ordenesPorNumero: Map<number, OrdenFuente>,
  presupuestoPorCodigo: Map<string, PresupuestoRelacionado[]>
) {
  const relacionados: PresupuestoRelacionado[] = [];
  const orden = cxp.no_orden_pago
    ? ordenesPorNumero.get(Number(cxp.no_orden_pago))
    : undefined;

  if (orden) {
    relacionados.push(...obtenerPresupuestoDeOrden(orden, presupuestoPorCodigo));
  }

  const codigosDetalle = (cxp.detalle_codigos ?? [])
    .map((item) => String(item.codigo_presupuestario ?? "").trim())
    .filter(Boolean);
  codigosDetalle.forEach((codigo) => {
    relacionados.push(...(presupuestoPorCodigo.get(codigo) ?? []));
  });

  const codigosTexto = normalizarBusqueda(
    cxp.codigos_recomendacion_financiera ?? ""
  );

  if (codigosTexto) {
    presupuestoPorCodigo.forEach((items, codigo) => {
      if (codigosTexto.includes(normalizarBusqueda(codigo))) {
        relacionados.push(...items);
      }
    });
  }

  return deduplicarPresupuesto(relacionados);
}

function deduplicarPresupuesto(items: PresupuestoRelacionado[]) {
  return Array.from(new Map(items.map((item) => [item.id, item])).values());
}

function puntuarCoincidenciaId(
  presupuestoId: string,
  registroId: string | null | undefined
) {
  const esperado = normalizarBusqueda(registroId);

  if (!esperado) return 0;
  return normalizarBusqueda(presupuestoId) === esperado ? 1 : 0;
}

function primerTexto(row: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = String(row[key] ?? "").trim();
    if (value) return value;
  }

  return "";
}

function obtenerNumero(value: unknown) {
  if (value === null || value === undefined || value === "") return null;

  const numero = Number(String(value).replace(/L\.?/gi, "").replace(/,/g, ""));
  return Number.isFinite(numero) ? numero : null;
}

function textoDato(value: unknown, etiqueta: string) {
  const texto = String(value ?? "").trim();
  return texto ? `${etiqueta}: ${texto}` : null;
}

function variantesFecha(value: string | null | undefined): string[] {
  if (!value) return [];

  const texto = String(value).trim();
  const match = texto.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) return [texto];

  const [, year, month, day] = match;
  const mes = MESES[Number(month) - 1];

  return compactar([
    texto,
    `${year}-${month}-${day}`,
    `${day}/${month}/${year}`,
    `${day}-${month}-${year}`,
    `${day} de ${mes} de ${year}`,
    `${day} ${mes} ${year}`,
  ]);
}

function variantesMonto(value: unknown): string[] {
  const numero = Number(value);

  if (!Number.isFinite(numero)) return [];

  const fijo = numero.toFixed(2);
  const [entero, decimales] = fijo.split(".");
  const enteroMiles = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const enteroMilesEs = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

  return [
    String(numero),
    fijo,
    `${enteroMiles}.${decimales}`,
    `${enteroMilesEs},${decimales}`,
    `L ${enteroMiles}.${decimales}`,
    `L. ${enteroMiles}.${decimales}`,
  ];
}

function formatearFecha(value: string | null | undefined) {
  const variantes = variantesFecha(value);

  return variantes[2] ?? value ?? null;
}

function formatearMonto(value: unknown) {
  const numero = Number(value);

  if (!Number.isFinite(numero)) return null;

  return new Intl.NumberFormat("es-HN", {
    style: "currency",
    currency: "HNL",
    minimumFractionDigits: 2,
  }).format(numero);
}

function crearHref(
  ruta: string,
  params: Record<string, string | number | null | undefined>
) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") return;
    query.set(key, String(value));
  });

  const texto = query.toString();
  return texto ? `${ruta}?${texto}` : ruta;
}

function nombresBeneficiarios(orden: OrdenFuente | undefined) {
  return (
    orden?.beneficiarios
      .map((beneficiario) => beneficiario.nombre)
      .filter(Boolean)
      .join(", ") ?? ""
  );
}

function agruparPor<T, K>(items: T[], obtenerKey: (item: T) => K) {
  const grupos = new Map<K, T[]>();

  items.forEach((item) => {
    const key = obtenerKey(item);
    grupos.set(key, [...(grupos.get(key) ?? []), item]);
  });

  return grupos;
}

function compactar<T>(items: Array<T | null | undefined | "">): T[] {
  return items.filter((item): item is T => Boolean(item));
}
