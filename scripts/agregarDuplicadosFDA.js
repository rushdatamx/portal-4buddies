const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

function parseCSV(content) {
  const lines = content.split('\n').filter(l => l.trim());
  const headers = lines[0].split(',');
  return lines.slice(1).map((line, idx) => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((h, i) => obj[h.trim()] = values[i] ? values[i].trim() : '');
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

async function agregarDuplicados() {
  const prisma = new PrismaClient();

  try {
    // Obtener cliente FDA
    const clienteFDA = await prisma.clientes.findFirst({
      where: { codigo: '104' }
    });

    console.log('Cliente FDA:', clienteFDA.nombre, '(ID:', clienteFDA.id, ')');

    // Obtener mapas
    const tiendas = await prisma.tiendas.findMany({ where: { cliente_id: clienteFDA.id } });
    const productos = await prisma.productos.findMany();
    const tiendaMap = new Map(tiendas.map(t => [t.codigo_tienda, t.id]));
    const productoMap = new Map(productos.map(p => [p.sku, p.id]));

    // Leer CSV
    const ventasCSV = fs.readFileSync('data/fda/ventas_fda.csv', 'utf-8');
    const ventas = parseCSV(ventasCSV);

    console.log('Total registros en CSV:', ventas.length);

    // Agrupar por fecha+sucursal+producto y sumar unidades
    // Solo guardar los que tienen duplicados (count > 1)
    const agrupados = new Map();
    const conteos = new Map();

    ventas.forEach(row => {
      const sku = row.producto;
      if (!sku || sku === '1') return; // Ignorar SKUs inválidos

      const codigoTienda = row.sucursal.split(' ')[0];
      const key = row.fecha + '|' + codigoTienda + '|' + sku;

      conteos.set(key, (conteos.get(key) || 0) + 1);

      if (agrupados.has(key)) {
        const existing = agrupados.get(key);
        existing.unidades += parseFloat(row.unidades) || 0;
      } else {
        let costo = row.costo;
        if (costo) {
          costo = costo.replace('$', '').replace(',', '');
        }
        agrupados.set(key, {
          fecha: row.fecha,
          codigoTienda: codigoTienda,
          sku: sku,
          unidades: parseFloat(row.unidades) || 0,
          costo: costo ? parseFloat(costo) : null
        });
      }
    });

    // Filtrar solo los duplicados (count > 1)
    const duplicados = [...agrupados.entries()].filter(([key, _]) => conteos.get(key) > 1);

    console.log('Registros con duplicados:', duplicados.length);

    // Solo actualizar los duplicados
    let actualizados = 0;
    let errores = 0;

    for (const [key, data] of duplicados) {
      const productoId = productoMap.get(data.sku);
      const tiendaId = tiendaMap.get(data.codigoTienda);
      const fecha = parseDate(data.fecha);

      if (!productoId || !fecha) continue;

      try {
        // Buscar el registro existente
        const existente = await prisma.sell_out_ventas.findFirst({
          where: {
            cliente_id: clienteFDA.id,
            producto_id: productoId,
            tienda_id: tiendaId || null,
            fecha: fecha,
            sku_cliente: data.sku
          }
        });

        if (existente && existente.unidades < data.unidades) {
          // Actualizar con las unidades sumadas
          await prisma.sell_out_ventas.update({
            where: { id: existente.id },
            data: { unidades: data.unidades }
          });
          actualizados++;

          if (actualizados % 50 === 0) {
            console.log('Progreso:', actualizados, 'actualizados...');
          }
        }
      } catch (err) {
        errores++;
      }
    }

    console.log('\n=== RESULTADO ===');
    console.log('Registros actualizados:', actualizados);
    console.log('Errores:', errores);

    // Verificar el total de unidades ahora
    const totalUnidades = await prisma.sell_out_ventas.aggregate({
      where: { cliente_id: clienteFDA.id },
      _sum: { unidades: true }
    });

    console.log('\n=== VERIFICACIÓN ===');
    console.log('Total unidades FDA en BD:', totalUnidades._sum.unidades);

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

agregarDuplicados();
