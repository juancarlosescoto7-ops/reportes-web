"use client";

import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  BanknoteArrowDown,
  Bot,
  CircleDollarSign,
  ExternalLink,
  FileClock,
  FileText,
  Inbox,
  Landmark,
  LoaderCircle,
  RefreshCcw,
  Search,
  Send,
  Sparkles,
  UserRound,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import { usePermisosSistema } from "@/hooks/usePermisosSistema";
import {
  agruparResultadosBusqueda,
  buscarEnIndiceUniversal,
  construirIndiceBusquedaUniversal,
  extraerTemaConsulta,
  type CategoriaBusquedaUniversal,
  type FuentesBusquedaUniversal,
  type ResultadoBusquedaUniversal,
} from "@/lib/busqueda-universal";
import { obtenerCXP } from "@/services/cxp";
import { obtenerBandejaDocumentosFaltantesOrdenesPago } from "@/services/documentosFaltantesOrdenPago.service";
import { obtenerOrdenesPagoConEstadoDocumento } from "@/services/documentosOrdenPago.service";
import { obtenerReporteIngresosEstricto } from "@/services/ingresos.service";
import {
  obtenerOrdenesCompraPorOrdenPago,
  obtenerOrdenesEstructuradas,
} from "@/services/ordenes.service";
import { obtenerPresupuesto } from "@/services/presupuesto";
import {
  consultarAsistenteFinanciero,
  resumirResultadosAsistente,
  type RespuestaAsistenteFinanciero,
  type TurnoAsistenteFinanciero,
} from "@/services/asistenteFinanciero";

type EstadoCarga = "inicial" | "cargando" | "listo" | "error";
type ModoBuscador = "buscar" | "asistente";

type ConversacionAsistente = TurnoAsistenteFinanciero & {
  id: string;
  resultado: RespuestaAsistenteFinanciero;
  evidencias: ResultadoBusquedaUniversal[];
};

const ICONOS: Record<CategoriaBusquedaUniversal, LucideIcon> = {
  egreso: BanknoteArrowDown,
  "cuenta-por-pagar": WalletCards,
  "documento-pendiente": FileClock,
  "orden-de-pago": FileText,
  presupuesto: Landmark,
  ingreso: CircleDollarSign,
};

const ESTILOS_CATEGORIA: Record<CategoriaBusquedaUniversal, string> = {
  egreso: "bg-rose-50 text-rose-700 border-rose-200",
  "cuenta-por-pagar": "bg-amber-50 text-amber-700 border-amber-200",
  "documento-pendiente": "bg-orange-50 text-orange-700 border-orange-200",
  "orden-de-pago": "bg-sky-50 text-sky-700 border-sky-200",
  presupuesto: "bg-violet-50 text-violet-700 border-violet-200",
  ingreso: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function BuscadorUniversal() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const montado = useSyncExternalStore(
    suscribirMontaje,
    obtenerMontajeCliente,
    obtenerMontajeServidor
  );
  const [abierto, setAbierto] = useState(false);
  const [consulta, setConsulta] = useState("");
  const [indice, setIndice] = useState<ResultadoBusquedaUniversal[]>([]);
  const [estadoCarga, setEstadoCarga] = useState<EstadoCarga>("inicial");
  const [fuentesConError, setFuentesConError] = useState(0);
  const [seleccion, setSeleccion] = useState(0);
  const [modo, setModo] = useState<ModoBuscador>("buscar");
  const [conversaciones, setConversaciones] = useState<ConversacionAsistente[]>(
    []
  );
  const [preguntaEnCurso, setPreguntaEnCurso] = useState<string | null>(null);
  const [errorAsistente, setErrorAsistente] = useState("");
  const { permisos, cargandoPermisos } = usePermisosSistema();

  const resultados = useMemo(
    () => buscarEnIndiceUniversal(indice, consulta),
    [consulta, indice]
  );
  const grupos = useMemo(
    () => agruparResultadosBusqueda(resultados),
    [resultados]
  );
  const conteos = useMemo(() => {
    return indice.reduce<Partial<Record<CategoriaBusquedaUniversal, number>>>(
      (acc, item) => {
        acc[item.categoria] = (acc[item.categoria] ?? 0) + 1;
        return acc;
      },
      {}
    );
  }, [indice]);

  const cargarIndice = useCallback(async () => {
    if (cargandoPermisos) return;

    setEstadoCarga("cargando");
    setFuentesConError(0);

    const tiene = (permiso: string) => permisos.includes(permiso);
    const puedeVerEgresos = tiene("VER_EGRESOS");
    const puedeVerCxp = tiene("VER_COMPROMISOS");
    const puedeVerOrdenes = tiene("VER_ORDENES-PAGO");
    const puedeVerIngresos = tiene("VER_INGRESOS");
    const puedeVerPresupuesto = tiene("VER_PRESUPUESTO");
    const fuentes: FuentesBusquedaUniversal = {};
    const cargas: Array<Promise<void>> = [];

    if (puedeVerEgresos) {
      cargas.push(
        obtenerOrdenesEstructuradas().then((data) => {
          fuentes.ordenes = data;
        }),
        obtenerOrdenesCompraPorOrdenPago().then((data) => {
          fuentes.comprasPagadas = data;
        }),
        obtenerBandejaDocumentosFaltantesOrdenesPago().then((data) => {
          fuentes.documentosPendientes = data;
        })
      );
    }

    if (puedeVerCxp) {
      cargas.push(
        obtenerCXP().then((data) => {
          fuentes.cuentasPorPagar = data;
        })
      );
    }

    if (puedeVerOrdenes) {
      cargas.push(
        obtenerOrdenesPagoConEstadoDocumento().then((data) => {
          fuentes.ordenesDocumentales = data;
        })
      );
    }

    if (puedeVerIngresos) {
      cargas.push(
        obtenerReporteIngresosEstricto().then((data) => {
          fuentes.ingresos = data;
        })
      );
    }

    if (puedeVerPresupuesto) {
      cargas.push(
        obtenerPresupuesto().then((data) => {
          fuentes.presupuesto = data;
        })
      );
    }

    const estados = await Promise.allSettled(cargas);
    const errores = estados.filter((item) => item.status === "rejected").length;
    const nuevoIndice = construirIndiceBusquedaUniversal(fuentes);

    setIndice(nuevoIndice);
    setFuentesConError(errores);
    setEstadoCarga(errores > 0 && nuevoIndice.length === 0 ? "error" : "listo");
    return { indice: nuevoIndice, errores };
  }, [cargandoPermisos, permisos]);

  const abrir = useCallback(() => {
    setAbierto(true);
  }, []);

  const cerrar = useCallback(() => {
    setAbierto(false);
    setSeleccion(0);
  }, []);

  const navegar = useCallback(
    (resultado: ResultadoBusquedaUniversal) => {
      cerrar();
      router.push(resultado.href);
    },
    [cerrar, router]
  );

  async function preguntarAsistente() {
    const pregunta = consulta.trim();
    if (
      pregunta.length < 3 ||
      preguntaEnCurso ||
      cargandoPermisos ||
      estadoCarga === "cargando"
    ) {
      return;
    }

    setErrorAsistente("");
    setPreguntaEnCurso(pregunta);
    setConsulta("");

    try {
      const cargaManual =
        estadoCarga === "listo" ? null : await cargarIndice();

      if (
        cargaManual &&
        cargaManual.errores > 0 &&
        cargaManual.indice.length === 0
      ) {
        throw new Error(
          "No fue posible cargar los registros para consultar la IA."
        );
      }

      const indiceDisponible = cargaManual?.indice ?? indice;
      const preguntaAnterior = conversaciones.at(-1)?.pregunta ?? "";
      const tema = extraerTemaConsulta(`${preguntaAnterior} ${pregunta}`);
      const relacionados = tema
        ? buscarEnIndiceUniversal(indiceDisponible, tema, 500)
        : seleccionarContextoGeneral(indiceDisponible, pregunta);

      if (relacionados.length === 0) {
        const resultado: RespuestaAsistenteFinanciero = {
          respuesta: `No encontré registros relacionados con “${tema || pregunta}” dentro de la información a la que tiene acceso.`,
          puntos_clave: [],
          advertencias: [
            "Pruebe con el nombre exacto del programa, actividad, proveedor o número de documento.",
          ],
          fuentes: [],
          preguntas_sugeridas: [],
        };

        setConversaciones((actuales) => [
          ...actuales,
          {
            id: crearIdConversacion(),
            pregunta,
            respuesta: resultado.respuesta,
            resultado,
            evidencias: [],
          },
        ]);
        return;
      }

      const evidencias = seleccionarEvidenciasBalanceadas(relacionados, 80);
      const resultado = await consultarAsistenteFinanciero({
        pregunta,
        tema,
        totalRelacionados: relacionados.length,
        resultados: evidencias,
        resumenCategorias: resumirResultadosAsistente(relacionados),
        historial: conversaciones.map((item) => ({
          pregunta: item.pregunta,
          respuesta: item.respuesta,
        })),
      });
      const fuentes = new Set(resultado.fuentes);

      setConversaciones((actuales) => [
        ...actuales,
        {
          id: crearIdConversacion(),
          pregunta,
          respuesta: resultado.respuesta,
          resultado,
          evidencias: evidencias.filter((item) => fuentes.has(item.id)),
        },
      ]);
    } catch (error) {
      setErrorAsistente(
        error instanceof Error
          ? error.message
          : "No se pudo consultar el asistente financiero."
      );
      setConsulta(pregunta);
    } finally {
      setPreguntaEnCurso(null);
    }
  }

  useEffect(() => {
    function manejarAtajo(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setAbierto((actual) => !actual);
      }
    }

    window.addEventListener("keydown", manejarAtajo);
    return () => window.removeEventListener("keydown", manejarAtajo);
  }, []);

  useEffect(() => {
    if (!abierto) return;

    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return;

    function manejarTeclado(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        cerrar();
        return;
      }

      if (modo === "buscar" && event.key === "ArrowDown" && resultados.length > 0) {
        event.preventDefault();
        setSeleccion((actual) => (actual + 1) % resultados.length);
      }

      if (modo === "buscar" && event.key === "ArrowUp" && resultados.length > 0) {
        event.preventDefault();
        setSeleccion(
          (actual) => (actual - 1 + resultados.length) % resultados.length
        );
      }

      if (modo === "buscar" && event.key === "Enter" && resultados[seleccion]) {
        event.preventDefault();
        navegar(resultados[seleccion]);
      }
    }

    window.addEventListener("keydown", manejarTeclado);
    return () => window.removeEventListener("keydown", manejarTeclado);
  }, [abierto, cerrar, modo, navegar, resultados, seleccion]);

  useEffect(() => {
    if (modo !== "buscar") return;

    document
      .getElementById(`resultado-universal-${seleccion}`)
      ?.scrollIntoView({ block: "nearest" });
  }, [modo, seleccion]);

  const modal = abierto ? (
    <div
      className="fixed inset-0 z-[160] flex items-start justify-center bg-slate-950/55 px-3 pt-[7vh] backdrop-blur-sm sm:px-5 sm:pt-[10vh]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) cerrar();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Búsqueda y asistente financiero"
        className="grid max-h-[82vh] w-full max-w-4xl grid-rows-[auto_auto_1fr_auto] overflow-hidden border border-white/70 bg-white shadow-2xl shadow-slate-950/25"
      >
        <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-3 py-3 sm:px-4">
          {modo === "buscar" ? (
            <Search
              className="h-5 w-5 shrink-0 text-[#005f48]"
              aria-hidden="true"
            />
          ) : (
            <Sparkles
              className="h-5 w-5 shrink-0 text-violet-600"
              aria-hidden="true"
            />
          )}
          <input
            ref={inputRef}
            value={consulta}
            onChange={(event) => {
              setConsulta(event.target.value);
              setSeleccion(0);
            }}
            onKeyDown={(event) => {
              if (
                modo === "asistente" &&
                event.key === "Enter" &&
                !event.shiftKey
              ) {
                event.preventDefault();
                void preguntarAsistente();
              }
            }}
            placeholder={
              modo === "buscar"
                ? "Proveedor, programa, actividad, fecha, monto, documento..."
                : "Pregunte: ¿Cuál es el presupuesto de Educación?"
            }
            aria-label={
              modo === "buscar"
                ? "Buscar en todo el sistema"
                : "Preguntar al asistente financiero"
            }
            aria-controls="resultados-busqueda-universal"
            aria-activedescendant={
              modo === "buscar" && resultados[seleccion]
                ? `resultado-universal-${seleccion}`
                : undefined
            }
            className="h-11 min-w-0 flex-1 border-0 !bg-transparent px-0 text-[15px] font-medium shadow-none outline-none placeholder:font-normal placeholder:text-slate-400 focus:ring-0"
          />
          {consulta && (
            <button
              type="button"
              onClick={() => {
                setConsulta("");
                setSeleccion(0);
              }}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {modo === "asistente" && (
            <button
              type="button"
              onClick={() => void preguntarAsistente()}
              disabled={
                consulta.trim().length < 3 ||
                Boolean(preguntaEnCurso) ||
                cargandoPermisos ||
                estadoCarga === "cargando"
              }
              className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-violet-600 text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Enviar pregunta"
            >
              {preguntaEnCurso ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          )}
          <button
            type="button"
            onClick={cerrar}
            className="hidden h-8 border border-slate-200 bg-slate-50 px-2.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 hover:border-slate-400 sm:block"
          >
            Esc
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/80 px-3 py-2 text-[11px] text-slate-500 sm:px-4">
          <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5">
            <button
              type="button"
              onClick={() => {
                setModo("buscar");
                window.setTimeout(() => inputRef.current?.focus(), 0);
              }}
              className={[
                "inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-[10px] font-semibold",
                modo === "buscar"
                  ? "bg-[#003331] text-white"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
              ].join(" ")}
            >
              <Search className="h-3.5 w-3.5" />
              Buscar
            </button>
            <button
              type="button"
              onClick={() => {
                setModo("asistente");
                window.setTimeout(() => inputRef.current?.focus(), 0);
              }}
              className={[
                "inline-flex h-7 items-center gap-1.5 rounded px-2.5 text-[10px] font-semibold",
                modo === "asistente"
                  ? "bg-violet-600 text-white"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
              ].join(" ")}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Preguntar
            </button>
          </div>
          <span className="hidden sm:inline">
            {estadoCarga === "cargando"
              ? "Actualizando el índice de búsqueda..."
              : estadoCarga === "inicial"
                ? "Datos bajo demanda · índice sin cargar"
                : `${indice.length.toLocaleString("es-HN")} registros disponibles`}
          </span>
          <div className="flex items-center gap-3">
            {fuentesConError > 0 && (
              <span className="font-medium text-amber-700">
                {fuentesConError} fuente(s) no respondieron
              </span>
            )}
            <button
              type="button"
              onClick={() => void cargarIndice()}
              disabled={estadoCarga === "cargando" || cargandoPermisos}
              className="inline-flex items-center gap-1.5 font-semibold text-[#005f48] hover:text-[#003331] disabled:opacity-50"
            >
              <RefreshCcw
                className={`h-3.5 w-3.5 ${
                  estadoCarga === "cargando" ? "animate-spin" : ""
                }`}
              />
              {estadoCarga === "inicial" ? "Cargar datos" : "Actualizar"}
            </button>
          </div>
        </div>

        <div
          id="resultados-busqueda-universal"
          className="min-h-[280px] overflow-y-auto bg-slate-50/40 p-2 sm:p-3"
          role={modo === "buscar" ? "listbox" : undefined}
        >
          {modo === "asistente" ? (
            cargandoPermisos || estadoCarga === "cargando" ? (
              <EstadoBuscador
                icon={LoaderCircle}
                iconClassName="animate-spin"
                titulo="Preparando el asistente financiero"
                texto="Estamos reuniendo los registros a los que tiene acceso."
              />
            ) : estadoCarga === "error" ? (
              <EstadoBuscador
                icon={Inbox}
                titulo="No fue posible cargar los registros"
                texto="Vuelva a enviar la pregunta o cargue los datos manualmente."
              />
            ) : (
              <PanelAsistente
                conversaciones={conversaciones}
                preguntaEnCurso={preguntaEnCurso}
                error={errorAsistente}
                onNavigate={navegar}
                onSuggestion={(pregunta) => {
                  setConsulta(pregunta);
                  window.setTimeout(() => inputRef.current?.focus(), 0);
                }}
              />
            )
          ) : cargandoPermisos || estadoCarga === "cargando" ? (
            <EstadoBuscador
              icon={LoaderCircle}
              iconClassName="animate-spin"
              titulo="Preparando la búsqueda universal"
              texto="Estamos reuniendo los registros a los que tiene acceso."
            />
          ) : estadoCarga === "inicial" ? (
            <EstadoBuscador
              icon={Search}
              titulo="Búsqueda en modo manual"
              texto='Los registros no se leen al abrir. Presione "Cargar datos" cuando necesite buscar.'
            />
          ) : estadoCarga === "error" ? (
            <EstadoBuscador
              icon={Inbox}
              titulo="No fue posible cargar los registros"
              texto="Intente actualizar el índice dentro de unos segundos."
            />
          ) : !consulta.trim() ? (
            <div className="flex min-h-[280px] flex-col items-center justify-center px-5 py-8 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-[#005f48]">
                <Search className="h-5 w-5" />
              </div>
              <h2 className="mt-4 text-[15px] font-semibold text-slate-950">
                Un dato abre todas sus relaciones
              </h2>
              <p className="mt-1 max-w-lg text-[12px] leading-5 text-slate-500">
                Pruebe con “Deportes”, el nombre de un proveedor, 14/08/2026,
                L 25,000.00, un número de orden, cheque o documento.
              </p>
              <div className="mt-5 flex max-w-2xl flex-wrap justify-center gap-2">
                {Object.entries(conteos).map(([categoria, total]) => {
                  const categoriaKey = categoria as CategoriaBusquedaUniversal;
                  const Icon = ICONOS[categoriaKey];

                  return (
                    <span
                      key={categoria}
                      className={`inline-flex items-center gap-1.5 border px-2.5 py-1.5 text-[11px] font-medium ${ESTILOS_CATEGORIA[categoriaKey]}`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {total} {etiquetaCorta(categoriaKey)}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : resultados.length === 0 ? (
            <EstadoBuscador
              icon={Search}
              titulo={`Sin resultados para “${consulta.trim()}”`}
              texto="Revise el dato o pruebe con una parte del nombre, fecha o monto."
            />
          ) : (
            <div className="space-y-3">
              {grupos.map((grupo) => {
                const Icon = ICONOS[grupo.categoria];

                return (
                  <section
                    key={grupo.categoria}
                    className="overflow-hidden border border-slate-200 bg-white"
                  >
                    <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-3 py-2">
                      <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.11em] text-slate-600">
                        <Icon className="h-3.5 w-3.5" />
                        {grupo.label}
                      </div>
                      <span className="tabular-nums text-[11px] text-slate-400">
                        {grupo.items.length}
                      </span>
                    </div>

                    <div>
                      {grupo.items.map((resultado) => {
                        const indiceResultado = resultados.indexOf(resultado);
                        const activo = indiceResultado === seleccion;

                        return (
                          <button
                            id={`resultado-universal-${indiceResultado}`}
                            key={resultado.id}
                            type="button"
                            role="option"
                            aria-selected={activo}
                            onMouseEnter={() => setSeleccion(indiceResultado)}
                            onClick={() => navegar(resultado)}
                            className={[
                              "group grid w-full grid-cols-[1fr_auto] gap-3 border-b border-slate-100 px-3 py-3 text-left last:border-b-0",
                              activo
                                ? "bg-emerald-50/80"
                                : "bg-white hover:bg-slate-50",
                            ].join(" ")}
                          >
                            <span className="min-w-0">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="truncate text-[13px] font-semibold text-slate-950">
                                  {resultado.titulo}
                                </span>
                                {resultado.estado && (
                                  <span
                                    className={`border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] ${ESTILOS_CATEGORIA[resultado.categoria]}`}
                                  >
                                    {resultado.estado}
                                  </span>
                                )}
                              </span>
                              <span className="mt-0.5 block truncate text-[12px] font-medium text-slate-600">
                                {resultado.subtitulo}
                              </span>
                              <span className="mt-0.5 block truncate text-[11px] text-slate-400">
                                {resultado.descripcion}
                              </span>
                              {resultado.metadatos.length > 0 && (
                                <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-medium text-slate-500">
                                  {resultado.metadatos.map((dato) => (
                                    <span key={dato}>{dato}</span>
                                  ))}
                                </span>
                              )}
                            </span>

                            <span
                              className={[
                                "mt-1 grid h-8 w-8 place-items-center rounded-md border",
                                activo
                                  ? "border-emerald-300 bg-white text-[#005f48]"
                                  : "border-transparent text-slate-300 group-hover:border-slate-200 group-hover:bg-white group-hover:text-slate-600",
                              ].join(" ")}
                            >
                              <ArrowRight className="h-4 w-4" />
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <div className="hidden items-center justify-between border-t border-slate-200 bg-white px-4 py-2 text-[10px] text-slate-400 sm:flex">
          <span>
            {modo === "buscar"
              ? "↑ ↓ para recorrer · Enter para abrir · Esc para cerrar"
              : "Las respuestas se construyen únicamente con datos del sistema"}
          </span>
          <span>Los resultados respetan sus permisos</span>
        </div>
      </section>
    </div>
  ) : null;

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="group flex h-9 w-10 items-center justify-center gap-2 border border-white/80 bg-white/92 px-2.5 text-left text-slate-600 shadow-md shadow-slate-950/10 backdrop-blur-md hover:border-emerald-300 hover:bg-white sm:w-[260px] sm:justify-start sm:px-3 lg:w-[340px]"
        aria-label="Abrir buscador universal"
        title="Buscar o preguntar (Ctrl + K)"
      >
        <Search className="h-4 w-4 shrink-0 text-[#005f48]" />
        <span className="hidden min-w-0 flex-1 truncate text-[12px] font-medium sm:block">
          Buscar o preguntar
        </span>
        <kbd className="hidden border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-sans text-[9px] font-semibold text-slate-400 sm:block">
          Ctrl K
        </kbd>
      </button>

      {montado && modal ? createPortal(modal, document.body) : null}
    </>
  );
}

function PanelAsistente({
  conversaciones,
  preguntaEnCurso,
  error,
  onNavigate,
  onSuggestion,
}: {
  conversaciones: ConversacionAsistente[];
  preguntaEnCurso: string | null;
  error: string;
  onNavigate: (resultado: ResultadoBusquedaUniversal) => void;
  onSuggestion: (pregunta: string) => void;
}) {
  const sinConversacion = conversaciones.length === 0 && !preguntaEnCurso;

  if (sinConversacion && !error) {
    return (
      <div className="flex min-h-[340px] flex-col items-center justify-center px-4 py-8 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-violet-100 text-violet-700">
          <Bot className="h-7 w-7" />
        </div>
        <h2 className="mt-4 text-[16px] font-semibold text-slate-950">
          Asistente financiero interno
        </h2>
        <p className="mt-1 max-w-xl text-[12px] leading-5 text-slate-500">
          Pregunte en lenguaje natural. Los datos y el contexto solo se cargan
          al enviar la pregunta; la respuesta incluirá enlaces a la evidencia.
        </p>
        <div className="mt-5 grid w-full max-w-2xl gap-2 sm:grid-cols-3">
          {[
            "¿Cuál es el presupuesto de Educación?",
            "¿Qué egresos están relacionados con Deportes?",
            "¿Qué CxP tienen documentos pendientes?",
          ].map((pregunta) => (
            <button
              key={pregunta}
              type="button"
              onClick={() => onSuggestion(pregunta)}
              className="border border-violet-200 bg-white px-3 py-3 text-left text-[11px] font-medium leading-5 text-slate-700 hover:bg-violet-50"
            >
              {pregunta}
            </button>
          ))}
        </div>
        <p className="mt-5 max-w-xl text-[10px] leading-4 text-slate-400">
          El asistente informa y resume; las decisiones financieras y legales
          continúan sujetas a revisión humana.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 py-2">
      {conversaciones.map((turno, index) => (
        <div key={turno.id} className="space-y-3">
          <div className="flex justify-end gap-2">
            <div className="max-w-[88%] rounded-xl rounded-br-sm bg-[#003331] px-3.5 py-2.5 text-[12px] leading-5 text-white">
              {turno.pregunta}
            </div>
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200 text-slate-600">
              <UserRound className="h-4 w-4" />
            </div>
          </div>

          <div className="flex items-start gap-2">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-violet-100 text-violet-700">
              <Bot className="h-4 w-4" />
            </div>
            <article className="min-w-0 flex-1 border border-slate-200 bg-white p-3.5">
              <p className="whitespace-pre-wrap text-[12px] leading-5 text-slate-700">
                {turno.resultado.respuesta}
              </p>

              {turno.resultado.puntos_clave.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Puntos clave
                  </div>
                  <ul className="mt-1.5 space-y-1.5 text-[11px] leading-5 text-slate-600">
                    {turno.resultado.puntos_clave.map((punto) => (
                      <li key={punto} className="flex gap-2">
                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-violet-500" />
                        <span>{punto}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {turno.resultado.advertencias.length > 0 && (
                <div className="mt-3 border border-amber-200 bg-amber-50 px-3 py-2">
                  {turno.resultado.advertencias.map((advertencia) => (
                    <div
                      key={advertencia}
                      className="flex gap-2 text-[10px] leading-4 text-amber-800"
                    >
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                      <span>{advertencia}</span>
                    </div>
                  ))}
                </div>
              )}

              {turno.evidencias.length > 0 && (
                <div className="mt-3 border-t border-slate-100 pt-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                      Evidencia consultada
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {turno.evidencias.length} enlace(s)
                    </span>
                  </div>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {turno.evidencias.map((evidencia) => (
                      <button
                        key={evidencia.id}
                        type="button"
                        onClick={() => onNavigate(evidencia)}
                        className="group flex min-w-0 items-center gap-2 border border-slate-200 bg-slate-50 px-2.5 py-2 text-left hover:border-violet-300 hover:bg-violet-50"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[10px] font-semibold text-slate-700">
                            {evidencia.titulo}
                          </span>
                          <span className="block truncate text-[9px] text-slate-400">
                            {evidencia.categoriaLabel}
                          </span>
                        </span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-slate-400 group-hover:text-violet-600" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {index === conversaciones.length - 1 &&
                turno.resultado.preguntas_sugeridas.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {turno.resultado.preguntas_sugeridas.map((pregunta) => (
                      <button
                        key={pregunta}
                        type="button"
                        onClick={() => onSuggestion(pregunta)}
                        className="rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[10px] font-medium text-violet-700 hover:bg-violet-100"
                      >
                        {pregunta}
                      </button>
                    ))}
                  </div>
                )}
            </article>
          </div>
        </div>
      ))}

      {preguntaEnCurso && (
        <div className="space-y-3">
          <div className="flex justify-end gap-2">
            <div className="max-w-[88%] rounded-xl rounded-br-sm bg-[#003331] px-3.5 py-2.5 text-[12px] leading-5 text-white">
              {preguntaEnCurso}
            </div>
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-200 text-slate-600">
              <UserRound className="h-4 w-4" />
            </div>
          </div>
          <div className="flex items-center gap-2 text-[11px] text-violet-700">
            <div className="grid h-8 w-8 place-items-center rounded-full bg-violet-100">
              <Bot className="h-4 w-4" />
            </div>
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Analizando los registros relacionados...
          </div>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] leading-5 text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}

function EstadoBuscador({
  icon: Icon,
  iconClassName = "",
  titulo,
  texto,
}: {
  icon: LucideIcon;
  iconClassName?: string;
  titulo: string;
  texto: string;
}) {
  return (
    <div className="flex min-h-[280px] flex-col items-center justify-center px-5 py-8 text-center">
      <Icon className={`h-6 w-6 text-slate-400 ${iconClassName}`} />
      <h2 className="mt-3 text-[14px] font-semibold text-slate-800">{titulo}</h2>
      <p className="mt-1 text-[12px] text-slate-500">{texto}</p>
    </div>
  );
}

function etiquetaCorta(categoria: CategoriaBusquedaUniversal) {
  return {
    egreso: "egresos",
    "cuenta-por-pagar": "CxP",
    "documento-pendiente": "pendientes",
    "orden-de-pago": "órdenes",
    presupuesto: "partidas",
    ingreso: "ingresos",
  }[categoria];
}

function seleccionarContextoGeneral(
  indice: ResultadoBusquedaUniversal[],
  pregunta: string
) {
  const texto = pregunta
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  const categorias = new Set<CategoriaBusquedaUniversal>();

  if (/presupuesto|partida|programa|actividad|proyecto/.test(texto)) {
    categorias.add("presupuesto");
  }
  if (/egreso|gasto|cheque|pago/.test(texto)) categorias.add("egreso");
  if (/cuenta por pagar|cxp|deuda/.test(texto)) {
    categorias.add("cuenta-por-pagar");
  }
  if (/documento|requisito|faltante/.test(texto)) {
    categorias.add("documento-pendiente");
    categorias.add("orden-de-pago");
  }
  if (/ingreso|deposito|recaudacion/.test(texto)) categorias.add("ingreso");

  if (categorias.size > 0) {
    return indice.filter((item) => categorias.has(item.categoria));
  }

  if (/resumen|general|situacion|estado financiero/.test(texto)) return indice;
  return [];
}

function seleccionarEvidenciasBalanceadas(
  resultados: ResultadoBusquedaUniversal[],
  limite: number
) {
  if (resultados.length <= limite) return resultados;

  const grupos = agruparResultadosBusqueda(resultados);
  const porGrupo = Math.max(1, Math.floor(limite / grupos.length));
  const seleccionados = grupos.flatMap((grupo) => grupo.items.slice(0, porGrupo));
  const ids = new Set(seleccionados.map((item) => item.id));

  for (const resultado of resultados) {
    if (seleccionados.length >= limite) break;
    if (ids.has(resultado.id)) continue;
    seleccionados.push(resultado);
    ids.add(resultado.id);
  }

  return seleccionados;
}

function crearIdConversacion() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `conversacion-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function suscribirMontaje() {
  return () => undefined;
}

function obtenerMontajeCliente() {
  return true;
}

function obtenerMontajeServidor() {
  return false;
}
