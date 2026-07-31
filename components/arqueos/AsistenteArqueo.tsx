"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import PasosArqueoIngresos, {
  type PasoArqueoIngresos,
} from "@/components/arqueos/PasosArqueoIngresos";
import VentanaConversionSaft from "@/components/arqueos/VentanaConversionSaft";
import VentanaDepositosArqueo from "@/components/arqueos/VentanaDepositosArqueo";
import VentanaInformeSami from "@/components/arqueos/VentanaInformeSami";
import { obtenerFechaLocal } from "@/components/arqueos/formato-arqueo";
import {
  calcularDiferenciaArqueo,
  convertirRegistrosSaftASami,
  montosCuadran,
  redondearMoneda,
  type CatalogosConversionIngresos,
  type ResultadoConversionIngresos,
} from "@/lib/conversion-ingresos";
import {
  importarReporteRecaudacionSaft,
  type ReporteRecaudacionSaft,
} from "@/lib/importar-recaudacion-saft";
import { imprimirReporteConversionSami } from "@/lib/reporte-conversion-sami";
import {
  crearArqueoCompleto,
  type DepositoArqueoInput,
} from "@/services/arqueos.service";
import { obtenerCatalogosConversorSamiSaft } from "@/services/conversor-sami-saft.service";

type Props = {
  onGuardado?: (idArqueo: string) => void;
};

export default function AsistenteArqueo({ onGuardado }: Props) {
  const [pasoActual, setPasoActual] = useState<PasoArqueoIngresos>(1);
  const [fecha, setFecha] = useState(obtenerFechaLocal());
  const [descripcion, setDescripcion] = useState("");
  const [depositos, setDepositos] = useState<DepositoArqueoInput[]>([]);
  const [catalogos, setCatalogos] =
    useState<CatalogosConversionIngresos | null>(null);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);
  const [errorCatalogos, setErrorCatalogos] = useState("");
  const [reporteSaft, setReporteSaft] =
    useState<ReporteRecaudacionSaft | null>(null);
  const [conversion, setConversion] =
    useState<ResultadoConversionIngresos | null>(null);
  const [procesandoArchivo, setProcesandoArchivo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const inputArchivoRef = useRef<HTMLInputElement>(null);

  const cargarCatalogos = useCallback(async () => {
    try {
      setCargandoCatalogos(true);
      setErrorCatalogos("");
      const resultado = await obtenerCatalogosConversorSamiSaft();
      setCatalogos(resultado);
    } catch (err) {
      setCatalogos(null);
      setErrorCatalogos(
        err instanceof Error
          ? err.message
          : "No se pudieron cargar las equivalencias."
      );
    } finally {
      setCargandoCatalogos(false);
    }
  }, []);

  useEffect(() => {
    void cargarCatalogos();
  }, [cargarCatalogos]);

  const totalDepositos = useMemo(
    () =>
      redondearMoneda(
        depositos.reduce((total, deposito) => total + deposito.monto, 0)
      ),
    [depositos]
  );
  const totalRecaudado = conversion?.totalSaft ?? 0;
  const diferencia = calcularDiferenciaArqueo(
    totalRecaudado,
    totalDepositos
  );
  const conversionDisponible = Boolean(reporteSaft && conversion);
  const arqueoCuadrado =
    conversionDisponible &&
    depositos.length > 0 &&
    montosCuadran(totalRecaudado, totalDepositos);

  function cambiarPaso(paso: PasoArqueoIngresos) {
    if (paso > 1 && !conversionDisponible) {
      setError("Primero debe seleccionar y procesar el archivo Excel de SAFT.");
      return;
    }

    setError("");
    setMensaje("");
    setPasoActual(paso);
  }

  function limpiarArchivo() {
    setReporteSaft(null);
    setConversion(null);
    setDepositos([]);
    setPasoActual(1);
    setError("");

    if (inputArchivoRef.current) {
      inputArchivoRef.current.value = "";
    }
  }

  function reiniciarArqueo() {
    setFecha(obtenerFechaLocal());
    setDescripcion("");
    setDepositos([]);
    setReporteSaft(null);
    setConversion(null);
    setPasoActual(1);
    setError("");
    setMensaje("");

    if (inputArchivoRef.current) {
      inputArchivoRef.current.value = "";
    }

    window.setTimeout(() => {
      document
        .getElementById("inicio-asistente-arqueo")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  async function seleccionarArchivo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      setProcesandoArchivo(true);
      setError("");
      setMensaje("");
      setReporteSaft(null);
      setConversion(null);
      setDepositos([]);

      if (!catalogos) {
        throw new Error(
          errorCatalogos ||
            "Las equivalencias aún no están disponibles. Intente recargarlas."
        );
      }

      const reporte = await importarReporteRecaudacionSaft(file);
      const resultado = convertirRegistrosSaftASami(
        reporte.registros,
        catalogos
      );

      setReporteSaft(reporte);
      setConversion(resultado);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudo procesar el archivo seleccionado."
      );
    } finally {
      setProcesandoArchivo(false);

      if (inputArchivoRef.current) {
        inputArchivoRef.current.value = "";
      }
    }
  }

  function imprimirConversion() {
    if (!reporteSaft || !conversion) {
      setError("Primero debe seleccionar y procesar el archivo Excel de SAFT.");
      return;
    }

    setError("");
    imprimirReporteConversionSami({
      fechaArqueo: fecha,
      descripcionArqueo: descripcion,
      detalles: conversion.detallesSami,
      inconsistencias: conversion.sinEquivalencia,
      totalSami: conversion.totalSami,
      totalSinEquivalencia: conversion.totalSinEquivalencia,
      totalGeneral: conversion.totalSaft,
    });
  }

  function agregarDeposito(deposito: DepositoArqueoInput) {
    setError("");
    setMensaje("");
    setDepositos((prev) => [...prev, deposito]);
  }

  function eliminarDeposito(index: number) {
    setError("");
    setMensaje("");
    setDepositos((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  async function guardarArqueo() {
    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      if (!fecha) {
        setError("La fecha del arqueo es obligatoria.");
        setPasoActual(1);
        return;
      }

      if (!reporteSaft || !conversion) {
        setError("Debe seleccionar y procesar el reporte Excel de SAFT.");
        setPasoActual(1);
        return;
      }

      if (depositos.length === 0) {
        setError("Debe agregar al menos un depósito bancario.");
        return;
      }

      if (!arqueoCuadrado) {
        setError(
          "El total de los depósitos debe ser exactamente igual al total del informe."
        );
        return;
      }

      const idArqueo = await crearArqueoCompleto({
        fecha,
        descripcion,
        // Incluye lo convertido y los rubros destinados a registro manual.
        total_conversion: conversion.totalSaft,
        depositos,
      });

      if (!idArqueo) {
        setError("No se recibió el identificador del arqueo.");
        return;
      }

      reiniciarArqueo();
      setMensaje(
        `Arqueo registrado: ${idArqueo}. El formulario está listo para iniciar un nuevo arqueo.`
      );
      onGuardado?.(idArqueo);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo registrar el arqueo."
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <section
      id="inicio-asistente-arqueo"
      className="border border-slate-200 bg-white shadow-sm"
    >
      <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
            Asistente de arqueo de ingresos
          </div>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            Nuevo arqueo
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
            Siga los tres pasos en orden. El sistema le indicará qué debe hacer
            en cada ventana.
          </p>
        </div>

      </header>

      <PasosArqueoIngresos
        pasoActual={pasoActual}
        conversionDisponible={conversionDisponible}
        arqueoCuadrado={arqueoCuadrado}
        onCambiarPaso={cambiarPaso}
      />

      {error && (
        <div
          className="mx-5 mt-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          role="alert"
        >
          {error}
        </div>
      )}

      {mensaje && (
        <div
          className="mx-5 mt-5 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
          role="status"
        >
          {mensaje}
        </div>
      )}

      {pasoActual === 1 && (
        <VentanaConversionSaft
          fecha={fecha}
          descripcion={descripcion}
          cargandoCatalogos={cargandoCatalogos}
          errorCatalogos={errorCatalogos}
          catalogosDisponibles={Boolean(catalogos)}
          procesandoArchivo={procesandoArchivo}
          reporte={reporteSaft}
          conversion={conversion}
          inputArchivoRef={inputArchivoRef}
          onCambiarFecha={setFecha}
          onCambiarDescripcion={setDescripcion}
          onSeleccionarArchivo={seleccionarArchivo}
          onLimpiarArchivo={limpiarArchivo}
          onRecargarCatalogos={() => void cargarCatalogos()}
          onContinuar={() => cambiarPaso(2)}
        />
      )}

      {pasoActual === 2 && reporteSaft && conversion && (
        <VentanaInformeSami
          conversion={conversion}
          onAnterior={() => cambiarPaso(1)}
          onImprimir={imprimirConversion}
          onContinuar={() => cambiarPaso(3)}
        />
      )}

      {pasoActual === 3 && reporteSaft && conversion && (
        <VentanaDepositosArqueo
          depositos={depositos}
          totalRecaudado={conversion.totalSaft}
          totalConvertidoSami={conversion.totalSami}
          totalRegistroManual={conversion.totalSinEquivalencia}
          totalDepositos={totalDepositos}
          diferencia={diferencia}
          arqueoCuadrado={arqueoCuadrado}
          guardando={guardando}
          onAgregar={agregarDeposito}
          onEliminar={eliminarDeposito}
          onMostrarError={setError}
          onAnterior={() => cambiarPaso(2)}
          onGuardar={() => void guardarArqueo()}
        />
      )}
    </section>
  );
}
