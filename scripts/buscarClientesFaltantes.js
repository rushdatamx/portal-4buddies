const XLSX = require('xlsx');
const workbook = XLSX.readFile('data/ventas.xls');
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);

const clientesFaltantes = ['281', '162', '285', '282'];
const encontrados = new Map();

data.forEach(row => {
  const cve = String(row.cve_cte);
  if (clientesFaltantes.includes(cve) && !encontrados.has(cve)) {
    encontrados.set(cve, row.nom_cte);
  }
});

console.log('=== CLIENTES FALTANTES ===');
clientesFaltantes.forEach(cve => {
  console.log('[' + cve + '] ' + (encontrados.get(cve) || 'NO ENCONTRADO'));
});
