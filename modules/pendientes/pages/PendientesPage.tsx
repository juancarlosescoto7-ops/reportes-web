"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BadgeCheck,
  ArrowUpRight,
  CircleDollarSign,
  FileCheck2,
  FileClock,
  Files,
  FolderKanban,
  Landmark,
  ReceiptText,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";

import {
  calcularPorcentajePendiente,
  numero,
  obtenerCxpSinComprometer,
  obtenerEgresosSinComprometer,
  obtenerRenglonesSinFondos,
} from "@/modules/pendientes/domain/pendientes";
import { obtenerCXP, type CXP } from "@/modules/cuentas-por-pagar/services/cxp";
import {
  obtenerBandejaDocumentosFaltantesOrdenesPago,
  type DocumentoFaltanteBandeja,
} from "@/modules/ordenes-pago/services/documentosFaltantesOrdenPago.service";
import {
  listarDocumentosCxp,
  type DocumentoCxp,
} from "@/modules/cuentas-por-pagar/services/documentosCxp.service";
import {
  obtenerDocumentosProyectos,
  type DocumentoProyecto,
} from "@/modules/documentos/services/documentacionProyectos";
import {
  obtenerOrdenesPagoConEstadoDocumento,
  type OrdenPagoConDocumento,
} from "@/modules/ordenes-pago/services/documentosOrdenPago.service";
import { obtenerOrdenesEstructuradas, type Orden } from "@/modules/ordenes-pago/services/ordenes.service";
import { obtenerPresupuesto } from "@/modules/presupuesto/services/presupuesto";

type GrupoId =
  | "cxp"
  | "egresos"
  | "renglones"
  | "documentos-cxp"
  | "documentos-proyectos"
  | "documentos-ordenes"
  | "faltantes-ordenes";

type ItemPendiente = {
  id: string;
  elemento: string;
  detalle: string;
  meta?: string;
  accion: string;
  href: string;
};

type GrupoPendiente = {
  id: GrupoId;
  titulo: string;
  descripcion: string;
  icon: LucideIcon;
  items: ItemPendiente[];
  monto?: number;
};

export default function PendientesPage() {
  const [documentosFaltantes, setDocumentosFaltantes] = useState<DocumentoFaltanteBandeja[]>([]);
  const [documentosCxp, setDocumentosCxp] = useState<DocumentoCxp[]>([]);
  const [documentosProyectos, setDocumentosProyectos] = useState<DocumentoProyecto[]>([]);
  const [documentosOrdenes, setDocumentosOrdenes] = useState<OrdenPagoConDocumento[]>([]);
  const [cxps, setCxps] = useState<CXP[]>([]);
  const [egresos, setEgresos] = useState<Orden[]>([]);
  const [presupuesto, setPresupuesto] = useState<Record<string, unknown>[]>([]);
  const [grupoAbierto, setGrupoAbierto] = useState<GrupoId>("cxp");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setCargando(true);
    setError("");

    try {
      const [
        faltantes,
        docsCxp,
        docsProyectos,
        docsOrdenes,
        cxpRows,
        egresoRows,
        presupuestoRows,
      ] = await Promise.all([
        obtenerBandejaDocumentosFaltantesOrdenesPago(),
        listarDocumentosCxp(),
        obtenerDocumentosProyectos(),
        obtenerOrdenesPagoConEstadoDocumento(),
        obtenerCXP(),
        obtenerOrdenesEstructuradas(),
        obtenerPresupuesto(),
      ]);

      setDocumentosFaltantes(faltantes);
      setDocumentosCxp(docsCxp);
      setDocumentosProyectos(docsProyectos);
      setDocumentosOrdenes(docsOrdenes);
      setCxps(cxpRows);
      setEgresos(egresoRows);
      setPresupuesto(presupuestoRows);
    } catch (cause) {
      console.error(cause);
      setError("No se pudieron cargar todos los pendientes. Intente refrescar.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => void cargar(), [cargar]);

  const grupos = useMemo<GrupoPendiente[]>(() => {
    const cxpPendientes = obtenerCxpSinComprometer(cxps);
    const egresosPendientes = obtenerEgresosSinComprometer(egresos);
    const renglonesPendientes = obtenerRenglonesSinFondos(presupuesto);
    const docsCxpPendientes = documentosCxp.filter((doc) => doc.estado !== "CUMPLIDO");
    const docsProyectoPendientes = documentosProyectos.filter((doc) => !doc.url_documento);
    const docsOrdenPendientes = documentosOrdenes.filter((orden) => !orden.tieneDocumento);

    return [
      {
        id: "cxp",
        titulo: "Cuentas por pagar sin comprometer",
        descripcion: "Obligaciones con saldo pendiente de compromiso presupuestario.",
        icon: CircleDollarSign,
        monto: cxpPendientes.reduce((suma, cxp) => suma + numero(cxp.saldo_por_comprometer), 0),
        items: cxpPendientes.map((cxp) => ({
          id: `${cxp.no_cxp}-${cxp.tipo_movimiento}`,
          elemento: `CxP #${cxp.no_cxp}`,
          detalle: cxp.beneficiario_nombre || cxp.descripcion || "Sin beneficiario",
          meta: formatearMoneda(numero(cxp.saldo_por_comprometer)),
          accion: "Comprometer",
          href: construirHrefCxp(cxp, "comprometer"),
        })),
      },
      {
        id: "egresos",
        titulo: "Egresos sin comprometer",
        descripcion: "Órdenes cuya ejecución presupuestaria aún no cubre el egreso.",
        icon: ReceiptText,
        monto: egresosPendientes.reduce((suma, egreso) => suma + numero(egreso.diferencia), 0),
        items: egresosPendientes.map((egreso) => ({
          id: egreso.no_orden,
          elemento: `Orden #${egreso.no_orden}`,
          detalle: egreso.descripcion || "Sin descripción",
          meta: formatearMoneda(numero(egreso.diferencia)),
          accion: "Comprometer",
          href: `/reportes/ordenes-de-pago?orden=${encodeURIComponent(egreso.no_orden)}&accion=comprometer`,
        })),
      },
      {
        id: "renglones",
        titulo: "Renglones presupuestarios sin fondos",
        descripcion: "Códigos cuyo saldo disponible está agotado o en negativo.",
        icon: Landmark,
        items: renglonesPendientes.map((renglon) => {
          const codigo = String(renglon.codigo ?? renglon.codigo_presupuestario ?? "");
          return {
            id: codigo,
            elemento: codigo,
            detalle: String(renglon.descripcion_objeto ?? renglon.objeto ?? "Sin descripción"),
            meta: `Saldo ${formatearMoneda(numero(renglon.saldo_calculado))}`,
            accion: "Ampliar",
            href: `/reportes/presupuesto?buscar=${encodeURIComponent(codigo)}&accion=ampliar`,
          };
        }),
      },
      {
        id: "documentos-cxp",
        titulo: "Documentos de cuentas por pagar",
        descripcion: "Requisitos documentales pendientes dentro de expedientes de CxP.",
        icon: FileCheck2,
        items: docsCxpPendientes.map((doc) => ({
          id: `${doc.noCxp}-${doc.tipoMovimiento}-${doc.tipoDocumento}`,
          elemento: `CxP #${doc.noCxp}`,
          detalle: doc.nombreDocumento,
          meta: doc.tipoMovimiento || "Cuenta por pagar",
          accion: "Completar",
          href: construirHrefDocumentoCxp(doc),
        })),
      },
      {
        id: "documentos-proyectos",
        titulo: "Documentos de proyectos",
        descripcion: "Requisitos sin archivo en los expedientes de proyectos.",
        icon: FolderKanban,
        items: docsProyectoPendientes.map((doc) => ({
          id: `${doc.id_proyecto}-${doc.id_requisito}`,
          elemento: doc.nombre_proyecto || `Proyecto #${doc.id_proyecto}`,
          detalle: doc.nombre_requisito,
          meta: doc.codigo_presupuestario || `Proyecto #${doc.id_proyecto}`,
          accion: "Cargar",
          href: `/controles/proyectos?proyecto=${doc.id_proyecto}`,
        })),
      },
      {
        id: "documentos-ordenes",
        titulo: "PDF de órdenes de pago",
        descripcion: "Órdenes que todavía no tienen su documento PDF principal.",
        icon: Files,
        items: docsOrdenPendientes.map((orden) => ({
          id: String(orden.noOrden),
          elemento: `Orden #${orden.noOrden}`,
          detalle: orden.descripcion || "Sin descripción",
          meta: formatearFecha(orden.fecha),
          accion: "Cargar PDF",
          href: `/controles/ordenes-pago?orden=${orden.noOrden}`,
        })),
      },
      {
        id: "faltantes-ordenes",
        titulo: "Faltantes documentales de órdenes",
        descripcion: "Observaciones y documentos adicionales marcados para subsanación.",
        icon: FileClock,
        items: documentosFaltantes.map((doc) => ({
          id: doc.documentoId,
          elemento: `Orden #${doc.noOrden}`,
          detalle: doc.nombreDocumento,
          meta: doc.observacion || "Sin observación",
          accion: "Subsanar",
          href: `/reportes/ordenes-de-pago?orden=${doc.noOrden}&documentos=${doc.noOrden}`,
        })),
      },
    ];
  }, [cxps, documentosCxp, documentosFaltantes, documentosOrdenes, documentosProyectos, egresos, presupuesto]);

  const totalPendientes = grupos.reduce((suma, grupo) => suma + grupo.items.length, 0);
  const totalRevisados =
    cxps.length + egresos.length + presupuesto.length + documentosCxp.length +
    documentosProyectos.length + documentosOrdenes.length + documentosFaltantes.length;
  const porcentaje = calcularPorcentajePendiente(totalPendientes, totalRevisados);
  const nivel = porcentaje >= 35 ? "alto" : porcentaje >= 12 ? "medio" : "bajo";
  const EstadoIcon = nivel === "alto" ? AlertTriangle : nivel === "medio" ? FileClock : BadgeCheck;
  const tono = nivel === "alto"
    ? "border-rose-300 bg-rose-50 text-rose-800"
    : nivel === "medio"
      ? "border-amber-300 bg-amber-50 text-amber-800"
      : "border-emerald-300 bg-emerald-50 text-emerald-800";
  const grupoSeleccionado = grupos.find((grupo) => grupo.id === grupoAbierto) ?? grupos[0];

  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-4 pb-8">
      <section className={`grid gap-4 border p-5 shadow-sm md:grid-cols-[auto_1fr_auto] md:items-center ${tono}`}>
        <div className="grid h-14 w-14 place-items-center border border-current/20 bg-white/70">
          <EstadoIcon className="h-7 w-7" aria-hidden="true" />
        </div>
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">Asistente operativo</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Pendientes</h1>
          <p className="mt-1 text-sm opacity-80">
            {cargando ? "Revisando los registros del sistema..." : totalPendientes === 0 ? "Todo está al día." : `${totalPendientes} tareas distribuidas en ${grupos.filter((grupo) => grupo.items.length > 0).length} grupos.`}
          </p>
        </div>
        <div className="flex items-center gap-4 md:text-right">
          <div>
            <div className="text-3xl font-semibold tabular-nums">{cargando ? "—" : `${porcentaje}%`}</div>
            <div className="text-[10px] font-bold uppercase tracking-[0.12em] opacity-70">con pendiente</div>
          </div>
          <button data-shortcut="200" type="button" onClick={() => void cargar()} disabled={cargando} aria-label="Refrescar pendientes" className="grid h-10 w-10 place-items-center border border-current/25 bg-white/70 transition hover:bg-white disabled:opacity-50">
            <RefreshCw className={`h-4 w-4 ${cargando ? "animate-spin" : ""}`} />
          </button>
        </div>
      </section>

      {error ? <div className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div> : null}

      <section className="overflow-hidden border border-slate-200 bg-white shadow-sm">
        <div className="grid min-h-[560px] lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="border-b border-slate-200 bg-slate-50/70 lg:border-b-0 lg:border-r">
            <div className="px-5 pb-3 pt-5">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-emerald-700">Bandeja operativa</div>
              <h2 className="mt-1 text-lg font-semibold tracking-tight text-slate-950">Grupos de trabajo</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">Seleccione una categoría para revisar sus tareas.</p>
            </div>
            <nav aria-label="Grupos de pendientes" className="flex gap-2 overflow-x-auto px-3 pb-4 lg:block lg:space-y-1 lg:overflow-visible lg:pb-5">
              {grupos.map((grupo) => (
                <GrupoSelector key={grupo.id} grupo={grupo} activo={grupo.id === grupoSeleccionado.id} cargando={cargando} onSelect={() => setGrupoAbierto(grupo.id)} />
              ))}
            </nav>
          </aside>
          <PanelDetalle grupo={grupoSeleccionado} cargando={cargando} />
        </div>
      </section>
    </div>
  );
}

function GrupoSelector({ grupo, activo, cargando, onSelect }: { grupo: GrupoPendiente; activo: boolean; cargando: boolean; onSelect: () => void }) {
  const Icon = grupo.icon;
  const alDia = !cargando && grupo.items.length === 0;

  return (
    <button data-shortcut="201" type="button" onClick={onSelect} aria-current={activo ? "page" : undefined} className={`group min-w-[230px] border px-3 py-3 text-left transition lg:w-full lg:min-w-0 ${activo ? "border-slate-300 bg-white shadow-sm" : "border-transparent hover:border-slate-200 hover:bg-white/70"}`}>
      <span className="flex items-center gap-3">
        <span className={`grid h-9 w-9 shrink-0 place-items-center ${activo ? "bg-[#003331] text-white" : alDia ? "bg-emerald-50 text-emerald-700" : "bg-white text-slate-500 ring-1 ring-slate-200"}`}><Icon className="h-4 w-4" aria-hidden="true" /></span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-[12px] font-semibold ${activo ? "text-slate-950" : "text-slate-700"}`}>{grupo.titulo}</span>
          <span className={`mt-0.5 block text-[10px] font-bold uppercase tracking-[0.1em] ${cargando ? "text-slate-400" : alDia ? "text-emerald-700" : "text-amber-700"}`}>{cargando ? "Revisando" : alDia ? "Al día" : `${grupo.items.length} pendientes`}</span>
        </span>
      </span>
    </button>
  );
}

function PanelDetalle({ grupo, cargando }: { grupo: GrupoPendiente; cargando: boolean }) {
  const Icon = grupo.icon;
  return (
    <div className="min-w-0 bg-white">
      <header className="flex flex-col gap-4 border-b border-slate-200 px-5 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-7 sm:py-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400"><Icon className="h-3.5 w-3.5" /> Detalle del grupo</div>
          <h3 className="mt-2 text-xl font-semibold tracking-tight text-slate-950 sm:text-2xl">{grupo.titulo}</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-slate-500">{grupo.descripcion}</p>
        </div>
        <div className="shrink-0 sm:text-right">
          <div className="text-3xl font-semibold tabular-nums text-slate-950">{cargando ? "—" : grupo.items.length}</div>
          <div className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">tareas pendientes</div>
          {grupo.monto !== undefined && grupo.monto > 0 ? <div className="mt-1 font-mono text-xs font-semibold text-amber-700">{formatearMoneda(grupo.monto)}</div> : null}
        </div>
      </header>
      <div className="px-5 py-4 sm:px-7">
        {cargando ? (
          <div className="flex min-h-56 items-center justify-center gap-2 text-sm text-slate-500"><RefreshCw className="h-4 w-4 animate-spin" /> Consultando registros...</div>
        ) : grupo.items.length === 0 ? (
          <div className="grid min-h-64 place-items-center text-center"><div><BadgeCheck className="mx-auto h-8 w-8 text-emerald-700" /><div className="mt-3 text-sm font-semibold text-slate-900">Este grupo está al día</div><p className="mt-1 text-xs text-slate-500">No hay elementos que requieran atención.</p></div></div>
        ) : (
          <div>
            <div className="hidden grid-cols-[minmax(140px,0.65fr)_minmax(240px,1.5fr)_auto] gap-5 border-b border-slate-200 px-3 pb-2 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 md:grid"><span>Elemento</span><span>Detalle</span><span>Acción</span></div>
            <div className="max-h-[430px] divide-y divide-slate-100 overflow-y-auto">{grupo.items.map((item, index) => <FilaPendiente key={item.id} item={item} index={index} />)}</div>
          </div>
        )}
      </div>
    </div>
  );
}

function FilaPendiente({ item, index }: { item: ItemPendiente; index: number }) {
  const demoraBase = Math.min(index, 12) * 55;

  return (
    <div className="pendiente-row-in grid gap-3 px-3 py-4 transition hover:bg-slate-50/70 md:grid-cols-[minmax(140px,0.65fr)_minmax(240px,1.5fr)_auto] md:items-center md:gap-5" style={{ animationDelay: `${demoraBase}ms` }}>
      <div className="min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400 md:hidden">Elemento</div>
        <div className="truncate text-sm font-semibold text-slate-950">{item.elemento}</div>
      </div>
      <div className="min-w-0">
        <div className="text-[9px] font-bold uppercase tracking-[0.12em] text-slate-400 md:hidden">Detalle</div>
        <div className="truncate text-sm text-slate-700">{item.detalle}</div>
        {item.meta ? <div className="mt-0.5 truncate text-xs font-medium text-slate-500">{item.meta}</div> : null}
      </div>
      <Link data-shortcut="202" href={item.href} className="inline-flex h-9 items-center justify-center gap-2 border border-slate-300 bg-white px-3 text-[10px] font-bold uppercase tracking-[0.09em] text-slate-700 transition hover:border-[#006b55] hover:text-[#006b55] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006b55]">
        {item.accion}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
      </Link>
    </div>
  );
}

function construirHrefCxp(cxp: CXP, accion: "comprometer" | "documentos") {
  const params = new URLSearchParams({ cxp: String(cxp.no_cxp), accion });
  if (cxp.tipo_movimiento) params.set("tipo", cxp.tipo_movimiento);
  return `/reportes/compromisos-presupuestarios?${params.toString()}`;
}

function construirHrefDocumentoCxp(doc: DocumentoCxp) {
  const params = new URLSearchParams({ cxp: String(doc.noCxp), accion: "documentos" });
  if (doc.tipoMovimiento) params.set("tipo", doc.tipoMovimiento);
  return `/reportes/compromisos-presupuestarios?${params.toString()}`;
}

function formatearMoneda(value: number) {
  return value.toLocaleString("es-HN", { style: "currency", currency: "HNL", minimumFractionDigits: 2 });
}

function formatearFecha(value: string | null) {
  if (!value) return "Sin fecha";
  const fecha = new Date(value);
  return Number.isNaN(fecha.getTime()) ? "Sin fecha" : fecha.toLocaleDateString("es-HN");
}
