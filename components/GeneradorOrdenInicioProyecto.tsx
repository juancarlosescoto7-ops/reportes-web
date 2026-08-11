"use client";

import { useMemo, useState } from "react";
import { Download, FileText, LoaderCircle, X } from "lucide-react";

type ContextoOrdenInicio = {
  idProyecto: number;
  codigoProyecto: string;
  proyecto: string;
  montoVigente: number;
};

type Props = {
  open: boolean;
  contexto: ContextoOrdenInicio | null;
  onClose: () => void;
};

type Campos = {
  ubicacion: string;
  fuente: string;
  monto: string;
  fecha: string;
  alcalde: string;
  jefeUtm: string;
  contratista: string;
};

const DEPARTAMENTO = "Francisco Morazán";
const MUNICIPIO = "Talanga";

export default function GeneradorOrdenInicioProyecto({
  open,
  contexto,
  onClose,
}: Props) {
  if (!open || !contexto) return null;

  return (
    <GeneradorOrdenInicioContenido
      key={`${contexto.idProyecto}-${contexto.montoVigente}`}
      contexto={contexto}
      onClose={onClose}
    />
  );
}

function GeneradorOrdenInicioContenido({
  contexto,
  onClose,
}: {
  contexto: ContextoOrdenInicio;
  onClose: () => void;
}) {
  const [campos, setCampos] = useState<Campos>(() => ({
    ubicacion: "",
    fuente: "Fondos Municipales",
    monto: contexto.montoVigente.toFixed(2),
    fecha: obtenerFechaLocal(),
    alcalde: "",
    jefeUtm: "",
    contratista: "",
  }));
  const [generando, setGenerando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const montoMostrado = useMemo(() => {
    const value = Number(campos.monto);

    if (!Number.isFinite(value)) return "Monto pendiente";

    return value.toLocaleString("es-HN", {
      style: "currency",
      currency: "HNL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [campos.monto]);

  function actualizarCampo<K extends keyof Campos>(key: K, value: Campos[K]) {
    setCampos((actual) => ({ ...actual, [key]: value }));
  }

  async function generarPdf(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!campos.ubicacion.trim()) {
      setError("Debe ingresar la ubicación del proyecto.");
      return;
    }

    try {
      setGenerando(true);
      const response = await fetch("/api/proyectos/orden-inicio", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          codigoProyecto: contexto.codigoProyecto,
          proyecto: contexto.proyecto,
          departamento: DEPARTAMENTO,
          municipio: MUNICIPIO,
          ubicacion: campos.ubicacion,
          fuente: campos.fuente,
          monto: Number(campos.monto),
          fecha: campos.fecha,
          firmas: {
            alcalde: campos.alcalde,
            jefeUtm: campos.jefeUtm,
            contratista: campos.contratista,
          },
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(
          payload?.error || "No se pudo generar la orden de inicio."
        );
      }

      const archivo = await response.blob();
      const url = URL.createObjectURL(archivo);
      const disposition = response.headers.get("content-disposition") ?? "";
      const nombreServidor = disposition.match(/filename="([^"]+)"/i)?.[1];
      const enlace = document.createElement("a");

      enlace.href = url;
      enlace.download =
        nombreServidor || `orden-de-inicio-${contexto.idProyecto}.pdf`;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "No se pudo generar la orden de inicio."
      );
    } finally {
      setGenerando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/45 p-3 backdrop-blur-sm">
      <form
        onSubmit={generarPdf}
        className="grid max-h-[94vh] w-full max-w-[980px] grid-rows-[auto_1fr_auto] overflow-hidden rounded-xl border border-slate-300 bg-[#eef1f5] shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-300 bg-white px-5 py-4">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Generador documental
            </div>
            <h2 className="mt-1 flex items-center gap-2 text-[17px] font-semibold text-slate-950">
              <FileText className="h-4 w-4 text-[#005f48]" aria-hidden="true" />
              Orden de inicio
            </h2>
            <p className="mt-1 truncate text-[12px] text-slate-500">
              {contexto.proyecto}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={generando}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-slate-300 bg-white text-slate-500 transition hover:border-slate-700 hover:text-slate-900 disabled:opacity-50"
            aria-label="Cerrar"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <main className="min-h-0 overflow-y-auto p-4">
          <div className="grid gap-4 lg:grid-cols-[1fr_310px]">
            <section className="rounded-lg border border-slate-300 bg-white p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <CampoTexto
                  label="Código del proyecto"
                  value={contexto.codigoProyecto}
                  readOnly
                />
                <CampoTexto
                  label="Proyecto"
                  value={contexto.proyecto}
                  readOnly
                />
                <CampoTexto
                  label="Departamento"
                  value={DEPARTAMENTO}
                  readOnly
                />
                <CampoTexto label="Municipio" value={MUNICIPIO} readOnly />
                <CampoTexto
                  label="Ubicación"
                  value={campos.ubicacion}
                  onChange={(value) => actualizarCampo("ubicacion", value)}
                  placeholder="Barrio, aldea o dirección de la obra"
                  required
                />
                <CampoTexto
                  label="Fuente"
                  value={campos.fuente}
                  onChange={(value) => actualizarCampo("fuente", value)}
                  required
                />
                <CampoTexto
                  label="Monto vigente"
                  type="number"
                  min="0"
                  step="0.01"
                  value={campos.monto}
                  onChange={(value) => actualizarCampo("monto", value)}
                  required
                />
                <CampoTexto
                  label="Fecha oficial de inicio"
                  type="date"
                  value={campos.fecha}
                  onChange={(value) => actualizarCampo("fecha", value)}
                  required
                />
              </div>

              <div className="mt-5 border-t border-slate-200 pt-4">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Firmas
                </div>
                <p className="mt-1 text-[12px] text-slate-500">
                  Los nombres son opcionales; el PDF siempre mostrará los cargos y las líneas de firma.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <CampoTexto
                    label="Alcalde"
                    value={campos.alcalde}
                    onChange={(value) => actualizarCampo("alcalde", value)}
                    placeholder="Nombre completo"
                  />
                  <CampoTexto
                    label="Jefe UTM"
                    value={campos.jefeUtm}
                    onChange={(value) => actualizarCampo("jefeUtm", value)}
                    placeholder="Nombre completo"
                  />
                  <CampoTexto
                    label="Contratista"
                    value={campos.contratista}
                    onChange={(value) => actualizarCampo("contratista", value)}
                    placeholder="Nombre completo"
                  />
                </div>
              </div>
            </section>

            <aside className="rounded-lg border border-slate-300 bg-white p-4">
              <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                Resumen del PDF
              </div>
              <div className="mt-3 border-l-2 border-[#005f48] bg-emerald-50/60 px-3 py-3">
                <div className="text-[11px] text-slate-500">Monto del documento</div>
                <div className="mt-1 text-[17px] font-semibold tabular-nums text-slate-950">
                  {montoMostrado}
                </div>
              </div>
              <dl className="mt-4 grid gap-3 text-[12px]">
                <div>
                  <dt className="font-semibold text-slate-500">Código</dt>
                  <dd className="mt-0.5 break-all font-mono text-[11px] text-slate-900">
                    {contexto.codigoProyecto}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Fuente</dt>
                  <dd className="mt-0.5 text-slate-900">
                    {campos.fuente || "Pendiente"}
                  </dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-500">Ubicación</dt>
                  <dd className="mt-0.5 text-slate-900">
                    {campos.ubicacion || "Pendiente de completar"}
                  </dd>
                </div>
              </dl>
              <div className="mt-5 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] leading-4 text-sky-800">
                La descarga no sube el archivo ni cambia el estado del requisito en el expediente.
              </div>
            </aside>
          </div>
        </main>

        <footer className="border-t border-slate-300 bg-white px-4 py-3">
          {error && (
            <div role="alert" className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={generando}
              className="h-9 rounded-md border border-slate-300 bg-white px-4 text-[12px] font-semibold text-slate-700 transition hover:border-slate-600 disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={generando}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-[#005f48] bg-[#005f48] px-4 text-[12px] font-semibold text-white transition hover:bg-[#004b3a] disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
            >
              {generando ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Download className="h-4 w-4" aria-hidden="true" />
              )}
              {generando ? "Generando..." : "Descargar PDF"}
            </button>
          </div>
        </footer>
      </form>
    </div>
  );
}

function CampoTexto({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  readOnly = false,
  required = false,
  min,
  step,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: string;
  readOnly?: boolean;
  required?: boolean;
  min?: string;
  step?: string;
}) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange?.(event.target.value)}
        placeholder={placeholder}
        readOnly={readOnly}
        required={required}
        min={min}
        step={step}
        className={[
          "h-9 w-full rounded-md border px-3 text-[13px] outline-none transition placeholder:text-slate-400",
          readOnly
            ? "cursor-default border-slate-200 bg-slate-100 text-slate-600"
            : "border-slate-300 bg-white text-slate-900 focus:border-[#005f48]",
        ].join(" ")}
      />
    </label>
  );
}

function obtenerFechaLocal() {
  const fecha = new Date();
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
