import prisma from '../config/database';
import { SourceType } from '../config/sources';

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  existingId: number | null;
  existingData: Record<string, unknown> | null;
}

// Verificar duplicado de SELL-IN
async function checkSellInDuplicate(
  clienteId: number,
  numeroOrden: string | null,
  productoId: number,
  fecha: Date
): Promise<DuplicateCheckResult> {
  const existing = await prisma.sell_in.findFirst({
    where: {
      clienteId,
      numeroOrden,
      productoId,
      fecha
    }
  });

  return {
    isDuplicate: !!existing,
    existingId: existing?.id ?? null,
    existingData: existing ? {
      cantidad: existing.cantidad,
      precioUnitario: existing.precioUnitario,
      importeTotal: existing.importeTotal
    } : null
  };
}

// Verificar duplicado de SELL-OUT Ventas
async function checkSellOutVentasDuplicate(
  clienteId: number,
  tiendaId: number | null,
  productoId: number,
  fecha: Date
): Promise<DuplicateCheckResult> {
  const existing = await prisma.sell_out_ventas.findFirst({
    where: {
      clienteId,
      tiendaId,
      productoId,
      fecha
    }
  });

  return {
    isDuplicate: !!existing,
    existingId: existing?.id ?? null,
    existingData: existing ? {
      unidades: existing.unidades,
      importe: existing.importe
    } : null
  };
}

// Verificar duplicado de SELL-OUT Inventario
async function checkSellOutInventarioDuplicate(
  clienteId: number,
  tiendaId: number | null,
  productoId: number,
  fecha: Date
): Promise<DuplicateCheckResult> {
  const existing = await prisma.sell_out_inventario.findFirst({
    where: {
      clienteId,
      tiendaId,
      productoId,
      fecha
    }
  });

  return {
    isDuplicate: !!existing,
    existingId: existing?.id ?? null,
    existingData: existing ? {
      unidadesInventario: existing.unidadesInventario
    } : null
  };
}

// Verificar duplicado de Producto (catálogo)
async function checkProductoDuplicate(sku: string): Promise<DuplicateCheckResult> {
  const existing = await prisma.productos.findUnique({
    where: { sku }
  });

  return {
    isDuplicate: !!existing,
    existingId: existing?.id ?? null,
    existingData: existing ? {
      nombre: existing.nombre,
      categoria: existing.categoria
    } : null
  };
}

// Verificar duplicado de Mapeo
async function checkMapeoDuplicate(
  clienteId: number,
  skuCliente: string
): Promise<DuplicateCheckResult> {
  const existing = await prisma.producto_cliente_mapeo.findUnique({
    where: {
      clienteId_skuCliente: {
        clienteId,
        skuCliente
      }
    },
    include: {
      producto: { select: { sku: true, nombre: true } }
    }
  });

  return {
    isDuplicate: !!existing,
    existingId: existing?.id ?? null,
    existingData: existing ? {
      productoSku: existing.producto.sku,
      productoNombre: existing.producto.nombre,
      nombreCliente: existing.nombreCliente
    } : null
  };
}

// Función principal para verificar duplicados
export async function checkDuplicate(
  sourceType: SourceType,
  data: Record<string, unknown>
): Promise<DuplicateCheckResult> {
  switch (sourceType) {
    case 'sell_in':
      return checkSellInDuplicate(
        data.clienteId as number,
        data.numeroOrden as string | null,
        data.productoId as number,
        data.fecha as Date
      );

    case 'sell_out_heb_ventas':
    case 'sell_out_fda':
      return checkSellOutVentasDuplicate(
        data.clienteId as number,
        data.tiendaId as number | null,
        data.productoId as number,
        data.fecha as Date
      );

    case 'sell_out_heb_inventario':
      return checkSellOutInventarioDuplicate(
        data.clienteId as number,
        data.tiendaId as number | null,
        data.productoId as number,
        data.fecha as Date
      );

    case 'catalogo_productos':
      return checkProductoDuplicate(data.sku as string);

    case 'catalogo_mapeos':
      return checkMapeoDuplicate(
        data.clienteId as number,
        data.skuCliente as string
      );

    default:
      return { isDuplicate: false, existingId: null, existingData: null };
  }
}

// Batch check para optimizar (pre-cargar IDs existentes)
export async function batchCheckSellIn(
  clienteId: number,
  keys: Array<{ numeroOrden: string | null; productoId: number; fecha: Date }>
): Promise<Set<string>> {
  // Crear set de claves existentes
  const existing = await prisma.sell_in.findMany({
    where: {
      clienteId,
      OR: keys.map(k => ({
        numeroOrden: k.numeroOrden,
        productoId: k.productoId,
        fecha: k.fecha
      }))
    },
    select: {
      numeroOrden: true,
      productoId: true,
      fecha: true
    }
  });

  const existingSet = new Set<string>();
  for (const e of existing) {
    existingSet.add(`${e.numeroOrden}|${e.productoId}|${e.fecha.toISOString()}`);
  }

  return existingSet;
}

export async function batchCheckSellOutVentas(
  clienteId: number,
  keys: Array<{ tiendaId: number | null; productoId: number; fecha: Date }>
): Promise<Set<string>> {
  const existing = await prisma.sell_out_ventas.findMany({
    where: {
      clienteId,
      OR: keys.map(k => ({
        tiendaId: k.tiendaId,
        productoId: k.productoId,
        fecha: k.fecha
      }))
    },
    select: {
      tiendaId: true,
      productoId: true,
      fecha: true
    }
  });

  const existingSet = new Set<string>();
  for (const e of existing) {
    existingSet.add(`${e.tiendaId}|${e.productoId}|${e.fecha.toISOString()}`);
  }

  return existingSet;
}
