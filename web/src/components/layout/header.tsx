"use client";

import { usePathname } from "next/navigation";

const pageTitles: Record<string, { title: string; description: string }> = {
  "/sell-in": {
    title: "SELL-IN",
    description: "Pedidos y órdenes del ERP",
  },
  "/sell-out/heb": {
    title: "HEB",
    description: "Ventas en Supermercados Internacionales HEB",
  },
  "/sell-out/fda": {
    title: "FDA",
    description: "Ventas en Servicios en Puertos y Terminales",
  },
};

export function Header() {
  const pathname = usePathname();
  const pageInfo = pageTitles[pathname] || {
    title: "Dashboard",
    description: "Portal 4BUDDIES",
  };

  return (
    <header className="border-b border-[#e3e3e1] bg-white px-8 py-6">
      <h1 className="text-2xl font-semibold text-[#37352f]">{pageInfo.title}</h1>
      <p className="text-sm text-[#787774] mt-1">{pageInfo.description}</p>
    </header>
  );
}
