export function obtenerFechaLocal() {
  const fecha = new Date();
  const year = fecha.getFullYear();
  const month = String(fecha.getMonth() + 1).padStart(2, "0");
  const day = String(fecha.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function formatMoney(value: number) {
  return Number(value ?? 0).toLocaleString("es-HN", {
    style: "currency",
    currency: "HNL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function normalizarMonto(value: string) {
  let texto = value.trim().replace(/\s/g, "");

  if (texto.includes(",") && texto.includes(".")) {
    texto =
      texto.lastIndexOf(",") > texto.lastIndexOf(".")
        ? texto.replace(/\./g, "").replace(",", ".")
        : texto.replace(/,/g, "");
  } else if (texto.includes(",")) {
    texto = texto.replace(",", ".");
  }

  return Number(texto);
}

export function redondearMoneda(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}
