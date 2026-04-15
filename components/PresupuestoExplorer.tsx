"use client";

import { useState, useMemo } from "react";
import { buildHierarchy } from "@/lib/buildHierarchy";
import PresupuestoTree from "./PresupuestoTree";
import { searchTree } from "@/lib/searchTree";

export default function PresupuestoExplorer({ data }: { data: any[] }) {

  const [search, setSearch] = useState("");

  const baseTree = useMemo(() => buildHierarchy(data), [data]);

  const filteredTree = useMemo(() => {
    if (!search) return baseTree;
    return searchTree(baseTree, search);
  }, [search, baseTree]);

  return (
    <div className="space-y-4">

      {/* SEARCH */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar..."
        className="w-full border p-3 rounded"
      />

      <PresupuestoTree tree={filteredTree} />

    </div>
  );
}