"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
} from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Database,
  Download,
  FileWarning,
  Landmark,
  MousePointer2,
  Search,
  X,
} from "lucide-react";
import {
  calcularResumenTotalConciliacion,
  conciliarDepositos,
  limitarResultadoConciliacionAlPeriodo,
  montoCoincideConBusqueda,
  normalizarFechaBancaria,
  parsearEstadoCuentaPegado,
  type DepositoSistemaConciliacion,
  type EstadoPartidaConciliacion,
  type MetricaConciliacion,
  type PartidaConciliacion,
  type ResumenConciliacion,
  type ResumenTotalConciliacion,
  type ResultadoConciliacion,
  type ResultadoParseoEstadoCuenta,
} from "@/lib/conciliacion-bancaria";
import {
  CUENTAS_INGRESOS,
  type IngresoReporte,
} from "@/services/ingresos.service";

type Props = {
  ingresos: IngresoReporte[];
  cuentaInicial?: string;
  fechaDesdeInicial?: string;
  fechaHastaInicial?: string;
  onClose: () => void;
};

type AnalisisConciliacion = {
  resultado: ResultadoConciliacion;
  parseo: ResultadoParseoEstadoCuenta;
  movimientosFueraPeriodo: number;
};

type FiltroEstado = "todos" | EstadoPartidaConciliacion;
type PantallaConciliacion = "carga" | "resumen" | "detalle" | "otros";

const ESTADOS: Record<
  EstadoPartidaConciliacion,
  {
    etiqueta: string;
    explicacion: string;
    badge: string;
    fila: string;
    resaltado: string;
    tarjetaActiva: string;
    Icon: ComponentType<{ className?: string }>;
  }
> = {
  perfecto: {
    etiqueta: "Match perfecto",
    explicacion: "Mismo monto y misma fecha",
    badge: "border-emerald-200 bg-emerald-50 text-emerald-800",
    fila: "border-l-emerald-400",
    resaltado: "bg-emerald-50/60",
    tarjetaActiva:
      "border-emerald-400 ring-2 ring-emerald-100 shadow-sm",
    Icon: CheckCircle2,
  },
  revisar: {
    etiqueta: "Requiere revisión",
    explicacion: "Mismo monto, fecha cercana",
    badge: "border-amber-200 bg-amber-50 text-amber-800",
    fila: "border-l-amber-400",
    resaltado: "bg-amber-50/60",
    tarjetaActiva: "border-amber-400 ring-2 ring-amber-100 shadow-sm",
    Icon: AlertTriangle,
  },
  nota_credito: {
    etiqueta: "Nota de crédito",
    explicacion: "Está en el banco, no en registros",
    badge: "border-sky-200 bg-sky-50 text-sky-800",
    fila: "border-l-sky-400",
    resaltado: "bg-sky-50/60",
    tarjetaActiva: "border-sky-400 ring-2 ring-sky-100 shadow-sm",
    Icon: Landmark,
  },
  nota_debito: {
    etiqueta: "Nota de débito",
    explicacion: "Está en registros, no en el banco",
    badge: "border-rose-200 bg-rose-50 text-rose-800",
    fila: "border-l-rose-400",
    resaltado: "bg-rose-50/60",
    tarjetaActiva: "border-rose-400 ring-2 ring-rose-100 shadow-sm",
    Icon: FileWarning,
  },
};

function formatMoneyCentavos(value: number) {
  return (value / 100).toLocaleString("es-HN", {
    style: "currency",
    currency: "HNL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatearFecha(value: string | null | undefined) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function fechaEnRango(fecha: string, desde: string, hasta: string) {
  return fecha >= desde && fecha <= hasta;
}

function textoPartida(partida: PartidaConciliacion) {
  return [
    partida.banco?.numero,
    partida.banco?.referencia,
    partida.banco?.descripcion,
    partida.banco?.agencia,
    partida.sistema?.bloque,
    partida.sistema?.tipoIngreso,
    partida.sistema?.descripcion,
    partida.sistema?.cuenta,
    partida.banco?.fecha,
    partida.sistema?.fecha,
  ]
    .join(" ")
    .toLocaleLowerCase("es-HN");
}

function escaparCsv(value: string | number | null | undefined) {
  let texto = String(value ?? "");

  if (typeof value === "string" && /^[\s]*[=+\-@]/.test(texto)) {
    texto = `'${texto}`;
  }

  return `"${texto.replaceAll('"', '""')}"`;
}

function nombreEstado(estado: EstadoPartidaConciliacion) {
  return ESTADOS[estado].etiqueta;
}

function descargarResumenCsv(
  resultado: ResultadoConciliacion,
  cuenta: string,
  fechaDesde: string,
  fechaHasta: string
) {
  const encabezados = [
    "Estado",
    "Fecha banco",
    "Fecha registro",
    "Diferencia días",
    "Monto",
    "No. banco",
    "Referencia",
    "Descripción banco",
    "Agencia",
    "Bloque",
    "Tipo ingreso",
    "Cuenta",
  ];
  const filas = resultado.partidas.map((partida) => [
    nombreEstado(partida.estado),
    partida.banco?.fecha ?? "",
    partida.sistema?.fecha ?? "",
    partida.diferenciaDiasFirmada ?? "",
    (partida.montoCentavos / 100).toFixed(2).replace(".", ","),
    partida.banco?.numero ?? "",
    partida.banco?.referencia ?? "",
    partida.banco?.descripcion ?? "",
    partida.banco?.agencia ?? "",
    partida.sistema?.bloque ?? "",
    partida.sistema?.tipoIngreso ?? "",
    partida.sistema?.cuenta ?? cuenta,
  ]);

  resultado.debitosBancarios.forEach((movimiento) => {
    filas.push([
      "Débito bancario (informativo)",
      movimiento.fecha,
      "",
      "",
      (movimiento.debitoCentavos / 100).toFixed(2).replace(".", ","),
      movimiento.numero,
      movimiento.referencia,
      movimiento.descripcion,
      movimiento.agencia,
      "",
      "",
      cuenta,
    ]);
  });

  const resumen = resultado.resumen;
  const resumenTotal = calcularResumenTotalConciliacion(resumen);
  const estadoResumen = resumenTotal.conciliado
    ? "CONCILIADO"
    : resumenTotal.cuadra
      ? "CUADRA CON REVISIÓN PENDIENTE"
      : "NO CONCILIADO";
  const filasResumen: Array<Array<string | number>> = [
    ["Conciliación bancaria"],
    ["Cuenta", cuenta],
    ["Período", `${fechaDesde} al ${fechaHasta}`],
    ["Tolerancia de fecha", `${resultado.toleranciaDias} día(s)`],
    [],
    ["Resumen", "Cantidad", "Total HNL"],
    ["Créditos banco", resumen.creditosBanco.cantidad, resumen.creditosBanco.totalCentavos / 100],
    ["Depósitos sistema", resumen.depositosSistema.cantidad, resumen.depositosSistema.totalCentavos / 100],
    ["Match perfecto", resumen.perfectos.cantidad, resumen.perfectos.totalCentavos / 100],
    ["Requiere revisión", resumen.porRevisar.cantidad, resumen.porRevisar.totalCentavos / 100],
    ["Notas de crédito", resumen.notasCredito.cantidad, resumen.notasCredito.totalCentavos / 100],
    ["Notas de débito", resumen.notasDebito.cantidad, resumen.notasDebito.totalCentavos / 100],
    ["Débitos bancarios", resumen.debitosBancarios.cantidad, resumen.debitosBancarios.totalCentavos / 100],
    ["Diferencia de control", "", resumen.diferenciaControlCentavos / 100],
    ["Total sistema ajustado", "", resumenTotal.totalSistemaAjustadoCentavos / 100],
    ["Total banco", "", resumenTotal.totalBancoCentavos / 100],
    ["Diferencia final", "", resumenTotal.diferenciaFinalCentavos / 100],
    ["Estado final", estadoResumen],
    [],
  ];
  const contenido = [...filasResumen, encabezados, ...filas]
    .map((fila) => fila.map(escaparCsv).join(";"))
    .join("\r\n");
  const blob = new Blob([`\uFEFF${contenido}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const numeroCuenta = cuenta.match(/\d+/g)?.join("") ?? "cuenta";
  link.href = url;
  link.download = `conciliacion-${numeroCuenta}-${fechaDesde}-${fechaHasta}.csv`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export default function ConciliacionBancariaModal({
  ingresos,
  cuentaInicial = "",
  fechaDesdeInicial = "",
  fechaHastaInicial = "",
  onClose,
}: Props) {
  const [cuenta, setCuenta] = useState(cuentaInicial);
  const [fechaDesde, setFechaDesde] = useState(fechaDesdeInicial);
  const [fechaHasta, setFechaHasta] = useState(fechaHastaInicial);
  const [toleranciaDias, setToleranciaDias] = useState(3);
  const [textoPegado, setTextoPegado] = useState("");
  const [error, setError] = useState("");
  const [parseoActual, setParseoActual] =
    useState<ResultadoParseoEstadoCuenta | null>(null);
  const [analisis, setAnalisis] = useState<AnalisisConciliacion | null>(null);
  const [pantallaActiva, setPantallaActiva] =
    useState<PantallaConciliacion>("carga");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("todos");
  const [busqueda, setBusqueda] = useState("");
  const dialogRef = useRef<HTMLDivElement>(null);
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const contenidoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const focoAnterior = document.activeElement as HTMLElement | null;
    cerrarRef.current?.focus();

    function controlarTeclado(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const elementos = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [href], [tabindex]:not([tabindex="-1"])'
        )
      ).filter((elemento) => elemento.offsetParent !== null);

      if (elementos.length === 0) return;
      const primero = elementos[0];
      const ultimo = elementos[elementos.length - 1];

      if (event.shiftKey && document.activeElement === primero) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primero.focus();
      }
    }

    window.addEventListener("keydown", controlarTeclado);
    return () => {
      window.removeEventListener("keydown", controlarTeclado);
      focoAnterior?.focus();
    };
  }, [onClose]);

  const cuentasDisponibles = useMemo(() => {
    const adicionales = ingresos
      .map((item) => item.cuenta?.trim())
      .filter((item): item is string => Boolean(item))
      .filter((item) => !CUENTAS_INGRESOS.includes(item));

    return [...CUENTAS_INGRESOS, ...Array.from(new Set(adicionales)).sort()];
  }, [ingresos]);

  const preparacionSistema = useMemo(() => {
    const depositos: DepositoSistemaConciliacion[] = [];
    const invalidos: string[] = [];
    let cantidadPeriodo = 0;
    let totalPeriodoCentavos = 0;

    if (!cuenta || !fechaDesde || !fechaHasta) {
      return {
        depositos,
        invalidos,
        cantidadPeriodo,
        totalPeriodoCentavos,
      };
    }

    ingresos.forEach((item, index) => {
      if (item.cuenta?.trim() !== cuenta) return;

      const fechaArqueo = normalizarFechaBancaria(
        item.fecha_arqueo ?? item.fecha ?? ""
      );

      if (!fechaArqueo) {
        invalidos.push(`Registro ${index + 1}: fecha de arqueo inválida.`);
        return;
      }

      if (!fechaEnRango(fechaArqueo, fechaDesde, fechaHasta)) return;

      const fecha = normalizarFechaBancaria(item.fecha_deposito ?? "");

      if (!fecha) {
        invalidos.push(`Registro ${index + 1}: fecha de depósito inválida.`);
        return;
      }

      const monto = Number(item.monto);
      if (!Number.isFinite(monto) || monto <= 0) {
        invalidos.push(
          `Registro ${index + 1} (${formatearFecha(fecha)}): monto inválido.`
        );
        return;
      }

      depositos.push({
        id:
          item.id_deposito !== undefined && item.id_deposito !== null
            ? String(item.id_deposito)
            : `deposito-${item.id_arqueo ?? "sin-arqueo"}-${
                item.bloque ?? "sin-bloque"
              }-${fecha}-${Math.round(monto * 100)}-${index}`,
        fecha,
        montoCentavos: Math.round(monto * 100),
        cuenta,
        bloque: item.bloque,
        tipoIngreso: item.tipo_ingreso,
        fechaArqueo,
        descripcion: item.descripcion,
        orden: index,
      });

      cantidadPeriodo += 1;
      totalPeriodoCentavos += Math.round(monto * 100);
    });

    return {
      depositos,
      invalidos,
      cantidadPeriodo,
      totalPeriodoCentavos,
    };
  }, [cuenta, fechaDesde, fechaHasta, ingresos]);

  const partidasFiltradas = useMemo(() => {
    if (!analisis) return [];
    const termino = busqueda.trim().toLocaleLowerCase("es-HN");

    return analisis.resultado.partidas.filter((partida) => {
      if (filtroEstado !== "todos" && partida.estado !== filtroEstado) {
        return false;
      }

      return (
        !termino ||
        textoPartida(partida).includes(termino) ||
        montoCoincideConBusqueda(partida.montoCentavos, termino)
      );
    });
  }, [analisis, busqueda, filtroEstado]);

  function invalidarResultado() {
    setError("");
    setParseoActual(null);
    setAnalisis(null);
    setPantallaActiva("carga");
    setFiltroEstado("todos");
    setBusqueda("");
  }

  function cambiarPantalla(value: PantallaConciliacion) {
    if (value !== "carga" && !analisis) return;
    setPantallaActiva(value);
    window.requestAnimationFrame(() =>
      contenidoRef.current?.scrollTo({ top: 0, behavior: "auto" })
    );
  }

  function cambiarCuenta(value: string) {
    setCuenta(value);
    invalidarResultado();
  }

  function cambiarFechaDesde(value: string) {
    setFechaDesde(value);
    invalidarResultado();
  }

  function cambiarFechaHasta(value: string) {
    setFechaHasta(value);
    invalidarResultado();
  }

  function cambiarTolerancia(value: number) {
    setToleranciaDias(value);
    invalidarResultado();
  }

  function cambiarTexto(value: string) {
    setTextoPegado(value);
    invalidarResultado();
  }

  function limpiarPegado() {
    setTextoPegado("");
    invalidarResultado();
  }

  function analizar() {
    setError("");
    setAnalisis(null);
    setFiltroEstado("todos");
    setBusqueda("");

    if (!cuenta) {
      setError("Seleccione la cuenta bancaria que corresponde al estado pegado.");
      return;
    }

    if (!fechaDesde || !fechaHasta) {
      setError("Seleccione el inicio y fin del período que desea conciliar.");
      return;
    }

    if (fechaDesde > fechaHasta) {
      setError("La fecha inicial no puede ser posterior a la fecha final.");
      return;
    }

    if (preparacionSistema.invalidos.length > 0) {
      setError(
        `Hay ${preparacionSistema.invalidos.length} registro(s) interno(s) con fecha de arqueo, fecha de depósito o monto inválido. Corríjalos antes de conciliar.`
      );
      return;
    }

    if (textoPegado.length > 5_000_000) {
      setError("El texto pegado supera el límite de 5 MB.");
      return;
    }

    try {
      const parseo = parsearEstadoCuentaPegado(textoPegado);
      setParseoActual(parseo);

      if (parseo.filasInvalidas.length > 0) {
        setError(
          `Hay ${parseo.filasInvalidas.length} fila(s) bancaria(s) inválida(s). Corríjalas y vuelva a analizar.`
        );
        return;
      }

      const movimientosFueraPeriodo =
        parseo.movimientos.length -
        parseo.movimientos.filter((movimiento) =>
          fechaEnRango(movimiento.fecha, fechaDesde, fechaHasta)
        ).length;

      if (parseo.movimientos.length === 0) {
        setError("No se encontraron movimientos bancarios válidos para analizar.");
        return;
      }

      const resultado = limitarResultadoConciliacionAlPeriodo(
        conciliarDepositos(
          parseo.movimientos,
          preparacionSistema.depositos,
          toleranciaDias
        ),
        fechaDesde,
        fechaHasta
      );

      if (
        resultado.partidas.length === 0 &&
        resultado.debitosBancarios.length === 0
      ) {
        setError(
          "No hay movimientos bancarios ni arqueos aplicables al período seleccionado."
        );
        return;
      }

      setAnalisis({ resultado, parseo, movimientosFueraPeriodo });
      setPantallaActiva("resumen");
      window.requestAnimationFrame(() =>
        contenidoRef.current?.scrollTo({ top: 0, behavior: "auto" })
      );
    } catch (err) {
      setParseoActual(null);
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo interpretar el estado de cuenta."
      );
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] bg-slate-950/55 p-2 backdrop-blur-sm md:p-4"
    >
      <div
        ref={dialogRef}
        className="mx-auto flex h-full max-w-[1800px] flex-col overflow-hidden border border-slate-300 bg-slate-50 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-conciliacion"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 md:px-5">
          <div className="flex min-w-0 items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center bg-[#003331] text-white">
              <Landmark className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Ingresos · control bancario
              </div>
              <h2
                id="titulo-conciliacion"
                className="mt-0.5 text-[18px] font-semibold text-slate-950"
              >
                Conciliación bancaria
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                Cruce uno a uno de los créditos del banco contra los depósitos
                registrados.
              </p>
            </div>
          </div>

          <button
            ref={cerrarRef}
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center border border-slate-200 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50"
            title="Cerrar conciliación"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <NavegacionPantallas
          activa={pantallaActiva}
          resultadosDisponibles={Boolean(analisis)}
          onCambiar={cambiarPantalla}
        />

        <div
          ref={contenidoRef}
          className="min-h-0 flex-1 overflow-y-auto p-3 md:p-5"
        >
          {pantallaActiva === "carga" && (
            <>
          <section className="border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-950">
                    1. Cuenta, período y estado bancario
                  </h3>
                  <p className="mt-1 text-xs text-slate-500">
                    El período filtra por fecha de arqueo; la fecha del depósito se
                    usa para encontrar su movimiento en el banco.
                  </p>
                </div>
                <div className="text-xs text-slate-500">
                  Comparación por monto exacto · tolerancia solo en fecha
                </div>
              </div>
            </div>

            <div className="p-4">
              <div className="grid gap-3 xl:grid-cols-[minmax(280px,1.7fr)_170px_170px_150px_minmax(170px,auto)] xl:items-end">
                <label className="grid gap-1 text-xs font-medium text-slate-600">
                  Cuenta bancaria
                  <select
                    value={cuenta}
                    onChange={(event) => cambiarCuenta(event.target.value)}
                    className="h-10 w-full border border-slate-200 bg-white px-3 text-sm outline-none"
                  >
                    <option value="">Seleccione una cuenta</option>
                    {cuentasDisponibles.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 text-xs font-medium text-slate-600">
                  Arqueo desde
                  <input
                    type="date"
                    value={fechaDesde}
                    onChange={(event) => cambiarFechaDesde(event.target.value)}
                    className="h-10 w-full border border-slate-200 bg-white px-3 text-sm outline-none"
                  />
                </label>

                <label className="grid gap-1 text-xs font-medium text-slate-600">
                  Arqueo hasta
                  <input
                    type="date"
                    value={fechaHasta}
                    onChange={(event) => cambiarFechaHasta(event.target.value)}
                    className="h-10 w-full border border-slate-200 bg-white px-3 text-sm outline-none"
                  />
                </label>

                <label className="grid gap-1 text-xs font-medium text-slate-600">
                  Fecha cercana
                  <select
                    value={toleranciaDias}
                    onChange={(event) =>
                      cambiarTolerancia(Number(event.target.value))
                    }
                    className="h-10 w-full border border-slate-200 bg-white px-3 text-sm outline-none"
                  >
                    {[1, 2, 3, 4, 5, 7].map((dias) => (
                      <option key={dias} value={dias}>
                        Hasta {dias} día{dias === 1 ? "" : "s"}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="text-[10px] font-semibold uppercase text-slate-500">
                    Depósitos de arqueos del período
                  </div>
                  <div className="mt-1 text-sm font-semibold tabular-nums text-slate-950">
                    {cuenta && fechaDesde && fechaHasta
                      ? `${preparacionSistema.cantidadPeriodo} · ${formatMoneyCentavos(
                          preparacionSistema.totalPeriodoCentavos
                        )}`
                      : "Seleccione los filtros"}
                  </div>
                </div>
              </div>

              {preparacionSistema.invalidos.length > 0 && (
                <div className="mt-3 border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
                  {preparacionSistema.invalidos.length} registro(s) interno(s)
                  presentan fecha de arqueo, fecha de depósito o monto inválido.
                </div>
              )}

              <label className="mt-4 block">
                <span className="mb-1 flex items-center justify-between gap-4 text-xs font-medium text-slate-600">
                  <span>Movimientos copiados desde Excel</span>
                  <span className="font-normal text-slate-400">
                    {textoPegado
                      ? `${textoPegado.split(/\r?\n/).length} filas pegadas`
                      : "Aún no hay datos"}
                  </span>
                </span>
                <textarea
                  value={textoPegado}
                  onChange={(event) => cambiarTexto(event.target.value)}
                  maxLength={5_000_000}
                  spellCheck={false}
                  placeholder={
                    "No.\tFecha\tTipo\tDescripción\tReferencia\tAgencia\tDébitos\tCréditos\tSaldo\n1\t20/07/2026\tDEP\tDepósito..."
                  }
                  className="h-40 w-full resize-y border border-slate-300 bg-white p-3 font-mono text-xs leading-5 outline-none"
                />
              </label>

              <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="max-w-3xl text-xs leading-5 text-slate-500">
                  Solo la columna <strong>Créditos</strong> se compara contra
                  ingresos. Los movimientos de la columna <strong>Débitos</strong>{" "}
                  se conservan en una sección informativa separada.
                </p>

                <div className="flex shrink-0 justify-end gap-2">
                  <button
                    type="button"
                    onClick={limpiarPegado}
                    disabled={!textoPegado}
                    className="h-9 border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-slate-400 disabled:cursor-not-allowed disabled:text-slate-400"
                  >
                    Limpiar
                  </button>
                  <button
                    type="button"
                    onClick={analizar}
                    disabled={!textoPegado}
                    className="inline-flex h-9 items-center justify-center gap-2 border border-[#003331] bg-[#003331] px-4 text-sm font-semibold text-white hover:bg-[#004c49] disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
                  >
                    <ClipboardPaste className="h-4 w-4" />
                    Analizar conciliación
                  </button>
                </div>
              </div>
            </div>
          </section>

          {error && (
            <div
              className="mt-4 flex gap-3 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
              role="alert"
              aria-live="assertive"
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <div className="font-semibold">No se generó la conciliación</div>
                <p className="mt-1 text-xs leading-5">{error}</p>
              </div>
            </div>
          )}

          {parseoActual && parseoActual.filasInvalidas.length > 0 && (
            <section className="mt-4 overflow-hidden border border-red-200 bg-white">
              <div className="border-b border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-900">
                Filas bancarias que debe corregir
              </div>
              <div className="max-h-48 overflow-auto">
                <table className="w-full min-w-[680px] text-left text-xs">
                  <thead className="sticky top-0 bg-white text-slate-500">
                    <tr>
                      <th className="px-3 py-2">Fila</th>
                      <th className="px-3 py-2">Motivo</th>
                      <th className="px-3 py-2">Contenido</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parseoActual.filasInvalidas.map((fila) => (
                      <tr key={fila.fila} className="border-t border-slate-100">
                        <td className="px-3 py-2 tabular-nums">{fila.fila}</td>
                        <td className="px-3 py-2 font-medium text-red-800">
                          {fila.motivo}
                        </td>
                        <td className="max-w-[720px] truncate px-3 py-2 text-slate-500">
                          {fila.valores.join(" | ")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
            </>
          )}

          {analisis && pantallaActiva !== "carga" && (
            <ResultadoConciliacionView
              pantalla={pantallaActiva}
              onCambiarPantalla={cambiarPantalla}
              analisis={analisis}
              cuenta={cuenta}
              fechaDesde={fechaDesde}
              fechaHasta={fechaHasta}
              filtroEstado={filtroEstado}
              setFiltroEstado={setFiltroEstado}
              busqueda={busqueda}
              setBusqueda={setBusqueda}
              partidasFiltradas={partidasFiltradas}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function NavegacionPantallas({
  activa,
  resultadosDisponibles,
  onCambiar,
}: {
  activa: PantallaConciliacion;
  resultadosDisponibles: boolean;
  onCambiar: (value: PantallaConciliacion) => void;
}) {
  const pantallas: Array<{
    id: PantallaConciliacion;
    etiqueta: string;
    detalle: string;
  }> = [
    { id: "carga", etiqueta: "Cargar datos", detalle: "Cuenta y Excel" },
    { id: "resumen", etiqueta: "Resumen", detalle: "Totales y ajustes" },
    { id: "detalle", etiqueta: "Detalle", detalle: "Sistema vs. banco" },
    { id: "otros", etiqueta: "Otros datos", detalle: "Débitos y avisos" },
  ];

  return (
    <nav
      className="shrink-0 border-b border-slate-200 bg-white px-2 sm:px-4"
      aria-label="Pantallas de conciliación"
    >
      <ol className="mx-auto grid max-w-5xl grid-cols-4">
        {pantallas.map((pantalla, index) => {
          const seleccionada = activa === pantalla.id;
          const deshabilitada = pantalla.id !== "carga" && !resultadosDisponibles;

          return (
            <li key={pantalla.id} className="min-w-0">
              <button
                type="button"
                aria-current={seleccionada ? "step" : undefined}
                disabled={deshabilitada}
                onClick={() => onCambiar(pantalla.id)}
                className={[
                  "flex h-full min-h-16 w-full flex-col items-center justify-center gap-1 border-b-2 px-1 py-2 text-center transition-colors sm:flex-row sm:gap-2 sm:px-3 sm:text-left",
                  seleccionada
                    ? "border-[#003331] bg-emerald-50/60 text-[#003331]"
                    : "border-transparent text-slate-500 hover:bg-slate-50 hover:text-slate-900",
                  deshabilitada
                    ? "cursor-not-allowed opacity-40 hover:bg-white hover:text-slate-500"
                    : "",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums",
                    seleccionada
                      ? "border-[#003331] bg-[#003331] text-white"
                      : "border-slate-300 bg-white text-slate-600",
                  ].join(" ")}
                >
                  {index + 1}
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-semibold leading-3 sm:text-xs">
                    {pantalla.etiqueta}
                  </span>
                  <span className="mt-0.5 hidden text-[10px] text-slate-400 md:block">
                    {pantalla.detalle}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

function ResultadoConciliacionView({
  pantalla,
  onCambiarPantalla,
  analisis,
  cuenta,
  fechaDesde,
  fechaHasta,
  filtroEstado,
  setFiltroEstado,
  busqueda,
  setBusqueda,
  partidasFiltradas,
}: {
  pantalla: PantallaConciliacion;
  onCambiarPantalla: (value: PantallaConciliacion) => void;
  analisis: AnalisisConciliacion;
  cuenta: string;
  fechaDesde: string;
  fechaHasta: string;
  filtroEstado: FiltroEstado;
  setFiltroEstado: (value: FiltroEstado) => void;
  busqueda: string;
  setBusqueda: (value: string) => void;
  partidasFiltradas: PartidaConciliacion[];
}) {
  const { resultado, parseo, movimientosFueraPeriodo } = analisis;
  const resumen = resultado.resumen;
  const resumenTotal = calcularResumenTotalConciliacion(resumen);
  const diferenciaNotas =
    resumen.notasCredito.totalCentavos - resumen.notasDebito.totalCentavos;

  return (
    <section className="border border-slate-200 bg-white">
      {pantalla === "resumen" && (
        <>
      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-950">
            Resumen de conciliación
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            {cuenta} · {formatearFecha(fechaDesde)} al{" "}
            {formatearFecha(fechaHasta)} · fecha cercana hasta{" "}
            {resultado.toleranciaDias} día(s)
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            descargarResumenCsv(resultado, cuenta, fechaDesde, fechaHasta)
          }
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 border border-slate-900 bg-slate-950 px-4 text-sm font-semibold text-white hover:bg-slate-800"
        >
          <Download className="h-4 w-4" />
          Descargar resumen CSV
        </button>
      </div>

      <CedulaResumenTotal
        resumen={resumen}
        resumenTotal={resumenTotal}
      />

      <div className="grid border-b border-slate-200 sm:grid-cols-2 xl:grid-cols-6">
        <ResumenCard
          titulo="Créditos banco"
          metrica={resumen.creditosBanco}
          color="slate"
        />
        <ResumenCard
          titulo="Depósitos sistema"
          metrica={resumen.depositosSistema}
          color="slate"
        />
        <ResumenCard
          titulo="Match perfecto"
          metrica={resumen.perfectos}
          color="emerald"
        />
        <ResumenCard
          titulo="Requiere revisión"
          metrica={resumen.porRevisar}
          color="amber"
        />
        <ResumenCard
          titulo="Notas de crédito"
          metrica={resumen.notasCredito}
          color="sky"
        />
        <ResumenCard
          titulo="Notas de débito"
          metrica={resumen.notasDebito}
          color="rose"
        />
      </div>

      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="text-xs leading-5 text-slate-600">
          Control: créditos banco − depósitos sistema ={" "}
          <strong className="tabular-nums text-slate-950">
            {formatMoneyCentavos(resumen.diferenciaControlCentavos)}
          </strong>
          . Notas de crédito − notas de débito ={" "}
          <strong className="tabular-nums text-slate-950">
            {formatMoneyCentavos(diferenciaNotas)}
          </strong>
          .
        </div>
      </div>

      <PieNavegacionPantalla
        etiquetaAnterior="Volver a cargar datos"
        onAnterior={() => onCambiarPantalla("carga")}
        etiquetaSiguiente="Ver detalle"
        onSiguiente={() => onCambiarPantalla("detalle")}
      />
        </>
      )}

      {pantalla === "detalle" && (
        <>
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-950">
          Detalle de conciliación
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          {cuenta} · {formatearFecha(fechaDesde)} al {formatearFecha(fechaHasta)} ·
          fecha cercana hasta {resultado.toleranciaDias} día(s)
        </p>
      </div>

      <div className="flex flex-col gap-3 border-b border-slate-200 px-4 py-3 xl:flex-row xl:items-end xl:justify-between">
        <div role="group" aria-label="Filtrar por resultado">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            Filtrar por resultado
          </p>
          <div className="flex flex-wrap gap-2">
            <FiltroButton
              activo={filtroEstado === "todos"}
              onClick={() => setFiltroEstado("todos")}
              etiqueta="Todos"
              cantidad={resultado.partidas.length}
            />
            <FiltroButton
              activo={filtroEstado === "perfecto"}
              onClick={() => setFiltroEstado("perfecto")}
              etiqueta="Conciliados"
              cantidad={resumen.perfectos.cantidad}
            />
            <FiltroButton
              activo={filtroEstado === "revisar"}
              onClick={() => setFiltroEstado("revisar")}
              etiqueta="Revisión de fecha"
              cantidad={resumen.porRevisar.cantidad}
            />
            <FiltroButton
              activo={filtroEstado === "nota_credito"}
              onClick={() => setFiltroEstado("nota_credito")}
              etiqueta="Notas de crédito"
              cantidad={resumen.notasCredito.cantidad}
            />
            <FiltroButton
              activo={filtroEstado === "nota_debito"}
              onClick={() => setFiltroEstado("nota_debito")}
              etiqueta="Notas de débito"
              cantidad={resumen.notasDebito.cantidad}
            />
          </div>
        </div>

        <div className="relative w-full xl:w-[360px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            aria-label="Buscar por referencia, fecha o monto"
            placeholder="Buscar referencia, fecha o monto"
            className="h-9 w-full border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none"
          />
        </div>
      </div>

      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h4 className="text-sm font-semibold text-slate-950">
              Datos del sistema vs. datos del banco
            </h4>
            <div className="mt-1 flex items-start gap-2 text-xs leading-5 text-slate-600">
              <MousePointer2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              <span>
                Cada columna conserva el orden original de su fuente. Pase el cursor
                sobre un dato conciliado para encender su contraparte y mostrar la
                flecha de vínculo.
              </span>
            </div>
          </div>
          <p className="shrink-0 text-xs font-medium text-slate-600" aria-live="polite">
            Mostrando {partidasFiltradas.length} de {resultado.partidas.length}
          </p>
        </div>
      </div>

      <ListasOrdenOriginal
        key={`${filtroEstado}-${busqueda}`}
        partidas={partidasFiltradas}
      />

      <PieNavegacionPantalla
        etiquetaAnterior="Volver al resumen"
        onAnterior={() => onCambiarPantalla("resumen")}
        etiquetaSiguiente="Ver otros datos"
        onSiguiente={() => onCambiarPantalla("otros")}
      />
        </>
      )}

      {pantalla === "otros" && (
        <>
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-slate-950">Otros datos</h3>
        <p className="mt-1 text-xs text-slate-500">
          Movimientos bancarios informativos y observaciones del archivo procesado.
        </p>
      </div>

      <div className="grid border-b border-slate-200 sm:grid-cols-3">
        <DatoAuxiliar
          etiqueta="Débitos bancarios"
          cantidad={resumen.debitosBancarios.cantidad}
          detalle={formatMoneyCentavos(resumen.debitosBancarios.totalCentavos)}
        />
        <DatoAuxiliar
          etiqueta="Fuera del período"
          cantidad={movimientosFueraPeriodo}
          detalle="Solo se muestran si concilian con un arqueo del período"
        />
        <DatoAuxiliar
          etiqueta="Filas ignoradas"
          cantidad={parseo.filasIgnoradas.length}
          detalle="Filas sin movimiento bancario"
        />
      </div>

      {resultado.debitosBancarios.length > 0 && (
        <div className="border-t border-slate-200">
          <div className="flex flex-col gap-2 bg-slate-50 px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold text-slate-900">
                Débitos reales del estado bancario
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Son informativos y no se mezclan con la “nota de débito” definida
                como registro interno sin banco.
              </p>
            </div>
            <div className="text-sm font-semibold tabular-nums text-slate-950">
              {resumen.debitosBancarios.cantidad} movimiento(s) ·{" "}
              {formatMoneyCentavos(resumen.debitosBancarios.totalCentavos)}
            </div>
          </div>
          <div className="max-h-56 overflow-auto">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead className="sticky top-0 bg-white uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-2">Fecha</th>
                  <th className="px-3 py-2">No.</th>
                  <th className="px-3 py-2">Referencia</th>
                  <th className="px-3 py-2">Descripción</th>
                  <th className="px-3 py-2">Agencia</th>
                  <th className="px-3 py-2 text-right">Débito</th>
                </tr>
              </thead>
              <tbody>
                {resultado.debitosBancarios.map((movimiento) => (
                  <tr key={movimiento.id} className="border-t border-slate-100">
                    <td className="px-3 py-2 tabular-nums">
                      {formatearFecha(movimiento.fecha)}
                    </td>
                    <td className="px-3 py-2">{movimiento.numero || "—"}</td>
                    <td className="px-3 py-2">{movimiento.referencia || "—"}</td>
                    <td className="px-3 py-2">{movimiento.descripcion || "—"}</td>
                    <td className="px-3 py-2">{movimiento.agencia || "—"}</td>
                    <td className="px-3 py-2 text-right font-semibold tabular-nums">
                      {formatMoneyCentavos(movimiento.debitoCentavos)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {parseo.advertencias.length > 0 && (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          {parseo.advertencias.join(" ")}
        </div>
      )}

      {parseo.filasIgnoradas.length > 0 && (
        <div className="border-t border-slate-200">
          <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900">
            Filas del archivo sin movimiento
          </div>
          <div className="max-h-52 overflow-auto">
            <table className="w-full min-w-[680px] text-left text-xs">
              <thead className="sticky top-0 bg-white text-slate-500">
                <tr>
                  <th className="px-3 py-2">Fila</th>
                  <th className="px-3 py-2">Motivo</th>
                  <th className="px-3 py-2">Contenido</th>
                </tr>
              </thead>
              <tbody>
                {parseo.filasIgnoradas.map((fila) => (
                  <tr key={fila.fila} className="border-t border-slate-100">
                    <td className="px-3 py-2 tabular-nums">{fila.fila}</td>
                    <td className="px-3 py-2 font-medium text-slate-700">
                      {fila.motivo}
                    </td>
                    <td className="max-w-[720px] truncate px-3 py-2 text-slate-500">
                      {fila.valores.join(" | ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {resultado.debitosBancarios.length === 0 &&
        parseo.advertencias.length === 0 &&
        parseo.filasIgnoradas.length === 0 &&
        movimientosFueraPeriodo === 0 && (
          <div className="px-4 py-12 text-center text-sm text-slate-500">
            No hay otros datos u observaciones para mostrar.
          </div>
        )}

      <PieNavegacionPantalla
        etiquetaAnterior="Volver al detalle"
        onAnterior={() => onCambiarPantalla("detalle")}
      />
        </>
      )}
    </section>
  );
}

function PieNavegacionPantalla({
  etiquetaAnterior,
  onAnterior,
  etiquetaSiguiente,
  onSiguiente,
}: {
  etiquetaAnterior: string;
  onAnterior: () => void;
  etiquetaSiguiente?: string;
  onSiguiente?: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <button
        type="button"
        onClick={onAnterior}
        className="inline-flex h-9 w-full items-center justify-center gap-2 border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:border-slate-400 sm:w-auto"
      >
        <ChevronLeft className="h-4 w-4" />
        {etiquetaAnterior}
      </button>

      {etiquetaSiguiente && onSiguiente && (
        <button
          type="button"
          onClick={onSiguiente}
          className="inline-flex h-9 w-full items-center justify-center gap-2 border border-[#003331] bg-[#003331] px-4 text-sm font-semibold text-white hover:bg-[#004c49] sm:w-auto"
        >
          {etiquetaSiguiente}
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

function DatoAuxiliar({
  etiqueta,
  cantidad,
  detalle,
}: {
  etiqueta: string;
  cantidad: number;
  detalle: string;
}) {
  return (
    <div className="border-b border-slate-200 px-4 py-3 sm:border-b-0 sm:border-r">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {etiqueta}
      </div>
      <div className="mt-1 text-xl font-semibold tabular-nums text-slate-950">
        {cantidad}
      </div>
      <div className="mt-1 text-[11px] leading-4 text-slate-500">{detalle}</div>
    </div>
  );
}

function CedulaResumenTotal({
  resumen,
  resumenTotal,
}: {
  resumen: ResumenConciliacion;
  resumenTotal: ResumenTotalConciliacion;
}) {
  const estado = resumenTotal.conciliado
    ? {
        etiqueta: "Conciliado",
        detalle: "Los totales ajustados coinciden y no hay matches pendientes.",
        clase: "border-emerald-300 bg-emerald-400/15 text-emerald-50",
      }
    : resumenTotal.cuadra
      ? {
          etiqueta: "Cuadra con revisión pendiente",
          detalle: `${resumen.porRevisar.cantidad} match(es) por fecha cercana requieren revisión.`,
          clase: "border-amber-300 bg-amber-400/15 text-amber-50",
        }
      : {
          etiqueta: "No conciliado",
          detalle: "La diferencia final todavía no es cero.",
          clase: "border-rose-300 bg-rose-400/15 text-rose-50",
        };

  return (
    <div className="grid border-b border-slate-200 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="px-4 py-4 md:px-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          Cédula de conciliación
        </div>
        <h4 className="mt-1 text-base font-semibold text-slate-950">
          Ajuste del total registrado
        </h4>

        <div className="mt-4 max-w-2xl text-sm">
          <LineaCedula
            etiqueta="Total de depósitos según el sistema"
            valor={resumenTotal.totalSistemaCentavos}
          />
          <LineaCedula
            etiqueta="Más: notas de crédito"
            valor={resumenTotal.notasCreditoCentavos}
            signo="+"
            valorClass="text-sky-700"
          />
          <LineaCedula
            etiqueta="Menos: notas de débito"
            valor={resumenTotal.notasDebitoCentavos}
            signo="−"
            valorClass="text-rose-700"
          />
          <div className="mt-2 border-t-2 border-slate-900 pt-2">
            <LineaCedula
              etiqueta="Total del sistema después de ajustes"
              valor={resumenTotal.totalSistemaAjustadoCentavos}
              fuerte
            />
          </div>
        </div>

        <p className="mt-3 text-[11px] leading-5 text-slate-500">
          En este módulo, el saldo conciliado corresponde al total de depósitos
          y créditos del período seleccionado.
        </p>
      </div>

      <div className="flex flex-col justify-between bg-[#003331] px-5 py-5 text-white">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-emerald-100/70">
            Total según el banco
          </div>
          <div className="mt-2 text-3xl font-semibold tabular-nums">
            {formatMoneyCentavos(resumenTotal.totalBancoCentavos)}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-white/15 pt-4">
            <div>
              <div className="text-[10px] uppercase text-emerald-100/65">
                Sistema ajustado
              </div>
              <div className="mt-1 text-sm font-semibold tabular-nums">
                {formatMoneyCentavos(
                  resumenTotal.totalSistemaAjustadoCentavos
                )}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[10px] uppercase text-emerald-100/65">
                Diferencia final
              </div>
              <div className="mt-1 text-sm font-semibold tabular-nums">
                {formatMoneyCentavos(resumenTotal.diferenciaFinalCentavos)}
              </div>
            </div>
          </div>
        </div>

        <div className={`mt-5 border px-3 py-3 ${estado.clase}`}>
          <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
            {resumenTotal.conciliado ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            {estado.etiqueta}
          </div>
          <p className="mt-1 text-[11px] leading-5 opacity-90">
            {estado.detalle}
          </p>
        </div>
      </div>
    </div>
  );
}

function LineaCedula({
  etiqueta,
  valor,
  signo,
  fuerte = false,
  valorClass = "text-slate-950",
}: {
  etiqueta: string;
  valor: number;
  signo?: string;
  fuerte?: boolean;
  valorClass?: string;
}) {
  return (
    <div
      className={[
        "grid grid-cols-[1fr_auto] items-center gap-5 py-1.5",
        fuerte ? "font-semibold" : "text-slate-700",
      ].join(" ")}
    >
      <span>{etiqueta}</span>
      <span className={`font-semibold tabular-nums ${valorClass}`}>
        {signo ? `${signo} ` : ""}
        {formatMoneyCentavos(valor)}
      </span>
    </div>
  );
}

function ResumenCard({
  titulo,
  metrica,
  color,
}: {
  titulo: string;
  metrica: MetricaConciliacion;
  color: "slate" | "emerald" | "amber" | "sky" | "rose";
}) {
  const colores = {
    slate: "border-slate-300 text-slate-700",
    emerald: "border-emerald-400 text-emerald-800",
    amber: "border-amber-400 text-amber-800",
    sky: "border-sky-400 text-sky-800",
    rose: "border-rose-400 text-rose-800",
  };

  return (
    <div className={`border-b-2 px-4 py-3 xl:border-r ${colores[color]}`}>
      <div className="text-[10px] font-semibold uppercase tracking-wide">
        {titulo}
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-3">
        <span className="text-lg font-semibold tabular-nums text-slate-950">
          {metrica.cantidad}
        </span>
        <span className="text-xs font-semibold tabular-nums text-slate-700">
          {formatMoneyCentavos(metrica.totalCentavos)}
        </span>
      </div>
    </div>
  );
}

function FiltroButton({
  activo,
  onClick,
  etiqueta,
  cantidad,
}: {
  activo: boolean;
  onClick: () => void;
  etiqueta: string;
  cantidad: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={[
        "inline-flex h-8 items-center gap-2 border px-3 text-xs font-semibold",
        activo
          ? "border-slate-900 bg-slate-950 text-white"
          : "border-slate-200 bg-white text-slate-600 hover:border-slate-400",
      ].join(" ")}
    >
      {etiqueta}
      <span
        className={[
          "min-w-5 px-1.5 py-0.5 text-center tabular-nums",
          activo ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700",
        ].join(" ")}
      >
        {cantidad}
      </span>
    </button>
  );
}

type LadoComparacion = "sistema" | "banco";

type ElementoActivo = {
  partidaId: string;
  lado: LadoComparacion;
};

type FlechaConciliacion = {
  partidaId: string;
  lado: LadoComparacion;
  ancho: number;
  alto: number;
  inicioX: number;
  inicioY: number;
  finX: number;
  finY: number;
  control1X: number;
  control2X: number;
  color: string;
};

const COLORES_FLECHA: Record<"perfecto" | "revisar", string> = {
  perfecto: "#059669",
  revisar: "#d97706",
};

function ordenarPartidasPorFuente(
  partidas: PartidaConciliacion[],
  lado: LadoComparacion
) {
  return partidas
    .map((partida, posicion) => ({ partida, posicion }))
    .filter(({ partida }) =>
      lado === "sistema" ? Boolean(partida.sistema) : Boolean(partida.banco)
    )
    .sort((a, b) => {
      const ordenA =
        lado === "sistema"
          ? (a.partida.sistema?.orden ?? a.posicion)
          : (a.partida.banco?.fila ?? a.posicion);
      const ordenB =
        lado === "sistema"
          ? (b.partida.sistema?.orden ?? b.posicion)
          : (b.partida.banco?.fila ?? b.posicion);
      return ordenA - ordenB || a.posicion - b.posicion;
    })
    .map(({ partida }) => partida);
}

function ListasOrdenOriginal({
  partidas,
}: {
  partidas: PartidaConciliacion[];
}) {
  const partidasSistema = useMemo(
    () => ordenarPartidasPorFuente(partidas, "sistema"),
    [partidas]
  );
  const partidasBanco = useMemo(
    () => ordenarPartidasPorFuente(partidas, "banco"),
    [partidas]
  );
  const partidasPorId = useMemo(
    () => new Map(partidas.map((partida) => [partida.id, partida])),
    [partidas]
  );
  const [hoverActivo, setHoverActivo] = useState<ElementoActivo | null>(null);
  const [focoActivo, setFocoActivo] = useState<ElementoActivo | null>(null);
  const [fijadoActivo, setFijadoActivo] = useState<ElementoActivo | null>(null);
  const [flecha, setFlecha] = useState<FlechaConciliacion | null>(null);
  const activo = hoverActivo ?? focoActivo ?? fijadoActivo;
  const tableroRef = useRef<HTMLDivElement>(null);
  const scrollSistemaRef = useRef<HTMLDivElement>(null);
  const scrollBancoRef = useRef<HTMLDivElement>(null);
  const elementosSistemaRef = useRef(new Map<string, HTMLButtonElement>());
  const elementosBancoRef = useRef(new Map<string, HTMLButtonElement>());

  const registrarElementoSistema = useCallback(
    (partidaId: string, elemento: HTMLButtonElement | null) => {
      if (elemento) elementosSistemaRef.current.set(partidaId, elemento);
      else elementosSistemaRef.current.delete(partidaId);
    },
    []
  );
  const registrarElementoBanco = useCallback(
    (partidaId: string, elemento: HTMLButtonElement | null) => {
      if (elemento) elementosBancoRef.current.set(partidaId, elemento);
      else elementosBancoRef.current.delete(partidaId);
    },
    []
  );

  const actualizarFlecha = useCallback(() => {
    if (!activo || !tableroRef.current) {
      setFlecha(null);
      return;
    }

    const partida = partidasPorId.get(activo.partidaId);
    const elementoSistema = elementosSistemaRef.current.get(activo.partidaId);
    const elementoBanco = elementosBancoRef.current.get(activo.partidaId);
    const scrollSistema = scrollSistemaRef.current;
    const scrollBanco = scrollBancoRef.current;

    if (
      !partida?.sistema ||
      !partida.banco ||
      (partida.estado !== "perfecto" && partida.estado !== "revisar") ||
      !elementoSistema ||
      !elementoBanco ||
      !scrollSistema ||
      !scrollBanco
    ) {
      setFlecha(null);
      return;
    }

    const rectSistema = elementoSistema.getBoundingClientRect();
    const rectBanco = elementoBanco.getBoundingClientRect();
    const rectScrollSistema = scrollSistema.getBoundingClientRect();
    const rectScrollBanco = scrollBanco.getBoundingClientRect();
    const visibleSistema =
      rectSistema.bottom > rectScrollSistema.top &&
      rectSistema.top < rectScrollSistema.bottom;
    const visibleBanco =
      rectBanco.bottom > rectScrollBanco.top &&
      rectBanco.top < rectScrollBanco.bottom;

    if (!visibleSistema || !visibleBanco) {
      setFlecha(null);
      return;
    }

    const rectTablero = tableroRef.current.getBoundingClientRect();
    const desdeSistema = activo.lado === "sistema";
    const inicioX = desdeSistema
      ? rectSistema.right - rectTablero.left
      : rectBanco.left - rectTablero.left;
    const inicioY = desdeSistema
      ? rectSistema.top + rectSistema.height / 2 - rectTablero.top
      : rectBanco.top + rectBanco.height / 2 - rectTablero.top;
    const finX = desdeSistema
      ? rectBanco.left - rectTablero.left
      : rectSistema.right - rectTablero.left;
    const finY = desdeSistema
      ? rectBanco.top + rectBanco.height / 2 - rectTablero.top
      : rectSistema.top + rectSistema.height / 2 - rectTablero.top;
    const direccion = finX >= inicioX ? 1 : -1;
    const distanciaControl = Math.max(28, Math.abs(finX - inicioX) * 0.48);
    const siguiente: FlechaConciliacion = {
      partidaId: activo.partidaId,
      lado: activo.lado,
      ancho: Math.round(rectTablero.width),
      alto: Math.round(rectTablero.height),
      inicioX: Math.round(inicioX),
      inicioY: Math.round(inicioY),
      finX: Math.round(finX),
      finY: Math.round(finY),
      control1X: Math.round(inicioX + direccion * distanciaControl),
      control2X: Math.round(finX - direccion * distanciaControl),
      color: COLORES_FLECHA[partida.estado],
    };

    setFlecha((anterior) => {
      if (
        anterior &&
        Object.keys(siguiente).every(
          (clave) =>
            anterior[clave as keyof FlechaConciliacion] ===
            siguiente[clave as keyof FlechaConciliacion]
        )
      ) {
        return anterior;
      }
      return siguiente;
    });
  }, [activo, partidasPorId]);

  useEffect(() => {
    if (activo) {
      const partida = partidasPorId.get(activo.partidaId);

      if (partida?.sistema && partida.banco) {
        const objetivo =
          activo.lado === "sistema"
            ? elementosBancoRef.current.get(activo.partidaId)
            : elementosSistemaRef.current.get(activo.partidaId);
        const contenedor =
          activo.lado === "sistema"
            ? scrollBancoRef.current
            : scrollSistemaRef.current;

        if (objetivo && contenedor) {
          const rectObjetivo = objetivo.getBoundingClientRect();
          const rectContenedor = contenedor.getBoundingClientRect();
          const fueraDeVista =
            rectObjetivo.top < rectContenedor.top ||
            rectObjetivo.bottom > rectContenedor.bottom;

          if (fueraDeVista) {
            contenedor.scrollTo({
              top:
                contenedor.scrollTop +
                (rectObjetivo.top - rectContenedor.top) -
                (contenedor.clientHeight - rectObjetivo.height) / 2,
              behavior: "auto",
            });
          }
        }
      }
    }

    const frame = window.requestAnimationFrame(actualizarFlecha);
    return () => window.cancelAnimationFrame(frame);
  }, [activo, actualizarFlecha, partidasPorId]);

  useEffect(() => {
    const scrollSistema = scrollSistemaRef.current;
    const scrollBanco = scrollBancoRef.current;
    const tablero = tableroRef.current;
    if (!tablero || !scrollSistema || !scrollBanco) return;

    const manejarCambio = () => actualizarFlecha();
    scrollSistema.addEventListener("scroll", manejarCambio, { passive: true });
    scrollBanco.addEventListener("scroll", manejarCambio, { passive: true });
    window.addEventListener("resize", manejarCambio);
    const observer =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(manejarCambio);
    observer?.observe(tablero);
    observer?.observe(scrollSistema);
    observer?.observe(scrollBanco);

    return () => {
      scrollSistema.removeEventListener("scroll", manejarCambio);
      scrollBanco.removeEventListener("scroll", manejarCambio);
      window.removeEventListener("resize", manejarCambio);
      observer?.disconnect();
    };
  }, [actualizarFlecha]);

  function activar(partidaId: string, lado: LadoComparacion) {
    return { partidaId, lado } satisfies ElementoActivo;
  }

  function alternarFijado(partidaId: string, lado: LadoComparacion) {
    setFijadoActivo((actual) =>
      actual?.partidaId === partidaId && actual.lado === lado
        ? null
        : activar(partidaId, lado)
    );
  }

  return (
    <div className="border-b border-slate-200 bg-slate-50">
      <div className="flex flex-wrap gap-x-4 gap-y-2 border-b border-slate-200 bg-white px-4 py-2">
        <LeyendaEstado estado="perfecto" etiqueta="Conciliado" />
        <LeyendaEstado estado="revisar" etiqueta="Fecha por revisar" />
        <LeyendaEstado estado="nota_credito" etiqueta="Nota de crédito" />
        <LeyendaEstado estado="nota_debito" etiqueta="Nota de débito" />
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-[minmax(0,1fr)_88px_minmax(0,1fr)] border-b border-slate-200">
            <EncabezadoLista lado="sistema" cantidad={partidasSistema.length} />
            <div className="flex items-center justify-center bg-slate-100 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Vínculo
            </div>
            <EncabezadoLista lado="banco" cantidad={partidasBanco.length} />
          </div>

          <div
            ref={tableroRef}
            className="relative grid h-[440px] grid-cols-[minmax(0,1fr)_88px_minmax(0,1fr)] lg:h-[520px]"
          >
            <section className="flex min-h-0 min-w-0 flex-col bg-white">
              <EncabezadoCampos />
              <div
                ref={scrollSistemaRef}
                className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2"
                role="region"
                aria-label="Datos del sistema en su orden original"
              >
                {partidasSistema.map((partida) => (
                  <RegistroCompacto
                    key={partida.id}
                    partida={partida}
                    lado="sistema"
                    activa={activo?.partidaId === partida.id}
                    origen={
                      activo?.partidaId === partida.id &&
                      activo.lado === "sistema"
                    }
                    fijada={
                      fijadoActivo?.partidaId === partida.id &&
                      fijadoActivo.lado === "sistema"
                    }
                    registrarRef={(elemento) =>
                      registrarElementoSistema(partida.id, elemento)
                    }
                    onMouseEnter={() =>
                      setHoverActivo(activar(partida.id, "sistema"))
                    }
                    onMouseLeave={() => setHoverActivo(null)}
                    onFocus={() => setFocoActivo(activar(partida.id, "sistema"))}
                    onBlur={() => setFocoActivo(null)}
                    onClick={() => alternarFijado(partida.id, "sistema")}
                  />
                ))}
                {partidasSistema.length === 0 && (
                  <ListaVacia texto="No hay datos del sistema para este filtro." />
                )}
              </div>
            </section>

            <div className="border-x border-slate-200 bg-slate-100/80" />

            <section className="flex min-h-0 min-w-0 flex-col bg-white">
              <EncabezadoCampos />
              <div
                ref={scrollBancoRef}
                className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2"
                role="region"
                aria-label="Datos del banco en el orden original del archivo"
              >
                {partidasBanco.map((partida) => (
                  <RegistroCompacto
                    key={partida.id}
                    partida={partida}
                    lado="banco"
                    activa={activo?.partidaId === partida.id}
                    origen={
                      activo?.partidaId === partida.id && activo.lado === "banco"
                    }
                    fijada={
                      fijadoActivo?.partidaId === partida.id &&
                      fijadoActivo.lado === "banco"
                    }
                    registrarRef={(elemento) =>
                      registrarElementoBanco(partida.id, elemento)
                    }
                    onMouseEnter={() =>
                      setHoverActivo(activar(partida.id, "banco"))
                    }
                    onMouseLeave={() => setHoverActivo(null)}
                    onFocus={() => setFocoActivo(activar(partida.id, "banco"))}
                    onBlur={() => setFocoActivo(null)}
                    onClick={() => alternarFijado(partida.id, "banco")}
                  />
                ))}
                {partidasBanco.length === 0 && (
                  <ListaVacia texto="No hay datos bancarios para este filtro." />
                )}
              </div>
            </section>

            {flecha &&
              activo?.partidaId === flecha.partidaId &&
              activo.lado === flecha.lado && (
              <svg
                className="pointer-events-none absolute inset-0 z-20 h-full w-full"
                viewBox={`0 0 ${flecha.ancho} ${flecha.alto}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <defs>
                  <marker
                    id="punta-flecha-conciliacion"
                    markerWidth="10"
                    markerHeight="10"
                    refX="9"
                    refY="5"
                    orient="auto"
                    markerUnits="strokeWidth"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill={flecha.color} />
                  </marker>
                </defs>
                <path
                  d={`M ${flecha.inicioX} ${flecha.inicioY} C ${flecha.control1X} ${flecha.inicioY}, ${flecha.control2X} ${flecha.finY}, ${flecha.finX} ${flecha.finY}`}
                  fill="none"
                  stroke="white"
                  strokeWidth="7"
                  strokeLinecap="round"
                  opacity="0.9"
                />
                <path
                  d={`M ${flecha.inicioX} ${flecha.inicioY} C ${flecha.control1X} ${flecha.inicioY}, ${flecha.control2X} ${flecha.finY}, ${flecha.finX} ${flecha.finY}`}
                  fill="none"
                  stroke={flecha.color}
                  strokeWidth="3"
                  strokeLinecap="round"
                  markerEnd="url(#punta-flecha-conciliacion)"
                />
              </svg>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}

function EncabezadoLista({
  lado,
  cantidad,
}: {
  lado: LadoComparacion;
  cantidad: number;
}) {
  const Icon = lado === "sistema" ? Database : Landmark;

  return (
    <div
      className={[
        "flex items-center justify-between gap-3 px-4 py-3 text-white",
        lado === "sistema" ? "bg-slate-950" : "bg-[#003331]",
      ].join(" ")}
    >
      <span className="inline-flex items-center gap-2 text-sm font-semibold">
        <Icon className="h-4 w-4" />
        {lado === "sistema" ? "Datos del sistema" : "Datos del banco"}
      </span>
      <span className="bg-white/10 px-2 py-1 text-xs tabular-nums">
        {cantidad}
      </span>
    </div>
  );
}

function EncabezadoCampos() {
  return (
    <div className="grid h-9 shrink-0 grid-cols-[minmax(0,1fr)_92px_124px] items-center border-b border-slate-200 bg-slate-50 px-3 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
      <span>Referencia</span>
      <span>Fecha</span>
      <span className="text-right">Monto</span>
    </div>
  );
}

function RegistroCompacto({
  partida,
  lado,
  activa,
  origen,
  fijada,
  registrarRef,
  onMouseEnter,
  onMouseLeave,
  onFocus,
  onBlur,
  onClick,
}: {
  partida: PartidaConciliacion;
  lado: LadoComparacion;
  activa: boolean;
  origen: boolean;
  fijada: boolean;
  registrarRef: (elemento: HTMLButtonElement | null) => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
  onClick: () => void;
}) {
  const meta = ESTADOS[partida.estado];
  const sistema = lado === "sistema" ? partida.sistema : null;
  const banco = lado === "banco" ? partida.banco : null;
  const referencia = sistema
    ? sistema.bloque !== null && sistema.bloque !== undefined
      ? `Bloque ${sistema.bloque}`
      : sistema.id
    : banco?.referencia || banco?.numero || "Sin referencia";
  const fecha = sistema?.fecha ?? banco?.fecha ?? "";
  const montoCentavos = sistema?.montoCentavos ?? banco?.creditoCentavos ?? 0;
  const estadoVisible =
    partida.estado === "perfecto" ? "Conciliado" : meta.etiqueta;
  const contraparteAccesible =
    partida.sistema && partida.banco
      ? lado === "sistema"
        ? ` Vinculado con el dato bancario ${
            partida.banco.referencia || partida.banco.numero || "sin referencia"
          }, fecha ${formatearFecha(partida.banco.fecha)}.`
        : ` Vinculado con el bloque ${
            partida.sistema.bloque ?? partida.sistema.id
          } del sistema, fecha ${formatearFecha(partida.sistema.fecha)}.`
      : "";

  return (
    <button
      ref={registrarRef}
      type="button"
      aria-pressed={fijada}
      aria-label={`${
        lado === "sistema" ? "Dato del sistema" : "Dato del banco"
      }. Referencia ${referencia}. Fecha ${formatearFecha(
        fecha
      )}. Monto ${formatMoneyCentavos(
        montoCentavos
      )}. Estado: ${estadoVisible}.${contraparteAccesible}`}
      title={`${estadoVisible}: ${meta.explicacion}`}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onFocus={onFocus}
      onBlur={onBlur}
      onClick={onClick}
      className={[
        "relative grid h-16 w-full grid-cols-[minmax(0,1fr)_92px_124px] items-center border border-l-4 border-slate-200 px-3 text-left text-xs transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1",
        meta.fila,
        meta.resaltado,
        activa
          ? `${meta.tarjetaActiva} z-30 shadow-[0_0_22px_rgba(15,23,42,0.18)]`
          : "z-10 hover:brightness-[0.98]",
        origen ? "scale-[1.015]" : "",
      ].join(" ")}
    >
      <span className="min-w-0 truncate pr-2 font-semibold text-slate-900">
        {referencia}
      </span>
      <span className="tabular-nums text-slate-700">
        {formatearFecha(fecha)}
      </span>
      <span className="text-right font-semibold tabular-nums text-slate-950">
        {formatMoneyCentavos(montoCentavos)}
      </span>
    </button>
  );
}

function LeyendaEstado({
  estado,
  etiqueta,
}: {
  estado: EstadoPartidaConciliacion;
  etiqueta: string;
}) {
  const meta = ESTADOS[estado];
  const Icon = meta.Icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 border px-2 py-1 text-[10px] font-semibold ${meta.badge}`}
    >
      <Icon className="h-3 w-3" />
      {etiqueta}
    </span>
  );
}

function ListaVacia({ texto }: { texto: string }) {
  return (
    <div className="flex h-28 items-center justify-center border border-dashed border-slate-300 bg-slate-50 px-4 text-center text-xs text-slate-500">
      {texto}
    </div>
  );
}
