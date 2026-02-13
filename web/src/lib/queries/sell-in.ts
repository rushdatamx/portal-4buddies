const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface ChartData {
  name: string;
  value: number;
}

interface SellInSummary {
  totalPedidos: number;
  totalUnidades: number;
  totalImporte: number;
  clientesActivos: number;
  productosVendidos: number;
}

async function fetchDashboard<T>(endpoint: string): Promise<T> {
  const res = await fetch(`${API_URL}/api/dashboard${endpoint}`, {
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`API Error: ${res.status}`);
  }

  const json = await res.json();
  return json.data;
}

export async function getSellInSummary(): Promise<SellInSummary> {
  return fetchDashboard<SellInSummary>("/sell-in/summary");
}

export async function getSellInTrend(): Promise<ChartData[]> {
  return fetchDashboard<ChartData[]>("/sell-in/trend");
}

export async function getSellInTopClientes(limit = 10): Promise<ChartData[]> {
  return fetchDashboard<ChartData[]>(`/sell-in/top-clientes?limit=${limit}`);
}

export async function getSellInTopProductos(limit = 10): Promise<ChartData[]> {
  return fetchDashboard<ChartData[]>(`/sell-in/top-productos?limit=${limit}`);
}
