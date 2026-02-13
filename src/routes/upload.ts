import { Router, Request, Response } from 'express';
import { uploadMiddleware } from '../middleware/upload';
import { parseFile } from '../services/fileParser';
import { loadToStaging, commitFromStaging, cancelCarga } from '../services/dataLoader';
import { SourceType } from '../config/sources';
import prisma from '../config/database';

const router = Router();

// GET /api/upload/source-types - Listar tipos de fuente disponibles
router.get('/source-types', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: [
      { value: 'sell_in', label: 'SELL-IN (Órdenes de compra)', requiresCliente: false },
      { value: 'sell_out_heb_ventas', label: 'SELL-OUT HEB - Ventas', requiresCliente: true },
      { value: 'sell_out_heb_inventario', label: 'SELL-OUT HEB - Inventario', requiresCliente: true },
      { value: 'sell_out_fda', label: 'SELL-OUT FDA - Ventas', requiresCliente: true },
      { value: 'catalogo_productos', label: 'Catálogo de Productos', requiresCliente: false },
      { value: 'catalogo_mapeos', label: 'Mapeo SKU Cliente', requiresCliente: false }
    ]
  });
});

// POST /api/upload/preview - Subir y previsualizar archivo
router.post('/preview', uploadMiddleware.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({
        success: false,
        error: 'No se proporcionó archivo'
      });
      return;
    }

    const { clienteId, sourceType: forceSourceType } = req.body;

    // Parsear archivo
    const parseResult = parseFile(req.file.buffer, req.file.originalname);

    if (!parseResult.success) {
      res.status(400).json({
        success: false,
        error: 'Error al parsear archivo',
        details: parseResult.errors
      });
      return;
    }

    // Determinar tipo de fuente
    const sourceType: SourceType | null = forceSourceType || parseResult.sourceType;

    if (!sourceType) {
      res.status(400).json({
        success: false,
        error: 'No se pudo detectar el tipo de archivo. Por favor especifique el tipo.',
        detectedColumns: parseResult.detectedColumns,
        headers: parseResult.headers
      });
      return;
    }

    // Para SELL-OUT necesitamos clienteId
    const sellOutTypes = ['sell_out_heb_ventas', 'sell_out_heb_inventario', 'sell_out_fda'];
    if (sellOutTypes.includes(sourceType) && !clienteId) {
      res.status(400).json({
        success: false,
        error: 'clienteId es requerido para datos de SELL-OUT'
      });
      return;
    }

    // Cargar a staging
    const loadResult = await loadToStaging(
      sourceType,
      parseResult.rows,
      req.file.originalname,
      clienteId ? parseInt(String(clienteId)) : undefined
    );

    // Obtener resumen de staging
    const staging = await prisma.stagingRegistro.findMany({
      where: { cargaId: loadResult.cargaId },
      orderBy: { id: 'asc' },
      take: 100
    });

    res.json({
      success: true,
      data: {
        cargaId: loadResult.cargaId,
        sourceType,
        filename: req.file.originalname,
        summary: {
          totalRows: loadResult.totalRows,
          newRows: loadResult.newRows,
          duplicateRows: loadResult.duplicateRows,
          errorRows: loadResult.errorRows,
          unmappedSkus: loadResult.unmappedSkus
        },
        detectedColumns: parseResult.detectedColumns,
        preview: staging.slice(0, 20).map((s: { id: number; datos: unknown; esDuplicado: boolean; tieneError: boolean; mensajeError: string | null }) => ({
          id: s.id,
          data: s.datos,
          isDuplicate: s.esDuplicado,
          hasError: s.tieneError,
          errorMessage: s.mensajeError
        })),
        errors: loadResult.errors.slice(0, 50)
      }
    });
  } catch (error) {
    console.error('Error en upload/preview:', error);
    res.status(500).json({
      success: false,
      error: 'Error al procesar archivo'
    });
  }
});

// POST /api/upload/confirm/:cargaId - Confirmar carga
router.post('/confirm/:cargaId', async (req: Request, res: Response) => {
  try {
    const { cargaId } = req.params;
    const { includeUpdates } = req.body;

    const result = await commitFromStaging(
      parseInt(String(cargaId)),
      includeUpdates === true
    );

    res.json({
      success: true,
      data: {
        cargaId: parseInt(String(cargaId)),
        inserted: result.inserted,
        updated: result.updated,
        errors: result.errors
      }
    });
  } catch (error) {
    console.error('Error en upload/confirm:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error al confirmar carga'
    });
  }
});

// POST /api/upload/cancel/:cargaId - Cancelar carga
router.post('/cancel/:cargaId', async (req: Request, res: Response) => {
  try {
    const { cargaId } = req.params;

    await cancelCarga(parseInt(String(cargaId)));

    res.json({
      success: true,
      message: 'Carga cancelada correctamente'
    });
  } catch (error) {
    console.error('Error en upload/cancel:', error);
    res.status(500).json({
      success: false,
      error: 'Error al cancelar carga'
    });
  }
});

export default router;
