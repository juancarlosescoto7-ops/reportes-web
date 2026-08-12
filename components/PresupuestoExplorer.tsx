"use client";

import { useMemo, useState } from "react";
import { buildHierarchy } from "@/lib/buildHierarchy";
import { obtenerPresupuesto } from "@/services/presupuesto";
import PresupuestoTree from "./PresupuestoTree";
import { searchTree } from "@/lib/searchTree";
import ControlTechoFuente from "./ControlTechoFuente";
import FormularioNivelesPresupuesto from "./FormularioNivelesPresupuesto";
import ModificacionesPresupuestoPanel from "./ModificacionesPresupuestoPanel";
import ResumenModificacionesPresupuesto from "./ResumenModificacionesPresupuesto";
import type { SolicitudModificacionPresupuesto } from "./PresupuestoTree";

type ScreenId =
  | "arbol"
  | "control"
  | "creacion"
  | "modificaciones"
  | "resumenModificaciones";

type Props = {
  data: Record<string, unknown>[];
  codigoObra?: string | null;
};

const SCREENS: { id: ScreenId; label: string }[] = [
  { id: "arbol", label: "Arbol" },
  { id: "control", label: "Control techo" },
  { id: "creacion", label: "Crear estructura" },
  { id: "modificaciones", label: "Modificaciones" },
  { id: "resumenModificaciones", label: "Resumen mods" },
];

export default function PresupuestoExplorer({ data }: Props) {
  const [activeScreen, setActiveScreen] = useState<ScreenId>("arbol");
  const [mountedScreens, setMountedScreens] = useState<Set<ScreenId>>(
    () => new Set(["arbol"])
  );
  const [search, setSearch] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [presupuestoData, setPresupuestoData] = useState(data);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [solicitudModificacion, setSolicitudModificacion] =
    useState<SolicitudModificacionPresupuesto | null>(null);

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

  return (
    <div className="flex min-h-0 touch-pan-y flex-col overflow-visible bg-white/80 pb-14 text-slate-800 xl:h-[calc(100vh-8rem)] xl:overflow-hidden xl:border xl:border-slate-300">
      <div className="min-h-0 flex-1 overflow-visible xl:overflow-hidden">
        {mountedScreens.has("arbol") && (
          <Screen active={activeScreen === "arbol"}>
            <div className="flex flex-col xl:h-full">
            <header className="operational-header shrink-0 p-2 lg:p-2.5">
              {refreshError && (
                <div className="mb-2 border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">
                  {refreshError}
                </div>
              )}

              <div className="mb-2 flex min-h-9 items-center justify-between gap-3 lg:hidden">
                <div className="min-w-0">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Presupuesto
                  </div>
                  <div className="truncate text-[13px] font-semibold text-slate-950">
                    Consulta presupuestaria
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setMobileFiltersOpen((current) => !current)}
                  aria-expanded={mobileFiltersOpen}
                  className="min-h-9 shrink-0 rounded-lg border border-slate-300 bg-white px-3 text-[10px] font-bold uppercase tracking-[0.1em] text-slate-700"
                >
                  {mobileFiltersOpen ? "Ocultar filtros" : "Filtros"}
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 lg:grid-cols-[minmax(160px,220px)_1fr_150px_150px_auto_auto]">
                <div className="hidden min-w-0 lg:block">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Presupuesto
                  </div>
                  <div className="truncate text-[15px] font-semibold text-slate-950">
                    Consulta presupuestaria
                  </div>
                </div>

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar..."
                  className="col-span-2 h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-[16px] outline-none focus:border-[#00be87] lg:col-span-1 lg:h-9 lg:rounded-md lg:text-sm"
                />

                <div
                  className={[
                    mobileFiltersOpen ? "contents" : "hidden",
                    "lg:contents",
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
      </div>

      <BottomSheetTabs activeScreen={activeScreen} onChange={activarPantalla} />
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

function BottomSheetTabs({
  activeScreen,
  onChange,
}: {
  activeScreen: ScreenId;
  onChange: (screen: ScreenId) => void;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 overflow-x-auto border-t border-slate-300 bg-[#eef1f5] px-2 pb-[env(safe-area-inset-bottom)] pt-1 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] sm:left-6 sm:right-6 sm:border-x lg:left-10 lg:right-10">
      <div className="flex min-w-max items-end gap-1">
        {SCREENS.map((screen) => {
          const active = activeScreen === screen.id;

          return (
            <button
              key={screen.id}
              type="button"
              onClick={() => onChange(screen.id)}
              className={[
                "h-11 border px-4 text-[12px] font-semibold transition sm:h-9",
                active
                  ? "border-slate-300 border-b-white bg-white text-[#006b55]"
                  : "border-slate-300 bg-slate-100 text-slate-600 hover:bg-white hover:text-slate-900",
              ].join(" ")}
            >
              {screen.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
