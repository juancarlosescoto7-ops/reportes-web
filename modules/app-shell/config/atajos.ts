export const ATAJOS_NAVEGACION: Record<string, string> = {
  "editor-datos": "dat",
  inicio: "ini", pendientes: "pen", egresos: "egr", presupuesto: "pre",
  compromisos: "cxp", proyectos: "pro", ingresos: "ing", arqueos: "arq",
  "pantalla-compartida": "pancom", "ordenes-pago-documentos": "ordpag",
  "conversor-saft-sami": "con", auditoria: "aud", "oficina-mujer": "ofm",
  "nuevo-egreso": "negr", "nueva-cxp": "ncxp", "nuevo-proyecto": "npro",
  "nuevo-beneficiario": "nben", "nuevo-arqueo": "narq", "cargar-pdf-orden": "carpdf",
};

export const ATAJOS_LOCALES = [
  { teclas: "exp", titulo: "Exportar informe", patron: "exportar|^pdf|generar pdf|generar expediente|descargar.*(pdf|csv)|imprimir informe" },
  { teclas: "imp", titulo: "Imprimir informe", patron: "imprimir|^pdf" },
  { teclas: "cex", titulo: "Copiar para Excel", patron: "copiar.*(excel|arbol|estructura|resumen)|copia las tres columnas" },
  { teclas: "act", titulo: "Actualizar datos", patron: "actualizar|recargar|refrescar|reintentar" },
  { teclas: "lim", titulo: "Limpiar filtros", patron: "^limpiar( fechas| filtros)?$" },
  { teclas: "gua", titulo: "Guardar formulario", patron: "guardar|registrar cxp|confirmar ingreso|crear beneficiario|crear proyecto|registrar modificaciones" },
  { teclas: "bus", titulo: "Buscar en esta pantalla", patron: "" },
  { teclas: "bug", titulo: "Abrir buscador universal", patron: "" },
  { teclas: "man", titulo: "Manual de comandos", patron: "" },
] as const;

export const NOMBRES_MODULOS: Record<string, string> = {
  "editor-datos": "Editor de datos",
  "ordenes-pago": "Egresos y órdenes de pago", "cuentas-por-pagar": "Cuentas por pagar",
  presupuesto: "Presupuesto", ingresos: "Ingresos", arqueos: "Arqueos y conversión",
  proyectos: "Proyectos", documentos: "Documentos y escáner", beneficiarios: "Beneficiarios",
  auditoria: "Auditoría", dashboard: "Inicio y pantalla compartida", pendientes: "Pendientes",
  "busqueda-global": "Buscador universal", general: "Controles generales",
  autenticacion: "Sesión de usuario",
};

export function formatoAtajo(teclas: string) {
  return `Shift + ${teclas.toUpperCase()}`;
}
