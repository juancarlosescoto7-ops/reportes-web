import assert from "node:assert/strict";
import test from "node:test";
import { agregarFiltros, obtenerTabla, prepararCambio, puedeEditarDatos, seleccion, validarValor } from "./editor-datos.ts";

test("el editor autoriza exclusivamente a Presupuesto", () => {
  assert.equal(puedeEditarDatos("PRESUPUESTO"), true);
  for (const rol of [null, undefined, "ADMIN", "TESORERIA", "CONSULTA", "AUDITORIA", "UTM"]) assert.equal(puedeEditarDatos(rol), false);
});

test("rechaza tablas, columnas y operadores fuera del catálogo", () => {
  assert.throws(() => obtenerTabla("usuarios_sistema"));
  for (const filtro of [{ columna: "nombre", operador: "or" }, { columna: "id)&or=(id", operador: "eq", valor: "1" }]) {
    assert.throws(() => agregarFiltros(new URLSearchParams(), obtenerTabla("beneficiarios"), [filtro]));
  }
});

test("combina filtros de Excel sin confundir NULL, vacío, comas o comillas", () => {
  const params = new URLSearchParams();
  agregarFiltros(params, obtenerTabla("cuentas_por_pagar"), [
    { columna: "cuenta", operador: "valores", valores: [null, "", 'Banco, "Principal"'] },
    { columna: "fecha", operador: "entre", valor: "2026-01-01", hasta: "2026-09-10" },
    { columna: "descripcion", operador: "contiene", valor: "10%_test*" },
  ]);
  assert.equal(params.get("or"), '(cuenta.is.null,cuenta.in.("","Banco, \\"Principal\\""))');
  assert.deepEqual(params.getAll("fecha"), ["gte.2026-01-01", "lte.2026-09-10"]);
  assert.equal(params.get("descripcion"), "ilike.%10\\%\\_test\\*%");
  assert.throws(() => agregarFiltros(new URLSearchParams(), obtenerTabla("beneficiarios"), [{ columna: "nombre", operador: "valores", valores: [] }]));
});

test("preserva precisión de enteros grandes y decimales y valida fechas", () => {
  const tabla = obtenerTabla("cuentas_por_pagar");
  assert.match(seleccion(tabla.columnas), /id::text/);
  assert.equal(validarValor(tabla.columnas[0], "9223372036854775807"), "9223372036854775807");
  assert.throws(() => validarValor(tabla.columnas[0], "9223372036854775808"));
  assert.equal(validarValor(tabla.columnas[3], "12345678901234567890.123456"), "12345678901234567890.123456");
  assert.throws(() => validarValor(tabla.columnas[1], "2026-02-30"));
  assert.throws(() => validarValor(tabla.columnas[3], "1,25"));
});

test("guarda por clave primaria y versión original sin modificar otros campos", () => {
  const tabla = obtenerTabla("beneficiarios");
  const { params, payload } = prepararCambio(tabla, { original: { id: "001", nombre: null }, cambios: { nombre: "Nombre corregido" } });
  assert.equal(params.get("id"), "eq.001");
  assert.equal(params.get("nombre"), "is.null");
  assert.deepEqual(payload, { nombre: "Nombre corregido" });
  for (const cambios of [{ id: "002" }, { desconocido: "x" }, {}]) assert.throws(() => prepararCambio(tabla, { original: { id: "001", nombre: "Anterior" }, cambios }));
  assert.throws(() => prepararCambio(tabla, { original: { nombre: "Anterior" }, cambios: { nombre: "Nuevo" } }));
});
