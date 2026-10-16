"use client";

import type {
  ConciliacionConDetecciones,
  MovimientoBancario,
  SugerenciaConciliacion,
} from "@/modules/ingresos/domain/conciliacion-bancaria";

function dinero(centavos: number) {
  return (centavos / 100).toLocaleString("es-HN", { style: "currency", currency: "HNL" });
}

function fecha(value: string) {
  return value.split("-").reverse().join("/");
}

function Movimientos({ items }: { items: MovimientoBancario[] }) {
  return (
    <div className="max-h-64 overflow-auto">
      <table className="w-full min-w-[680px] text-left text-xs">
        <thead className="bg-slate-50 text-slate-600">
          <tr>
            <th className="p-2">Fila / fecha</th>
            <th className="p-2">Cuenta bancaria</th>
            <th className="p-2">Referencia / descripción</th>
            <th className="p-2 text-right">Débito</th>
            <th className="p-2 text-right">Crédito</th>
          </tr>
        </thead>
        <tbody>
          {items.map(item => (
            <tr key={item.id} className="border-t border-slate-100">
              <td className="p-2">{item.fila} · {fecha(item.fecha)}</td>
              <td className="p-2">{item.cuenta}</td>
              <td className="max-w-sm break-words p-2">{item.referencia || "Sin referencia"} · {item.descripcion || "Sin descripción"}</td>
              <td className="p-2 text-right tabular-nums">{item.debitoCentavos ? dinero(item.debitoCentavos) : "—"}</td>
              <td className="p-2 text-right tabular-nums">{item.creditoCentavos ? dinero(item.creditoCentavos) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DeteccionesConciliacion({
  analisis, onConfirmar, onDescartar, onDeshacer,
}: {
  analisis: ConciliacionConDetecciones;
  onConfirmar: (item: SugerenciaConciliacion) => void;
  onDescartar: (id: string) => void;
  onDeshacer: (id: string) => void;
}) {
  const tarjetas = [
    ...analisis.sugerencias.map(item => ({ item, confirmada: false })),
    ...analisis.confirmadas.map(item => ({ item, confirmada: true })),
  ];
  return (
    <div className="p-4">
      <h3 className="text-sm font-semibold text-slate-950">Conciliados para revisión</h3>
      <p aria-live="polite" className="mt-2 text-xs leading-5 text-slate-600">
        {analisis.sugerencias.length} relación(es) pendiente(s) · {analisis.confirmadas.length} relación(es) confirmada(s).
        Los movimientos detectados ya están separados de las notas de crédito y débito.
        Revise las cuentas, fechas y referencias para confirmar o descartar cada relación.
        Descartar todas las alternativas de un registro vuelve a evaluar si corresponde una nota. No se modifican los registros guardados.
      </p>
      {analisis.enRevision.movimientos.length > 0 && (
        <details className="mt-3 border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          <summary className="cursor-pointer font-semibold">Registros únicos para revisión: {analisis.enRevision.movimientos.length} bancarios y {analisis.enRevision.depositos.length} del sistema</summary>
          <p className="my-2">Los movimientos se cuentan una sola vez, aunque aparezcan en varias alternativas.</p>
          <Movimientos items={analisis.enRevision.movimientos} />
          {analisis.enRevision.depositos.map(item => (
            <p key={item.id} className="mt-2">Sistema · {item.bloque ?? item.id} · {item.cuenta} · {fecha(item.fecha)} · {dinero(item.montoCentavos)}</p>
          ))}
        </details>
      )}
      <p className="mt-1 text-xs leading-5 text-slate-500">
        Traslados: débito y crédito iguales entre cuentas propias distintas y ambas fechas dentro del período.
        Sin descripción de traslado, deben ser del mismo día y el crédito no debe tener coincidencia con el sistema.
        Con descripción de traslado, se admite la tolerancia de fecha seleccionada.
        Agrupaciones: dos o más créditos sin conciliar de la misma cuenta que suman exactamente un registro del sistema.
        Si varias sugerencias comparten movimientos, confirmar una elimina las alternativas incompatibles.
        Las decisiones se conservan mientras permanezca abierto este análisis; cambiar los datos o volver a analizar las reinicia.
      </p>
      {analisis.advertenciasDeteccion.map(aviso => (
        <p key={aviso} role="status" className="mt-3 border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">{aviso}</p>
      ))}
      {analisis.descartadas.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">{analisis.descartadas.length} sugerencia(s) descartada(s). Vuelva a analizar para revisarlas nuevamente.</p>
      )}
      {tarjetas.length === 0 && (
        <p className="py-8 text-center text-sm text-slate-500">No se encontraron relaciones con estos datos y filtros. Para traslados, incluya el débito y el crédito con sus cuentas, fechas e importes; la descripción es opcional.</p>
      )}
      <div className="mt-4 space-y-4">
        {tarjetas.map(({ item, confirmada }) => (
          <article key={item.id} className={`border ${confirmada ? "border-emerald-300" : "border-slate-300"}`}>
            <div className="flex flex-wrap items-start justify-between gap-3 bg-slate-50 p-3">
              <div className="min-w-0 flex-1">
                <h4 className="text-sm font-semibold text-slate-950">
                  {confirmada ? "Confirmado" : "Conciliado para revisión"} · {item.tipo === "traslado" ? "Traslado entre cuentas" : "Varios abonos para un registro"}
                </h4>
                {item.tipo === "traslado" ? (
                  <>
                    <p className="mt-1 break-words text-xs text-slate-700">{item.debito.cuenta} → {item.credito.cuenta} · {dinero(item.credito.creditoCentavos)} · efecto neto: {dinero(0)}</p>
                    <p className="mt-1 text-xs text-slate-600">
                      {item.descripcionTraslado
                        ? "Detectado por descripción de traslado, monto y fechas."
                        : "Detectado por el mismo importe y día entre cuentas distintas, con crédito sin coincidencia en el sistema."}
                      {item.referenciaCompartida && " Comparten referencia bancaria."}
                      {" "}Verifique que sea la misma operación.
                    </p>
                    {item.reemplazaCoincidencia && !confirmada && (
                      <p className="mt-2 text-xs font-semibold text-amber-800">Este crédito también coincide con un registro del sistema. Ambos están para revisión. Confirmar el traslado volverá a evaluar el registro interno.</p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="mt-1 text-xs text-slate-700">Registro {item.sistema.bloque ?? item.sistema.id} · {item.sistema.cuenta} · depósito {fecha(item.sistema.fecha)}</p>
                    <p className="mt-1 text-xs text-slate-600">{item.sistema.descripcion || "Sin descripción del sistema"}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-900">{item.creditos.length} abonos suman {dinero(item.sistema.montoCentavos)} · diferencia: {dinero(0)}</p>
                  </>
                )}
              </div>
              <div className="flex gap-2">
                {confirmada ? (
                  <button data-shortcut="363" type="button" onClick={() => onDeshacer(item.id)} className="border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Deshacer confirmación</button>
                ) : (
                  <>
                    <button data-shortcut="364" type="button" onClick={() => onDescartar(item.id)} className="border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700">Descartar sugerencia</button>
                    <button data-shortcut="365" type="button" onClick={() => onConfirmar(item)} className="border border-[#003331] bg-[#003331] px-3 py-2 text-xs font-semibold text-white">Confirmar relación</button>
                  </>
                )}
              </div>
            </div>
            <Movimientos items={item.tipo === "traslado" ? [item.debito, item.credito] : item.creditos} />
          </article>
        ))}
      </div>
    </div>
  );
}
