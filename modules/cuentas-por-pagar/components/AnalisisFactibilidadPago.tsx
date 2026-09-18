"use client";

import { useEffect, useState } from "react";
import { analizarFactibilidadPago, type DatosFactibilidadPago, type PagoParaAnalizar } from "@/modules/cuentas-por-pagar/domain/factibilidad-pago";
import { obtenerRecomendacionesCXP } from "@/modules/cuentas-por-pagar/services/cxp";

const dinero = (valor: number) => valor.toLocaleString("es-HN", { style: "currency", currency: "HNL" });
const titulos = {
  factible: "Pago factible",
  insuficiente: "Saldo insuficiente para este pago",
  sin_datos: "No se puede determinar la factibilidad",
  invalido: "Revise los montos a pagar",
};

export default function AnalisisFactibilidadPago({ pagos }: { pagos: PagoParaAnalizar[] }) {
  const [consulta, setConsulta] = useState<
    { estado: "cargando" | "error" } | { estado: "listo"; datos: DatosFactibilidadPago[] }
  >({ estado: "cargando" });
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    let vigente = true;
    obtenerRecomendacionesCXP().then((datos) => {
      if (vigente) setConsulta({ estado: "listo", datos });
    }).catch(() => {
      if (vigente) setConsulta({ estado: "error" });
    });
    return () => { vigente = false; };
  }, [intento]);

  const analisis = consulta.estado === "listo" ? analizarFactibilidadPago(pagos, consulta.datos) : null;
  const tono = analisis?.estado === "factible" ? "border-emerald-200 bg-emerald-50 text-emerald-900"
    : analisis?.estado === "insuficiente" ? "border-rose-200 bg-rose-50 text-rose-900"
    : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <section aria-label="Factibilidad del pago" aria-busy={consulta.estado === "cargando"} className={`border px-3 py-3 text-[12px] ${tono}`}>
      <h3 className="font-semibold">Factibilidad sin descontar compromisos</h3>
      <p className="mt-1 text-[11px]">Se compara el monto ingresado con el saldo actual de los códigos y grupos financieros, considerando únicamente lo ejecutado.</p>
      <div role="status" aria-live="polite" className="mt-3">
        {consulta.estado === "cargando" ? "Consultando saldos actuales…"
          : consulta.estado === "error" ? "No se pudieron consultar los saldos. La factibilidad está pendiente de verificar."
          : analisis && <>
            <p className="font-semibold">{titulos[analisis.estado]}</p>
            <ul className="mt-2 space-y-1">
              {analisis.cuentas.map((cuenta) => (
                <li key={JSON.stringify([cuenta.noCxp, cuenta.tipoMovimiento])}>
                  <strong>CxP {cuenta.noCxp}:</strong> {cuenta.motivo}
                </li>
              ))}
            </ul>
          </>}
      </div>
      {analisis && analisis.recursos.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-[11px]">
            <caption className="mb-2 text-left">Cobertura de los pagos con datos completos</caption>
            <thead><tr><th scope="col" className="pr-2">Código / grupo</th><th scope="col" className="px-2 text-right">Disponible</th><th scope="col" className="px-2 text-right">Pago</th><th scope="col" className="pl-2 text-right">Restante</th></tr></thead>
            <tbody>{analisis.recursos.map((recurso) => (
              <tr key={recurso.clave} className="border-t border-current/10">
                <th scope="row" className="py-2 pr-2 font-medium">{recurso.nombre}</th>
                <td className="px-2 text-right tabular-nums">{dinero(recurso.disponible)}</td>
                <td className="px-2 text-right tabular-nums">{dinero(recurso.solicitado)}</td>
                <td className={`pl-2 text-right tabular-nums ${recurso.restante < 0 ? "font-semibold text-rose-700" : ""}`}>{dinero(recurso.restante)}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[11px]">Análisis orientativo según los saldos consultados al abrir el formulario. Se recalcula al cambiar los montos.</p>
      <button data-shortcut="319" type="button" disabled={consulta.estado === "cargando"} onClick={() => {
        setConsulta({ estado: "cargando" });
        setIntento((actual) => actual + 1);
      }} className="mt-2 border border-current/20 bg-white px-2 py-1 font-medium disabled:opacity-50">
        Actualizar saldos
      </button>
    </section>
  );
}
