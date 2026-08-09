"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText } from "lucide-react";
import {
  MovimientoBancoCxp,
  ResultadoProcesarCuentaPorPagar,
  TipoCxpCorrelativo,
  listarTiposCxpCorrelativos,
  procesarCuentaPorPagar,
} from "@/services/cuentasPorPagar.service";
import SelectorBeneficiario from "@/components/SelectorBeneficiario";
import GestorContextosDocumentalesCxp from "@/components/GestorContextosDocumentalesCxp";
import {
  analizarRequisitosDocumentalesCxp,
  guardarContextoDocumentalCxp,
  obtenerAnalisisGeneralInicial,
  type ResultadoAnalisisDocumentalCxp,
} from "@/services/contextosDocumentalesCxp.service";
import { esDescripcionCuentaPorPagarNula } from "@/lib/requisitos-documentales-cxp";

type Props = {
  onSuccess?: (resultado: ResultadoProcesarCuentaPorPagar) => void;
  onClose?: () => void;
};

function obtenerFechaLocal() {
  const fecha = new Date();
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatMoney(value: number) {
  return Number(value ?? 0).toLocaleString("es-HN", {
    style: "currency",
    currency: "HNL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function documentOptionClass(checked: boolean) {
  return [
    "group flex min-h-[84px] cursor-pointer items-start gap-3 border px-3 py-3 transition",
    checked
      ? "border-emerald-500 bg-emerald-50 text-emerald-950 shadow-sm"
      : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/40",
  ].join(" ");
}

export default function FormCrearCuentaPorPagar({ onSuccess, onClose }: Props) {
  const router = useRouter();
  const panelDocumentalRef = useRef<HTMLDivElement>(null);

  const [fecha, setFecha] = useState(obtenerFechaLocal());
  const [descripcion, setDescripcion] = useState("");

  const [tiposCxp, setTiposCxp] = useState<TipoCxpCorrelativo[]>([]);
  const [tipoCxp, setTipoCxp] = useState("");

  const [noCxpEstimado, setNoCxpEstimado] = useState<number | null>(null);
  const [noCxpDefinitivo, setNoCxpDefinitivo] = useState<number | null>(null);

  const [montoBanco, setMontoBanco] = useState("");
  const [beneficiarioId, setBeneficiarioId] = useState("");
  const [bancos, setBancos] = useState<MovimientoBancoCxp[]>([]);
  const [analisisDocumental, setAnalisisDocumental] =
    useState<ResultadoAnalisisDocumentalCxp>(obtenerAnalisisGeneralInicial);
  const [documentosCumplidos, setDocumentosCumplidos] = useState<
    Record<string, boolean>
  >({});
  const [descripcionAnalizada, setDescripcionAnalizada] = useState("");
  const [mostrarConfirmacionDocumental, setMostrarConfirmacionDocumental] =
    useState(false);

  const [cargandoTiposCxp, setCargandoTiposCxp] = useState(false);
  const [analizandoDocumentos, setAnalizandoDocumentos] = useState(false);
  const [guardandoAprendizaje, setGuardandoAprendizaje] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const totalBancos = useMemo(() => {
    return bancos.reduce((total, item) => total + Number(item.monto || 0), 0);
  }, [bancos]);

  const tipoSeleccionado = useMemo(() => {
    return tiposCxp.find((item) => item.tipo_cxp === tipoCxp) ?? null;
  }, [tiposCxp, tipoCxp]);

  const totalDocumentosCumplidos = useMemo(() => {
    return analisisDocumental.requisitos.filter(
      (requisito) => documentosCumplidos[requisito.codigo]
    ).length;
  }, [analisisDocumental.requisitos, documentosCumplidos]);

  useEffect(() => {
    async function cargarTiposCxp() {
      try {
        setCargandoTiposCxp(true);
        setError("");

        const tipos = await listarTiposCxpCorrelativos();

        setTiposCxp(tipos);

        if (tipos.length > 0) {
          setTipoCxp(tipos[0].tipo_cxp);
          setNoCxpEstimado(tipos[0].siguiente_numero);
        } else {
          setTipoCxp("");
          setNoCxpEstimado(null);
        }
      } catch (err) {
        setTiposCxp([]);
        setTipoCxp("");
        setNoCxpEstimado(null);

        setError(
          err instanceof Error
            ? err.message
            : "No se pudieron cargar los tipos de CxP."
        );
      } finally {
        setCargandoTiposCxp(false);
      }
    }

    cargarTiposCxp();
  }, []);

  useEffect(() => {
    if (!tipoCxp) {
      setNoCxpEstimado(null);
      return;
    }

    const correlativo = tiposCxp.find((item) => item.tipo_cxp === tipoCxp);

    if (!correlativo) {
      setNoCxpEstimado(null);
      return;
    }

    setNoCxpEstimado(correlativo.siguiente_numero);
    setNoCxpDefinitivo(null);
  }, [tipoCxp, tiposCxp]);

  function agregarMovimientoBanco() {
    setError("");
    setMensaje("");
    setNoCxpDefinitivo(null);

    const monto = Number(montoBanco);

    if (!beneficiarioId.trim()) {
      setError("Debe ingresar el ID del beneficiario.");
      return;
    }

    if (!monto || monto <= 0) {
      setError("Debe ingresar un monto válido.");
      return;
    }

    setBancos((prev) => [
      ...prev,
      {
        monto,
        id_beneficiario: beneficiarioId.trim(),
      },
    ]);

    setMontoBanco("");
    setBeneficiarioId("");
  }

  function eliminarMovimientoBanco(index: number) {
    setBancos((prev) => prev.filter((_, i) => i !== index));
  }

  async function refrescarCorrelativos(tipoActual: string) {
    const tiposActualizados = await listarTiposCxpCorrelativos();

    setTiposCxp(tiposActualizados);

    const tipoActualizado = tiposActualizados.find(
      (item) => item.tipo_cxp === tipoActual
    );

    if (tipoActualizado) {
      setTipoCxp(tipoActualizado.tipo_cxp);
      setNoCxpEstimado(tipoActualizado.siguiente_numero);
      return;
    }

    if (tiposActualizados.length > 0) {
      setTipoCxp(tiposActualizados[0].tipo_cxp);
      setNoCxpEstimado(tiposActualizados[0].siguiente_numero);
      return;
    }

    setTipoCxp("");
    setNoCxpEstimado(null);
  }

  async function identificarRequisitosDocumentales() {
    const descripcionActual = descripcion.trim();

    if (descripcionActual.length < 5) {
      setError(
        "Escriba una descripción más específica antes de identificar los requisitos."
      );
      return null;
    }

    try {
      setAnalizandoDocumentos(true);
      setError("");
      setMensaje("");

      const resultado = await analizarRequisitosDocumentalesCxp({
        descripcion: descripcionActual,
        tipoCxp,
      });

      setAnalisisDocumental(resultado);
      setDescripcionAnalizada(descripcionActual);
      setMostrarConfirmacionDocumental(true);
      setDocumentosCumplidos((actuales) => {
        return Object.fromEntries(
          resultado.requisitos.map((requisito) => [
            requisito.codigo,
            actuales[requisito.codigo] ?? false,
          ])
        );
      });
      setMensaje(
        "Requisitos identificados. Marque los documentos que ya contiene el expediente y termine el registro."
      );
      window.setTimeout(() => {
        panelDocumentalRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 0);

      return resultado;
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron identificar los requisitos documentales."
      );
      return null;
    } finally {
      setAnalizandoDocumentos(false);
    }
  }

  function alternarDocumento(tipoDocumento: string) {
    setDocumentosCumplidos((actuales) => ({
      ...actuales,
      [tipoDocumento]: !actuales[tipoDocumento],
    }));
  }

  async function guardarAprendizajeSugerido() {
    const sugerido = analisisDocumental.contextoSugerido;

    if (!sugerido) return;

    try {
      setGuardandoAprendizaje(true);
      setError("");
      const contexto = await guardarContextoDocumentalCxp({
        nombre: sugerido.nombre,
        descripcion: sugerido.descripcion,
        palabrasClave: sugerido.palabrasClave,
        ejemplos: [descripcion.trim()].filter(Boolean),
        requisitos: sugerido.requisitos,
        origen: "IA_REVISADA",
      });

      setAnalisisDocumental((actual) => ({
        ...actual,
        contextoSugerido: contexto,
        esSugerenciaNueva: false,
        aviso: null,
      }));
      setMensaje(
        "Contexto revisado y guardado. Estará disponible para futuras cuentas por pagar."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo guardar el aprendizaje documental."
      );
    } finally {
      setGuardandoAprendizaje(false);
    }
  }

  async function registrarCuentaPorPagar() {
    try {
      setProcesando(true);
      setError("");
      setMensaje("");
      setNoCxpDefinitivo(null);

      const descripcionNormalizada = descripcion.trim().toUpperCase();
      const esCuentaPorPagarNula = esDescripcionCuentaPorPagarNula(descripcion);

      if (!fecha) {
        setError("La fecha es obligatoria.");
        return;
      }

      if (!tipoCxp.trim()) {
        setError("Debe seleccionar un tipo de CxP.");
        return;
      }

      if (!descripcion.trim()) {
        setError("La descripción es obligatoria.");
        return;
      }

      if (!esCuentaPorPagarNula && bancos.length === 0) {
        setError("No existen movimientos bancarios para procesar.");
        return;
      }

      if (
        !esCuentaPorPagarNula &&
        (!mostrarConfirmacionDocumental ||
          descripcionAnalizada !== descripcion.trim())
      ) {
        await identificarRequisitosDocumentales();
        return;
      }

      if (esCuentaPorPagarNula) {
        const confirmado = window.confirm(
          "La descripción indica una CUENTA POR PAGAR NULA. ¿Desea registrarla sin efecto contable?"
        );

        if (!confirmado) return;
      }

      if (
        descripcionNormalizada.includes("NUL") &&
        descripcionNormalizada !== "NULA"
      ) {
        const confirmado = window.confirm(
          "La descripción contiene un texto similar a 'NULA'. ¿Desea continuar como una CxP normal?"
        );

        if (!confirmado) return;
      }

      const resultado = await procesarCuentaPorPagar({
        fecha,
        descripcion,
        tipoCxp,
        bancos,
        ...(esCuentaPorPagarNula
          ? {}
          : {
              documentosIniciales: analisisDocumental.requisitos.map(
                (requisito) => ({
                  tipoDocumento: requisito.codigo,
                  nombreDocumento: requisito.nombre,
                  cumplido:
                    documentosCumplidos[requisito.codigo] === true,
                })
              ),
              clasificacionDocumental: {
                contextoDocumental: analisisDocumental.contextos
                  .map((contexto) => contexto.codigo)
                  .join(","),
                origenRequisito:
                  analisisDocumental.metodo === "IA"
                    ? ("IA" as const)
                    : analisisDocumental.contextos.some(
                          (contexto) => contexto.codigo === "GENERAL"
                        )
                      ? ("GENERAL" as const)
                      : ("REGLA" as const),
                confianzaIa:
                  analisisDocumental.metodo === "IA"
                    ? analisisDocumental.confianza
                    : null,
                justificacionContexto: analisisDocumental.justificacion,
              },
            }),
      });

      setNoCxpDefinitivo(resultado.no_cxp_generado);

      setMensaje(
        `${resultado.mensaje} No. definitivo: ${resultado.no_cxp_generado}. Registros insertados: ${resultado.registros_insertados}.`
      );

      setDescripcion("");
      setBancos([]);
      setMontoBanco("");
      setBeneficiarioId("");
      setAnalisisDocumental(obtenerAnalisisGeneralInicial());
      setDocumentosCumplidos({});
      setDescripcionAnalizada("");
      setMostrarConfirmacionDocumental(false);

      await refrescarCorrelativos(tipoCxp);

      onSuccess?.(resultado);

      if (!onSuccess) {
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo registrar la cuenta por pagar."
      );
    } finally {
      setProcesando(false);
    }
  }

  return (
    <section className="border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-slate-400">
              Registro operativo
            </div>

            <h2 className="mt-1 text-[18px] font-semibold tracking-tight text-slate-950">
              Nueva cuenta por pagar
            </h2>

            <p className="mt-1 text-[12px] text-slate-500">
              Registra CxP normales o nulas usando los correlativos configurados
              en Supabase.
            </p>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="h-8 border border-slate-200 bg-white px-3 text-[12px] font-medium text-slate-600 transition hover:border-slate-400 hover:bg-slate-50"
            >
              Cerrar
            </button>
          )}
        </div>
      </div>

      <div className="p-5">
        <div className="grid gap-4 lg:grid-cols-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Fecha
            </label>

            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="h-10 w-full border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Tipo CxP
            </label>

            <select
              value={tipoCxp}
              onChange={(e) => {
                setTipoCxp(e.target.value);
                setDescripcionAnalizada("");
                setMostrarConfirmacionDocumental(false);
              }}
              disabled={cargandoTiposCxp || tiposCxp.length === 0}
              className="h-10 w-full border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-400"
            >
              {cargandoTiposCxp && <option value="">Cargando tipos...</option>}

              {!cargandoTiposCxp && tiposCxp.length === 0 && (
                <option value="">Sin tipos configurados</option>
              )}

              {tiposCxp.map((item) => (
                <option key={item.tipo_cxp} value={item.tipo_cxp}>
                  {item.tipo_cxp}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              No. CxP estimado
            </label>

            <div className="flex h-10 items-center border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900">
              {cargandoTiposCxp
                ? "Cargando..."
                : noCxpEstimado ?? "Sin correlativo"}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Total movimientos
            </label>

            <div className="flex h-10 items-center border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-900">
              {formatMoney(totalBancos)}
            </div>
          </div>
        </div>

        {tipoSeleccionado && (
          <div className="mt-3 grid gap-2 border border-slate-200 bg-slate-50 px-3 py-3 text-[12px] md:grid-cols-3">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                Tipo seleccionado
              </div>

              <div className="mt-1 font-semibold text-slate-900">
                {tipoSeleccionado.tipo_cxp}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                Último registrado
              </div>

              <div className="mt-1 font-semibold tabular-nums text-slate-900">
                {tipoSeleccionado.ultimo_numero}
              </div>
            </div>

            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                Siguiente estimado
              </div>

              <div className="mt-1 font-semibold tabular-nums text-emerald-700">
                {tipoSeleccionado.siguiente_numero}
              </div>
            </div>
          </div>
        )}

        {noCxpDefinitivo !== null && (
          <div className="mt-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            No. CxP definitivo generado: {noCxpDefinitivo}
          </div>
        )}

        <div className="mt-4">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Descripción
          </label>

          <textarea
            value={descripcion}
            onChange={(e) => {
              setDescripcion(e.target.value);
              setDescripcionAnalizada("");
              setMostrarConfirmacionDocumental(false);
            }}
            rows={3}
            placeholder="Ejemplo: Compra de medicamentos para la clínica municipal"
            className="w-full resize-none border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
        </div>

        {mostrarConfirmacionDocumental && (
          <div
            ref={panelDocumentalRef}
            className="mt-4 scroll-mt-4 border border-emerald-200 bg-emerald-50/60 px-4 py-4"
          >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
                Paso 2 de 2 · Control documental contextual
              </div>

              <div className="mt-1 text-sm font-semibold text-slate-950">
                Documentos requeridos para esta CxP
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {analisisDocumental.contextos.map((contexto) => (
                  <span
                    key={contexto.codigo}
                    className="border border-emerald-200 bg-white px-2 py-1 text-[10px] font-semibold text-emerald-800"
                  >
                    {contexto.nombre}
                  </span>
                ))}
                <span className="border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-500">
                  {analisisDocumental.metodo === "IA"
                    ? `IA · ${Math.round(analisisDocumental.confianza * 100)}%`
                    : "Regla del catálogo"}
                </span>
              </div>
            </div>

            <div className="border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-700">
              {totalDocumentosCumplidos}/{analisisDocumental.requisitos.length}{" "}
              recibidos
            </div>
          </div>

          <p className="mt-3 border-l-2 border-emerald-400 pl-3 text-[11px] leading-4 text-slate-600">
            {analisisDocumental.justificacion}
          </p>

          {analisisDocumental.aviso && (
            <div className="mt-3 border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800">
              {analisisDocumental.aviso}
            </div>
          )}

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {analisisDocumental.requisitos.map((requisito) => {
              const cumplido = documentosCumplidos[requisito.codigo] === true;

              return (
                <label
                  key={requisito.codigo}
                  className={documentOptionClass(cumplido)}
                >
                  <input
                    type="checkbox"
                    checked={cumplido}
                    onChange={() => alternarDocumento(requisito.codigo)}
                    className="sr-only"
                  />

                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center border border-emerald-200 bg-white text-emerald-700">
                    <FileText className="h-4 w-4" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[13px] font-semibold">
                      {requisito.nombre}
                      {cumplido && <CheckCircle2 className="h-4 w-4" />}
                    </span>

                    <span className="mt-1 block text-[11px] leading-4 text-slate-500">
                      {requisito.descripcion ||
                        "Marque esta opción si el documento ya está en el expediente."}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          {analisisDocumental.esSugerenciaNueva &&
            analisisDocumental.contextoSugerido && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border border-amber-200 bg-white px-3 py-2">
                <div className="text-[11px] text-slate-600">
                  Confirme los requisitos y guarde este contexto para que la IA lo
                  reconozca en futuras CxP.
                </div>
                <button
                  type="button"
                  onClick={guardarAprendizajeSugerido}
                  disabled={guardandoAprendizaje}
                  className="border border-amber-600 bg-amber-600 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-amber-700 disabled:bg-slate-300"
                >
                  {guardandoAprendizaje
                    ? "Guardando..."
                    : "Guardar aprendizaje revisado"}
                </button>
              </div>
            )}

            <GestorContextosDocumentalesCxp descripcionActual={descripcion} />
          </div>
        )}

        <div className="mt-5 border border-slate-200 bg-slate-50 p-4">
          <div className="mb-3 flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-slate-900">
              Movimientos bancarios
            </h3>

            <p className="text-xs text-slate-500">
              Cada movimiento será registrado con el No. CxP definitivo generado
              por la RPC.
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
            <SelectorBeneficiario
              value={beneficiarioId}
              label="Beneficiario"
              placeholder="Buscar por nombre o identidad"
              allowCreate
              onSelect={(beneficiario) => {
                setBeneficiarioId(beneficiario.id);
              }}
              onClear={() => {
                setBeneficiarioId("");
              }}
            />

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Monto
              </label>

              <input
                type="number"
                value={montoBanco}
                onChange={(e) => setMontoBanco(e.target.value)}
                placeholder="0.00"
                className="h-10 w-full border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={agregarMovimientoBanco}
                className="h-10 border border-slate-900 bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700"
              >
                Agregar
              </button>
            </div>
          </div>

          <div className="mt-4 overflow-hidden border border-slate-200 bg-white">
            {bancos.length === 0 ? (
              <div className="p-4 text-sm text-slate-500">
                No hay movimientos agregados.
              </div>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Beneficiario</th>
                    <th className="px-3 py-2 text-right">Monto</th>
                    <th className="px-3 py-2 text-right">Acción</th>
                  </tr>
                </thead>

                <tbody>
                  {bancos.map((item, index) => (
                    <tr
                      key={`${item.id_beneficiario}-${index}`}
                      className="border-t"
                    >
                      <td className="px-3 py-2 text-slate-700">
                        {item.id_beneficiario}
                      </td>

                      <td className="px-3 py-2 text-right font-medium text-slate-900">
                        {formatMoney(item.monto)}
                      </td>

                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => eliminarMovimientoBanco(index)}
                          className="px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr className="border-t bg-slate-50">
                    <td className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wide text-slate-400">
                      Total
                    </td>

                    <td className="px-3 py-2 text-right text-sm font-semibold text-slate-950">
                      {formatMoney(totalBancos)}
                    </td>

                    <td />
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {mensaje && (
          <div className="mt-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {mensaje}
          </div>
        )}

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={registrarCuentaPorPagar}
            disabled={
              procesando ||
              analizandoDocumentos ||
              cargandoTiposCxp ||
              tiposCxp.length === 0 ||
              !tipoCxp
            }
            className="border border-emerald-600 bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
          >
            {analizandoDocumentos
              ? "Analizando requisitos..."
              : procesando
                ? "Registrando CxP..."
                : mostrarConfirmacionDocumental
                  ? "Terminar registro de CxP"
                  : esDescripcionCuentaPorPagarNula(descripcion)
                    ? "Registrar CxP nula"
                    : "Confirmar ingreso"}
          </button>
        </div>
      </div>
    </section>
  );
}
