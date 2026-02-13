const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface ApiResponse<T> {
  success: boolean;
  data: T;
  total?: number;
  pagination?: {
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    // Revalidar cada 60 segundos para datos frescos
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    throw new Error(`API Error: ${res.status} ${res.statusText}`);
  }

  const json: ApiResponse<T> = await res.json();

  if (!json.success) {
    throw new Error("API returned success: false");
  }

  return json.data;
}

// ==========================================
// RESUMEN GENERAL
// ==========================================

interface ResumenData {
  sellIn: number;
  sellOutVentas: number;
  sellOutInventario: number;
  productos: number;
  clientes: number;
}

export async function getResumen(clienteId?: number): Promise<ResumenData> {
  const params = clienteId ? `?clienteId=${clienteId}` : "";
  return fetchApi<ResumenData>(`/api/data/resumen${params}`);
}

// ==========================================
// SELL-IN
// ==========================================

interface SellInRecord {
  id: number;
  cliente: { id: number; nombre: string };
  producto: { id: number; nombre: string; sku: string };
  fecha: string;
  cantidad: number;
  importe_total: number;
}

interface SellInAgregado {
  nombre: string;
  _sum: {
    cantidad: number;
    importe_total: number;
  };
  _count: number;
}

export async function getSellIn(params?: {
  clienteId?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  limit?: number;
}): Promise<SellInRecord[]> {
  const searchParams = new URLSearchParams();
  if (params?.clienteId) searchParams.set("clienteId", String(params.clienteId));
  if (params?.fechaDesde) searchParams.set("fechaDesde", params.fechaDesde);
  if (params?.fechaHasta) searchParams.set("fechaHasta", params.fechaHasta);
  if (params?.limit) searchParams.set("limit", String(params.limit));

  const query = searchParams.toString();
  return fetchApi<SellInRecord[]>(`/api/data/sell-in${query ? `?${query}` : ""}`);
}

export async function getSellInAgregado(params: {
  agruparPor: "cliente" | "producto" | "mes";
  clienteId?: number;
  fechaDesde?: string;
  fechaHasta?: string;
}): Promise<SellInAgregado[]> {
  const searchParams = new URLSearchParams();
  searchParams.set("agruparPor", params.agruparPor);
  if (params.clienteId) searchParams.set("clienteId", String(params.clienteId));
  if (params.fechaDesde) searchParams.set("fechaDesde", params.fechaDesde);
  if (params.fechaHasta) searchParams.set("fechaHasta", params.fechaHasta);

  return fetchApi<SellInAgregado[]>(`/api/data/sell-in/agregado?${searchParams}`);
}

// ==========================================
// SELL-OUT VENTAS
// ==========================================

interface SellOutVentaRecord {
  id: number;
  cliente: { id: number; nombre: string };
  producto: { id: number; nombre: string; sku: string };
  tienda: { id: number; nombre: string; plaza: string } | null;
  fecha: string;
  unidades: number;
  importe: number;
}

export async function getSellOutVentas(params: {
  clienteId: number;
  tiendaId?: number;
  productoId?: number;
  fechaDesde?: string;
  fechaHasta?: string;
  limit?: number;
}): Promise<SellOutVentaRecord[]> {
  const searchParams = new URLSearchParams();
  searchParams.set("clienteId", String(params.clienteId));
  if (params.tiendaId) searchParams.set("tiendaId", String(params.tiendaId));
  if (params.productoId) searchParams.set("productoId", String(params.productoId));
  if (params.fechaDesde) searchParams.set("fechaDesde", params.fechaDesde);
  if (params.fechaHasta) searchParams.set("fechaHasta", params.fechaHasta);
  if (params.limit) searchParams.set("limit", String(params.limit));

  return fetchApi<SellOutVentaRecord[]>(`/api/data/sell-out/ventas?${searchParams}`);
}

// ==========================================
// CLIENTES Y TIENDAS
// ==========================================

interface Cliente {
  id: number;
  codigo: string;
  nombre: string;
  tipo: string;
  tiene_sell_out: boolean;
}

interface Tienda {
  id: number;
  codigo_tienda: string;
  nombre: string;
  plaza: string;
  cliente_id: number;
}

export async function getClientes(): Promise<Cliente[]> {
  return fetchApi<Cliente[]>("/api/clientes");
}

export async function getTiendas(clienteId?: number): Promise<Tienda[]> {
  const params = clienteId ? `?clienteId=${clienteId}` : "";
  return fetchApi<Tienda[]>(`/api/tiendas${params}`);
}

export async function getPlazas(clienteId?: number): Promise<string[]> {
  const params = clienteId ? `?clienteId=${clienteId}` : "";
  return fetchApi<string[]>(`/api/tiendas/meta/plazas${params}`);
}

// ==========================================
// PRODUCTOS
// ==========================================

interface Producto {
  id: number;
  sku: string;
  nombre: string;
  categoria: string;
}

export async function getProductos(): Promise<Producto[]> {
  return fetchApi<Producto[]>("/api/productos");
}
