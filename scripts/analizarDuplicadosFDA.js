const fs = require('fs');

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

const ventasCSV = fs.readFileSync('data/fda/ventas_fda.csv', 'utf-8');
const ventas = parseCSV(ventasCSV);

// Crear llaves únicas para detectar duplicados
const duplicados = new Map();

ventas.forEach(row => {
  // Llave: fecha + sucursal + producto
  const key = row.fecha + '|' + row.sucursal + '|' + row.producto;

  if (duplicados.has(key)) {
    duplicados.get(key).count++;
    duplicados.get(key).rows.push(row);
  } else {
    duplicados.set(key, { count: 1, rows: [row] });
  }
});

// Filtrar solo los que tienen más de 1 ocurrencia
const soloduplicados = [...duplicados.entries()].filter(([k, v]) => v.count > 1);

console.log('=== ANÁLISIS DE DUPLICADOS ===');
console.log('Total registros en CSV:', ventas.length);
console.log('Combinaciones únicas (fecha+sucursal+producto):', duplicados.size);
console.log('Combinaciones duplicadas:', soloduplicados.length);

let totalRegsDuplicados = 0;
soloduplicados.forEach(([k, v]) => {
  totalRegsDuplicados += v.count - 1; // Contar los extras
});

console.log('Registros extra (que serían rechazados):', totalRegsDuplicados);
console.log('\nPrimeros 15 ejemplos de duplicados:');
soloduplicados.slice(0, 15).forEach(([key, val]) => {
  const parts = key.split('|');
  const fecha = parts[0];
  const suc = parts[1].substring(0, 25);
  const prod = parts[2];
  console.log('  - ' + fecha + ' | ' + suc + ' | SKU:' + prod + ' => ' + val.count + ' veces');
});

// Analizar si los duplicados tienen las mismas unidades o diferentes
console.log('\n=== DETALLE DE ALGUNOS DUPLICADOS ===');
soloduplicados.slice(0, 5).forEach(([key, val]) => {
  console.log('\nDuplicado:', key.substring(0, 60) + '...');
  val.rows.forEach((r, i) => {
    console.log('  Ocurrencia ' + (i+1) + ': unidades=' + r.unidades + ', costo=' + r.costo);
  });
});
