"use client";

import { useState } from "react";
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

  function manejarClick() {
    if (tieneDocumento) {
      onAbrir(documento.url_documento);
      return;
    }

    const input = document.getElementById(
      `input-doc-${documento.id_proyecto}-${documento.id_requisito}`
    ) as HTMLInputElement | null;

    input?.click();
  }

  return (
    <div>
      <input
        id={`input-doc-${documento.id_proyecto}-${documento.id_requisito}`}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => subirArchivo(e.target.files?.[0])}
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
        className={`w-full p-3 border rounded text-left transition ${
          tieneDocumento
            ? "border-green-300 hover:bg-green-50"
            : arrastrando
            ? "border-blue-400 bg-blue-50"
            : "border-red-300 hover:bg-red-50"
        }`}
      >
        <div className="font-medium">
          {documento.nombre_requisito}
        </div>

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
            ? "Suelta el PDF aquí"
            : "Cargar documento"}
        </div>
      </button>
    </div>
  );
}