"use client";

import { useState } from "react";
import { Camera, FileUp } from "lucide-react";
import { DocumentoProyecto } from "@/services/documentacionProyectos";
import { subirDocumentoProyecto } from "@/services/documentosProyecto.service";

type Props = {
  documento: DocumentoProyecto;
  onAbrir: (rutaDocumento: string | null) => void;
  onActualizado: () => Promise<void> | void;
};

export default function RequisitoDocumentoCard({
  documento,
  onAbrir,
  onActualizado,
}: Props) {
  const [arrastrando, setArrastrando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);

  const tieneDocumento = Boolean(documento.url_documento);
  const inputPdfId = `input-doc-${documento.id_proyecto}-${documento.id_requisito}`;
  const inputEscanerId = `input-scan-${documento.id_proyecto}-${documento.id_requisito}`;

  async function subirArchivo(archivo: File | undefined) {
    if (!archivo || tieneDocumento) return;

    try {
      setSubiendo(true);

      await subirDocumentoProyecto({
        archivo,
        idProyecto: documento.id_proyecto,
        idRequisito: documento.id_requisito,
      });

      await onActualizado();
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Error subiendo documento."
      );
    } finally {
      setSubiendo(false);
      setArrastrando(false);
    }
  }

  async function convertirImagenAPdf(archivo: File) {
    const [{ default: jsPDF }, dataUrl] = await Promise.all([
      import("jspdf"),
      leerArchivoComoDataUrl(archivo),
    ]);

    const imagen = await cargarImagen(dataUrl);
    const imagenNormalizada = normalizarImagen(imagen);
    const orientacion =
      imagenNormalizada.ancho > imagenNormalizada.alto ? "landscape" : "portrait";
    const pdf = new jsPDF({
      orientation: orientacion,
      unit: "pt",
      format: "a4",
    });

    const anchoPagina = pdf.internal.pageSize.getWidth();
    const altoPagina = pdf.internal.pageSize.getHeight();
    const margen = 24;
    const anchoDisponible = anchoPagina - margen * 2;
    const altoDisponible = altoPagina - margen * 2;
    const escala = Math.min(
      anchoDisponible / imagenNormalizada.ancho,
      altoDisponible / imagenNormalizada.alto
    );
    const anchoImagen = imagenNormalizada.ancho * escala;
    const altoImagen = imagenNormalizada.alto * escala;
    const x = (anchoPagina - anchoImagen) / 2;
    const y = (altoPagina - altoImagen) / 2;

    pdf.addImage(
      imagenNormalizada.dataUrl,
      "JPEG",
      x,
      y,
      anchoImagen,
      altoImagen
    );

    return new File(
      [pdf.output("blob")],
      `ESCANEO_${documento.id_proyecto}_${documento.id_requisito}.pdf`,
      { type: "application/pdf" }
    );
  }

  async function subirEscaneo(archivo: File | undefined) {
    if (!archivo || tieneDocumento) return;

    try {
      setSubiendo(true);
      const pdf = await convertirImagenAPdf(archivo);

      await subirDocumentoProyecto({
        archivo: pdf,
        idProyecto: documento.id_proyecto,
        idRequisito: documento.id_requisito,
      });

      await onActualizado();
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "Error escaneando documento."
      );
    } finally {
      setSubiendo(false);
      setArrastrando(false);
    }
  }

  function manejarClick() {
    if (tieneDocumento) {
      onAbrir(documento.url_documento);
      return;
    }

    const input = document.getElementById(inputPdfId) as HTMLInputElement | null;

    input?.click();
  }

  function abrirEscaner() {
    if (tieneDocumento || subiendo) return;

    const input = document.getElementById(
      inputEscanerId
    ) as HTMLInputElement | null;

    input?.click();
  }

  return (
    <div>
      <input
        id={inputPdfId}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          subirArchivo(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />

      <input
        id={inputEscanerId}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          subirEscaneo(e.target.files?.[0]);
          e.currentTarget.value = "";
        }}
      />

      <button
        type="button"
        disabled={subiendo}
        onClick={manejarClick}
        onDragOver={(e) => {
          if (tieneDocumento) return;
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          if (tieneDocumento) return;
          e.preventDefault();
          subirArchivo(e.dataTransfer.files?.[0]);
        }}
        className={`w-full rounded border p-3 text-left transition ${
          tieneDocumento
            ? "border-green-300 hover:bg-green-50"
            : arrastrando
            ? "border-blue-400 bg-blue-50"
            : "border-red-300 hover:bg-red-50"
        }`}
      >
        <div className="flex items-start gap-2">
          <FileUp className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />

          <div className="min-w-0">
            <div className="font-medium">{documento.nombre_requisito}</div>

            <div
              className={`text-xs ${
                tieneDocumento ? "text-green-600" : "text-red-500"
              }`}
            >
              {subiendo
                ? "Subiendo documento..."
                : tieneDocumento
                ? "Abrir documento"
                : arrastrando
                ? "Suelta el PDF aqui"
                : "Cargar documento"}
            </div>
          </div>
        </div>
      </button>

      {!tieneDocumento && (
        <button
          type="button"
          disabled={subiendo}
          onClick={abrirEscaner}
          title="Escanear con la camara"
          className="mt-2 flex h-9 w-full items-center justify-center gap-2 border border-slate-300 bg-white px-3 text-[12px] font-medium text-slate-700 transition hover:border-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 md:hidden"
        >
          <Camera className="h-4 w-4" aria-hidden="true" />
          Escanear documento
        </button>
      )}
    </div>
  );
}

function leerArchivoComoDataUrl(archivo: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("No se pudo leer la imagen escaneada."));
      }
    };

    reader.onerror = () => reject(new Error("No se pudo leer la imagen."));
    reader.readAsDataURL(archivo);
  });
}

function cargarImagen(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const imagen = new Image();

    imagen.onload = () => resolve(imagen);
    imagen.onerror = () =>
      reject(new Error("No se pudo convertir la imagen escaneada."));
    imagen.src = src;
  });
}

function normalizarImagen(imagen: HTMLImageElement) {
  const maxLado = 1800;
  const escala = Math.min(
    1,
    maxLado / Math.max(imagen.naturalWidth, imagen.naturalHeight)
  );
  const ancho = Math.max(1, Math.round(imagen.naturalWidth * escala));
  const alto = Math.max(1, Math.round(imagen.naturalHeight * escala));
  const canvas = document.createElement("canvas");
  const contexto = canvas.getContext("2d");

  if (!contexto) {
    throw new Error("No se pudo preparar la imagen escaneada.");
  }

  canvas.width = ancho;
  canvas.height = alto;
  contexto.fillStyle = "#ffffff";
  contexto.fillRect(0, 0, ancho, alto);
  contexto.drawImage(imagen, 0, 0, ancho, alto);

  return {
    ancho,
    alto,
    dataUrl: canvas.toDataURL("image/jpeg", 0.9),
  };
}
