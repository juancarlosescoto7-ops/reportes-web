type SearchNode = {
  id?: string;
  name?: string;
  level?: string;
  searchText?: string;
  meta?: Record<string, unknown>;
  children?: Map<string, SearchNode>;
  expandedBySearch?: boolean;
  matchedBySearch?: boolean;
};

export function searchTree(tree: Map<string, SearchNode>, query: string) {
  const q = normalizeText(query);

  if (!q) return tree;

  return markSearchMatches(tree, q).tree;
}

function markSearchMatches(tree: Map<string, SearchNode>, query: string) {
  const result = new Map<string, SearchNode>();
  let hasMatch = false;

  for (const [key, node] of tree.entries()) {
    const children = node.children ?? new Map<string, SearchNode>();
    const childResult = markSearchMatches(children, query);
    const match = nodeMatchesSearch(node, query);
    const expandedBySearch = match || childResult.hasMatch;

    if (expandedBySearch) {
      hasMatch = true;
    }

    result.set(key, {
      ...node,
      expandedBySearch,
      matchedBySearch: match,
      children: childResult.tree,
    });
  }

  return { tree: result, hasMatch };
}

function nodeMatchesSearch(node: SearchNode, query: string) {
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
