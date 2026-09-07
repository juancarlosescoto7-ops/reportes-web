export type FilaReporteEgresosParaExcel = {
  noOrden: string;
  fecha: string;
  descripcion: string;
  cheque: string;
  beneficiario: string;
  monto: number;
};

const ENCABEZADOS = [
  "No. de orden",
  "Fecha",
  "Descripción",
  "Cheque",
  "Beneficiario",
  "Monto",
];

function limpiarCelda(value: unknown) {
  return String(value ?? "")
    .replace(/[\t\r\n]+/g, " ")
    .trim();
}

function escaparHtml(value: unknown) {
  return limpiarCelda(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function protegerTextoParaExcel(value: unknown, siempreTexto = false) {
  const texto = limpiarCelda(value);

  if (!texto) return "";
  if (siempreTexto || /^[=+\-@]/.test(texto)) return `'${texto}`;

  return texto;
}

function formatearMonto(value: number) {
  return (Number.isFinite(value) ? value : 0).toFixed(2);
}

function celdaHtmlTexto(value: unknown, alineacion: "left" | "center" = "left") {
  return `<td style="border:1px solid #cbd5e1;padding:6px 8px;text-align:${alineacion};vertical-align:top;mso-number-format:'\\@';">${escaparHtml(
    value
  )}</td>`;
}

function celdaHtmlMonto(value: number, negrita = false) {
  return `<td style="border:1px solid #cbd5e1;padding:6px 8px;text-align:right;vertical-align:top;mso-number-format:'0.00';${
    negrita ? "font-weight:700;background:#f1f5f9;" : ""
  }">${formatearMonto(value)}</td>`;
}

export function construirTablaReporteEgresosParaExcel(
  filas: FilaReporteEgresosParaExcel[]
) {
  const total = filas.reduce((acumulado, fila) => acumulado + fila.monto, 0);
  const filasTexto = filas.map((fila) =>
    [
      protegerTextoParaExcel(fila.noOrden, true),
      protegerTextoParaExcel(fila.fecha),
      protegerTextoParaExcel(fila.descripcion),
      protegerTextoParaExcel(fila.cheque, true),
      protegerTextoParaExcel(fila.beneficiario),
      formatearMonto(fila.monto),
    ].join("\t")
  );
  const texto = [
    ENCABEZADOS.join("\t"),
    ...filasTexto,
    ["", "", "", "", "Total", formatearMonto(total)].join("\t"),
  ].join("\r\n");
  const encabezadosHtml = ENCABEZADOS.map(
    (encabezado) =>
      `<th style="border:1px solid #94a3b8;padding:7px 8px;background:#0f172a;color:#ffffff;text-align:left;font-weight:700;">${escaparHtml(
        encabezado
      )}</th>`
  ).join("");
  const filasHtml = filas
    .map(
      (fila) =>
        `<tr>${celdaHtmlTexto(fila.noOrden, "center")}${celdaHtmlTexto(
          fila.fecha,
          "center"
        )}${celdaHtmlTexto(fila.descripcion)}${celdaHtmlTexto(
          fila.cheque,
          "center"
        )}${celdaHtmlTexto(fila.beneficiario)}${celdaHtmlMonto(
          fila.monto
        )}</tr>`
    )
    .join("");
  const filaTotalHtml = `<tr><td colspan="4" style="border:1px solid #cbd5e1;background:#f1f5f9;"></td><td style="border:1px solid #cbd5e1;padding:6px 8px;text-align:right;font-weight:700;background:#f1f5f9;">Total</td>${celdaHtmlMonto(
    total,
    true
  )}</tr>`;
  const html = `<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:12px;"><thead><tr>${encabezadosHtml}</tr></thead><tbody>${filasHtml}${filaTotalHtml}</tbody></table>`;

  return { texto, html, total };
}
