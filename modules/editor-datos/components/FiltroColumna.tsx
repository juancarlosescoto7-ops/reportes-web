"use client";

import { useEffect, useState } from "react";
import Dialogo from "./Dialogo";
import { agregarFiltros, mostrarValor, type Columna, type Filtro, type Tabla } from "../domain/editor-datos";
import { consultarEditor } from "../services/editor-datos";

type Valores = { valores: (string | null)[]; siguiente: number | null };
const operadores: { valor: Filtro["operador"]; texto: string }[] = [
  { valor: "valores", texto: "Seleccionar valores" }, { valor: "contiene", texto: "Contiene texto" },
  { valor: "eq", texto: "Es igual a" }, { valor: "neq", texto: "No es igual a" },
  { valor: "gte", texto: "Mayor o igual que / desde" }, { valor: "lte", texto: "Menor o igual que / hasta" },
  { valor: "entre", texto: "Entre dos valores" }, { valor: "nulo", texto: "Es NULL (sin dato)" }, { valor: "no_nulo", texto: "No es NULL" },
];

export default function FiltroColumna({ tabla, columna, filtros, aplicar, ordenar, cerrar }: { tabla: Tabla; columna: Columna; filtros: Filtro[]; aplicar: (filtro: Filtro | null) => void; ordenar: (direccion: "asc" | "desc") => void; cerrar: () => void }) {
  const actual = filtros.find((f) => f.columna === columna.nombre);
  const [filtro, setFiltro] = useState<Filtro>(actual ?? { columna: columna.nombre, operador: "valores", valores: [] });
  const [valores, setValores] = useState<(string | null)[]>([]);
  const [siguiente, setSiguiente] = useState<number | null>(null);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [error, setError] = useState("");
  const filtrosJSON = JSON.stringify(filtros);

  useEffect(() => {
    const controlador = new AbortController();
    consultarEditor<Valores>(new URLSearchParams({ tabla: tabla.nombre, valores: columna.nombre, filtros: filtrosJSON }), { signal: controlador.signal })
      .then((datos) => { setValores(datos.valores); setSiguiente(datos.siguiente); })
      .catch((e) => { if (!controlador.signal.aborted) setError(e.message); })
      .finally(() => { if (!controlador.signal.aborted) setCargando(false); });
    return () => controlador.abort();
  }, [tabla.nombre, columna.nombre, filtrosJSON]);

  async function cargarMas() {
    if (siguiente === null || cargando) return;
    setCargando(true); setError("");
    try {
      const datos = await consultarEditor<Valores>(new URLSearchParams({ tabla: tabla.nombre, valores: columna.nombre, filtros: filtrosJSON, pagina: String(siguiente) }));
      setValores((previos) => [...new Set([...previos, ...datos.valores])]);
      setSiguiente(datos.siguiente);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudieron cargar los valores."); }
    finally { setCargando(false); }
  }

  function guardar() {
    try { agregarFiltros(new URLSearchParams(), tabla, [filtro]); aplicar(filtro); }
    catch (e) { setError(e instanceof Error ? e.message : "Filtro inválido."); }
  }

  const visibles = [...new Set([...valores, ...(filtro.valores ?? [])])].filter((v) => mostrarValor(v).toLocaleLowerCase().includes(busqueda.toLocaleLowerCase()));
  return <Dialogo titulo={`Filtrar: ${columna.nombre}`} cerrar={cerrar}>
    <div className="space-y-4 p-6">
      <div className="flex gap-2"><button data-shortcut="301" onClick={() => ordenar("asc")} className="flex-1 rounded-lg border border-slate-200 p-2 text-sm">↑ Orden ascendente</button><button data-shortcut="302" onClick={() => ordenar("desc")} className="flex-1 rounded-lg border border-slate-200 p-2 text-sm">↓ Orden descendente</button></div>
      <label className="block text-sm font-medium">Condición<select value={filtro.operador} onChange={(e) => setFiltro({ ...filtro, operador: e.target.value as Filtro["operador"] })} className="mt-2 w-full rounded-lg border border-slate-200 bg-white p-2.5">{operadores.filter((o) => o.valor !== "contiene" || columna.tipo === "text").map((o) => <option key={o.valor} value={o.valor}>{o.texto}</option>)}</select></label>
      {filtro.operador === "valores" ? <div className="space-y-3">
        <input aria-label="Buscar en valores cargados" placeholder="Buscar en valores cargados…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <div className="flex flex-wrap justify-between gap-2 text-xs"><button data-shortcut="303" onClick={() => setFiltro({ ...filtro, valores: [...new Set([...(filtro.valores ?? []), ...visibles])] })} className="text-emerald-800 underline">Seleccionar visibles</button><button data-shortcut="304" onClick={() => setFiltro({ ...filtro, valores: [] })} className="text-slate-600 underline">Deseleccionar todos</button><span>{filtro.valores?.length ?? 0} seleccionado(s)</span></div>
        <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-200 p-2">
          {visibles.map((valor) => <label key={JSON.stringify(valor)} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50"><input data-shortcut="305" className="mt-1" type="checkbox" checked={filtro.valores?.includes(valor) ?? false} onChange={(e) => setFiltro({ ...filtro, valores: e.target.checked ? [...(filtro.valores ?? []), valor] : filtro.valores?.filter((v) => v !== valor) })} /><span className={`break-all ${valor === null ? "italic text-slate-400" : ""}`}>{mostrarValor(valor)}</span></label>)}
          {!visibles.length && !cargando && <p className="p-3 text-sm text-slate-500">No hay valores para mostrar.</p>}
          {cargando && <p role="status" className="p-3 text-sm text-slate-500">Cargando valores…</p>}
        </div>
        {siguiente !== null && <button data-shortcut="306" disabled={cargando} onClick={cargarMas} className="w-full rounded-lg border border-slate-200 p-2 text-sm disabled:opacity-40">Cargar más valores de la tabla</button>}
        <p className="text-xs leading-5 text-slate-500">Los valores respetan los filtros de las otras columnas. {siguiente !== null ? "Quedan valores por cargar. Puede usar una condición para buscar en toda la tabla." : ""} Quitar el filtro incluye todos los valores.</p>
      </div> : !["nulo", "no_nulo"].includes(filtro.operador) ? <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Valor<input type={columna.tipo === "date" ? "date" : "text"} value={filtro.valor ?? ""} onChange={(e) => setFiltro({ ...filtro, valor: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-200 p-2.5" /></label>{filtro.operador === "entre" && <label className="text-sm">Hasta<input type={columna.tipo === "date" ? "date" : "text"} value={filtro.hasta ?? ""} onChange={(e) => setFiltro({ ...filtro, hasta: e.target.value })} className="mt-2 w-full rounded-lg border border-slate-200 p-2.5" /></label>}</div> : null}
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="flex justify-between border-t border-slate-200 pt-4"><button data-shortcut="307" onClick={() => aplicar(null)} className="text-sm text-slate-600 underline">Quitar filtro</button><button data-shortcut="308" onClick={guardar} className="rounded-lg bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-white">Aplicar filtro</button></div>
    </div>
  </Dialogo>;
}
