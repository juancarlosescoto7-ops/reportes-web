export function searchTree(tree: Map<string, any>, query: string) {
  const result = new Map();
  const q = normalizeText(query);

  if (!q) return tree;

  for (const [key, node] of tree.entries()) {
    const match = nodeMatchesSearch(node, q);

    const filteredChildren = searchTree(node.children, query);

    if (match || filteredChildren.size > 0) {
      result.set(key, {
        ...node,
        expandedBySearch: true,
        children: match ? node.children : filteredChildren,
      });
    }
  }

  return result;
}

function nodeMatchesSearch(node: any, query: string) {
  const searchable = [
    node.id,
    node.name,
    node.level,
    node.searchText,
    node.meta?.codigo_presupuestario,
    node.meta?.objeto,
    node.meta?.descripcion_objeto,
    node.meta?.fuente,
    node.meta?.tipo_inversion,
    node.meta?.actividad_id,
    node.meta?.proyecto_id,
    node.meta?.ejercicio_fiscal,
  ]
    .map(normalizeText)
    .join(" ");

  return searchable.includes(query);
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}