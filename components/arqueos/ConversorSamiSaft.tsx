"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { FileSpreadsheet, Link2, LoaderCircle } from "lucide-react";

import GestorEquivalenciasSaftSami from "@/components/arqueos/GestorEquivalenciasSaftSami";
import VentanaConversionSaft from "@/components/arqueos/VentanaConversionSaft";
import VentanaInformeSami from "@/components/arqueos/VentanaInformeSami";
import { obtenerFechaLocal } from "@/components/arqueos/formato-arqueo";
import {
  convertirRegistrosSaftASami,
  type CatalogosConversionIngresos,
  type ResultadoConversionIngresos,
} from "@/lib/conversion-ingresos";
import {
  importarReporteRecaudacionSaft,
  type ReporteRecaudacionSaft,
} from "@/lib/importar-recaudacion-saft";
import { imprimirReporteConversionSami } from "@/lib/reporte-conversion-sami";
import { obtenerCatalogosConversorSamiSaft } from "@/services/conversor-sami-saft.service";

type SeleccionEquivalencia = {
  codigo: string;
  descripcion: string;
};

export default function ConversorSamiSaft() {
  const [seccionActiva, setSeccionActiva] =
    useState<"conversor" | "gestor">("conversor");
  const [mostrandoInforme, setMostrandoInforme] = useState(false);
  const [fecha, setFecha] = useState(obtenerFechaLocal());
  const [descripcion, setDescripcion] = useState("");
  const [catalogos, setCatalogos] =
    useState<CatalogosConversionIngresos | null>(null);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(true);
  const [errorCatalogos, setErrorCatalogos] = useState("");
  const [reporteSaft, setReporteSaft] =
    useState<ReporteRecaudacionSaft | null>(null);
  const [conversion, setConversion] =
    useState<ResultadoConversionIngresos | null>(null);
  const [procesandoArchivo, setProcesandoArchivo] = useState(false);
  const [error, setError] = useState("");
  const [seleccionEquivalencia, setSeleccionEquivalencia] =
    useState<SeleccionEquivalencia | null>(null);
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

  async function seleccionarArchivo(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      setProcesandoArchivo(true);
      setError("");
      setReporteSaft(null);
      setConversion(null);
      setMostrandoInforme(false);

      if (!catalogos) {
        throw new Error(
          errorCatalogos ||
            "Las equivalencias aún no están disponibles. Intente recargarlas."
        );
      }

      const reporte = await importarReporteRecaudacionSaft(file);
      setReporteSaft(reporte);
      setConversion(
        convertirRegistrosSaftASami(reporte.registros, catalogos)
      );
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

  function limpiarArchivo() {
    setReporteSaft(null);
    setConversion(null);
    setMostrandoInforme(false);
    setError("");

    if (inputArchivoRef.current) {
      inputArchivoRef.current.value = "";
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
      descripcionArqueo: descripcion || "Conversión independiente SAFT–SAMI",
      detalles: conversion.detallesSami,
      inconsistencias: conversion.sinEquivalencia,
      totalSami: conversion.totalSami,
      totalSinEquivalencia: conversion.totalSinEquivalencia,
      totalGeneral: conversion.totalSaft,
    });
  }

  function solicitarEquivalencia(codigo: string, descripcionSaft: string) {
    setSeleccionEquivalencia({ codigo, descripcion: descripcionSaft });
    setSeccionActiva("gestor");
    window.setTimeout(() => {
      document
        .getElementById("modulo-conversor-interno")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }

  function actualizarCatalogos(
    catalogosActualizados: CatalogosConversionIngresos
  ) {
    setCatalogos(catalogosActualizados);
    setSeleccionEquivalencia(null);

    if (reporteSaft) {
      setConversion(
        convertirRegistrosSaftASami(
          reporteSaft.registros,
          catalogosActualizados
        )
      );
    }
  }

  return (
    <div id="modulo-conversor-interno" className="space-y-4">
      <nav
        className="grid border border-slate-200 bg-white shadow-sm sm:grid-cols-2"
        aria-label="Secciones del módulo Conversor SAFT–SAMI"
      >
        <button
          type="button"
          onClick={() => setSeccionActiva("conversor")}
          aria-current={seccionActiva === "conversor" ? "page" : undefined}
          className={[
            "flex min-h-20 items-center gap-3 border-b px-5 py-4 text-left transition sm:border-b-0 sm:border-r",
            seccionActiva === "conversor"
              ? "border-emerald-700 bg-emerald-50 text-emerald-950"
              : "border-slate-200 text-slate-600 hover:bg-slate-50",
          ].join(" ")}
        >
          <span
            className={[
              "grid h-10 w-10 shrink-0 place-items-center",
              seccionActiva === "conversor"
                ? "bg-emerald-700 text-white"
                : "bg-slate-100 text-slate-500",
            ].join(" ")}
          >
            <FileSpreadsheet className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">Conversor</span>
            <span className="mt-1 block text-xs leading-5 opacity-75">
              Convertir e imprimir un archivo sin depósitos
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSeccionActiva("gestor")}
          aria-current={seccionActiva === "gestor" ? "page" : undefined}
          className={[
            "flex min-h-20 items-center gap-3 px-5 py-4 text-left transition",
            seccionActiva === "gestor"
              ? "bg-emerald-50 text-emerald-950"
              : "text-slate-600 hover:bg-slate-50",
          ].join(" ")}
        >
          <span
            className={[
              "grid h-10 w-10 shrink-0 place-items-center",
              seccionActiva === "gestor"
                ? "bg-emerald-700 text-white"
                : "bg-slate-100 text-slate-500",
            ].join(" ")}
          >
            <Link2 className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-sm font-semibold">
              Gestor de equivalencias
              {conversion && conversion.sinEquivalencia.length > 0 && (
                <span className="bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-950">
                  {conversion.sinEquivalencia.length} pendiente(s)
                </span>
              )}
            </span>
            <span className="mt-1 block text-xs leading-5 opacity-75">
              Crear códigos SAFT y vincular cuentas SAMI
            </span>
          </span>
        </button>
      </nav>

      {seccionActiva === "conversor" && (
        <section className="border border-slate-200 bg-white shadow-sm">
        <header className="border-b border-slate-200 px-5 py-4">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
            Herramienta independiente
          </div>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">
            Convertir un reporte sin registrar arqueo
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Cargue el Excel de SAFT, revise el resultado SAMI e imprima el
            informe. Este flujo no solicita depósitos y no guarda ingresos.
          </p>
        </header>

        {error && (
          <div className="mx-5 mt-5 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {error}
          </div>
        )}

        {!mostrandoInforme && (
          <VentanaConversionSaft
            modo="conversor"
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
            onContinuar={() => setMostrandoInforme(true)}
            onSolicitarEquivalencia={solicitarEquivalencia}
          />
        )}

        {mostrandoInforme && reporteSaft && conversion && (
          <VentanaInformeSami
            modo="conversor"
            conversion={conversion}
            onAnterior={() => setMostrandoInforme(false)}
            onImprimir={imprimirConversion}
          />
        )}
        </section>
      )}

      {seccionActiva === "gestor" && (
        catalogos ? (
          <GestorEquivalenciasSaftSami
            catalogos={catalogos}
            pendientes={conversion?.sinEquivalencia}
            seleccionSolicitada={seleccionEquivalencia}
            onCatalogosActualizados={actualizarCatalogos}
          />
        ) : (
          <section className="flex min-h-56 items-center justify-center border border-slate-200 bg-white px-5 text-sm text-slate-500 shadow-sm">
            {cargandoCatalogos ? (
              <span className="flex items-center gap-2">
                <LoaderCircle className="h-4 w-4 animate-spin" />
                Cargando catálogos SAFT y SAMI...
              </span>
            ) : (
              <div className="text-center">
                <p>{errorCatalogos || "No se pudieron cargar los catálogos."}</p>
                <button
                  type="button"
                  onClick={() => void cargarCatalogos()}
                  className="mt-3 h-9 border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700"
                >
                  Volver a intentar
                </button>
              </div>
            )}
          </section>
        )
      )}
    </div>
  );
}
