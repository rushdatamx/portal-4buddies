const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface ChartData {
  name: string;
  value: number;
}

interface HEBSummary {
  totalRegistros: number;
  totalUnidades: number;
  totalImporte: number;
  tiendasActivas: number;
  productosVendiendo: number;
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

export async function getHEBSummary(): Promise<HEBSummary> {
  return fetchDashboard<HEBSummary>("/heb/summary");
}

export async function getHEBTrend(): Promise<ChartData[]> {
  return fetchDashboard<ChartData[]>("/heb/trend");
}

export async function getHEBTopTiendas(limit = 10): Promise<ChartData[]> {
  return fetchDashboard<ChartData[]>(`/heb/top-tiendas?limit=${limit}`);
}

export async function getHEBTopProductos(limit = 10): Promise<ChartData[]> {
  return fetchDashboard<ChartData[]>(`/heb/top-productos?limit=${limit}`);
}
