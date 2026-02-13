const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

function parseCSV(content) {
  const lines = content.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',');
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h.trim()] = values[i]?.trim());
    return obj;
  });
}

function parseDate(dateStr) {
  // Formato: DD/MM/YY
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const day = parseInt(parts[0]);
  const month = parseInt(parts[1]) - 1;
  let year = parseInt(parts[2]);
  if (year < 100) year += 2000;
  return new Date(year, month, day);
}

async function cargarFDA() {
  const prisma = new PrismaClient();

  try {
    // Obtener cliente FDA (código 104)
    const clienteFDA = await prisma.clientes.findFirst({
      where: { codigo: '104' }
    });

    if (!clienteFDA) {
      console.log('ERROR: Cliente FDA (código 104) no encontrado');
      process.exit(1);
    }

    console.log('Cliente FDA:', clienteFDA.nombre, '(ID:', clienteFDA.id, ')');

    // Marcar como cliente con sell out
    await prisma.clientes.update({
      where: { id: clienteFDA.id },
      data: { tiene_sell_out: true }
    });

    // ==========================================
    // PASO 1: CARGAR SUCURSALES
    // ==========================================
    console.log('\n=== PASO 1: Cargando sucursales ===');
    const sucursalesCSV = fs.readFileSync('data/fda/sucursales_fda.csv', 'utf-8');
    const sucursales = parseCSV(sucursalesCSV);

    console.log('Sucursales a procesar:', sucursales.length);

    let sucInsertadas = 0;
    for (const row of sucursales) {
      try {
        const codigoTienda = row.sucursal.split(' ')[0]; // Tomar solo el código
        await prisma.tiendas.upsert({
          where: {
            cliente_id_codigo_tienda: {
              cliente_id: clienteFDA.id,
              codigo_tienda: codigoTienda
            }
          },
          update: {
            nombre: row.sucursal,
            plaza: row.plaza_operativa
          },
          create: {
            cliente_id: clienteFDA.id,
            codigo_tienda: codigoTienda,
            nombre: row.sucursal,
            plaza: row.plaza_operativa,
            activo: true
          }
        });
        sucInsertadas++;
      } catch (err) {
        console.log('Error sucursal:', row.sucursal, err.message);
      }
    }
    console.log('Sucursales cargadas:', sucInsertadas);

    // Obtener mapa de tiendas
    const tiendas = await prisma.tiendas.findMany({
      where: { cliente_id: clienteFDA.id }
    });
    const tiendaMap = new Map(tiendas.map(t => [t.codigo_tienda, t.id]));
    console.log('Tiendas en mapa:', tiendaMap.size);

    // Obtener mapa de productos
    const productos = await prisma.productos.findMany();
    const productoMap = new Map(productos.map(p => [p.sku, p.id]));
    console.log('Productos en mapa:', productoMap.size);

    // ==========================================
    // PASO 2: CARGAR VENTAS
    // ==========================================
    console.log('\n=== PASO 2: Cargando ventas ===');
    const ventasCSV = fs.readFileSync('data/fda/ventas_fda.csv', 'utf-8');
    const ventas = parseCSV(ventasCSV);

    console.log('Ventas a procesar:', ventas.length);

    let ventasInsertadas = 0;
    let errores = 0;
    let skusNoEncontrados = new Set();
    let tiendasNoEncontradas = new Set();

    for (const row of ventas) {
      try {
        const sku = row.producto;
        const productoId = productoMap.get(sku);

        // Obtener código de tienda del nombre completo
        const codigoTienda = row.sucursal.split(' ')[0];
        const tiendaId = tiendaMap.get(codigoTienda);

        const fecha = parseDate(row.fecha);

        if (!productoId) {
          skusNoEncontrados.add(sku);
          errores++;
          continue;
        }

        if (!tiendaId) {
          tiendasNoEncontradas.add(codigoTienda);
        }

        // Limpiar costo (quitar $ y convertir)
        let costo = row.costo;
        if (costo) {
          costo = costo.replace('$', '').replace(',', '');
        }

        await prisma.sell_out_ventas.create({
          data: {
            cliente_id: clienteFDA.id,
            tienda_id: tiendaId || null,
            producto_id: productoId,
            fecha: fecha,
            sku_cliente: sku,
            unidades: parseFloat(row.unidades) || 0,
            precio_costo: costo ? parseFloat(costo) : null,
            archivo_origen: 'ventas_fda.csv'
          }
        });
        ventasInsertadas++;

        if (ventasInsertadas % 5000 === 0) {
          console.log('Progreso:', ventasInsertadas, 'insertadas...');
        }
      } catch (err) {
        if (err.code === 'P2002') {
          // Duplicado, ignorar
        } else {
          errores++;
        }
      }
    }

    console.log('\n=== RESULTADO ===');
    console.log('Ventas insertadas:', ventasInsertadas);
    console.log('Errores:', errores);
    if (skusNoEncontrados.size > 0) {
      console.log('SKUs no encontrados:', [...skusNoEncontrados]);
    }
    if (tiendasNoEncontradas.size > 0) {
      console.log('Tiendas no encontradas:', tiendasNoEncontradas.size);
    }

    // ==========================================
    // VERIFICACIÓN FINAL
    // ==========================================
    console.log('\n=== VERIFICACIÓN FINAL ===');
    const totalTiendas = await prisma.tiendas.count({ where: { cliente_id: clienteFDA.id } });
    const totalVentas = await prisma.sell_out_ventas.count({ where: { cliente_id: clienteFDA.id } });

    const fechaMin = await prisma.sell_out_ventas.findFirst({
      where: { cliente_id: clienteFDA.id },
      orderBy: { fecha: 'asc' },
      select: { fecha: true }
    });
    const fechaMax = await prisma.sell_out_ventas.findFirst({
      where: { cliente_id: clienteFDA.id },
      orderBy: { fecha: 'desc' },
      select: { fecha: true }
    });

    console.log('Tiendas FDA:', totalTiendas);
    console.log('Ventas FDA:', totalVentas);
    console.log('Rango fechas:', fechaMin?.fecha?.toISOString().split('T')[0], 'a', fechaMax?.fecha?.toISOString().split('T')[0]);

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

cargarFDA();
