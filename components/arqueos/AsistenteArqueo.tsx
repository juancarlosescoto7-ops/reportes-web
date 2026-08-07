"use client";

import { useMemo, useState } from "react";
import VentanaDepositosArqueo from "@/components/arqueos/VentanaDepositosArqueo";
import {
  obtenerFechaLocal,
  redondearMoneda,
} from "@/components/arqueos/formato-arqueo";
import {
  crearArqueoCompleto,
  type DepositoArqueoInput,
} from "@/services/arqueos.service";

type Props = {
  onGuardado?: (idArqueo: string) => void;
};

export default function AsistenteArqueo({ onGuardado }: Props) {
  const [fecha, setFecha] = useState(obtenerFechaLocal());
  const [descripcion, setDescripcion] = useState("");
  const [depositos, setDepositos] = useState<DepositoArqueoInput[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const totalDepositos = useMemo(
    () =>
      redondearMoneda(
        depositos.reduce((total, deposito) => total + deposito.monto, 0)
      ),
    [depositos]
  );

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

  function reiniciarArqueo() {
    setFecha(obtenerFechaLocal());
    setDescripcion("");
    setDepositos([]);
    setError("");
  }

  async function guardarArqueo() {
    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      if (!fecha) {
        setError("La fecha del arqueo es obligatoria.");
        return;
      }

      if (depositos.length === 0) {
        setError("Debe agregar al menos un depósito bancario.");
        return;
      }

      const idArqueo = await crearArqueoCompleto({
        fecha,
        descripcion,
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
      <header className="border-b border-slate-200 px-5 py-4">
        <div className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
          Registro de arqueo de ingresos
        </div>
        <h2 className="mt-1 text-xl font-semibold text-slate-950">
          Nuevo arqueo
        </h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
          Ingrese los datos generales del arqueo y agregue sus depósitos
          bancarios.
        </p>
      </header>

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

      <div className="grid gap-4 border-b border-slate-200 p-5 lg:grid-cols-[190px_1fr]">
        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Fecha del arqueo
          </label>
          <input
            type="date"
            value={fecha}
            onChange={(event) => setFecha(event.target.value)}
            className="h-11 w-full border border-slate-200 bg-white px-3 text-base outline-none focus:border-emerald-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-slate-700">
            Descripción del arqueo
          </label>
          <input
            value={descripcion}
            onChange={(event) => setDescripcion(event.target.value)}
            placeholder="Detalle general del arqueo"
            className="h-11 w-full border border-slate-200 bg-white px-3 text-base outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      <VentanaDepositosArqueo
        depositos={depositos}
        totalDepositos={totalDepositos}
        guardando={guardando}
        onAgregar={agregarDeposito}
        onEliminar={eliminarDeposito}
        onMostrarError={setError}
        onGuardar={() => void guardarArqueo()}
      />
    </section>
  );
}
