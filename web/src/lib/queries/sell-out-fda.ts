const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface ChartData {
  name: string;
  value: number;
  sucursales?: number;
}

interface FDASummary {
  totalRegistros: number;
  totalUnidades: number;
  sucursalesActivas: number;
  totalSucursales: number;
  cobertura: string;
  promedioPorSucursal: string;
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

export async function getFDASummary(): Promise<FDASummary> {
  return fetchDashboard<FDASummary>("/fda/summary");
}

export async function getFDATrend(): Promise<ChartData[]> {
  return fetchDashboard<ChartData[]>("/fda/trend");
}

export async function getFDATopPlazas(limit = 10): Promise<ChartData[]> {
  return fetchDashboard<ChartData[]>(`/fda/top-plazas?limit=${limit}`);
}

export async function getFDATopProductos(limit = 10): Promise<ChartData[]> {
  return fetchDashboard<ChartData[]>(`/fda/top-productos?limit=${limit}`);
}

export async function getFDACobertura(): Promise<ChartData[]> {
  return fetchDashboard<ChartData[]>("/fda/cobertura");
}
