import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config();

// Importar rutas
import productosRoutes from './routes/productos';
import clientesRoutes from './routes/clientes';
import tiendasRoutes from './routes/tiendas';
import mapeosRoutes from './routes/mapeos';
import uploadRoutes from './routes/upload';
import cargasRoutes from './routes/cargas';
import dataRoutes from './routes/data';
import catalogosRoutes from './routes/catalogos';
import dashboardRoutes from './routes/dashboard';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API Info
app.get('/api', (_req, res) => {
  res.json({
    name: 'Portal 4BUDDIES KAM API',
    version: '1.0.0',
    description: 'API para gestión de datos SELL-IN y SELL-OUT',
    endpoints: {
      productos: '/api/productos',
      clientes: '/api/clientes',
      tiendas: '/api/tiendas',
      mapeos: '/api/mapeos',
      upload: '/api/upload',
      cargas: '/api/cargas',
      data: '/api/data',
      catalogos: '/api/catalogos'
    }
  });
});

// Rutas
app.use('/api/productos', productosRoutes);
app.use('/api/clientes', clientesRoutes);
app.use('/api/tiendas', tiendasRoutes);
app.use('/api/mapeos', mapeosRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/cargas', cargasRoutes);
app.use('/api/data', dataRoutes);
app.use('/api/catalogos', catalogosRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Manejo de errores
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Error interno del servidor'
  });
});

// 404
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint no encontrado'
  });
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`
  ╔════════════════════════════════════════════════════╗
  ║                                                    ║
  ║   Portal 4BUDDIES KAM API                         ║
  ║   Servidor corriendo en http://localhost:${PORT}     ║
  ║                                                    ║
  ╚════════════════════════════════════════════════════╝
  `);
});

export default app;
