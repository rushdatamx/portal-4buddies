const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');

async function cargarSellIn() {
  const prisma = new PrismaClient();

  try {
    const workbook = XLSX.readFile('data/ventas.xls');
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    console.log('Procesando', data.length, 'registros de SELL-IN...');

    // Obtener mapas de productos y clientes
    const productos = await prisma.producto.findMany();
    const clientes = await prisma.cliente.findMany();

    const productoMap = new Map(productos.map(p => [p.sku, p.id]));
    const clienteMap = new Map(clientes.map(c => [c.codigo, c.id]));

    console.log('Productos en BD:', productoMap.size);
    console.log('Clientes en BD:', clienteMap.size);

    let insertados = 0;
    let errores = 0;
    let skuNoEncontrado = new Set();
    let clienteNoEncontrado = new Set();

    for (const row of data) {
      try {
        const sku = String(row.cve_prod);
        const codigoCliente = String(row.cve_cte);
        const productoId = productoMap.get(sku);
        const clienteId = clienteMap.get(codigoCliente);

        if (!productoId) {
          skuNoEncontrado.add(sku);
          errores++;
          continue;
        }

        if (!clienteId) {
          clienteNoEncontrado.add(codigoCliente);
          errores++;
          continue;
        }

        // Construir fecha desde mes y año
        const mes = row.mes;
        const anio = row['aÒo'] || row.año || row.anio;
        const dia = 1; // Usaremos día 1 del mes
        const fecha = new Date(anio, mes - 1, dia);

        const numeroOrden = String(row.no_fac || row.num_fac || '');

        await prisma.sellIn.create({
          data: {
            clienteId: clienteId,
            productoId: productoId,
            fecha: fecha,
            numeroOrden: numeroOrden,
            skuCliente: sku,
            cantidad: row.cant_surt || 0,
            precioUnitario: row.valor_prod || null,
            importeTotal: row.subt_prod || null,
            moneda: 'MXN',
            estatus: 'facturado',
            archivoOrigen: 'ventas.xls'
          }
        });

        insertados++;

        if (insertados % 1000 === 0) {
          console.log('Progreso:', insertados, 'registros insertados...');
        }
      } catch (err) {
        // Puede ser duplicado u otro error
        errores++;
      }
    }

    console.log('');
    console.log('=== RESULTADO ===');
    console.log('Registros insertados:', insertados);
    console.log('Errores/duplicados:', errores);

    if (skuNoEncontrado.size > 0) {
      console.log('');
      console.log('SKUs no encontrados en catálogo:', [...skuNoEncontrado]);
    }

    if (clienteNoEncontrado.size > 0) {
      console.log('');
      console.log('Clientes no encontrados:', [...clienteNoEncontrado]);
    }

    const totalBD = await prisma.sellIn.count();
    console.log('');
    console.log('Total registros SELL-IN en BD:', totalBD);

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

cargarSellIn();
