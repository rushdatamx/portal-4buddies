"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Package,
  ShoppingCart,
  Store,
  Building2,
  ChevronRight,
} from "lucide-react";

const navigation = [
  {
    name: "SELL-IN",
    href: "/sell-in",
    icon: ShoppingCart,
    description: "Pedidos ERP",
  },
  {
    name: "SELL-OUT",
    icon: Store,
    children: [
      {
        name: "HEB",
        href: "/sell-out/heb",
        icon: Building2,
        description: "63 tiendas",
      },
      {
        name: "FDA",
        href: "/sell-out/fda",
        icon: Package,
        description: "978 sucursales",
      },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 border-r border-[#e3e3e1] bg-[#fbfbfa] h-screen flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-[#e3e3e1]">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-[#37352f] rounded-md flex items-center justify-center">
            <span className="text-white font-semibold text-sm">4B</span>
          </div>
          <span className="font-semibold text-[#37352f]">4BUDDIES</span>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navigation.map((item) => {
          if (item.children) {
            return (
              <div key={item.name} className="space-y-1">
                <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#787774]">
                  <item.icon className="w-4 h-4" />
                  <span>{item.name}</span>
                </div>
                <div className="ml-4 space-y-1">
                  {item.children.map((child) => {
                    const isActive = pathname === child.href;
                    return (
                      <Link
                        key={child.name}
                        href={child.href}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                          isActive
                            ? "bg-[#ebebea] text-[#37352f] font-medium"
                            : "text-[#37352f] hover:bg-[#ebebea]/50"
                        )}
                      >
                        <child.icon className="w-4 h-4" />
                        <span className="flex-1">{child.name}</span>
                        <span className="text-xs text-[#787774]">
                          {child.description}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          }

          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href!}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                isActive
                  ? "bg-[#ebebea] text-[#37352f] font-medium"
                  : "text-[#37352f] hover:bg-[#ebebea]/50"
              )}
            >
              <item.icon className="w-4 h-4" />
              <span className="flex-1">{item.name}</span>
              {item.description && (
                <span className="text-xs text-[#787774]">{item.description}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-[#e3e3e1]">
        <p className="text-xs text-[#787774]">
          Dashboard de ventas y pedidos
        </p>
      </div>
    </aside>
  );
}
