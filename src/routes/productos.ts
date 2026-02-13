import { Router, Request, Response } from 'express';
import prisma from '../config/database';

const router = Router();

// GET /api/productos/meta/categorias - Listar categorías únicas (DEBE IR ANTES DE /:id)
router.get('/meta/categorias', async (_req: Request, res: Response) => {
  try {
    const categorias = await prisma.producto.findMany({
      where: { activo: true },
      select: { categoria: true },
      distinct: ['categoria']
    });

    res.json({
      success: true,
      data: categorias.map((c: { categoria: string | null }) => c.categoria).filter(Boolean)
    });
  } catch (error) {
    console.error('Error al obtener categorías:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener categorías'
    });
  }
});

// GET /api/productos - Listar todos los productos
router.get('/', async (req: Request, res: Response) => {
  try {
    const { activo, categoria, buscar } = req.query;

    const where: Record<string, unknown> = {};

    if (activo !== undefined) {
      where.activo = activo === 'true';
    }

    if (categoria) {
      where.categoria = String(categoria);
    }

    if (buscar) {
      where.OR = [
        { sku: { contains: String(buscar), mode: 'insensitive' } },
        { nombre: { contains: String(buscar), mode: 'insensitive' } }
      ];
    }

    const productos = await prisma.producto.findMany({
      where,
      orderBy: { nombre: 'asc' },
      include: {
        _count: {
          select: { mapeos: true }
        }
      }
    });

    res.json({
      success: true,
      data: productos,
      total: productos.length
    });
  } catch (error) {
    console.error('Error al listar productos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener productos'
    });
  }
});

// GET /api/productos/:id - Obtener un producto por ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const producto = await prisma.producto.findUnique({
      where: { id: parseInt(String(id)) },
      include: {
        mapeos: {
          include: {
            cliente: true
          }
        }
      }
    });

    if (!producto) {
      res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
      return;
    }

    res.json({
      success: true,
      data: producto
    });
  } catch (error) {
    console.error('Error al obtener producto:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener producto'
    });
  }
});

// POST /api/productos - Crear un nuevo producto
router.post('/', async (req: Request, res: Response) => {
  try {
    const { sku, nombre, categoria, subcategoria, unidadMedida } = req.body;

    if (!sku || !nombre) {
      res.status(400).json({
        success: false,
        error: 'SKU y nombre son requeridos'
      });
      return;
    }

    const existente = await prisma.producto.findUnique({
      where: { sku }
    });

    if (existente) {
      res.status(409).json({
        success: false,
        error: `Ya existe un producto con SKU: ${sku}`
      });
      return;
    }

    const producto = await prisma.producto.create({
      data: {
        sku,
        nombre,
        categoria,
        subcategoria,
        unidadMedida
      }
    });

    res.status(201).json({
      success: true,
      data: producto
    });
  } catch (error) {
    console.error('Error al crear producto:', error);
    res.status(500).json({
      success: false,
      error: 'Error al crear producto'
    });
  }
});

// PUT /api/productos/:id - Actualizar un producto
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sku, nombre, categoria, subcategoria, unidadMedida, activo } = req.body;

    const producto = await prisma.producto.update({
      where: { id: parseInt(String(id)) },
      data: {
        ...(sku && { sku }),
        ...(nombre && { nombre }),
        ...(categoria !== undefined && { categoria }),
        ...(subcategoria !== undefined && { subcategoria }),
        ...(unidadMedida !== undefined && { unidadMedida }),
        ...(activo !== undefined && { activo })
      }
    });

    res.json({
      success: true,
      data: producto
    });
  } catch (error) {
    console.error('Error al actualizar producto:', error);
    res.status(500).json({
      success: false,
      error: 'Error al actualizar producto'
    });
  }
});

// DELETE /api/productos/:id - Eliminar (desactivar) un producto
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const producto = await prisma.producto.update({
      where: { id: parseInt(String(id)) },
      data: { activo: false }
    });

    res.json({
      success: true,
      data: producto,
      message: 'Producto desactivado correctamente'
    });
  } catch (error) {
    console.error('Error al desactivar producto:', error);
    res.status(500).json({
      success: false,
      error: 'Error al desactivar producto'
    });
  }
});

export default router;
