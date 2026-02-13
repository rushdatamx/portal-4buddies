import { KPICard } from "@/components/cards/kpi-card";
import { TrendChart } from "@/components/charts/trend-chart";
import { BarChart } from "@/components/charts/bar-chart";
import {
  getSellInSummary,
  getSellInTrend,
  getSellInTopClientes,
  getSellInTopProductos,
} from "@/lib/queries/sell-in";
import { ShoppingCart, Package, Users, DollarSign } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SellInPage() {
  const [summary, trend, topClientes, topProductos] = await Promise.all([
    getSellInSummary(),
    getSellInTrend(),
    getSellInTopClientes(),
    getSellInTopProductos(),
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
          title="Total Pedidos"
          value={formatNumber(summary.totalPedidos)}
          subtitle="Órdenes registradas"
          icon={ShoppingCart}
        />
        <KPICard
          title="Total Unidades"
          value={formatNumber(summary.totalUnidades)}
          subtitle="Unidades vendidas"
          icon={Package}
        />
        <KPICard
          title="Total Importe"
          value={formatCurrency(summary.totalImporte)}
          subtitle="Valor total de pedidos"
          icon={DollarSign}
        />
        <KPICard
          title="Clientes Activos"
          value={formatNumber(summary.clientesActivos)}
          subtitle={`${summary.productosVendidos} productos`}
          icon={Users}
        />
      </div>

      {/* Tendencia */}
      <TrendChart
        title="Tendencia de Pedidos (Unidades por Mes)"
        data={trend}
        color="#2383e2"
      />

      {/* Top Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <BarChart
          title="Top 10 Clientes por Volumen"
          data={topClientes}
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
