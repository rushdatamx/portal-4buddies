const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');

// Función para convertir serial Excel a fecha
function excelToDate(serial) {
  if (!serial) return null;
  const date = new Date((serial - 25569) * 86400 * 1000);
  return date;
}

async function cargarHEB() {
  const prisma = new PrismaClient();

  try {
    // Obtener el cliente HEB
    const clienteHEB = await prisma.clientes.findFirst({
      where: { codigo: '23' }
    });

    if (!clienteHEB) {
      console.log('ERROR: Cliente HEB (código 23) no encontrado en la base de datos');
      process.exit(1);
    }

    console.log('Cliente HEB encontrado:', clienteHEB.nombre, '(ID:', clienteHEB.id, ')');

    // ==========================================
    // PASO 1: CARGAR TIENDAS
    // ==========================================
    console.log('\n=== PASO 1: Cargando tiendas ===');
    const wbTiendas = XLSX.readFile('data/heb/tiendas-4buddies.xlsx');
    const sheetTiendas = wbTiendas.Sheets[wbTiendas.SheetNames[0]];
    const dataTiendas = XLSX.utils.sheet_to_json(sheetTiendas);

    console.log('Tiendas a procesar:', dataTiendas.length);

    let tiendasInsertadas = 0;
    for (const row of dataTiendas) {
      try {
        await prisma.tiendas.upsert({
          where: {
            cliente_id_codigo_tienda: {
              cliente_id: clienteHEB.id,
              codigo_tienda: String(row.id_tienda)
            }
          },
          update: {
            nombre: row.nombre_tienda,
            plaza: row.Cluster,
            ciudad: row.Ciudad
          },
          create: {
            cliente_id: clienteHEB.id,
            codigo_tienda: String(row.id_tienda),
            nombre: row.nombre_tienda,
            plaza: row.Cluster,
            ciudad: row.Ciudad,
            activo: true
          }
        });
        tiendasInsertadas++;
      } catch (err) {
        console.log('Error tienda:', row.id_tienda, err.message);
      }
    }
    console.log('Tiendas cargadas:', tiendasInsertadas);

    // Obtener mapa de tiendas
    const tiendas = await prisma.tiendas.findMany({
      where: { cliente_id: clienteHEB.id }
    });
    const tiendaMap = new Map(tiendas.map(t => [t.codigo_tienda, t.id]));

    // Obtener mapa de productos
    const productos = await prisma.productos.findMany();
    const productoMap = new Map(productos.map(p => [p.sku, p.id]));

    // ==========================================
    // PASO 2: CARGAR INVENTARIO
    // ==========================================
    console.log('\n=== PASO 2: Cargando inventario ===');
    const wbInv = XLSX.readFile('data/heb/inventario-heb.xlsx');
    const sheetInv = wbInv.Sheets[wbInv.SheetNames[0]];
    const dataInv = XLSX.utils.sheet_to_json(sheetInv);

    console.log('Registros de inventario a procesar:', dataInv.length);

    let invInsertados = 0;
    let invErrores = 0;
    let skusNoEncontrados = new Set();

    for (const row of dataInv) {
      try {
        const sku = String(row.UPC);
        const productoId = productoMap.get(sku);
        const tiendaId = tiendaMap.get(String(row.ID_Tienda));
        const fecha = excelToDate(row.Fecha);

        if (!productoId) {
          skusNoEncontrados.add(sku);
          invErrores++;
          continue;
        }

        await prisma.sell_out_inventario.upsert({
          where: {
            cliente_id_tienda_id_producto_id_fecha: {
              cliente_id: clienteHEB.id,
              tienda_id: tiendaId || null,
              producto_id: productoId,
              fecha: fecha
            }
          },
          update: {
            unidades_inventario: row.Inventario || 0,
            sku_cliente: sku
          },
          create: {
            cliente_id: clienteHEB.id,
            tienda_id: tiendaId || null,
            producto_id: productoId,
            fecha: fecha,
            sku_cliente: sku,
            unidades_inventario: row.Inventario || 0,
            archivo_origen: 'inventario-heb.xlsx'
          }
        });
        invInsertados++;
      } catch (err) {
        invErrores++;
      }
    }

    console.log('Inventario cargado:', invInsertados);
    console.log('Errores:', invErrores);
    if (skusNoEncontrados.size > 0) {
      console.log('SKUs no encontrados:', [...skusNoEncontrados]);
    }

    // ==========================================
    // PASO 3: CARGAR VENTAS
    // ==========================================
    console.log('\n=== PASO 3: Cargando ventas ===');
    const wbVentas = XLSX.readFile('data/heb/sellout-heb.xlsx');
    const sheetVentas = wbVentas.Sheets[wbVentas.SheetNames[0]];
    const dataVentas = XLSX.utils.sheet_to_json(sheetVentas);

    console.log('Registros de ventas a procesar:', dataVentas.length);

    let ventasInsertadas = 0;
    let ventasErrores = 0;
    skusNoEncontrados = new Set();

    for (const row of dataVentas) {
      try {
        const sku = String(row.sku);
        const productoId = productoMap.get(sku);
        const tiendaId = tiendaMap.get(String(row.id_tienda));
        const fecha = excelToDate(row.fecha);

        if (!productoId) {
          skusNoEncontrados.add(sku);
          ventasErrores++;
          continue;
        }

        await prisma.sell_out_ventas.upsert({
          where: {
            cliente_id_tienda_id_producto_id_fecha: {
              cliente_id: clienteHEB.id,
              tienda_id: tiendaId || null,
              producto_id: productoId,
              fecha: fecha
            }
          },
          update: {
            unidades: row.unidades || 0,
            importe: row.monto || null,
            sku_cliente: sku
          },
          create: {
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
        ventasInsertadas++;

        if (ventasInsertadas % 5000 === 0) {
          console.log('Progreso:', ventasInsertadas, 'ventas insertadas...');
        }
      } catch (err) {
        ventasErrores++;
      }
    }

    console.log('\nVentas cargadas:', ventasInsertadas);
    console.log('Errores/duplicados:', ventasErrores);
    if (skusNoEncontrados.size > 0) {
      console.log('SKUs no encontrados:', [...skusNoEncontrados]);
    }

    // ==========================================
    // RESUMEN FINAL
    // ==========================================
    console.log('\n=== RESUMEN FINAL ===');
    const totalTiendas = await prisma.tiendas.count({ where: { cliente_id: clienteHEB.id } });
    const totalInv = await prisma.sell_out_inventario.count({ where: { cliente_id: clienteHEB.id } });
    const totalVentas = await prisma.sell_out_ventas.count({ where: { cliente_id: clienteHEB.id } });

    console.log('Tiendas HEB:', totalTiendas);
    console.log('Registros Inventario HEB:', totalInv);
    console.log('Registros Ventas HEB:', totalVentas);

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

cargarHEB();
