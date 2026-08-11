"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Plus, Search, X } from "lucide-react";

import type { ObraPresupuestaria } from "@/lib/proyectos";
import {
  crearProyectoDesdeObras,
  obtenerObrasPresupuestarias,
} from "@/services/proyectos.service";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreado: (idProyecto: number) => Promise<void> | void;
};

export default function CrearProyectoModal({
  open,
  onClose,
  onCreado,
}: Props) {
  if (!open) return null;

  return (
    <CrearProyectoModalContenido onClose={onClose} onCreado={onCreado} />
  );
}

function CrearProyectoModalContenido({
  onClose,
  onCreado,
}: Omit<Props, "open">) {
  const [obras, setObras] = useState<ObraPresupuestaria[]>([]);
  const [seleccionadas, setSeleccionadas] = useState<string[]>([]);
  const [nombreProyecto, setNombreProyecto] = useState("");
  const [nombreEditadoManualmente, setNombreEditadoManualmente] =
    useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;

    obtenerObrasPresupuestarias()
      .then((data) => {
        if (activo) setObras(data);
      })
      .catch((cause) => {
        if (!activo) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "No se pudieron cargar las obras."
        );
      })
      .finally(() => {
        if (activo) setCargando(false);
      });

    return () => {
      activo = false;
    };
  }, []);

  const obrasFiltradas = useMemo(() => {
    const term = normalizar(busqueda);

    if (!term) return obras;

    return obras.filter(
      (obra) =>
        normalizar(obra.nombre).includes(term) ||
        normalizar(obra.id).includes(term)
    );
  }, [busqueda, obras]);

  function alternarObra(obra: ObraPresupuestaria) {
    setSeleccionadas((actual) => {
      const existe = actual.includes(obra.id);
      const siguiente = existe
        ? actual.filter((id) => id !== obra.id)
        : [...actual, obra.id];

      if (!nombreEditadoManualmente) {
        const primera = obras.find((item) => item.id === siguiente[0]);
        setNombreProyecto(primera?.nombre ?? "");
      }

      return siguiente;
    });
  }

  async function crearProyecto(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!nombreProyecto.trim()) {
      setError("Debe ingresar el nombre del proyecto.");
      return;
    }

    if (seleccionadas.length === 0) {
      setError("Debe seleccionar al menos una obra.");
      return;
    }

    try {
      setGuardando(true);
      const idProyecto = await crearProyectoDesdeObras({
        nombreProyecto: nombreProyecto.trim(),
        codigos: seleccionadas,
      });

      await onCreado(idProyecto);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "No se pudo crear el proyecto."
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/45 p-3 backdrop-blur-sm">
      <form
        onSubmit={crearProyecto}
        className="grid max-h-[92vh] w-full max-w-[760px] grid-rows-[auto_auto_1fr_auto] overflow-hidden rounded-xl border border-slate-300 bg-[#eef1f5] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-300 bg-white px-5 py-4">
          <div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Registro de proyectos
            </div>
            <h2 className="mt-1 text-[17px] font-semibold text-slate-950">
              Crear proyecto desde obras presupuestarias
            </h2>
            <p className="mt-1 text-[12px] text-slate-500">
              Seleccione una o varias obras, igual que en el módulo de Excel.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-slate-300 bg-white text-slate-500 transition hover:border-slate-700 hover:text-slate-900 disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="grid gap-3 border-b border-slate-300 bg-white/75 p-4 sm:grid-cols-[1fr_260px]">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Nombre del proyecto
            </span>
            <input
              value={nombreProyecto}
              onChange={(event) => {
                setNombreEditadoManualmente(true);
                setNombreProyecto(event.target.value);
              }}
              maxLength={300}
              placeholder="Nombre que tendrá el proyecto"
              className="h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#005f48]"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Buscar obra
            </span>
            <span className="relative block">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Código o nombre"
                className="h-9 w-full rounded-md border border-slate-300 bg-white pl-9 pr-3 text-[13px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#005f48]"
              />
            </span>
          </label>
        </div>

        <div className="min-h-0 overflow-y-auto p-3">
          {cargando ? (
            <div className="flex min-h-[260px] items-center justify-center gap-2 text-[13px] text-slate-500">
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              Cargando obras del presupuesto...
            </div>
          ) : obrasFiltradas.length === 0 ? (
            <div className="flex min-h-[260px] items-center justify-center px-5 text-center text-[13px] text-slate-500">
              {obras.length === 0
                ? "No hay obras presupuestarias disponibles."
                : "No se encontraron obras con ese criterio."}
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {obrasFiltradas.map((obra) => {
                const checked = seleccionadas.includes(obra.id);

                return (
                  <label
                    key={obra.id}
                    className={[
                      "grid cursor-pointer grid-cols-[auto_1fr] gap-3 rounded-lg border p-3 transition",
                      checked
                        ? "border-[#005f48]/45 bg-emerald-50/80 shadow-sm"
                        : "border-slate-300 bg-white hover:border-slate-500",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => alternarObra(obra)}
                      className="mt-0.5 h-4 w-4 accent-[#005f48]"
                    />
                    <span className="min-w-0">
                      <span className="block font-mono text-[10px] font-semibold text-slate-500">
                        Código {obra.id}
                      </span>
                      <span className="mt-0.5 block text-[12px] font-medium leading-4 text-slate-900">
                        {obra.nombre}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        <footer className="border-t border-slate-300 bg-white px-4 py-3">
          {error && (
            <div role="alert" className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">
              {error}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12px] text-slate-500">
              <span className="font-semibold tabular-nums text-slate-800">
                {seleccionadas.length}
              </span>{" "}
              {seleccionadas.length === 1
                ? "obra seleccionada"
                : "obras seleccionadas"}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={guardando}
                className="h-9 rounded-md border border-slate-300 bg-white px-4 text-[12px] font-semibold text-slate-700 transition hover:border-slate-600 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={guardando || cargando}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-[#005f48] bg-[#005f48] px-4 text-[12px] font-semibold text-white transition hover:bg-[#004b3a] disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
              >
                {guardando ? (
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Plus className="h-4 w-4" aria-hidden="true" />
                )}
                {guardando ? "Creando..." : "Crear proyecto"}
              </button>
            </div>
          </div>
        </footer>
      </form>
    </div>
  );
}

function normalizar(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
