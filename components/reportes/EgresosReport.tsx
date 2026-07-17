"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2, Upload, X } from "lucide-react";
import {
  obtenerOrdenesEstructuradas,
  Orden,
} from "@/services/ordenes.service";
import { obtenerPresupuesto } from "@/services/presupuesto";
import EjecutarOrdenPagoModal from "@/components/EjecutarOrdenPagoModal";
import SelectorBeneficiario from "@/components/SelectorBeneficiario";
import DocumentosFaltantesOrdenPagoModal from "../DocumentosFaltantesOrdenPagoModal";
import { crearClienteSupabase } from "@/lib/supabase";
import type { BeneficiarioOption } from "@/services/beneficiarios.service";

import {
  obtenerResumenDocumentosFaltantesOrdenPago,
  type ResumenDocumentosOrdenPago,
} from "@/services/documentosFaltantesOrdenPago.service";

const EPSILON = 0.01;

function formatMoney(value: number) {
  return value.toLocaleString("es-HN", {
    style: "currency",
    currency: "HNL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function isOrdenNoCompleta(order: Orden) {
  return Math.abs(order.diferencia) > EPSILON;
}

function puedeEditarEjecucion(order: Orden) {
  return obtenerOrdenPagoId(order) !== null;
}

function getEstadoTexto(order: Orden) {
  if (order.diferencia > EPSILON) return "Pendiente";
  if (order.diferencia < -EPSILON) return "Sobreejecución";
  return "Conciliada";
}

function getEstadoClass(order: Orden) {
  if (order.diferencia > EPSILON) {
    return "border-amber-500 text-amber-700 bg-amber-50/60";
  }

  if (order.diferencia < -EPSILON) {
    return "border-rose-500 text-rose-700 bg-rose-50/60";
  }

  return "border-emerald-500 text-emerald-700 bg-emerald-50/60";
}

function getRowAccent(order: Orden) {
  if (order.diferencia > EPSILON) return "border-l-amber-500";
  if (order.diferencia < -EPSILON) return "border-l-rose-500";
  return "border-l-transparent";
}

function getDiffClass(value: number) {
  if (value > EPSILON) return "text-amber-700 font-semibold";
  if (value < -EPSILON) return "text-rose-700 font-semibold";
  return "text-slate-700";
}

type GrupoOrdenes = {
  id: string;
  titulo: string;
  descripcion: string;
  items: Orden[];
};

type MovimientoBancoEgreso = {
  no_cheque: string;
  monto_banco: number;
  deduccion: number;
  nombre: string;
  id_beneficiario: string;
};

type ModoEgresos = "ordenes" | "presupuesto";

type PresupuestoInfo = {
  codigo: string;
  actividadId: string;
  actividadNombre: string;
  obraId: string;
  obraNombre: string;
  objeto: string;
  descripcionObjeto: string;
  nombre: string;
  referencia: string;
};

type FilaPresupuestoEgreso = {
  id: string;
  noOrden: string;
  fecha: string;
  descripcion: string;
  codigoPresupuestario: string;
  editable: boolean;
  objeto: string;
  descripcionObjeto: string;
  nombreObjeto: string;
  referenciaPresupuesto: string;
  referenciaPresupuestoKey: string;
  montoAsignado: number;
};

type GrupoPresupuestoEgreso = {
  id: string;
  titulo: string;
  subtitulo: string;
  total: number;
  items: FilaPresupuestoEgreso[];
};

function escapeHtml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function construirNombreObjeto(info: PresupuestoInfo) {
  if (info.objeto && info.descripcionObjeto) {
    return `${info.objeto} - ${info.descripcionObjeto}`;
  }

  return info.descripcionObjeto || info.objeto || "Sin objeto del gasto";
}

function limpiarTexto(value: unknown) {
  return String(value ?? "").trim();
}

function obtenerTextoPresupuesto(row: Record<string, unknown>) {
  return [
    row.codigo,
    row.actividad_nombre,
    row.nombre_actividad,
    row.actividad,
    row.obra_nombre,
    row.nombre_obra,
    row.obra,
    row.objeto,
    row.descripcion_objeto,
    row.fuente,
    row.tipo_inversion,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim())
    .join(" ");
}

function crearReferenciaPresupuesto(info: {
  actividadNombre: string;
  obraNombre: string;
}) {
  if (info.actividadNombre && info.obraNombre) {
    return `${info.actividadNombre} / ${info.obraNombre}`;
  }

  return (
    info.obraNombre ||
    info.actividadNombre ||
    "Referencia presupuestaria sin identificar"
  );
}

function crearLlavePresupuesto(
  codigo: string,
  actividadId?: string | null,
  obraId?: string | null
) {
  const actividad = limpiarTexto(actividadId);
  const obra = limpiarTexto(obraId);

  if (obra) return `${codigo}::obra::${obra}`;
  return actividad ? `${codigo}::actividad::${actividad}` : codigo;
}

function construirIndicePresupuesto(rows: Record<string, unknown>[]) {
  const index = new Map<string, PresupuestoInfo>();
  const fallbackPorCodigo = new Map<string, PresupuestoInfo>();

  rows.forEach((row) => {
    const codigo = limpiarTexto(row.codigo);

    if (!codigo) return;

    const objeto = limpiarTexto(row.objeto);
    const descripcionObjeto = limpiarTexto(row.descripcion_objeto);
    const actividadId = limpiarTexto(row.actividad_id ?? row.actividad);
    const actividadNombre = limpiarTexto(
      row.actividad_nombre ?? row.nombre_actividad ?? row.actividad
    );
    const obraId = limpiarTexto(row.obra_id ?? row.obra);
    const obraNombre = limpiarTexto(
      row.obra_nombre ?? row.nombre_obra ?? row.obra
    );
    const info: PresupuestoInfo = {
      codigo,
      actividadId,
      actividadNombre,
      obraId,
      obraNombre,
      objeto,
      descripcionObjeto,
      nombre: obtenerTextoPresupuesto(row),
      referencia: crearReferenciaPresupuesto({ actividadNombre, obraNombre }),
    };
    const infoConNombre = {
      ...info,
      nombre: info.nombre || construirNombreObjeto(info),
    };
    const obraKey = crearLlavePresupuesto(codigo, actividadId, obraId);
    const actividadKey = crearLlavePresupuesto(codigo, actividadId);

    if (!index.has(obraKey)) {
      index.set(obraKey, infoConNombre);
    }

    if (!index.has(actividadKey)) {
      index.set(actividadKey, infoConNombre);
    }

    if (!fallbackPorCodigo.has(codigo)) {
      fallbackPorCodigo.set(codigo, infoConNombre);
    }
  });

  fallbackPorCodigo.forEach((info, codigo) => {
    if (!index.has(codigo)) {
      index.set(codigo, info);
    }
  });

  return index;
}

function construirFilasPresupuestoEgresos(
  ordenes: Orden[],
  presupuestoPorCodigo: Map<string, PresupuestoInfo>
) {
  return ordenes.flatMap((orden) =>
    orden.beneficiarios.flatMap((beneficiario) =>
      beneficiario.ejecuciones.map((ejecucion, index) => {
        const codigo = limpiarTexto(ejecucion.codigo_presupuestario);
        const actividadId = limpiarTexto(ejecucion.actividad_id);
        const obraId = limpiarTexto(ejecucion.obra_id);
        const presupuesto =
          presupuestoPorCodigo.get(
            crearLlavePresupuesto(codigo, actividadId, obraId)
          ) ??
          presupuestoPorCodigo.get(crearLlavePresupuesto(codigo, actividadId)) ??
          presupuestoPorCodigo.get(codigo);
        const fallback: PresupuestoInfo = {
          codigo,
          actividadId,
          actividadNombre: "",
          obraId,
          obraNombre: "",
          objeto: "",
          descripcionObjeto: "",
          nombre: codigo || "Codigo presupuestario sin identificar",
          referencia: "Referencia presupuestaria sin identificar",
        };
        const info = presupuesto ?? fallback;

        return {
          id: `${orden.no_orden}-${beneficiario.id}-${ejecucion.id}-${index}`,
          noOrden: orden.no_orden,
          fecha: orden.fecha,
          descripcion: orden.descripcion,
          codigoPresupuestario: codigo,
          editable: puedeEditarEjecucion(orden),
          objeto: info.objeto,
          descripcionObjeto: info.descripcionObjeto,
          nombreObjeto: construirNombreObjeto(info),
          referenciaPresupuesto: info.referencia,
          referenciaPresupuestoKey: crearLlavePresupuesto(
            codigo,
            info.actividadId || actividadId,
            info.obraId || obraId
          ),
          montoAsignado: Number(ejecucion.monto_ejecutado || 0),
        };
      })
    )
  );
}

function normalizarTextoGrupo(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function compararNumeroOrden(a: string, b: string) {
  const numeroA = Number(a);
  const numeroB = Number(b);

  if (Number.isFinite(numeroA) && Number.isFinite(numeroB)) {
    return numeroA - numeroB;
  }

  return a.localeCompare(b, "es-HN", {
    numeric: true,
    sensitivity: "base",
  });
}

function ordenarFilasPresupuesto(filas: FilaPresupuestoEgreso[]) {
  return [...filas].sort((a, b) => {
    const ordenComparison = compararNumeroOrden(a.noOrden, b.noOrden);

    if (ordenComparison !== 0) return ordenComparison;

    return a.codigoPresupuestario.localeCompare(
      b.codigoPresupuestario,
      "es-HN",
      {
        numeric: true,
        sensitivity: "base",
      }
    );
  });
}

function construirGruposPresupuestoEgresos(filas: FilaPresupuestoEgreso[]) {
  const map = new Map<string, GrupoPresupuestoEgreso>();

  ordenarFilasPresupuesto(filas).forEach((fila) => {
    const codigo = fila.codigoPresupuestario || "Sin codigo presupuestario";
    const referencia =
      fila.referenciaPresupuesto || "Referencia presupuestaria sin identificar";
    const key = normalizarTextoGrupo(
      fila.referenciaPresupuestoKey || `${codigo} ${referencia}`
    );

    if (!map.has(key)) {
      map.set(key, {
        id: key,
        titulo: codigo,
        subtitulo: `${referencia} / ${fila.nombreObjeto}`,
        total: 0,
        items: [],
      });
    }

    const grupo = map.get(key)!;
    grupo.total += fila.montoAsignado;
    grupo.items.push(fila);
  });

  return Array.from(map.values()).sort(
    (a, b) =>
      compararNumeroOrden(a.titulo, b.titulo) ||
      a.subtitulo.localeCompare(b.subtitulo, "es-HN", {
        numeric: true,
        sensitivity: "base",
      })
  );
}

function getResumenDocumentalTexto(
  resumen: ResumenDocumentosOrdenPago | null | undefined
) {
  const totalFaltantes = resumen?.totalFaltantes ?? 0;
  const totalSubsanados = resumen?.totalSubsanados ?? 0;

  if (totalFaltantes > 0) return `${totalFaltantes} faltante(s)`;
  if (totalSubsanados > 0) return "Subsanado";

  return "Sin docs";
}

function obtenerFechaLocal() {
  const fecha = new Date();
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function obtenerTiempoFecha(value: string | null | undefined) {
  if (!value) return null;

  const text = String(value).trim();
  const soloFecha = text.split("T")[0].split(" ")[0];
  const isoMatch = soloFecha.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const localMatch = soloFecha.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);

  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }

  if (localMatch) {
    const [, day, month, year] = localMatch;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }

  const time = new Date(text).getTime();

  return Number.isFinite(time) ? time : null;
}

function estaEnRangoFecha(
  fechaRegistro: string | null | undefined,
  fechaDesde: string,
  fechaHasta: string
) {
  if (!fechaDesde && !fechaHasta) return true;

  const tiempoRegistro = obtenerTiempoFecha(fechaRegistro);

  if (tiempoRegistro === null) return false;

  const tiempoDesde = fechaDesde ? obtenerTiempoFecha(fechaDesde) : null;
  const tiempoHasta = fechaHasta ? obtenerTiempoFecha(fechaHasta) : null;

  if (tiempoDesde !== null && tiempoRegistro < tiempoDesde) return false;
  if (tiempoHasta !== null && tiempoRegistro > tiempoHasta) return false;

  return true;
}

function normalizarMonto(value: string) {
  return toDoubleUniversal(value);
}

function toDoubleUniversal(value: string | number | null | undefined) {
  if (value === null || value === undefined) return 0;

  let text = String(value).trim();

  if (!text) return 0;

  text = text.replace(/\s/g, "");

  const lastComma = text.lastIndexOf(",");
  const lastDot = text.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSeparator = lastComma > lastDot ? "," : ".";
    const thousandSeparator = decimalSeparator === "," ? "." : ",";

    text = text.replaceAll(thousandSeparator, "");
    text = text.replace(decimalSeparator, ".");
  } else if (lastComma >= 0) {
    const decimals = text.length - lastComma - 1;
    text = decimals > 0 && decimals <= 2
      ? text.replace(",", ".")
      : text.replaceAll(",", "");
  } else if (lastDot >= 0) {
    const decimals = text.length - lastDot - 1;
    text = decimals > 0 && decimals <= 2
      ? text
      : text.replaceAll(".", "");
  }

  const parsed = Number(text);

  if (!Number.isFinite(parsed)) {
    throw new Error(`Valor no numerico detectado: ${value}`);
  }

  return parsed;
}

function detectarSeparadorCsv(text: string) {
  const primeraLinea = text.split(/\r?\n/).find((line) => line.trim()) ?? "";
  const separadores = [",", ";", "\t"];

  return separadores
    .map((separator) => ({
      separator,
      count: primeraLinea.split(separator).length,
    }))
    .sort((a, b) => b.count - a.count)[0].separator;
}

function parseCsv(text: string) {
  const separator = detectarSeparadorCsv(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === separator && !quoted) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }

      row.push(cell);

      if (row.some((value) => value.trim())) {
        rows.push(row);
      }

      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);

  if (row.some((value) => value.trim())) {
    rows.push(row);
  }

  return rows;
}

function movimientosDesdeCsv(text: string) {
  const rows = parseCsv(text);
  const movimientos: MovimientoBancoEgreso[] = [];

  rows.slice(1).forEach((row, index) => {
    const noCheque = String(row[0] ?? "").trim();
    const nombre = String(row[1] ?? "").trim();
    const idBeneficiario = String(row[2] ?? "").trim();
    const monto = toDoubleUniversal(row[3] ?? "");
    const deduccion = toDoubleUniversal(row[4] ?? "");

    if (!noCheque && !nombre && !idBeneficiario && monto === 0 && deduccion === 0) {
      return;
    }

    if (!idBeneficiario) {
      throw new Error(`Fila ${index + 2}: falta el ID del beneficiario.`);
    }

    if (monto > 0) {
      movimientos.push({
        no_cheque: noCheque,
        monto_banco: Number(monto.toFixed(2)),
        deduccion: 0,
        nombre,
        id_beneficiario: idBeneficiario,
      });
    }

    if (deduccion > 0) {
      movimientos.push({
        no_cheque: noCheque,
        monto_banco: 0,
        deduccion: Number(deduccion.toFixed(2)),
        nombre,
        id_beneficiario: idBeneficiario,
      });
    }
  });

  return movimientos;
}

async function obtenerSiguienteNumeroOrden() {
  const supabase = crearClienteSupabase();
  const { data, error } = await supabase.rpc("obtener_ultimo_numero_orden", {});

  if (error) {
    throw new Error(error.message);
  }

  if (Array.isArray(data)) {
    const row = data[0] as { ultimo_numero?: number | string } | undefined;
    return Number(row?.ultimo_numero ?? 0) + 1;
  }

  if (typeof data === "number") {
    return data + 1;
  }

  if (data && typeof data === "object") {
    const row = data as { ultimo_numero?: number | string };
    return Number(row.ultimo_numero ?? 0) + 1;
  }

  return 1;
}

async function insertarEgresoDirecto(input: {
  fecha: string;
  descripcion: string;
  noOrden: number;
  movimientos: MovimientoBancoEgreso[];
}) {
  const supabase = crearClienteSupabase();
  const descripcionNormalizada = input.descripcion.trim().toUpperCase();

  if (descripcionNormalizada === "NULA") {
    const { error } = await supabase.from("egresos").insert({
      fecha: input.fecha,
      descripcion: "Orden de pago nula",
      debe: 0,
      haber: 0,
      no_orden: input.noOrden,
      id_beneficiario: "-",
      no_cheque: 0,
      cuenta: "SIN EFECTO CONTABLE",
      tipo_movimiento: "NULA",
    });

    if (error) {
      throw new Error(error.message);
    }

    return;
  }

  const descripcionFinal = `${input.descripcion} | | Con orden No. ${input.noOrden}`;
  const rows = input.movimientos.flatMap((movimiento) => {
    const deduccion = Number(movimiento.deduccion || 0);
    const montoBanco = Number(movimiento.monto_banco || 0);
    const noCheque = Number(String(movimiento.no_cheque).trim() || 0);
    const base = {
      fecha: input.fecha,
      descripcion: descripcionFinal,
      debe: 0,
      no_orden: input.noOrden,
      id_beneficiario: movimiento.id_beneficiario.trim(),
      no_cheque: Number.isFinite(noCheque) ? noCheque : 0,
      tipo_movimiento: "Egreso",
    };
    const rowsMovimiento = [];

    if (montoBanco > 0) {
      rowsMovimiento.push({
        ...base,
        haber: montoBanco,
        cuenta: "Bancos",
      });
    }

    if (deduccion > 0) {
      rowsMovimiento.push({
        ...base,
        haber: deduccion,
        cuenta: "Deducciones por pagar",
      });
    }

    return rowsMovimiento;
  });

  if (rows.length === 0) {
    throw new Error("No existen movimientos validos para procesar.");
  }

  const { error } = await supabase.from("egresos").insert(rows);

  if (error) {
    throw new Error(error.message);
  }
}

function imprimirReporteEgresos(
  grupos: GrupoOrdenes[],
  resumenDocumentalPorOrden: Map<number, ResumenDocumentosOrdenPago>
) {
  const ordenes = grupos.flatMap((grupo) => grupo.items);
  const totalHaber = ordenes.reduce((acc, order) => acc + order.total_haber, 0);
  const totalEjecutado = ordenes.reduce(
    (acc, order) => acc + order.total_ejecutado,
    0
  );
  const totalDiferencia = totalHaber - totalEjecutado;
  const porcentajeEjecucion =
    totalHaber > 0 ? (totalEjecutado / totalHaber) * 100 : 0;
  const fechaReporte = new Date().toLocaleDateString("es-HN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const filas = grupos
    .map((grupo) => {
      const filasGrupo = grupo.items
        .map((order) => {
          const resumenDocs = resumenDocumentalPorOrden.get(
            Number(order.no_orden)
          );

          const beneficiarios = order.beneficiarios
            .map((beneficiario) => {
              const ejecuciones = beneficiario.ejecuciones
                .map(
                  (ejecucion) => `
                    <tr>
                      <td></td>
                      <td colspan="2">${escapeHtml(
                        ejecucion.codigo_presupuestario
                      )}</td>
                      <td class="money">${escapeHtml(
                        formatMoney(ejecucion.monto_ejecutado)
                      )}</td>
                    </tr>
                  `
                )
                .join("");

              return `
                <table class="detail-table">
                  <tbody>
                    <tr>
                      <td class="beneficiary">${escapeHtml(
                        beneficiario.nombre
                      )}</td>
                      <td>${escapeHtml(beneficiario.id)}</td>
                      <td>${escapeHtml(beneficiario.no_cheque || "N/D")}</td>
                      <td class="money">${escapeHtml(
                        formatMoney(beneficiario.haber)
                      )}</td>
                    </tr>
                    ${ejecuciones}
                  </tbody>
                </table>
              `;
            })
            .join("");

          return `
            <tr>
              <td>${escapeHtml(getEstadoTexto(order))}</td>
              <td>${escapeHtml(getResumenDocumentalTexto(resumenDocs))}</td>
              <td>${escapeHtml(order.no_orden)}</td>
              <td>${escapeHtml(order.fecha)}</td>
              <td>${escapeHtml(order.descripcion)}</td>
              <td class="money">${escapeHtml(formatMoney(order.total_haber))}</td>
              <td class="money">${escapeHtml(
                formatMoney(order.total_ejecutado)
              )}</td>
              <td class="money">${escapeHtml(formatMoney(order.diferencia))}</td>
              <td class="center">${escapeHtml(order.beneficiarios.length)}</td>
            </tr>
            <tr class="detail-row">
              <td></td>
              <td colspan="8">
                <div class="detail-title">Beneficiarios, cheques y ejecuciones</div>
                ${
                  beneficiarios ||
                  '<div class="empty-detail">Sin beneficiarios asociados.</div>'
                }
              </td>
            </tr>
          `;
        })
        .join("");

      return `
        <tr class="group-row">
          <td colspan="9">
            <strong>${escapeHtml(grupo.titulo)}</strong>
            <span>${escapeHtml(grupo.descripcion)}</span>
            <em>${escapeHtml(grupo.items.length)} registros</em>
          </td>
        </tr>
        ${
          filasGrupo ||
          '<tr><td colspan="9" class="empty">No hay registros en esta seccion.</td></tr>'
        }
      `;
    })
    .join("");

  const printWindow = window.open("", "_blank", "width=1200,height=800");

  if (!printWindow) {
    window.print();
    return;
  }

  printWindow.document.open();
  printWindow.document.write(`
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Reporte de egresos</title>
        <style>
          @page {
            size: letter landscape;
            margin: 0.42in;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            color: #0f172a;
            background: #ffffff;
            font-family: Arial, Helvetica, sans-serif;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }

          header {
            display: flex;
            justify-content: space-between;
            gap: 24px;
            border-bottom: 1px solid #94a3b8;
            padding-bottom: 12px;
            margin-bottom: 14px;
          }

          .eyebrow {
            color: #64748b;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.18em;
            text-transform: uppercase;
          }

          h1 {
            margin: 4px 0 0 0;
            font-size: 20px;
            line-height: 1.2;
          }

          .meta {
            margin-top: 4px;
            color: #475569;
            font-size: 12px;
          }

          .summary {
            min-width: 360px;
            text-align: right;
            font-size: 12px;
            color: #475569;
          }

          .summary strong {
            color: #0f172a;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
            font-size: 8.5px;
          }

          thead {
            display: table-header-group;
            background: #f1f5f9;
          }

          th,
          td {
            border: 1px solid #cbd5e1;
            padding: 5px 6px;
            vertical-align: top;
          }

          th {
            color: #475569;
            font-size: 7.5px;
            letter-spacing: 0.12em;
            text-align: left;
            text-transform: uppercase;
          }

          th:nth-child(1) {
            width: 11%;
          }

          th:nth-child(2) {
            width: 10%;
          }

          th:nth-child(3) {
            width: 9%;
          }

          th:nth-child(4) {
            width: 9%;
          }

          th:nth-child(6),
          th:nth-child(7),
          th:nth-child(8) {
            width: 11%;
            text-align: right;
          }

          th:nth-child(9) {
            width: 7%;
            text-align: center;
          }

          .money {
            text-align: right;
            font-weight: 700;
            white-space: nowrap;
          }

          .center {
            text-align: center;
          }

          .group-row td {
            background: #e2e8f0;
            border-color: #94a3b8;
            color: #0f172a;
          }

          .group-row span {
            display: block;
            margin-top: 2px;
            color: #475569;
            font-weight: 400;
          }

          .group-row em {
            float: right;
            color: #475569;
            font-style: normal;
            font-weight: 700;
          }

          .detail-row td {
            background: #f8fafc;
            padding: 6px;
          }

          .detail-title {
            margin-bottom: 4px;
            color: #475569;
            font-size: 8px;
            font-weight: 700;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }

          .detail-table {
            margin-bottom: 4px;
            font-size: 8px;
          }

          .detail-table td {
            background: #ffffff;
            padding: 3px 5px;
          }

          .beneficiary {
            font-weight: 700;
          }

          .empty,
          .empty-detail {
            color: #64748b;
            text-align: center;
          }

          tfoot td {
            background: #f8fafc;
            font-weight: 700;
          }

          tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        </style>
      </head>
      <body>
        <header>
          <div>
            <div class="eyebrow">Sistema financiero municipal</div>
            <h1>Ordenes de pago</h1>
            <div class="meta">Reporte de egresos al ${escapeHtml(fechaReporte)}</div>
          </div>

          <div class="summary">
            <div><strong>${escapeHtml(ordenes.length)}</strong> registros</div>
            <div>Egreso: <strong>${escapeHtml(formatMoney(totalHaber))}</strong></div>
            <div>Ejecutado: <strong>${escapeHtml(
              formatMoney(totalEjecutado)
            )}</strong></div>
            <div>Diferencia: <strong>${escapeHtml(
              formatMoney(totalDiferencia)
            )}</strong></div>
            <div>Ejecucion: <strong>${escapeHtml(
              porcentajeEjecucion.toFixed(1)
            )}%</strong></div>
          </div>
        </header>

        <table>
          <thead>
            <tr>
              <th>Estado</th>
              <th>Docs.</th>
              <th>Orden</th>
              <th>Fecha</th>
              <th>Descripcion</th>
              <th>Egreso</th>
              <th>Ejecutado</th>
              <th>Diferencia</th>
              <th>Benef.</th>
            </tr>
          </thead>
          <tbody>
            ${
              filas ||
              '<tr><td colspan="9" class="empty">No se encontraron ordenes.</td></tr>'
            }
          </tbody>
          <tfoot>
            <tr>
              <td colspan="5" style="text-align:right;">Total</td>
              <td class="money">${escapeHtml(formatMoney(totalHaber))}</td>
              <td class="money">${escapeHtml(formatMoney(totalEjecutado))}</td>
              <td class="money">${escapeHtml(formatMoney(totalDiferencia))}</td>
              <td class="center">${escapeHtml(ordenes.length)}</td>
            </tr>
          </tfoot>
        </table>
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();

  window.setTimeout(() => {
    printWindow.print();
  }, 250);
}

function obtenerOrdenPagoId(order: Orden | null) {
  if (!order) return null;

  const raw = order.orden_pago_id ?? order.no_orden;
  const id = Number(raw);

  return Number.isFinite(id) ? id : null;
}

function Encabezado() {
  return (
    <div className="pdf-encabezado fixed left-0 top-0 z-50 w-full bg-white">
      <img
        src="/logo.svg"
        alt="Encabezado"
        className="block h-auto w-full"
      />
    </div>
  );
}

function PrintStyles() {
  return (
    <style jsx global>{`
      @page {
        size: letter landscape;
        margin: 0;
      }

      .pdf-encabezado,
      .print-only {
        display: none;
      }

      @media print {
        html,
        body {
          width: 11in;
          min-height: 8.5in;
          background: #ffffff !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }

        body {
          overflow: visible !important;
        }

        .no-print {
          display: none !important;
        }

        .pdf-encabezado {
          display: block !important;
          position: fixed !important;
          top: 0;
          left: 0;
          right: 0;
          width: 100%;
          z-index: 9999;
          background: #ffffff !important;
        }

        .print-only {
          display: block !important;
        }

        .print-root {
          display: block !important;
          height: auto !important;
          min-height: auto !important;
          overflow: visible !important;
          background: #ffffff !important;
          color: #0f172a !important;
        }

        .print-page {
          padding: 1.08in 0.35in 0.45in 0.35in !important;
        }

        .print-header {
          border: 1px solid #cbd5e1 !important;
          background: #ffffff !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        .print-main {
          padding: 0 !important;
          overflow: visible !important;
        }

        .print-table-wrap {
          height: auto !important;
          overflow: visible !important;
          border: 1px solid #cbd5e1 !important;
          background: #ffffff !important;
          backdrop-filter: none !important;
        }

        .print-table {
          width: 100% !important;
          min-width: 0 !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
          font-size: 8.5px !important;
        }

        .print-table thead {
          position: static !important;
          background: #f8fafc !important;
        }

        .print-table th,
        .print-table td {
          padding: 4px 5px !important;
          border-color: #d7dee8 !important;
          vertical-align: top !important;
        }

        .print-hide {
          display: none !important;
        }

        .print-description {
          display: block !important;
          overflow: visible !important;
          -webkit-line-clamp: unset !important;
          line-clamp: unset !important;
          white-space: normal !important;
          line-height: 1.25 !important;
        }

        .print-row,
        .print-row:hover {
          background: #ffffff !important;
        }

        .print-group-row {
          background: #eef2f7 !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        tr {
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }

        .print-signature {
          margin-top: 0.55in !important;
          break-inside: avoid !important;
          page-break-inside: avoid !important;
        }
      }
    `}</style>
  );
}

export default function OrdenesReport({
  focusOrder = null,
  refreshKey = 0,
  sharedView = false,
  onDataChange,
}: {
  focusOrder?: number | string | null;
  refreshKey?: number;
  sharedView?: boolean;
  onDataChange?: () => void;
} = {}) {
  const [data, setData] = useState<Orden[]>([]);
  const [presupuesto, setPresupuesto] = useState<Record<string, unknown>[]>(
    []
  );
  const [resumenDocumental, setResumenDocumental] = useState<
    ResumenDocumentosOrdenPago[]
  >([]);
  const [open, setOpen] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [modo, setModo] = useState<ModoEgresos>("ordenes");
  const [gruposPresupuestoAbiertos, setGruposPresupuestoAbiertos] = useState<
    string[]
  >([]);
  const [ordenReciente, setOrdenReciente] = useState<string | null>(null);
  const [mostrarSoloOrdenReciente, setMostrarSoloOrdenReciente] =
    useState(false);

  const [modalEjecucionOpen, setModalEjecucionOpen] = useState(false);
  const [ordenSeleccionada, setOrdenSeleccionada] = useState<Orden | null>(
    null
  );

  const [modalDocumentosOpen, setModalDocumentosOpen] = useState(false);
  const [ordenDocumentalSeleccionada, setOrdenDocumentalSeleccionada] =
  useState<Orden | null>(null);
  const [modalNuevoEgresoOpen, setModalNuevoEgresoOpen] = useState(false);

  const cargar = useCallback(async () => {
    const [ordenes, resumenDocs, presupuestoBase] = await Promise.all([
      obtenerOrdenesEstructuradas(),
      obtenerResumenDocumentosFaltantesOrdenPago(),
      obtenerPresupuesto(),
    ]);

    setData(ordenes);
    setResumenDocumental(resumenDocs);
    setPresupuesto(presupuestoBase);
  }, []);

  useEffect(() => {
    void Promise.resolve().then(cargar);
  }, [cargar]);

  useEffect(() => {
    if (refreshKey === 0) return;

    void Promise.resolve().then(cargar);
  }, [cargar, refreshKey]);

  useEffect(() => {
    if (!focusOrder) return;

    const noOrden = String(focusOrder);

    void Promise.resolve().then(() => {
      setOrdenReciente(noOrden);
      setMostrarSoloOrdenReciente(true);
      setOpen((prev) => (prev.includes(noOrden) ? prev : [...prev, noOrden]));
    });
  }, [focusOrder]);

  function exportarPDF() {
    if (modo === "presupuesto") {
      window.print();
      return;
    }

    imprimirReporteEgresos(grupos, resumenDocumentalPorOrden);
  }

  function toggle(id: string) {
    setOpen((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleGrupoPresupuesto(id: string) {
    setGruposPresupuestoAbiertos((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function abrirModalEjecucion(order: Orden) {
    setOrdenSeleccionada(order);
    setModalEjecucionOpen(true);
  }

  function cerrarModalEjecucion() {
    setModalEjecucionOpen(false);
    setOrdenSeleccionada(null);
  }

  function abrirModalDocumentos(order: Orden) {
  setOrdenDocumentalSeleccionada(order);
  setModalDocumentosOpen(true);
  }

  function cerrarModalDocumentos() {
  setModalDocumentosOpen(false);
  setOrdenDocumentalSeleccionada(null);
  }

  function cerrarModalNuevoEgreso() {
    setModalNuevoEgresoOpen(false);
  }

  async function egresoRegistrado() {
    setModalNuevoEgresoOpen(false);
    await cargar();
    onDataChange?.();
  }

  async function ejecucionActualizada() {
    await cargar();
    onDataChange?.();
  }

  const presupuestoPorCodigo = useMemo(() => {
    return construirIndicePresupuesto(presupuesto);
  }, [presupuesto]);

  const ordenRecienteKey = ordenReciente ? String(ordenReciente) : null;

  const ordenesBase = useMemo(() => {
    if (mostrarSoloOrdenReciente && ordenRecienteKey) {
      return data.filter((o) => String(o.no_orden) === ordenRecienteKey);
    }

    return data;
  }, [data, ordenRecienteKey, mostrarSoloOrdenReciente]);

  const ordenesEnRango = useMemo(() => {
    return ordenesBase.filter((orden) =>
      estaEnRangoFecha(orden.fecha, fechaDesde, fechaHasta)
    );
  }, [fechaDesde, fechaHasta, ordenesBase]);

  const ordenesPorNumero = useMemo(() => {
    const index = new Map<string, Orden>();

    ordenesBase.forEach((orden) => {
      index.set(String(orden.no_orden), orden);
    });

    return index;
  }, [ordenesBase]);

  function abrirModalEjecucionPresupuesto(fila: FilaPresupuestoEgreso) {
    const orden = ordenesPorNumero.get(String(fila.noOrden));

    if (!orden || !puedeEditarEjecucion(orden)) return;

    abrirModalEjecucion(orden);
  }

  const filtered = useMemo(() => {
    if (modo === "presupuesto") return ordenesEnRango;

    const term = search.toLowerCase().trim();

    if (!term) return ordenesEnRango;

    return ordenesEnRango.filter((o) => {
      const noOrden = o.no_orden ?? "";
      const descripcion = o.descripcion ?? "";

      const matchOrden =
        noOrden.toLowerCase().includes(term) ||
        descripcion.toLowerCase().includes(term);

      const matchBeneficiario = o.beneficiarios.some((b) =>
        (b.nombre ?? "").toLowerCase().includes(term)
      );

      return matchOrden || matchBeneficiario;
    });
  }, [modo, ordenesEnRango, search]);

  const presupuestoFiltrado = useMemo(() => {
    const filas = construirFilasPresupuestoEgresos(
      ordenesEnRango,
      presupuestoPorCodigo
    );
    const term = search.toLowerCase().trim();

    if (!term) return filas;

    return filas.filter((fila) =>
      [
        fila.noOrden,
        fila.fecha,
        fila.descripcion,
        fila.codigoPresupuestario,
        fila.referenciaPresupuesto,
        fila.objeto,
        fila.descripcionObjeto,
        fila.nombreObjeto,
      ]
        .join(" ")
        .toLowerCase()
        .includes(term)
    );
  }, [ordenesEnRango, presupuestoPorCodigo, search]);

  const ordenesResumen = modo === "presupuesto" ? ordenesEnRango : filtered;

  const totalHaber = useMemo(() => {
    return ordenesResumen.reduce((acc, o) => acc + o.total_haber, 0);
  }, [ordenesResumen]);

  const totalEjecutado = useMemo(() => {
    return ordenesResumen.reduce((acc, o) => acc + o.total_ejecutado, 0);
  }, [ordenesResumen]);

  const totalDif = totalHaber - totalEjecutado;

  const porcentajeEjecucion =
    totalHaber > 0 ? (totalEjecutado / totalHaber) * 100 : 0;

  const totalPresupuestoAsignado = useMemo(() => {
    return presupuestoFiltrado.reduce(
      (acc, fila) => acc + fila.montoAsignado,
      0
    );
  }, [presupuestoFiltrado]);

  const gruposPresupuesto = useMemo(() => {
    return construirGruposPresupuestoEgresos(presupuestoFiltrado);
  }, [presupuestoFiltrado]);

  const resumenDocumentalPorOrden =
    new Map<number, ResumenDocumentosOrdenPago>();

  resumenDocumental.forEach((item) => {
    resumenDocumentalPorOrden.set(Number(item.noOrden), item);
  });

  function obtenerResumenDocumental(order: Orden) {
    const noOrden = Number(order.no_orden);

    if (!Number.isFinite(noOrden)) return null;

    return resumenDocumentalPorOrden.get(noOrden) ?? null;
  }

  const ordenesPendientes = useMemo(() => {
    return filtered
      .filter(isOrdenNoCompleta)
      .sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia));
  }, [filtered]);

  const ordenesConciliadas = useMemo(() => {
    return filtered.filter((order) => !isOrdenNoCompleta(order));
  }, [filtered]);

  const grupos = [
      {
        id: "pendientes",
        titulo: "Pendientes de conciliación",
        descripcion: "Órdenes con diferencia entre egreso y ejecución.",
        items: ordenesPendientes,
      },
      {
        id: "conciliadas",
        titulo: "Conciliadas",
        descripcion: "Órdenes cuya ejecución coincide con el egreso.",
        items: ordenesConciliadas,
      },
  ];

  const ordenPagoIdSeleccionada = obtenerOrdenPagoId(ordenSeleccionada);

  const noOrdenDocumentalSeleccionada = obtenerOrdenPagoId(
  ordenDocumentalSeleccionada
  );

  return (
    <>
      <PrintStyles />
      <Encabezado />

      <div className="print-root print-page grid h-full grid-rows-[auto_1fr] bg-[#eef1f5] text-slate-800">
        {/* TOP BAR */}
        <header className="operational-header print-header">
          <div
            className={[
              "grid grid-cols-1 border-b border-slate-200",
              sharedView ? "" : "lg:grid-cols-[1fr_auto]",
            ].join(" ")}
          >
            <div className="px-3 py-2.5">
              <div className="text-[10px] uppercase tracking-[0.22em] text-slate-500">
                Sistema financiero municipal
              </div>

              <div className="mt-0.5 flex items-baseline gap-3">
                <h1 className="text-[16px] font-semibold tracking-tight text-slate-950">
                  Órdenes de pago
                </h1>

                <span className="text-[12px] text-slate-500">
                  Control de ejecución presupuestaria
                </span>
              </div>
            </div>

            <div
              className={[
                "grid grid-cols-2 border-t border-slate-200",
                sharedView ? "" : "lg:grid-cols-4 lg:border-l lg:border-t-0",
              ].join(" ")}
            >
              <Metric label="Egreso" value={formatMoney(totalHaber)} />
              <Metric label="Ejecutado" value={formatMoney(totalEjecutado)} />
              <Metric
                label="Diferencia"
                value={formatMoney(totalDif)}
                valueClass={getDiffClass(totalDif)}
              />
              <Metric
                label="Ejecución"
                value={`${porcentajeEjecucion.toFixed(1)}%`}
              />
            </div>
          </div>

          {/* COMMAND BAR */}
          <div
            className={[
              "no-print grid grid-cols-1 gap-3 border-t border-slate-200/70 px-3 py-2",
              sharedView
                ? "sm:grid-cols-2 sm:items-center"
                : "lg:grid-cols-[minmax(280px,380px)_minmax(320px,420px)_auto_1fr_auto_auto_auto] lg:items-center",
            ].join(" ")}
          >
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[12px] text-slate-400">
                Buscar
              </span>

              <input
                className="h-8 w-full rounded-md border border-slate-300 bg-white/85 pl-[58px] pr-3 text-[12px] text-slate-800 outline-none backdrop-blur-md placeholder:text-slate-400 focus:border-slate-700"
                placeholder={
                  modo === "presupuesto"
                    ? "orden, codigo, actividad, obra o descripcion"
                    : "orden, descripcion o beneficiario"
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
              <label className="grid gap-1 text-[11px]">
                <span className="font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Desde
                </span>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(event) => setFechaDesde(event.target.value)}
                  className="h-8 w-full rounded-md border border-slate-300 bg-white/85 px-2 text-[12px] tabular-nums text-slate-800 outline-none backdrop-blur-md focus:border-slate-700"
                />
              </label>

              <label className="grid gap-1 text-[11px]">
                <span className="font-semibold uppercase tracking-[0.12em] text-slate-500">
                  Hasta
                </span>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(event) => setFechaHasta(event.target.value)}
                  className="h-8 w-full rounded-md border border-slate-300 bg-white/85 px-2 text-[12px] tabular-nums text-slate-800 outline-none backdrop-blur-md focus:border-slate-700"
                />
              </label>

              <button
                type="button"
                onClick={() => {
                  setFechaDesde("");
                  setFechaHasta("");
                }}
                disabled={!fechaDesde && !fechaHasta}
                className="h-8 rounded-md border border-slate-300 bg-white/80 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-700 transition hover:border-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Limpiar
              </button>
            </div>

            <div className="flex h-8 rounded-md border border-slate-300 bg-white/75 p-0.5 text-[11px] font-semibold uppercase tracking-[0.12em]">
              <button
                type="button"
                onClick={() => setModo("ordenes")}
                className={[
                  "px-3 transition",
                  modo === "ordenes"
                    ? "bg-slate-950 text-white"
                    : "text-slate-600 hover:bg-slate-100",
                ].join(" ")}
              >
                Ordenes
              </button>

              <button
                type="button"
                onClick={() => setModo("presupuesto")}
                className={[
                  "px-3 transition",
                  modo === "presupuesto"
                    ? "bg-slate-950 text-white"
                    : "text-slate-600 hover:bg-slate-100",
                ].join(" ")}
              >
                Presupuesto
              </button>
            </div>

            <div
              className={[
                "text-[12px] text-slate-500",
                sharedView ? "hidden" : "hidden lg:block",
              ].join(" ")}
            >
              Vista operativa compacta · agrupación automática por estado de
              conciliación.
            </div>

            <div className="flex items-center gap-4 text-[12px]">
              {modo === "presupuesto" ? (
                <>
                  <Counter
                    label="Asignaciones"
                    value={presupuestoFiltrado.length}
                  />
                  <span className="font-semibold tabular-nums text-slate-950">
                    {formatMoney(totalPresupuestoAsignado)}
                  </span>
                </>
              ) : (
                <>
                  <Counter label="Pendientes" value={ordenesPendientes.length} />
                  <Counter
                    label="Conciliadas"
                    value={ordenesConciliadas.length}
                  />
                  <Counter label="Total" value={filtered.length} strong />
                </>
              )}
            </div>

            {mostrarSoloOrdenReciente && ordenRecienteKey && (
              <div className="flex min-w-0 items-center justify-between gap-2 border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800">
                <span className="truncate font-semibold">
                  Orden recien registrada: {ordenRecienteKey}
                </span>

                <button
                  type="button"
                  onClick={() => setMostrarSoloOrdenReciente(false)}
                  className="shrink-0 border border-emerald-300 bg-white px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-800 transition hover:border-emerald-600"
                >
                  Ver todas
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setModalNuevoEgresoOpen(true)}
              className="inline-flex h-8 items-center justify-center gap-2 rounded-md border border-emerald-600 bg-emerald-600 px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-emerald-700"
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo egreso
            </button>

            <button
              type="button"
              onClick={exportarPDF}
              className="h-8 rounded-md border border-slate-900 bg-slate-950 px-4 text-[11px] font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-slate-800"
            >
              Imprimir
            </button>
          </div>
        </header>

        {/* CONTENT */}
        <main className="print-main overflow-hidden p-4">
          <div className="print-table-wrap h-full overflow-auto border border-slate-300 bg-white/65 backdrop-blur-xl">
            {modo === "presupuesto" ? (
              <PresupuestoEgresosTable
                grupos={gruposPresupuesto}
                gruposAbiertos={gruposPresupuestoAbiertos}
                total={totalPresupuestoAsignado}
                formatMoney={formatMoney}
                sharedView={sharedView}
                onToggleGrupo={toggleGrupoPresupuesto}
                onEditarFila={abrirModalEjecucionPresupuesto}
              />
            ) : sharedView ? (
              <div className="space-y-3 p-3">
                {grupos.map((grupo) => (
                  <section key={grupo.id} className="space-y-2">
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2">
                      <div className="min-w-0">
                        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-800">
                          {grupo.titulo}
                        </div>

                        <div className="truncate text-[11px] text-slate-500">
                          {grupo.descripcion}
                        </div>
                      </div>

                      <div className="shrink-0 text-[11px] font-semibold text-slate-600">
                        {grupo.items.length} registros
                      </div>
                    </div>

                    {grupo.items.length === 0 && (
                      <div className="border border-dashed border-slate-300 bg-white/70 px-3 py-5 text-center text-[12px] text-slate-400">
                        No hay registros en esta secciÃ³n.
                      </div>
                    )}

                    {grupo.items.map((order) => {
                      const isOpen = open.includes(order.no_orden);
                      const editableEjecucion = puedeEditarEjecucion(order);
                      const resumenDocs = obtenerResumenDocumental(order);
                      const esOrdenReciente =
                        ordenRecienteKey !== null &&
                        String(order.no_orden) === ordenRecienteKey;

                      return (
                        <article
                          key={order.no_orden}
                          onClick={() => {
                            if (editableEjecucion) {
                              abrirModalEjecucion(order);
                            }
                          }}
                          className={[
                            "border bg-white/85 p-3 shadow-sm transition",
                            editableEjecucion
                              ? "cursor-pointer hover:border-emerald-300 hover:bg-emerald-50/30"
                              : "border-slate-200",
                            esOrdenReciente
                              ? "border-emerald-500 bg-emerald-50/80 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)]"
                              : "border-slate-200",
                          ].join(" ")}
                          title={
                            editableEjecucion
                              ? "Asignar o cambiar ejecucion presupuestaria"
                              : "Orden sin accion de ejecucion"
                          }
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                                  Orden
                                </span>

                                <span className="text-[15px] font-semibold tabular-nums text-slate-950">
                                  {order.no_orden}
                                </span>

                                <span
                                  className={[
                                    "border-l-2 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]",
                                    getEstadoClass(order),
                                  ].join(" ")}
                                >
                                  {getEstadoTexto(order)}
                                </span>
                              </div>

                              <div className="mt-1 text-[11px] tabular-nums text-slate-500">
                                {order.fecha}
                              </div>
                            </div>

                            <div className="flex shrink-0 items-start gap-2">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  abrirModalDocumentos(order);
                                }}
                                className="inline-flex"
                                title="Abrir control documental de la orden"
                              >
                                <AlertaDocumental resumen={resumenDocs} />
                              </button>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggle(order.no_orden);
                                }}
                                className="h-7 w-7 border border-slate-300 bg-white text-[14px] leading-none text-slate-700 transition hover:border-slate-700 hover:bg-slate-100"
                                title={
                                  isOpen ? "Ocultar detalle" : "Ver detalle"
                                }
                              >
                                {isOpen ? "-" : "+"}
                              </button>
                            </div>
                          </div>

                          <div className="mt-3 text-[12px] leading-5 text-slate-700">
                            {order.descripcion}
                          </div>

                          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                            <MiniMetric
                              label="Egreso"
                              value={formatMoney(order.total_haber)}
                            />
                            <MiniMetric
                              label="Ejecutado"
                              value={formatMoney(order.total_ejecutado)}
                            />
                            <MiniMetric
                              label="Diferencia"
                              value={formatMoney(order.diferencia)}
                              valueClass={getDiffClass(order.diferencia)}
                            />
                            <MiniMetric
                              label="Benef."
                              value={String(order.beneficiarios.length)}
                            />
                          </div>

                          {isOpen && (
                            <div
                              className="mt-3"
                              onClick={(event) => event.stopPropagation()}
                            >
                              <DetalleOrden
                                order={order}
                                formatMoney={formatMoney}
                                sharedView={sharedView}
                              />
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </section>
                ))}

                {filtered.length === 0 && (
                  <div className="px-3 py-10 text-center text-[13px] text-slate-500">
                    No se encontraron Ã³rdenes con el criterio ingresado.
                  </div>
                )}
              </div>
            ) : (
            <table
              className={[
                "print-table w-full border-collapse",
                sharedView ? "min-w-full table-fixed text-[11px]" : "min-w-[1360px] text-[12px]",
              ].join(" ")}
            >
              {sharedView && (
                <colgroup>
                  <col className="w-[32px]" />
                  <col className="w-[96px]" />
                  <col className="w-[76px]" />
                  <col className="w-[78px]" />
                  <col className="w-[86px]" />
                  <col className="w-auto" />
                  <col className="w-[104px]" />
                  <col className="w-[104px]" />
                  <col className="w-[104px]" />
                  <col className="w-[58px]" />
                </colgroup>
              )}

              <thead className="sticky top-0 z-20 bg-[#f7f9fb]/95 backdrop-blur-xl">
                <tr className="border-b border-slate-300 text-left text-[10px] uppercase tracking-[0.16em] text-slate-500">
                  <th className={["print-hide py-2 font-semibold", sharedView ? "w-[32px] px-2" : "w-[40px] px-3"].join(" ")}></th>

                  <th className={["py-2 font-semibold", sharedView ? "w-[96px] px-2" : "w-[145px] px-3"].join(" ")}>
                    Estado
                  </th>

                  <th className={["py-2 text-center font-semibold", sharedView ? "w-[76px] px-2" : "w-[120px] px-3"].join(" ")}>
                    Docs.
                  </th>

                  <th className={["py-2 font-semibold", sharedView ? "w-[78px] px-2" : "w-[130px] px-3"].join(" ")}>
                    Orden
                  </th>

                  <th className={["py-2 font-semibold", sharedView ? "w-[86px] px-2" : "w-[110px] px-3"].join(" ")}>
                    Fecha
                  </th>

                  <th className="px-3 py-2 font-semibold">Descripción</th>

                  <th className={["py-2 text-right font-semibold", sharedView ? "w-[104px] px-2" : "w-[150px] px-3"].join(" ")}>
                    Egreso
                  </th>

                  <th className={["py-2 text-right font-semibold", sharedView ? "w-[104px] px-2" : "w-[150px] px-3"].join(" ")}>
                    Ejecutado
                  </th>

                  <th className={["py-2 text-right font-semibold", sharedView ? "w-[104px] px-2" : "w-[150px] px-3"].join(" ")}>
                    Diferencia
                  </th>

                  <th className={["py-2 text-center font-semibold", sharedView ? "w-[58px] px-2" : "w-[95px] px-3"].join(" ")}>
                    Benef.
                  </th>
                </tr>
              </thead>

              <tbody>
                {grupos.map((grupo) => (
                  <Fragment key={grupo.id}>
                    <tr className="print-group-row border-y border-slate-300 bg-slate-100/85">
                      <td colSpan={10} className="px-3 py-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-800">
                              {grupo.titulo}
                            </div>

                            <div className="text-[11px] text-slate-500">
                              {grupo.descripcion}
                            </div>
                          </div>

                          <div className="text-[11px] font-semibold text-slate-600">
                            {grupo.items.length} registros
                          </div>
                        </div>
                      </td>
                    </tr>

                    {grupo.items.length === 0 && (
                      <tr>
                        <td
                          colSpan={10}
                          className="border-b border-slate-200 px-3 py-7 text-center text-[12px] text-slate-400"
                        >
                          No hay registros en esta sección.
                        </td>
                      </tr>
                    )}

                    {grupo.items.map((order) => {
                      const isOpen = open.includes(order.no_orden);
                      const editableEjecucion = puedeEditarEjecucion(order);
                      const resumenDocs = obtenerResumenDocumental(order);
                      const esOrdenReciente =
                        ordenRecienteKey !== null &&
                        String(order.no_orden) === ordenRecienteKey;

                      return (
                        <Fragment key={order.no_orden}>
                          <tr
                            onClick={() => {
                              if (editableEjecucion) {
                                abrirModalEjecucion(order);
                              }
                            }}
                            title={
                              editableEjecucion
                                ? "Asignar o cambiar ejecucion presupuestaria"
                                : "Orden sin accion de ejecucion"
                            }
                            className={[
                              "print-row group border-b border-l-2 border-b-slate-200 bg-white/70 transition-colors",
                              getRowAccent(order),
                              esOrdenReciente
                                ? "border-l-emerald-600 bg-emerald-50/95 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.35)] hover:bg-emerald-100/80"
                                : "",
                              esOrdenReciente
                                ? "cursor-pointer"
                                : editableEjecucion
                                ? "cursor-pointer hover:bg-[#f3fbf8]"
                                : "cursor-default hover:bg-slate-50/95",
                            ].join(" ")}
                          >
                            <td className="print-hide px-3 py-2 align-top">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggle(order.no_orden);
                                }}
                                className="h-6 w-6 border border-slate-300 bg-white text-[14px] leading-none text-slate-700 transition hover:border-slate-700 hover:bg-slate-100"
                                title={
                                  isOpen ? "Ocultar detalle" : "Ver detalle"
                                }
                              >
                                {isOpen ? "-" : "+"}
                              </button>
                            </td>

                            <td className="relative px-3 py-2 align-top">
                              <span
                                className={[
                                  "inline-block border-l-2 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]",
                                  getEstadoClass(order),
                                ].join(" ")}
                              >
                                {getEstadoTexto(order)}
                              </span>

                              {editableEjecucion && (
                                <div className="no-print pointer-events-none absolute left-3 top-[34px] z-30 border border-slate-300 bg-white/95 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-slate-700 opacity-0 shadow-sm backdrop-blur-xl transition-opacity duration-150 group-hover:opacity-100">
                                  Click para editar ejecucion
                                </div>
                              )}
                            </td>

                            <td className="px-3 py-2 text-center align-top">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  abrirModalDocumentos(order);
                                }}
                                className="inline-flex"
                                title="Abrir control documental de la orden"
                              >
                                <AlertaDocumental resumen={resumenDocs} />
                              </button>
                            </td>

                            <td className="px-3 py-2 align-top font-semibold tabular-nums text-slate-950">
                              {order.no_orden}
                            </td>

                            <td className="px-3 py-2 align-top tabular-nums text-slate-600">
                              {order.fecha}
                            </td>

                            <td className="px-3 py-2 align-top text-slate-700">
                              <div className="print-description whitespace-normal break-words leading-5">
                                {order.descripcion}
                              </div>
                            </td>

                            <td className="px-3 py-2 align-top text-right tabular-nums text-slate-800">
                              {formatMoney(order.total_haber)}
                            </td>

                            <td className="px-3 py-2 align-top text-right tabular-nums text-slate-800">
                              {formatMoney(order.total_ejecutado)}
                            </td>

                            <td
                              className={[
                                "px-3 py-2 align-top text-right tabular-nums",
                                getDiffClass(order.diferencia),
                              ].join(" ")}
                            >
                              {formatMoney(order.diferencia)}
                            </td>

                            <td className="px-3 py-2 text-center align-top tabular-nums text-slate-700">
                              {order.beneficiarios.length}
                            </td>
                          </tr>

                          {isOpen && (
                            <tr className="border-b border-slate-300 bg-[#f8fafc]/90">
                              <td colSpan={10} className="px-10 py-3">
                                <DetalleOrden
                                  order={order}
                                  formatMoney={formatMoney}
                                  sharedView={sharedView}
                                />
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-3 py-10 text-center text-[13px] text-slate-500"
                    >
                      No se encontraron órdenes con el criterio ingresado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            )}
          </div>

          <FirmaReporte />
        </main>
      </div>

      <div className="no-print">
        <EjecutarOrdenPagoModal
          open={modalEjecucionOpen}
          ordenPagoId={ordenPagoIdSeleccionada}
          ordenLabel={ordenSeleccionada?.no_orden ?? null}
          montoPendiente={
            ordenSeleccionada ? Math.abs(ordenSeleccionada.diferencia) : 0
          }
          onClose={cerrarModalEjecucion}
          onInsertado={ejecucionActualizada}
        />

        <DocumentosFaltantesOrdenPagoModal
          open={modalDocumentosOpen}
          noOrden={noOrdenDocumentalSeleccionada}
          ordenLabel={ordenDocumentalSeleccionada?.no_orden ?? null}
          ordenDescripcion={ordenDocumentalSeleccionada?.descripcion ?? null}
          ordenFecha={ordenDocumentalSeleccionada?.fecha ?? null}
          totalEgreso={ordenDocumentalSeleccionada?.total_haber ?? null}
          onClose={cerrarModalDocumentos}
          onActualizado={cargar}
        />

        <NuevoEgresoModal
          open={modalNuevoEgresoOpen}
          onClose={cerrarModalNuevoEgreso}
          onInsertado={egresoRegistrado}
        />
      </div>
    </>
  );
}

type NuevoEgresoModalProps = {
  open: boolean;
  onClose: () => void;
  onInsertado: () => void | Promise<void>;
};

function NuevoEgresoModal({ open, onClose, onInsertado }: NuevoEgresoModalProps) {
  const [fecha, setFecha] = useState(obtenerFechaLocal());
  const [noOrden, setNoOrden] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [activaPlanilla, setActivaPlanilla] = useState(false);
  const [noCheque, setNoCheque] = useState("");
  const [montoBanco, setMontoBanco] = useState("");
  const [deduccion, setDeduccion] = useState("");
  const [beneficiarioId, setBeneficiarioId] = useState("");
  const [beneficiarioSeleccionado, setBeneficiarioSeleccionado] =
    useState<BeneficiarioOption | null>(null);
  const [movimientos, setMovimientos] = useState<MovimientoBancoEgreso[]>([]);
  const [cargandoOrden, setCargandoOrden] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  const totalMovimientos = useMemo(() => {
    return movimientos.reduce(
      (acc, item) => acc + Number(item.monto_banco || 0) + Number(item.deduccion || 0),
      0
    );
  }, [movimientos]);

  useEffect(() => {
    if (!open) return;

    async function cargarOrden() {
      try {
        setCargandoOrden(true);
        setError("");
        const siguiente = await obtenerSiguienteNumeroOrden();
        setNoOrden(String(siguiente));
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo obtener el siguiente numero de orden."
        );
      } finally {
        setCargandoOrden(false);
      }
    }

    setFecha(obtenerFechaLocal());
    setDescripcion("");
    setMovimientos([]);
    setNoCheque("");
    setMontoBanco("");
    setDeduccion("");
    setBeneficiarioId("");
    setBeneficiarioSeleccionado(null);
    setMensaje("");
    cargarOrden();
  }, [open]);

  if (!open) return null;

  function agregarMovimiento() {
    setError("");
    setMensaje("");

    const monto = normalizarMonto(montoBanco || "0");
    const deduccionMonto = normalizarMonto(deduccion || "0");

    if (!beneficiarioId.trim()) {
      setError("Debe seleccionar o crear un beneficiario.");
      return;
    }

    if (
      (!Number.isFinite(monto) || monto < 0) ||
      (!Number.isFinite(deduccionMonto) || deduccionMonto < 0) ||
      monto + deduccionMonto <= 0
    ) {
      setError("Debe ingresar un monto valido.");
      return;
    }

    setMovimientos((prev) => [
      ...prev,
      {
        no_cheque: noCheque.trim(),
        monto_banco: Number(monto.toFixed(2)),
        deduccion: Number(deduccionMonto.toFixed(2)),
        nombre: beneficiarioSeleccionado?.nombre ?? "",
        id_beneficiario: beneficiarioId.trim(),
      },
    ]);

    setNoCheque("");
    setMontoBanco("");
    setDeduccion("");
    setBeneficiarioId("");
    setBeneficiarioSeleccionado(null);
  }

  function quitarMovimiento(index: number) {
    setMovimientos((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  async function cargarArchivoBancos(file: File | null) {
    if (!file) return;

    try {
      setError("");
      setMensaje("");

      const extension = file.name.split(".").pop()?.toLowerCase();

      if (extension === "xlsx" || extension === "xls") {
        setError(
          "La carga web actual acepta archivos CSV. Exporte el Excel como CSV y vuelva a cargarlo."
        );
        return;
      }

      const text = await file.text();
      const nuevosMovimientos = movimientosDesdeCsv(text);

      if (nuevosMovimientos.length === 0) {
        setError("El archivo no contiene movimientos validos.");
        return;
      }

      setMovimientos((prev) => [...prev, ...nuevosMovimientos]);
      setMensaje(`Carga de archivo completada: ${nuevosMovimientos.length} movimiento(s).`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo cargar el archivo."
      );
    }
  }

  async function guardarEgreso() {
    try {
      setGuardando(true);
      setError("");
      setMensaje("");

      const orden = Number(noOrden);
      const descripcionNormalizada = descripcion.trim().toUpperCase();

      if (!fecha) {
        setError("El campo fecha es obligatorio.");
        return;
      }

      if (!Number.isFinite(orden) || orden <= 0) {
        setError("El numero de orden es obligatorio.");
        return;
      }

      if (!descripcion.trim()) {
        setError("La descripcion es obligatoria.");
        return;
      }

      if (movimientos.length === 0 && descripcionNormalizada !== "NULA") {
        setError("No existen movimientos bancarios para procesar.");
        return;
      }

      if (descripcionNormalizada === "NULA") {
        const confirmado = window.confirm(
          "La descripcion indica una orden de pago nula. Desea registrarla sin efecto contable?"
        );

        if (!confirmado) return;
      }

      if (
        descripcionNormalizada.includes("NUL") &&
        descripcionNormalizada !== "NULA"
      ) {
        const confirmado = window.confirm(
          "La descripcion contiene un texto similar a NULA. Desea continuar como egreso normal?"
        );

        if (!confirmado) return;
      }

      await insertarEgresoDirecto({
        fecha,
        descripcion,
        noOrden: orden,
        movimientos,
      });

      setMensaje("Egreso procesado correctamente.");
      await onInsertado();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo procesar el egreso."
      );
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[90] bg-slate-950/45 p-3 backdrop-blur-sm md:p-6">
      <div className="mx-auto flex h-full max-w-6xl flex-col">
        <div className="mb-3 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center border border-white/20 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
            title="Cerrar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <section className="overflow-y-auto border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-[10px] font-medium uppercase text-slate-400">
                  Registro operativo
                </div>
                <h2 className="mt-1 text-[18px] font-semibold text-slate-950">
                  Nuevo egreso
                </h2>
              </div>

              <div className="border border-slate-200 bg-slate-50 px-4 py-2 text-right">
                <div className="text-[10px] font-medium uppercase text-slate-500">
                  Total movimientos
                </div>
                <div className="mt-1 text-[16px] font-semibold tabular-nums text-slate-950">
                  {formatMoney(totalMovimientos)}
                </div>
              </div>
            </div>
          </div>

          <div className="p-5">
            <div className="grid gap-4 lg:grid-cols-[170px_170px_1fr_auto]">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Fecha
                </label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(event) => setFecha(event.target.value)}
                  className="h-10 w-full border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  No. orden
                </label>
                <input
                  value={noOrden}
                  onChange={(event) => setNoOrden(event.target.value)}
                  disabled={cargandoOrden}
                  className="h-10 w-full border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">
                  Descripcion
                </label>
                <input
                  value={descripcion}
                  onChange={(event) => setDescripcion(event.target.value)}
                  placeholder="Detalle de la orden de pago"
                  className="h-10 w-full border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
                />
              </div>

              <label className="flex h-10 items-center gap-2 self-end border border-slate-200 bg-slate-50 px-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={activaPlanilla}
                  onChange={(event) => {
                    const activo = event.target.checked;
                    setActivaPlanilla(activo);
                    window.alert(
                      activo
                        ? "Ingreso de planillas de pago activado"
                        : "Ingreso de planillas de pago desactivado"
                    );
                  }}
                />
                Planilla
              </label>
            </div>

            <div className="mt-5 border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 flex flex-col gap-3 border border-slate-200 bg-white px-3 py-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Carga masiva
                  </div>
                  <div className="mt-1 text-[12px] text-slate-500">
                    CSV con columnas: cheque, nombre, ID, monto, deduccion.
                  </div>
                </div>

                <label className="inline-flex h-9 cursor-pointer items-center justify-center gap-2 border border-slate-900 bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700">
                  <Upload className="h-4 w-4" />
                  Cargar CSV
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls,text/csv"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      cargarArchivoBancos(file);
                      event.target.value = "";
                    }}
                  />
                </label>
              </div>

              <div className="grid gap-3 lg:grid-cols-[140px_150px_150px_1fr_auto] lg:items-end">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    No. cheque
                  </label>
                  <input
                    value={noCheque}
                    onChange={(event) => setNoCheque(event.target.value)}
                    className="h-10 w-full border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Banco
                  </label>
                  <input
                    inputMode="decimal"
                    value={montoBanco}
                    onChange={(event) => setMontoBanco(event.target.value)}
                    placeholder="0.00"
                    className="h-10 w-full border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">
                    Deduccion
                  </label>
                  <input
                    inputMode="decimal"
                    value={deduccion}
                    onChange={(event) => setDeduccion(event.target.value)}
                    placeholder="0.00"
                    className="h-10 w-full border border-slate-200 bg-white px-3 text-sm outline-none focus:border-emerald-500"
                  />
                </div>

                <SelectorBeneficiario
                  value={beneficiarioId}
                  label="Beneficiario"
                  placeholder="Buscar por nombre o identidad"
                  allowCreate
                  onSelect={(beneficiario) => {
                    setBeneficiarioId(beneficiario.id);
                    setBeneficiarioSeleccionado(beneficiario);
                  }}
                  onClear={() => {
                    setBeneficiarioId("");
                    setBeneficiarioSeleccionado(null);
                  }}
                />

                <button
                  type="button"
                  onClick={agregarMovimiento}
                  className="inline-flex h-10 items-center justify-center gap-2 border border-slate-900 bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  <Plus className="h-4 w-4" />
                  Agregar
                </button>
              </div>

              <div className="mt-4 overflow-hidden border border-slate-200 bg-white">
                {movimientos.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500">
                    No hay movimientos agregados.
                  </div>
                ) : (
                  <table className="w-full min-w-[760px] border-collapse text-left text-sm">
                    <thead className="bg-slate-100 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-3 py-2 font-semibold">Cheque</th>
                        <th className="px-3 py-2 font-semibold">Beneficiario</th>
                        <th className="px-3 py-2 font-semibold">Nombre</th>
                        <th className="px-3 py-2 text-right font-semibold">
                          Banco
                        </th>
                        <th className="px-3 py-2 text-right font-semibold">
                          Deduccion
                        </th>
                        <th className="px-3 py-2 text-right font-semibold">
                          Accion
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientos.map((movimiento, index) => (
                        <tr key={`${movimiento.id_beneficiario}-${index}`} className="border-t">
                          <td className="px-3 py-2 tabular-nums text-slate-600">
                            {movimiento.no_cheque || "0"}
                          </td>
                          <td className="px-3 py-2 text-slate-700">
                            {movimiento.id_beneficiario}
                          </td>
                          <td className="px-3 py-2 text-slate-600">
                            {movimiento.nombre || "Manual"}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-950">
                            {formatMoney(movimiento.monto_banco)}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-950">
                            {formatMoney(movimiento.deduccion)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => quitarMovimiento(index)}
                              className="inline-flex h-8 w-8 items-center justify-center border border-red-200 text-red-600 transition hover:bg-red-50"
                              title="Quitar movimiento"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {error && (
              <div className="mt-4 border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {mensaje && (
              <div className="mt-4 border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {mensaje}
              </div>
            )}

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="mr-3 h-10 border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={guardarEgreso}
                disabled={guardando || cargandoOrden}
                className="inline-flex h-10 items-center justify-center gap-2 border border-emerald-600 bg-emerald-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-300"
              >
                <Save className="h-4 w-4" />
                {guardando ? "Guardando..." : "Guardar egreso"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

type AlertaDocumentalProps = {
  resumen: ResumenDocumentosOrdenPago | null;
};

function AlertaDocumental({ resumen }: AlertaDocumentalProps) {
  const totalFaltantes = resumen?.totalFaltantes ?? 0;
  const totalSubsanados = resumen?.totalSubsanados ?? 0;

  if (totalFaltantes <= 0 && totalSubsanados <= 0) {
    return (
      <span className="inline-flex min-w-[82px] items-center justify-center border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
        Sin docs
      </span>
    );
  }

  if (totalFaltantes > 0) {
    return (
      <span
        className="inline-flex min-w-[82px] items-center justify-center border border-amber-400 bg-amber-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-amber-700"
        title={`${totalFaltantes} documento(s) faltante(s)`}
      >
        {totalFaltantes} falt.
      </span>
    );
  }

  return (
    <span
      className="inline-flex min-w-[82px] items-center justify-center border border-emerald-400 bg-emerald-50 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-emerald-700"
      title={`${totalSubsanados} documento(s) subsanado(s)`}
    >
      Subsanado
    </span>
  );
}

type MetricProps = {
  label: string;
  value: string;
  valueClass?: string;
};

function Metric({
  label,
  value,
  valueClass = "text-slate-950",
}: MetricProps) {
  return (
    <div className="min-w-[145px] border-r border-slate-200 px-4 py-3 last:border-r-0">
      <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">
        {label}
      </div>

      <div
        className={`mt-1 whitespace-nowrap text-[13px] font-semibold tabular-nums ${valueClass}`}
      >
        {value}
      </div>
    </div>
  );
}

type CounterProps = {
  label: string;
  value: number;
  strong?: boolean;
};

function Counter({ label, value, strong = false }: CounterProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-slate-500">{label}</span>
      <span
        className={[
          "tabular-nums",
          strong
            ? "font-semibold text-slate-950"
            : "font-semibold text-slate-700",
        ].join(" ")}
      >
        {value}
      </span>
    </div>
  );
}

type MiniMetricProps = {
  label: string;
  value: string;
  valueClass?: string;
};

function MiniMetric({ label, value, valueClass = "" }: MiniMetricProps) {
  return (
    <div className="border border-slate-200 bg-slate-50/80 px-2.5 py-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400">
        {label}
      </div>

      <div
        className={[
          "mt-1 truncate text-[12px] font-semibold tabular-nums text-slate-950",
          valueClass,
        ].join(" ")}
      >
        {value}
      </div>
    </div>
  );
}

function PresupuestoEgresosTable({
  grupos,
  gruposAbiertos,
  total,
  formatMoney,
  sharedView,
  onToggleGrupo,
  onEditarFila,
}: {
  grupos: GrupoPresupuestoEgreso[];
  gruposAbiertos: string[];
  total: number;
  formatMoney: (value: number) => string;
  sharedView?: boolean;
  onToggleGrupo: (id: string) => void;
  onEditarFila: (fila: FilaPresupuestoEgreso) => void;
}) {
  return (
    <table
      className={[
        "print-table w-full border-collapse",
        sharedView ? "min-w-[1020px] text-[11px]" : "min-w-[1320px] text-[12px]",
      ].join(" ")}
    >
      <thead className="sticky top-0 z-20 bg-[#f7f9fb]/95 backdrop-blur-xl">
        <tr className="border-b border-slate-300 text-left text-[10px] uppercase tracking-[0.16em] text-slate-500">
          <th className="w-[110px] px-3 py-2 font-semibold">Orden</th>
          <th className="w-[110px] px-3 py-2 font-semibold">Fecha</th>
          <th className="w-[240px] px-3 py-2 font-semibold">
            Objeto del gasto
          </th>
          <th className="w-[260px] px-3 py-2 font-semibold">
            Codigo presupuestario
          </th>
          <th className="w-[240px] px-3 py-2 font-semibold">
            Actividad / obra
          </th>
          <th className="px-3 py-2 font-semibold">Descripcion</th>
          <th className="w-[150px] px-3 py-2 text-right font-semibold">
            Monto asignado
          </th>
        </tr>
      </thead>

      <tbody>
        {grupos.map((grupo) => {
          const abierto = gruposAbiertos.includes(grupo.id);

          return (
            <Fragment key={grupo.id}>
              <tr className="print-group-row border-y border-slate-300 bg-slate-100/85">
                <td colSpan={7} className="px-3 py-2">
                  <button
                    type="button"
                    onClick={() => onToggleGrupo(grupo.id)}
                    className="grid w-full grid-cols-[28px_1fr_auto_auto] items-center gap-3 text-left"
                  >
                    <span className="no-print flex h-6 w-6 items-center justify-center border border-slate-300 bg-white text-[14px] leading-none text-slate-700">
                      {abierto ? "-" : "+"}
                    </span>

                    <span className="min-w-0">
                      <span className="block truncate text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-800">
                        {grupo.titulo}
                      </span>
                      <span className="block text-[11px] text-slate-500">
                        {grupo.subtitulo} · {grupo.items.length} asignacion(es)
                      </span>
                    </span>

                    <span className="text-[11px] font-semibold text-slate-600">
                      {grupo.items.length} registros
                    </span>

                    <span className="text-right text-[12px] font-semibold tabular-nums text-slate-950">
                      {formatMoney(grupo.total)}
                    </span>
                  </button>
                </td>
              </tr>

              {abierto &&
                grupo.items.map((fila) => (
                  <tr
                    key={fila.id}
                    onClick={() => {
                      if (fila.editable) {
                        onEditarFila(fila);
                      }
                    }}
                    className={[
                      "print-row border-b border-slate-200 bg-white/70 transition-colors hover:bg-[#f3fbf8]",
                      fila.editable ? "cursor-pointer" : "",
                    ].join(" ")}
                    title={
                      fila.editable
                        ? "Editar ejecucion presupuestaria de la orden"
                        : "Orden sin accion de ejecucion"
                    }
                  >
                    <td className="px-3 py-2 align-top font-semibold tabular-nums text-slate-950">
                      {fila.noOrden}
                    </td>

                    <td className="px-3 py-2 align-top tabular-nums text-slate-600">
                      {fila.fecha}
                    </td>

                    <td className="px-3 py-2 align-top text-slate-800">
                      <div className="font-semibold">{fila.nombreObjeto}</div>
                    </td>

                    <td className="px-3 py-2 align-top">
                      <div className="break-words font-semibold text-slate-900">
                        {fila.codigoPresupuestario || "Sin codigo"}
                      </div>
                    </td>

                    <td className="px-3 py-2 align-top text-slate-700">
                      <div className="print-description whitespace-normal break-words leading-5">
                        {fila.referenciaPresupuesto}
                      </div>
                    </td>

                    <td className="px-3 py-2 align-top text-slate-700">
                      <div className="print-description whitespace-normal break-words leading-5">
                        {fila.descripcion}
                      </div>
                    </td>

                    <td className="px-3 py-2 text-right align-top font-semibold tabular-nums text-slate-950">
                      {formatMoney(fila.montoAsignado)}
                    </td>
                  </tr>
                ))}
            </Fragment>
          );
        })}

        {grupos.length === 0 && (
          <tr>
            <td
              colSpan={7}
              className="px-3 py-10 text-center text-[13px] text-slate-500"
            >
              No se encontraron asignaciones presupuestarias para mostrar.
            </td>
          </tr>
        )}
      </tbody>

      <tfoot>
        <tr className="border-t border-slate-300 bg-slate-50 text-[12px] font-semibold text-slate-900">
          <td colSpan={6} className="px-3 py-2 text-right">
            Total asignado
          </td>
          <td className="px-3 py-2 text-right tabular-nums">
            {formatMoney(total)}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

function FirmaReporte() {
  return (
    <div className="print-only print-signature">
      <div className="ml-auto w-[340px] text-center text-slate-900">
        <div className="mb-2 border-t border-slate-900"></div>

        <div className="text-[12px] font-semibold">
          María de los Ángeles Arévalo Cuello
        </div>

        <div className="text-[11px] uppercase tracking-[0.18em] text-slate-600">
          Tesorera Municipal
        </div>
      </div>
    </div>
  );
}

type DetalleOrdenProps = {
  order: Orden;
  formatMoney: (value: number) => string;
  sharedView?: boolean;
};

function DetalleOrden({
  order,
  formatMoney,
  sharedView = false,
}: DetalleOrdenProps) {
  return (
    <div className="border border-slate-300 bg-white/80 backdrop-blur-xl">
      <div className="grid grid-cols-[1fr_auto] border-b border-slate-300 bg-slate-100/80 px-3 py-2">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">
            Detalle de ejecución
          </div>

          <div className="text-[11px] text-slate-500">
            Beneficiarios, egreso bancario y partidas ejecutadas.
          </div>
        </div>

        <div className="text-right text-[11px] text-slate-500">
          Orden{" "}
          <span className="font-semibold tabular-nums text-slate-800">
            {order.no_orden}
          </span>
        </div>
      </div>

      <div className="divide-y divide-slate-200">
        {order.beneficiarios.map((b) => (
          <div
            key={b.id}
            className={[
              "grid bg-white/70",
              sharedView
                ? "grid-cols-1"
                : "grid-cols-[300px_160px_1fr]",
            ].join(" ")}
          >
            <div
              className={[
                "px-3 py-2",
                sharedView
                  ? "border-b border-slate-200"
                  : "border-r border-slate-200",
              ].join(" ")}
            >
              <div className="text-[12px] font-semibold text-slate-900">
                {b.nombre}
              </div>

              <div className="mt-0.5 text-[11px] text-slate-500">
                ID: {b.id}
              </div>
            </div>

            <div
              className={[
                "px-3 py-2",
                sharedView
                  ? "border-b border-slate-200 text-left"
                  : "border-r border-slate-200 text-right",
              ].join(" ")}
            >
              <div className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                Egreso
              </div>

              <div className="mt-0.5 text-[12px] font-semibold tabular-nums text-slate-950">
                {formatMoney(b.haber)}
              </div>
            </div>

            <div>
              {b.ejecuciones.length > 0 ? (
                <table className="w-full table-fixed border-collapse text-[12px]">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/90 text-[10px] uppercase tracking-[0.14em] text-slate-500">
                      <th className="px-3 py-2 text-left font-semibold">
                        Código presupuestario
                      </th>

                      <th
                        className={[
                          "px-3 py-2 text-right font-semibold",
                          sharedView ? "w-[120px]" : "w-[160px]",
                        ].join(" ")}
                      >
                        Ejecutado
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {b.ejecuciones.map((e) => (
                      <tr
                        key={e.id}
                        className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50"
                      >
                        <td className="break-words px-3 py-2 text-slate-700">
                          {e.codigo_presupuestario}
                        </td>

                        <td className="px-3 py-2 text-right font-semibold tabular-nums text-slate-950">
                          {formatMoney(e.monto_ejecutado)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="px-3 py-3 text-[12px] text-slate-400">
                  Sin ejecución presupuestaria asociada.
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
