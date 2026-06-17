"use client";

import { useEffect, useRef, useState } from "react";
import {
  BeneficiarioOption,
  buscarBeneficiarios,
} from "@/services/beneficiarios.service";

type Props = {
  value?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  onSelect: (beneficiario: BeneficiarioOption) => void;
  onClear?: () => void;
};

export default function SelectorBeneficiario({
  value = "",
  label = "Beneficiario",
  placeholder = "Buscar por nombre o identidad",
  disabled = false,
  onSelect,
  onClear,
}: Props) {
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<BeneficiarioOption[]>([]);
  const [seleccionado, setSeleccionado] = useState<BeneficiarioOption | null>(
    null
  );

  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!value) {
      setSeleccionado(null);
      return;
    }

    setSeleccionado((prev) => {
      if (prev?.id === value) return prev;

      return {
        id: value,
        nombre: "",
      };
    });
  }, [value]);

  useEffect(() => {
    function cerrarAlClickFuera(event: MouseEvent) {
      if (!wrapperRef.current) return;

      if (!wrapperRef.current.contains(event.target as Node)) {
        setAbierto(false);
      }
    }

    window.addEventListener("mousedown", cerrarAlClickFuera);

    return () => {
      window.removeEventListener("mousedown", cerrarAlClickFuera);
    };
  }, []);

  useEffect(() => {
    const termino = busqueda.trim();

    if (!abierto) return;

    const timeout = window.setTimeout(async () => {
      try {
        setCargando(true);
        setError("");

        const data = await buscarBeneficiarios(termino, 20);
        setResultados(data);
      } catch (err) {
        setResultados([]);
        setError(
          err instanceof Error
            ? err.message
            : "No se pudieron buscar beneficiarios."
        );
      } finally {
        setCargando(false);
      }
    }, 300);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [busqueda, abierto]);

  function seleccionarBeneficiario(beneficiario: BeneficiarioOption) {
    setSeleccionado(beneficiario);
    setBusqueda("");
    setAbierto(false);
    setResultados([]);

    onSelect(beneficiario);
  }

  function limpiarSeleccion() {
    setSeleccionado(null);
    setBusqueda("");
    setResultados([]);
    setAbierto(false);

    onClear?.();
  }

  return (
    <div ref={wrapperRef} className="relative">
      <label className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </label>

      {seleccionado ? (
        <div className="flex min-h-10 items-center justify-between gap-3 border border-slate-200 bg-white px-3 py-2">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-slate-900">
              {seleccionado.nombre || "Beneficiario seleccionado"}
            </div>

            <div className="mt-0.5 truncate text-[11px] text-slate-500">
              ID: {seleccionado.id}
            </div>
          </div>

          <button
            type="button"
            onClick={limpiarSeleccion}
            disabled={disabled}
            className="shrink-0 border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Cambiar
          </button>
        </div>
      ) : (
        <div className="relative">
          <input
            value={busqueda}
            disabled={disabled}
            onFocus={() => setAbierto(true)}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setAbierto(true);
            }}
            placeholder={placeholder}
            className="h-10 w-full border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
          />

          {abierto && (
            <div className="absolute left-0 right-0 top-11 z-50 max-h-[280px] overflow-y-auto border border-slate-200 bg-white shadow-lg">
              {cargando && (
                <div className="px-3 py-3 text-[12px] text-slate-500">
                  Buscando beneficiarios...
                </div>
              )}

              {!cargando && error && (
                <div className="border-b border-red-100 bg-red-50 px-3 py-3 text-[12px] text-red-700">
                  {error}
                </div>
              )}

              {!cargando && !error && resultados.length === 0 && (
                <div className="px-3 py-3 text-[12px] text-slate-500">
                  No hay beneficiarios para mostrar.
                </div>
              )}

              {!cargando &&
                resultados.map((beneficiario) => (
                  <button
                    key={beneficiario.id}
                    type="button"
                    onClick={() => seleccionarBeneficiario(beneficiario)}
                    className="block w-full border-b border-slate-100 px-3 py-2 text-left transition hover:bg-slate-50"
                  >
                    <div className="truncate text-[13px] font-semibold text-slate-900">
                      {beneficiario.nombre}
                    </div>

                    <div className="mt-0.5 truncate text-[11px] text-slate-500">
                      ID: {beneficiario.id}
                    </div>
                  </button>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}