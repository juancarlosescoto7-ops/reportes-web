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
  const [search, setSearch] = useState("");
  const [presupuestoData, setPresupuestoData] = useState(data);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");
  const [solicitudModificacion, setSolicitudModificacion] =
    useState<SolicitudModificacionPresupuesto | null>(null);

  const baseTree = useMemo(() => buildHierarchy(presupuestoData), [presupuestoData]);

  const filteredTree = useMemo(() => {
    if (!search) return baseTree;
    return searchTree(baseTree, search);
  }, [search, baseTree]);

  async function refrescarPresupuesto() {
    setRefreshing(true);
    setRefreshError("");

    try {
      const nuevoPresupuesto = await obtenerPresupuesto();
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

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col overflow-hidden border border-slate-300 bg-white/80 pb-12 text-slate-800">
      <div className="min-h-0 flex-1 overflow-hidden">
        <Screen active={activeScreen === "arbol"}>
          <div className="flex h-full flex-col">
            <div className="shrink-0 border-b border-slate-200 bg-white/95 p-3 backdrop-blur">
              {refreshError && (
                <div className="mb-2 border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">
                  {refreshError}
                </div>
              )}
              <div className="grid grid-cols-[1fr_auto] gap-2">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar..."
                  className="h-11 w-full border border-slate-300 bg-white px-3 text-sm outline-none focus:border-[#00be87]"
                />
                <button
                  type="button"
                  onClick={refrescarPresupuesto}
                  disabled={refreshing}
                  className="h-11 border border-slate-300 bg-white px-3 text-[12px] font-semibold text-slate-700 transition hover:border-[#00be87] hover:text-[#006b55] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {refreshing ? "Refrescando" : "Refrescar"}
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1">
              <PresupuestoTree
                tree={filteredTree}
                onSolicitarModificacion={(solicitud) => {
                  setSolicitudModificacion(solicitud);
                  setActiveScreen("modificaciones");
                }}
                onSolicitarCreacion={() => {
                  setActiveScreen("creacion");
                }}
              />
            </div>
          </div>
        </Screen>

        <Screen active={activeScreen === "control"}>
          <ControlTechoFuente />
        </Screen>

        <Screen active={activeScreen === "creacion"}>
          <FormularioNivelesPresupuesto />
        </Screen>

        <Screen active={activeScreen === "modificaciones"}>
          <ModificacionesPresupuestoPanel
            solicitud={solicitudModificacion}
            onRefreshData={refrescarPresupuesto}
          />
        </Screen>

        <Screen active={activeScreen === "resumenModificaciones"}>
          <ResumenModificacionesPresupuesto />
        </Screen>
      </div>

      <BottomSheetTabs activeScreen={activeScreen} onChange={setActiveScreen} />
    </div>
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
    <section className={active ? "block h-full overflow-auto" : "hidden"}>
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
    <nav className="fixed bottom-0 left-4 right-4 z-50 overflow-x-auto border-x border-t border-slate-300 bg-[#eef1f5] px-2 pt-1 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] sm:left-6 sm:right-6 lg:left-10 lg:right-10">
      <div className="flex min-w-max items-end gap-1">
        {SCREENS.map((screen) => {
          const active = activeScreen === screen.id;

          return (
            <button
              key={screen.id}
              type="button"
              onClick={() => onChange(screen.id)}
              className={[
                "h-9 border px-4 text-[12px] font-semibold transition",
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
