"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Database, Filter, Pencil, RefreshCw, ShieldCheck, X } from "lucide-react";
import { usePermisosSistema } from "@/modules/autenticacion/hooks/usePermisosSistema";
import { TABLAS, mostrarValor, puedeEditarDatos, type Columna, type Fila, type Filtro, type Tabla } from "../domain/editor-datos";
import { consultarEditor } from "../services/editor-datos";
import EditarRegistro from "../components/EditarRegistro";
import FiltroColumna from "../components/FiltroColumna";

export default function EditorDatosPage() {
  const { cargandoPermisos, rolCodigo, usuarioId } = usePermisosSistema();
  const [tabla, setTabla] = useState(TABLAS[0]);
  if (cargandoPermisos) return <p role="status" className="p-8 text-sm text-slate-500">Verificando acceso…</p>;
  if (!puedeEditarDatos(rolCodigo, usuarioId)) return <section className="mx-auto max-w-xl rounded-2xl border border-amber-200 bg-amber-50 p-8"><ShieldCheck className="mb-4 text-amber-700" /><h1 className="text-xl font-semibold">Acceso restringido</h1><p className="mt-2 text-sm">El Editor de datos está disponible únicamente para Presupuesto.</p></section>;

  return <div className="flex h-full min-h-[420px] flex-col gap-4">
    <header className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <div className="flex items-center gap-3"><span className="rounded-xl bg-emerald-950 p-3 text-white"><Database size={22} /></span><div><p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Presupuesto</p><h1 className="text-xl font-semibold">Editor de datos</h1><p className="mt-0.5 text-xs text-slate-500">Consulta y edición directa de tablas de Supabase</p></div></div>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-800"><ShieldCheck size={14} />Solo Presupuesto</span>
    </header>
    <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
      <nav aria-label="Tablas de Supabase" className="flex shrink-0 gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white p-2 lg:w-60 lg:flex-col lg:overflow-y-auto">
        <p className="hidden px-3 py-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400 lg:block">Tablas · public</p>
        {TABLAS.map((item) => <button data-shortcut="309" key={item.nombre} type="button" aria-current={tabla.nombre === item.nombre ? "page" : undefined} onClick={() => setTabla(item)} className={`flex shrink-0 items-start gap-2 rounded-lg px-3 py-3 text-left text-xs transition lg:shrink ${tabla.nombre === item.nombre ? "bg-emerald-950 font-semibold text-white" : "text-slate-600 hover:bg-slate-50"}`}><Database size={15} className="mt-0.5 shrink-0" /><span>{item.titulo}</span></button>)}
      </nav>
      <TablaEditable key={tabla.nombre} tabla={tabla} />
    </div>
  </div>;
}

function TablaEditable({ tabla }: { tabla: Tabla }) {
  const [filtros, setFiltros] = useState<Filtro[]>([]);
  const [orden, setOrden] = useState({ columna: "id", direccion: "asc" as "asc" | "desc" });
  const [pagina, setPagina] = useState(0);
  const [limite, setLimite] = useState(50);
  const [revision, setRevision] = useState(0);
  const [resultado, setResultado] = useState<{ clave: string; filas: Fila[]; total: number } | null>(null);
  const [error, setError] = useState<{ clave: string; mensaje: string } | null>(null);
  const [aviso, setAviso] = useState("");
  const [editar, setEditar] = useState<Fila | null>(null);
  const [filtrar, setFiltrar] = useState<Columna | null>(null);
  const parametros = new URLSearchParams({ tabla: tabla.nombre, filtros: JSON.stringify(filtros), orden: orden.columna, direccion: orden.direccion, pagina: String(pagina), limite: String(limite) }).toString();
  const clave = `${parametros}&revision=${revision}`;
  const listo = resultado?.clave === clave;
  const mensajeError = error?.clave === clave ? error.mensaje : "";
  const cargando = !listo && !mensajeError;
  const filas = listo ? resultado.filas : [];
  const total = listo ? resultado.total : 0;

  useEffect(() => {
    const controlador = new AbortController();
    consultarEditor<{ filas: Fila[]; total: number }>(new URLSearchParams(parametros), { signal: controlador.signal })
      .then((datos) => { if (!controlador.signal.aborted) setResultado({ clave, ...datos }); })
      .catch((e) => { if (!controlador.signal.aborted) setError({ clave, mensaje: e.message }); });
    return () => controlador.abort();
  }, [parametros, clave]);

  function quitarFiltro(columna: string) { setFiltros(filtros.filter((f) => f.columna !== columna)); setPagina(0); }

  return <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm" aria-label={tabla.titulo}>
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
      <div><h2 className="text-sm font-semibold">{tabla.titulo}</h2><p className="mt-1 font-mono text-[11px] text-slate-400">public.{tabla.nombre} · {tabla.columnas.length} columnas</p></div>
      <div className="flex gap-2"><button data-shortcut="310" type="button" onClick={() => { setFiltros([]); setPagina(0); }} disabled={!filtros.length} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs disabled:opacity-40"><X size={14} />Limpiar filtros</button><button data-shortcut="311" type="button" onClick={() => { setRevision(revision + 1); setAviso(""); }} disabled={cargando} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs disabled:opacity-40"><RefreshCw size={14} className={cargando ? "animate-spin" : ""} />Actualizar</button></div>
    </div>
    <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-2 text-xs text-slate-500">Use el filtro de cada encabezado para ordenar o combinar condiciones. Pulse el lápiz para editar un registro.</div>
    {filtros.length > 0 && <div className="flex flex-wrap gap-2 border-b border-slate-200 px-4 py-2">{filtros.map((f) => <button data-shortcut="312" key={f.columna} onClick={() => quitarFiltro(f.columna)} aria-label={`Quitar filtro de ${f.columna}`} className="inline-flex max-w-full items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-900"><Filter size={12} /><span className="truncate">{f.columna}: {f.operador === "valores" ? `${f.valores?.length} valores` : `${f.operador} ${f.valor ?? ""}${f.hasta ? ` — ${f.hasta}` : ""}`}</span><X size={12} /></button>)}</div>}
    {aviso && <p role="status" className="border-b border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{aviso}</p>}
    {mensajeError && <div role="alert" className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{mensajeError}<button data-shortcut="313" onClick={() => setRevision(revision + 1)} className="ml-3 underline">Reintentar</button></div>}
    <div className="min-h-0 flex-1 overflow-auto" aria-busy={cargando}>
      <table className="w-full border-separate border-spacing-0 text-left text-xs">
        <thead className="sticky top-0 z-10"><tr><th className="sticky left-0 z-20 border-b border-r border-slate-200 bg-slate-100 px-3 py-3"><span className="sr-only">Editar</span><Pencil size={14} aria-hidden="true" /></th>{tabla.columnas.map((columna) => {
          const activo = filtros.some((f) => f.columna === columna.nombre);
          return <th key={columna.nombre} aria-sort={orden.columna === columna.nombre ? orden.direccion === "asc" ? "ascending" : "descending" : "none"} className="min-w-40 border-b border-r border-slate-200 bg-slate-100 px-3 py-2 font-normal"><button data-shortcut="314" type="button" aria-label={`Filtrar y ordenar ${columna.nombre}`} onClick={() => setFiltrar(columna)} className="flex w-full items-center justify-between gap-5 text-left"><span><span className="block whitespace-nowrap font-mono font-semibold text-slate-700">{columna.nombre}{columna.nombre === "id" ? " 🔑" : ""} {orden.columna === columna.nombre ? orden.direccion === "asc" ? "↑" : "↓" : ""}</span><span className="mt-1 block text-[10px] text-slate-400">{columna.tipo}</span></span><Filter size={14} className={activo ? "fill-emerald-200 text-emerald-800" : "text-slate-400"} /></button></th>;
        })}</tr></thead>
        <tbody>{filas.map((fila) => <tr key={fila.id} className="group hover:bg-emerald-50/60"><td className="sticky left-0 border-b border-r border-slate-100 bg-white px-2 group-hover:bg-emerald-50"><button data-shortcut="315" type="button" aria-label={`Editar registro ${fila.id}`} onClick={() => setEditar(fila)} className="rounded-md p-2 text-slate-400 hover:bg-emerald-100 hover:text-emerald-900"><Pencil size={14} /></button></td>{tabla.columnas.map((columna) => <td key={columna.nombre} title={mostrarValor(fila[columna.nombre])} className={`max-w-[340px] truncate whitespace-nowrap border-b border-r border-slate-100 px-3 py-3 font-mono ${fila[columna.nombre] === null ? "italic text-slate-300" : "text-slate-600"}`}>{mostrarValor(fila[columna.nombre])}</td>)}</tr>)}</tbody>
      </table>
      {cargando && <p role="status" className="p-12 text-center text-sm text-slate-500">Cargando registros…</p>}
      {listo && !filas.length && <div className="p-12 text-center"><Database className="mx-auto mb-3 text-slate-300" /><p className="text-sm text-slate-500">{filtros.length ? "No hay registros que coincidan con los filtros." : "No hay registros en esta página."}</p>{pagina > 0 && <button data-shortcut="316" className="mt-3 text-sm text-emerald-800 underline" onClick={() => setPagina(0)}>Volver a la primera página</button>}</div>}
    </div>
    <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
      <span>{listo ? `${total ? Math.min(pagina * limite + 1, total) : 0}–${Math.min((pagina + 1) * limite, total)} de ${total.toLocaleString("es-HN")} registros` : "Consultando registros"}{filtros.length ? " · filtrados" : ""}</span>
      <div className="flex items-center gap-3"><label>Filas <select aria-label="Filas por página" value={limite} onChange={(e) => { setLimite(Number(e.target.value)); setPagina(0); }} className="ml-1 rounded border border-slate-200 bg-white p-1">{[25, 50, 100, 200].map((n) => <option key={n}>{n}</option>)}</select></label><button data-shortcut="317" aria-label="Página anterior" disabled={!pagina || cargando} onClick={() => setPagina(pagina - 1)} className="rounded border border-slate-200 bg-white p-1 disabled:opacity-30"><ChevronLeft size={16} /></button><span>{pagina + 1}</span><button data-shortcut="318" aria-label="Página siguiente" disabled={!listo || (pagina + 1) * limite >= total} onClick={() => setPagina(pagina + 1)} className="rounded border border-slate-200 bg-white p-1 disabled:opacity-30"><ChevronRight size={16} /></button></div>
    </footer>
    {filtrar && <FiltroColumna tabla={tabla} columna={filtrar} filtros={filtros} cerrar={() => setFiltrar(null)} aplicar={(filtro) => { setFiltros([...filtros.filter((f) => f.columna !== filtrar.nombre), ...(filtro ? [filtro] : [])]); setPagina(0); setFiltrar(null); }} ordenar={(direccion) => { setOrden({ columna: filtrar.nombre, direccion }); setPagina(0); setFiltrar(null); }} />}
    {editar && <EditarRegistro tabla={tabla} original={editar} cerrar={() => setEditar(null)} guardado={() => { setEditar(null); setAviso("Cambios guardados en Supabase."); setRevision(revision + 1); }} />}
  </section>;
}
