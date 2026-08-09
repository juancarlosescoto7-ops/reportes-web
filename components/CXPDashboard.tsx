"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
} from "react";
import {
  actualizarCompromisoCXP,
  asignarCompromisoCXP,
  depurarCxPEstado,
  obtenerCXP,
  obtenerCompromisosCXP,
  procesarPagoMultipleCXPConCompromiso,
  type CXP,
  type CompromisoPresupuestarioCXP,
  type DepurarCxpAccion,
} from "@/services/cxp";
import SelectorPresupuestoTree, {
  type CodigoPresupuestarioSeleccionado,
  type PresupuestoNode,
} from "@/components/SelectorPresupuestoTree";
import { obtenerPresupuesto } from "@/services/presupuesto";
import {
  listarDocumentosCxp,
  subsanarDocumentoCxp,
  type DocumentoCxp,
} from "@/services/documentosCxp.service";
import { buildHierarchy } from "@/lib/buildHierarchy";
import FormCrearCuentaPorPagar from "@/components/FormCrearCuentaPorPagar";
import {
  compactarOpcionesPresupuesto,
  crearClaveCxp,
  esCxpCandidataParaRecomendacion,
  ordenarCuentasPorAntiguedad,
  prepararCxpParaRecomendacion,
  type OpcionPresupuestoSesion,
  type RecomendacionPresupuestoSesion,
} from "@/lib/recomendaciones-presupuesto-sesion";
import { generarRecomendacionesPresupuestoSesion } from "@/services/recomendacionesPresupuestoSesion";
import {
  agruparCxpCronologicamente,
  ordenarCxpPorNumero,
  separarCxpPorCompromiso,
} from "@/lib/vistas-cxp";

type ActionTone = "slate" | "amber" | "emerald" | "blue" | "purple" | "rose";

type CxpAction = {
  label: string;
  enabled: boolean;
  tone: ActionTone;
  onClick: () => void;
};

type ProveedorResumen = {
  key: string;
  nombre: string;
  total: number;
  registros: number;
};

type GrupoCxPPorCodigo = {
  codigo: string;
  items: CXP[];
};

type EstadoRecomendacionesSesion =
  | "esperando"
  | "procesando"
  | "lista"
  | "error";

type VistaCxp = "presupuesto" | "cronologica";

type ModoAgrupacionCxp = "presupuesto" | "cronologico";

function formatMoney(value: number | null | undefined) {
  return Number(value ?? 0).toLocaleString("es-HN", {
    style: "currency",
    currency: "HNL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getMontoPagadoCxp(cxp: CXP) {
  return Number(cxp.debe ?? cxp.monto_pagado ?? 0);
}

function getSaldoRealCxp(cxp: CXP) {
  return Math.max(Number(cxp.haber ?? 0) - getMontoPagadoCxp(cxp), 0);
}

function parseMoneyInput(value: string) {
  const cleanValue = value.trim().replace(/\s+/g, "").replace(/,/g, "");
  const parsed = Number(cleanValue);

  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Sin fecha";
  return value;
}

function getSaldoClass(value: number) {
  if (value > 0) return "text-amber-700 font-semibold";
  if (value < 0) return "text-rose-700 font-semibold";
  return "text-slate-700";
}

function getEstadoLabel(estado: string) {
  const labels: Record<string, string> = {
    observada: "Observada",
    pagada_sin_ejecucion: "Pagada sin ejecución",
    sin_compromiso: "Sin compromiso",
    compromiso_parcial: "Compromiso parcial",
    compromiso_total: "Compromiso completo",
    pagada_con_ejecucion: "Pagada y ejecutada",
    anulada: "Anulada",
  };

  return labels[estado] ?? estado;
}

function getEstadoClass(estado: string) {
  if (estado === "observada") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (estado === "pagada_sin_ejecucion") {
    return "border-orange-200 bg-orange-50 text-orange-700";
  }

  if (estado === "sin_compromiso") {
    return "border-slate-200 bg-slate-50 text-slate-700";
  }

  if (estado === "compromiso_parcial") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (estado === "compromiso_total") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (estado === "pagada_con_ejecucion") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  if (estado === "anulada") {
    return "border-zinc-200 bg-zinc-50 text-zinc-600";
  }

  return "border-slate-200 bg-slate-50 text-slate-600";
}

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function imprimirReporteCxp(items: CXP[], incluirHistorico: boolean) {
  const fechaReporte = new Date().toLocaleDateString("es-HN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const total = items.reduce((acc, cxp) => acc + getSaldoRealCxp(cxp), 0);
  const filas = items
    .map(
      (cxp) => `
        <tr>
          <td>${escapeHtml(cxp.no_cxp)}</td>
          <td>${escapeHtml(formatDate(cxp.fecha))}</td>
          <td>${escapeHtml(cxp.beneficiario_nombre || "Sin proveedor")}</td>
          <td>${escapeHtml(cxp.descripcion || "Sin descripcion")}</td>
          <td class="money">${escapeHtml(formatMoney(getSaldoRealCxp(cxp)))}</td>
          <td>${escapeHtml(getEstadoLabel(cxp.estado_operativo))}</td>
        </tr>
      `
    )
    .join("");

  const printWindow = window.open("", "_blank", "width=1200,height=800");

  if (!printWindow) {
    window.print();
    return;
  }

  printWindow.document.open();
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Reporte de cuentas por pagar</title>
        <style>
          @page {
            size: letter landscape;
            margin: 0.45in;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            color: #0f172a;
            background: #ffffff;
            font-family: Arial, Helvetica, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          header {
            display: flex;
            justify-content: space-between;
            gap: 24px;
            border-bottom: 1px solid #94a3b8;
            padding-bottom: 12px;
            margin-bottom: 14px;
          }

          .eyebrow {
            color: #64748b;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.18em;
            text-transform: uppercase;
          }

          h1 {
            margin: 4px 0 0 0;
            font-size: 20px;
            line-height: 1.2;
          }

          .meta {
            margin-top: 4px;
            color: #475569;
            font-size: 12px;
          }

          .summary {
            min-width: 240px;
            text-align: right;
            font-size: 12px;
            color: #475569;
          }

          .summary strong {
            color: #0f172a;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 9px;
          }

          thead {
            display: table-header-group;
            background: #f1f5f9;
          }

          th,
          td {
            border: 1px solid #cbd5e1;
            padding: 5px 6px;
            vertical-align: top;
          }

          th {
            color: #475569;
            font-size: 8px;
            letter-spacing: 0.12em;
            text-align: left;
            text-transform: uppercase;
          }

          th:nth-child(1) {
            width: 8%;
          }

          th:nth-child(2) {
            width: 10%;
          }

          th:nth-child(3) {
            width: 24%;
          }

          th:nth-child(5) {
            width: 14%;
            text-align: right;
          }

          th:nth-child(6) {
            width: 16%;
          }

          .money {
            text-align: right;
            font-weight: 700;
            white-space: nowrap;
          }

          tfoot td {
            background: #f8fafc;
            font-weight: 700;
          }

          tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        </style>
      </head>
      <body>
        <header>
          <div>
            <div class="eyebrow">Sistema financiero municipal</div>
            <h1>Cuentas por pagar</h1>
            <div class="meta">
              ${escapeHtml(
                incluirHistorico
                  ? "Incluye registros activos y cerrados"
                  : "Solo registros activos visibles"
              )} al ${escapeHtml(fechaReporte)}
            </div>
          </div>

          <div class="summary">
            <div><strong>${escapeHtml(items.length)}</strong> registros</div>
            <div>Total: <strong>${escapeHtml(formatMoney(total))}</strong></div>
          </div>
        </header>

        <table>
          <thead>
            <tr>
              <th>CxP</th>
              <th>Fecha</th>
              <th>Proveedor</th>
              <th>Descripcion</th>
              <th>Monto</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            ${
              filas ||
              `<tr><td colspan="6" style="text-align:center;padding:24px;">No hay cuentas por pagar para mostrar.</td></tr>`
            }
          </tbody>
          <tfoot>
            <tr>
              <td colspan="4" style="text-align:right;">Total</td>
              <td class="money">${escapeHtml(formatMoney(total))}</td>
              <td>${escapeHtml(items.length)} registros</td>
            </tr>
          </tfoot>
        </table>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();

  window.setTimeout(() => {
    printWindow.print();
  }, 250);
}

function getRecomendacionValue(cxp: CXP) {
  return cxp.recomendacion_financiera ?? cxp.recomendacion_pago ?? null;
}

function getMotivoRecomendacionValue(cxp: CXP) {
  return (
    cxp.motivo_recomendacion_financiera ??
    cxp.motivo_recomendacion_pago ??
    null
  );
}

function getCodigosRecomendacionValue(cxp: CXP) {
  return cxp.codigos_recomendacion_financiera ?? null;
}

function getMontoBaseRecomendacionValue(cxp: CXP) {
  return cxp.monto_recomendacion_base ?? cxp.monto_recomendado_pago ?? null;
}

function getRecomendacionClass(recomendacion: string | null | undefined) {
  if (recomendacion === "Pago total") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (recomendacion === "Pago parcial") {
    return "border-amber-200 bg-amber-50 text-amber-700";
  }

  if (recomendacion === "No pagar") {
    return "border-rose-200 bg-rose-50 text-rose-700";
  }

  if (recomendacion === "Requiere compromiso") {
    return "border-slate-200 bg-slate-50 text-slate-700";
  }

  return "border-slate-200 bg-white text-slate-500";
}

function getCoberturaRailClass(estado: string | null | undefined) {
  if (estado === "Cobertura suficiente") {
    return "border-emerald-200 bg-emerald-50 text-emerald-800";
  }

  if (estado === "Cobertura parcial") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (estado === "Sin cobertura") {
    return "border-rose-200 bg-rose-50 text-rose-800";
  }

  if (estado === "Requiere compromiso" || estado === "Compromiso parcial") {
    return "border-slate-200 bg-slate-50 text-slate-700";
  }

  if (estado === "Requiere revision") {
    return "border-orange-200 bg-orange-50 text-orange-800";
  }

  if (estado === "Anulada") {
    return "border-zinc-200 bg-zinc-50 text-zinc-600";
  }

  return "border-slate-200 bg-slate-100 text-slate-500";
}

function getCxpRowToneClass(cxp: CXP) {
  const estadoCodigos = cxp.estado_codigos;
  const estadoGrupos = cxp.estado_grupos;
  const tieneAnalisisRpc =
    estadoCodigos === "Cobertura suficiente" ||
    estadoCodigos === "Cobertura parcial" ||
    estadoCodigos === "Sin cobertura" ||
    estadoGrupos === "Cobertura suficiente" ||
    estadoGrupos === "Cobertura parcial" ||
    estadoGrupos === "Sin cobertura";

  if (
    estadoCodigos === "Cobertura suficiente" &&
    estadoGrupos === "Cobertura suficiente"
  ) {
    return "border-emerald-200 bg-emerald-50/70 hover:border-emerald-300 hover:bg-emerald-50";
  }

  if (!tieneAnalisisRpc) {
    return "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60";
  }

  const sinCoberturaEstados =
    estadoCodigos === "Sin cobertura" && estadoGrupos === "Sin cobertura";
  const sinMontoCubierto =
    Number(cxp.monto_cubierto_por_codigos ?? 0) <= 0 &&
    Number(cxp.monto_cubierto_por_grupos ?? 0) <= 0;

  if (sinCoberturaEstados || sinMontoCubierto) {
    return "border-rose-200 bg-rose-50/70 hover:border-rose-300 hover:bg-rose-50";
  }

  return "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/60";
}

function getCompromisoIndicator(cxp: CXP) {
  const saldoPorComprometer = Number(cxp.saldo_por_comprometer ?? 0);
  const montoComprometido = Number(cxp.monto_comprometido ?? 0);

  if (saldoPorComprometer <= 0 && montoComprometido > 0) {
    return {
      label: "Comprometida",
      className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }

  if (montoComprometido > 0) {
    return {
      label: "Compromiso parcial",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }

  return {
    label: "Sin compromiso",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  };
}

function getSectionAccent(id: string) {
  if (id === "compromiso_total") return "border-l-emerald-300";
  if (id === "pendientes") return "border-l-amber-300";
  if (id === "historico") return "border-l-slate-300";
  if (id.startsWith("cronologico:comprometidas:")) {
    return "border-l-emerald-300";
  }
  if (id.startsWith("cronologico:sin-compromiso:")) {
    return "border-l-amber-300";
  }
  return "border-l-slate-200";
}

function getToneDot(tone: ActionTone) {
  if (tone === "emerald") return "bg-emerald-500";
  if (tone === "amber") return "bg-amber-500";
  if (tone === "blue") return "bg-blue-500";
  if (tone === "purple") return "bg-purple-500";
  if (tone === "rose") return "bg-rose-500";
  return "bg-slate-400";
}

function getCxpPagoKey(cxp: CXP) {
  return `${cxp.no_cxp}::${cxp.tipo_movimiento ?? ""}`;
}

function getDocumentoCxpKey(noCxp: number, tipoMovimiento: string | null) {
  return `${noCxp}::${tipoMovimiento ?? ""}`;
}

function agruparDocumentosCxp(documentos: DocumentoCxp[]) {
  const map = new Map<string, DocumentoCxp[]>();

  documentos.forEach((doc) => {
    const key = getDocumentoCxpKey(doc.noCxp, doc.tipoMovimiento);
    const prev = map.get(key) ?? [];

    map.set(key, [...prev, doc]);
  });

  return map;
}

function tieneAccionOperativa(cxp: CXP) {
  return (
    cxp.puede_comprometer ||
    cxp.puede_pagar_con_compromiso ||
    cxp.puede_pagar_sin_ejecucion ||
    cxp.puede_asignar_ejecucion ||
    cxp.estado_administrativo === "pendiente"
  );
}

function normalizarCodigoPresupuestario(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function extraerCodigosPresupuestariosAsignados(cxp: CXP): string[] {
  const valor = getCodigosRecomendacionValue(cxp);

  if (!valor) return [];

  return Array.from(
    new Set(
      String(valor)
        .split(/[,\n;|]+/g)
        .map(normalizarCodigoPresupuestario)
        .filter(Boolean)
    )
  );
}

function obtenerCodigoPresupuestarioUnico(cxp: CXP) {
  const codigos = extraerCodigosPresupuestariosAsignados(cxp);

  if (codigos.length !== 1) return null;

  return codigos[0];
}

function agruparCxPPorCodigoUnico(items: CXP[]) {
  const gruposMap = new Map<string, GrupoCxPPorCodigo>();
  const sinCodigoUnico: CXP[] = [];

  for (const cxp of items) {
    const codigo = obtenerCodigoPresupuestarioUnico(cxp);

    if (!codigo) {
      sinCodigoUnico.push(cxp);
      continue;
    }

    const grupoActual = gruposMap.get(codigo);

    if (grupoActual) {
      grupoActual.items.push(cxp);
    } else {
      gruposMap.set(codigo, {
        codigo,
        items: [cxp],
      });
    }
  }

  return {
    grupos: Array.from(gruposMap.values()).sort((a, b) =>
      a.codigo.localeCompare(b.codigo)
    ),
    sinCodigoUnico,
  };
}

export default function CxpDashboard({
  containerClassName = "h-[100dvh] md:h-screen",
  refreshKey = 0,
  sharedView = false,
  onDataChange,
}: {
  containerClassName?: string;
  refreshKey?: number;
  sharedView?: boolean;
  onDataChange?: (contexto?: { noOrden?: number | string | null }) => void;
} = {}) {
  const [data, setData] = useState<CXP[]>([]);
  const [documentosCxpMap, setDocumentosCxpMap] = useState<
    Map<string, DocumentoCxp[]>
  >(new Map());
  const [expanded, setExpanded] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [vistaCxp, setVistaCxp] = useState<VistaCxp>("presupuesto");
  const [mostrarComprometidasCronologico, setMostrarComprometidasCronologico] =
    useState(false);
  const [loading, setLoading] = useState(true);

  const [mostrarFormularioCxp, setMostrarFormularioCxp] = useState(false);

  const [cxpCompromiso, setCxpCompromiso] = useState<CXP | null>(null);
  const [guardandoCompromiso, setGuardandoCompromiso] = useState(false);
  const [mensajeOperacion, setMensajeOperacion] = useState("");

  const [seleccionPagoKeys, setSeleccionPagoKeys] = useState<string[]>([]);
  const [modalPagoAbierto, setModalPagoAbierto] = useState(false);
  const [guardandoPago, setGuardandoPago] = useState(false);

  const [cxpDepuracion, setCxpDepuracion] = useState<CXP | null>(null);
  const [guardandoDepuracion, setGuardandoDepuracion] = useState(false);

  const [presupuestoTree, setPresupuestoTree] = useState<
    Map<string, PresupuestoNode>
  >(new Map());
  const [opcionesPresupuestoSesion, setOpcionesPresupuestoSesion] = useState<
    OpcionPresupuestoSesion[]
  >([]);
  const [recomendacionesPresupuestoSesion, setRecomendacionesPresupuestoSesion] =
    useState<Map<string, RecomendacionPresupuestoSesion>>(new Map());
  const [estadoRecomendacionesSesion, setEstadoRecomendacionesSesion] =
    useState<EstadoRecomendacionesSesion>("esperando");
  const [progresoRecomendacionesSesion, setProgresoRecomendacionesSesion] =
    useState({ procesadas: 0, total: 0 });
  const [confirmandoRecomendacionKey, setConfirmandoRecomendacionKey] =
    useState<string | null>(null);

  const [cargandoPresupuesto, setCargandoPresupuesto] = useState(false);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);
  const [menuAccionesKey, setMenuAccionesKey] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [seccionesColapsadas, setSeccionesColapsadas] = useState<
    Record<string, boolean>
  >({});

  const contenedorScrollRef = useRef<HTMLDivElement | null>(null);
  const scrollTopRef = useRef(0);
  const recomendacionesProcesadasRef = useRef<Set<string>>(new Set());
  const recomendacionesEnProcesoRef = useRef<Set<string>>(new Set());

  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    cxp: CXP;
  } | null>(null);

  function toggleColapsoSeccion(id: string) {
    setSeccionesColapsadas((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  async function cargarDatos(options?: {
    mantenerPosicion?: boolean;
    cargaInicial?: boolean;
  }) {
    const mantenerPosicion = options?.mantenerPosicion ?? false;
    const usarCargaPrincipal = options?.cargaInicial ?? data.length === 0;

    if (mantenerPosicion) {
      scrollTopRef.current = contenedorScrollRef.current?.scrollTop ?? 0;
    }

    if (usarCargaPrincipal) {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const [registros, documentos] = await Promise.all([
        obtenerCXP(),
        listarDocumentosCxp(),
      ]);

      setData(registros);
      setDocumentosCxpMap(agruparDocumentosCxp(documentos));
    } finally {
      if (usarCargaPrincipal) {
        setLoading(false);
      } else {
        setRefreshing(false);
      }

      if (mantenerPosicion) {
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            if (contenedorScrollRef.current) {
              contenedorScrollRef.current.scrollTop = scrollTopRef.current;
            }
          });
        });
      }
    }
  }

  async function cargarPresupuesto() {
    setCargandoPresupuesto(true);

    try {
      const presupuesto = await obtenerPresupuesto();
      const tree = buildHierarchy(presupuesto) as Map<string, PresupuestoNode>;
      setPresupuestoTree(tree);
      setOpcionesPresupuestoSesion(
        compactarOpcionesPresupuesto(presupuesto)
      );
    } catch (error) {
      console.error("Error cargando presupuesto:", error);
      setMensajeOperacion("No se pudo cargar el árbol presupuestario.");
    } finally {
      setCargandoPresupuesto(false);
    }
  }

  useEffect(() => {
    cargarDatos();
    cargarPresupuesto();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (window.matchMedia("(max-width: 767px)").matches) {
      setVistaCxp("cronologica");
    }
  }, []);

  useEffect(() => {
    if (refreshKey === 0) return;

    cargarDatos({
      mantenerPosicion: true,
      cargaInicial: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  useEffect(() => {
    if (loading || cargandoPresupuesto) {
      return;
    }

    const cuentasCandidatas = ordenarCuentasPorAntiguedad(
      data
        .filter(esCxpCandidataParaRecomendacion)
        .map(prepararCxpParaRecomendacion)
    );
    const cuentas = cuentasCandidatas.filter(
      (cuenta) =>
        !recomendacionesProcesadasRef.current.has(cuenta.claveCxp) &&
        !recomendacionesEnProcesoRef.current.has(cuenta.claveCxp)
    );

    if (cuentasCandidatas.length === 0) {
      setProgresoRecomendacionesSesion({ procesadas: 0, total: 0 });
      setEstadoRecomendacionesSesion("lista");
      return;
    }

    if (cuentas.length === 0) return;

    if (opcionesPresupuestoSesion.length === 0) {
      setEstadoRecomendacionesSesion("error");
      setMensajeOperacion(
        "No hay opciones del presupuesto cargadas para generar recomendaciones."
      );
      return;
    }

    const antecedentes = data
      .filter((cxp) => Number(cxp.monto_comprometido ?? 0) > 0)
      .flatMap((cxp) => {
        const codigo = obtenerCodigoPresupuestarioUnico(cxp);

        return codigo
          ? [
              {
                descripcion: cxp.descripcion,
                beneficiario: cxp.beneficiario_nombre,
                codigoPresupuestario: codigo,
              },
            ]
          : [];
      })
      .slice(0, 150);

    setEstadoRecomendacionesSesion("procesando");
    setProgresoRecomendacionesSesion({ procesadas: 0, total: cuentas.length });
    cuentas.forEach((cuenta) => {
      recomendacionesEnProcesoRef.current.add(cuenta.claveCxp);
    });

    void generarRecomendacionesPresupuestoSesion({
      cuentas,
      opciones: opcionesPresupuestoSesion,
      antecedentes,
      onLote: ({ recomendaciones, procesadas, total }) => {
        setRecomendacionesPresupuestoSesion((prev) => {
          const next = new Map(prev);

          recomendaciones.forEach((recomendacion) => {
            next.set(recomendacion.claveCxp, recomendacion);
            recomendacionesEnProcesoRef.current.delete(
              recomendacion.claveCxp
            );
            recomendacionesProcesadasRef.current.add(
              recomendacion.claveCxp
            );
          });

          return next;
        });
        setProgresoRecomendacionesSesion({ procesadas, total });
      },
    })
      .then(() => setEstadoRecomendacionesSesion("lista"))
      .catch((error) => {
        cuentas.forEach((cuenta) => {
          recomendacionesEnProcesoRef.current.delete(cuenta.claveCxp);
        });
        console.error("Error cargando recomendaciones de sesion:", error);
        setEstadoRecomendacionesSesion("error");
        setMensajeOperacion(
          error instanceof Error
            ? error.message
            : "No se pudieron cargar las recomendaciones presupuestarias."
        );
      });
  }, [
    cargandoPresupuesto,
    data,
    loading,
    opcionesPresupuestoSesion,
  ]);

  useEffect(() => {
    function cerrarMenus() {
      setContextMenu(null);
      setMenuAccionesKey(null);
    }

    window.addEventListener("click", cerrarMenus);

    return () => {
      window.removeEventListener("click", cerrarMenus);
    };
  }, []);

  const cxpsSeleccionadasPago = useMemo(() => {
    return data.filter((cxp) => seleccionPagoKeys.includes(getCxpPagoKey(cxp)));
  }, [data, seleccionPagoKeys]);

  const beneficiarioSeleccionadoPago =
    cxpsSeleccionadasPago.length > 0
      ? cxpsSeleccionadasPago[0].beneficiario_id
      : null;

  const totalSeleccionadoPago = useMemo(() => {
    return cxpsSeleccionadasPago.reduce(
      (acc, cxp) => acc + getSaldoRealCxp(cxp),
      0
    );
  }, [cxpsSeleccionadasPago]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();

    if (!term) return data;

    return data.filter((c) => {
      const recomendacion = getRecomendacionValue(c) ?? "";
      const codigos = getCodigosRecomendacionValue(c) ?? "";
      const recomendacionPresupuestaria =
        recomendacionesPresupuestoSesion.get(
          crearClaveCxp(c.no_cxp, c.tipo_movimiento)
        )?.codigoPresupuestario ?? "";

      return (
        String(c.no_cxp ?? "").toLowerCase().includes(term) ||
        (c.descripcion ?? "").toLowerCase().includes(term) ||
        (c.beneficiario_nombre ?? "").toLowerCase().includes(term) ||
        getEstadoLabel(c.estado_operativo ?? "").toLowerCase().includes(term) ||
        (c.decision_pago ?? "").toLowerCase().includes(term) ||
        (c.tipo_movimiento ?? "").toLowerCase().includes(term) ||
        (c.cuenta ?? "").toLowerCase().includes(term) ||
        recomendacion.toLowerCase().includes(term) ||
        String(codigos).toLowerCase().includes(term) ||
        recomendacionPresupuestaria.toLowerCase().includes(term)
      );
    });
  }, [data, recomendacionesPresupuestoSesion, search]);

  const cxpsNoPagadas = useMemo(() => {
    return filtered.filter((c) => c.estado_administrativo === "pendiente");
  }, [filtered]);

  const deudaNoPagada = useMemo(() => {
    return cxpsNoPagadas.reduce((acc, c) => acc + getSaldoRealCxp(c), 0);
  }, [cxpsNoPagadas]);

  const deudaComprometidaPendiente = useMemo(() => {
    return cxpsNoPagadas.reduce(
      (acc, c) => acc + Number(c.monto_comprometido ?? 0),
      0
    );
  }, [cxpsNoPagadas]);

  const proveedoresResumen = useMemo<ProveedorResumen[]>(() => {
    const map = new Map<string, ProveedorResumen>();

    for (const cxp of cxpsNoPagadas) {
      const key = cxp.beneficiario_id ?? cxp.beneficiario_nombre ?? "N/D";
      const current = map.get(key);
      const saldoReal = getSaldoRealCxp(cxp);

      if (current) {
        current.total += saldoReal;
        current.registros += 1;
      } else {
        map.set(key, {
          key,
          nombre: cxp.beneficiario_nombre ?? "Sin proveedor",
          total: saldoReal,
          registros: 1,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [cxpsNoPagadas]);

  const topProveedores = proveedoresResumen.slice(0, 8);

  const secciones = useMemo(() => {
    const noPagadasConCompromisoCompleto = filtered.filter(
      (c) =>
        c.estado_administrativo === "pendiente" &&
        c.estado_operativo === "compromiso_total"
    );

    const noPagadasSinCompromisoCompleto = filtered.filter(
      (c) =>
        c.estado_administrativo === "pendiente" &&
        ["sin_compromiso", "compromiso_parcial"].includes(c.estado_operativo)
    );

    const observadasConAccion = filtered.filter(
      (c) =>
        c.estado_administrativo === "pendiente" &&
        c.estado_operativo === "observada" &&
        tieneAccionOperativa(c)
    );

    const ocultas = filtered.filter(
      (c) =>
        c.estado_operativo === "anulada" ||
        c.estado_operativo === "pagada_con_ejecucion" ||
        c.estado_operativo === "pagada_sin_ejecucion" ||
        (c.estado_operativo === "observada" && !tieneAccionOperativa(c))
    );

    return {
      principales: [
        {
          id: "compromiso_total",
          titulo: "CxP no pagadas con compromiso completo",
          descripcion:
            "Obligaciones pendientes de pago que ya tienen compromiso presupuestario completo.",
          items: noPagadasConCompromisoCompleto,
        },
        {
          id: "pendientes",
          titulo: "CxP no pagadas sin compromiso completo",
          descripcion:
            "Obligaciones que aún requieren compromiso presupuestario, revisión o depuración.",
          items: [...noPagadasSinCompromisoCompleto, ...observadasConAccion],
        },
      ],
      ocultas,
    };
  }, [filtered]);

  const cxpsVisibles = useMemo(() => {
    const principales = secciones.principales.flatMap((seccion) => seccion.items);

    if (mostrarHistorico) {
      return [...principales, ...secciones.ocultas];
    }

    return principales;
  }, [mostrarHistorico, secciones]);

  const cxpsCronologicasPorCompromiso = useMemo(
    () => separarCxpPorCompromiso(cxpsVisibles),
    [cxpsVisibles]
  );

  const gruposCronologicosSinCompromiso = useMemo(
    () =>
      agruparCxpCronologicamente(
        cxpsCronologicasPorCompromiso.sinCompromiso
      ),
    [cxpsCronologicasPorCompromiso.sinCompromiso]
  );

  const gruposCronologicosComprometidos = useMemo(
    () =>
      agruparCxpCronologicamente(
        cxpsCronologicasPorCompromiso.comprometidas
      ),
    [cxpsCronologicasPorCompromiso.comprometidas]
  );

  const seccionesVista = useMemo(() => {
    if (vistaCxp === "cronologica") {
      return [
        ...gruposCronologicosSinCompromiso.map((grupo) => ({
          id: `cronologico:sin-compromiso:${grupo.key}`,
          titulo: `Sin compromiso · Tipo: ${grupo.tipo}`,
          descripcion: "Ordenadas de menor a mayor por número de CxP.",
          items: grupo.items,
          modoAgrupacion: "cronologico" as const,
        })),
        ...(mostrarComprometidasCronologico
          ? gruposCronologicosComprometidos.map((grupo) => ({
              id: `cronologico:comprometidas:${grupo.key}`,
              titulo: `Comprometidas · Tipo: ${grupo.tipo}`,
              descripcion:
                "CxP con compromiso, ordenadas de menor a mayor por número.",
              items: grupo.items,
              modoAgrupacion: "cronologico" as const,
            }))
          : []),
      ];
    }

    return [
      ...secciones.principales.map((seccion) => ({
        ...seccion,
        modoAgrupacion: "presupuesto" as const,
      })),
    ];
  }, [
    gruposCronologicosComprometidos,
    gruposCronologicosSinCompromiso,
    mostrarComprometidasCronologico,
    secciones,
    vistaCxp,
  ]);

  const cxpsVistaTabla = useMemo(() => {
    if (vistaCxp === "cronologica") {
      return seccionesVista.flatMap((seccion) => seccion.items);
    }

    return cxpsVisibles;
  }, [cxpsVisibles, seccionesVista, vistaCxp]);

  async function handleGuardarCompromiso(input: {
    id?: string;
    codigo_presupuestario: string;
    monto: number;
    actividad_id?: string | null;
    proyecto_id?: string | null;
    ejercicio_fiscal?: number | null;
    fecha_ejecucion?: string | null;
  }) {
    if (!cxpCompromiso) return;

    setGuardandoCompromiso(true);
    setMensajeOperacion("");

    try {
      if (input.id) {
        await actualizarCompromisoCXP({
          id: input.id,
          no_cxp: cxpCompromiso.no_cxp,
          tipo_movimiento: cxpCompromiso.tipo_movimiento,
          compromiso: {
            id: input.id,
            cxp_id: cxpCompromiso.no_cxp,
            tipo_compromiso: cxpCompromiso.tipo_movimiento,
            codigo_presupuestario: input.codigo_presupuestario,
            actividad_id: input.actividad_id ?? null,
            proyecto_id: input.proyecto_id ?? null,
            monto_ejecutado: input.monto,
            fecha_ejecucion: input.fecha_ejecucion ?? null,
            ejercicio_fiscal: input.ejercicio_fiscal ?? 2026,
            usuario_registro: "0824-1997-00564",
          },
        });

        setMensajeOperacion("Compromiso presupuestario actualizado correctamente.");
        setCxpCompromiso(null);
        await cargarDatos({
          mantenerPosicion: true,
          cargaInicial: false,
        });
        onDataChange?.();
        return;
      }

      const respuesta = await asignarCompromisoCXP({
        no_cxp: cxpCompromiso.no_cxp,
        tipo_movimiento: cxpCompromiso.tipo_movimiento,
        codigo_presupuestario: input.codigo_presupuestario,
        monto: input.monto,
        ejercicio_fiscal: input.ejercicio_fiscal ?? 2026,
        usuario_registro: "0824-1997-00564",
        actividad_id: input.actividad_id ?? "",
        proyecto_id: input.proyecto_id ?? "",
        fecha_ejecucion: input.fecha_ejecucion ?? undefined,
      });

      if (!respuesta.ok) {
        setMensajeOperacion(
          respuesta.error ?? "No se pudo asignar el compromiso presupuestario."
        );
        return;
      }

      setMensajeOperacion(
        respuesta.mensaje ?? "Compromiso presupuestario asignado correctamente."
      );

      setCxpCompromiso(null);
      await cargarDatos({
        mantenerPosicion: true,
        cargaInicial: false,
      });
      onDataChange?.();
    } catch (error) {
      console.error(error);
      setMensajeOperacion("Error inesperado asignando compromiso presupuestario.");
    } finally {
      setGuardandoCompromiso(false);
    }
  }

  async function handleConfirmarRecomendacionPresupuesto(
    cxp: CXP,
    recomendacion: RecomendacionPresupuestoSesion
  ) {
    const key = crearClaveCxp(cxp.no_cxp, cxp.tipo_movimiento);
    const montoHaber = Number(cxp.haber ?? 0);

    if (Number(cxp.monto_comprometido ?? 0) > 0) {
      setMensajeOperacion("Esta CxP ya tiene un compromiso presupuestario.");
      return;
    }

    if (!cxp.puede_comprometer) {
      setMensajeOperacion("Esta CxP no esta habilitada para comprometerse.");
      return;
    }

    if (!Number.isFinite(montoHaber) || montoHaber <= 0) {
      setMensajeOperacion("La CxP no tiene un monto valido en el haber.");
      return;
    }

    setConfirmandoRecomendacionKey(key);
    setMensajeOperacion("");

    try {
      const respuesta = await asignarCompromisoCXP({
        no_cxp: cxp.no_cxp,
        tipo_movimiento: cxp.tipo_movimiento,
        codigo_presupuestario: recomendacion.codigoPresupuestario,
        monto: montoHaber,
        ejercicio_fiscal:
          recomendacion.ejercicioFiscal ?? new Date().getFullYear(),
        usuario_registro: "0824-1997-00564",
        actividad_id: recomendacion.actividadId ?? "",
        proyecto_id: recomendacion.proyectoId ?? "",
        fecha_ejecucion: new Date().toISOString().slice(0, 10),
      });

      if (!respuesta.ok) {
        setMensajeOperacion(
          respuesta.error ?? "No se pudo asignar el compromiso presupuestario."
        );
        return;
      }

      setRecomendacionesPresupuestoSesion((prev) => {
        const next = new Map(prev);
        next.delete(key);
        return next;
      });
      setMensajeOperacion(
        respuesta.mensaje ??
          `CxP #${cxp.no_cxp} comprometida con ${recomendacion.codigoPresupuestario}.`
      );
      await cargarDatos({
        mantenerPosicion: true,
        cargaInicial: false,
      });
      onDataChange?.();
    } catch (error) {
      console.error(error);
      setMensajeOperacion(
        error instanceof Error
          ? error.message
          : "Error inesperado confirmando la recomendacion presupuestaria."
      );
    } finally {
      setConfirmandoRecomendacionKey(null);
    }
  }

  async function handleProcesarPagoMultiple(input: {
    no_cheque: number;
    fecha_pago: string;
    cuenta: string;
    descripcion_pago: string;
    pagos: Array<{
      no_cxp: number;
      tipo_movimiento: string | null;
      monto_pago: number;
    }>;
  }) {
    if (cxpsSeleccionadasPago.length === 0) {
      setMensajeOperacion("Debe seleccionar al menos una CxP para pagar.");
      return;
    }

    setGuardandoPago(true);
    setMensajeOperacion("");

    try {
      const respuesta = await procesarPagoMultipleCXPConCompromiso({
        cxps: input.pagos,
        no_cheque: input.no_cheque,
        usuario_registro: "0824-1997-00564",
        cuenta: input.cuenta,
        fecha_pago: input.fecha_pago,
        descripcion_pago: input.descripcion_pago,
        ejercicio_fiscal: 2026,
      });

      if (!respuesta.ok) {
        setMensajeOperacion(
          respuesta.error ?? "No se pudo procesar el pago múltiple."
        );
        return;
      }

      setMensajeOperacion(
        respuesta.mensaje
          ? `${respuesta.mensaje} Orden No. ${respuesta.no_orden ?? ""}`
          : `Pago múltiple procesado correctamente. Orden No. ${
              respuesta.no_orden ?? ""
            }`
      );

      setModalPagoAbierto(false);
      setSeleccionPagoKeys([]);
      await cargarDatos({
        mantenerPosicion: true,
        cargaInicial: false,
      });
      onDataChange?.({ noOrden: respuesta.no_orden });
    } catch (error) {
      console.error(error);
      setMensajeOperacion("Error inesperado procesando el pago múltiple.");
    } finally {
      setGuardandoPago(false);
    }
  }

  async function handleDepurarCxp(input: {
    accion: DepurarCxpAccion;
    fecha: string;
    motivo: string;
  }) {
    if (!cxpDepuracion) return;

    setGuardandoDepuracion(true);
    setMensajeOperacion("");

    try {
      const respuesta = await depurarCxPEstado({
        no_cxp: cxpDepuracion.no_cxp,
        tipo_movimiento: cxpDepuracion.tipo_movimiento,
        accion: input.accion,
        fecha: input.fecha,
        motivo: input.motivo,
        usuario: "0824-1997-00564",
      });

      if (!respuesta.ok) {
        setMensajeOperacion(
          respuesta.error ?? "No se pudo depurar la CxP seleccionada."
        );
        return;
      }

      setMensajeOperacion(respuesta.mensaje ?? "CxP depurada correctamente.");

      setCxpDepuracion(null);
      await cargarDatos({
        mantenerPosicion: true,
        cargaInicial: false,
      });
      onDataChange?.();
    } catch (error) {
      console.error(error);
      setMensajeOperacion("Error inesperado depurando la CxP.");
    } finally {
      setGuardandoDepuracion(false);
    }
  }

  async function handleSubsanarDocumentoCxp(
    cxp: CXP,
    documento: DocumentoCxp
  ) {
    const confirmar = window.confirm(
      `Confirmas que este documento de la CxP #${cxp.no_cxp} ya esta cumplido?`
    );

    if (!confirmar) return;

    try {
      setMensajeOperacion("");

      await subsanarDocumentoCxp({
        noCxp: cxp.no_cxp,
        tipoMovimiento: cxp.tipo_movimiento,
        tipoDocumento: documento.tipoDocumento,
        nombreDocumento: documento.nombreDocumento,
      });

      const documentos = await listarDocumentosCxp();
      setDocumentosCxpMap(agruparDocumentosCxp(documentos));
      setMensajeOperacion("Documento de CxP marcado como cumplido.");
      onDataChange?.();
    } catch (error) {
      console.error(error);
      setMensajeOperacion("No se pudo actualizar el documento de la CxP.");
    }
  }

  function iniciarPagoRapido(cxp: CXP) {
    setSeleccionPagoKeys([getCxpPagoKey(cxp)]);
    setModalPagoAbierto(true);
  }

  function toggleSeleccionPago(cxp: CXP) {
    const key = getCxpPagoKey(cxp);

    if (!cxp.puede_pagar_con_compromiso) {
      setMensajeOperacion("Esta CxP no puede seleccionarse para pago.");
      return;
    }

    if (
      beneficiarioSeleccionadoPago &&
      cxp.beneficiario_id !== beneficiarioSeleccionadoPago
    ) {
      setMensajeOperacion(
        "Solo puede seleccionar CxP del mismo beneficiario para un mismo egreso."
      );
      return;
    }

    setSeleccionPagoKeys((prev) => {
      if (prev.includes(key)) {
        return prev.filter((item) => item !== key);
      }

      return [...prev, key];
    });
  }

  function buildActions(cxp: CXP): CxpAction[] {
    return [
      {
        label: "Ver detalle",
        enabled: true,
        tone: "slate",
        onClick: () =>
          setExpanded((prev) => (prev === cxp.cxp_id ? null : cxp.cxp_id)),
      },
      {
        label: Number(cxp.monto_comprometido ?? 0) > 0
          ? "Editar compromiso"
          : "Comprometer",
        enabled: cxp.puede_comprometer || Number(cxp.monto_comprometido ?? 0) > 0,
        tone: "amber",
        onClick: () => setCxpCompromiso(cxp),
      },
      {
        label: "Pagar",
        enabled: cxp.puede_pagar_con_compromiso,
        tone: "emerald",
        onClick: () => iniciarPagoRapido(cxp),
      },
      {
        label: "Depurar",
        enabled: cxp.estado_administrativo === "pendiente",
        tone: "blue",
        onClick: () => setCxpDepuracion(cxp),
      },
      {
        label: "Asignar ejecución",
        enabled: cxp.puede_asignar_ejecucion,
        tone: "purple",
        onClick: () =>
          setMensajeOperacion(
            "La asignación manual de ejecución se integrará en el siguiente flujo."
          ),
      },
    ];
  }

  return (
    <div
      className={[
        "grid grid-rows-[auto_1fr] overflow-hidden bg-[#f7f7f8] text-slate-800",
        containerClassName,
      ].join(" ")}
      onClick={() => {
        setContextMenu(null);
        setMenuAccionesKey(null);
      }}
    >
      {mensajeOperacion && (
        <div className="fixed inset-x-3 top-3 z-[80] border border-slate-200 bg-white px-4 py-3 text-[12px] font-medium text-slate-700 shadow-lg sm:left-auto sm:right-4 sm:top-4 sm:max-w-[460px]">
          {mensajeOperacion}
        </div>
      )}

      {mostrarFormularioCxp && (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/30 backdrop-blur-[2px]"
          onClick={() => setMostrarFormularioCxp(false)}
        >
          <div
            className="absolute right-0 top-0 h-full w-full max-w-[820px] overflow-y-auto border-l border-slate-200 bg-[#f7f7f8] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <FormCrearCuentaPorPagar
              onClose={() => setMostrarFormularioCxp(false)}
              onSuccess={(resultado) => {
                setMensajeOperacion(
                  `CxP registrada correctamente. No. definitivo: ${resultado.no_cxp_generado}.`
                );

                cargarDatos({
                  mantenerPosicion: true,
                  cargaInicial: false,
                });
                onDataChange?.();
              }}
            />
          </div>
        </div>
      )}

      <header className="operational-header">
        <div
          className={[
            "flex flex-col gap-2 px-3 py-2.5",
            sharedView ? "" : "xl:flex-row xl:items-center xl:justify-between",
          ].join(" ")}
        >
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">
              Sistema financiero municipal
            </div>

            <div className="mt-0.5 flex flex-wrap items-baseline gap-3">
              <h1 className="text-[16px] font-semibold tracking-tight text-slate-950">
                Cuentas por pagar
              </h1>

              <span className="text-[12px] text-slate-500">
                Obligaciones pendientes de pago
              </span>
            </div>
          </div>

          <div
            className={[
              "flex flex-col gap-2",
              sharedView ? "" : "xl:flex-row xl:items-center",
            ].join(" ")}
          >
            <div
              className={[
                "relative w-full",
                sharedView ? "" : "xl:w-[460px]",
              ].join(" ")}
            >
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400">
                Buscar
              </span>

              <input
                className="h-8 w-full rounded-md border border-slate-200 bg-white/80 pl-[58px] pr-3 text-[12px] text-slate-800 outline-none placeholder:text-slate-400 focus:border-slate-400 focus:bg-white"
                placeholder="CxP, proveedor, descripción, estado, recomendación o código"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div
                className="flex h-10 flex-1 overflow-hidden rounded-md border border-slate-200 bg-white sm:h-8 sm:flex-none"
                role="group"
                aria-label="Vista de cuentas por pagar"
              >
                <button
                  type="button"
                  aria-pressed={vistaCxp === "presupuesto"}
                  onClick={() => setVistaCxp("presupuesto")}
                  className={[
                    "flex-1 border-r border-slate-200 px-3 text-[12px] font-medium transition sm:flex-none",
                    vistaCxp === "presupuesto"
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50",
                  ].join(" ")}
                >
                  Presupuesto
                </button>

                <button
                  type="button"
                  aria-pressed={vistaCxp === "cronologica"}
                  onClick={() => setVistaCxp("cronologica")}
                  className={[
                    "flex-1 px-3 text-[12px] font-medium transition sm:flex-none",
                    vistaCxp === "cronologica"
                      ? "bg-slate-900 text-white"
                      : "bg-white text-slate-600 hover:bg-slate-50",
                  ].join(" ")}
                >
                  Cronológica
                </button>
              </div>

              <div className="hidden flex-wrap items-center gap-2 md:flex">
                {vistaCxp === "cronologica" &&
                  cxpsCronologicasPorCompromiso.comprometidas.length > 0 && (
                    <button
                      type="button"
                      aria-pressed={mostrarComprometidasCronologico}
                      onClick={() =>
                        setMostrarComprometidasCronologico((actual) => !actual)
                      }
                      className={[
                        "h-8 rounded-md border px-3 text-[12px] font-medium transition",
                        mostrarComprometidasCronologico
                          ? "border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800"
                          : "border-emerald-200 bg-emerald-50 text-emerald-800 hover:border-emerald-400",
                      ].join(" ")}
                    >
                      {mostrarComprometidasCronologico
                        ? "Ocultar comprometidas"
                        : `Mostrar comprometidas (${cxpsCronologicasPorCompromiso.comprometidas.length})`}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMostrarFormularioCxp(true);
                    }}
                    className="h-8 rounded-md border border-emerald-600 bg-emerald-600 px-3 text-[12px] font-medium text-white transition hover:bg-emerald-700"
                  >
                    Nueva CxP
                  </button>

                <button
                  type="button"
                  disabled={refreshing}
                  onClick={() =>
                    cargarDatos({
                      mantenerPosicion: true,
                      cargaInicial: false,
                    })
                  }
                  className="h-8 rounded-md border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50"
                >
                  {refreshing ? "Actualizando..." : "Recargar"}
                </button>

                <button
                  type="button"
                  onClick={() => setMostrarHistorico((prev) => !prev)}
                  className="h-8 rounded-md border border-slate-900 bg-slate-900 px-3 text-[12px] font-medium text-white transition hover:bg-slate-700"
                >
                  {mostrarHistorico ? "Ocultar cerrados" : "Ver cerrados"}
                </button>

                <button
                  type="button"
                  onClick={() =>
                    imprimirReporteCxp(cxpsVistaTabla, mostrarHistorico)
                  }
                  className="h-8 rounded-md border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                >
                  Imprimir
                </button>
              </div>

              <details className="w-full rounded-md border border-slate-200 bg-white md:hidden">
                <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between px-3 text-[12px] font-semibold text-slate-700">
                  <span>Opciones</span>
                  <span className="text-[10px] font-medium text-slate-400">
                    Registro, consulta y reportes
                  </span>
                </summary>

                <div className="grid grid-cols-2 gap-2 border-t border-slate-200 bg-slate-50 p-2">
                  {vistaCxp === "cronologica" &&
                    cxpsCronologicasPorCompromiso.comprometidas.length > 0 && (
                      <button
                        type="button"
                        aria-pressed={mostrarComprometidasCronologico}
                        onClick={() =>
                          setMostrarComprometidasCronologico((actual) => !actual)
                        }
                        className={[
                          "col-span-2 min-h-11 rounded-md border px-3 text-[12px] font-medium transition",
                          mostrarComprometidasCronologico
                            ? "border-emerald-700 bg-emerald-700 text-white"
                            : "border-emerald-200 bg-emerald-50 text-emerald-800",
                        ].join(" ")}
                      >
                        {mostrarComprometidasCronologico
                          ? "Ocultar comprometidas"
                          : `Mostrar comprometidas (${cxpsCronologicasPorCompromiso.comprometidas.length})`}
                      </button>
                    )}

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMostrarFormularioCxp(true);
                    }}
                    className="min-h-11 rounded-md border border-emerald-600 bg-emerald-600 px-3 text-[12px] font-medium text-white"
                  >
                    Nueva CxP
                  </button>

                  <button
                    type="button"
                    disabled={refreshing}
                    onClick={() =>
                      cargarDatos({
                        mantenerPosicion: true,
                        cargaInicial: false,
                      })
                    }
                    className="min-h-11 rounded-md border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-700 disabled:opacity-50"
                  >
                    {refreshing ? "Actualizando..." : "Recargar"}
                  </button>

                  <button
                    type="button"
                    onClick={() => setMostrarHistorico((prev) => !prev)}
                    className="min-h-11 rounded-md border border-slate-900 bg-slate-900 px-3 text-[12px] font-medium text-white"
                  >
                    {mostrarHistorico ? "Ocultar cerrados" : "Ver cerrados"}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      imprimirReporteCxp(cxpsVistaTabla, mostrarHistorico)
                    }
                    className="min-h-11 rounded-md border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-700"
                  >
                    Imprimir
                  </button>
                </div>
              </details>
            </div>
          </div>
        </div>
      </header>

      <main
        className={
          sharedView
            ? "min-h-0 overflow-hidden p-3"
            : "min-h-0 overflow-hidden p-2 sm:p-4"
        }
      >
        <div
          ref={contenedorScrollRef}
          className={[
            "mx-auto grid h-full gap-3 overflow-y-auto overflow-x-hidden pr-0 sm:gap-4 sm:pr-2",
            sharedView ? "max-w-none" : "max-w-[1500px]",
          ].join(" ")}
        >
          {estadoRecomendacionesSesion !== "esperando" && (
              <section
                className={[
                  "border px-4 py-3 text-[12px]",
                  estadoRecomendacionesSesion === "error"
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                    : estadoRecomendacionesSesion === "lista"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-amber-200 bg-amber-50 text-amber-800",
                ].join(" ")}
              >
                <div className="font-semibold">
                  {estadoRecomendacionesSesion === "procesando"
                    ? `Generando recomendaciones presupuestarias: ${progresoRecomendacionesSesion.procesadas} de ${progresoRecomendacionesSesion.total}`
                    : estadoRecomendacionesSesion === "lista"
                      ? progresoRecomendacionesSesion.total > 0
                        ? `${progresoRecomendacionesSesion.procesadas} recomendaciones disponibles en esta sesion`
                        : "No hay cuentas por pagar pendientes de compromiso"
                      : "No se pudieron completar las recomendaciones presupuestarias"}
                </div>

                <div className="mt-1 opacity-80">
                  Son sugerencias temporales: solo se registra un compromiso al
                  presionar el codigo recomendado.
                </div>
              </section>
            )}

          <section
            className={[
              "hidden grid-cols-1 gap-3 md:grid md:grid-cols-2",
              sharedView ? "" : "xl:grid-cols-3",
            ].join(" ")}
          >
            <KpiCard
              label="Deuda no pagada"
              value={formatMoney(deudaNoPagada)}
              detail={`${cxpsNoPagadas.length} CxP pendientes`}
              tone="rose"
            />

            <KpiCard
              label="Comprometido pendiente"
              value={formatMoney(deudaComprometidaPendiente)}
              detail="Compromiso registrado sin pago final"
              tone="amber"
            />

            <KpiCard
              label="Proveedores con saldo"
              value={String(proveedoresResumen.length)}
              detail="Con deuda no pagada registrada"
              tone="slate"
            />
          </section>

          <details className="border border-slate-200 bg-white md:hidden">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-[12px] font-semibold text-slate-700">
              <span>Resumen financiero</span>
              <span className="text-[10px] font-medium text-slate-400">
                Indicadores y proveedores
              </span>
            </summary>

            <div className="grid gap-3 border-t border-slate-200 bg-slate-50 p-3">
              <KpiCard
                label="Deuda no pagada"
                value={formatMoney(deudaNoPagada)}
                detail={`${cxpsNoPagadas.length} CxP pendientes`}
                tone="rose"
              />

              <KpiCard
                label="Comprometido pendiente"
                value={formatMoney(deudaComprometidaPendiente)}
                detail="Compromiso registrado sin pago final"
                tone="amber"
              />

              <KpiCard
                label="Proveedores con saldo"
                value={String(proveedoresResumen.length)}
                detail="Con deuda no pagada registrada"
                tone="slate"
              />

              <ProveedorResumenCard
                proveedores={topProveedores}
                sharedView={sharedView}
              />
            </div>
          </details>

          <section className="grid gap-4">
            <div className="hidden md:block">
              <ProveedorResumenCard
                proveedores={topProveedores}
                sharedView={sharedView}
              />
            </div>

            {cxpsSeleccionadasPago.length > 0 && (
              <div className="flex flex-col gap-3 border border-emerald-200 bg-emerald-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-800">
                    Pago múltiple seleccionado
                  </div>

                  <div className="mt-1 text-[13px] font-semibold text-emerald-950">
                    {cxpsSeleccionadasPago.length} CxP ·{" "}
                    {formatMoney(totalSeleccionadoPago)}
                  </div>

                  <div className="mt-1 text-[12px] text-emerald-800/80">
                    Proveedor:{" "}
                    {cxpsSeleccionadasPago[0]?.beneficiario_nombre ?? "N/D"}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSeleccionPagoKeys([])}
                    className="border border-emerald-200 bg-white px-3 py-2 text-[12px] font-medium text-emerald-800 transition hover:border-emerald-400"
                  >
                    Limpiar
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalPagoAbierto(true)}
                    className="border border-emerald-700 bg-emerald-700 px-3 py-2 text-[12px] font-medium text-white transition hover:bg-emerald-800"
                  >
                    Procesar pago
                  </button>
                </div>
              </div>
            )}
          </section>

          <section className="grid gap-4">
            {loading ? (
              <div className="border border-slate-200 bg-white px-4 py-10 text-center text-[13px] text-slate-500">
                Cargando cuentas por pagar...
              </div>
            ) : (
              <>
                {seccionesVista.map((seccion) => (
                  <CxpSection
                    key={seccion.id}
                    id={seccion.id}
                    titulo={seccion.titulo}
                    descripcion={seccion.descripcion}
                    items={seccion.items}
                    modoAgrupacion={seccion.modoAgrupacion}
                    collapsed={seccionesColapsadas[seccion.id] ?? false}
                    expanded={expanded}
                    seleccionPagoKeys={seleccionPagoKeys}
                    beneficiarioSeleccionadoPago={beneficiarioSeleccionadoPago}
                    menuAccionesKey={menuAccionesKey}
                    onToggleCollapsed={() => toggleColapsoSeccion(seccion.id)}
                    onToggleMenu={(key) => setMenuAccionesKey(key)}
                    onToggleDetalle={(cxp) =>
                      setExpanded((prev) =>
                        prev === cxp.cxp_id ? null : cxp.cxp_id
                      )
                    }
                    onToggleSeleccionPago={toggleSeleccionPago}
                    onContextMenu={(event, cxp) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setContextMenu({
                        x: event.clientX,
                        y: event.clientY,
                        cxp,
                      });
                    }}
                    buildActions={buildActions}
                    documentosCxpMap={documentosCxpMap}
                    onSubsanarDocumento={handleSubsanarDocumentoCxp}
                    recomendacionesPresupuesto={
                      recomendacionesPresupuestoSesion
                    }
                    estadoRecomendaciones={estadoRecomendacionesSesion}
                    confirmandoRecomendacionKey={
                      confirmandoRecomendacionKey
                    }
                    onConfirmarRecomendacion={
                      handleConfirmarRecomendacionPresupuesto
                    }
                    sharedView={sharedView}
                  />
                ))}

                {seccionesVista.length === 0 && (
                  <div className="border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-[12px] text-slate-500">
                    {vistaCxp === "cronologica" &&
                    cxpsCronologicasPorCompromiso.comprometidas.length > 0
                      ? "No hay CxP sin compromiso para mostrar."
                      : "No hay cuentas por pagar para mostrar en esta vista."}
                  </div>
                )}

                {vistaCxp === "cronologica" &&
                  !mostrarComprometidasCronologico &&
                  cxpsCronologicasPorCompromiso.comprometidas.length > 0 && (
                    <div className="border border-dashed border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] text-emerald-800">
                      {cxpsCronologicasPorCompromiso.comprometidas.length} CxP
                      comprometida(s) están ocultas por defecto. Use “Mostrar
                      comprometidas” para consultarlas.
                    </div>
                  )}

                {mostrarHistorico && vistaCxp === "presupuesto" && (
                  <CxpSection
                    id="historico"
                    titulo="Registros cerrados u ocultos"
                    descripcion="CxP pagadas, anuladas u observadas sin acción operativa."
                    items={secciones.ocultas}
                    modoAgrupacion="presupuesto"
                    collapsed={seccionesColapsadas.historico ?? false}
                    expanded={expanded}
                    seleccionPagoKeys={seleccionPagoKeys}
                    beneficiarioSeleccionadoPago={beneficiarioSeleccionadoPago}
                    menuAccionesKey={menuAccionesKey}
                    onToggleCollapsed={() => toggleColapsoSeccion("historico")}
                    onToggleMenu={(key) => setMenuAccionesKey(key)}
                    onToggleDetalle={(cxp) =>
                      setExpanded((prev) =>
                        prev === cxp.cxp_id ? null : cxp.cxp_id
                      )
                    }
                    onToggleSeleccionPago={toggleSeleccionPago}
                    onContextMenu={(event, cxp) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setContextMenu({
                        x: event.clientX,
                        y: event.clientY,
                        cxp,
                      });
                    }}
                    buildActions={buildActions}
                    documentosCxpMap={documentosCxpMap}
                    onSubsanarDocumento={handleSubsanarDocumentoCxp}
                    recomendacionesPresupuesto={
                      recomendacionesPresupuestoSesion
                    }
                    estadoRecomendaciones={estadoRecomendacionesSesion}
                    confirmandoRecomendacionKey={
                      confirmandoRecomendacionKey
                    }
                    onConfirmarRecomendacion={
                      handleConfirmarRecomendacionPresupuesto
                    }
                    sharedView={sharedView}
                  />
                )}

                {!mostrarHistorico && secciones.ocultas.length > 0 && (
                  <div className="border border-dashed border-slate-200 bg-white px-4 py-3 text-[12px] text-slate-500">
                    Hay {secciones.ocultas.length} registros cerrados u ocultos.
                    Use “Ver registros cerrados” para consultarlos.
                  </div>
                )}
              </>
            )}
          </section>
        </div>
      </main>

      {contextMenu && (
        <ContextualActionsMenu
          x={contextMenu.x}
          y={contextMenu.y}
          actions={buildActions(contextMenu.cxp)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {cxpCompromiso && (
        <ModalCompromiso
          cxp={cxpCompromiso}
          guardando={guardandoCompromiso}
          presupuestoTree={presupuestoTree}
          cargandoPresupuesto={cargandoPresupuesto}
          onClose={() => setCxpCompromiso(null)}
          onGuardar={handleGuardarCompromiso}
        />
      )}

      {modalPagoAbierto && (
        <ModalPagoMultiple
          cxps={cxpsSeleccionadasPago}
          guardando={guardandoPago}
          onClose={() => setModalPagoAbierto(false)}
          onProcesar={handleProcesarPagoMultiple}
        />
      )}

      {cxpDepuracion && (
        <ModalDepurarCxp
          cxp={cxpDepuracion}
          guardando={guardandoDepuracion}
          onClose={() => setCxpDepuracion(null)}
          onGuardar={handleDepurarCxp}
        />
      )}
    </div>
  );
}

function KpiCard({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: "rose" | "amber" | "emerald" | "slate";
}) {
  const styles = {
    rose: {
      border: "border-l-rose-300",
      value: "text-slate-950",
      badge: "bg-rose-50 text-rose-700",
    },
    amber: {
      border: "border-l-amber-300",
      value: "text-slate-950",
      badge: "bg-amber-50 text-amber-700",
    },
    emerald: {
      border: "border-l-emerald-300",
      value: "text-slate-950",
      badge: "bg-emerald-50 text-emerald-700",
    },
    slate: {
      border: "border-l-slate-300",
      value: "text-slate-950",
      badge: "bg-slate-100 text-slate-600",
    },
  }[tone];

  return (
    <div
      className={[
        "border border-l-4 border-slate-200 bg-white px-4 py-4 shadow-sm",
        styles.border,
      ].join(" ")}
    >
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
        {label}
      </div>

      <div
        className={[
          "mt-2 text-[22px] font-semibold tracking-tight tabular-nums",
          styles.value,
        ].join(" ")}
      >
        {value}
      </div>

      <div
        className={[
          "mt-3 inline-flex max-w-full px-2 py-1 text-[11px] font-medium",
          styles.badge,
        ].join(" ")}
      >
        <span className="truncate">{detail}</span>
      </div>
    </div>
  );
}

function ProveedorResumenCard({
  proveedores,
  sharedView = false,
}: {
  proveedores: ProveedorResumen[];
  sharedView?: boolean;
}) {
  const total = proveedores.reduce((acc, p) => acc + p.total, 0);

  return (
    <div className="border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-slate-400">
            Deuda por proveedor
          </div>

          <div className="mt-1 text-[16px] font-semibold tracking-tight text-slate-950">
            Principales saldos pendientes
          </div>
        </div>

        <div className="text-left md:text-right">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">
            Total visible
          </div>

          <div className="mt-1 text-[18px] font-semibold tabular-nums text-slate-950">
            {formatMoney(total)}
          </div>
        </div>
      </div>

      <div className="mt-3">
        {proveedores.length === 0 ? (
          <div className="border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-[12px] text-slate-400">
            No hay proveedores con saldo pendiente.
          </div>
        ) : (
          <div
            className={[
              "grid gap-2 md:grid-cols-2",
              sharedView ? "" : "xl:grid-cols-4",
            ].join(" ")}
          >
            {proveedores.map((proveedor, index) => (
              <div
                key={proveedor.key}
                className="border border-slate-100 bg-slate-50 px-3 py-3 transition hover:bg-white"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="grid h-5 w-5 place-items-center bg-white text-[10px] font-medium tabular-nums text-slate-500">
                        {index + 1}
                      </span>

                      <div className="truncate text-[12px] font-medium text-slate-800">
                        {proveedor.nombre}
                      </div>
                    </div>

                    <div className="mt-2 text-[11px] text-slate-400">
                      {proveedor.registros} CxP pendientes
                    </div>
                  </div>

                  <div className="whitespace-nowrap text-right text-[12px] font-semibold tabular-nums text-slate-950">
                    {formatMoney(proveedor.total)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CxpSection({
  id,
  titulo,
  descripcion,
  items,
  modoAgrupacion,
  collapsed,
  expanded,
  seleccionPagoKeys,
  beneficiarioSeleccionadoPago,
  menuAccionesKey,
  onToggleCollapsed,
  onToggleMenu,
  onToggleDetalle,
  onToggleSeleccionPago,
  onContextMenu,
  buildActions,
  documentosCxpMap,
  onSubsanarDocumento,
  recomendacionesPresupuesto,
  estadoRecomendaciones,
  confirmandoRecomendacionKey,
  onConfirmarRecomendacion,
  sharedView = false,
}: {
  id: string;
  titulo: string;
  descripcion: string;
  items: CXP[];
  modoAgrupacion: ModoAgrupacionCxp;
  collapsed: boolean;
  expanded: number | null;
  seleccionPagoKeys: string[];
  beneficiarioSeleccionadoPago: string | null;
  menuAccionesKey: string | null;
  onToggleCollapsed: () => void;
  onToggleMenu: (key: string | null) => void;
  onToggleDetalle: (cxp: CXP) => void;
  onToggleSeleccionPago: (cxp: CXP) => void;
  onContextMenu: (event: MouseEvent<HTMLDivElement>, cxp: CXP) => void;
  buildActions: (cxp: CXP) => CxpAction[];
  documentosCxpMap: Map<string, DocumentoCxp[]>;
  onSubsanarDocumento: (cxp: CXP, documento: DocumentoCxp) => void;
  recomendacionesPresupuesto: Map<string, RecomendacionPresupuestoSesion>;
  estadoRecomendaciones: EstadoRecomendacionesSesion;
  confirmandoRecomendacionKey: string | null;
  onConfirmarRecomendacion: (
    cxp: CXP,
    recomendacion: RecomendacionPresupuestoSesion
  ) => void;
  sharedView?: boolean;
}) {
  const total = items.reduce((acc, cxp) => acc + getSaldoRealCxp(cxp), 0);

  const agrupacionPorCodigo = useMemo(() => {
    return agruparCxPPorCodigoUnico(items);
  }, [items]);
  const itemsCronologicos = useMemo(() => ordenarCxpPorNumero(items), [items]);

  function renderCxpRow(cxp: CXP) {
    const keyPago = getCxpPagoKey(cxp);
    const seleccionadoPago = seleccionPagoKeys.includes(keyPago);

    const bloqueadoPorBeneficiario =
      beneficiarioSeleccionadoPago !== null &&
      cxp.beneficiario_id !== beneficiarioSeleccionadoPago;

    const puedeSeleccionarsePago =
      cxp.puede_pagar_con_compromiso && !bloqueadoPorBeneficiario;
    const documentos = documentosCxpMap.get(
      getDocumentoCxpKey(cxp.no_cxp, cxp.tipo_movimiento)
    );
    const recomendacionPresupuesto = recomendacionesPresupuesto.get(keyPago);

    return (
      <CxpCompactRow
        key={`${cxp.cxp_id}-${cxp.no_cxp}-${cxp.tipo_movimiento}`}
        cxp={cxp}
        expanded={expanded === cxp.cxp_id}
        seleccionadoPago={seleccionadoPago}
        puedeSeleccionarsePago={puedeSeleccionarsePago}
        menuOpen={menuAccionesKey === keyPago}
        actions={buildActions(cxp)}
        documentos={documentos}
        onToggleMenu={(event) => {
          event.stopPropagation();
          onToggleMenu(menuAccionesKey === keyPago ? null : keyPago);
        }}
        onToggleDetalle={() => onToggleDetalle(cxp)}
        onToggleSeleccionPago={() => onToggleSeleccionPago(cxp)}
        onSubsanarDocumento={(documento) =>
          onSubsanarDocumento(cxp, documento)
        }
        onContextMenu={(event) => onContextMenu(event, cxp)}
        recomendacionPresupuesto={recomendacionPresupuesto}
        estadoRecomendaciones={estadoRecomendaciones}
        confirmandoRecomendacion={confirmandoRecomendacionKey === keyPago}
        onConfirmarRecomendacion={() => {
          if (recomendacionPresupuesto) {
            onConfirmarRecomendacion(cxp, recomendacionPresupuesto);
          }
        }}
        sharedView={sharedView}
      />
    );
  }

  return (
    <div
      className={[
        "border border-l-4 border-slate-200 bg-white shadow-sm",
        getSectionAccent(id),
      ].join(" ")}
    >
      <div
        className={[
          "flex flex-col gap-2 border-b border-slate-100 px-4 py-3",
          sharedView ? "" : "md:flex-row md:items-center md:justify-between",
        ].join(" ")}
      >
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="mt-0.5 h-7 w-7 shrink-0 border border-slate-200 bg-white text-[15px] font-semibold leading-none text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
            title={collapsed ? "Expandir sección" : "Colapsar sección"}
          >
            {collapsed ? "+" : "−"}
          </button>

          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
              {titulo}
            </div>

            <div className="mt-1 text-[12px] text-slate-500">
              {descripcion}
            </div>
          </div>
        </div>

        <div className={sharedView ? "text-left" : "text-left md:text-right"}>
          <div className="text-[13px] font-semibold tabular-nums text-slate-950">
            {formatMoney(total)}
          </div>

          <div className="text-[11px] text-slate-400">
            {items.length} registros
          </div>
        </div>
      </div>

      {!collapsed && (
        <div className="grid gap-3 p-3">
          {items.length === 0 ? (
            <div className="border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-[12px] text-slate-400">
              No hay registros en esta sección.
            </div>
          ) : (
            <>
              {modoAgrupacion === "cronologico" && (
                <div className="grid gap-2">
                  {itemsCronologicos.map((cxp) => renderCxpRow(cxp))}
                </div>
              )}

              {modoAgrupacion === "presupuesto" &&
                agrupacionPorCodigo.grupos.map((grupo) => (
                <div
                  key={grupo.codigo}
                  className="border border-slate-200 bg-slate-50/70"
                >
                  <div
                    className={[
                      "flex flex-col gap-2 border-b border-slate-200 bg-white px-3 py-2",
                      sharedView
                        ? ""
                        : "md:flex-row md:items-center md:justify-between",
                    ].join(" ")}
                  >
                    <div className="min-w-0">
                      <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Código presupuestario asignado
                      </div>

                      <div className="mt-1 truncate text-[13px] font-semibold tabular-nums text-slate-950">
                        {grupo.codigo}
                      </div>
                    </div>

                    <div className="shrink-0 border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
                      {grupo.items.length} CxP
                    </div>
                  </div>

                  <div className="grid gap-2 p-2">
                    {grupo.items.map((cxp) => renderCxpRow(cxp))}
                  </div>
                </div>
                ))}

              {modoAgrupacion === "presupuesto" &&
                agrupacionPorCodigo.sinCodigoUnico.length > 0 && (
                <div className="border border-dashed border-slate-200 bg-white">
                  <div
                    className={[
                      "flex flex-col gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2",
                      sharedView
                        ? ""
                        : "md:flex-row md:items-center md:justify-between",
                    ].join(" ")}
                  >
                    <div>
                      <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Sin agrupación por código único
                      </div>

                      <div className="mt-1 text-[12px] text-slate-500">
                        CxP sin código presupuestario o con más de un código
                        asignado.
                      </div>
                    </div>

                    <div className="shrink-0 border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600">
                      {agrupacionPorCodigo.sinCodigoUnico.length} CxP
                    </div>
                  </div>

                  <div className="grid gap-2 p-2">
                    {agrupacionPorCodigo.sinCodigoUnico.map((cxp) =>
                      renderCxpRow(cxp)
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function CxpCompactRow({
  cxp,
  expanded,
  seleccionadoPago,
  puedeSeleccionarsePago,
  menuOpen,
  actions,
  documentos,
  onToggleMenu,
  onToggleDetalle,
  onToggleSeleccionPago,
  onSubsanarDocumento,
  onContextMenu,
  recomendacionPresupuesto,
  estadoRecomendaciones,
  confirmandoRecomendacion,
  onConfirmarRecomendacion,
  sharedView = false,
}: {
  cxp: CXP;
  expanded: boolean;
  seleccionadoPago: boolean;
  puedeSeleccionarsePago: boolean;
  menuOpen: boolean;
  actions: CxpAction[];
  documentos?: DocumentoCxp[];
  onToggleMenu: (event: MouseEvent<HTMLButtonElement>) => void;
  onToggleDetalle: () => void;
  onToggleSeleccionPago: () => void;
  onSubsanarDocumento: (documento: DocumentoCxp) => void;
  onContextMenu: (event: MouseEvent<HTMLDivElement>) => void;
  recomendacionPresupuesto?: RecomendacionPresupuestoSesion;
  estadoRecomendaciones: EstadoRecomendacionesSesion;
  confirmandoRecomendacion: boolean;
  onConfirmarRecomendacion: () => void;
  sharedView?: boolean;
}) {
  const enabledActions = actions.filter((action) => action.enabled);
  const compromisoIndicator = getCompromisoIndicator(cxp);
  const codigoPresupuestario = getCodigosRecomendacionValue(cxp);
  const documentosPendientes =
    documentos?.filter((documento) => documento.estado !== "CUMPLIDO").length ??
    0;

  return (
    <div
      onContextMenu={onContextMenu}
      className={[
        "relative border transition",
        getCxpRowToneClass(cxp),
      ].join(" ")}
    >
      <div className="grid grid-cols-1 items-stretch gap-3 p-3 md:min-w-[760px] md:grid-cols-[minmax(0,1fr)_150px_150px_44px]">
        <div className="min-w-0">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[auto_1fr] md:gap-3">
            <div className="hidden items-center gap-2 pt-0.5 md:flex">
              <input
                type="checkbox"
                checked={seleccionadoPago}
                disabled={!puedeSeleccionarsePago && !seleccionadoPago}
                onChange={onToggleSeleccionPago}
                title={
                  !cxp.puede_pagar_con_compromiso
                    ? "Esta CxP no puede seleccionarse para pago"
                    : "Seleccionar para pago multiple"
                }
                className="h-4 w-4 accent-emerald-700 disabled:cursor-not-allowed disabled:opacity-35"
              />

              <button
                type="button"
                onClick={onToggleDetalle}
                className="h-6 w-6 border border-slate-200 bg-white text-[14px] leading-none text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
                title={expanded ? "Ocultar detalle" : "Ver detalle"}
              >
                {expanded ? "-" : "+"}
              </button>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={[
                    "inline-block border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]",
                    compromisoIndicator.className,
                  ].join(" ")}
                >
                  {compromisoIndicator.label}
                </span>

                <span className="text-[13px] font-semibold tabular-nums text-slate-950 md:text-[12px]">
                  CxP #{cxp.no_cxp}
                </span>

                <span className="text-[11px] text-slate-400">
                  {formatDate(cxp.fecha)}
                </span>
              </div>

              <div className="mt-2 truncate text-[15px] font-semibold text-slate-950 md:text-[13px]">
                {cxp.beneficiario_nombre}
              </div>

              <div className="mt-1 line-clamp-3 text-[13px] leading-5 text-slate-600 md:line-clamp-2 md:text-[12px]">
                {cxp.descripcion || "Sin descripcion"}
              </div>

              {codigoPresupuestario && (
                <div className="mt-2 inline-flex max-w-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold tabular-nums text-slate-600">
                  <span className="truncate">{codigoPresupuestario}</span>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 border border-slate-200 bg-white px-3 py-2.5 md:hidden">
            <div className="text-[9px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Saldo pendiente
            </div>
            <div className="mt-1 text-[20px] font-semibold tabular-nums text-slate-950">
              {formatMoney(getSaldoRealCxp(cxp))}
            </div>
          </div>

          <div className="mt-3 hidden grid-cols-3 gap-2 md:grid">
            <MiniAmount
              label="Obligacion"
              value={formatMoney(getSaldoRealCxp(cxp))}
            />

            <MiniAmount
              label="Comprometido"
              value={formatMoney(cxp.monto_comprometido)}
            />

            <MiniAmount
              label="Saldo CxP"
              value={formatMoney(getSaldoRealCxp(cxp))}
            />
          </div>
        </div>

        <div className="relative z-10 isolate w-full min-w-0 self-stretch overflow-hidden md:w-[150px] md:max-w-[150px]">
          <RecomendacionRail
            cxp={cxp}
            recomendacionPresupuesto={recomendacionPresupuesto}
            estadoRecomendaciones={estadoRecomendaciones}
            confirmando={confirmandoRecomendacion}
            onConfirmar={onConfirmarRecomendacion}
          />
        </div>

        <div className="hidden md:block">
          <DocumentosCxpButtons
            documentos={documentos}
            onSubsanar={onSubsanarDocumento}
          />
        </div>

        <div className="relative hidden justify-end md:flex">
          <button
            type="button"
            onClick={onToggleMenu}
            className="h-8 w-8 border border-slate-200 bg-white text-[16px] font-semibold leading-none text-slate-500 transition hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950"
            title="Acciones"
          >
            ...
          </button>

          {menuOpen && (
            <div
              onClick={(event) => event.stopPropagation()}
              className="absolute right-0 top-9 z-30 w-[230px] border border-slate-200 bg-white py-1 shadow-lg"
            >
              {enabledActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => action.onClick()}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-slate-700 hover:bg-slate-50"
                >
                  <span className={`h-1.5 w-1.5 ${getToneDot(action.tone)}`} />
                  {action.label}
                </button>
              ))}

              {enabledActions.length === 0 && (
                <div className="px-3 py-2 text-[12px] text-slate-400">
                  Sin acciones disponibles
                </div>
              )}
            </div>
          )}
        </div>

        <details className="border border-slate-200 bg-white md:hidden">
          <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 text-[12px] font-semibold text-slate-700">
            <span>Más opciones</span>
            <span className="text-[10px] font-medium text-slate-400">
              {documentosPendientes > 0
                ? `${documentosPendientes} documento(s) pendiente(s)`
                : "Acciones secundarias"}
            </span>
          </summary>

          <div className="grid gap-3 border-t border-slate-200 bg-slate-50 p-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="flex min-h-11 items-center gap-2 border border-slate-200 bg-white px-3 text-[11px] font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={seleccionadoPago}
                  disabled={!puedeSeleccionarsePago && !seleccionadoPago}
                  onChange={onToggleSeleccionPago}
                  className="h-4 w-4 accent-emerald-700 disabled:cursor-not-allowed disabled:opacity-35"
                />
                Seleccionar para pago
              </label>

              <button
                type="button"
                onClick={onToggleDetalle}
                className="min-h-11 border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                {expanded ? "Ocultar detalle" : "Ver detalle completo"}
              </button>
            </div>

            <div>
              <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Documentos
              </div>
              <DocumentosCxpButtons
                documentos={documentos}
                onSubsanar={onSubsanarDocumento}
              />
            </div>

            {enabledActions.length > 0 && (
              <div>
                <div className="mb-1.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Otras acciones
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {enabledActions.map((action) => (
                    <button
                      key={action.label}
                      type="button"
                      onClick={action.onClick}
                      className="flex min-h-11 items-center gap-2 border border-slate-200 bg-white px-3 text-left text-[11px] font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                    >
                      <span className={`h-1.5 w-1.5 ${getToneDot(action.tone)}`} />
                      {action.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>
      </div>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-3 py-3">
          <DetalleCxp cxp={cxp} sharedView={sharedView} />
        </div>
      )}
    </div>
  );
}
function MiniAmount({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-slate-100 bg-slate-50 px-2 py-2">
      <div className="text-[9px] font-medium uppercase tracking-[0.14em] text-slate-400">
        {label}
      </div>

      <div className="mt-1 truncate text-[11px] font-semibold tabular-nums text-slate-800">
        {value}
      </div>
    </div>
  );
}

function RecomendacionRail({
  cxp,
  recomendacionPresupuesto,
  estadoRecomendaciones,
  confirmando,
  onConfirmar,
}: {
  cxp: CXP;
  recomendacionPresupuesto?: RecomendacionPresupuestoSesion;
  estadoRecomendaciones: EstadoRecomendacionesSesion;
  confirmando: boolean;
  onConfirmar: () => void;
}) {
  const sinCompromiso = Number(cxp.monto_comprometido ?? 0) <= 0;

  if (sinCompromiso) {
    if (!recomendacionPresupuesto) {
      const analizando = estadoRecomendaciones === "procesando";

      return (
        <div
          className={[
            "grid min-h-[62px] w-full min-w-0 place-items-center overflow-hidden border px-2 text-center text-[10px] font-semibold break-all whitespace-normal",
            analizando
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-slate-200 bg-slate-50 text-slate-500",
          ].join(" ")}
        >
          {analizando ? "Analizando presupuesto..." : "Sin sugerencia disponible"}
        </div>
      );
    }

    const ruta = [
      ["Programa", recomendacionPresupuesto.programa],
      ["Subprograma", recomendacionPresupuesto.subprograma],
      ["Proyecto", recomendacionPresupuesto.proyecto],
      ["Actividad", recomendacionPresupuesto.actividad],
      ["Obra", recomendacionPresupuesto.obra],
    ] as const;

    return (
      <div className="w-full min-w-0 max-w-full">
        <div className="border border-blue-200 bg-blue-50 p-3 md:hidden">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-blue-700">
            Recomendación presupuestaria
          </div>

          <div className="mt-2 break-all text-[15px] font-bold leading-5 tabular-nums text-blue-950">
            {recomendacionPresupuesto.codigoPresupuestario}
          </div>

          <div className="mt-2 text-[12px] leading-5 text-blue-900/80">
            {recomendacionPresupuesto.explicacion}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="border border-blue-200 bg-white/70 px-2 py-2">
              <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-blue-500">
                Confianza
              </div>
              <div className="mt-1 text-[13px] font-semibold text-blue-950">
                {recomendacionPresupuesto.confianza}%
              </div>
            </div>

            <div className="border border-blue-200 bg-white/70 px-2 py-2">
              <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-blue-500">
                Saldo disponible
              </div>
              <div className="mt-1 text-[13px] font-semibold tabular-nums text-blue-950">
                {formatMoney(recomendacionPresupuesto.saldoDisponible)}
              </div>
            </div>
          </div>

          <button
            type="button"
            disabled={confirmando}
            onClick={onConfirmar}
            className="mt-3 min-h-12 w-full border border-blue-700 bg-blue-700 px-4 py-3 text-[13px] font-semibold text-white transition active:bg-blue-900 disabled:cursor-wait disabled:opacity-60"
          >
            {confirmando ? "Confirmando..." : "Confirmar recomendación"}
          </button>

          <div className="mt-2 text-center text-[10px] leading-4 text-blue-800/75">
            Registrará un compromiso por {formatMoney(Number(cxp.haber ?? 0))}.
          </div>
        </div>

        <div className="group hidden min-h-[62px] w-full min-w-0 max-w-full content-start overflow-hidden md:grid">
          <button
            type="button"
            disabled={confirmando}
            onClick={onConfirmar}
            className="w-full min-w-0 max-w-full overflow-hidden border border-blue-300 bg-blue-50 px-2 py-2 text-center text-blue-800 transition hover:border-blue-500 hover:bg-blue-100 disabled:cursor-wait disabled:opacity-60"
            title="Presione para convertir esta recomendacion en compromiso presupuestario"
          >
            <span className="block text-[8px] font-semibold uppercase tracking-[0.12em] opacity-75">
              Recomendacion presupuestaria
            </span>
            <span className="mt-1 block max-w-full whitespace-normal break-all text-[10px] font-bold leading-tight tabular-nums">
              {confirmando
                ? "Comprometiendo..."
                : recomendacionPresupuesto.codigoPresupuestario}
            </span>
          </button>

          <div className="pointer-events-none relative z-20 mt-1 hidden w-full min-w-0 max-w-full overflow-hidden border border-slate-200 bg-slate-950 p-2 text-left text-[9px] leading-4 text-white shadow-sm group-hover:block">
            <div className="font-semibold text-blue-200">
              Origen del renglon recomendado
            </div>

            <div className="mt-2 grid gap-1">
              {ruta.map(([label, value]) => (
                <div key={label}>
                  <span className="text-slate-400">{label}: </span>
                  <span className="break-all">{value ?? "Sin asignar"}</span>
                </div>
              ))}
            </div>

            <div className="mt-2 border-t border-slate-700 pt-2 text-slate-300">
              {recomendacionPresupuesto.explicacion}
            </div>

            <div className="mt-1 text-slate-400">
              Confianza: {recomendacionPresupuesto.confianza}% · Saldo: {" "}
              {formatMoney(recomendacionPresupuesto.saldoDisponible)}
            </div>

            <div className="mt-2 font-medium text-amber-200">
              Al presionar el codigo, se registra el compromiso por el monto del
              haber.
            </div>
          </div>
        </div>
      </div>
    );
  }

  const recomendaciones = [
    {
      label: "Codigos",
      value: cxp.estado_codigos ?? "Sin analisis",
      className: getCoberturaRailClass(cxp.estado_codigos),
    },
    {
      label: "Grupos",
      value: cxp.estado_grupos ?? "Sin analisis",
      className: getCoberturaRailClass(cxp.estado_grupos),
    },
  ];

  return (
    <div className="grid min-h-[62px] content-stretch gap-1.5">
      {recomendaciones.map((item) => (
        <div
          key={item.label}
          className={[
            "grid min-h-[44px] w-full place-items-center border px-2 py-1.5 text-center",
            item.className,
          ].join(" ")}
        >
          <div className="min-w-0">
            <div className="text-[8px] font-semibold uppercase tracking-[0.12em] opacity-80">
              {item.label}
            </div>

            <div className="mt-0.5 text-[10px] font-semibold leading-tight">
              {item.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function DocumentosCxpButtons({
  documentos,
  onSubsanar,
}: {
  documentos?: DocumentoCxp[];
  onSubsanar: (documento: DocumentoCxp) => void;
}) {
  if (!documentos || documentos.length === 0) {
    return (
      <div className="border border-slate-200 bg-slate-50 px-2 py-1.5 text-[10px] font-medium text-slate-500">
        Sin requisitos documentales
      </div>
    );
  }

  return (
    <div className="grid gap-1.5">
      {documentos.map((doc) => {
        const cumplido = doc?.estado === "CUMPLIDO";

        return (
          <button
            key={doc.tipoDocumento}
            type="button"
            onClick={() => {
              if (!cumplido) onSubsanar(doc);
            }}
            className={[
              "w-full border px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-[0.06em] transition",
              cumplido
                ? "cursor-default border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700",
            ].join(" ")}
            title={
              cumplido
                ? `${doc.nombreDocumento}: cumplido`
                : `${doc.nombreDocumento}: pendiente. Presione para marcar cumplido.`
            }
          >
            {doc.nombreDocumento}: {cumplido ? "OK" : "Pend."}
          </button>
        );
      })}
    </div>
  );
}

function ContextualActionsMenu({
  x,
  y,
  actions,
  onClose,
}: {
  x: number;
  y: number;
  actions: CxpAction[];
  onClose: () => void;
}) {
  const enabledActions = actions.filter((action) => action.enabled);

  return (
    <div
      onClick={(event) => event.stopPropagation()}
      className="fixed z-[90] w-[230px] border border-slate-200 bg-white py-1 shadow-lg"
      style={{
        top: y,
        left: x,
      }}
    >
      {enabledActions.map((action) => (
        <button
          key={action.label}
          type="button"
          onClick={() => {
            action.onClick();
            onClose();
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] text-slate-700 hover:bg-slate-50"
        >
          <span className={`h-1.5 w-1.5 ${getToneDot(action.tone)}`} />
          {action.label}
        </button>
      ))}

      {enabledActions.length === 0 && (
        <div className="px-3 py-2 text-[12px] text-slate-400">
          Sin acciones disponibles
        </div>
      )}
    </div>
  );
}

function DetalleCxp({
  cxp,
  sharedView = false,
}: {
  cxp: CXP;
  sharedView?: boolean;
}) {
  const recomendacion = getRecomendacionValue(cxp);
  const motivoRecomendacion = getMotivoRecomendacionValue(cxp);
  const codigosRecomendacion = getCodigosRecomendacionValue(cxp);
  const montoBaseRecomendacion = getMontoBaseRecomendacionValue(cxp);

  return (
    <div className="border border-slate-200 bg-white">
      <div className="grid grid-cols-[1fr_auto] border-b border-slate-100 bg-white px-3 py-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700">
            Detalle de CxP
          </div>

          <div className="text-[11px] text-slate-500">
            Obligación, compromiso, pago, ejecución y recomendación financiera.
          </div>
        </div>

        <div className="text-right text-[11px] text-slate-500">
          CXP{" "}
          <span className="font-semibold tabular-nums text-slate-800">
            #{cxp.no_cxp}
          </span>
        </div>
      </div>

      <div
        className={[
          "grid grid-cols-1 border-b border-slate-100",
          sharedView ? "sm:grid-cols-2" : "md:grid-cols-4",
        ].join(" ")}
      >
        <DetalleMetric label="Beneficiario" value={cxp.beneficiario_nombre} />
        <DetalleMetric label="Obligación" value={formatMoney(getSaldoRealCxp(cxp))} />
        <DetalleMetric
          label="Comprometido"
          value={formatMoney(cxp.monto_comprometido)}
        />
        <DetalleMetric
          label="Saldo por comprometer"
          value={formatMoney(getSaldoRealCxp(cxp))}
          valueClass={getSaldoClass(Number(cxp.saldo_por_comprometer ?? 0))}
        />
      </div>

      <div
        className={[
          "grid grid-cols-1 border-b border-slate-100",
          sharedView ? "sm:grid-cols-2" : "md:grid-cols-4",
        ].join(" ")}
      >
        <DetalleMetric
          label="Orden de pago"
          value={cxp.no_orden_pago ? `#${cxp.no_orden_pago}` : "No registrada"}
        />
        <DetalleMetric label="Pagado" value={formatMoney(cxp.monto_pagado)} />
        <DetalleMetric
          label="Ejecutado"
          value={formatMoney(cxp.monto_ejecutado_presupuestario)}
        />
        <DetalleMetric
          label="Saldo por ejecutar"
          value={formatMoney(cxp.saldo_por_ejecutar)}
          valueClass={getSaldoClass(Number(cxp.saldo_por_ejecutar ?? 0))}
        />
      </div>

      {recomendacion && (
        <div className="border-b border-slate-100 bg-white px-3 py-3">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Recomendación financiera
            </div>

            <span
              className={[
                "inline-block border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]",
                getRecomendacionClass(recomendacion),
              ].join(" ")}
            >
              {recomendacion}
            </span>
          </div>

          <div
            className={[
              "grid grid-cols-1 gap-2",
              sharedView ? "" : "md:grid-cols-2",
            ].join(" ")}
          >
            <DetalleMetric
              label="Código presupuestario"
              value={codigosRecomendacion ?? "N/D"}
            />

            <DetalleMetric
              label="Monto base"
              value={formatMoney(montoBaseRecomendacion)}
            />
          </div>

          <div
            className={[
              "mt-2 grid grid-cols-1 gap-2",
              sharedView ? "" : "md:grid-cols-4",
            ].join(" ")}
          >
            <DetalleMetric
              label="Estado codigos"
              value={cxp.estado_codigos ?? "N/D"}
            />

            <DetalleMetric
              label="Cubierto codigos"
              value={formatMoney(cxp.monto_cubierto_por_codigos)}
            />

            <DetalleMetric
              label="Estado grupos"
              value={cxp.estado_grupos ?? "N/D"}
            />

            <DetalleMetric
              label="Cubierto grupos"
              value={formatMoney(cxp.monto_cubierto_por_grupos)}
            />
          </div>

          <div className="mt-3 text-[12px] leading-5 text-slate-600">
            {motivoRecomendacion || "No se registró motivo financiero."}
          </div>
        </div>
      )}

      <div
        className={[
          "grid grid-cols-1",
          sharedView ? "" : "md:grid-cols-[1fr_260px]",
        ].join(" ")}
      >
        <div className="px-3 py-3">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Motivo / criterio operativo
          </div>

          <div className="text-[12px] leading-5 text-slate-700">
            {cxp.motivo_pago || "No se registró motivo para esta decisión."}
          </div>
        </div>

        <div
          className={[
            "border-t border-slate-100 px-3 py-3",
            sharedView ? "" : "md:border-l md:border-t-0",
          ].join(" ")}
        >
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Estado operativo
          </div>

          <span
            className={[
              "inline-block border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.08em]",
              getEstadoClass(cxp.estado_operativo),
            ].join(" ")}
          >
            {getEstadoLabel(cxp.estado_operativo)}
          </span>
        </div>
      </div>
    </div>
  );
}

function DetalleMetric({
  label,
  value,
  valueClass = "text-slate-900",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="border-r border-slate-100 px-3 py-2 last:border-r-0">
      <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
        {label}
      </div>

      <div className={`mt-0.5 text-[12px] font-semibold ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

function ModalCompromiso({
  cxp,
  guardando,
  presupuestoTree,
  cargandoPresupuesto,
  onClose,
  onGuardar,
}: {
  cxp: CXP;
  guardando: boolean;
  presupuestoTree: Map<string, PresupuestoNode>;
  cargandoPresupuesto: boolean;
  onClose: () => void;
  onGuardar: (input: {
    id?: string;
    codigo_presupuestario: string;
    monto: number;
    actividad_id?: string | null;
    proyecto_id?: string | null;
    ejercicio_fiscal?: number | null;
    fecha_ejecucion?: string | null;
  }) => void;
}) {
  const [selectorAbierto, setSelectorAbierto] = useState(false);
  const [seleccion, setSeleccion] =
    useState<CodigoPresupuestarioSeleccionado | null>(null);

  const [monto, setMonto] = useState(String(getSaldoRealCxp(cxp)));
  const [fechaCompromiso, setFechaCompromiso] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [compromisos, setCompromisos] = useState<CompromisoPresupuestarioCXP[]>(
    []
  );
  const [indiceEditando, setIndiceEditando] = useState<number | null>(null);
  const [cargandoCompromisos, setCargandoCompromisos] = useState(false);
  const [error, setError] = useState("");

  const saldoCxp = getSaldoRealCxp(cxp);
  const montoNumerico = Number(monto);
  const saldoPresupuesto = Number(seleccion?.saldo ?? 0);
  const compromisoEditando =
    indiceEditando === null ? null : compromisos[indiceEditando] ?? null;
  const totalCompromisos = compromisos.reduce(
    (acc, item) => acc + Number(item.monto_ejecutado || 0),
    0
  );
  const montoCompromisoEditando = Number(
    compromisoEditando?.monto_ejecutado ?? 0
  );
  const totalOtrosCompromisos = Math.max(
    totalCompromisos - montoCompromisoEditando,
    0
  );
  const montoMaximoPermitido = Math.max(saldoCxp - totalOtrosCompromisos, 0);
  const codigoActual =
    seleccion?.codigo_presupuestario ??
    compromisoEditando?.codigo_presupuestario ??
    null;

  const presupuestoInsuficiente =
    seleccion !== null && montoNumerico > saldoPresupuesto;

  const cargarCompromisos = useCallback(async () => {
    setCargandoCompromisos(true);
    setError("");

    try {
      const data = await obtenerCompromisosCXP({
        no_cxp: cxp.no_cxp,
        tipo_movimiento: cxp.tipo_movimiento,
      });

      setCompromisos(
        data.map((item) => ({
          ...item,
          monto_ejecutado: Number(item.monto_ejecutado || 0),
        }))
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar los compromisos."
      );
    } finally {
      setCargandoCompromisos(false);
    }
  }, [cxp.no_cxp, cxp.tipo_movimiento]);

  useEffect(() => {
    void cargarCompromisos();
  }, [cargarCompromisos]);

  function limpiarFormulario() {
    setSeleccion(null);
    setIndiceEditando(null);
    setMonto(String(getSaldoRealCxp(cxp)));
    setFechaCompromiso(new Date().toISOString().slice(0, 10));
    setError("");
  }

  function editarCompromiso(index: number) {
    const compromiso = compromisos[index];

    if (!compromiso) return;

    setIndiceEditando(index);
    setSeleccion(null);
    setMonto(String(Number(compromiso.monto_ejecutado || 0).toFixed(2)));
    setFechaCompromiso(
      compromiso.fecha_ejecucion
        ? String(compromiso.fecha_ejecucion).slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    );
    setError("");
  }

  function guardar() {
    setError("");

    if (!seleccion && !compromisoEditando) {
      setError("Debe seleccionar un código presupuestario.");
      return;
    }

    if (!monto || Number.isNaN(montoNumerico) || montoNumerico <= 0) {
      setError("El monto debe ser mayor a cero.");
      return;
    }

    if (montoNumerico > montoMaximoPermitido) {
      setError(
        `El monto no puede superar ${formatMoney(
          montoMaximoPermitido
        )}, considerando los otros compromisos de esta CxP.`
      );
      return;
    }

    if (!codigoActual) {
      setError("Debe seleccionar un codigo presupuestario.");
      return;
    }

    onGuardar({
      id: compromisoEditando?.id,
      codigo_presupuestario: codigoActual,
      monto: montoNumerico,
      actividad_id:
        seleccion?.actividad_id ?? compromisoEditando?.actividad_id ?? null,
      proyecto_id:
        seleccion?.proyecto_id ?? compromisoEditando?.proyecto_id ?? null,
      ejercicio_fiscal:
        seleccion?.ejercicio_fiscal ??
        compromisoEditando?.ejercicio_fiscal ??
        2026,
      fecha_ejecucion: fechaCompromiso,
    });
  }

  return (
    <>
      <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/25 px-4">
        <div className="w-full max-w-[680px] border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 px-4 py-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {compromisoEditando
                ? "Editar compromiso presupuestario"
                : "Asignar compromiso presupuestario"}
            </div>

            <div className="mt-1 text-[16px] font-semibold text-slate-950">
              CxP #{cxp.no_cxp}
            </div>

            <div className="mt-1 text-[12px] text-slate-500">
              {cxp.beneficiario_nombre}
            </div>
          </div>

          <div className="grid gap-3 px-4 py-4">
            <div className="grid grid-cols-3 gap-2 border border-slate-100 bg-slate-50 px-3 py-3 text-[12px]">
              <div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
                  Obligación
                </div>
                <div className="mt-1 font-semibold text-slate-900">
                  {formatMoney(cxp.haber)}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
                  Comprometido
                </div>
                <div className="mt-1 font-semibold text-slate-900">
                  {formatMoney(cxp.monto_comprometido)}
                </div>
              </div>

              <div>
                <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
                  Saldo CxP
                </div>
                <div className="mt-1 font-semibold text-amber-700">
                  {formatMoney(saldoCxp)}
                </div>
              </div>
            </div>

            <div className="border border-slate-200">
              <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Compromisos existentes
              </div>

              <div className="max-h-[180px] overflow-auto">
                {cargandoCompromisos ? (
                  <div className="px-3 py-4 text-center text-[12px] text-slate-400">
                    Cargando compromisos...
                  </div>
                ) : compromisos.length > 0 ? (
                  compromisos.map((item, index) => {
                    const active = indiceEditando === index;

                    return (
                      <div
                        key={`${item.id ?? item.codigo_presupuestario}-${index}`}
                        className={[
                          "grid grid-cols-[1fr_auto] gap-2 border-b border-slate-100 px-3 py-2 last:border-b-0",
                          active ? "bg-[#e6f5ef]" : "bg-white",
                        ].join(" ")}
                      >
                        <div className="min-w-0">
                          <div className="break-words text-[11px] font-semibold text-slate-800">
                            {item.codigo_presupuestario}
                          </div>
                          <div className="mt-0.5 text-[12px] font-semibold tabular-nums text-slate-950">
                            {formatMoney(item.monto_ejecutado)}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => editarCompromiso(index)}
                          className="h-7 border border-slate-300 bg-white px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-700 transition hover:border-[#00be87] hover:text-[#006b55]"
                        >
                          Editar
                        </button>
                      </div>
                    );
                  })
                ) : (
                  <div className="px-3 py-4 text-center text-[12px] text-slate-400">
                    Sin compromisos presupuestarios.
                  </div>
                )}
              </div>

              <div className="border-t border-slate-200 bg-white px-3 py-2 text-right text-[12px] text-slate-500">
                Total comprometido:{" "}
                <span className="font-semibold tabular-nums text-slate-950">
                  {formatMoney(totalCompromisos)}
                </span>
              </div>
            </div>

            <label className="grid gap-1 text-[12px]">
              <span className="font-medium text-slate-700">
                {compromisoEditando
                  ? "Nuevo monto comprometido"
                  : "Monto a comprometer"}
              </span>

              <input
                value={monto}
                onChange={(e) => setMonto(e.target.value)}
                type="number"
                step="0.01"
                min="0"
                className="h-9 border border-slate-200 px-3 text-[12px] outline-none focus:border-slate-500"
              />
            </label>

            <label className="grid gap-1 text-[12px]">
              <span className="font-medium text-slate-700">
                Fecha de compromiso
              </span>

              <input
                value={fechaCompromiso}
                onChange={(event) => setFechaCompromiso(event.target.value)}
                type="date"
                className="h-9 border border-slate-200 px-3 text-[12px] outline-none focus:border-slate-500"
              />
            </label>

            <div className="border border-slate-200 bg-slate-50 px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Código presupuestario
                  </div>

                  <div className="mt-1 text-[12px] text-slate-500">
                    {compromisoEditando
                      ? "Seleccione otro codigo si desea cambiar el compromiso."
                      : "Seleccione el codigo desde el arbol presupuestario."}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSelectorAbierto(true)}
                  className="border border-slate-900 bg-slate-900 px-3 py-2 text-[12px] font-medium text-white transition hover:bg-slate-700"
                >
                  {compromisoEditando ? "Cambiar codigo" : "Seleccionar codigo"}
                </button>
              </div>

              {seleccion ? (
                <div className="mt-3 border border-slate-100 bg-white px-3 py-3">
                  <div className="text-[13px] font-semibold text-slate-950">
                    {seleccion.codigo_presupuestario}
                  </div>

                  <div className="mt-1 text-[12px] leading-5 text-slate-600">
                    {seleccion.nombre}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400">Actividad:</span>{" "}
                      <span className="font-medium text-slate-700">
                        {seleccion.actividad_id ?? "N/D"}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400">Proyecto:</span>{" "}
                      <span className="font-medium text-slate-700">
                        {seleccion.proyecto_id ?? "N/D"}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400">Ejercicio:</span>{" "}
                      <span className="font-medium text-slate-700">
                        {seleccion.ejercicio_fiscal ?? 2026}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400">Saldo:</span>{" "}
                      <span className="font-semibold text-slate-900">
                        {formatMoney(seleccion.saldo)}
                      </span>
                    </div>
                  </div>

                  {presupuestoInsuficiente && (
                    <div className="mt-3 border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800">
                      Advertencia: el monto a comprometer supera el saldo
                      disponible del código presupuestario seleccionado.
                    </div>
                  )}
                </div>
              ) : compromisoEditando ? (
                <div className="mt-3 border border-amber-100 bg-white px-3 py-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-700">
                    Codigo actual
                  </div>

                  <div className="mt-1 break-words text-[13px] font-semibold text-slate-950">
                    {compromisoEditando.codigo_presupuestario}
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400">Actividad:</span>{" "}
                      <span className="font-medium text-slate-700">
                        {compromisoEditando.actividad_id ?? "N/D"}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400">Proyecto:</span>{" "}
                      <span className="font-medium text-slate-700">
                        {compromisoEditando.proyecto_id ?? "N/D"}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400">Ejercicio:</span>{" "}
                      <span className="font-medium text-slate-700">
                        {compromisoEditando.ejercicio_fiscal ?? 2026}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-400">Monto actual:</span>{" "}
                      <span className="font-semibold text-slate-900">
                        {formatMoney(montoCompromisoEditando)}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="mt-3 border border-dashed border-slate-200 bg-white px-3 py-4 text-[12px] text-slate-400">
                  No hay código seleccionado.
                </div>
              )}
            </div>

            {error && (
              <div className="border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">
                {error}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
            <button
              type="button"
              onClick={limpiarFormulario}
              disabled={guardando}
              className="border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-700 transition hover:border-slate-400 disabled:opacity-50"
            >
              Limpiar
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={guardando}
              className="border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-700 transition hover:border-slate-400 disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              disabled={guardando}
              onClick={guardar}
              className="border border-slate-900 bg-slate-900 px-3 py-2 text-[12px] font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
            >
              {guardando
                ? "Guardando..."
                : compromisoEditando
                ? "Guardar cambio"
                : "Agregar compromiso"}
            </button>
          </div>
        </div>
      </div>

      {selectorAbierto && (
        <SelectorPresupuestoDialog
          tree={presupuestoTree}
          cargando={cargandoPresupuesto}
          seleccionado={codigoActual}
          onClose={() => setSelectorAbierto(false)}
          onSelect={(codigo) => {
            setSeleccion(codigo);
            setSelectorAbierto(false);
          }}
        />
      )}
    </>
  );
}

function SelectorPresupuestoDialog({
  tree,
  cargando,
  seleccionado,
  onClose,
  onSelect,
}: {
  tree: Map<string, PresupuestoNode>;
  cargando: boolean;
  seleccionado: string | null;
  onClose: () => void;
  onSelect: (codigo: CodigoPresupuestarioSeleccionado) => void;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/30 px-4">
      <div className="grid h-[88vh] w-full max-w-[1180px] grid-rows-[auto_1fr] border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
              Selector presupuestario
            </div>

            <div className="mt-1 text-[16px] font-semibold text-slate-950">
              Seleccionar código presupuestario
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-700 transition hover:border-slate-400"
          >
            Cerrar
          </button>
        </div>

        <div className="min-h-0 p-4">
          {cargando ? (
            <div className="grid h-full place-items-center border border-slate-200 bg-slate-50 text-[12px] text-slate-500">
              Cargando árbol presupuestario...
            </div>
          ) : tree.size > 0 ? (
            <SelectorPresupuestoTree
              tree={tree}
              seleccionado={seleccionado}
              onSelect={onSelect}
            />
          ) : (
            <div className="grid h-full place-items-center border border-slate-200 bg-slate-50 text-[12px] text-slate-500">
              No hay presupuesto cargado para seleccionar códigos.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ModalPagoMultiple({
  cxps,
  guardando,
  onClose,
  onProcesar,
}: {
  cxps: CXP[];
  guardando: boolean;
  onClose: () => void;
  onProcesar: (input: {
    no_cheque: number;
    fecha_pago: string;
    cuenta: string;
    descripcion_pago: string;
    pagos: Array<{
      no_cxp: number;
      tipo_movimiento: string | null;
      monto_pago: number;
    }>;
  }) => void;
}) {
  const [noCheque, setNoCheque] = useState("");
  const [fechaPago, setFechaPago] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [cuenta, setCuenta] = useState("Bancos");
  const [descripcionPago, setDescripcionPago] = useState("");
  const [error, setError] = useState("");
  const [generandoDescripcion, setGenerandoDescripcion] = useState(false);
  const [montosPago, setMontosPago] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};

    cxps.forEach((cxp) => {
      initial[getCxpPagoKey(cxp)] = getSaldoRealCxp(cxp).toFixed(2);
    });

    return initial;
  });

  const pagos = useMemo(() => {
    return cxps.map((cxp) => ({
      no_cxp: cxp.no_cxp,
      tipo_movimiento: cxp.tipo_movimiento,
      monto_pago: parseMoneyInput(montosPago[getCxpPagoKey(cxp)] ?? ""),
      saldo_real: getSaldoRealCxp(cxp),
    }));
  }, [cxps, montosPago]);

  const totalPago = pagos.reduce((acc, pago) => acc + pago.monto_pago, 0);
  const totalSaldoReal = cxps.reduce((acc, cxp) => acc + getSaldoRealCxp(cxp), 0);

  const beneficiario =
    cxps.length > 0 ? cxps[0].beneficiario_nombre : "Sin beneficiario";

  async function generarDescripcionBase() {
    setError("");

    if (cxps.length === 0) {
      setError("Debe seleccionar al menos una CxP.");
      return;
    }

    const tieneDescripcion = cxps.some((cxp) => cxp.descripcion?.trim());

    if (!tieneDescripcion) {
      setDescripcionPago("Pago de obligaciones registradas en cuentas por pagar.");
      return;
    }

    setGenerandoDescripcion(true);

    try {
      const res = await fetch("/api/generar-descripcion-pago-cxp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          cuenta_pago: cuenta.trim() || "Bancos",
          fecha_pago: fechaPago || null,
          total_pago: Number(totalPago.toFixed(2)),
          cxps: cxps.map((cxp) => ({
            no_cxp: cxp.no_cxp,
            tipo_movimiento: cxp.tipo_movimiento,
            fecha: cxp.fecha,
            descripcion: cxp.descripcion,
            cuenta: cxp.cuenta,
            monto_obligacion: Number(cxp.haber ?? 0),
            no_orden_pago: cxp.no_orden_pago,
            monto_pago: (() => {
              const montoPago = parseMoneyInput(
                montosPago[getCxpPagoKey(cxp)] ?? ""
              );

              return Number.isFinite(montoPago)
                ? Number(montoPago.toFixed(2))
                : null;
            })(),
          })),
        }),
      });

      const data = (await res.json()) as {
        descripcion?: string;
        error?: string;
      };

      if (!res.ok) {
        throw new Error(data.error || "No se pudo generar la descripcion.");
      }

      if (!data.descripcion?.trim()) {
        throw new Error("La IA no devolvio una descripcion valida.");
      }

      setDescripcionPago(data.descripcion.trim());
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "No se pudo generar la descripcion con IA.";
      setError(message);
    } finally {
      setGenerandoDescripcion(false);
    }
  }

  function procesar() {
    setError("");

    const chequeNumerico = Number(noCheque);

    if (cxps.length === 0) {
      setError("Debe seleccionar al menos una CxP.");
      return;
    }

    if (!noCheque || Number.isNaN(chequeNumerico) || chequeNumerico <= 0) {
      setError("Debe ingresar un número de cheque válido.");
      return;
    }

    if (!fechaPago) {
      setError("Debe indicar la fecha del pago.");
      return;
    }

    if (!cuenta.trim()) {
      setError("Debe indicar la cuenta de pago.");
      return;
    }

    if (!descripcionPago.trim()) {
      setError("Debe ingresar una descripción general del egreso.");
      return;
    }

    if (pagos.some((pago) => !Number.isFinite(pago.monto_pago))) {
      setError("Todos los montos de pago deben ser numericos.");
      return;
    }

    if (pagos.some((pago) => pago.monto_pago <= 0)) {
      setError("Cada CxP seleccionada debe tener un monto de pago mayor a cero.");
      return;
    }

    if (
      pagos.some(
        (pago) =>
          Number(pago.monto_pago.toFixed(2)) >
          Number(pago.saldo_real.toFixed(2))
      )
    ) {
      setError("No puede pagar un monto mayor al saldo real de una CxP.");
      return;
    }

    onProcesar({
      no_cheque: chequeNumerico,
      fecha_pago: fechaPago,
      cuenta: cuenta.trim(),
      descripcion_pago: descripcionPago.trim(),
      pagos: pagos.map((pago) => ({
        no_cxp: pago.no_cxp,
        tipo_movimiento: pago.tipo_movimiento,
        monto_pago: Number(pago.monto_pago.toFixed(2)),
      })),
    });
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/25 px-4">
      <div className="grid h-[88vh] w-full max-w-[980px] grid-rows-[auto_1fr_auto] border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Pago múltiple de CxP
          </div>

          <div className="mt-1 text-[16px] font-semibold text-slate-950">
            Procesar egreso consolidado
          </div>

          <div className="mt-1 text-[12px] text-slate-500">
            {cxps.length} CxP seleccionadas · {formatMoney(totalPago)}
          </div>

          <div className="mt-2 max-w-3xl text-[12px] leading-5 text-slate-500">
            Puede escribir un monto menor al saldo real de cada CxP. Ese monto
            se registrara como egreso y se acumulara en el debe de la cuenta
            por pagar.
          </div>
        </div>

        <div className="min-h-0 overflow-auto">
          <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[360px_1fr]">
            <div className="grid gap-3">
              <div className="border border-slate-100 bg-slate-50 px-3 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Beneficiario
                </div>

                <div className="mt-1 text-[13px] font-semibold text-slate-950">
                  {beneficiario}
                </div>

                <div className="mt-2 text-[12px] text-slate-500">
                  Saldo real seleccionado:
                </div>

                <div className="mt-1 text-[18px] font-semibold tabular-nums text-slate-950">
                  {formatMoney(totalSaldoReal)}
                </div>

                <div className="mt-2 text-[12px] text-slate-500">
                  Pago a procesar:
                </div>

                <div className="mt-1 text-[18px] font-semibold tabular-nums text-emerald-700">
                  {formatMoney(totalPago)}
                </div>
              </div>

              <div className="border border-emerald-200 bg-emerald-50/70 px-3 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-700">
                  Montos a pagar
                </div>

                <div className="mt-2 grid gap-2">
                  {cxps.map((cxp) => {
                    const key = getCxpPagoKey(cxp);
                    const saldoReal = getSaldoRealCxp(cxp);

                    return (
                      <label
                        key={key}
                        className="grid gap-1 border border-emerald-100 bg-white px-2 py-2 text-[12px]"
                      >
                        <span className="flex items-center justify-between gap-2">
                          <span className="font-semibold tabular-nums text-slate-800">
                            CxP {cxp.no_cxp}
                          </span>

                          <span className="text-[11px] text-slate-500">
                            Saldo: {formatMoney(saldoReal)}
                          </span>
                        </span>

                        <input
                          value={montosPago[key] ?? ""}
                          onChange={(e) =>
                            setMontosPago((prev) => ({
                              ...prev,
                              [key]: e.target.value,
                            }))
                          }
                          type="text"
                          inputMode="decimal"
                          placeholder="0.00"
                          className="h-9 w-full border border-emerald-200 bg-white px-3 text-right text-[13px] font-semibold tabular-nums text-slate-950 outline-none focus:border-emerald-600"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>

              <label className="grid gap-1 text-[12px]">
                <span className="font-medium text-slate-700">
                  Número de cheque
                </span>

                <input
                  value={noCheque}
                  onChange={(e) => setNoCheque(e.target.value)}
                  type="number"
                  min="1"
                  placeholder="Ej. 1025"
                  className="h-9 border border-slate-200 px-3 text-[12px] outline-none focus:border-slate-500"
                />
              </label>

              <label className="grid gap-1 text-[12px]">
                <span className="font-medium text-slate-700">
                  Fecha del pago
                </span>

                <input
                  value={fechaPago}
                  onChange={(e) => setFechaPago(e.target.value)}
                  type="date"
                  className="h-9 border border-slate-200 px-3 text-[12px] outline-none focus:border-slate-500"
                />
              </label>

              <label className="grid gap-1 text-[12px]">
                <span className="font-medium text-slate-700">
                  Cuenta de pago
                </span>

                <input
                  value={cuenta}
                  onChange={(e) => setCuenta(e.target.value)}
                  placeholder="Bancos"
                  className="h-9 border border-slate-200 px-3 text-[12px] outline-none focus:border-slate-500"
                />
              </label>

              {error && (
                <div className="border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">
                  {error}
                </div>
              )}
            </div>

            <div className="grid min-h-0 grid-rows-[auto_1fr] gap-3">
              <div className="border border-slate-100 bg-slate-50 px-3 py-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      Descripción general del egreso
                    </div>

                    <div className="mt-1 text-[12px] text-slate-500">
                      Esta será la descripción del egreso consolidado.
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={generarDescripcionBase}
                    disabled={generandoDescripcion || guardando}
                    className="border border-slate-200 bg-white px-3 py-2 text-[11px] font-medium text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {generandoDescripcion
                      ? "Generando..."
                      : "Usar descripciones"}
                  </button>
                </div>

                <textarea
                  value={descripcionPago}
                  onChange={(e) => setDescripcionPago(e.target.value)}
                  placeholder="Ej. Compra de medicamentos para ayudas sociales."
                  className="h-28 w-full resize-none border border-slate-200 px-3 py-2 text-[12px] leading-5 outline-none focus:border-slate-500"
                />
              </div>

              <div className="min-h-0 overflow-hidden border border-slate-200">
                <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    CxP incluidas en el pago
                  </div>
                </div>

                <div className="h-full overflow-auto">
                  <table className="w-full min-w-[920px] border-collapse text-[12px]">
                    <thead className="sticky top-0 bg-white">
                      <tr className="border-b border-slate-100 text-left text-[10px] uppercase tracking-[0.14em] text-slate-400">
                        <th className="w-[90px] px-3 py-2">CxP</th>
                        <th className="px-3 py-2">Descripción</th>
                        <th className="w-[120px] px-3 py-2 text-right">
                          Obligacion
                        </th>
                        <th className="w-[120px] px-3 py-2 text-right">
                          Pagado
                        </th>
                        <th className="w-[120px] px-3 py-2 text-right">
                          Saldo real
                        </th>
                        <th className="w-[140px] px-3 py-2 text-right">
                          Monto a pagar
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {cxps.map((cxp) => {
                        const key = getCxpPagoKey(cxp);
                        const montoPagado = getMontoPagadoCxp(cxp);
                        const saldoReal = getSaldoRealCxp(cxp);

                        return (
                          <tr key={key} className="border-b border-slate-100">
                            <td className="px-3 py-2 font-semibold tabular-nums text-slate-900">
                              #{cxp.no_cxp}
                            </td>

                            <td className="px-3 py-2 text-slate-600">
                              <div className="line-clamp-2">
                                {cxp.descripcion || "Sin descripcion"}
                              </div>

                              <div className="mt-1 text-[10px] text-slate-400">
                                Tipo: {cxp.tipo_movimiento ?? "N/D"}
                              </div>
                            </td>

                            <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-900">
                              {formatMoney(cxp.haber)}
                            </td>

                            <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                              {formatMoney(montoPagado)}
                            </td>

                            <td className="px-3 py-2 text-right font-semibold tabular-nums text-amber-700">
                              {formatMoney(saldoReal)}
                            </td>

                            <td className="px-3 py-2 text-right">
                              <input
                                value={montosPago[key] ?? ""}
                                onChange={(e) =>
                                  setMontosPago((prev) => ({
                                    ...prev,
                                    [key]: e.target.value,
                                  }))
                                }
                                type="text"
                                inputMode="decimal"
                                placeholder="0.00"
                                className="h-8 w-full border border-slate-200 px-2 text-right text-[12px] font-semibold tabular-nums text-slate-900 outline-none focus:border-emerald-500"
                              />
                            </td>
                          </tr>
                        );
                      })}

                      <tr className="bg-slate-50">
                        <td
                          colSpan={5}
                          className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400"
                        >
                          Total
                        </td>

                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-950">
                          {formatMoney(totalPago)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-700 transition hover:border-slate-400 disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={guardando}
            onClick={procesar}
            className="border border-slate-900 bg-slate-900 px-3 py-2 text-[12px] font-medium text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {guardando ? "Procesando..." : "Procesar pago"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalDepurarCxp({
  cxp,
  guardando,
  onClose,
  onGuardar,
}: {
  cxp: CXP;
  guardando: boolean;
  onClose: () => void;
  onGuardar: (input: {
    accion: DepurarCxpAccion;
    fecha: string;
    motivo: string;
  }) => void;
}) {
  const [accion, setAccion] = useState<DepurarCxpAccion>("pagada");
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [motivo, setMotivo] = useState("");
  const [error, setError] = useState("");

  function guardar() {
    setError("");

    if (!fecha) {
      setError("Debe indicar la fecha de depuración.");
      return;
    }

    if (!motivo.trim()) {
      setError("Debe escribir el motivo de la depuración.");
      return;
    }

    onGuardar({
      accion,
      fecha,
      motivo: motivo.trim(),
    });
  }

  return (
    <div className="fixed inset-0 z-40 grid place-items-center bg-slate-950/25 px-4">
      <div className="w-full max-w-[620px] border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-100 px-4 py-3">
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
            Depurar CxP
          </div>

          <div className="mt-1 text-[16px] font-semibold text-slate-950">
            CxP #{cxp.no_cxp}
          </div>

          <div className="mt-1 text-[12px] text-slate-500">
            {cxp.beneficiario_nombre}
          </div>
        </div>

        <div className="grid gap-3 px-4 py-4">
          <div className="grid grid-cols-2 gap-2 border border-slate-100 bg-slate-50 px-3 py-3 text-[12px]">
            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
                Monto
              </div>

              <div className="mt-1 font-semibold text-slate-900">
                {formatMoney(cxp.haber)}
              </div>
            </div>

            <div>
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400">
                Estado actual
              </div>

              <div className="mt-1 font-semibold text-slate-900">
                {cxp.estado_administrativo}
              </div>
            </div>
          </div>

          <div className="grid gap-2">
            <div className="text-[12px] font-medium text-slate-700">
              Acción de depuración
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAccion("pagada")}
                className={[
                  "border px-3 py-3 text-left text-[12px] transition",
                  accion === "pagada"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-400",
                ].join(" ")}
              >
                <div className="font-semibold">Marcar como pagada</div>
                <div className="mt-1 text-[11px] opacity-75">
                  La CxP saldrá de pendientes como pagada.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAccion("anulada")}
                className={[
                  "border px-3 py-3 text-left text-[12px] transition",
                  accion === "anulada"
                    ? "border-rose-200 bg-rose-50 text-rose-800"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-400",
                ].join(" ")}
              >
                <div className="font-semibold">Marcar como anulada</div>
                <div className="mt-1 text-[11px] opacity-75">
                  La CxP quedará anulada administrativamente.
                </div>
              </button>
            </div>
          </div>

          <label className="grid gap-1 text-[12px]">
            <span className="font-medium text-slate-700">
              Fecha de depuración
            </span>

            <input
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              type="date"
              className="h-9 border border-slate-200 px-3 text-[12px] outline-none focus:border-slate-500"
            />
          </label>

          <label className="grid gap-1 text-[12px]">
            <span className="font-medium text-slate-700">
              Motivo / observación
            </span>

            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder={
                accion === "pagada"
                  ? "Ej. CxP depurada como pagada según revisión administrativa."
                  : "Ej. CxP anulada por depuración administrativa."
              }
              className="h-28 resize-none border border-slate-200 px-3 py-2 text-[12px] leading-5 outline-none focus:border-slate-500"
            />
          </label>

          {error && (
            <div className="border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="border border-slate-200 bg-white px-3 py-2 text-[12px] font-medium text-slate-700 transition hover:border-slate-400 disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={guardando}
            onClick={guardar}
            className={[
              "border px-3 py-2 text-[12px] font-medium text-white transition disabled:opacity-50",
              accion === "pagada"
                ? "border-emerald-700 bg-emerald-700 hover:bg-emerald-800"
                : "border-rose-700 bg-rose-700 hover:bg-rose-800",
            ].join(" ")}
          >
            {guardando
              ? "Guardando..."
              : accion === "pagada"
              ? "Marcar como pagada"
              : "Marcar como anulada"}
          </button>
        </div>
      </div>
    </div>
  );
}



