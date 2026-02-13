import { Router, Request, Response } from 'express';
import prisma from '../config/database';

const router = Router();

// GET /api/data/sell-in - Consultar datos de SELL-IN
router.get('/sell-in', async (req: Request, res: Response) => {
  try {
    const { clienteId, productoId, fechaDesde, fechaHasta, limit, offset } = req.query;

    const where: Record<string, unknown> = {};

    if (clienteId) {
      where.clienteId = parseInt(clienteId as string);
    }

    if (productoId) {
      where.productoId = parseInt(productoId as string);
    }

    if (fechaDesde || fechaHasta) {
      where.fecha = {};
      if (fechaDesde) {
        (where.fecha as Record<string, Date>).gte = new Date(fechaDesde as string);
      }
      if (fechaHasta) {
        (where.fecha as Record<string, Date>).lte = new Date(fechaHasta as string);
      }
    }

    const [data, total] = await Promise.all([
      prisma.sellIn.findMany({
        where,
        orderBy: { fecha: 'desc' },
        take: limit ? parseInt(limit as string) : 100,
        skip: offset ? parseInt(offset as string) : 0,
        include: {
          cliente: { select: { id: true, nombre: true, codigo: true } },
          producto: { select: { id: true, sku: true, nombre: true, categoria: true } }
        }
      }),
      prisma.sellIn.count({ where })
    ]);

    res.json({
      success: true,
      data,
      total,
      pagination: {
        limit: limit ? parseInt(limit as string) : 100,
        offset: offset ? parseInt(offset as string) : 0
      }
    });
  } catch (error) {
    console.error('Error al consultar sell-in:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener datos'
    });
  }
});

// GET /api/data/sell-out/ventas - Consultar datos de SELL-OUT Ventas
router.get('/sell-out/ventas', async (req: Request, res: Response) => {
  try {
    const { clienteId, productoId, tiendaId, fechaDesde, fechaHasta, limit, offset } = req.query;

    const where: Record<string, unknown> = {};

    if (clienteId) {
      where.clienteId = parseInt(clienteId as string);
    }

    if (productoId) {
      where.productoId = parseInt(productoId as string);
    }

    if (tiendaId) {
      where.tiendaId = parseInt(tiendaId as string);
    }

    if (fechaDesde || fechaHasta) {
      where.fecha = {};
      if (fechaDesde) {
        (where.fecha as Record<string, Date>).gte = new Date(fechaDesde as string);
      }
      if (fechaHasta) {
        (where.fecha as Record<string, Date>).lte = new Date(fechaHasta as string);
      }
    }

    const [data, total] = await Promise.all([
      prisma.sellOutVentas.findMany({
        where,
        orderBy: { fecha: 'desc' },
        take: limit ? parseInt(limit as string) : 100,
        skip: offset ? parseInt(offset as string) : 0,
        include: {
          cliente: { select: { id: true, nombre: true, codigo: true } },
          producto: { select: { id: true, sku: true, nombre: true, categoria: true } },
          tienda: { select: { id: true, codigoTienda: true, nombre: true, plaza: true } }
        }
      }),
      prisma.sellOutVentas.count({ where })
    ]);

    res.json({
      success: true,
      data,
      total,
      pagination: {
        limit: limit ? parseInt(limit as string) : 100,
        offset: offset ? parseInt(offset as string) : 0
      }
    });
  } catch (error) {
    console.error('Error al consultar sell-out ventas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener datos'
    });
  }
});

// GET /api/data/sell-out/inventario - Consultar datos de SELL-OUT Inventario
router.get('/sell-out/inventario', async (req: Request, res: Response) => {
  try {
    const { clienteId, productoId, tiendaId, fechaDesde, fechaHasta, limit, offset } = req.query;

    const where: Record<string, unknown> = {};

    if (clienteId) {
      where.clienteId = parseInt(clienteId as string);
    }

    if (productoId) {
      where.productoId = parseInt(productoId as string);
    }

    if (tiendaId) {
      where.tiendaId = parseInt(tiendaId as string);
    }

    if (fechaDesde || fechaHasta) {
      where.fecha = {};
      if (fechaDesde) {
        (where.fecha as Record<string, Date>).gte = new Date(fechaDesde as string);
      }
      if (fechaHasta) {
        (where.fecha as Record<string, Date>).lte = new Date(fechaHasta as string);
      }
    }

    const [data, total] = await Promise.all([
      prisma.sellOutInventario.findMany({
        where,
        orderBy: { fecha: 'desc' },
        take: limit ? parseInt(limit as string) : 100,
        skip: offset ? parseInt(offset as string) : 0,
        include: {
          cliente: { select: { id: true, nombre: true, codigo: true } },
          producto: { select: { id: true, sku: true, nombre: true, categoria: true } },
          tienda: { select: { id: true, codigoTienda: true, nombre: true, plaza: true } }
        }
      }),
      prisma.sellOutInventario.count({ where })
    ]);

    res.json({
      success: true,
      data,
      total,
      pagination: {
        limit: limit ? parseInt(limit as string) : 100,
        offset: offset ? parseInt(offset as string) : 0
      }
    });
  } catch (error) {
    console.error('Error al consultar sell-out inventario:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener datos'
    });
  }
});

// GET /api/data/resumen - Resumen general de datos
router.get('/resumen', async (req: Request, res: Response) => {
  try {
    const { clienteId } = req.query;

    const where: Record<string, unknown> = {};
    if (clienteId) {
      where.clienteId = parseInt(clienteId as string);
    }

    const [sellInCount, sellOutVentasCount, sellOutInventarioCount, productos, clientes] = await Promise.all([
      prisma.sellIn.count({ where }),
      prisma.sellOutVentas.count({ where }),
      prisma.sellOutInventario.count({ where }),
      prisma.producto.count({ where: { activo: true } }),
      prisma.cliente.count({ where: { activo: true } })
    ]);

    // Últimas cargas
    const ultimasCargas = await prisma.carga.findMany({
      where: { estatus: 'completado' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        tipo: true,
        nombreArchivo: true,
        registrosNuevos: true,
        createdAt: true,
        cliente: { select: { nombre: true } }
      }
    });

    res.json({
      success: true,
      data: {
        totales: {
          sellIn: sellInCount,
          sellOutVentas: sellOutVentasCount,
          sellOutInventario: sellOutInventarioCount,
          productos,
          clientes
        },
        ultimasCargas
      }
    });
  } catch (error) {
    console.error('Error al obtener resumen:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener resumen'
    });
  }
});

// GET /api/data/sell-in/agregado - Datos de SELL-IN agregados
router.get('/sell-in/agregado', async (req: Request, res: Response) => {
  try {
    const { clienteId, fechaDesde, fechaHasta, agruparPor } = req.query;

    const where: Record<string, unknown> = {};

    if (clienteId) {
      where.clienteId = parseInt(clienteId as string);
    }

    if (fechaDesde || fechaHasta) {
      where.fecha = {};
      if (fechaDesde) {
        (where.fecha as Record<string, Date>).gte = new Date(fechaDesde as string);
      }
      if (fechaHasta) {
        (where.fecha as Record<string, Date>).lte = new Date(fechaHasta as string);
      }
    }

    let groupBy: ('clienteId' | 'productoId')[] = ['clienteId'];
    if (agruparPor === 'producto') {
      groupBy = ['productoId'];
    } else if (agruparPor === 'cliente_producto') {
      groupBy = ['clienteId', 'productoId'];
    }

    const agregado = await prisma.sellIn.groupBy({
      by: groupBy,
      where,
      _sum: {
        cantidad: true,
        importeTotal: true
      },
      _count: {
        id: true
      }
    });

    res.json({
      success: true,
      data: agregado
    });
  } catch (error) {
    console.error('Error al agregar sell-in:', error);
    res.status(500).json({
      success: false,
      error: 'Error al agregar datos'
    });
  }
});

export default router;
