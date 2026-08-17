import DocumentacionOrdenesPago from "@/components/DocumentacionOrdenesPago";

export default async function OrdenesPagoDocumentacionPage({
  searchParams,
}: {
  searchParams: Promise<{ orden?: string | string[] }>;
}) {
  const params = await searchParams;
  const orden = Array.isArray(params.orden) ? params.orden[0] : params.orden;

  return (
    <div className="h-full min-h-0">
      <DocumentacionOrdenesPago focusOrder={orden ?? null} />
    </div>
  );
}
