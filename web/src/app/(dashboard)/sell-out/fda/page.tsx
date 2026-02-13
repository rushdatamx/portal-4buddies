import { KPICard } from "@/components/cards/kpi-card";
import { TrendChart } from "@/components/charts/trend-chart";
import { BarChart } from "@/components/charts/bar-chart";
import {
  getFDASummary,
  getFDATrend,
  getFDATopPlazas,
  getFDATopProductos,
  getFDACobertura,
} from "@/lib/queries/sell-out-fda";
import { Store, Package, MapPin, TrendingUp } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function FDAPage() {
  const [summary, trend, topPlazas, topProductos, cobertura] = await Promise.all([
    getFDASummary(),
    getFDATrend(),
    getFDATopPlazas(),
    getFDATopProductos(),
    getFDACobertura(),
  ]);

  const formatNumber = (num: number | string) => {
    const n = typeof num === "string" ? parseFloat(num) : num;
    return n.toLocaleString("es-MX");
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
          title="Sucursales Activas"
          value={`${summary.sucursalesActivas}/${summary.totalSucursales}`}
          subtitle={`${summary.cobertura}% cobertura`}
          icon={Store}
        />
        <KPICard
          title="Promedio/Sucursal"
          value={formatNumber(summary.promedioPorSucursal)}
          subtitle="Unidades promedio"
          icon={TrendingUp}
        />
        <KPICard
          title="Productos"
          value={formatNumber(summary.productosVendiendo)}
          subtitle="SKUs vendiendo"
          icon={MapPin}
        />
      </div>

      {/* Tendencia */}
      <TrendChart
        title="Tendencia de Ventas FDA (Unidades por Mes)"
        data={trend}
        color="#2383e2"
      />

      {/* Top Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BarChart
          title="Top 10 Plazas por Volumen"
          data={topPlazas}
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

      {/* Cobertura */}
      <BarChart
        title="Cobertura por Producto (Sucursales con Venta)"
        data={cobertura}
        color="#9333ea"
        horizontal
      />
    </div>
  );
}
