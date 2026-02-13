import { Router, Request, Response } from 'express';
import prisma from '../config/database';

const router = Router();

// GET /api/clientes/meta/tipos - Listar tipos únicos (DEBE IR ANTES DE /:id)
router.get('/meta/tipos', async (_req: Request, res: Response) => {
  try {
    const tipos = await prisma.cliente.findMany({
      where: { activo: true },
      select: { tipo: true },
      distinct: ['tipo']
    });

    res.json({
      success: true,
      data: tipos.map((t: { tipo: string | null }) => t.tipo).filter(Boolean)
    });
  } catch (error) {
    console.error('Error al obtener tipos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener tipos'
    });
  }
});

// GET /api/clientes - Listar todos los clientes
router.get('/', async (req: Request, res: Response) => {
  try {
    const { activo, tipo, tieneSellOut, buscar } = req.query;

    const where: Record<string, unknown> = {};

    if (activo !== undefined) {
      where.activo = activo === 'true';
    }

    if (tipo) {
      where.tipo = String(tipo);
    }

    if (tieneSellOut !== undefined) {
      where.tieneSellOut = tieneSellOut === 'true';
    }

    if (buscar) {
      where.OR = [
        { codigo: { contains: String(buscar), mode: 'insensitive' } },
        { nombre: { contains: String(buscar), mode: 'insensitive' } }
      ];
    }

    const clientes = await prisma.cliente.findMany({
      where,
      orderBy: { nombre: 'asc' },
      include: {
        _count: {
          select: {
            mapeos: true,
            tiendas: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: clientes,
      total: clientes.length
    });
  } catch (error) {
    console.error('Error al listar clientes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener clientes'
    });
  }
});

// GET /api/clientes/:id - Obtener un cliente por ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const cliente = await prisma.cliente.findUnique({
      where: { id: parseInt(String(id)) },
      include: {
        tiendas: {
          where: { activo: true },
          orderBy: { nombre: 'asc' }
        },
        mapeos: {
          include: {
            producto: true
          }
        },
        _count: {
          select: {
            sellIn: true,
            sellOutVentas: true,
            sellOutInventario: true
          }
        }
      }
    });

    if (!cliente) {
      res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
      return;
    }

    res.json({
      success: true,
      data: cliente
    });
  } catch (error) {
    console.error('Error al obtener cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener cliente'
    });
  }
});

// POST /api/clientes - Crear un nuevo cliente
router.post('/', async (req: Request, res: Response) => {
  try {
    const { codigo, nombre, tipo, tieneSellOut } = req.body;

    if (!codigo || !nombre) {
      res.status(400).json({
        success: false,
        error: 'Código y nombre son requeridos'
      });
      return;
    }

    const existente = await prisma.cliente.findUnique({
      where: { codigo }
    });

    if (existente) {
      res.status(409).json({
        success: false,
        error: `Ya existe un cliente con código: ${codigo}`
      });
      return;
    }

    const cliente = await prisma.cliente.create({
      data: {
        codigo,
        nombre,
        tipo,
        tieneSellOut: tieneSellOut ?? false
      }
    });

    res.status(201).json({
      success: true,
      data: cliente
    });
  } catch (error) {
    console.error('Error al crear cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear cliente'
    });
  }
});

// PUT /api/clientes/:id - Actualizar un cliente
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { codigo, nombre, tipo, tieneSellOut, activo } = req.body;

    const cliente = await prisma.cliente.update({
      where: { id: parseInt(String(id)) },
      data: {
        ...(codigo && { codigo }),
        ...(nombre && { nombre }),
        ...(tipo !== undefined && { tipo }),
        ...(tieneSellOut !== undefined && { tieneSellOut }),
        ...(activo !== undefined && { activo })
      }
    });

    res.json({
      success: true,
      data: cliente
    });
  } catch (error) {
    console.error('Error al actualizar cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar cliente'
    });
  }
});

// DELETE /api/clientes/:id - Eliminar (desactivar) un cliente
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const cliente = await prisma.cliente.update({
      where: { id: parseInt(String(id)) },
      data: { activo: false }
    });

    res.json({
      success: true,
      data: cliente,
      message: 'Cliente desactivado correctamente'
    });
  } catch (error) {
    console.error('Error al desactivar cliente:', error);
    res.status(500).json({
      success: false,
      error: 'Error al desactivar cliente'
    });
  }
});

export default router;
