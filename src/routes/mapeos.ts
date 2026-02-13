import { Router, Request, Response } from 'express';
import prisma from '../config/database';

const router = Router();

// GET /api/mapeos/buscar/sku - Buscar producto por SKU de cliente (DEBE IR ANTES DE /:id)
router.get('/buscar/sku', async (req: Request, res: Response) => {
  try {
    const { skuCliente, clienteId } = req.query;

    if (!skuCliente || !clienteId) {
      res.status(400).json({
        success: false,
        error: 'skuCliente y clienteId son requeridos'
      });
      return;
    }

    const mapeo = await prisma.producto_cliente_mapeo.findUnique({
      where: {
        clienteId_skuCliente: {
          clienteId: parseInt(String(clienteId)),
          skuCliente: String(skuCliente)
        }
      },
      include: {
        producto: true,
        cliente: true
      }
    });

    if (!mapeo) {
      res.status(404).json({
        success: false,
        error: 'No se encontró mapeo para este SKU'
      });
      return;
    }

    res.json({
      success: true,
      data: mapeo
    });
  } catch (error) {
    console.error('Error al buscar mapeo:', error);
    res.status(500).json({
      success: false,
      error: 'Error al buscar mapeo'
    });
  }
});

// GET /api/mapeos - Listar todos los mapeos
router.get('/', async (req: Request, res: Response) => {
  try {
    const { activo, clienteId, productoId, buscar } = req.query;

    const where: Record<string, unknown> = {};

    if (activo !== undefined) {
      where.activo = activo === 'true';
    }

    if (clienteId) {
      where.clienteId = parseInt(String(clienteId));
    }

    if (productoId) {
      where.productoId = parseInt(String(productoId));
    }

    if (buscar) {
      where.OR = [
        { skuCliente: { contains: String(buscar), mode: 'insensitive' } },
        { nombreCliente: { contains: String(buscar), mode: 'insensitive' } },
        { producto: { sku: { contains: String(buscar), mode: 'insensitive' } } },
        { producto: { nombre: { contains: String(buscar), mode: 'insensitive' } } }
      ];
    }

    const mapeos = await prisma.producto_cliente_mapeo.findMany({
      where,
      orderBy: [
        { cliente: { nombre: 'asc' } },
        { producto: { nombre: 'asc' } }
      ],
      include: {
        producto: {
          select: { id: true, sku: true, nombre: true, categoria: true }
        },
        cliente: {
          select: { id: true, codigo: true, nombre: true }
        }
      }
    });

    res.json({
      success: true,
      data: mapeos,
      total: mapeos.length
    });
  } catch (error) {
    console.error('Error al listar mapeos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener mapeos'
    });
  }
});

// GET /api/mapeos/:id - Obtener un mapeo por ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const mapeo = await prisma.producto_cliente_mapeo.findUnique({
      where: { id: parseInt(String(id)) },
      include: {
        producto: true,
        cliente: true
      }
    });

    if (!mapeo) {
      res.status(404).json({
        success: false,
        error: 'Mapeo no encontrado'
      });
      return;
    }

    res.json({
      success: true,
      data: mapeo
    });
  } catch (error) {
    console.error('Error al obtener mapeo:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener mapeo'
    });
  }
});

// POST /api/mapeos - Crear un nuevo mapeo
router.post('/', async (req: Request, res: Response) => {
  try {
    const { productoId, clienteId, skuCliente, nombreCliente } = req.body;

    if (!productoId || !clienteId || !skuCliente) {
      res.status(400).json({
        success: false,
        error: 'productoId, clienteId y skuCliente son requeridos'
      });
      return;
    }

    const producto = await prisma.productos.findUnique({
      where: { id: productoId }
    });

    if (!producto) {
      res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
      return;
    }

    const cliente = await prisma.clientes.findUnique({
      where: { id: clienteId }
    });

    if (!cliente) {
      res.status(404).json({
        success: false,
        error: 'Cliente no encontrado'
      });
      return;
    }

    const existente = await prisma.producto_cliente_mapeo.findUnique({
      where: {
        clienteId_skuCliente: {
          clienteId,
          skuCliente
        }
      }
    });

    if (existente) {
      res.status(409).json({
        success: false,
        error: `Ya existe un mapeo con SKU ${skuCliente} para este cliente`
      });
      return;
    }

    const mapeo = await prisma.producto_cliente_mapeo.create({
      data: {
        productoId,
        clienteId,
        skuCliente,
        nombreCliente
      },
      include: {
        producto: {
          select: { id: true, sku: true, nombre: true }
        },
        cliente: {
          select: { id: true, codigo: true, nombre: true }
        }
      }
    });

    res.status(201).json({
      success: true,
      data: mapeo
    });
  } catch (error) {
    console.error('Error al crear mapeo:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear mapeo'
    });
  }
});

// PUT /api/mapeos/:id - Actualizar un mapeo
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { productoId, skuCliente, nombreCliente, activo } = req.body;

    const mapeo = await prisma.producto_cliente_mapeo.update({
      where: { id: parseInt(String(id)) },
      data: {
        ...(productoId && { productoId }),
        ...(skuCliente && { skuCliente }),
        ...(nombreCliente !== undefined && { nombreCliente }),
        ...(activo !== undefined && { activo })
      },
      include: {
        producto: {
          select: { id: true, sku: true, nombre: true }
        },
        cliente: {
          select: { id: true, codigo: true, nombre: true }
        }
      }
    });

    res.json({
      success: true,
      data: mapeo
    });
  } catch (error) {
    console.error('Error al actualizar mapeo:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar mapeo'
    });
  }
});

// DELETE /api/mapeos/:id - Eliminar (desactivar) un mapeo
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const mapeo = await prisma.producto_cliente_mapeo.update({
      where: { id: parseInt(String(id)) },
      data: { activo: false }
    });

    res.json({
      success: true,
      data: mapeo,
      message: 'Mapeo desactivado correctamente'
    });
  } catch (error) {
    console.error('Error al desactivar mapeo:', error);
    res.status(500).json({
      success: false,
      error: 'Error al desactivar mapeo'
    });
  }
});

export default router;
