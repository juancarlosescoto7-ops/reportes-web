"use client";

import { useState } from "react";
import { useEffect } from "react";

function Node({ node }: { node: any }) {
  const [open, setOpen] = useState(false);

  // 🔥 auto-open si viene de búsqueda
  useEffect(() => {
    if (node.expandedBySearch) {
      setOpen(true);
    }
  }, [node.expandedBySearch]);

  const saldo =
    node.kpis.vigente -
    node.kpis.ejecutado -
    node.kpis.comprometido;

  return (
    <div className="ml-4 border-l pl-4">

      {/* CARD */}
        <div
          onClick={() => setOpen(!open)}
          className={`border rounded-xl p-4 mb-2 cursor-pointer ${
            node.expandedBySearch ? "border-blue-400 bg-blue-50" : "bg-white"
          }`}
        >
        <div className="flex justify-between">
          <div>
            <h3 className="font-semibold">{node.name}</h3>
            <p className="text-xs text-gray-400">{node.level}</p>
          </div>

          <span className="text-xs">
            {open ? "−" : "+"}
          </span>
        </div>

        {/* KPIs */}
        <div className="text-sm mt-2 space-y-1">
          <div>Vigente: L {node.kpis.vigente.toLocaleString()}</div>
          <div>Ejecutado: L {node.kpis.ejecutado.toLocaleString()}</div>
          <div>
            Saldo:{" "}
            <span className={saldo >= 0 ? "text-green-600" : "text-red-600"}>
              L {saldo.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      {/* CHILDREN */}
      {open &&
        Array.from(node.children.values()).map((child: any) => (
          <Node key={child.id} node={child} />
        ))}
    </div>
  );
}

export default function PresupuestoTree({ tree }: { tree: Map<string, any> }) {
  return (
    <div>
      {Array.from(tree.values()).map((node: any) => (
        <Node key={node.id} node={node} />
      ))}
    </div>
  );
}