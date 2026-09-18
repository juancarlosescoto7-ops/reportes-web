"use client";

import { Check, ClipboardPaste, Copy, GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { NivelBorrador } from "@/modules/presupuesto/services/borradorPresupuesto";
import {
  ELEMENTO_SIN, NOMBRES_NIVEL, nivelHijo, nombreEnDestino, nombreEsSin, recuperarElementos,
  type ElementoPresupuesto, type ElementoParaInsertar, type ElementoInsertado,
} from "@/modules/presupuesto/domain/elementos-presupuesto";
export const ELEMENTO_PRESUPUESTO_DRAG_TYPE = "application/x-elemento-presupuesto";
const DRAG_TYPE = ELEMENTO_PRESUPUESTO_DRAG_TYPE;

type Pieza = { nombre: string };
type Destino = { id?: string; nivel: NivelBorrador | null; nombre: string };
type ElementosContextValue = {
  elementos: ElementoPresupuesto[];
  activo: ElementoPresupuesto | null;
  ocupado: boolean;
  seleccionar: (id: string | null) => void;
  guardar: (pieza: Pieza, id?: string) => void;
  eliminar: (id: string) => void;
  insertar: (destino: Destino, pieza?: ElementoPresupuesto) => Promise<boolean>;
  iniciarArrastre: (id: string) => void;
  terminarArrastre: () => void;
  arrastrando: string | null;
};
const ElementosContext = createContext<ElementosContextValue | null>(null);

function useElementos() {
  const context = useContext(ElementosContext);
  if (!context) throw new Error("Los elementos requieren su proveedor de presupuesto.");
  return context;
}

export function ElementosPresupuestoProvider({ storageKey, onInsertar, children }: {
  storageKey: string;
  onInsertar: (pieza: ElementoParaInsertar, parentId?: string) => Promise<ElementoInsertado>;
  children: ReactNode;
}) {
  const [elementos, setElementos] = useState<ElementoPresupuesto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [avisoLocal, setAvisoLocal] = useState("");
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const lock = useRef(false);
  const activo = selectedId === ELEMENTO_SIN.id ? ELEMENTO_SIN : elementos.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      setElementos(recuperarElementos(stored));
    } catch {
      setElementos([]);
      setAvisoLocal("No se pudo recuperar la bandeja guardada en este navegador.");
    }
    setSelectedId(null);
    setLoadedKey(storageKey);
  }, [storageKey]);

  useEffect(() => {
    if (loadedKey !== storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(elementos));
    } catch {
      setAvisoLocal("La bandeja está disponible durante esta sesión; el navegador no permite guardarla.");
    }
  }, [elementos, loadedKey, storageKey]);

  function guardar(pieza: Pieza, id?: string) {
    if (lock.current || !pieza.nombre.trim()) return;
    if (nombreEsSin(pieza.nombre)) {
      setSelectedId(ELEMENTO_SIN.id);
      setMensaje("SIN… seleccionado.");
      return;
    }
    const clean = { tipo: "normal" as const, nombre: pieza.nombre.trim() };
    const existing = elementos.find((item) => item.nombre.toLocaleLowerCase("es") === clean.nombre.toLocaleLowerCase("es"));
    const nextId = id ?? existing?.id ?? crypto.randomUUID();
    setElementos((current) => [...current.filter((item) => item.id !== nextId), { ...clean, id: nextId }]);
    setSelectedId(nextId);
    setError("");
    setMensaje(`Pieza guardada: ${clean.nombre}.`);
  }

  async function insertar(destino: Destino, pieza = activo) {
    if (lock.current || !pieza) return false;
    const nivel = nivelHijo(destino.nivel);
    if (!nivel || (destino.nivel && !destino.id)) {
      setError("Selecciona un padre entre Programa y Actividad, o la raíz para crear un programa.");
      return false;
    }
    lock.current = true;
    setOcupado(true);
    setError("");
    setMensaje("");
    try {
      const result = await onInsertar({ ...pieza, nivel }, destino.id);
      setMensaje(result.existente
        ? `${result.codigo} · ${result.nombre}: ya existe.`
        : `${result.codigo} · ${result.nombre}: creado.`);
      return true;
    } catch (insertError) {
      setError(insertError instanceof Error ? insertError.message : "No se pudo insertar el elemento.");
      return false;
    } finally {
      lock.current = false;
      setOcupado(false);
      setArrastrando(null);
    }
  }

  return (
    <ElementosContext.Provider value={{
      elementos, activo, ocupado, arrastrando, guardar, insertar,
      seleccionar: (id) => { if (!lock.current) { setSelectedId(id); setError(""); } },
      eliminar: (id) => {
        if (lock.current) return;
        setElementos((current) => current.filter((item) => item.id !== id));
        if (selectedId === id) setSelectedId(null);
      },
      iniciarArrastre: (id) => { if (!lock.current) { setSelectedId(id); setArrastrando(id); setError(""); } },
      terminarArrastre: () => setArrastrando(null),
    }}>
      <div aria-live="polite" className="sr-only">{ocupado ? "Guardando…" : mensaje}</div>
      <div className="shrink-0">
        {avisoLocal ? <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">{avisoLocal}</p> : null}
      </div>
      {error ? <p role="alert" className="border-b border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">{error}</p> : null}
      {children}
    </ElementosContext.Provider>
  );
}

export function BandejaElementosPresupuesto({ integrada = false }: { integrada?: boolean }) {
  const { elementos, activo, ocupado, seleccionar, guardar, eliminar, iniciarArrastre, terminarArrastre } = useElementos();
  const [editing, setEditing] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [nombre, setNombre] = useState("");
  const [filtro, setFiltro] = useState("");

  function abrir(pieza?: Pieza, id?: string) {
    setEditing(id ?? null);
    setNombre(pieza?.nombre ?? "");
    setFormOpen(true);
  }

  return (
    <section aria-label="Elementos reutilizables" className={`z-20 flex shrink-0 flex-col rounded-xl border border-slate-200/80 bg-white shadow-sm ${integrada ? "max-h-[28vh]" : "m-2 max-h-[35vh] lg:mr-0 lg:max-h-none lg:w-56"}`}>
      <header className="flex items-center justify-between border-b border-slate-100 px-3 py-2.5">
        <div className="flex items-center gap-2 text-xs font-semibold text-[#003331]"><Copy className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />Piezas<span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] tabular-nums text-slate-500">{elementos.length + 1}</span></div>
        <div className="flex items-center gap-1">
          {activo ? <button type="button" disabled={ocupado} onClick={() => seleccionar(null)} title="Cancelar selección" aria-label="Cancelar selección de pieza" className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100"><X className="h-3.5 w-3.5" /></button> : null}
          <button type="button" disabled={ocupado} onClick={() => abrir()} title="Nueva pieza" aria-label="Nueva pieza" className="rounded-lg bg-[#005f48] p-1.5 text-white transition hover:bg-[#003331] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 disabled:opacity-50"><Plus className="h-3.5 w-3.5" aria-hidden="true" /></button>
        </div>
      </header>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
        {formOpen ? (
          <form onSubmit={(event) => {
            event.preventDefault();
            if (ocupado || !nombre.trim()) return;
            guardar({ nombre }, editing ?? undefined);
            setFormOpen(false);
            setFiltro("");
          }} className="flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50/50 p-1.5">
            <input autoFocus required aria-label={editing ? "Editar nombre de pieza" : "Nombre de pieza"} value={nombre} disabled={ocupado} onChange={(event) => setNombre(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape" && !ocupado) setFormOpen(false); }} placeholder="Nombre" className="h-8 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 text-xs outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
            <button type="submit" disabled={ocupado || !nombre.trim()} title="Guardar pieza" aria-label="Guardar pieza" className="rounded-md bg-[#005f48] p-1.5 text-white disabled:opacity-50"><Check className="h-3.5 w-3.5" /></button>
            <button type="button" disabled={ocupado} onClick={() => setFormOpen(false)} aria-label="Cerrar edición de pieza" className="rounded p-1 text-slate-500"><X className="h-3.5 w-3.5" /></button>
          </form>
        ) : null}
        <TarjetaElementoSin />
        {elementos.length ? <input aria-label="Buscar piezas" value={filtro} onChange={(event) => setFiltro(event.target.value)} placeholder="Buscar…" className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/70 px-2 text-xs outline-none focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-100" /> : null}
        {elementos.filter((item) => item.nombre.toLocaleLowerCase("es").includes(filtro.toLocaleLowerCase("es"))).map((item) => (
          <div key={item.id} className={`group flex items-center gap-1 rounded-lg border p-1 transition ${activo?.id === item.id ? "border-emerald-400 bg-emerald-50 shadow-sm" : "border-slate-200/80 bg-white hover:border-emerald-200 hover:shadow-sm"}`}>
            <button type="button" draggable={!ocupado} disabled={ocupado} aria-pressed={activo?.id === item.id} onClick={() => seleccionar(activo?.id === item.id ? null : item.id)} onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "copy";
              event.dataTransfer.setData(DRAG_TYPE, item.id);
              iniciarArrastre(item.id);
            }} onDragEnd={terminarArrastre} title={item.nombre} className="flex min-w-0 flex-1 cursor-grab items-center gap-1 rounded p-1 text-left active:cursor-grabbing disabled:opacity-50">
              <GripVertical className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
              <span className="truncate text-xs font-medium text-slate-800">{item.nombre}</span>
            </button>
            <button type="button" disabled={ocupado} onClick={() => abrir(item, item.id)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" title="Editar" aria-label={`Editar pieza ${item.nombre}`}><Pencil className="h-3 w-3" /></button>
            <button type="button" disabled={ocupado} onClick={() => eliminar(item.id)} className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Quitar" aria-label={`Quitar ${item.nombre} de la bandeja`}><Trash2 className="h-3 w-3" /></button>
          </div>
        ))}
      </div>
    </section>
  );
}

function TarjetaElementoSin() {
  const { activo, ocupado, seleccionar, iniciarArrastre, terminarArrastre } = useElementos();
  return (
    <div className={`rounded-lg border p-1 transition ${activo?.id === ELEMENTO_SIN.id ? "border-emerald-400 bg-emerald-50 shadow-sm" : "border-emerald-200 bg-emerald-50/40 hover:border-emerald-400"}`}>
      <button type="button" draggable={!ocupado} disabled={ocupado} aria-pressed={activo?.id === ELEMENTO_SIN.id} onClick={() => seleccionar(activo?.id === ELEMENTO_SIN.id ? null : ELEMENTO_SIN.id)} onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "copy";
        event.dataTransfer.setData(DRAG_TYPE, ELEMENTO_SIN.id);
        iniciarArrastre(ELEMENTO_SIN.id);
      }} onDragEnd={terminarArrastre} title="SIN… · código 0" className="flex w-full cursor-grab items-center gap-1 rounded p-1 text-left active:cursor-grabbing disabled:opacity-50">
        <GripVertical className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
        <span className="flex-1 text-xs font-semibold text-emerald-900">SIN…</span><span className="px-1 text-[10px] font-semibold text-emerald-700">0</span>
      </button>
    </div>
  );
}

export function ZonaInsercionPresupuesto({ nivel, id, nombre, onInserted, children, sangria = 12 }: Destino & {
  onInserted?: () => void;
  children?: ReactNode | ((acciones: ReactNode) => ReactNode);
  sangria?: number;
}) {
  const { activo, ocupado, arrastrando, insertar } = useElementos();
  const [hover, setHover] = useState(false);
  const [creando, setCreando] = useState(false);
  const [nombreNuevo, setNombreNuevo] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const hijo = nivelHijo(nivel);
  if (!hijo) return <>{typeof children === "function" ? children(null) : children}</>;
  const nombreHijo = activo ? nombreEnDestino(activo, hijo) : "";

  async function colocar() {
    setHover(false);
    if (await insertar({ nivel, id, nombre })) onInserted?.();
  }

  async function crearHijo() {
    if (ocupado || !nombreNuevo.trim()) return;
    const success = await insertar({ nivel, id, nombre }, {
      id: "hijo-directo", tipo: nombreEsSin(nombreNuevo) ? "sin" : "normal", nombre: nombreNuevo.trim(),
    });
    if (success) {
      setNombreNuevo("");
      onInserted?.();
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }

  const acciones = <span className="inline-flex shrink-0 items-center gap-0.5">
    {activo && !arrastrando ? <button type="button" disabled={ocupado} onClick={() => void colocar()} title={`Insertar ${nombreHijo}`} aria-label={`Insertar ${nombreHijo} en ${nombre}`} className="grid h-7 w-7 place-items-center rounded text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"><ClipboardPaste className="h-3.5 w-3.5" /></button> : null}
    <button type="button" disabled={ocupado} onClick={() => setCreando(true)} title={`Añadir ${NOMBRES_NIVEL[hijo].toLocaleLowerCase("es")}`} aria-label={`Añadir hijo en ${nombre}`} className="grid h-7 w-7 place-items-center rounded text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-40"><Plus className="h-3.5 w-3.5" /></button>
  </span>;

  return (
    <div onDragOver={(event) => {
      if (!activo || ocupado || arrastrando !== activo.id || !event.dataTransfer.types.includes(DRAG_TYPE)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setHover(true);
    }} onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setHover(false); }} onDrop={(event) => {
      event.preventDefault();
      event.stopPropagation();
      setHover(false);
      if (activo && !ocupado && arrastrando === activo.id && event.dataTransfer.getData(DRAG_TYPE) === activo.id) void colocar();
    }} className={`relative transition ${hover && arrastrando ? "bg-emerald-50 ring-1 ring-inset ring-emerald-500" : ""}`}>
      {typeof children === "function" ? children(acciones) : children ?? <div className="flex h-9 items-center gap-2 border-b border-slate-100 bg-slate-50/70 px-3"><span className="text-xs font-semibold text-slate-600">Programas</span>{acciones}</div>}
      {hover && arrastrando ? <span className="pointer-events-none absolute right-52 top-1 max-w-48 truncate rounded bg-emerald-700 px-2 py-1 text-[10px] font-medium text-white">{nombreHijo}</span> : null}
      {creando ? <form style={{ paddingLeft: sangria }} className="flex items-center gap-1 border-b border-slate-100 bg-slate-50 py-1 pr-3" onSubmit={(event) => { event.preventDefault(); void crearHijo(); }}>
        <input ref={inputRef} autoFocus required aria-label={`Nombre del nuevo ${NOMBRES_NIVEL[hijo].toLocaleLowerCase("es")}`} disabled={ocupado} value={nombreNuevo} onChange={(event) => setNombreNuevo(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape" && !ocupado) { setCreando(false); setNombreNuevo(""); } }} placeholder="Nombre" className="h-8 min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 text-xs" />
        <button type="submit" disabled={ocupado || !nombreNuevo.trim()} title="Añadir · Enter" aria-label="Añadir hijo" className="grid h-8 w-8 shrink-0 place-items-center rounded bg-[#005f48] text-white disabled:opacity-40"><Check className="h-3.5 w-3.5" /></button>
        <button type="button" disabled={ocupado} onClick={() => { setCreando(false); setNombreNuevo(""); }} title="Cerrar · Esc" aria-label="Cerrar creación de hijo" className="grid h-8 w-8 shrink-0 place-items-center rounded text-slate-500 hover:bg-slate-100"><X className="h-3.5 w-3.5" /></button>
      </form> : null}
    </div>
  );
}

export function ReutilizarNivelPresupuesto({ nombre }: Pieza) {
  const { guardar, ocupado } = useElementos();
  return <button type="button" disabled={ocupado} onClick={() => guardar({ nombre })} title="Guardar en piezas" aria-label={`Reutilizar ${nombre}`} className="grid h-7 w-7 shrink-0 place-items-center rounded text-slate-400 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50"><Copy className="h-3.5 w-3.5" /></button>;
}
