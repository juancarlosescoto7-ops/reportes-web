"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import BandejaDocumentosFaltantesOrdenes from "@/components/BandejaDocumentosFaltantesOrdenes";
import ResumenPorGrupoCard from "@/components/ResumenPorGrupoCard";
import ResumenPresupuesto from "@/components/ResumenPresupuesto";
import {
  obtenerResumenPorGrupo,
  type ResumenPorGrupo,
} from "@/services/resumenPorGrupo";
import { obtenerResumenPresupuesto } from "@/services/presupuestoResumen";
import {
  obtenerBandejaDocumentosFaltantesOrdenesPago,
  type DocumentoFaltanteBandeja,
} from "@/services/documentosFaltantesOrdenPago.service";
import {
  obtenerReporteIngresos,
  type IngresoReporte,
} from "@/services/ingresos.service";
import {
  obtenerOrdenesEstructuradas,
  type Orden,
} from "@/services/ordenes.service";
import { obtenerCXP, type CXP } from "@/services/cxp";

type ModuloId = "grupo" | "presupuesto" | "documentos";

type PresupuestoResumenRow = {
  total_ejecutado?: number | string | null;
  clasificacion_fuente?: string | null;
  clasificacion_tipo_inversion?: string | null;
};

type ModuloHome = {
  id: ModuloId;
  titulo: string;
  estado: string;
  accentClass: string;
  activeClass: string;
  resumen: string;
  destacado: string;
  content: ReactNode;
};

type LineaEstadoFinanciero = {
  id: string;
  concepto: string;
  descripcion: string;
  monto: number;
  tone: "positive" | "negative" | "neutral";
};

export default function Home() {
  const [moduloActivo, setModuloActivo] = useState<ModuloId | null>(null);
  const [fechaCorte, setFechaCorte] = useState(obtenerFechaLocal());
  const [resumenGrupo, setResumenGrupo] = useState<ResumenPorGrupo[]>([]);
  const [resumenPresupuesto, setResumenPresupuesto] = useState<
    PresupuestoResumenRow[]
  >([]);
  const [documentos, setDocumentos] = useState<DocumentoFaltanteBandeja[]>([]);
  const [ingresos, setIngresos] = useState<IngresoReporte[]>([]);
  const [egresos, setEgresos] = useState<Orden[]>([]);
  const [cuentasPorPagar, setCuentasPorPagar] = useState<CXP[]>([]);
  const [cargandoResumen, setCargandoResumen] = useState(true);

  useEffect(() => {
    async function cargarResumenes() {
      try {
        setCargandoResumen(true);

        const [grupo, presupuesto, docs, ingresosRows, egresosRows, cxpRows] =
          await Promise.all([
            obtenerResumenPorGrupo(),
            obtenerResumenPresupuesto() as Promise<PresupuestoResumenRow[]>,
            obtenerBandejaDocumentosFaltantesOrdenesPago(),
            obtenerReporteIngresos(),
            obtenerOrdenesEstructuradas(),
            obtenerCXP(),
          ]);

        setResumenGrupo(grupo);
        setResumenPresupuesto(Array.isArray(presupuesto) ? presupuesto : []);
        setDocumentos(docs);
        setIngresos(ingresosRows);
        setEgresos(egresosRows);
        setCuentasPorPagar(cxpRows);
      } catch (err) {
        console.error(err);
      } finally {
        setCargandoResumen(false);
      }
    }

    cargarResumenes();
  }, []);

  const estadoFinanciero = useMemo(() => {
    const ingresosAlCorte = ingresos.filter((row) =>
      estaEnFechaCorte(obtenerFechaIngreso(row), fechaCorte)
    );
    const egresosAlCorte = egresos.filter((row) =>
      estaEnFechaCorte(row.fecha, fechaCorte)
    );
    const cuentasPorPagarAlCorte = cuentasPorPagar.filter((cxp) =>
      estaEnFechaCorte(cxp.fecha, fechaCorte)
    );
    const totalIngresos = ingresosAlCorte.reduce((acc, row) => {
      return acc + normalizarNumero(row.monto);
    }, 0);
    const totalEgresos = egresosAlCorte.reduce((acc, row) => {
      return acc + normalizarNumero(row.total_haber);
    }, 0);
    const cxpPendientes = cuentasPorPagarAlCorte.filter((cxp) => {
      return (
        cxp.estado_administrativo === "pendiente" && obtenerSaldoRealCxp(cxp) > 0
      );
    });
    const totalCxp = cxpPendientes.reduce((acc, cxp) => {
      return acc + obtenerSaldoRealCxp(cxp);
    }, 0);
    const disponibilidadOperativa = totalIngresos - totalEgresos;
    const posicionNeta = disponibilidadOperativa - totalCxp;
    const coberturaCxp = totalCxp > 0 ? (disponibilidadOperativa / totalCxp) * 100 : 100;
    const lineas: LineaEstadoFinanciero[] = [
      {
        id: "ingresos",
        concepto: "Ingresos",
        descripcion: `${ingresosAlCorte.length} deposito(s) registrados al corte`,
        monto: totalIngresos,
        tone: "positive",
      },
      {
        id: "egresos",
        concepto: "Egresos",
        descripcion: `${egresosAlCorte.length} orden(es) de pago registradas al corte`,
        monto: totalEgresos,
        tone: "negative",
      },
      {
        id: "cxp",
        concepto: "Cuentas por pagar",
        descripcion: `${cxpPendientes.length} CxP pendiente(s), comprometidas o no`,
        monto: totalCxp,
        tone: "negative",
      },
    ];

    return {
      totalIngresos,
      totalEgresos,
      totalCxp,
      disponibilidadOperativa,
      posicionNeta,
      coberturaCxp,
      cxpPendientes: cxpPendientes.length,
      lineas,
    };
  }, [cuentasPorPagar, egresos, fechaCorte, ingresos]);

  const modulos = useMemo<ModuloHome[]>(() => {
    const totalPermitido = resumenGrupo.reduce(
      (acc, row) => acc + row.MontoPermitido,
      0
    );
    const totalEjecutadoGrupo = resumenGrupo.reduce(
      (acc, row) => acc + row.MontoEjecutado,
      0
    );
    const totalComprometido = resumenGrupo.reduce(
      (acc, row) => acc + row.MontoComprometido,
      0
    );
    const porcentajeUso =
      totalPermitido === 0
        ? 0
        : ((totalEjecutadoGrupo + totalComprometido) / totalPermitido) * 100;

    const totalEjecutadoPresupuesto = resumenPresupuesto.reduce((acc, row) => {
      return acc + normalizarNumero(row.total_ejecutado);
    }, 0);
    const fuentes = new Set(
      resumenPresupuesto
        .map((row) => row.clasificacion_fuente)
        .filter(Boolean)
    );
    const tiposInversion = new Set(
      resumenPresupuesto
        .map((row) => row.clasificacion_tipo_inversion)
        .filter(Boolean)
    );

    const ordenesPendientes = new Set(documentos.map((doc) => doc.noOrden));
    const ordenCritica = documentos.reduce<{
      noOrden: number;
      total: number;
    } | null>((actual, doc) => {
      const total = documentos.filter((item) => item.noOrden === doc.noOrden)
        .length;

      if (!actual || total > actual.total) {
        return { noOrden: doc.noOrden, total };
      }

      return actual;
    }, null);

    return [
      {
        id: "grupo",
        titulo: "Resumen por grupo",
        estado:
          porcentajeUso > 100
            ? "Uso proyectado excedido"
            : "Uso proyectado controlado",
        accentClass: "bg-[#003331] text-white",
        activeClass: "border-[#003331] ring-[#003331]/10",
        resumen: `${formatMoney(totalEjecutadoGrupo)} ejecutado · ${formatMoney(
          totalComprometido
        )} comprometido`,
        destacado: `${porcentajeUso.toFixed(2)}% uso proyectado`,
        content: <ResumenPorGrupoCard />,
      },
      {
        id: "presupuesto",
        titulo: "Resumen presupuestario",
        estado: "Clasificacion disponible",
        accentClass: "bg-[#2fae68] text-white",
        activeClass: "border-[#2fae68] ring-[#2fae68]/12",
        resumen: `${fuentes.size} fuentes · ${tiposInversion.size} tipos · ${resumenPresupuesto.length} registros`,
        destacado: `${formatMoney(totalEjecutadoPresupuesto)} ejecutado`,
        content: <ResumenPresupuesto />,
      },
      {
        id: "documentos",
        titulo: "Documentos faltantes",
        estado:
          documentos.length > 0
            ? "Pendientes por atender"
            : "Sin pendientes documentales",
        accentClass: "bg-slate-900 text-white",
        activeClass: "border-slate-900 ring-slate-900/10",
        resumen: `${ordenesPendientes.size} ordenes · ${documentos.length} documentos`,
        destacado: ordenCritica
          ? `Orden ${ordenCritica.noOrden} con ${ordenCritica.total} faltantes`
          : "Sin orden critica",
        content: <BandejaDocumentosFaltantesOrdenes />,
      },
    ];
  }, [documentos, resumenGrupo, resumenPresupuesto]);

  return (
    <div className="min-h-full px-1 py-1">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4">
        <EstadoFinancieroPrincipal
          cargando={cargandoResumen}
          fechaCorte={fechaCorte}
          onFechaCorteChange={setFechaCorte}
          totalIngresos={estadoFinanciero.totalIngresos}
          totalEgresos={estadoFinanciero.totalEgresos}
          totalCxp={estadoFinanciero.totalCxp}
          disponibilidadOperativa={estadoFinanciero.disponibilidadOperativa}
          posicionNeta={estadoFinanciero.posicionNeta}
          cxpPendientes={estadoFinanciero.cxpPendientes}
          lineas={estadoFinanciero.lineas}
        />

        <section className="glass-panel overflow-hidden p-2">
          <div className="mb-2 flex items-center justify-between gap-3 px-1">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                Anexos
              </div>
              <h2 className="text-[15px] font-semibold text-slate-950">
                Detalles de soporte
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            {modulos.map((modulo) => (
              <ResumenCard
                key={modulo.id}
                modulo={modulo}
                activo={moduloActivo === modulo.id}
                cargando={cargandoResumen}
                onClick={() =>
                  setModuloActivo((actual) =>
                    actual === modulo.id ? null : modulo.id
                  )
                }
              />
            ))}
          </div>
        </section>

        <div className="glass-subtle flex items-center justify-between px-3 py-2">
          <div className="text-[12px] font-medium text-slate-500">
            {moduloActivo
              ? "Detalle del panel seleccionado"
              : "Seleccione una tarjeta para ver el detalle completo."}
          </div>

          <button
            type="button"
            onClick={() => {
              if (moduloActivo !== null) {
                setModuloActivo(null);
              }
            }}
            aria-disabled={moduloActivo === null}
            className={[
              "h-8 border border-slate-300 bg-white/80 px-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700 transition",
              moduloActivo === null
                ? "cursor-not-allowed opacity-50"
                : "hover:border-slate-700 hover:bg-slate-50",
            ].join(" ")}
          >
            Cerrar todas
          </button>
        </div>

        {moduloActivo && (
          <section className="glass-panel w-full p-3 [&>div]:max-w-none">
            {modulos.find((modulo) => modulo.id === moduloActivo)?.content}
          </section>
        )}
      </div>
    </div>
  );
}

type ResumenCardProps = {
  modulo: ModuloHome;
  activo: boolean;
  cargando: boolean;
  onClick: () => void;
};

function ResumenCard({
  modulo,
  activo,
  cargando,
  onClick,
}: ResumenCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={activo}
      className={[
        "group min-h-[176px] w-full border bg-white/78 p-3 text-left shadow-sm backdrop-blur-xl transition",
        "hover:border-slate-400 hover:bg-white",
        activo
          ? `ring-2 ${modulo.activeClass}`
          : "border-slate-200 ring-0",
      ].join(" ")}
    >
      <div className="flex min-h-full flex-col">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <div className="min-w-0 border border-slate-200 bg-slate-50/80 px-3 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {cargando ? "Actualizando" : modulo.estado}
            </div>

            <h2 className="mt-1 text-[16px] font-semibold tracking-tight text-slate-950">
              {modulo.titulo}
            </h2>
          </div>

          <span
            className={[
              "flex h-full min-w-[72px] items-center justify-center px-3 text-[10px] font-semibold uppercase tracking-[0.12em]",
              modulo.accentClass,
            ].join(" ")}
          >
            {activo ? "Cerrar" : "Abrir"}
          </span>
        </div>

        <div className="mt-3 border border-slate-200 bg-white/80 px-3 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
            Principal
          </div>

          <div className="mt-1 text-[18px] font-semibold leading-snug text-slate-950">
            {cargando ? "..." : modulo.destacado}
          </div>
        </div>

        <div className="mt-2 border border-slate-200 bg-slate-50/70 px-3 py-2 text-[12px] leading-5 text-slate-600">
          {cargando ? "Consultando datos..." : modulo.resumen}
        </div>
      </div>
    </button>
  );
}

type EstadoFinancieroPrincipalProps = {
  cargando: boolean;
  fechaCorte: string;
  onFechaCorteChange: (fecha: string) => void;
  totalIngresos: number;
  totalEgresos: number;
  totalCxp: number;
  disponibilidadOperativa: number;
  posicionNeta: number;
  cxpPendientes: number;
  lineas: LineaEstadoFinanciero[];
};

function EstadoFinancieroPrincipal({
  cargando,
  fechaCorte,
  onFechaCorteChange,
  totalIngresos,
  totalEgresos,
  totalCxp,
  disponibilidadOperativa,
  posicionNeta,
  cxpPendientes,
  lineas,
}: EstadoFinancieroPrincipalProps) {
  const fechaCorteTexto = formatearFechaCorte(fechaCorte);
  const saldoRealClass =
    disponibilidadOperativa >= 0 ? "text-emerald-700" : "text-rose-700";
  const saldoRealLabel =
    disponibilidadOperativa >= 0 ? "Saldo real disponible" : "Saldo real negativo";
  const posicionNetaClass =
    posicionNeta >= 0 ? "text-emerald-700" : "text-rose-700";
  const baseComparativa = Math.max(
    totalIngresos,
    totalEgresos,
    totalCxp,
    1
  );

  return (
    <section className="glass-panel overflow-hidden p-3">
      <div className="grid gap-3 lg:grid-cols-[minmax(340px,0.9fr)_1.1fr]">
        <div className="border border-emerald-200 bg-emerald-50/70 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Estado financiero
              </div>
              <h1 className="mt-1 text-[18px] font-semibold tracking-tight text-slate-950">
                Saldo real al {fechaCorteTexto}
              </h1>
            </div>

            <label className="grid min-w-[160px] gap-1 text-[11px]">
              <span className="font-semibold uppercase tracking-[0.12em] text-emerald-800">
                Corte
              </span>
              <input
                type="date"
                value={fechaCorte}
                onChange={(event) => onFechaCorteChange(event.target.value)}
                className="h-8 border border-emerald-200 bg-white/95 px-2 text-[12px] font-semibold tabular-nums text-slate-950 outline-none focus:border-emerald-500"
              />
            </label>
          </div>

          <div className="mt-5">
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-800">
              {saldoRealLabel}
            </div>
            <div
              className={`mt-1 break-words text-[34px] font-semibold leading-tight tabular-nums ${saldoRealClass}`}
            >
              {cargando ? "..." : formatMoney(disponibilidadOperativa)}
            </div>
            <div className="mt-2 text-[12px] leading-5 text-slate-600">
              Resultado directo de ingresos menos egresos. Despues de CxP:
              <span className={`ml-1 font-semibold tabular-nums ${posicionNetaClass}`}>
                {cargando ? "..." : formatMoney(posicionNeta)}
              </span>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <MiniEstado
              label="Ingresos"
              value={cargando ? "..." : formatMoney(totalIngresos)}
            />
            <MiniEstado
              label="Egresos"
              value={cargando ? "..." : formatMoney(totalEgresos)}
            />
          </div>
        </div>

        <div className="grid gap-3 border border-slate-200 bg-white/86 p-3">
          <div className="grid gap-2 lg:grid-cols-3">
            {lineas.map((linea) => (
              <FlujoEstado
                key={linea.id}
                label={linea.concepto}
                description={linea.descripcion}
                value={cargando ? "..." : formatMoney(linea.monto)}
                tone={linea.tone}
                percent={
                  cargando
                    ? 0
                    : Math.max(8, Math.min(100, (linea.monto / baseComparativa) * 100))
                }
              />
            ))}
          </div>

          <div className="grid gap-2 border border-slate-200 bg-slate-50/80 p-3 md:grid-cols-3">
            <DatoCompacto
              label="Saldo real"
              value={cargando ? "..." : formatMoney(disponibilidadOperativa)}
              valueClass={
                disponibilidadOperativa >= 0 ? "text-slate-950" : "text-rose-700"
              }
            />
            <DatoCompacto
              label="CxP pendientes"
              value={cargando ? "..." : `${cxpPendientes} registros`}
              valueClass="text-slate-950"
            />
            <DatoCompacto
              label="Despues de CxP"
              value={cargando ? "..." : formatMoney(posicionNeta)}
              valueClass={posicionNetaClass}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function MiniEstado({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="border border-emerald-200 bg-white/75 px-3 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-700">
        {label}
      </div>
      <div className="mt-1 truncate text-[13px] font-semibold tabular-nums text-slate-950">
        {value}
      </div>
    </div>
  );
}

function FlujoEstado({
  label,
  description,
  value,
  tone,
  percent,
}: {
  label: string;
  description: string;
  value: string;
  tone: "positive" | "negative" | "neutral";
  percent: number;
}) {
  const toneClass =
    tone === "positive"
      ? "bg-emerald-600"
      : tone === "negative"
      ? "bg-rose-600"
      : "bg-slate-600";
  const valueClass =
    tone === "positive"
      ? "text-emerald-700"
      : tone === "negative"
      ? "text-rose-700"
      : "text-slate-950";

  return (
    <div className="border border-slate-200 bg-white px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
            {label}
          </div>
          <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-500">
            {description}
          </div>
        </div>
        <div className={`shrink-0 text-right text-[13px] font-semibold tabular-nums ${valueClass}`}>
          {value}
        </div>
      </div>

      <div className="mt-3 h-2 overflow-hidden bg-slate-100">
        <div
          className={`h-full ${toneClass}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

function DatoCompacto({
  label,
  value,
  valueClass = "text-slate-950",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </div>
      <div className={`mt-1 truncate text-[14px] font-semibold tabular-nums ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

function normalizarNumero(value: number | string | null | undefined) {
  const numero = Number(value);
  return Number.isFinite(numero) ? numero : 0;
}

function obtenerFechaLocal() {
  const fecha = new Date();
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function obtenerFechaIngreso(row: IngresoReporte) {
  return row.fecha_deposito ?? row.fecha_arqueo ?? row.fecha;
}

function obtenerTiempoFecha(value: string | null | undefined) {
  if (!value) return null;

  const text = String(value).trim();
  const soloFecha = text.split("T")[0].split(" ")[0];
  const isoMatch = soloFecha.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const localMatch = soloFecha.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }

  if (localMatch) {
    const [, day, month, year] = localMatch;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }

  const time = new Date(text).getTime();

  return Number.isFinite(time) ? time : null;
}

function estaEnFechaCorte(
  fechaRegistro: string | null | undefined,
  fechaCorte: string
) {
  if (!fechaCorte) return true;

  const tiempoCorte = obtenerTiempoFecha(fechaCorte);
  const tiempoRegistro = obtenerTiempoFecha(fechaRegistro);

  if (tiempoCorte === null || tiempoRegistro === null) return true;

  return tiempoRegistro <= tiempoCorte;
}

function formatearFechaCorte(value: string) {
  if (!value) return "sin fecha definida";

  const [year, month, day] = value.split("-");

  if (!year || !month || !day) return value;

  return `${day}/${month}/${year}`;
}

function obtenerSaldoRealCxp(cxp: CXP) {
  const pagado = normalizarNumero(cxp.debe ?? cxp.monto_pagado);

  return Math.max(normalizarNumero(cxp.haber) - pagado, 0);
}

function formatMoney(value: number) {
  return value.toLocaleString("es-HN", {
    style: "currency",
    currency: "HNL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
