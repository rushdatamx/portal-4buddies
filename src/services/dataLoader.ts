import prisma from '../config/database';
import { SourceType } from '../config/sources';
import { ParsedRow, parseDate, parseNumber, normalizeString } from './fileParser';
import { getProductoIdBySkuCliente, getClienteIdByCodigo, getOrCreateTienda, getMapeosByCliente, getProductoIdBySku, clearMapeoCache } from './productMapper';
import { checkDuplicate } from './duplicateDetector';

export interface LoadResult {
  cargaId: number;
  totalRows: number;
  newRows: number;
  duplicateRows: number;
  errorRows: number;
  unmappedSkus: string[];
  errors: Array<{ row: number; message: string }>;
}

// Crear registro de carga y procesar datos a staging
export async function loadToStaging(
  sourceType: SourceType,
  rows: ParsedRow[],
  filename: string,
  clienteId?: number // Para SELL-OUT donde sabemos el cliente
): Promise<LoadResult> {
  // Crear registro de carga
  const carga = await prisma.carga.create({
    data: {
      tipo: sourceType,
      clienteId,
      nombreArchivo: filename,
      registrosTotales: rows.length,
      estatus: 'procesando'
    }
  });

  const result: LoadResult = {
    cargaId: carga.id,
    totalRows: rows.length,
    newRows: 0,
    duplicateRows: 0,
    errorRows: 0,
    unmappedSkus: [],
    errors: []
  };

  // Pre-cargar mapeos si tenemos clienteId
  let mapeos: Map<string, number> | null = null;
  if (clienteId) {
    mapeos = await getMapeosByCliente(clienteId);
  }

  // Procesar cada fila
  const stagingRecords: Array<{
    cargaId: number;
    tipoTabla: string;
    datos: Record<string, unknown>;
    esDuplicado: boolean;
    duplicadoDe: number | null;
    tieneError: boolean;
    mensajeError: string | null;
  }> = [];

  for (const row of rows) {
    try {
      const processedData = await processRow(sourceType, row, clienteId, mapeos);

      if (processedData.error) {
        result.errorRows++;
        result.errors.push({ row: row.rowNumber, message: processedData.error });

        if (processedData.unmappedSku) {
          if (!result.unmappedSkus.includes(processedData.unmappedSku)) {
            result.unmappedSkus.push(processedData.unmappedSku);
          }
        }

        stagingRecords.push({
          cargaId: carga.id,
          tipoTabla: sourceType,
          datos: processedData.data,
          esDuplicado: false,
          duplicadoDe: null,
          tieneError: true,
          mensajeError: processedData.error
        });
        continue;
      }

      // Verificar duplicado
      const dupCheck = await checkDuplicate(sourceType, processedData.data);

      if (dupCheck.isDuplicate) {
        result.duplicateRows++;
        stagingRecords.push({
          cargaId: carga.id,
          tipoTabla: sourceType,
          datos: { ...processedData.data, existingData: dupCheck.existingData },
          esDuplicado: true,
          duplicadoDe: dupCheck.existingId,
          tieneError: false,
          mensajeError: null
        });
      } else {
        result.newRows++;
        stagingRecords.push({
          cargaId: carga.id,
          tipoTabla: sourceType,
          datos: processedData.data,
          esDuplicado: false,
          duplicadoDe: null,
          tieneError: false,
          mensajeError: null
        });
      }
    } catch (error) {
      result.errorRows++;
      const message = error instanceof Error ? error.message : 'Error desconocido';
      result.errors.push({ row: row.rowNumber, message });

      stagingRecords.push({
        cargaId: carga.id,
        tipoTabla: sourceType,
        datos: row.data,
        esDuplicado: false,
        duplicadoDe: null,
        tieneError: true,
        mensajeError: message
      });
    }
  }

  // Insertar en staging en batch
  if (stagingRecords.length > 0) {
    await prisma.stagingRegistro.createMany({
      data: stagingRecords.map(r => ({
        ...r,
        datos: r.datos as object
      }))
    });
  }

  // Actualizar carga
  await prisma.carga.update({
    where: { id: carga.id },
    data: {
      registrosNuevos: result.newRows,
      registrosDuplicados: result.duplicateRows,
      registrosError: result.errorRows,
      errores: result.errors.length > 0 ? result.errors : undefined,
      estatus: 'pendiente'
    }
  });

  return result;
}

// Procesar una fila según el tipo de fuente
async function processRow(
  sourceType: SourceType,
  row: ParsedRow,
  clienteId?: number,
  mapeos?: Map<string, number> | null
): Promise<{ data: Record<string, unknown>; error?: string; unmappedSku?: string }> {
  const data: Record<string, unknown> = {
    rowNumber: row.rowNumber,
    rawData: row.rawData
  };

  switch (sourceType) {
    case 'sell_in':
      return processSellIn(row, data);

    case 'sell_out_heb_ventas':
      return processSellOutVentas(row, data, clienteId!, mapeos!, false);

    case 'sell_out_heb_inventario':
      return processSellOutInventario(row, data, clienteId!, mapeos!);

    case 'sell_out_fda':
      return processSellOutVentas(row, data, clienteId!, mapeos!, true);

    case 'catalogo_productos':
      return processCatalogoProductos(row, data);

    case 'catalogo_mapeos':
      return processCatalogoMapeos(row, data);

    default:
      return { data, error: 'Tipo de fuente no soportado' };
  }
}

async function processSellIn(
  row: ParsedRow,
  data: Record<string, unknown>
): Promise<{ data: Record<string, unknown>; error?: string; unmappedSku?: string }> {
  // Obtener cliente
  const clienteStr = normalizeString(row.data.cliente);
  if (!clienteStr) {
    return { data, error: 'Cliente es requerido' };
  }

  const clienteId = await getClienteIdByCodigo(clienteStr);
  if (!clienteId) {
    return { data, error: `Cliente no encontrado: ${clienteStr}` };
  }
  data.clienteId = clienteId;

  // Fecha
  const fecha = parseDate(row.data.fecha);
  if (!fecha) {
    return { data, error: 'Fecha inválida o faltante' };
  }
  data.fecha = fecha;

  // SKU y producto
  const skuCliente = normalizeString(row.data.sku);
  if (!skuCliente) {
    return { data, error: 'SKU es requerido' };
  }
  data.skuCliente = skuCliente;

  const productoId = await getProductoIdBySkuCliente(skuCliente, clienteId);
  if (!productoId) {
    return { data, error: `SKU no mapeado: ${skuCliente}`, unmappedSku: skuCliente };
  }
  data.productoId = productoId;

  // Otros campos
  data.numeroOrden = normalizeString(row.data.numeroOrden);
  data.cantidad = parseNumber(row.data.cantidad) ?? 0;
  data.precioUnitario = parseNumber(row.data.precio);
  data.importeTotal = parseNumber(row.data.importe);

  return { data };
}

async function processSellOutVentas(
  row: ParsedRow,
  data: Record<string, unknown>,
  clienteId: number,
  mapeos: Map<string, number>,
  esMensual: boolean
): Promise<{ data: Record<string, unknown>; error?: string; unmappedSku?: string }> {
  data.clienteId = clienteId;

  // Fecha
  const fechaValue = esMensual ? row.data.mes : row.data.fecha;
  const fecha = parseDate(fechaValue);
  if (!fecha) {
    return { data, error: 'Fecha inválida o faltante' };
  }
  data.fecha = fecha;
  data.esDatoMensual = esMensual;

  // Tienda
  const codigoTienda = normalizeString(row.data.tienda);
  if (codigoTienda) {
    const tiendaId = await getOrCreateTienda(codigoTienda, clienteId, {
      plaza: normalizeString(row.data.plaza) ?? undefined
    });
    data.tiendaId = tiendaId;
  }

  // SKU y producto
  const skuCliente = normalizeString(row.data.sku);
  if (!skuCliente) {
    return { data, error: 'SKU es requerido' };
  }
  data.skuCliente = skuCliente;

  const productoId = mapeos.get(skuCliente);
  if (!productoId) {
    return { data, error: `SKU no mapeado: ${skuCliente}`, unmappedSku: skuCliente };
  }
  data.productoId = productoId;

  // Otros campos
  data.unidades = parseNumber(row.data.unidades) ?? 0;
  data.importe = parseNumber(row.data.importe);
  data.precioCosto = parseNumber(row.data.precioCosto);

  return { data };
}

async function processSellOutInventario(
  row: ParsedRow,
  data: Record<string, unknown>,
  clienteId: number,
  mapeos: Map<string, number>
): Promise<{ data: Record<string, unknown>; error?: string; unmappedSku?: string }> {
  data.clienteId = clienteId;

  // Fecha
  const fecha = parseDate(row.data.fecha);
  if (!fecha) {
    return { data, error: 'Fecha inválida o faltante' };
  }
  data.fecha = fecha;

  // Tienda
  const codigoTienda = normalizeString(row.data.tienda);
  if (codigoTienda) {
    const tiendaId = await getOrCreateTienda(codigoTienda, clienteId);
    data.tiendaId = tiendaId;
  }

  // SKU y producto
  const skuCliente = normalizeString(row.data.sku);
  if (!skuCliente) {
    return { data, error: 'SKU es requerido' };
  }
  data.skuCliente = skuCliente;

  const productoId = mapeos.get(skuCliente);
  if (!productoId) {
    return { data, error: `SKU no mapeado: ${skuCliente}`, unmappedSku: skuCliente };
  }
  data.productoId = productoId;

  // Inventario
  data.unidadesInventario = parseNumber(row.data.inventario) ?? 0;

  return { data };
}

async function processCatalogoProductos(
  row: ParsedRow,
  data: Record<string, unknown>
): Promise<{ data: Record<string, unknown>; error?: string }> {
  const sku = normalizeString(row.data.sku);
  if (!sku) {
    return { data, error: 'SKU es requerido' };
  }
  data.sku = sku;

  const nombre = normalizeString(row.data.nombre);
  if (!nombre) {
    return { data, error: 'Nombre es requerido' };
  }
  data.nombre = nombre;

  data.categoria = normalizeString(row.data.categoria);
  data.subcategoria = normalizeString(row.data.subcategoria);
  data.unidadMedida = normalizeString(row.data.unidadMedida);

  return { data };
}

async function processCatalogoMapeos(
  row: ParsedRow,
  data: Record<string, unknown>
): Promise<{ data: Record<string, unknown>; error?: string }> {
  // SKU interno de 4BUDDIES
  const sku4buddies = normalizeString(row.data.sku4buddies);
  if (!sku4buddies) {
    return { data, error: 'SKU 4BUDDIES es requerido' };
  }

  const productoId = await getProductoIdBySku(sku4buddies);
  if (!productoId) {
    return { data, error: `Producto no encontrado: ${sku4buddies}` };
  }
  data.productoId = productoId;

  // Cliente
  const clienteStr = normalizeString(row.data.cliente);
  if (!clienteStr) {
    return { data, error: 'Cliente es requerido' };
  }

  const clienteId = await getClienteIdByCodigo(clienteStr);
  if (!clienteId) {
    return { data, error: `Cliente no encontrado: ${clienteStr}` };
  }
  data.clienteId = clienteId;

  // SKU del cliente
  const skuCliente = normalizeString(row.data.skuCliente);
  if (!skuCliente) {
    return { data, error: 'SKU cliente es requerido' };
  }
  data.skuCliente = skuCliente;

  data.nombreCliente = normalizeString(row.data.nombreCliente);

  return { data };
}

// Confirmar carga de staging a tablas finales
export async function commitFromStaging(
  cargaId: number,
  includeUpdates: boolean = false
): Promise<{ inserted: number; updated: number; errors: string[] }> {
  const carga = await prisma.carga.findUnique({
    where: { id: cargaId },
    include: {
      stagingRegistros: {
        where: {
          tieneError: false,
          ...(includeUpdates ? {} : { esDuplicado: false })
        }
      }
    }
  });

  if (!carga) {
    throw new Error('Carga no encontrada');
  }

  let inserted = 0;
  let updated = 0;
  const errors: string[] = [];

  // Procesar por tipo
  for (const staging of carga.stagingRegistros) {
    try {
      const datos = staging.datos as Record<string, unknown>;

      if (staging.esDuplicado && includeUpdates) {
        // Actualizar registro existente
        await updateExistingRecord(carga.tipo as SourceType, staging.duplicadoDe!, datos);
        updated++;
      } else if (!staging.esDuplicado) {
        // Insertar nuevo
        await insertNewRecord(carga.tipo as SourceType, datos, cargaId);
        inserted++;
      }
    } catch (error) {
      errors.push(`Fila ${staging.id}: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }
  }

  // Limpiar staging y actualizar carga
  await prisma.stagingRegistro.deleteMany({
    where: { cargaId }
  });

  await prisma.carga.update({
    where: { id: cargaId },
    data: {
      estatus: 'completado',
      registrosNuevos: inserted,
      registrosDuplicados: carga.registrosDuplicados
    }
  });

  // Limpiar cache de mapeos
  clearMapeoCache();

  return { inserted, updated, errors };
}

async function insertNewRecord(
  sourceType: SourceType,
  data: Record<string, unknown>,
  cargaId: number
): Promise<void> {
  switch (sourceType) {
    case 'sell_in':
      await prisma.sellIn.create({
        data: {
          clienteId: data.clienteId as number,
          productoId: data.productoId as number,
          fecha: data.fecha as Date,
          numeroOrden: data.numeroOrden as string | null,
          skuCliente: data.skuCliente as string | null,
          cantidad: data.cantidad as number,
          precioUnitario: data.precioUnitario as number | null,
          importeTotal: data.importeTotal as number | null,
          cargaId
        }
      });
      break;

    case 'sell_out_heb_ventas':
    case 'sell_out_fda':
      await prisma.sellOutVentas.create({
        data: {
          clienteId: data.clienteId as number,
          tiendaId: data.tiendaId as number | null,
          productoId: data.productoId as number,
          fecha: data.fecha as Date,
          skuCliente: data.skuCliente as string | null,
          unidades: data.unidades as number,
          importe: data.importe as number | null,
          precioCosto: data.precioCosto as number | null,
          esDatoMensual: data.esDatoMensual as boolean ?? false,
          cargaId
        }
      });
      break;

    case 'sell_out_heb_inventario':
      await prisma.sellOutInventario.create({
        data: {
          clienteId: data.clienteId as number,
          tiendaId: data.tiendaId as number | null,
          productoId: data.productoId as number,
          fecha: data.fecha as Date,
          skuCliente: data.skuCliente as string | null,
          unidadesInventario: data.unidadesInventario as number,
          cargaId
        }
      });
      break;

    case 'catalogo_productos':
      await prisma.producto.create({
        data: {
          sku: data.sku as string,
          nombre: data.nombre as string,
          categoria: data.categoria as string | null,
          subcategoria: data.subcategoria as string | null,
          unidadMedida: data.unidadMedida as string | null
        }
      });
      break;

    case 'catalogo_mapeos':
      await prisma.productoClienteMapeo.create({
        data: {
          productoId: data.productoId as number,
          clienteId: data.clienteId as number,
          skuCliente: data.skuCliente as string,
          nombreCliente: data.nombreCliente as string | null
        }
      });
      break;
  }
}

async function updateExistingRecord(
  sourceType: SourceType,
  existingId: number,
  data: Record<string, unknown>
): Promise<void> {
  switch (sourceType) {
    case 'sell_in':
      await prisma.sellIn.update({
        where: { id: existingId },
        data: {
          cantidad: data.cantidad as number,
          precioUnitario: data.precioUnitario as number | null,
          importeTotal: data.importeTotal as number | null
        }
      });
      break;

    case 'sell_out_heb_ventas':
    case 'sell_out_fda':
      await prisma.sellOutVentas.update({
        where: { id: existingId },
        data: {
          unidades: data.unidades as number,
          importe: data.importe as number | null,
          precioCosto: data.precioCosto as number | null
        }
      });
      break;

    case 'sell_out_heb_inventario':
      await prisma.sellOutInventario.update({
        where: { id: existingId },
        data: {
          unidadesInventario: data.unidadesInventario as number
        }
      });
      break;

    case 'catalogo_productos':
      await prisma.producto.update({
        where: { id: existingId },
        data: {
          nombre: data.nombre as string,
          categoria: data.categoria as string | null,
          subcategoria: data.subcategoria as string | null,
          unidadMedida: data.unidadMedida as string | null
        }
      });
      break;

    case 'catalogo_mapeos':
      await prisma.productoClienteMapeo.update({
        where: { id: existingId },
        data: {
          productoId: data.productoId as number,
          nombreCliente: data.nombreCliente as string | null
        }
      });
      break;
  }
}

// Cancelar carga (limpiar staging)
export async function cancelCarga(cargaId: number): Promise<void> {
  await prisma.stagingRegistro.deleteMany({
    where: { cargaId }
  });

  await prisma.carga.update({
    where: { id: cargaId },
    data: { estatus: 'cancelado' }
  });
}
