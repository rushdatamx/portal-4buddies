const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');

async function agregarClientesYVentas() {
  const prisma = new PrismaClient();

  try {
    // 1. Agregar los 4 clientes faltantes
    const clientesFaltantes = [
      { codigo: '162', nombre: 'GRUPO ELIF' },
      { codigo: '281', nombre: 'VERONICA HOLGUIN LOPEZ' },
      { codigo: '282', nombre: 'CORPORACION EDUCATIVA EDINBURGH' },
      { codigo: '285', nombre: 'CENTRO DE FORMACION PARA LAS NUEVAS GENERACIONES' }
    ];

    console.log('=== PASO 1: Agregando clientes faltantes ===');
    for (const cliente of clientesFaltantes) {
      await prisma.cliente.create({
        data: {
          codigo: cliente.codigo,
          nombre: cliente.nombre,
          activo: true
        }
      });
      console.log('Agregado: [' + cliente.codigo + '] ' + cliente.nombre);
    }

    const totalClientes = await prisma.cliente.count();
    console.log('Total clientes en BD:', totalClientes);

    // 2. Cargar ventas de esos clientes
    console.log('\n=== PASO 2: Cargando ventas de clientes faltantes ===');

    const workbook = XLSX.readFile('data/ventas.xls');
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(sheet);

    // Filtrar solo registros de los clientes faltantes
    const codigosFaltantes = ['162', '281', '282', '285'];
    const registrosFaltantes = data.filter(row => codigosFaltantes.includes(String(row.cve_cte)));

    console.log('Registros a procesar:', registrosFaltantes.length);

    // Obtener mapas actualizados
    const productos = await prisma.producto.findMany();
    const clientes = await prisma.cliente.findMany();

    const productoMap = new Map(productos.map(p => [p.sku, p.id]));
    const clienteMap = new Map(clientes.map(c => [c.codigo, c.id]));

    let insertados = 0;
    let errores = 0;

    for (const row of registrosFaltantes) {
      try {
        const sku = String(row.cve_prod);
        const codigoCliente = String(row.cve_cte);
        const productoId = productoMap.get(sku);
        const clienteId = clienteMap.get(codigoCliente);

        if (!productoId || !clienteId) {
          errores++;
          continue;
        }

        const mes = row.mes;
        const anio = row['aÒo'] || row.año || row.anio;
        const fecha = new Date(anio, mes - 1, 1);
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
      } catch (err) {
        errores++;
      }
    }

    console.log('\n=== RESULTADO ===');
    console.log('Registros insertados:', insertados);
    console.log('Errores/duplicados:', errores);

    const totalSellIn = await prisma.sellIn.count();
    console.log('Total SELL-IN en BD:', totalSellIn);

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

agregarClientesYVentas();
