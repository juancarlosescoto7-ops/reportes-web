export function validarRubroIngresoSaft(codigo: unknown, descripcion: unknown) {
  const codigoSaft = typeof codigo === "string"
    ? codigo.trim().replace(/^'+/, "").replace(/\.0+$/, "")
    : "";
  const descripcionSaft = typeof descripcion === "string" ? descripcion.trim() : "";

  if (!codigoSaft || codigoSaft.length > 100 || !/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(codigoSaft)) {
    return { error: "El código SAFT no es válido." } as const;
  }
  if (!descripcionSaft || descripcionSaft.length > 500) {
    return { error: "La descripción SAFT es obligatoria y no puede exceder 500 caracteres." } as const;
  }
  return { codigoSaft, descripcionSaft } as const;
}
