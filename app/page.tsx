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

export default function Home() {
  const [moduloActivo, setModuloActivo] = useState<ModuloId | null>(null);
  const [resumenGrupo, setResumenGrupo] = useState<ResumenPorGrupo[]>([]);
  const [resumenPresupuesto, setResumenPresupuesto] = useState<
    PresupuestoResumenRow[]
  >([]);
  const [documentos, setDocumentos] = useState<DocumentoFaltanteBandeja[]>([]);
  const [cargandoResumen, setCargandoResumen] = useState(true);

  useEffect(() => {
    async function cargarResumenes() {
      try {
        setCargandoResumen(true);

        const [grupo, presupuesto, docs] = await Promise.all([
          obtenerResumenPorGrupo(),
          obtenerResumenPresupuesto() as Promise<PresupuestoResumenRow[]>,
          obtenerBandejaDocumentosFaltantesOrdenesPago(),
        ]);

        setResumenGrupo(grupo);
        setResumenPresupuesto(Array.isArray(presupuesto) ? presupuesto : []);
        setDocumentos(docs);
      } catch (err) {
        console.error(err);
      } finally {
        setCargandoResumen(false);
      }
    }

    cargarResumenes();
  }, []);

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
        <section className="glass-panel overflow-hidden p-2">
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

function normalizarNumero(value: number | string | null | undefined) {
  const numero = Number(value);
  return Number.isFinite(numero) ? numero : 0;
}

function formatMoney(value: number) {
  return value.toLocaleString("es-HN", {
    style: "currency",
    currency: "HNL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
