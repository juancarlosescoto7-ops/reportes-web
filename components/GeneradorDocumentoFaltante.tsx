"use client";

import { useMemo, useState } from "react";

export type DocumentoGeneradorContext = {
  documentoId: string;
  nombreDocumento: string;
  observacion: string | null;
  noOrden: number;
  ordenLabel?: string | null;
  descripcionOrden?: string | null;
  fechaOrden?: string | null;
  totalEgreso?: number | null;
};

type GeneradorDocumentoFaltanteProps = {
  open: boolean;
  contexto: DocumentoGeneradorContext | null;
  onClose: () => void;
};

type CamposDocumento = {
  fechaDocumento: string;
  dirigidoA: string;
  firmadoPor: string;
  informacionAdicional: string;
  membreteSrc: string;
};

const MEMBRETE_DEFAULT = "/membrete.svg";

export default function GeneradorDocumentoFaltante({
  open,
  contexto,
  onClose,
}: GeneradorDocumentoFaltanteProps) {
  if (!open || !contexto) return null;

  return (
    <GeneradorDocumentoFaltanteContenido
      key={contexto.documentoId}
      contexto={contexto}
      onClose={onClose}
    />
  );
}

function GeneradorDocumentoFaltanteContenido({
  contexto,
  onClose,
}: {
  contexto: DocumentoGeneradorContext;
  onClose: () => void;
}) {
  const camposIniciales = crearCamposIniciales();
  const [campos, setCampos] = useState<CamposDocumento>(camposIniciales);
  const [textoEditable, setTextoEditable] = useState(() =>
    generarTextoDocumento(contexto, camposIniciales)
  );
  const [generando, setGenerando] = useState(false);
  const [errorIA, setErrorIA] = useState<string | null>(null);

  const ordenMostrada = useMemo(() => {
    const value = contexto.ordenLabel ?? contexto.noOrden ?? "";
    return String(value).replace(/#/g, "").trim();
  }, [contexto]);

  function actualizarCampo<K extends keyof CamposDocumento>(
    key: K,
    value: CamposDocumento[K]
  ) {
    setCampos((prev) => ({ ...prev, [key]: value }));
  }

  async function generarTexto() {
    setGenerando(true);
    setErrorIA(null);

    try {
      const response = await fetch("/api/generar-documento-faltante", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          documento: {
            nombreDocumento: contexto.nombreDocumento,
            observacion: contexto.observacion,
            noOrden: contexto.noOrden,
            ordenLabel: contexto.ordenLabel,
            descripcionOrden: contexto.descripcionOrden,
            fechaOrden: contexto.fechaOrden,
            totalEgreso: contexto.totalEgreso,
          },
          respuestas: {
            fechaDocumento: campos.fechaDocumento,
            dirigidoA: campos.dirigidoA,
            firmadoPor: campos.firmadoPor,
            informacionAdicional: campos.informacionAdicional,
          },
        }),
      });

      const result = await response.json();

      if (!response.ok || !result?.texto) {
        setErrorIA(
          result?.error ??
            "No se pudo generar con IA. Se uso una plantilla local editable."
        );
        setTextoEditable(generarTextoDocumento(contexto, campos));
        return;
      }

      setTextoEditable(String(result.texto));
    } catch (error) {
      console.error(error);
      setErrorIA(
        "No se pudo conectar con la IA. Se uso una plantilla local editable."
      );
      setTextoEditable(generarTextoDocumento(contexto, campos));
    } finally {
      setGenerando(false);
    }
  }

  function imprimirDocumento() {
    if (!contexto) return;

    const printWindow = window.open("", "_blank", "width=900,height=1100");
    if (!printWindow) return;

    printWindow.document.write(crearHtmlImpresion({
      membreteSrc: campos.membreteSrc,
      texto: textoEditable,
      titulo: `${contexto.nombreDocumento} - Orden ${ordenMostrada}`,
    }));
    printWindow.document.close();
    printWindow.focus();

    window.setTimeout(() => {
      printWindow.print();
    }, 250);
  }

  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-slate-950/40 px-3 py-4 backdrop-blur-sm">
      <div className="grid h-[94vh] w-full max-w-[1280px] grid-rows-[auto_1fr_auto] border border-slate-300 bg-[#eef1f5] shadow-2xl">
        <header className="grid grid-cols-[1fr_auto] border-b border-slate-300 bg-white px-4 py-3">
          <div className="min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
              Generador documental
            </div>

            <h2 className="mt-1 truncate text-[16px] font-semibold text-slate-950">
              {contexto.nombreDocumento}
            </h2>

            <div className="mt-1 text-[12px] text-slate-500">
              Orden de pago {ordenMostrada || "-"}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 border border-slate-300 bg-white text-[18px] leading-none text-slate-600 transition hover:border-slate-700 hover:bg-slate-100"
            title="Cerrar"
          >
            x
          </button>
        </header>

        <main className="min-h-0 overflow-y-auto p-3">
          <div className="grid min-h-full grid-cols-1 gap-3 xl:grid-cols-[360px_1fr]">
            <aside className="border border-slate-300 bg-white">
              <div className="border-b border-slate-200 px-4 py-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Preguntas
                </div>

                <div className="mt-1 text-[13px] text-slate-600">
                  Completa los datos y genera el texto editable.
                </div>
              </div>

              <div className="grid gap-3 p-4">
                <CampoTexto
                  label="Fecha de documento"
                  type="date"
                  value={campos.fechaDocumento}
                  onChange={(value) => actualizarCampo("fechaDocumento", value)}
                />

                <CampoTexto
                  label="Dirigido a quien"
                  value={campos.dirigidoA}
                  placeholder="Ej. Tesoreria Municipal"
                  onChange={(value) => actualizarCampo("dirigidoA", value)}
                />

                <CampoTexto
                  label="Firmado por quien"
                  value={campos.firmadoPor}
                  placeholder="Nombre y cargo"
                  onChange={(value) => actualizarCampo("firmadoPor", value)}
                />

                <div>
                  <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Otra informacion relevante
                  </label>

                  <textarea
                    value={campos.informacionAdicional}
                    onChange={(event) =>
                      actualizarCampo("informacionAdicional", event.target.value)
                    }
                    placeholder="Detalle adicional para incluir en el documento."
                    className="min-h-[92px] w-full resize-none border border-slate-300 bg-white px-3 py-2 text-[13px] leading-5 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-700"
                  />
                </div>

                <CampoTexto
                  label="Membrete en public"
                  value={campos.membreteSrc}
                  placeholder="/membrete.png"
                  onChange={(value) => actualizarCampo("membreteSrc", value)}
                />

                <button
                  type="button"
                  onClick={generarTexto}
                  disabled={generando}
                  className="h-9 border border-slate-900 bg-slate-950 px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-slate-800"
                >
                  {generando ? "Generando..." : "Generar con IA"}
                </button>

                {errorIA && (
                  <div className="border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-800">
                    {errorIA}
                  </div>
                )}
              </div>
            </aside>

            <section className="grid min-h-[620px] grid-rows-[auto_1fr] border border-slate-300 bg-white">
              <div className="grid grid-cols-1 gap-2 border-b border-slate-200 px-4 py-3 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Documento editable
                  </div>

                  <div className="text-[13px] text-slate-600">
                    Edita el contenido antes de imprimir.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={imprimirDocumento}
                  className="h-8 border border-emerald-700 bg-emerald-700 px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-white transition hover:bg-emerald-800"
                >
                  Imprimir
                </button>
              </div>

              <div className="grid min-h-0 grid-cols-1 gap-3 overflow-auto bg-slate-100 p-3 2xl:grid-cols-[minmax(360px,1fr)_auto]">
                <div className="grid min-h-[520px]">
                  <textarea
                    value={textoEditable}
                    onChange={(event) => setTextoEditable(event.target.value)}
                    className="h-full min-h-[520px] w-full resize-none border border-slate-300 bg-white px-4 py-4 font-serif text-[14px] leading-7 text-slate-900 outline-none focus:border-slate-700"
                  />
                </div>

                <article className="mx-auto min-h-[11in] w-[8.5in] max-w-full bg-white p-[0.65in] text-slate-950 shadow-lg">
                  {campos.membreteSrc && (
                    <img
                      src={campos.membreteSrc}
                      alt="Membrete"
                      className="mb-8 block max-h-[1.35in] w-full object-contain object-top"
                    />
                  )}

                  <div className="whitespace-pre-wrap break-words font-serif text-[13pt] leading-8">
                    {textoEditable}
                  </div>
                </article>
              </div>
            </section>
          </div>
        </main>

        <footer className="flex items-center justify-end border-t border-slate-300 bg-white px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="h-8 border border-slate-300 bg-white px-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-700 transition hover:border-slate-700 hover:bg-slate-100"
          >
            Cerrar
          </button>
        </footer>
      </div>
    </div>
  );
}

function crearCamposIniciales(): CamposDocumento {
  return {
    fechaDocumento: obtenerFechaLocal(),
    dirigidoA: "",
    firmadoPor: "",
    informacionAdicional: "",
    membreteSrc: MEMBRETE_DEFAULT,
  };
}

function CampoTexto({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
        {label}
      </label>

      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-9 w-full border border-slate-300 bg-white px-3 text-[13px] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-slate-700"
      />
    </div>
  );
}

function generarTextoDocumento(
  contexto: DocumentoGeneradorContext,
  campos: CamposDocumento
) {
  const fecha = formatearFechaDocumento(campos.fechaDocumento);
  const dirigido = campos.dirigidoA.trim() || "[Dirigido a quien]";
  const firmante = campos.firmadoPor.trim() || "[Firmado por quien]";
  const descripcion = contexto.descripcionOrden?.trim();
  const observacion = contexto.observacion?.trim();
  const adicional = campos.informacionAdicional.trim();
  const concepto = extraerConceptoDocumento(descripcion);

  return [
    fecha,
    "",
    dirigido,
    "Presente.",
    "",
    `Asunto: ${contexto.nombreDocumento}`,
    "",
    `Tipo de documento: ${contexto.nombreDocumento}`,
    concepto ? `Informacion base de la orden: ${concepto}.` : null,
    observacion ? `Observacion registrada: ${observacion}.` : null,
    adicional ? `Informacion adicional del usuario: ${adicional}.` : null,
    "",
    "[Redactar aqui el contenido final del documento conforme al tipo indicado.]",
    "",
    "Firma:",
    "",
    "__________________________________",
    firmante,
  ]
    .filter((line): line is string => line !== null)
    .join("\n");
}

function extraerConceptoDocumento(descripcion: string | undefined) {
  if (!descripcion) return "";

  const partes = descripcion
    .split("|")
    .map((parte) => parte.trim())
    .filter(Boolean)
    .filter((parte) => {
      const normalizada = parte.toLowerCase();
      return (
        !normalizada.startsWith("orden de pago") &&
        !normalizada.startsWith("cheque") &&
        !normalizada.startsWith("con orden")
      );
    });

  const concepto = partes[0] ?? descripcion;

  return concepto
    .replace(/^compra\s+de\s+/i, "la elaboracion de ")
    .replace(/^compra\s+/i, "la compra de ");
}

function crearHtmlImpresion({
  membreteSrc,
  texto,
  titulo,
}: {
  membreteSrc: string;
  texto: string;
  titulo: string;
}) {
  return `<!doctype html>
<html>
  <head>
    <title>${escapeHtml(titulo)}</title>
    <style>
      @page { size: letter; margin: 0; }
      body { margin: 0; background: #fff; color: #0f172a; }
      .page {
        box-sizing: border-box;
        width: 8.5in;
        min-height: 11in;
        padding: 0.65in;
        font-family: "Times New Roman", serif;
        font-size: 13pt;
        line-height: 1.55;
      }
      img {
        display: block;
        width: 100%;
        max-height: 1.35in;
        object-fit: contain;
        object-position: top;
        margin-bottom: 0.45in;
      }
      .text { white-space: pre-wrap; overflow-wrap: anywhere; }
    </style>
  </head>
  <body>
    <main class="page">
      ${
        membreteSrc
          ? `<img src="${escapeAttribute(membreteSrc)}" alt="Membrete" />`
          : ""
      }
      <div class="text">${escapeHtml(texto)}</div>
    </main>
  </body>
</html>`;
}

function obtenerFechaLocal() {
  const fecha = new Date();
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatearFechaDocumento(value: string) {
  if (!value) return "[Fecha de documento]";

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) return value;

  return new Date(year, month - 1, day).toLocaleDateString("es-HN", {
    year: "numeric",
    month: "long",
    day: "2-digit",
  });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}
