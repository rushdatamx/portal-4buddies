import { Router, Request, Response } from 'express';
import { uploadMiddleware } from '../middleware/upload';
import { parseFile } from '../services/fileParser';
import prisma from '../config/database';
import { getClienteIdByCodigo, getProductoIdBySku, clearMapeoCache } from '../services/productMapper';

const router = Router();

// POST /api/catalogos/productos/import - Importar catálogo de productos desde Excel
router.post('/productos/import', uploadMiddleware.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No se proporcionó archivo'
      });
      return;
    }

    const parseResult = parseFile(req.file.buffer, req.file.originalname);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Error al parsear archivo',
        details: parseResult.errors
      });
      return;
    }

    let inserted = 0;
    let updated = 0;
    let errors: Array<{ row: number; message: string }> = [];

    for (const row of parseResult.rows) {
      try {
        const sku = String(row.data.sku || row.rawData['sku'] || row.rawData['SKU'] || row.rawData['codigo'] || '').trim();
        const nombre = String(row.data.nombre || row.rawData['nombre'] || row.rawData['descripcion'] || row.rawData['producto'] || '').trim();

        if (!sku || !nombre) {
          errors.push({ row: row.rowNumber, message: 'SKU y nombre son requeridos' });
          continue;
        }

        const categoria = String(row.data.categoria || row.rawData['categoria'] || row.rawData['linea'] || '').trim() || null;
        const subcategoria = String(row.data.subcategoria || row.rawData['subcategoria'] || row.rawData['familia'] || '').trim() || null;
        const unidadMedida = String(row.data.unidadMedida || row.rawData['unidad_medida'] || row.rawData['unidad'] || '').trim() || null;

        // Upsert
        const existente = await prisma.producto.findUnique({ where: { sku } });

        if (existente) {
          await prisma.producto.update({
            where: { sku },
            data: { nombre, categoria, subcategoria, unidadMedida }
          });
          updated++;
        } else {
          await prisma.producto.create({
            data: { sku, nombre, categoria, subcategoria, unidadMedida }
          });
          inserted++;
        }
      } catch (error) {
        errors.push({
          row: row.rowNumber,
          message: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    }

    res.json({
      success: true,
      data: {
        totalRows: parseResult.rows.length,
        inserted,
        updated,
        errors: errors.slice(0, 50)
      }
    });
  } catch (error) {
    console.error('Error en importar productos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al importar productos'
    });
  }
});

// POST /api/catalogos/clientes/import - Importar catálogo de clientes desde Excel
router.post('/clientes/import', uploadMiddleware.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No se proporcionó archivo'
      });
      return;
    }

    const parseResult = parseFile(req.file.buffer, req.file.originalname);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Error al parsear archivo',
        details: parseResult.errors
      });
      return;
    }

    let inserted = 0;
    let updated = 0;
    let errors: Array<{ row: number; message: string }> = [];

    for (const row of parseResult.rows) {
      try {
        const codigo = String(row.rawData['codigo'] || row.rawData['cliente'] || '').trim();
        const nombre = String(row.rawData['nombre'] || row.rawData['nombre_cliente'] || '').trim();

        if (!codigo || !nombre) {
          errors.push({ row: row.rowNumber, message: 'Código y nombre son requeridos' });
          continue;
        }

        const tipo = String(row.rawData['tipo'] || '').trim() || null;
        const tieneSellOut = String(row.rawData['tiene_sell_out'] || row.rawData['sellout'] || '').toLowerCase() === 'true' ||
                            String(row.rawData['tiene_sell_out'] || row.rawData['sellout'] || '').toLowerCase() === 'si';

        const existente = await prisma.cliente.findUnique({ where: { codigo } });

        if (existente) {
          await prisma.cliente.update({
            where: { codigo },
            data: { nombre, tipo, tieneSellOut }
          });
          updated++;
        } else {
          await prisma.cliente.create({
            data: { codigo, nombre, tipo, tieneSellOut }
          });
          inserted++;
        }
      } catch (error) {
        errors.push({
          row: row.rowNumber,
          message: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    }

    res.json({
      success: true,
      data: {
        totalRows: parseResult.rows.length,
        inserted,
        updated,
        errors: errors.slice(0, 50)
      }
    });
  } catch (error) {
    console.error('Error en importar clientes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al importar clientes'
    });
  }
});

// POST /api/catalogos/mapeos/import - Importar mapeos SKU cliente desde Excel
router.post('/mapeos/import', uploadMiddleware.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No se proporcionó archivo'
      });
      return;
    }

    const parseResult = parseFile(req.file.buffer, req.file.originalname);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Error al parsear archivo',
        details: parseResult.errors
      });
      return;
    }

    let inserted = 0;
    let updated = 0;
    let errors: Array<{ row: number; message: string }> = [];

    for (const row of parseResult.rows) {
      try {
        // SKU interno de 4BUDDIES
        const sku4buddies = String(
          row.rawData['sku_4buddies'] ||
          row.rawData['sku_interno'] ||
          row.rawData['sku'] ||
          row.rawData['codigo_interno'] ||
          ''
        ).trim();

        if (!sku4buddies) {
          errors.push({ row: row.rowNumber, message: 'SKU 4BUDDIES es requerido' });
          continue;
        }

        // Buscar producto
        const productoId = await getProductoIdBySku(sku4buddies);
        if (!productoId) {
          errors.push({ row: row.rowNumber, message: `Producto no encontrado: ${sku4buddies}` });
          continue;
        }

        // Cliente
        const clienteStr = String(
          row.rawData['cliente'] ||
          row.rawData['customer'] ||
          row.rawData['cadena'] ||
          ''
        ).trim();

        if (!clienteStr) {
          errors.push({ row: row.rowNumber, message: 'Cliente es requerido' });
          continue;
        }

        const clienteId = await getClienteIdByCodigo(clienteStr);
        if (!clienteId) {
          errors.push({ row: row.rowNumber, message: `Cliente no encontrado: ${clienteStr}` });
          continue;
        }

        // SKU del cliente
        const skuCliente = String(
          row.rawData['sku_cliente'] ||
          row.rawData['codigo_cliente'] ||
          row.rawData['upc'] ||
          row.rawData['codigo_externo'] ||
          ''
        ).trim();

        if (!skuCliente) {
          errors.push({ row: row.rowNumber, message: 'SKU cliente es requerido' });
          continue;
        }

        const nombreCliente = String(
          row.rawData['nombre_cliente'] ||
          row.rawData['descripcion_cliente'] ||
          ''
        ).trim() || null;

        // Upsert mapeo
        const existente = await prisma.productoClienteMapeo.findUnique({
          where: {
            clienteId_skuCliente: { clienteId, skuCliente }
          }
        });

        if (existente) {
          await prisma.productoClienteMapeo.update({
            where: { id: existente.id },
            data: { productoId, nombreCliente }
          });
          updated++;
        } else {
          await prisma.productoClienteMapeo.create({
            data: { productoId, clienteId, skuCliente, nombreCliente }
          });
          inserted++;
        }
      } catch (error) {
        errors.push({
          row: row.rowNumber,
          message: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    }

    // Limpiar cache de mapeos
    clearMapeoCache();

    res.json({
      success: true,
      data: {
        totalRows: parseResult.rows.length,
        inserted,
        updated,
        errors: errors.slice(0, 50)
      }
    });
  } catch (error) {
    console.error('Error en importar mapeos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al importar mapeos'
    });
  }
});

// POST /api/catalogos/tiendas/import - Importar catálogo de tiendas desde Excel
router.post('/tiendas/import', uploadMiddleware.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No se proporcionó archivo'
      });
      return;
    }

    const { clienteId } = req.body;

    if (!clienteId) {
      res.status(400).json({
        success: false,
        error: 'clienteId es requerido'
      });
      return;
    }

    const parseResult = parseFile(req.file.buffer, req.file.originalname);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Error al parsear archivo',
        details: parseResult.errors
      });
      return;
    }

    let inserted = 0;
    let updated = 0;
    let errors: Array<{ row: number; message: string }> = [];

    for (const row of parseResult.rows) {
      try {
        const codigoTienda = String(
          row.rawData['codigo_tienda'] ||
          row.rawData['tienda'] ||
          row.rawData['sucursal'] ||
          row.rawData['numero'] ||
          ''
        ).trim();

        if (!codigoTienda) {
          errors.push({ row: row.rowNumber, message: 'Código de tienda es requerido' });
          continue;
        }

        const nombre = String(row.rawData['nombre'] || row.rawData['nombre_tienda'] || '').trim() || null;
        const plaza = String(row.rawData['plaza'] || row.rawData['region'] || '').trim() || null;
        const estado = String(row.rawData['estado'] || '').trim() || null;
        const ciudad = String(row.rawData['ciudad'] || '').trim() || null;

        const existente = await prisma.tienda.findUnique({
          where: {
            clienteId_codigoTienda: {
              clienteId: parseInt(clienteId),
              codigoTienda
            }
          }
        });

        if (existente) {
          await prisma.tienda.update({
            where: { id: existente.id },
            data: { nombre, plaza, estado, ciudad }
          });
          updated++;
        } else {
          await prisma.tienda.create({
            data: {
              clienteId: parseInt(clienteId),
              codigoTienda,
              nombre,
              plaza,
              estado,
              ciudad
            }
          });
          inserted++;
        }
      } catch (error) {
        errors.push({
          row: row.rowNumber,
          message: error instanceof Error ? error.message : 'Error desconocido'
        });
      }
    }

    res.json({
      success: true,
      data: {
        totalRows: parseResult.rows.length,
        inserted,
        updated,
        errors: errors.slice(0, 50)
      }
    });
  } catch (error) {
    console.error('Error en importar tiendas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al importar tiendas'
    });
  }
});

export default router;
