"use client";

import { useEffect, useMemo, useState } from "react";
import { ClipboardPaste, Plus, Save, Trash2 } from "lucide-react";
import { registrarModificacionesPresupuesto } from "@/services/modificacionesPresupuesto";
import type { SolicitudModificacionPresupuesto } from "./PresupuestoTree";

type Props = {
  solicitud: SolicitudModificacionPresupuesto | null;
  onRefreshData?: () => Promise<void> | void;
};

type ModificacionPendiente = {
  id: string;
  codigo: string;
  nombre: string;
  ampliacion: number;
  disminucion: number;
};

const TEXTO_PREDETERMINADO_STORAGE_KEY =
  "modificaciones-presupuesto-texto-predeterminado";

function formatMoney(value: number) {
  return Number(value ?? 0).toLocaleString("es-HN", {
    style: "currency",
    currency: "HNL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function parseAmount(value: string) {
  const cleanValue = value
    .replace(/L\./gi, "")
    .replace(/\s/g, "")
    .replace(/,/g, "")
    .replace(/^\((.*)\)$/, "-$1")
    .trim();
  const parsed = Number(cleanValue);

  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function splitPastedRow(row: string) {
  if (row.includes("\t")) return row.split("\t");
  if (row.includes(";")) return row.split(";");
  return row.split(",");
}

function cleanCode(value: string) {
  return value.split(" / ")[0].trim();
}

function isHeaderRow(cells: string[]) {
  const headers = cells.map(normalizeText);

  return headers.some((header) =>
    [
      "codigo",
      "codigo presupuestario",
      "ampliacion",
      "disminucion",
      "tipo",
      "monto",
    ].includes(header)
  );
}

function findHeaderIndex(headers: string[], candidates: string[]) {
  return headers.findIndex((header) => candidates.includes(header));
}

function parseBulkRows(
  text: string,
  defaultType: "ampliacion" | "disminucion"
) {
  const rawRows = text
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);

  if (rawRows.length === 0) {
    return { items: [] as ModificacionPendiente[], rejected: 0 };
  }

  const firstCells = splitPastedRow(rawRows[0]).map((cell) => cell.trim());
  const hasHeaders = isHeaderRow(firstCells);
  const headers = hasHeaders ? firstCells.map(normalizeText) : [];
  const rows = hasHeaders ? rawRows.slice(1) : rawRows;
  const codeIndex = hasHeaders
    ? findHeaderIndex(headers, ["codigo", "codigo presupuestario"])
    : 0;
  const ampliacionIndex = hasHeaders
    ? findHeaderIndex(headers, ["ampliacion", "ampliacion"])
    : 1;
  const disminucionIndex = hasHeaders
    ? findHeaderIndex(headers, ["disminucion"])
    : 2;
  const tipoIndex = hasHeaders ? findHeaderIndex(headers, ["tipo"]) : 1;
  const montoIndex = hasHeaders ? findHeaderIndex(headers, ["monto"]) : 2;

  let rejected = 0;

  const items = rows.flatMap((row, index) => {
    const cells = splitPastedRow(row).map((cell) => cell.trim());
    const codigo = cleanCode(cells[codeIndex] ?? "");

    let ampliacion = 0;
    let disminucion = 0;

    const tipoCell = normalizeText(cells[tipoIndex] ?? "");
    const hasTipoMonto =
      (tipoCell === "ampliacion" || tipoCell === "disminucion") &&
      montoIndex >= 0;

    if (hasTipoMonto) {
      const monto = parseAmount(cells[montoIndex] ?? "");

      if (tipoCell === "ampliacion") {
        ampliacion = monto;
      } else {
        disminucion = monto;
      }
    } else {
      const ampliacionValue = parseAmount(cells[ampliacionIndex] ?? "");
      const disminucionValue = parseAmount(cells[disminucionIndex] ?? "");

      ampliacion = Number.isFinite(ampliacionValue) ? ampliacionValue : 0;
      disminucion = Number.isFinite(disminucionValue) ? disminucionValue : 0;

      if (!hasHeaders && cells.length === 2) {
        const monto = parseAmount(cells[1] ?? "");

        ampliacion = defaultType === "ampliacion" ? monto : 0;
        disminucion = defaultType === "disminucion" ? monto : 0;
      }
    }

    if (!codigo || ampliacion < 0 || disminucion < 0 || ampliacion + disminucion <= 0) {
      rejected += 1;
      return [];
    }

    return [
      {
        id: `${codigo}-masivo-${Date.now()}-${index}`,
        codigo,
        nombre: "",
        ampliacion,
        disminucion,
      },
    ];
  });

  return { items, rejected };
}

export default function ModificacionesPresupuestoPanel({
  solicitud,
  onRefreshData,
}: Props) {
  const [textoPredeterminado, setTextoPredeterminado] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [codigo, setCodigo] = useState("");
  const [nombreCodigo, setNombreCodigo] = useState("");
  const [tipo, setTipo] = useState<"ampliacion" | "disminucion">("ampliacion");
  const [monto, setMonto] = useState("");
  const [textoMasivo, setTextoMasivo] = useState("");
  const [pendientes, setPendientes] = useState<ModificacionPendiente[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    const textoGuardado = window.sessionStorage.getItem(
      TEXTO_PREDETERMINADO_STORAGE_KEY
    );

    if (!textoGuardado) return;

    setTextoPredeterminado(textoGuardado);
  }, []);

  useEffect(() => {
    if (!solicitud) return;

    setCodigo(solicitud.codigo);
    setNombreCodigo(solicitud.nombre);
    setTipo(solicitud.tipo);
    setMonto("");
    setError("");
    setMensaje("");
  }, [solicitud]);

  const totalAmpliacion = useMemo(
    () => pendientes.reduce((acc, item) => acc + item.ampliacion, 0),
    [pendientes]
  );

  const totalDisminucion = useMemo(
    () => pendientes.reduce((acc, item) => acc + item.disminucion, 0),
    [pendientes]
  );

  function agregarPendiente() {
    const montoNumerico = parseAmount(monto);

    if (!codigo) {
      setError("Seleccione un codigo desde los botones Ampliar o Disminuir.");
      return;
    }

    if (!Number.isFinite(montoNumerico) || montoNumerico <= 0) {
      setError("Ingrese un monto valido mayor a cero.");
      return;
    }

    setPendientes((actual) => [
      ...actual,
      {
        id: `${codigo}-${tipo}-${Date.now()}`,
        codigo,
        nombre: nombreCodigo,
        ampliacion: tipo === "ampliacion" ? montoNumerico : 0,
        disminucion: tipo === "disminucion" ? montoNumerico : 0,
      },
    ]);
    setMonto("");
    setError("");
    setMensaje("");
  }

  function cargarPegadoMasivo() {
    const { items, rejected } = parseBulkRows(textoMasivo, tipo);

    if (items.length === 0) {
      setError(
        "No se encontraron filas validas. Use columnas: codigo, ampliacion, disminucion; o codigo, tipo, monto."
      );
      setMensaje("");
      return;
    }

    setPendientes((actual) => [...actual, ...items]);
    setTextoMasivo("");
    setError("");
    setMensaje(
      rejected > 0
        ? `Se cargaron ${items.length} filas. ${rejected} filas fueron omitidas.`
        : `Se cargaron ${items.length} filas.`
    );
  }

  function quitarPendiente(id: string) {
    setPendientes((actual) => actual.filter((item) => item.id !== id));
  }

  function actualizarTextoPredeterminado(value: string) {
    setTextoPredeterminado(value);
    setError("");
    setMensaje("");

    if (value) {
      window.sessionStorage.setItem(TEXTO_PREDETERMINADO_STORAGE_KEY, value);
    } else {
      window.sessionStorage.removeItem(TEXTO_PREDETERMINADO_STORAGE_KEY);
    }
  }

  async function registrar() {
    const descripcionFinal = [textoPredeterminado.trim(), descripcion.trim()]
      .filter(Boolean)
      .join(" ");

    if (!descripcionFinal) {
      setError("Debe ingresar una descripcion.");
      return;
    }

    if (pendientes.length === 0) {
      setError("No hay modificaciones para registrar.");
      return;
    }

    setSaving(true);
    setError("");
    setMensaje("");

    try {
      const response = await registrarModificacionesPresupuesto({
        descripcion: descripcionFinal,
        modificaciones: pendientes.map((item) => ({
          codigo: item.codigo,
          ampliacion: item.ampliacion,
          disminucion: item.disminucion,
        })),
      });

      setMensaje(
        `Modificacion ${response.idModificacion} registrada con ${response.registros} registros.`
      );
      setDescripcion("");
      setPendientes([]);
      setCodigo("");
      setNombreCodigo("");
      setMonto("");
      await onRefreshData?.();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "No se pudieron registrar las modificaciones."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 px-4 py-4">
        {error && (
          <div className="border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] font-medium text-rose-700">
            {error}
          </div>
        )}

        {mensaje && (
          <div className="border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-800">
            {mensaje}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[240px_1fr]">
          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Texto base
            </span>
            <input
              value={textoPredeterminado}
              onChange={(event) =>
                actualizarTextoPredeterminado(event.target.value)
              }
              className="h-9 w-full border border-slate-300 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-[#00be87]"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Descripcion
            </span>
            <input
              value={descripcion}
              onChange={(event) => setDescripcion(event.target.value)}
              className="h-9 w-full border border-slate-300 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-[#00be87]"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[1fr_150px_160px_auto]">
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Codigo seleccionado
            </div>
            <div className="flex h-9 items-center border border-slate-300 bg-slate-50 px-3 text-[12px] text-slate-700">
              {codigo ? `${codigo} / ${nombreCodigo}` : "Use Ampliar o Disminuir en el arbol"}
            </div>
          </div>

          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Tipo
            </span>
            <select
              value={tipo}
              onChange={(event) =>
                setTipo(event.target.value as "ampliacion" | "disminucion")
              }
              className="h-9 w-full border border-slate-300 bg-white px-2 text-[12px] text-slate-900 outline-none transition focus:border-[#00be87]"
            >
              <option value="ampliacion">Ampliacion</option>
              <option value="disminucion">Disminucion</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Monto
            </span>
            <input
              value={monto}
              onChange={(event) => setMonto(event.target.value)}
              inputMode="decimal"
              className="h-9 w-full border border-slate-300 bg-white px-3 text-[12px] text-slate-900 outline-none transition focus:border-[#00be87]"
            />
          </label>

          <div className="flex items-end">
            <button
              type="button"
              onClick={agregarPendiente}
              className="inline-flex h-9 w-full items-center justify-center gap-2 border border-slate-300 bg-white px-3 text-[12px] font-semibold text-slate-700 transition hover:border-[#00be87] hover:text-[#006b55]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Agregar
            </button>
          </div>
        </div>

        <div className="border border-slate-200 bg-slate-50/70 p-3">
          <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <label className="block flex-1">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Pegado masivo
              </span>
              <textarea
                value={textoMasivo}
                onChange={(event) => setTextoMasivo(event.target.value)}
                placeholder={
                  "codigo\tampliacion\tdisminucion\n03 00 ... 10\t1000\t0"
                }
                className="min-h-[92px] w-full resize-y border border-slate-300 bg-white px-3 py-2 font-mono text-[12px] text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#00be87]"
              />
            </label>

            <button
              type="button"
              onClick={cargarPegadoMasivo}
              disabled={!textoMasivo.trim()}
              className="inline-flex h-9 shrink-0 items-center justify-center gap-2 border border-slate-300 bg-white px-3 text-[12px] font-semibold text-slate-700 transition hover:border-[#00be87] hover:text-[#006b55] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ClipboardPaste className="h-4 w-4" aria-hidden="true" />
              Cargar pegado
            </button>
          </div>

          <div className="text-[11px] leading-relaxed text-slate-500">
            Formatos aceptados: codigo + ampliacion + disminucion, codigo +
            tipo + monto, o codigo + monto usando el tipo seleccionado arriba.
          </div>
        </div>

        <div className="overflow-auto border border-slate-200">
          <table className="min-w-[760px] w-full border-collapse text-[12px]">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-[0.14em] text-slate-500">
              <tr>
                <th className="border-b border-slate-200 px-3 py-2 text-left">
                  Codigo
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-right">
                  Ampliacion
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-right">
                  Disminucion
                </th>
                <th className="border-b border-slate-200 px-3 py-2 text-center">
                  Accion
                </th>
              </tr>
            </thead>
            <tbody>
              {pendientes.length > 0 ? (
                pendientes.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="px-3 py-2 text-slate-800">
                      <div className="font-semibold">{item.codigo}</div>
                      <div className="truncate text-[11px] text-slate-500">
                        {item.nombre}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-emerald-800">
                      {formatMoney(item.ampliacion)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-rose-700">
                      {formatMoney(item.disminucion)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => quitarPendiente(item.id)}
                        className="inline-flex h-8 w-8 items-center justify-center border border-slate-300 text-slate-600 transition hover:border-rose-300 hover:text-rose-700"
                        title="Quitar"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        <span className="sr-only">Quitar</span>
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-8 text-center text-[12px] text-slate-400"
                  >
                    No hay modificaciones agregadas.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-4 text-[12px]">
            <span className="text-slate-500">
              Ampliacion:{" "}
              <strong className="text-emerald-800">
                {formatMoney(totalAmpliacion)}
              </strong>
            </span>
            <span className="text-slate-500">
              Disminucion:{" "}
              <strong className="text-rose-700">
                {formatMoney(totalDisminucion)}
              </strong>
            </span>
          </div>

          <button
            type="button"
            onClick={registrar}
            disabled={saving}
            className="inline-flex h-9 items-center justify-center gap-2 border border-[#008b70] bg-[#008b70] px-3 text-[12px] font-semibold text-white transition hover:bg-[#00715d] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save className="h-4 w-4" aria-hidden="true" />
            Registrar modificaciones
          </button>
        </div>
    </div>
  );
}
