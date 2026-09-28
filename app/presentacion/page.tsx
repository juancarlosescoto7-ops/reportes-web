import type { Metadata } from "next";
import PresentacionComercial from "@/modules/presentacion/components/PresentacionComercial";

export const metadata: Metadata = {
  title: "Documentación y gestión municipal | Reportes Web",
  description: "Documentos organizados, expedientes disponibles y una inversión clara para su municipalidad.",
};

export default function Page() {
  return <PresentacionComercial />;
}
