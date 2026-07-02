"use client";

import { useMemo, useRef, useState } from "react";
import type { OpcionPresupuesto } from "@/services/gestionPresupuesto";

type SearchableSelectFieldProps = {
  label: string;
  value: string;
  options: OpcionPresupuesto[];
  disabled: boolean;
  onChange: (value: string) => void;
  placeholder?: string;
};

function normalizeSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function getOptionDetail(option: OpcionPresupuesto) {
  const escapedId = option.id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return option.nombre
    .replace(new RegExp(`^${escapedId}(?:\\s*[-:]\\s*|\\s+)`, "i"), "")
    .trim();
}

function sortByCode(options: OpcionPresupuesto[]) {
  return [...options].sort((a, b) =>
    a.id.localeCompare(b.id, "es-HN", {
      numeric: true,
      sensitivity: "base",
    })
  );
}

export default function SearchableSelectField({
  label,
  value,
  options,
  disabled,
  onChange,
  placeholder = "Buscar...",
}: SearchableSelectFieldProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const orderedOptions = useMemo(() => sortByCode(options), [options]);

  const selected = useMemo(
    () => orderedOptions.find((option) => option.id === value) ?? null,
    [orderedOptions, value]
  );

  const filteredOptions = useMemo(() => {
    const search = normalizeSearch(query);

    if (!search || selected?.nombre === query) {
      return orderedOptions.slice(0, 80);
    }

    return orderedOptions
      .filter((option) => {
        const code = normalizeSearch(option.id);
        const name = normalizeSearch(option.nombre);

        return code.includes(search) || name.includes(search);
      })
      .slice(0, 80);
  }, [orderedOptions, query, selected]);

  function closeLater() {
    blurTimer.current = setTimeout(() => {
      setOpen(false);
      setQuery(selected?.nombre ?? "");
    }, 120);
  }

  function clearBlurTimer() {
    if (!blurTimer.current) return;

    clearTimeout(blurTimer.current);
    blurTimer.current = null;
  }

  function selectOption(option: OpcionPresupuesto) {
    onChange(option.id);
    setQuery(option.nombre);
    setOpen(false);
  }

  function handleEnter() {
    const exactMatch =
      filteredOptions.find((option) => option.id === query.trim()) ??
      filteredOptions[0];

    if (exactMatch) {
      selectOption(exactMatch);
    }
  }

  return (
    <label className="relative block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <input
        value={open ? query : selected?.nombre ?? ""}
        placeholder={disabled ? "Cargando..." : placeholder}
        onFocus={() => {
          clearBlurTimer();
          if (!disabled) {
            setQuery(selected?.nombre ?? "");
            setOpen(true);
          }
        }}
        onBlur={closeLater}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          if (value) onChange("");
        }}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;

          event.preventDefault();
          handleEnter();
        }}
        disabled={disabled}
        className="h-9 w-full border border-slate-300 bg-white px-3 text-[12px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#00be87] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      />

      {open && !disabled && (
        <div className="absolute left-0 right-0 top-[60px] z-30 max-h-64 overflow-auto border border-slate-300 bg-white shadow-lg">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => {
              const detail = getOptionDetail(option);

              return (
                <button
                  key={option.id}
                  type="button"
                  onMouseDown={(event) => {
                    event.preventDefault();
                    selectOption(option);
                  }}
                  className={[
                    "block w-full px-3 py-2 text-left text-[12px] leading-snug transition hover:bg-[#eefaf6]",
                    option.id === value
                      ? "bg-[#e2f7ef] text-[#006b55]"
                      : "text-slate-800",
                  ].join(" ")}
                >
                  <span className="block font-semibold tabular-nums">
                    {option.id}
                  </span>
                  {detail && detail !== option.id && (
                    <span className="block truncate text-[11px] text-slate-500">
                      {detail}
                    </span>
                  )}
                </button>
              );
            })
          ) : (
            <div className="px-3 py-2 text-[12px] text-slate-400">
              Sin resultados
            </div>
          )}
        </div>
      )}
    </label>
  );
}
