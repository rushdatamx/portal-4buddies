import { KPICard } from "@/components/cards/kpi-card";
import { TrendChart } from "@/components/charts/trend-chart";
import { BarChart } from "@/components/charts/bar-chart";
import {
  getHEBSummary,
  getHEBTrend,
  getHEBTopTiendas,
  getHEBTopProductos,
} from "@/lib/queries/sell-out-heb";
import { Store, Package, Building2, ShoppingBag } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function HEBPage() {
  const [summary, trend, topTiendas, topProductos] = await Promise.all([
    getHEBSummary(),
    getHEBTrend(),
    getHEBTopTiendas(),
    getHEBTopProductos(),
  ]);

  const formatNumber = (num: number) => {
    return num.toLocaleString("es-MX");
  };

  const formatCurrency = (num: number) => {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: 0,
    }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total Unidades"
          value={formatNumber(summary.totalUnidades)}
          subtitle={`${formatNumber(summary.totalRegistros)} registros`}
          icon={Package}
        />
        <KPICard
          title="Total Importe"
          value={formatCurrency(summary.totalImporte)}
          subtitle="Valor de ventas"
          icon={ShoppingBag}
        />
        <KPICard
          title="Tiendas Activas"
          value={`${summary.tiendasActivas}/63`}
          subtitle="Tiendas con venta"
          icon={Store}
        />
        <KPICard
          title="Productos"
          value={formatNumber(summary.productosVendiendo)}
          subtitle="SKUs vendiendo"
          icon={Building2}
        />
      </div>

      {/* Tendencia */}
      <TrendChart
        title="Tendencia de Ventas HEB (Unidades por Mes)"
        data={trend}
        color="#2383e2"
      />

      {/* Top Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BarChart
          title="Top 10 Tiendas por Volumen"
          data={topTiendas}
          color="#0f7b6c"
          horizontal
        />
        <BarChart
          title="Top 10 Productos por Unidades"
          data={topProductos}
          color="#d9730d"
          horizontal
        />
      </div>
    </div>
  );
}
