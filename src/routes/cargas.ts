import { Router, Request, Response } from 'express';
import prisma from '../config/database';

const router = Router();

// GET /api/cargas - Listar historial de cargas
router.get('/', async (req: Request, res: Response) => {
  try {
    const { tipo, estatus, clienteId, limit, offset } = req.query;

    const where: Record<string, unknown> = {};

    if (tipo) {
      where.tipo = String(tipo);
    }

    if (estatus) {
      where.estatus = String(estatus);
    }

    if (clienteId) {
      where.clienteId = parseInt(String(clienteId));
    }

    const [cargas, total] = await Promise.all([
      prisma.cargas.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit ? parseInt(String(limit)) : 50,
        skip: offset ? parseInt(String(offset)) : 0,
        include: {
          cliente: {
            select: { id: true, nombre: true, codigo: true }
          },
          _count: {
            select: { stagingRegistros: true }
          }
        }
      }),
      prisma.cargas.count({ where })
    ]);

    res.json({
      success: true,
      data: cargas,
      total,
      pagination: {
        limit: limit ? parseInt(String(limit)) : 50,
        offset: offset ? parseInt(String(offset)) : 0
      }
    });
  } catch (error) {
    console.error('Error al listar cargas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener cargas'
    });
  }
});

// GET /api/cargas/stats/resumen - Estadísticas de cargas (DEBE IR ANTES DE /:id)
router.get('/stats/resumen', async (_req: Request, res: Response) => {
  try {
    const [total, porTipo, porEstatus, ultimaSemana] = await Promise.all([
      prisma.cargas.count(),
      prisma.cargas.groupBy({
        by: ['tipo'],
        _count: { id: true }
      }),
      prisma.cargas.groupBy({
        by: ['estatus'],
        _count: { id: true }
      }),
      prisma.cargas.findMany({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          }
        },
        select: {
          tipo: true,
          estatus: true,
          registrosTotales: true,
          registrosNuevos: true,
          createdAt: true
        }
      })
    ]);

    res.json({
      success: true,
      data: {
        total,
        porTipo: porTipo.map((t: { tipo: string; _count: { id: number } }) => ({ tipo: t.tipo, count: t._count.id })),
        porEstatus: porEstatus.map((e: { estatus: string; _count: { id: number } }) => ({ estatus: e.estatus, count: e._count.id })),
        ultimaSemana: {
          cargas: ultimaSemana.length,
          registros: ultimaSemana.reduce((sum: number, c: { registrosNuevos: number | null }) => sum + (c.registrosNuevos ?? 0), 0)
        }
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas'
    });
  }
});

// GET /api/cargas/:id - Obtener detalle de una carga
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const carga = await prisma.cargas.findUnique({
      where: { id: parseInt(String(id)) },
      include: {
        cliente: true,
        stagingRegistros: {
          orderBy: { id: 'asc' },
          take: 100
        }
      }
    });

    if (!carga) {
      res.status(404).json({
        success: false,
        error: 'Carga no encontrada'
      });
      return;
    }

    // Agrupar staging por estado
    const nuevos = carga.stagingRegistros.filter((s: { esDuplicado: boolean; tieneError: boolean }) => !s.esDuplicado && !s.tieneError);
    const duplicados = carga.stagingRegistros.filter((s: { esDuplicado: boolean }) => s.esDuplicado);
    const errores = carga.stagingRegistros.filter((s: { tieneError: boolean }) => s.tieneError);

    res.json({
      success: true,
      data: {
        ...carga,
        stagingRegistros: undefined,
        preview: {
          nuevos: nuevos.slice(0, 20).map((s: { id: number; datos: unknown }) => ({
            id: s.id,
            data: s.datos
          })),
          duplicados: duplicados.slice(0, 20).map((s: { id: number; datos: unknown; duplicadoDe: number | null }) => ({
            id: s.id,
            data: s.datos,
            existingId: s.duplicadoDe
          })),
          errores: errores.slice(0, 20).map((s: { id: number; datos: unknown; mensajeError: string | null }) => ({
            id: s.id,
            data: s.datos,
            error: s.mensajeError
          }))
        }
      }
    });
  } catch (error) {
    console.error('Error al obtener carga:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener carga'
    });
  }
});

// DELETE /api/cargas/:id - Eliminar una carga y sus registros de staging
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.staging_registros.deleteMany({
      where: { cargaId: parseInt(String(id)) }
    });

    await prisma.cargas.delete({
      where: { id: parseInt(String(id)) }
    });

    res.json({
      success: true,
      message: 'Carga eliminada correctamente'
    });
  } catch (error) {
    console.error('Error al eliminar carga:', error);
    res.status(500).json({
      success: false,
      error: 'Error al eliminar carga'
    });
  }
});

export default router;
