import ts from "typescript";
import { readdir, readFile, writeFile } from "node:fs/promises";

// El catálogo y los atributos se mantienen juntos. Los códigos existentes nunca se renumeran.
const destino = "modules/app-shell/config/acciones-teclado.json";
const comprobar = process.argv.includes("--check");
async function archivos(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const result = await Promise.all(entries.map((entry) => entry.isDirectory()
    ? archivos(`${dir}/${entry.name}`) : [`${dir}/${entry.name}`]));
  return result.flat().filter((file) => file.endsWith(".tsx"));
}
const files = (await Promise.all([archivos("modules"), archivos("shared")])).flat().sort();
const previos = JSON.parse(await readFile(destino, "utf8").catch(() => "[]"));
const atajoPrevio = new Map(previos.map((item) => [item.codigo, item.atajo]).filter(([, atajo]) => atajo));
let siguiente = Math.max(0, ...previos.map((item) => Number(item.codigo))) + 1;
const catalogo = [];
const pendientes = [];
const atajosReservados = new Set([
  "dat",
  "ini", "pen", "egr", "pre", "cxp", "pro", "ing", "arq", "pancom", "ordpag", "con", "aud", "ofm",
  "negr", "ncxp", "npro", "nben", "narq", "carpdf", "exp", "imp", "cex", "act", "lim", "gua", "bus", "bug", "man",
]);
const etiquetas = {
  "005": "Seleccionar código SAFT", "022": "Generar expediente de auditoría", "032": "Seleccionar beneficiario",
  "042": "Abrir resultado de búsqueda", "044": "Usar sugerencia de búsqueda", "045": "Abrir resultado relacionado", "046": "Usar consulta sugerida",
  "073": "Ejecutar acción de la cuenta por pagar", "076": "Otras acciones de la cuenta por pagar", "079": "Confirmar recomendación presupuestaria",
  "081": "Subsanar requisito documental", "082": "Elegir acción del menú contextual",
  "109": "Expandir o contraer resumen presupuestario", "111": "Abrir o cerrar panel del inicio",
  "114": "Crear documento del requisito", "117": "Seleccionar esquina del escaneo (ajustar con flechas)", "122": "Confirmar páginas escaneadas",
  "132": "Filtrar resultados de conciliación", "133": "Fijar o comparar movimiento de conciliación", "137": "Abrir panel de ingresos",
  "144": "Expandir o contraer arqueo", "152": "Seleccionar orden de pago",
  "187": "Expandir o contraer grupo de ejecuciones", "189": "Ver datos copiables de la orden de pago",
  "202": "Resolver pendiente", "208": "Cerrar formulario de presupuesto", "220": "Cambiar vista del borrador",
  "234": "Cambiar pantalla de presupuesto", "243": "Expandir o contraer grupo presupuestario (móvil)",
  "245": "Expandir o contraer grupo presupuestario", "275": "Seleccionar código o expandir nivel presupuestario",
  "284": "Seleccionar proyecto", "288": "Abrir pestaña de documento", "289": "Cerrar pestaña de documento",
  "293": "Abrir panel de herramientas", "294": "Seleccionar opción de catálogo",
};
function literal(attr) {
  return attr?.initializer && ts.isStringLiteral(attr.initializer) ? attr.initializer.text : "";
}
function textos(node) {
  if (ts.isJsxText(node)) return node.text.trim();
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isTemplateExpression(node)) return node.head.text + node.templateSpans.map((span) => span.literal.text).join(" ");
  if (ts.isParenthesizedExpression(node)) return textos(node.expression);
  if (ts.isJsxElement(node)) return node.children.map(textos).filter(Boolean).join(" ");
  if (ts.isJsxExpression(node) && node.expression) return textos(node.expression);
  if (ts.isConditionalExpression(node)) return [textos(node.whenTrue), textos(node.whenFalse)].filter(Boolean).join(" / ");
  return "";
}
function abreviar(texto, modulo) {
  const limpiar = (valor) => valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const opciones = texto.split("/").map(limpiar).filter(Boolean);
  const palabras = (opciones.at(-1) || "accion").split(/\s+/).filter((palabra) =>
    !["a", "al", "de", "del", "el", "en", "la", "las", "los", "o", "para", "por", "un", "una", "y"].includes(palabra)
  );
  let base = palabras.slice(0, 4).map((palabra) => palabra.slice(0, 3)).join("").slice(0, 12) || "acc";
  if (!/^[a-z]/.test(base)) base = `acc${base}`;
  if (!atajosReservados.has(base)) return base;
  const sufijo = limpiar(modulo).split(/\s+/).map((palabra) => palabra.slice(0, 3)).join("").slice(0, 3);
  const raiz = base.slice(0, 8);
  let candidato = `${raiz}${sufijo}`;
  let numero = 2;
  while (atajosReservados.has(candidato)) {
    const correlativo = String(numero++);
    candidato = `${raiz.slice(0, 12 - sufijo.length - correlativo.length)}${sufijo}${correlativo}`;
  }
  return candidato;
}
for (const file of files) {
  if (file.includes("/app-shell/") || file.includes("/autenticacion/") && !file.endsWith("CerrarSesionButton.tsx") || file.includes("/diagnosticos/")) continue;
  const source = await readFile(file, "utf8");
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  function visitar(node) {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(ast);
      const attrs = node.attributes.properties.filter(ts.isJsxAttribute);
      const attr = (name) => attrs.find((item) => item.name.getText(ast) === name);
      const click = attr("onClick");
      const actionable = tag === "button" || (tag === "a" || tag === "Link") && attr("href")
        || tag === "input" && ["file", "checkbox", "radio", "submit", "button"].includes(literal(attr("type")))
        || /^[a-z]/.test(tag) && (click || attr("onContextMenu")) && /^(tr|td|span|div|summary)$/.test(tag)
          && !/stopPropagation\(\)/.test(click?.getText(ast) ?? "") && !/fixed.*inset-0/.test(literal(attr("className")));
      if (actionable && !attr("data-shortcut-ignore")) {
        let codigo = literal(attr("data-shortcut"));
        if (!codigo) {
          codigo = String(siguiente++).padStart(3, "0");
          edits.push({ pos: node.tagName.end, text: ` data-shortcut="${codigo}"${!click && attr("onContextMenu") ? ' data-shortcut-event="contextmenu"' : ""}` });
        }
        const parent = ts.isJsxOpeningElement(node) && ts.isJsxElement(node.parent) ? node.parent : node;
        let titulo = etiquetas[codigo] || literal(attr("data-shortcut-label"))
          || (attr("aria-label")?.initializer ? textos(attr("aria-label").initializer) : "")
          || (attr("title")?.initializer ? textos(attr("title").initializer) : "") || textos(parent);
        if (!click && attr("onContextMenu")) titulo = "Abrir menú de acciones del registro";
        if (!titulo && attr("title")?.initializer) titulo = textos(attr("title").initializer);
        if (!titulo && tag === "input") titulo = `Seleccionar ${literal(attr("type")) === "file" ? "archivo" : "opción"}`;
        if (!titulo && click) {
          const handler = click.getText(ast).match(/(?:set|handle|on|abrir|cerrar|toggle|seleccionar|cargar|descargar|copiar|eliminar|guardar|generar)[A-ZÁÉÍÓÚa-z_]+/g)?.filter((s) => s !== "onClick")[0];
          titulo = handler?.replace(/^(set|handle|on)(?=[A-Z])/, "").replace(/([a-z])([A-Z])/g, "$1 $2") ?? "Seleccionar registro";
        }
        let grupo = "";
        for (let ancestor = node.parent; ancestor; ancestor = ancestor.parent) {
          if (!ts.isObjectLiteralExpression(ancestor)) continue;
          const id = ancestor.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText(ast) === "id");
          const content = ancestor.properties.find((p) => ts.isPropertyAssignment(p) && p.name.getText(ast) === "content");
          if (id && content && ts.isStringLiteral(id.initializer)) { grupo = id.initializer.text; break; }
        }
        catalogo.push({ codigo, titulo: (titulo || "Abrir opción").replace(/\s+/g, " ").trim().slice(0, 150), modulo: file.split("/")[0] === "shared" ? "general" : file.split("/")[1], archivo: file, ...(grupo ? { grupo } : {}) });
      }
    }
    ts.forEachChild(node, visitar);
  }
  visitar(ast);
  if (edits.length) {
    pendientes.push(`${file}: ${edits.length} acciones sin atajo`);
    if (!comprobar) {
      let output = source;
      for (const edit of edits.reverse()) output = output.slice(0, edit.pos) + edit.text + output.slice(edit.pos);
      await writeFile(file, output);
    }
  }
}
catalogo.sort((a, b) => a.codigo.localeCompare(b.codigo));
for (const item of catalogo) {
  const conservado = atajoPrevio.get(item.codigo);
  item.atajo = conservado && conservado.length <= 12 ? conservado : abreviar(item.titulo, item.modulo);
  atajosReservados.add(item.atajo);
}
if (new Set(catalogo.map((item) => item.codigo)).size !== catalogo.length) throw new Error("Códigos de atajo duplicados");
if (new Set(catalogo.map((item) => item.atajo)).size !== catalogo.length) throw new Error("Abreviaciones de atajo duplicadas");
const json = JSON.stringify(catalogo, null, 2) + "\n";
if (comprobar) {
  if (pendientes.length || json !== await readFile(destino, "utf8")) {
    console.error("Actualice los atajos con npm run shortcuts:sync", ...pendientes);
    process.exitCode = 1;
  }
} else await writeFile(destino, json);
console.log(`${catalogo.length} acciones catalogadas en ${new Set(catalogo.map((item) => item.archivo)).size} archivos.`);
