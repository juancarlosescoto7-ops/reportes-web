"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import type { ProcesarPagoMultipleCXPResponse } from "@/modules/cuentas-por-pagar/services/cxp";
import {
  obtenerAsignacionesEjecucionOrden,
  type AsignacionEjecucionPresupuestaria,
} from "@/modules/presupuesto/services/ejecucionesPresupuestarias";
import type { OpcionPresupuestoSesion } from "@/modules/cuentas-por-pagar/domain/recomendaciones-presupuesto-sesion";

export type ConfirmacionPagoCxpDatos = {
  resultado: ProcesarPagoMultipleCXPResponse;
  fecha: string;
  cuenta: string;
  descripcion: string;
  pagos: Array<{
    noCxp: number;
    tipoMovimiento: string | null;
    beneficiario: string;
    descripcion: string;
    cheque: number;
    monto: number;
    saldoPendiente: number | null;
  }>;
};

function formatMoney(value: number) {
  return value.toLocaleString("es-HN", {
    style: "currency",
    currency: "HNL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export default function ConfirmacionPagoCxp({
  datos,
  opcionesPresupuesto,
  onClose,
}: {
  datos: ConfirmacionPagoCxpDatos;
  opcionesPresupuesto: OpcionPresupuestoSesion[];
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const tituloId = useId();
  const descripcionId = useId();
  const { resultado, pagos } = datos;
  const total = resultado.total_pago ?? pagos.reduce((sum, pago) => sum + pago.monto, 0);
  const hayAbonos = pagos.some((pago) => (pago.saldoPendiente ?? 0) > 0);
  const [anio, mes, dia] = datos.fecha.split("-");

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={tituloId}
      aria-describedby={descripcionId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50"
    >
      <header className="flex items-start gap-3 border-b border-emerald-100 bg-emerald-50 p-5 sm:p-6">
        <CheckCircle2 className="mt-1 h-7 w-7 shrink-0 text-emerald-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">Pago registrado correctamente</p>
          <h2 id={tituloId} className="mt-1 text-xl font-semibold">
            {resultado.no_orden != null ? `Orden de pago #${resultado.no_orden}` : "Orden de pago registrada"}
          </h2>
          <p id={descripcionId} className="mt-2 text-sm text-slate-700">
            {hayAbonos
              ? "Se registraron los pagos de las cuentas por pagar en esta orden. Las cuentas con abonos conservan el saldo pendiente indicado."
              : pagos.length === 1
                ? "Ya se pagó la cuenta por pagar. Quedó registrada en esta orden de pago con los siguientes datos."
                : "Ya se pagaron las cuentas por pagar. Quedaron registradas en esta orden de pago con los siguientes datos."}
          </p>
        </div>
        <button type="button" onClick={onClose} aria-label="Cerrar confirmación de pago" className="rounded-lg p-2 text-slate-500 hover:bg-white hover:text-slate-900">
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      <div className="space-y-6 p-5 sm:p-6">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div><dt className="text-xs text-slate-500">Fecha de pago</dt><dd className="mt-1 font-medium">{dia && mes && anio ? `${dia}/${mes}/${anio}` : datos.fecha}</dd></div>
          <div><dt className="text-xs text-slate-500">Cuenta</dt><dd className="mt-1 break-words font-medium">{datos.cuenta}</dd></div>
          <div><dt className="text-xs text-slate-500">Cuentas por pagar</dt><dd className="mt-1 font-medium">{resultado.total_cxps ?? pagos.length}</dd></div>
          <div><dt className="text-xs text-slate-500">Total pagado</dt><dd className="mt-1 font-semibold tabular-nums text-emerald-700">{formatMoney(total)}</dd></div>
        </dl>

        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Descripción de la orden</h3>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">{resultado.descripcion ?? datos.descripcion}</p>
        </section>

        <section>
          <h3 className="mb-3 text-sm font-semibold">Cuentas incluidas en esta orden</h3>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th scope="col" className="px-4 py-3">Cuenta por pagar</th>
                  <th scope="col" className="px-4 py-3">Beneficiario</th>
                  <th scope="col" className="px-4 py-3">Cheque</th>
                  <th scope="col" className="px-4 py-3 text-right">Monto pagado</th>
                  <th scope="col" className="px-4 py-3 text-right">Saldo pendiente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pagos.map((pago) => (
                  <tr key={`${pago.noCxp}:${pago.tipoMovimiento ?? ""}`}>
                    <td className="px-4 py-3">
                      <span className="font-medium">#{pago.noCxp}</span>
                      {pago.tipoMovimiento && <span className="ml-2 text-xs text-slate-500">{pago.tipoMovimiento}</span>}
                      <p className="mt-1 max-w-xs whitespace-pre-wrap break-words text-xs text-slate-500">{pago.descripcion}</p>
                    </td>
                    <td className="px-4 py-3">{pago.beneficiario}</td>
                    <td className="px-4 py-3 tabular-nums">{pago.cheque}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">{formatMoney(pago.monto)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
                      {pago.saldoPendiente === null ? "No disponible" : pago.saldoPendiente > 0 ? formatMoney(pago.saldoPendiente) : <span className="font-medium text-emerald-700">Saldada</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {resultado.no_orden != null ? (
          <RenglonesPresupuestariosOrden
            key={resultado.no_orden}
            ordenPagoId={resultado.no_orden}
            opcionesPresupuesto={opcionesPresupuesto}
          />
        ) : (
          <p className="text-sm text-amber-800">
            El pago quedó registrado, pero no se recibió el número de orden para consultar sus renglones presupuestarios.
          </p>
        )}
      </div>

      <footer className="flex flex-wrap justify-end gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-6">
        {resultado.no_orden != null && (
          <Link href={`/reportes/ordenes-de-pago?orden=${encodeURIComponent(resultado.no_orden)}`} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-100">
            Ver en egresos
          </Link>
        )}
        <button type="button" onClick={onClose} className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">Entendido</button>
      </footer>
    </dialog>
  );
}

type EstadoRenglones =
  | { estado: "cargando" }
  | { estado: "error" }
  | { estado: "listo"; asignaciones: AsignacionEjecucionPresupuestaria[] };

function RenglonesPresupuestariosOrden({
  ordenPagoId,
  opcionesPresupuesto,
}: {
  ordenPagoId: number;
  opcionesPresupuesto: OpcionPresupuestoSesion[];
}) {
  const [consulta, setConsulta] = useState<EstadoRenglones>({ estado: "cargando" });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;

    obtenerAsignacionesEjecucionOrden(ordenPagoId)
      .then((asignaciones) => {
        if (!Array.isArray(asignaciones)) throw new Error("Respuesta de asignaciones inválida.");
        if (vigente) setConsulta({ estado: "listo", asignaciones });
      })
      .catch(() => {
        if (vigente) setConsulta({ estado: "error" });
      });

    return () => { vigente = false; };
  }, [ordenPagoId, intento]);

  return (
    <section aria-busy={consulta.estado === "cargando"}>
      <h3 className="mb-3 text-sm font-semibold">Renglones presupuestarios registrados en la orden</h3>
      {consulta.estado === "cargando" ? (
        <p role="status" className="text-sm text-slate-500">Cargando renglones presupuestarios…</p>
      ) : consulta.estado === "error" ? (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p>El pago quedó registrado. No se pudieron cargar los renglones presupuestarios de esta orden.</p>
          <button
            type="button"
            className="mt-3 rounded-lg border border-amber-300 bg-white px-3 py-2 font-medium hover:bg-amber-100"
            onClick={() => {
              setConsulta({ estado: "cargando" });
              setIntento((actual) => actual + 1);
            }}
          >
            Reintentar carga de renglones
          </button>
        </div>
      ) : consulta.asignaciones.length === 0 ? (
        <p className="text-sm text-slate-500">No se encontraron renglones presupuestarios registrados en esta orden.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full min-w-[650px] text-left text-sm">
            <thead className="bg-slate-50 text-xs text-slate-600">
              <tr>
                <th scope="col" className="px-4 py-3">Renglón presupuestario</th>
                <th scope="col" className="px-4 py-3">Actividad</th>
                <th scope="col" className="px-4 py-3">Proyecto</th>
                <th scope="col" className="px-4 py-3">Ejercicio fiscal</th>
                <th scope="col" className="px-4 py-3 text-right">Monto ejecutado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {consulta.asignaciones.map((asignacion, indice) => {
                const opcion = opcionesPresupuesto.find((item) =>
                  item.codigoPresupuestario === asignacion.codigo_presupuestario &&
                  (item.actividadId ?? "") === (asignacion.actividad_id ?? "") &&
                  (item.proyectoId ?? "") === (asignacion.proyecto_id ?? "") &&
                  (asignacion.ejercicio_fiscal == null || item.ejercicioFiscal === asignacion.ejercicio_fiscal)
                );

                return (
                  <tr key={asignacion.id ?? `${asignacion.codigo_presupuestario}:${indice}`}>
                    <td className="px-4 py-3">
                      <span className="font-medium">{asignacion.codigo_presupuestario}</span>
                      {opcion?.descripcionObjeto && <p className="mt-1 text-xs text-slate-500">{opcion.descripcionObjeto}</p>}
                    </td>
                    <td className="px-4 py-3">{opcion?.actividad || asignacion.actividad_id || "No aplica"}</td>
                    <td className="px-4 py-3">{opcion?.proyecto || asignacion.proyecto_id || "No aplica"}</td>
                    <td className="px-4 py-3 tabular-nums">{asignacion.ejercicio_fiscal ?? "No disponible"}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-right font-medium tabular-nums">{formatMoney(Number(asignacion.monto_ejecutado))}</td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot className="border-t border-slate-200 bg-slate-50 font-semibold">
              <tr>
                <th scope="row" colSpan={4} className="px-4 py-3">Total ejecutado en esta orden</th>
                <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums text-emerald-700">
                  {formatMoney(consulta.asignaciones.reduce((total, asignacion) => total + Number(asignacion.monto_ejecutado), 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
