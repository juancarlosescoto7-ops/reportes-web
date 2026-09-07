import Image from "next/image";

export default function Encabezado() {
  return (
    <div className="fixed top-0 left-0 w-full z-50 bg-white">
      <Image
        src="/logo.svg"
        alt="Encabezado"
        width={1600}
        height={240}
        priority
        className="w-full h-auto block"
      />
    </div>
  );
}
