"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { eliminarArqueoCompleto } from "@/modules/arqueos/services/arqueos.service";

export type ArqueoParaEliminar = {
  id: string;
  fecha: string | null;
  descripcion: string | null;
};

export default function EliminarArqueoModal({ arqueo, onEliminado, onClose }: {
  arqueo: ArqueoParaEliminar;
  onEliminado: (id: string) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const enviando = useRef(false);
  const [motivo, setMotivo] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState("");
  const valido = motivo.trim().length >= 10 && motivo.trim().length <= 500 && confirmacion.trim() === "ELIMINAR";

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  async function eliminar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!valido || enviando.current) return;
    enviando.current = true;
    setEliminando(true);
    setError("");
    try {
      await eliminarArqueoCompleto({ id: arqueo.id, motivo, confirmacion });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo eliminar el arqueo.");
      enviando.current = false;
      setEliminando(false);
      return;
    }
    onEliminado(arqueo.id);
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="eliminar-arqueo-titulo"
      aria-describedby="eliminar-arqueo-descripcion"
      onCancel={(event) => {
        event.preventDefault();
        if (!enviando.current) onClose();
      }}
      className="fixed inset-0 m-auto max-h-[90vh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-xl border border-slate-200 bg-white p-6 text-slate-900 shadow-xl backdrop:bg-slate-950/50"
    >
      <h2 id="eliminar-arqueo-titulo" className="text-lg font-semibold">Eliminar arqueo completo</h2>
      <p className="mt-2 text-sm font-medium">{arqueo.fecha} · {arqueo.descripcion || "Sin descripción"}</p>
      <p className="mt-1 break-all text-xs text-slate-500">Identificador: {arqueo.id}</p>
      <p id="eliminar-arqueo-descripcion" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
        Se eliminarán definitivamente este arqueo y todos sus depósitos, incluidos los que no aparecen por los filtros del reporte. Esta acción no se puede deshacer. Después podrá registrar el arqueo nuevamente.
      </p>
      <form onSubmit={eliminar} className="mt-4 space-y-4" aria-busy={eliminando}>
        <label className="block text-sm font-medium">
          Motivo de la eliminación
          <textarea value={motivo} onChange={(event) => setMotivo(event.target.value)} required minLength={10} maxLength={500} disabled={eliminando} rows={3} className="mt-1 block w-full rounded-md border border-slate-300 p-2 font-normal" />
          <span className="mt-1 block text-xs font-normal text-slate-500">Entre 10 y 500 caracteres. Quedará registrado en la bitácora.</span>
        </label>
        <label className="block text-sm font-medium">
          Escriba ELIMINAR para confirmar
          <input value={confirmacion} onChange={(event) => setConfirmacion(event.target.value)} autoComplete="off" required disabled={eliminando} className="mt-1 block w-full rounded-md border border-slate-300 p-2 font-normal" />
        </label>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex justify-end gap-3">
          <button data-shortcut="372" type="button" onClick={onClose} disabled={eliminando} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Cancelar</button>
          <button data-shortcut="373" type="submit" disabled={!valido || eliminando} className="inline-flex items-center gap-2 rounded-md bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 disabled:opacity-50">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            {eliminando ? "Eliminando..." : "Eliminar arqueo y depósitos"}
          </button>
        </div>
      </form>
    </dialog>
  );
}
