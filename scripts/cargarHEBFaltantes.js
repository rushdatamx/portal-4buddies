const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');

function excelToDate(serial) {
  if (!serial) return null;
  const date = new Date((serial - 25569) * 86400 * 1000);
  return date;
}

async function cargarFaltantes() {
  const prisma = new PrismaClient();

  try {
    const clienteHEB = await prisma.clientes.findFirst({
      where: { codigo: '23' }
    });

    console.log('Cliente HEB:', clienteHEB.nombre, '(ID:', clienteHEB.id, ')');

    // Obtener mapas
    const tiendas = await prisma.tiendas.findMany({ where: { cliente_id: clienteHEB.id } });
    const productos = await prisma.productos.findMany();
    const tiendaMap = new Map(tiendas.map(t => [t.codigo_tienda, t.id]));
    const productoMap = new Map(productos.map(p => [p.sku, p.id]));

    // Fecha límite - solo insertar después de esta fecha
    const fechaLimite = new Date('2025-04-30');
    console.log('Insertando ventas después de:', fechaLimite.toISOString().split('T')[0]);

    // Leer Excel
    const wb = XLSX.readFile('data/heb/sellout-heb.xlsx');
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    console.log('Total registros en Excel:', data.length);

    // Filtrar solo los que faltan
    const faltantes = data.filter(row => {
      const fecha = excelToDate(row.fecha);
      return fecha > fechaLimite;
    });

    console.log('Registros a insertar (después de 2025-04-30):', faltantes.length);

    let insertados = 0;
    let errores = 0;
    let skusNoEncontrados = new Set();

    for (const row of faltantes) {
      try {
        const sku = String(row.sku);
        const productoId = productoMap.get(sku);
        const tiendaId = tiendaMap.get(String(row.id_tienda));
        const fecha = excelToDate(row.fecha);

        if (!productoId) {
          skusNoEncontrados.add(sku);
          errores++;
          continue;
        }

        await prisma.sell_out_ventas.create({
          data: {
            cliente_id: clienteHEB.id,
            tienda_id: tiendaId || null,
            producto_id: productoId,
            fecha: fecha,
            sku_cliente: sku,
            unidades: row.unidades || 0,
            importe: row.monto || null,
            archivo_origen: 'sellout-heb.xlsx'
          }
        });
        insertados++;

        if (insertados % 5000 === 0) {
          console.log('Progreso:', insertados, 'insertados...');
        }
      } catch (err) {
        // Si es duplicado, ignorar
        if (err.code === 'P2002') {
          // Duplicate, skip
        } else {
          errores++;
        }
      }
    }

    console.log('\n=== RESULTADO ===');
    console.log('Insertados:', insertados);
    console.log('Errores:', errores);
    if (skusNoEncontrados.size > 0) {
      console.log('SKUs no encontrados:', [...skusNoEncontrados]);
    }

    // Verificación final
    const totalVentas = await prisma.sell_out_ventas.count({ where: { cliente_id: clienteHEB.id } });
    const fechaMax = await prisma.sell_out_ventas.findFirst({
      where: { cliente_id: clienteHEB.id },
      orderBy: { fecha: 'desc' },
      select: { fecha: true }
    });

    console.log('\n=== VERIFICACIÓN FINAL ===');
    console.log('Total ventas HEB en BD:', totalVentas);
    console.log('Fecha más reciente:', fechaMax?.fecha?.toISOString().split('T')[0]);

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

cargarFaltantes();
