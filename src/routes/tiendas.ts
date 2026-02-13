import { Router, Request, Response } from 'express';
import prisma from '../config/database';

const router = Router();

// GET /api/tiendas/meta/plazas - Listar plazas únicas (DEBE IR ANTES DE /:id)
router.get('/meta/plazas', async (req: Request, res: Response) => {
  try {
    const { clienteId } = req.query;

    const where: Record<string, unknown> = { activo: true };
    if (clienteId) {
      where.clienteId = parseInt(String(clienteId));
    }

    const plazas = await prisma.tienda.findMany({
      where,
      select: { plaza: true },
      distinct: ['plaza']
    });

    res.json({
      success: true,
      data: plazas.map((p: { plaza: string | null }) => p.plaza).filter(Boolean)
    });
  } catch (error) {
    console.error('Error al obtener plazas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener plazas'
    });
  }
});

// GET /api/tiendas - Listar todas las tiendas
router.get('/', async (req: Request, res: Response) => {
  try {
    const { activo, clienteId, plaza, buscar } = req.query;

    const where: Record<string, unknown> = {};

    if (activo !== undefined) {
      where.activo = activo === 'true';
    }

    if (clienteId) {
      where.clienteId = parseInt(String(clienteId));
    }

    if (plaza) {
      where.plaza = { contains: String(plaza), mode: 'insensitive' };
    }

    if (buscar) {
      where.OR = [
        { codigoTienda: { contains: String(buscar), mode: 'insensitive' } },
        { nombre: { contains: String(buscar), mode: 'insensitive' } }
      ];
    }

    const tiendas = await prisma.tienda.findMany({
      where,
      orderBy: { nombre: 'asc' },
      include: {
        cliente: {
          select: { id: true, nombre: true, codigo: true }
        }
      }
    });

    res.json({
      success: true,
      data: tiendas,
      total: tiendas.length
    });
  } catch (error) {
    console.error('Error al listar tiendas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener tiendas'
    });
  }
});

// GET /api/tiendas/:id - Obtener una tienda por ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const tienda = await prisma.tienda.findUnique({
      where: { id: parseInt(String(id)) },
      include: {
        cliente: true,
        _count: {
          select: {
            sellOutVentas: true,
            sellOutInventario: true
          }
        }
      }
    });

    if (!tienda) {
      res.status(404).json({
        success: false,
        error: 'Tienda no encontrada'
      });
      return;
    }

    res.json({
      success: true,
      data: tienda
    });
  } catch (error) {
    console.error('Error al obtener tienda:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener tienda'
    });
  }
});

// POST /api/tiendas - Crear una nueva tienda
router.post('/', async (req: Request, res: Response) => {
  try {
    const { clienteId, codigoTienda, nombre, plaza, estado, ciudad } = req.body;

    if (!clienteId || !codigoTienda) {
      res.status(400).json({
        success: false,
        error: 'clienteId y codigoTienda son requeridos'
      });
      return;
    }

    const cliente = await prisma.cliente.findUnique({
      where: { id: clienteId }
    });

    if (!cliente) {
      res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
      return;
    }

    const existente = await prisma.tienda.findUnique({
      where: {
        clienteId_codigoTienda: {
          clienteId,
          codigoTienda
        }
      }
    });

    if (existente) {
      res.status(409).json({
        success: false,
        error: `Ya existe una tienda con código ${codigoTienda} para este cliente`
      });
      return;
    }

    const tienda = await prisma.tienda.create({
      data: {
        clienteId,
        codigoTienda,
        nombre,
        plaza,
        estado,
        ciudad
      },
      include: {
        cliente: {
          select: { id: true, nombre: true, codigo: true }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: tienda
    });
  } catch (error) {
    console.error('Error al crear tienda:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear tienda'
    });
  }
});

// PUT /api/tiendas/:id - Actualizar una tienda
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { codigoTienda, nombre, plaza, estado, ciudad, activo } = req.body;

    const tienda = await prisma.tienda.update({
      where: { id: parseInt(String(id)) },
      data: {
        ...(codigoTienda && { codigoTienda }),
        ...(nombre !== undefined && { nombre }),
        ...(plaza !== undefined && { plaza }),
        ...(estado !== undefined && { estado }),
        ...(ciudad !== undefined && { ciudad }),
        ...(activo !== undefined && { activo })
      },
      include: {
        cliente: {
          select: { id: true, nombre: true, codigo: true }
        }
      }
    });

    res.json({
      success: true,
      data: tienda
    });
  } catch (error) {
    console.error('Error al actualizar tienda:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar tienda'
    });
  }
});

// DELETE /api/tiendas/:id - Eliminar (desactivar) una tienda
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const tienda = await prisma.tienda.update({
      where: { id: parseInt(String(id)) },
      data: { activo: false }
    });

    res.json({
      success: true,
      data: tienda,
      message: 'Tienda desactivada correctamente'
    });
  } catch (error) {
    console.error('Error al desactivar tienda:', error);
    res.status(500).json({
      success: false,
      error: 'Error al desactivar tienda'
    });
  }
});

export default router;
