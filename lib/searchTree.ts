export function searchTree(tree: Map<string, any>, query: string) {
  const result = new Map();
  const q = query.toLowerCase();

  for (const [key, node] of tree.entries()) {

    const match =
      node.name.toLowerCase().includes(q);

    const filteredChildren = searchTree(node.children, query);

    if (match || filteredChildren.size > 0) {

      result.set(key, {
        ...node,

        // 🔥 NUEVO: auto-expand si hay coincidencia
        expandedBySearch: match || filteredChildren.size > 0,

        children: filteredChildren,
      });
    }
  }

  return result;
}