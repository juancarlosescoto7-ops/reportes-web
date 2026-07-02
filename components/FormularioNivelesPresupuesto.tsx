"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, RefreshCw } from "lucide-react";
import SearchableSelectField from "@/components/SearchableSelectField";
import {
  crearRegistroPresupuesto,
  obtenerCatalogosPresupuesto,
  obtenerNivelPresupuesto,
  type CatalogosPresupuesto,
  type NivelPresupuesto,
  type OpcionPresupuesto,
} from "@/services/gestionPresupuesto";

type Selecciones = {
  Programa: string;
  SubPrograma: string;
  Proyecto: string;
  Actividad: string;
  Obra: string;
  Codigo: string;
};

type CrearNivel = Exclude<NivelPresupuesto, "Codigo">;

const NIVELES: NivelPresupuesto[] = [
  "Programa",
  "SubPrograma",
  "Proyecto",
  "Actividad",
  "Obra",
  "Codigo",
];

const LABELS: Record<NivelPresupuesto, string> = {
  Programa: "Programa",
  SubPrograma: "Subprograma",
  Proyecto: "Proyecto",
  Actividad: "Actividad",
  Obra: "Obra",
  Codigo: "Codigo presupuestario",
};

const PADRE_POR_NIVEL: Record<CrearNivel | "Codigo", keyof Selecciones | null> =
  {
    Programa: null,
    SubPrograma: "Programa",
    Proyecto: "SubPrograma",
    Actividad: "Proyecto",
    Obra: "Actividad",
    Codigo: "Obra",
  };

function emptySelecciones(): Selecciones {
  return {
    Programa: "",
    SubPrograma: "",
    Proyecto: "",
    Actividad: "",
    Obra: "",
    Codigo: "",
  };
}

function emptyOpciones(): Record<NivelPresupuesto, OpcionPresupuesto[]> {
  return {
    Programa: [],
    SubPrograma: [],
    Proyecto: [],
    Actividad: [],
    Obra: [],
    Codigo: [],
  };
}

function isCrearNivel(nivel: NivelPresupuesto): nivel is CrearNivel {
  return nivel !== "Codigo";
}

function getChildLevels(nivel: NivelPresupuesto) {
  const index = NIVELES.indexOf(nivel);

  return NIVELES.slice(index + 1);
}

export default function FormularioNivelesPresupuesto() {
  const router = useRouter();
  const [opciones, setOpciones] = useState(emptyOpciones);
  const [selecciones, setSelecciones] = useState<Selecciones>(emptySelecciones);
  const [catalogos, setCatalogos] = useState<CatalogosPresupuesto>({
    objetosGasto: [],
    fuentesFinanciamiento: [],
    tiposGasto: [],
  });
  const [creandoNivel, setCreandoNivel] = useState<CrearNivel | null>(null);
  const [fragmento, setFragmento] = useState("");
  const [nombre, setNombre] = useState("");
  const [objeto, setObjeto] = useState("");
  const [fuente, setFuente] = useState("");
  const [tipoInversion, setTipoInversion] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  const codigoPreview = useMemo(() => {
    if (!selecciones.Obra || !objeto || !fuente || !tipoInversion) return "";

    return `${selecciones.Obra} ${objeto} ${fuente} ${tipoInversion}`;
  }, [fuente, objeto, selecciones.Obra, tipoInversion]);

  const resetCrear = useCallback(() => {
    setCreandoNivel(null);
    setFragmento("");
    setNombre("");
  }, []);

  const resetCodigo = useCallback(() => {
    setObjeto("");
    setFuente("");
    setTipoInversion("");
  }, []);

  const inicializar = useCallback(async () => {
    setLoading(true);
    setError("");
    setMensaje("");

    try {
      const [programas, catalogosData] = await Promise.all([
        obtenerNivelPresupuesto("Programa"),
        obtenerCatalogosPresupuesto(),
      ]);

      setOpciones({
        ...emptyOpciones(),
        Programa: programas,
      });
      setSelecciones(emptySelecciones());
      setCatalogos(catalogosData);
      resetCrear();
      resetCodigo();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo cargar la gestion presupuestaria."
      );
    } finally {
      setLoading(false);
    }
  }, [resetCodigo, resetCrear]);

  useEffect(() => {
    setMounted(true);
    void inicializar();
  }, [inicializar]);

  async function cargarNivel(nivel: NivelPresupuesto, idPadre: string) {
    const rows = await obtenerNivelPresupuesto(nivel, idPadre);

    setOpciones((actual) => ({
      ...actual,
      [nivel]: rows,
    }));
  }

  async function handleSeleccion(nivel: NivelPresupuesto, value: string) {
    setError("");
    setMensaje("");

    setSelecciones((actual) => {
      const siguiente = {
        ...actual,
        [nivel]: value,
      };

      for (const child of getChildLevels(nivel)) {
        siguiente[child] = "";
      }

      return siguiente;
    });

    setOpciones((actual) => {
      const siguiente = { ...actual };

      for (const child of getChildLevels(nivel)) {
        siguiente[child] = [];
      }

      return siguiente;
    });

    resetCrear();

    if (!value) return;

    const siguienteNivel = NIVELES[NIVELES.indexOf(nivel) + 1];

    if (siguienteNivel) {
      try {
        await cargarNivel(siguienteNivel, value);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : `No se pudo cargar ${LABELS[siguienteNivel].toLowerCase()}.`
        );
      }
    }
  }

  function iniciarCrear(nivel: CrearNivel) {
    const padre = PADRE_POR_NIVEL[nivel];

    if (padre && !selecciones[padre]) {
      setError(`Seleccione primero un ${LABELS[padre].toLowerCase()}.`);
      return;
    }

    setError("");
    setMensaje("");
    setCreandoNivel(nivel);
    setFragmento("");
    setNombre("");
  }

  async function guardarNivel() {
    if (!creandoNivel) return;

    const padre = PADRE_POR_NIVEL[creandoNivel];
    const idPadre = padre ? selecciones[padre] : "";

    if (!fragmento.trim()) {
      setError("Ingrese el codigo del nivel.");
      return;
    }

    if (!nombre.trim()) {
      setError("Ingrese el nombre del nivel.");
      return;
    }

    setSaving(true);
    setError("");
    setMensaje("");

    try {
      const creado = await crearRegistroPresupuesto({
        nivel: creandoNivel,
        idPadre,
        fragmento,
        nombre,
      });

      await cargarNivel(creandoNivel, idPadre);
      await handleSeleccion(creandoNivel, creado.id);
      setMensaje(`${LABELS[creandoNivel]} creado: ${creado.id}`);
      resetCrear();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo crear el registro."
      );
    } finally {
      setSaving(false);
    }
  }

  async function guardarCodigo() {
    if (!selecciones.Obra) {
      setError("Seleccione primero una obra.");
      return;
    }

    if (!objeto || !fuente || !tipoInversion) {
      setError("Seleccione objeto del gasto, fuente y tipo de gasto.");
      return;
    }

    setSaving(true);
    setError("");
    setMensaje("");

    try {
      const creado = await crearRegistroPresupuesto({
        nivel: "Codigo",
        idPadre: selecciones.Obra,
        objeto,
        fuente,
        tipoInversion,
      });

      await cargarNivel("Codigo", selecciones.Obra);
      setSelecciones((actual) => ({
        ...actual,
        Codigo: creado.id,
      }));
      setMensaje(`Codigo creado: ${creado.id}`);
      resetCodigo();
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo crear el codigo."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!mounted) {
    return (
      <div className="px-4 py-8 text-center text-[12px] text-slate-400">
        Cargando gestion presupuestaria...
      </div>
    );
  }

  return (
    <div className="px-4 py-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="text-[12px] text-slate-500">
              Seleccione la ruta padre y cree el siguiente nivel donde
              corresponda.
            </div>

            <button
              type="button"
              onClick={inicializar}
              disabled={loading || saving}
              className="inline-flex h-9 items-center gap-2 border border-slate-300 bg-white px-3 text-[12px] font-semibold text-slate-700 transition hover:border-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Recargar
            </button>
          </div>

          {error && (
            <div className="mb-4 border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">
              {error}
            </div>
          )}

          {mensaje && (
            <div className="mb-4 border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-800">
              {mensaje}
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {NIVELES.map((nivel) => (
              <NivelSelector
                key={nivel}
                nivel={nivel}
                value={selecciones[nivel]}
                options={opciones[nivel]}
                disabled={
                  loading ||
                  (PADRE_POR_NIVEL[nivel] !== null &&
                    !selecciones[PADRE_POR_NIVEL[nivel]])
                }
                onChange={(value) => void handleSeleccion(nivel, value)}
                onCreate={
                  isCrearNivel(nivel) ? () => iniciarCrear(nivel) : undefined
                }
              />
            ))}
          </div>

          {creandoNivel && (
            <div className="mt-5 border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 text-[12px] font-semibold text-slate-950">
                Nuevo {LABELS[creandoNivel]}
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-[180px_1fr_auto]">
                <TextField
                  label="Codigo"
                  value={fragmento}
                  onChange={setFragmento}
                />
                <TextField label="Nombre" value={nombre} onChange={setNombre} />

                <div className="flex items-end gap-2">
                  <button
                    type="button"
                    onClick={guardarNivel}
                    disabled={saving}
                    className="h-9 border border-[#008b70] bg-[#008b70] px-3 text-[12px] font-semibold text-white transition hover:bg-[#00715d] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Crear
                  </button>

                  <button
                    type="button"
                    onClick={resetCrear}
                    disabled={saving}
                    className="h-9 border border-slate-300 bg-white px-3 text-[12px] font-semibold text-slate-700 transition hover:border-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="mt-5 border border-slate-200 bg-slate-50 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="text-[12px] font-semibold text-slate-950">
                Crear codigo presupuestario
              </div>

              {codigoPreview && (
                <div className="text-[11px] font-medium text-slate-600">
                  {codigoPreview}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_180px_180px_auto]">
              <SearchableSelectField
                label="Objeto del gasto"
                value={objeto}
                options={catalogos.objetosGasto}
                disabled={!selecciones.Obra || loading}
                onChange={setObjeto}
                placeholder="Buscar por codigo o descripcion..."
              />
              <SelectField
                label="Fuente"
                value={fuente}
                options={catalogos.fuentesFinanciamiento}
                disabled={!selecciones.Obra || loading}
                onChange={setFuente}
              />
              <SelectField
                label="Tipo"
                value={tipoInversion}
                options={catalogos.tiposGasto}
                disabled={!selecciones.Obra || loading}
                onChange={setTipoInversion}
              />

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={guardarCodigo}
                  disabled={saving || !selecciones.Obra}
                  className="h-9 w-full border border-[#008b70] bg-[#008b70] px-3 text-[12px] font-semibold text-white transition hover:bg-[#00715d] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Crear codigo
                </button>
              </div>
            </div>
          </div>
    </div>
  );
}

function NivelSelector({
  nivel,
  value,
  options,
  disabled,
  onChange,
  onCreate,
}: {
  nivel: NivelPresupuesto;
  value: string;
  options: OpcionPresupuesto[];
  disabled: boolean;
  onChange: (value: string) => void;
  onCreate?: () => void;
}) {
  return (
    <div className="border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {LABELS[nivel]}
        </label>

        {onCreate && (
          <button
            type="button"
            onClick={onCreate}
            disabled={disabled}
            className="inline-flex h-7 items-center gap-1 border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-700 transition hover:border-[#00be87] hover:text-[#006b55] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Crear
          </button>
        )}
      </div>

      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-9 w-full border border-slate-300 bg-white px-2 text-[12px] text-slate-900 outline-none transition focus:border-[#00be87] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        <option value="">Seleccionar...</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.nombre}
          </option>
        ))}
      </select>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full border border-slate-300 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-[#00be87]"
      />
    </label>
  );
}

function SelectField({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: OpcionPresupuesto[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="h-9 w-full border border-slate-300 bg-white px-2 text-[12px] text-slate-900 outline-none transition focus:border-[#00be87] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
      >
        <option value="">Seleccionar...</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
