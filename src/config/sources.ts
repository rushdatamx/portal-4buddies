// Configuración de mapeo de columnas por tipo de fuente de datos

export type SourceType =
  | 'sell_in'
  | 'sell_out_heb_ventas'
  | 'sell_out_heb_inventario'
  | 'sell_out_fda'
  | 'catalogo_productos'
  | 'catalogo_mapeos';

export interface SourceConfig {
  columns: Record<string, string[]>;
  duplicateKey: string[];
  targetTable: string;
}

export const SOURCE_CONFIGS: Record<SourceType, SourceConfig> = {
  sell_in: {
    columns: {
      cliente: ['cliente', 'customer', 'cliente_nombre', 'nombre_cliente'],
      fecha: ['fecha', 'date', 'fecha_orden', 'fecha_factura'],
      numeroOrden: ['orden', 'order', 'numero_orden', 'pedido', 'folio', 'factura'],
      sku: ['sku', 'sku_cliente', 'codigo_producto', 'producto', 'codigo'],
      cantidad: ['cantidad', 'qty', 'quantity', 'unidades', 'piezas'],
      precio: ['precio', 'price', 'precio_unitario', 'pu'],
      importe: ['importe', 'total', 'monto', 'subtotal']
    },
    duplicateKey: ['clienteId', 'numeroOrden', 'productoId', 'fecha'],
    targetTable: 'sell_in'
  },

  sell_out_heb_ventas: {
    columns: {
      fecha: ['fecha', 'date', 'fecha_venta'],
      tienda: ['tienda', 'store', 'sucursal', 'num_tienda', 'numero_tienda'],
      sku: ['sku', 'upc', 'codigo', 'producto', 'articulo'],
      unidades: ['unidades', 'piezas', 'qty', 'cantidad', 'vendido'],
      importe: ['importe', 'venta', 'total', 'monto']
    },
    duplicateKey: ['clienteId', 'tiendaId', 'productoId', 'fecha'],
    targetTable: 'sell_out_ventas'
  },

  sell_out_heb_inventario: {
    columns: {
      fecha: ['fecha', 'date', 'fecha_inventario'],
      tienda: ['tienda', 'store', 'sucursal', 'num_tienda', 'numero_tienda'],
      sku: ['sku', 'upc', 'codigo', 'producto', 'articulo'],
      inventario: ['inventario', 'stock', 'existencia', 'unidades', 'qty']
    },
    duplicateKey: ['clienteId', 'tiendaId', 'productoId', 'fecha'],
    targetTable: 'sell_out_inventario'
  },

  sell_out_fda: {
    columns: {
      mes: ['mes', 'periodo', 'month', 'fecha'],
      tienda: ['tienda', 'sucursal', 'store', 'num_sucursal'],
      plaza: ['plaza', 'plaza_operativa', 'region', 'zona'],
      sku: ['producto', 'sku', 'codigo', 'articulo'],
      unidades: ['unidades', 'piezas', 'cantidad'],
      precioCosto: ['precio_costo', 'costo', 'precio', 'pc']
    },
    duplicateKey: ['clienteId', 'tiendaId', 'productoId', 'fecha'],
    targetTable: 'sell_out_ventas'
  },

  catalogo_productos: {
    columns: {
      sku: ['sku', 'codigo', 'codigo_producto'],
      nombre: ['nombre', 'descripcion', 'producto', 'nombre_producto'],
      categoria: ['categoria', 'category', 'linea'],
      subcategoria: ['subcategoria', 'subcategory', 'familia'],
      unidadMedida: ['unidad_medida', 'unidad', 'um', 'uom']
    },
    duplicateKey: ['sku'],
    targetTable: 'productos'
  },

  catalogo_mapeos: {
    columns: {
      sku4buddies: ['sku_4buddies', 'sku_interno', 'sku', 'codigo_interno'],
      cliente: ['cliente', 'customer', 'nombre_cliente', 'cadena'],
      skuCliente: ['sku_cliente', 'codigo_cliente', 'upc', 'codigo_externo'],
      nombreCliente: ['nombre_cliente', 'descripcion_cliente', 'nombre_producto_cliente']
    },
    duplicateKey: ['clienteId', 'skuCliente'],
    targetTable: 'producto_cliente_mapeo'
  }
};

// Función para encontrar la columna correcta en los headers
export function findColumnMapping(headers: string[], possibleNames: string[]): string | null {
  const normalizedHeaders = headers.map(h =>
    h.toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
      .replace(/[^a-z0-9]/g, '_') // Reemplazar caracteres especiales
  );

  for (const name of possibleNames) {
    const normalizedName = name.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]/g, '_');

    const index = normalizedHeaders.findIndex(h => h.includes(normalizedName) || normalizedName.includes(h));
    if (index !== -1) {
      return headers[index] ?? null;
    }
  }
  return null;
}

// Función para detectar automáticamente el tipo de fuente basado en headers
export function detectSourceType(headers: string[]): SourceType | null {
  const normalizedHeaders = headers.map(h => h.toLowerCase().trim());

  // Detectar catálogo de productos
  if (normalizedHeaders.some(h => h.includes('sku') || h.includes('codigo')) &&
      normalizedHeaders.some(h => h.includes('nombre') || h.includes('descripcion')) &&
      normalizedHeaders.some(h => h.includes('categoria') || h.includes('linea'))) {
    return 'catalogo_productos';
  }

  // Detectar catálogo de mapeos
  if (normalizedHeaders.some(h => h.includes('sku_4buddies') || h.includes('sku_interno')) &&
      normalizedHeaders.some(h => h.includes('sku_cliente') || h.includes('codigo_cliente'))) {
    return 'catalogo_mapeos';
  }

  // Detectar SELL-IN (tiene orden/factura)
  if (normalizedHeaders.some(h => h.includes('orden') || h.includes('factura') || h.includes('pedido'))) {
    return 'sell_in';
  }

  // Detectar FDA (tiene plaza operativa)
  if (normalizedHeaders.some(h => h.includes('plaza') || h.includes('plaza_operativa'))) {
    return 'sell_out_fda';
  }

  // Detectar HEB Inventario
  if (normalizedHeaders.some(h => h.includes('inventario') || h.includes('stock') || h.includes('existencia'))) {
    return 'sell_out_heb_inventario';
  }

  // Detectar HEB Ventas (tiene tienda + unidades/importe)
  if (normalizedHeaders.some(h => h.includes('tienda') || h.includes('sucursal')) &&
      normalizedHeaders.some(h => h.includes('unidades') || h.includes('venta') || h.includes('importe'))) {
    return 'sell_out_heb_ventas';
  }

  return null;
}
