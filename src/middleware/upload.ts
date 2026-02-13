import multer from 'multer';
import path from 'path';
import fs from 'fs';

// Crear directorio de uploads si no existe
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configuración de almacenamiento
const storage = multer.memoryStorage();

// Filtro de archivos
const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const allowedExtensions = ['.csv', '.xlsx', '.xls'];
  const ext = path.extname(file.originalname).toLowerCase();

  if (allowedExtensions.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Tipo de archivo no permitido. Use: ${allowedExtensions.join(', ')}`));
  }
};

// Límite de tamaño (50MB por defecto)
const maxFileSize = parseInt(process.env.MAX_FILE_SIZE_MB ?? '50') * 1024 * 1024;

export const uploadMiddleware = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxFileSize
  }
});
