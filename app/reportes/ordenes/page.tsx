import { obtenerReporteOrdenes } from "@/services/reporteOrdenes";

type Orden = {
  [key: string]: any;
};

export default async function ReporteOrdenes() {

  const datos: Orden[] = await obtenerReporteOrdenes();

  return (
    <div className="p-10">
      <h1 className="text-xl font-bold mb-4">
        Reporte de Órdenes
      </h1>

      <table className="border w-full">
        <thead>
          <tr>
            {datos.length > 0 &&
              Object.keys(datos[0]).map((col: string) => (
                <th key={col} className="border px-2 py-1">
                  {col}
                </th>
              ))}
          </tr>
        </thead>

        <tbody>
          {datos.map((fila: Orden, i: number) => (
            <tr key={i}>
              {Object.values(fila).map((valor: any, j: number) => (
                <td key={j} className="border px-2 py-1">
                  {valor}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}