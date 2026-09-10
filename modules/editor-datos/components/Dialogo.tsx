"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

export default function Dialogo({ titulo, cerrar, children }: { titulo: string; cerrar: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialogo = ref.current;
    dialogo?.showModal();
    return () => dialogo?.close();
  }, []);
  return <dialog ref={ref} aria-labelledby="titulo-dialogo-editor" onCancel={(event) => { event.preventDefault(); cerrar(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[min(680px,94vw)] overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/40">
    <header className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-4">
      <h2 id="titulo-dialogo-editor" className="text-lg font-semibold">{titulo}</h2>
      <button data-shortcut="297" type="button" onClick={cerrar} aria-label="Cerrar diálogo" className="rounded-lg p-2 hover:bg-slate-100"><X size={18} /></button>
    </header>
    {children}
  </dialog>;
}
