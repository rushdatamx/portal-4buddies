import * as XLSX from 'xlsx';
import { parse } from 'csv-parse/sync';
import { SourceType, SOURCE_CONFIGS, findColumnMapping, detectSourceType } from '../config/sources';

export interface ParsedRow {
  rowNumber: number;
  data: Record<string, unknown>;
  rawData: Record<string, unknown>;
}

export interface ParseResult {
  success: boolean;
  headers: string[];
  rows: ParsedRow[];
  sourceType: SourceType | null;
  detectedColumns: Record<string, string | null>;
  totalRows: number;
  errors: Array<{ row: number; message: string }>;
}

// Leer archivo y convertir a array de objetos
export function parseFile(buffer: Buffer, filename: string): ParseResult {
  const extension = filename.toLowerCase().split('.').pop();
  let rawData: Record<string, unknown>[] = [];
  let headers: string[] = [];

  try {
    if (extension === 'csv') {
      const content = buffer.toString('utf-8');
      rawData = parse(content, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      });
      if (rawData.length > 0) {
        headers = Object.keys(rawData[0] ?? {});
      }
    } else if (extension === 'xlsx' || extension === 'xls') {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const firstSheet = workbook.SheetNames[0];
      if (firstSheet) {
        const worksheet = workbook.Sheets[firstSheet];
        if (worksheet) {
          rawData = XLSX.utils.sheet_to_json(worksheet, { defval: null });
          if (rawData.length > 0) {
            headers = Object.keys(rawData[0] ?? {});
          }
        }
      }
    } else {
      return {
        success: false,
        headers: [],
        rows: [],
        sourceType: null,
        detectedColumns: {},
        totalRows: 0,
        errors: [{ row: 0, message: `Formato de archivo no soportado: ${extension}` }]
      };
    }

    // Detectar tipo de fuente
    const sourceType = detectSourceType(headers);

    // Mapear columnas
    const detectedColumns: Record<string, string | null> = {};
    if (sourceType) {
      const config = SOURCE_CONFIGS[sourceType];
      for (const [field, possibleNames] of Object.entries(config.columns)) {
        detectedColumns[field] = findColumnMapping(headers, possibleNames);
      }
    }

    // Procesar filas
    const rows: ParsedRow[] = [];
    const errors: Array<{ row: number; message: string }> = [];

    rawData.forEach((raw, index) => {
      const rowNumber = index + 2; // +2 porque index es 0-based y hay header
      const mappedData: Record<string, unknown> = {};

      if (sourceType) {
        for (const [field, columnName] of Object.entries(detectedColumns)) {
          if (columnName) {
            mappedData[field] = raw[columnName];
          }
        }
      }

      rows.push({
        rowNumber,
        data: mappedData,
        rawData: raw
      });
    });

    return {
      success: true,
      headers,
      rows,
      sourceType,
      detectedColumns,
      totalRows: rows.length,
      errors
    };
  } catch (error) {
    return {
      success: false,
      headers: [],
      rows: [],
      sourceType: null,
      detectedColumns: {},
      totalRows: 0,
      errors: [{ row: 0, message: `Error al parsear archivo: ${error instanceof Error ? error.message : 'Error desconocido'}` }]
    };
  }
}

// Parsear fecha de diferentes formatos
export function parseDate(value: unknown): Date | null {
  if (!value) return null;

  // Si es número de Excel (serial date)
  if (typeof value === 'number') {
    const date = XLSX.SSF.parse_date_code(value);
    if (date) {
      return new Date(date.y, date.m - 1, date.d);
    }
  }

  // Si es string
  if (typeof value === 'string') {
    const str = value.trim();

    // Formato DD/MM/YYYY o DD-MM-YYYY
    const dmyMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (dmyMatch) {
      const [, day, month, year] = dmyMatch;
      return new Date(parseInt(year!), parseInt(month!) - 1, parseInt(day!));
    }

    // Formato YYYY-MM-DD
    const ymdMatch = str.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (ymdMatch) {
      const [, year, month, day] = ymdMatch;
      return new Date(parseInt(year!), parseInt(month!) - 1, parseInt(day!));
    }

    // Formato mes (para FDA): "Enero 2024", "01/2024", "2024-01"
    const monthYearMatch = str.match(/^(\d{1,2})[/-](\d{4})$/);
    if (monthYearMatch) {
      const [, month, year] = monthYearMatch;
      return new Date(parseInt(year!), parseInt(month!) - 1, 1);
    }

    // Intentar parse genérico
    const genericDate = new Date(str);
    if (!isNaN(genericDate.getTime())) {
      return genericDate;
    }
  }

  // Si ya es Date
  if (value instanceof Date) {
    return value;
  }

  return null;
}

// Parsear número
export function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    return isNaN(value) ? null : value;
  }

  if (typeof value === 'string') {
    // Quitar caracteres no numéricos excepto . y -
    const cleaned = value.replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleaned);
    return isNaN(num) ? null : num;
  }

  return null;
}

// Limpiar y normalizar string
export function normalizeString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const str = String(value).trim();
  return str === '' ? null : str;
}
