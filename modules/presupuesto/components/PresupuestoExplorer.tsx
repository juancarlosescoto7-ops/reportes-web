"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { buildHierarchy } from "@/modules/presupuesto/domain/buildHierarchy";
import { obtenerPresupuesto } from "@/modules/presupuesto/services/presupuesto";
import PresupuestoTree from "./PresupuestoTree";
import { searchTree } from "@/modules/presupuesto/domain/searchTree";
import ControlTechoFuente from "./ControlTechoFuente";
import FormularioNivelesPresupuesto from "./FormularioNivelesPresupuesto";
import ModificacionesPresupuestoPanel from "./ModificacionesPresupuestoPanel";
import ResumenModificacionesPresupuesto from "./ResumenModificacionesPresupuesto";
import ContextualizadorPresupuesto from "./ContextualizadorPresupuesto";
import GroupedHoverToolbar from "@/shared/components/GroupedHoverToolbar";
import type { SolicitudModificacionPresupuesto } from "./PresupuestoTree";

const BorradorPresupuestoExplorer = dynamic(
  () => import("./BorradorPresupuestoExplorer"),
  {
    loading: () => (
      <div className="p-6 text-sm text-slate-400">
        Cargando borrador presupuestario…
      </div>
    ),
  }
);

type ScreenId =
  | "arbol"
  | "control"
  | "creacion"
  | "modificaciones"
  | "resumenModificaciones"
  | "contextos"
  | "borrador";

type Props = {
  data: Record<string, unknown>[];
  codigoObra?: string | null;
  initialSearch?: string;
  initialModification?: SolicitudModificacionPresupuesto | null;
};

const SCREENS: { id: ScreenId; label: string }[] = [
  { id: "arbol", label: "Árbol" },
  { id: "contextos", label: "Contextos IA" },
  { id: "control", label: "Control techo" },
  { id: "creacion", label: "Crear estructura" },
  { id: "borrador", label: "Borrador 2027" },
  { id: "modificaciones", label: "Modificaciones" },
  { id: "resumenModificaciones", label: "Resumen mods" },
];

export default function PresupuestoExplorer({
  data,
  initialSearch = "",
  initialModification = null,
}: Props) {
  const [activeScreen, setActiveScreen] = useState<ScreenId>(
    initialModification ? "modificaciones" : "arbol"
  );
  const [mountedScreens, setMountedScreens] = useState<Set<ScreenId>>(
    () => new Set(initialModification ? ["arbol", "modificaciones"] : ["arbol"])
  );
  const [search, setSearch] = useState(initialSearch);
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [presupuestoData, setPresupuestoData] = useState(data);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [solicitudModificacion, setSolicitudModificacion] =
    useState<SolicitudModificacionPresupuesto | null>(initialModification);

  const baseTree = useMemo(() => buildHierarchy(presupuestoData), [presupuestoData]);

  const filteredTree = useMemo(() => {
    if (!search) return baseTree;
    return searchTree(baseTree, search);
  }, [search, baseTree]);

  async function refrescarPresupuesto() {
    await cargarPresupuesto({ fechaDesde, fechaHasta });
  }

  async function cargarPresupuesto({
    fechaDesde: fechaDesdeFiltro,
    fechaHasta: fechaHastaFiltro,
  }: {
    fechaDesde: string;
    fechaHasta: string;
  }) {
    if (
      fechaDesdeFiltro &&
      fechaHastaFiltro &&
      fechaDesdeFiltro > fechaHastaFiltro
    ) {
      setRefreshError("La fecha desde no puede ser posterior a la fecha hasta.");
      return;
    }

    setRefreshing(true);
    setRefreshError("");

    try {
      const nuevoPresupuesto = await obtenerPresupuesto({
        fechaDesde: fechaDesdeFiltro,
        fechaHasta: fechaHastaFiltro,
      });
      setPresupuestoData(Array.isArray(nuevoPresupuesto) ? nuevoPresupuesto : []);
    } catch (error) {
      setRefreshError(
        error instanceof Error
          ? error.message
          : "No se pudo refrescar el presupuesto."
      );
    } finally {
      setRefreshing(false);
    }
  }

  function limpiarFiltrosFecha() {
    setFechaDesde("");
    setFechaHasta("");
    void cargarPresupuesto({ fechaDesde: "", fechaHasta: "" });
  }

  function activarPantalla(screen: ScreenId) {
    setMountedScreens((current) => {
      if (current.has(screen)) return current;

      const next = new Set(current);
      next.add(screen);
      return next;
    });
    setActiveScreen(screen);
  }

  function registrarContextoGuardado(codigo: string, contexto: string) {
    setPresupuestoData((current) =>
      current.map((row) => {
        const codigoFila = String(
          row.codigo ?? row.codigo_presupuestario ?? ""
        ).trim();

        return codigoFila === codigo ? { ...row, contexto_cxp: contexto } : row;
      })
    );
  }

  return (
    <div className="flex min-h-0 touch-pan-y flex-col overflow-visible bg-white/80 text-slate-800 xl:h-[calc(100vh-8rem)] xl:overflow-hidden xl:border xl:border-slate-300">
      <nav aria-label="Vistas del presupuesto" className="relative z-30 shrink-0 border-b border-slate-200 bg-slate-50/95 px-3 py-2">
        <div className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400">Cambiar vista</div>
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {SCREENS.map((screen) => (
            <button
              key={screen.id}
              type="button"
              onClick={() => activarPantalla(screen.id)}
              aria-current={activeScreen === screen.id ? "page" : undefined}
              className={[
                "h-9 shrink-0 rounded-lg border px-3 text-[11px] font-semibold transition",
                activeScreen === screen.id
                  ? "border-[#005f48] bg-[#005f48] text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800",
              ].join(" ")}
            >
              {screen.label}
            </button>
          ))}
        </div>
      </nav>
      <div className="min-h-0 flex-1 overflow-visible xl:overflow-hidden">
        {mountedScreens.has("arbol") && (
          <Screen active={activeScreen === "arbol"}>
            <div className="flex flex-col xl:h-full">
            <header className="operational-header shrink-0 p-2 lg:p-2.5" onMouseLeave={() => setMobileFiltersOpen(false)}>
              {refreshError && (
                <div className="mb-2 border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">
                  {refreshError}
                </div>
              )}

              <div className="mb-3 flex min-h-10 flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
                <div className="min-w-0">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Presupuesto
                  </div>
                  <div className="truncate text-[13px] font-semibold text-slate-950">
                    Consulta presupuestaria
                  </div>
                </div>

                <GroupedHoverToolbar groups={[
                  { id: "filtros", label: "Filtros", active: Boolean(search || fechaDesde || fechaHasta), content: <div className="grid gap-2 sm:grid-cols-3"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar código o descripción" className="h-10 rounded-lg border px-3 text-sm" /><DateFilterInput label="Desde" value={fechaDesde} onChange={setFechaDesde} /><DateFilterInput label="Hasta" value={fechaHasta} onChange={setFechaHasta} /></div> },
                  { id: "operaciones", label: "Operaciones", content: <div className="grid gap-2 sm:grid-cols-3"><button type="button" onClick={() => activarPantalla("creacion")} className="h-10 rounded-lg bg-[#003331] text-xs font-semibold text-white">Crear estructura</button><button type="button" onClick={() => activarPantalla("modificaciones")} className="h-10 rounded-lg border bg-white text-xs font-semibold">Modificaciones</button><button type="button" onClick={() => activarPantalla("control")} className="h-10 rounded-lg border bg-white text-xs font-semibold">Control de techo</button></div> },
                  { id: "vista", label: "Vista", content: <div className="grid gap-2 sm:grid-cols-3"><button type="button" onClick={() => activarPantalla("arbol")} className="h-10 rounded-lg border bg-white text-xs font-semibold">Árbol presupuestario</button><button type="button" onClick={() => activarPantalla("contextos")} className="h-10 rounded-lg border bg-white text-xs font-semibold">Contextos IA</button><button type="button" onClick={() => activarPantalla("resumenModificaciones")} className="h-10 rounded-lg border bg-white text-xs font-semibold">Resumen de modificaciones</button></div> },
                ]} />
              </div>

              <div className={["grid grid-cols-2 gap-2", mobileFiltersOpen ? "lg:grid-cols-[1fr_150px_150px_auto_auto]" : "hidden"].join(" ")}>

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar..."
                  className="col-span-2 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-[16px] outline-none focus:border-[#00be87] lg:col-span-1 lg:h-9 lg:rounded-md lg:text-sm"
                />

                <div
                  className={[
                    mobileFiltersOpen ? "contents" : "hidden",
                  ].join(" ")}
                >
                <DateFilterInput
                  label="Desde"
                  value={fechaDesde}
                  onChange={setFechaDesde}
                />
                <DateFilterInput
                  label="Hasta"
                  value={fechaHasta}
                  onChange={setFechaHasta}
                />
                <button
                  type="button"
                  onClick={refrescarPresupuesto}
                  disabled={refreshing}
                  className="h-11 rounded-lg border border-emerald-700 bg-emerald-700 px-3 text-[12px] font-semibold text-white transition active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-60 lg:h-9 lg:rounded-md lg:border-slate-300 lg:bg-white lg:text-slate-700 lg:hover:border-[#00be87] lg:hover:text-[#006b55]"
                >
                  {refreshing ? "Consultando" : "Consultar"}
                </button>
                <button
                  type="button"
                  onClick={limpiarFiltrosFecha}
                  disabled={refreshing || (!fechaDesde && !fechaHasta)}
                  className="h-11 rounded-lg border border-slate-300 bg-white px-3 text-[12px] font-semibold text-slate-700 transition active:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 lg:h-9 lg:rounded-md lg:hover:border-slate-500 lg:hover:text-slate-950"
                >
                  Limpiar fechas
                </button>
                </div>
              </div>
            </header>

            <div className="min-h-0 flex-1 xl:overflow-hidden">
              <PresupuestoTree
                tree={filteredTree}
                onSolicitarModificacion={(solicitud) => {
                  setSolicitudModificacion(solicitud);
                  activarPantalla("modificaciones");
                }}
                onSolicitarCreacion={() => {
                  activarPantalla("creacion");
                }}
                onContextoActualizado={refrescarPresupuesto}
              />
            </div>
            </div>
          </Screen>
        )}

        {mountedScreens.has("control") && (
          <Screen active={activeScreen === "control"}>
            <ControlTechoFuente />
          </Screen>
        )}

        {mountedScreens.has("creacion") && (
          <Screen active={activeScreen === "creacion"}>
            <FormularioNivelesPresupuesto />
          </Screen>
        )}

        {mountedScreens.has("modificaciones") && (
          <Screen active={activeScreen === "modificaciones"}>
            <ModificacionesPresupuestoPanel
              solicitud={solicitudModificacion}
              onRefreshData={refrescarPresupuesto}
            />
          </Screen>
        )}

        {mountedScreens.has("resumenModificaciones") && (
          <Screen active={activeScreen === "resumenModificaciones"}>
            <ResumenModificacionesPresupuesto />
          </Screen>
        )}

        {mountedScreens.has("contextos") && (
          <Screen active={activeScreen === "contextos"}>
            <ContextualizadorPresupuesto
              data={presupuestoData}
              onContextoGuardado={registrarContextoGuardado}
              onVolverAlArbol={() => activarPantalla("arbol")}
            />
          </Screen>
        )}

        {mountedScreens.has("borrador") && (
          <Screen active={activeScreen === "borrador"}>
            <BorradorPresupuestoExplorer anio={2027} ejercicioBase={2026} />
          </Screen>
        )}
      </div>

    </div>
  );
}

function DateFilterInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="relative block">
      <span className="pointer-events-none absolute left-3 top-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 pb-1 pt-4 text-[16px] text-slate-800 outline-none focus:border-[#00be87] lg:h-9 lg:rounded-md lg:text-[12px]"
      />
    </label>
  );
}

function Screen({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className={active ? "block overflow-visible xl:h-full xl:overflow-hidden" : "hidden"}
    >
      {children}
    </section>
  );
}
