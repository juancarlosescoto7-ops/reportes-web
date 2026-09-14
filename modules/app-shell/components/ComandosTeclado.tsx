"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Keyboard, Search, X } from "lucide-react";
import { usePermisosSistema } from "@/modules/autenticacion/hooks/usePermisosSistema";
import { construirIndiceNavegacion } from "@/modules/busqueda-global/domain/busqueda-universal";
import catalogo from "../config/acciones-teclado.json";
import { ATAJOS_LOCALES, ATAJOS_NAVEGACION, formatoAtajo, NOMBRES_MODULOS } from "../config/atajos";
import { avanzarSecuencia, ESPERA_SECUENCIA, normalizarComando, type EstadoSecuencia } from "../domain/secuencia-teclado";
import { activarDestino, ambitoActual, campoEditable, destinosAccion, esVisible, type AccionCatalogada, type DestinoAccion } from "../domain/acciones-pantalla";

const ACCIONES: AccionCatalogada[] = catalogo;
const MODULOS_ACCESO: Record<string, string[]> = {
  "editor-datos": ["editor-datos"],
  "ordenes-pago": ["egresos", "ordenes-pago-documentos"], "cuentas-por-pagar": ["compromisos"],
  presupuesto: ["presupuesto"], ingresos: ["ingresos"], arqueos: ["arqueos"],
  proyectos: ["proyectos"], auditoria: ["auditoria"], pendientes: ["pendientes"],
  dashboard: ["inicio"], documentos: ["proyectos", "compromisos", "ordenes-pago-documentos"],
  beneficiarios: ["egresos", "compromisos"],
};
const CREACIONES: Record<string, string[]> = {
  "nuevo-egreso": ["160", "167"], "nueva-cxp": ["048", "057", "062"],
  "nuevo-proyecto": ["281"], "nuevo-arqueo": ["020"],
};

function reveladores(codigos: string[], ambito: HTMLElement) {
  return Array.from(ambito.querySelectorAll<HTMLElement>("[data-shortcut-reveals]"))
    .filter((el) => esVisible(el) && el.getAttribute("aria-expanded") !== "true"
      && codigos.some((codigo) => el.dataset.shortcutReveals?.split(" ").includes(codigo)));
}

export default function ComandosTeclado() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    permisos: permisosUsuario,
    rolCodigo,
    nombreUsuario,
    usuarioId,
  } = usePermisosSistema();
  const navegacion = useMemo(
    () => construirIndiceNavegacion({ permisos: permisosUsuario, rolCodigo, nombreUsuario, usuarioId })
      .filter((item) => ATAJOS_NAVEGACION[item.id.replace("navegacion:", "")]),
    [permisosUsuario, rolCodigo, nombreUsuario, usuarioId],
  );
  const accionesPermitidas = useMemo(() => {
    const idsPermitidos = new Set(navegacion.map((item) => item.id.replace("navegacion:", "")));
    return ACCIONES.filter((item) => ["general", "busqueda-global", "autenticacion"].includes(item.modulo)
      || MODULOS_ACCESO[item.modulo]?.some((id) => idsPermitidos.has(id)));
  }, [navegacion]);
  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState("");
  const [categoria, setCategoria] = useState("disponibles");
  const [aviso, setAviso] = useState("");
  const [secuencia, setSecuencia] = useState("");
  const [disponibles, setDisponibles] = useState<Record<string, DestinoAccion[]>>({});
  const [revelables, setRevelables] = useState<string[]>([]);
  const [elecciones, setElecciones] = useState<DestinoAccion[] | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buscadorRef = useRef<HTMLInputElement>(null);
  const focoPrevio = useRef<HTMLElement | null>(null);
  const estadoRef = useRef<EstadoSecuencia>({ teclas: "", instante: 0 });
  const pendiente = useRef<{ ruta: string; codigos: string[]; vence: number } | null>(null);
  const ambitoRef = useRef<HTMLElement | null>(null);

  function abrirManual(opciones?: DestinoAccion[]) {
    if (!abierto) focoPrevio.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ambitoRef.current = ambitoActual();
    setConsulta("");
    setElecciones(opciones ?? null);
    setCategoria("disponibles");
    setAbierto(true);
  }
  function cerrarManual() {
    dialogRef.current?.close();
    setAbierto(false);
    setElecciones(null);
    focoPrevio.current?.focus({ preventScroll: true });
  }
  function ejecutarDestinos(destinos: DestinoAccion[]) {
    const habilitados = destinos.filter((item) => item.habilitado);
    if (!habilitados.length) { setAviso("La acción no está habilitada en este momento."); return false; }
    if (habilitados.length > 1) { abrirManual(habilitados); return true; }
    cerrarManual();
    if (!activarDestino(habilitados[0])) setAviso("La acción ya no está disponible. Vuelve a seleccionarla.");
    return true;
  }
  function ejecutarCodigos(codigos: string[], esperar = true) {
    const ambito = abierto ? ambitoRef.current ?? ambitoActual() : ambitoActual();
    const destinos = codigos.flatMap((codigo) => destinosAccion(codigo, ambito));
    if (destinos.length) { ejecutarDestinos(destinos); return true; }
    const paneles = reveladores(codigos, ambito);
    if (paneles.length > 1) {
      abrirManual(paneles.map((elemento) => ({ elemento, titulo: `Abrir ${elemento.innerText}`, contexto: elemento.closest("section, header")?.textContent?.slice(0, 180) ?? "Selecciona el panel donde quieres trabajar", habilitado: true })));
      setAviso("Selecciona el panel y vuelve a pulsar el atajo de la acción.");
      return true;
    }
    if (paneles.length === 1) {
      cerrarManual();
      paneles[0].click();
      if (esperar) pendiente.current = { ruta: pathname, codigos, vence: Date.now() + 3000 };
      return false;
    }
    return false;
  }

  function ejecutarComando(comando: string) {
    pendiente.current = null;
    setAviso("");
    if (comando === "man") { if (abierto) cerrarManual(); else abrirManual(); return; }
    if (comando === "bug") { cerrarManual(); ejecutarCodigos(["043"]); return; }
    if (comando === "bus") {
      const ambito = ambitoActual();
      const campo = Array.from((ambito === document.body ? document.querySelector("main") ?? ambito : ambito)
        .querySelectorAll<HTMLInputElement>('input[type="search"], input[placeholder]'))
        .find((el) => esVisible(el) && !el.disabled && /busca|filtra/i.test(el.placeholder + el.type));
      if (campo) { cerrarManual(); campo.focus(); campo.select(); }
      else setAviso("Esta vista no tiene un campo de búsqueda disponible.");
      return;
    }
    const enlace = navegacion.find((item) => ATAJOS_NAVEGACION[item.id.replace("navegacion:", "")] === comando);
    if (enlace) {
      if (ambitoActual() !== document.body) { setAviso("Cierra el formulario o diálogo actual antes de cambiar de pantalla."); return; }
      const id = enlace.id.replace("navegacion:", "");
      cerrarManual();
      if (id === "nuevo-beneficiario") { window.dispatchEvent(new Event("comandos:nuevo-beneficiario")); return; }
      const ruta = enlace.href.split("?")[0];
      const codigos = CREACIONES[id];
      if (codigos) {
        if (ruta === pathname && ejecutarCodigos(codigos)) return;
        pendiente.current = { ruta, codigos, vence: Date.now() + 12000 };
        if (ruta !== pathname) router.push(ruta);
      } else router.push(enlace.href);
      return;
    }
    const accionCatalogada = accionesPermitidas.find((item) => item.atajo === comando);
    const codigos = accionCatalogada ? [accionCatalogada.codigo]
      : accionesPermitidas.filter((item) => {
        const patron = ATAJOS_LOCALES.find((atajo) => atajo.teclas === comando)?.patron;
        return patron && new RegExp(patron).test(normalizarComando(item.titulo));
      }).map((item) => item.codigo);
    if (!ejecutarCodigos(codigos) && !pendiente.current) {
      setAviso("Abre el panel, formulario o registro de esta acción. Consulta su ubicación en el manual (Shift + MAN).");
    }
  }

  const manejarTecla = useEffectEvent((event: KeyboardEvent) => {
    if (event.defaultPrevented || event.isComposing) return;
    if (event.key === "Escape") {
      estadoRef.current = { teclas: "", instante: 0 }; setSecuencia(""); pendiente.current = null;
      if (abierto) { event.preventDefault(); event.stopImmediatePropagation(); cerrarManual(); }
      return;
    }
    if (campoEditable(event.target)) { estadoRef.current = { teclas: "", instante: 0 }; setSecuencia(""); return; }
    const comandos = [...Object.values(ATAJOS_NAVEGACION), ...ATAJOS_LOCALES.map((item) => item.teclas), ...accionesPermitidas.map((item) => item.atajo)];
    const resultado = avanzarSecuencia(estadoRef.current, event, comandos, Date.now());
    estadoRef.current = resultado.estado;
    setSecuencia(resultado.estado.teclas);
    if (resultado.consumir) { event.preventDefault(); event.stopImmediatePropagation(); }
    if (resultado.comando) ejecutarComando(resultado.comando);
  });
  const ejecutarComandoEvent = useEffectEvent((comando: string) =>
    ejecutarComando(comando)
  );
  const revisarPendiente = useEffectEvent(() => {
    const accion = pendiente.current;
    if (!accion) return;
    if (Date.now() > accion.vence) {
      pendiente.current = null;
      setAviso("La acción no está disponible todavía. Espera a que cargue la pantalla o revisa tus permisos.");
    } else if (accion.ruta === pathname && ejecutarCodigos(accion.codigos, false)) pendiente.current = null;
  });

  useEffect(() => {
    const manejar = (event: KeyboardEvent) => manejarTecla(event);
    const limpiar = () => { estadoRef.current = { teclas: "", instante: 0 }; setSecuencia(""); pendiente.current = null; };
    const temporizador = window.setInterval(() => revisarPendiente(), 150);
    window.addEventListener("keydown", manejar, true);
    window.addEventListener("blur", limpiar);
    return () => { window.removeEventListener("keydown", manejar, true); window.removeEventListener("blur", limpiar); window.clearInterval(temporizador); };
  }, []);
  useEffect(() => {
    if (!secuencia) return;
    const comandos = [...Object.values(ATAJOS_NAVEGACION), ...ATAJOS_LOCALES.map((item) => item.teclas), ...accionesPermitidas.map((item) => item.atajo)];
    const esComandoCompleto = comandos.includes(secuencia);
    const timer = window.setTimeout(() => {
      const comandoPendiente = estadoRef.current.teclas;
      estadoRef.current = { teclas: "", instante: 0 };
      setSecuencia("");
      if (esComandoCompleto && comandoPendiente === secuencia) ejecutarComandoEvent(secuencia);
    }, esComandoCompleto ? 900 : ESPERA_SECUENCIA);
    return () => window.clearTimeout(timer);
  }, [secuencia, accionesPermitidas]);
  useEffect(() => {
    if (!aviso) return;
    const timer = window.setTimeout(() => setAviso(""), 6500);
    return () => window.clearTimeout(timer);
  }, [aviso]);
  useEffect(() => {
    if (!abierto) return;
    dialogRef.current?.showModal();
    buscadorRef.current?.focus();
    const refrescar = () => {
      const ambito = ambitoRef.current ?? document.body;
      setDisponibles(Object.fromEntries(ACCIONES.map((item) => [item.codigo, destinosAccion(item.codigo, ambito)])));
      setRevelables(ACCIONES.filter((item) => reveladores([item.codigo], ambito).length).map((item) => item.codigo));
    };
    refrescar();
    const timer = window.setInterval(refrescar, 1000);
    return () => window.clearInterval(timer);
  }, [abierto]);
  useEffect(() => {
    estadoRef.current = { teclas: "", instante: 0 };
  }, [pathname]);

  const consultaNormal = normalizarComando(consulta);
  const coincide = (texto: string) => normalizarComando(texto).includes(consultaNormal);
  const accionesFiltradas = accionesPermitidas.filter((item) =>
    (categoria === "todas" || categoria === "disponibles" && (disponibles[item.codigo]?.length || revelables.includes(item.codigo)) || categoria === item.modulo)
    && coincide(`${item.titulo} ${NOMBRES_MODULOS[item.modulo]} ${formatoAtajo(item.atajo)}`));
  const modulos = useMemo(() => Object.entries(NOMBRES_MODULOS), []);

  return (
    <>
      <button type="button" onClick={() => abrirManual()} title="Manual de comandos (Shift + MAN)" aria-label="Manual de comandos" className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-emerald-50">
        <Keyboard className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Comandos</span>
      </button>
      {(secuencia || aviso) && <div role="status" className="fixed bottom-5 left-1/2 z-[200] max-w-[90vw] -translate-x-1/2 rounded-xl bg-slate-950 px-5 py-3 text-sm text-white shadow-xl">
        {secuencia ? `Shift + ${secuencia.toUpperCase()}… · Esc cancela` : aviso}
      </div>}
      <dialog ref={dialogRef} data-manual-comandos aria-labelledby="titulo-manual-comandos" onCancel={(event) => { event.preventDefault(); cerrarManual(); }} className="m-auto max-h-[88dvh] w-[min(960px,94vw)] overflow-hidden rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50">
        <div className="flex max-h-[88dvh] flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
            <div><p className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Guía de teclado</p><h2 id="titulo-manual-comandos" className="text-xl font-semibold">{elecciones ? "Selecciona el registro o la acción" : "Manual de comandos"}</h2></div>
            <button type="button" onClick={cerrarManual} aria-label="Cerrar manual" className="rounded-lg p-2 hover:bg-slate-100"><X className="h-5 w-5" /></button>
          </header>
          <div className="space-y-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
            <p className="text-sm leading-6 text-slate-600">Mantén <kbd>Shift</kbd> y escribe una abreviación: <kbd>Shift + EGR</kbd> abre Egresos y <kbd>Shift + NEGR</kbd> abre Nuevo egreso. Tienes 2,5 segundos entre teclas; <kbd>Esc</kbd> cancela. Los atajos se pausan al escribir en campos; sal del campo con Tab para utilizarlos.</p>
            {aviso && <p role="status" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">{aviso}</p>}
            <p className="text-xs leading-5 text-slate-500">Todas las acciones usan abreviaciones de sus nombres. Abre primero el formulario o detalle indicado cuando la acción pertenezca a uno. Se conservan permisos, validaciones y confirmaciones; si hay varios registros, podrás elegir uno. Usa Tab y Enter para recorrer esta guía.</p>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3"><Search className="h-4 w-4 shrink-0 text-slate-400" /><input ref={buscadorRef} aria-label="Buscar comandos" value={consulta} onChange={(event) => setConsulta(event.target.value)} placeholder="Buscar acción, módulo o código…" className="h-10 w-full bg-transparent text-sm outline-none" /></label>
              {!elecciones && <select aria-label="Filtrar comandos" value={categoria} onChange={(event) => setCategoria(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm"><option value="disponibles">En esta pantalla</option><option value="todas">Todos mis comandos</option>{modulos.filter(([id]) => accionesPermitidas.some((a) => a.modulo === id)).map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}</select>}
            </div>
          </div>
          <div className="min-h-0 overflow-y-auto px-5 py-4">
            {elecciones ? <div className="space-y-2">{elecciones.filter((item) => coincide(`${item.titulo} ${item.contexto}`)).map((item, index) => <button key={index} type="button" onClick={() => { cerrarManual(); if (!activarDestino(item)) setAviso("Este registro ya no está disponible."); }} className="block w-full rounded-xl border border-slate-200 p-3 text-left hover:border-emerald-400 hover:bg-emerald-50"><span className="text-sm font-semibold">{index + 1}. {item.titulo}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{item.contexto}</span></button>)}</div> : <>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-700">Atajos frecuentes y navegación</h3>
              <div className="mb-6 grid gap-2 sm:grid-cols-2">
                {[...navegacion.map((item) => ({ titulo: item.titulo, teclas: ATAJOS_NAVEGACION[item.id.replace("navegacion:", "")] })), ...ATAJOS_LOCALES].filter((item) => coincide(`${item.titulo} ${formatoAtajo(item.teclas)}`)).map((item) => <button key={item.teclas} type="button" onClick={() => ejecutarComando(item.teclas)} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2.5 text-left text-xs hover:border-emerald-300 hover:bg-emerald-50"><span>{item.titulo}</span><kbd className="shrink-0 rounded border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-[11px]">{formatoAtajo(item.teclas)}</kbd></button>)}
              </div>
              <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-bold uppercase tracking-wider text-emerald-700">Acciones por módulo</h3><span className="text-xs text-slate-500">{accionesFiltradas.length} acciones</span></div>
              <div className="space-y-2">{accionesFiltradas.map((item) => {
                const destinos = disponibles[item.codigo] ?? [];
                const puedeRevelar = revelables.includes(item.codigo);
                const habilitado = destinos.some((destino) => destino.habilitado) || puedeRevelar;
                return <button key={item.codigo} type="button" disabled={!habilitado} onClick={() => ejecutarComando(item.atajo)} className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left enabled:hover:border-emerald-300 enabled:hover:bg-emerald-50 disabled:bg-slate-50 disabled:text-slate-500">
                  <span className="min-w-0"><span className="block text-sm font-medium">{item.titulo}</span><span className="mt-1 block text-xs text-slate-500">{NOMBRES_MODULOS[item.modulo]} · {destinos.length ? habilitado ? `${destinos.length > 1 ? `${destinos.length} registros · ` : ""}Disponible` : "Deshabilitada" : puedeRevelar ? "Abre su panel automáticamente" : `Abre su formulario o detalle${item.grupo ? ` · panel ${item.grupo}` : ""}`}</span></span>
                  <kbd className="shrink-0 rounded border border-slate-200 bg-white px-2 py-1 text-[11px]">{formatoAtajo(item.atajo)}</kbd>
                </button>;
              })}</div>
              {!accionesFiltradas.length && <p className="py-8 text-center text-sm text-slate-500">No hay acciones para este filtro. Prueba “Todos mis comandos” o abre un formulario.</p>}
              <p className="mt-5 text-xs leading-5 text-slate-500">También puedes usar Ctrl + K (⌘ + K en Mac) para la búsqueda universal. Para completar campos usa Tab, Shift + Tab, flechas y Enter. Los comandos de guardar requieren completar los datos obligatorios.</p>
            </>}
          </div>
        </div>
      </dialog>
    </>
  );
}
