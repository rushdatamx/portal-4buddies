import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// ==========================================
// SELL-IN DASHBOARD
// ==========================================

// GET /api/dashboard/sell-in/summary
router.get('/sell-in/summary', async (_req: Request, res: Response) => {
  try {
    const [aggregate, clientes, productos] = await Promise.all([
      prisma.sell_in.aggregate({
        _sum: { cantidad: true, importe_total: true },
        _count: true,
      }),
      prisma.sell_in.groupBy({ by: ['cliente_id'] }),
      prisma.sell_in.groupBy({ by: ['producto_id'] }),
    ]);

    res.json({
      success: true,
      data: {
        totalPedidos: aggregate._count,
        totalUnidades: Number(aggregate._sum.cantidad) || 0,
        totalImporte: Number(aggregate._sum.importe_total) || 0,
        clientesActivos: clientes.length,
        productosVendidos: productos.length,
      },
    });
  } catch (error) {
    console.error('Error en sell-in summary:', error);
    res.status(500).json({ success: false, error: 'Error al obtener resumen' });
  }
});

// GET /api/dashboard/sell-in/trend
router.get('/sell-in/trend', async (_req: Request, res: Response) => {
  try {
    const data = await prisma.$queryRaw<Array<{ mes: Date; unidades: bigint }>>`
      SELECT DATE_TRUNC('month', fecha) as mes,
             SUM(cantidad)::bigint as unidades
      FROM sell_in
      GROUP BY 1 ORDER BY 1
    `;

    const trend = data.map((row) => ({
      name: new Date(row.mes).toLocaleDateString('es-MX', {
        month: 'short',
        year: '2-digit',
      }),
      value: Number(row.unidades),
    }));

    res.json({ success: true, data: trend });
  } catch (error) {
    console.error('Error en sell-in trend:', error);
    res.status(500).json({ success: false, error: 'Error al obtener tendencia' });
  }
});

// GET /api/dashboard/sell-in/top-clientes
router.get('/sell-in/top-clientes', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const data = await prisma.$queryRaw<Array<{ nombre: string; unidades: bigint }>>`
      SELECT c.nombre, SUM(s.cantidad)::bigint as unidades
      FROM sell_in s
      JOIN clientes c ON s.cliente_id = c.id
      GROUP BY c.id, c.nombre
      ORDER BY unidades DESC
      LIMIT ${limit}
    `;

    const result = data.map((row) => ({
      name: row.nombre?.substring(0, 25) || 'Sin nombre',
      value: Number(row.unidades),
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error en sell-in top clientes:', error);
    res.status(500).json({ success: false, error: 'Error al obtener top clientes' });
  }
});

// GET /api/dashboard/sell-in/top-productos
router.get('/sell-in/top-productos', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const data = await prisma.$queryRaw<Array<{ nombre: string; unidades: bigint }>>`
      SELECT p.nombre, SUM(s.cantidad)::bigint as unidades
      FROM sell_in s
      JOIN productos p ON s.producto_id = p.id
      GROUP BY p.id, p.nombre
      ORDER BY unidades DESC
      LIMIT ${limit}
    `;

    const result = data.map((row) => ({
      name: row.nombre?.substring(0, 25) || 'Sin nombre',
      value: Number(row.unidades),
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error en sell-in top productos:', error);
    res.status(500).json({ success: false, error: 'Error al obtener top productos' });
  }
});

// ==========================================
// SELL-OUT HEB DASHBOARD (cliente_id = 1)
// ==========================================

const CLIENTE_HEB = 1;

// GET /api/dashboard/heb/summary
router.get('/heb/summary', async (_req: Request, res: Response) => {
  try {
    const [aggregate, tiendas, productos] = await Promise.all([
      prisma.sell_out_ventas.aggregate({
        where: { cliente_id: CLIENTE_HEB },
        _sum: { unidades: true, importe: true },
        _count: true,
      }),
      prisma.sell_out_ventas.groupBy({
        by: ['tienda_id'],
        where: { cliente_id: CLIENTE_HEB, tienda_id: { not: null } },
      }),
      prisma.sell_out_ventas.groupBy({
        by: ['producto_id'],
        where: { cliente_id: CLIENTE_HEB },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalRegistros: aggregate._count,
        totalUnidades: Number(aggregate._sum.unidades) || 0,
        totalImporte: Number(aggregate._sum.importe) || 0,
        tiendasActivas: tiendas.length,
        productosVendiendo: productos.length,
      },
    });
  } catch (error) {
    console.error('Error en HEB summary:', error);
    res.status(500).json({ success: false, error: 'Error al obtener resumen HEB' });
  }
});

// GET /api/dashboard/heb/trend
router.get('/heb/trend', async (_req: Request, res: Response) => {
  try {
    const data = await prisma.$queryRaw<Array<{ mes: Date; unidades: bigint }>>`
      SELECT DATE_TRUNC('month', fecha) as mes,
             SUM(unidades)::bigint as unidades
      FROM sell_out_ventas
      WHERE cliente_id = ${CLIENTE_HEB}
      GROUP BY 1 ORDER BY 1
    `;

    const trend = data.map((row) => ({
      name: new Date(row.mes).toLocaleDateString('es-MX', {
        month: 'short',
        year: '2-digit',
      }),
      value: Number(row.unidades),
    }));

    res.json({ success: true, data: trend });
  } catch (error) {
    console.error('Error en HEB trend:', error);
    res.status(500).json({ success: false, error: 'Error al obtener tendencia HEB' });
  }
});

// GET /api/dashboard/heb/top-tiendas
router.get('/heb/top-tiendas', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const data = await prisma.$queryRaw<Array<{ nombre: string; unidades: bigint }>>`
      SELECT t.nombre, SUM(v.unidades)::bigint as unidades
      FROM sell_out_ventas v
      JOIN tiendas t ON v.tienda_id = t.id
      WHERE v.cliente_id = ${CLIENTE_HEB}
      GROUP BY t.id, t.nombre
      ORDER BY unidades DESC
      LIMIT ${limit}
    `;

    const result = data.map((row) => ({
      name: row.nombre?.substring(0, 25) || 'Sin nombre',
      value: Number(row.unidades),
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error en HEB top tiendas:', error);
    res.status(500).json({ success: false, error: 'Error al obtener top tiendas' });
  }
});

// GET /api/dashboard/heb/top-productos
router.get('/heb/top-productos', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const data = await prisma.$queryRaw<Array<{ nombre: string; unidades: bigint }>>`
      SELECT p.nombre, SUM(v.unidades)::bigint as unidades
      FROM sell_out_ventas v
      JOIN productos p ON v.producto_id = p.id
      WHERE v.cliente_id = ${CLIENTE_HEB}
      GROUP BY p.id, p.nombre
      ORDER BY unidades DESC
      LIMIT ${limit}
    `;

    const result = data.map((row) => ({
      name: row.nombre?.substring(0, 25) || 'Sin nombre',
      value: Number(row.unidades),
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error en HEB top productos:', error);
    res.status(500).json({ success: false, error: 'Error al obtener top productos' });
  }
});

// ==========================================
// SELL-OUT FDA DASHBOARD (cliente_id = 47)
// ==========================================

const CLIENTE_FDA = 47;

// GET /api/dashboard/fda/summary
router.get('/fda/summary', async (_req: Request, res: Response) => {
  try {
    const [aggregate, tiendas, productos, totalTiendas] = await Promise.all([
      prisma.sell_out_ventas.aggregate({
        where: { cliente_id: CLIENTE_FDA },
        _sum: { unidades: true },
        _count: true,
      }),
      prisma.sell_out_ventas.groupBy({
        by: ['tienda_id'],
        where: { cliente_id: CLIENTE_FDA, tienda_id: { not: null } },
      }),
      prisma.sell_out_ventas.groupBy({
        by: ['producto_id'],
        where: { cliente_id: CLIENTE_FDA },
      }),
      prisma.tiendas.count({ where: { cliente_id: CLIENTE_FDA } }),
    ]);

    const sucursalesActivas = tiendas.length;
    const cobertura = totalTiendas > 0 ? (sucursalesActivas / totalTiendas) * 100 : 0;
    const totalUnidades = Number(aggregate._sum.unidades) || 0;
    const promedioPorSucursal = sucursalesActivas > 0 ? totalUnidades / sucursalesActivas : 0;

    res.json({
      success: true,
      data: {
        totalRegistros: aggregate._count,
        totalUnidades,
        sucursalesActivas,
        totalSucursales: totalTiendas,
        cobertura: cobertura.toFixed(1),
        promedioPorSucursal: promedioPorSucursal.toFixed(0),
        productosVendiendo: productos.length,
      },
    });
  } catch (error) {
    console.error('Error en FDA summary:', error);
    res.status(500).json({ success: false, error: 'Error al obtener resumen FDA' });
  }
});

// GET /api/dashboard/fda/trend
router.get('/fda/trend', async (_req: Request, res: Response) => {
  try {
    const data = await prisma.$queryRaw<Array<{ mes: Date; unidades: bigint }>>`
      SELECT DATE_TRUNC('month', fecha) as mes,
             SUM(unidades)::bigint as unidades
      FROM sell_out_ventas
      WHERE cliente_id = ${CLIENTE_FDA}
      GROUP BY 1 ORDER BY 1
    `;

    const trend = data.map((row) => ({
      name: new Date(row.mes).toLocaleDateString('es-MX', {
        month: 'short',
        year: '2-digit',
      }),
      value: Number(row.unidades),
    }));

    res.json({ success: true, data: trend });
  } catch (error) {
    console.error('Error en FDA trend:', error);
    res.status(500).json({ success: false, error: 'Error al obtener tendencia FDA' });
  }
});

// GET /api/dashboard/fda/top-plazas
router.get('/fda/top-plazas', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const data = await prisma.$queryRaw<
      Array<{ plaza: string; unidades: bigint; sucursales: bigint }>
    >`
      SELECT t.plaza,
             SUM(v.unidades)::bigint as unidades,
             COUNT(DISTINCT t.id)::bigint as sucursales
      FROM sell_out_ventas v
      JOIN tiendas t ON v.tienda_id = t.id
      WHERE v.cliente_id = ${CLIENTE_FDA}
      GROUP BY t.plaza
      ORDER BY unidades DESC
      LIMIT ${limit}
    `;

    const result = data.map((row) => ({
      name: row.plaza?.substring(0, 20) || 'Sin plaza',
      value: Number(row.unidades),
      sucursales: Number(row.sucursales),
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error en FDA top plazas:', error);
    res.status(500).json({ success: false, error: 'Error al obtener top plazas' });
  }
});

// GET /api/dashboard/fda/top-productos
router.get('/fda/top-productos', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;

    const data = await prisma.$queryRaw<
      Array<{ nombre: string; unidades: bigint; sucursales: bigint }>
    >`
      SELECT p.nombre,
             SUM(v.unidades)::bigint as unidades,
             COUNT(DISTINCT v.tienda_id)::bigint as sucursales
      FROM sell_out_ventas v
      JOIN productos p ON v.producto_id = p.id
      WHERE v.cliente_id = ${CLIENTE_FDA}
      GROUP BY p.id, p.nombre
      ORDER BY unidades DESC
      LIMIT ${limit}
    `;

    const result = data.map((row) => ({
      name: row.nombre?.substring(0, 25) || 'Sin nombre',
      value: Number(row.unidades),
      sucursales: Number(row.sucursales),
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error en FDA top productos:', error);
    res.status(500).json({ success: false, error: 'Error al obtener top productos' });
  }
});

// GET /api/dashboard/fda/cobertura
router.get('/fda/cobertura', async (_req: Request, res: Response) => {
  try {
    const data = await prisma.$queryRaw<Array<{ nombre: string; sucursales: bigint }>>`
      SELECT p.nombre,
             COUNT(DISTINCT v.tienda_id)::bigint as sucursales
      FROM sell_out_ventas v
      JOIN productos p ON v.producto_id = p.id
      WHERE v.cliente_id = ${CLIENTE_FDA}
      GROUP BY p.id, p.nombre
      ORDER BY sucursales DESC
    `;

    const result = data.map((row) => ({
      name: row.nombre?.substring(0, 25) || 'Sin nombre',
      value: Number(row.sucursales),
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error en FDA cobertura:', error);
    res.status(500).json({ success: false, error: 'Error al obtener cobertura' });
  }
});

export default router;
