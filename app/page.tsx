import Link from "next/link";

export default function Home() {
  return (
    <div className="p-10">
      <h1 className="text-xl font-bold mb-4">
        Sistema de Reportes
      </h1>

      <Link href="/reportes/ordenes" className="text-blue-500 underline">
        Ver Reporte de Órdenes
      </Link>
    </div>
  );
}