// Tipos auxiliares para el proyecto

export interface StagingRegistroData {
  id: number;
  cargaId: number;
  tipoTabla: string | null;
  datos: Record<string, unknown>;
  esDuplicado: boolean;
  duplicadoDe: number | null;
  tieneError: boolean;
  mensajeError: string | null;
  createdAt: Date;
}

export interface CargaStats {
  tipo: string;
  _count: { id: number };
}

export interface EstatusStats {
  estatus: string;
  _count: { id: number };
}
