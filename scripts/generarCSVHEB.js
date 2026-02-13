const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

async function generarCSV() {
  const prisma = new PrismaClient();

  // Obtener mapas
  const tiendas = await prisma.tiendas.findMany({ where: { cliente_id: 1 } });
  const productos = await prisma.productos.findMany();

  const tiendaMap = new Map(tiendas.map(t => [t.codigo_tienda, t.id]));
  const productoMap = new Map(productos.map(p => [p.sku, p.id]));

  console.log('Tiendas mapeadas:', tiendaMap.size);
  console.log('Productos mapeados:', productoMap.size);

  // Leer Excel
  const wb = XLSX.readFile('data/heb/sellout-heb.xlsx');
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet);

  console.log('Registros en Excel:', data.length);

  // Generar CSV
  let csv = 'cliente_id,tienda_id,producto_id,fecha,sku_cliente,unidades,importe,archivo_origen\n';
  let errores = 0;
  let skusNoEncontrados = new Set();

  for (const row of data) {
    const sku = String(row.sku);
    const productoId = productoMap.get(sku);
    const tiendaId = tiendaMap.get(String(row.id_tienda));

    if (!productoId) {
      skusNoEncontrados.add(sku);
      errores++;
      continue;
    }

    // Convertir fecha Excel a YYYY-MM-DD
    const serial = row.fecha;
    const date = new Date((serial - 25569) * 86400 * 1000);
    const fecha = date.toISOString().split('T')[0];

    csv += `1,${tiendaId || ''},${productoId},${fecha},${sku},${row.unidades || 0},${row.monto || ''},sellout-heb.xlsx\n`;
  }

  fs.writeFileSync('data/heb/sellout-heb-import.csv', csv);

  console.log('\nCSV generado: data/heb/sellout-heb-import.csv');
  console.log('Registros válidos:', data.length - errores);
  console.log('Errores (SKU no encontrado):', errores);
  if (skusNoEncontrados.size > 0) {
    console.log('SKUs no encontrados:', [...skusNoEncontrados]);
  }

  await prisma.$disconnect();
}

generarCSV();
