import prisma from '../config/database';

// Cache de mapeos para evitar queries repetidas
const mapeoCache = new Map<string, number | null>();

// Obtener producto_id a partir de sku_cliente y cliente_id
export async function getProductoIdBySkuCliente(
  skuCliente: string,
  clienteId: number
): Promise<number | null> {
  const cacheKey = `${clienteId}:${skuCliente}`;

  // Revisar cache
  if (mapeoCache.has(cacheKey)) {
    return mapeoCache.get(cacheKey) ?? null;
  }

  // Buscar en BD
  const mapeo = await prisma.productoClienteMapeo.findUnique({
    where: {
      clienteId_skuCliente: {
        clienteId,
        skuCliente
      }
    },
    select: { productoId: true }
  });

  const productoId = mapeo?.productoId ?? null;
  mapeoCache.set(cacheKey, productoId);

  return productoId;
}

// Obtener cliente_id a partir de código o nombre
export async function getClienteIdByCodigo(codigo: string): Promise<number | null> {
  const cliente = await prisma.cliente.findFirst({
    where: {
      OR: [
        { codigo: { equals: codigo, mode: 'insensitive' } },
        { nombre: { equals: codigo, mode: 'insensitive' } }
      ],
      activo: true
    },
    select: { id: true }
  });

  return cliente?.id ?? null;
}

// Obtener tienda_id a partir de código de tienda y cliente_id
export async function getTiendaId(
  codigoTienda: string,
  clienteId: number
): Promise<number | null> {
  const tienda = await prisma.tienda.findUnique({
    where: {
      clienteId_codigoTienda: {
        clienteId,
        codigoTienda
      }
    },
    select: { id: true }
  });

  return tienda?.id ?? null;
}

// Crear o obtener tienda (auto-crear si no existe)
export async function getOrCreateTienda(
  codigoTienda: string,
  clienteId: number,
  extras?: { nombre?: string; plaza?: string }
): Promise<number> {
  let tienda = await prisma.tienda.findUnique({
    where: {
      clienteId_codigoTienda: {
        clienteId,
        codigoTienda
      }
    },
    select: { id: true }
  });

  if (!tienda) {
    tienda = await prisma.tienda.create({
      data: {
        clienteId,
        codigoTienda,
        nombre: extras?.nombre ?? codigoTienda,
        plaza: extras?.plaza
      },
      select: { id: true }
    });
  }

  return tienda.id;
}

// Limpiar cache (útil al cargar catálogos nuevos)
export function clearMapeoCache(): void {
  mapeoCache.clear();
}

// Obtener todos los mapeos de un cliente (para carga masiva)
export async function getMapeosByCliente(clienteId: number): Promise<Map<string, number>> {
  const mapeos = await prisma.productoClienteMapeo.findMany({
    where: { clienteId, activo: true },
    select: { skuCliente: true, productoId: true }
  });

  const map = new Map<string, number>();
  for (const mapeo of mapeos) {
    map.set(mapeo.skuCliente, mapeo.productoId);
  }

  return map;
}

// Obtener producto_id por SKU interno (para catálogos)
export async function getProductoIdBySku(sku: string): Promise<number | null> {
  const producto = await prisma.producto.findUnique({
    where: { sku },
    select: { id: true }
  });

  return producto?.id ?? null;
}
