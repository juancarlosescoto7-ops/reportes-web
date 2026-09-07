import { obtenerPresupuestoServidor } from "@/modules/presupuesto/services/presupuesto.server";
import { buildHierarchy } from "@/modules/presupuesto/domain/buildHierarchy";

export default async function Page() {
  const data = await obtenerPresupuestoServidor();

  const tree = buildHierarchy(data);

  console.log("ROOT SIZE:", tree.size);

  const first = Array.from(tree.values())[0];

  return (
    <div style={{ padding: 20 }}>
      <h1>TEST HIERARCHY</h1>

      <pre>{JSON.stringify(first, null, 2)}</pre>
    </div>
  );
}
