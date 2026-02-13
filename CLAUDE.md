# Portal 4BUDDIES - Sistema de Análisis SELL-IN / SELL-OUT

## Propósito de este documento

Este archivo es la **memoria operativa** del proyecto. Al leerlo, debes entender:
1. Qué datos existen y cómo están organizados
2. Cómo ayudar al usuario según lo que necesite
3. Cómo cargar o actualizar datos cuando se requiera

---

## Contexto del Proyecto

**4BUDDIES** es una empresa mexicana de snacks (palomitas de maíz, chicharrón, rodajitas de papa). Este sistema ayuda a los **KAM (Key Account Managers)** a analizar:

- **SELL-IN**: Pedidos/órdenes de compra que los clientes hacen a 4BUDDIES (datos del ERP)
- **SELL-OUT**: Ventas reales en las tiendas de los clientes (datos que los retailers comparten)

### Objetivo Principal
Comparar lo que se vende a los clientes (SELL-IN) vs lo que realmente se vende al consumidor final (SELL-OUT) para:
- Identificar oportunidades de venta
- Detectar problemas de rotación
- Analizar tendencias por tienda, producto, región

---

## Datos Actuales

### Clientes con SELL-OUT

| Cliente | ID | Código | Registros | Unidades | Tiendas | Rango Fechas |
|---------|-----|--------|-----------|----------|---------|--------------|
| HEB (Supermercados Internacionales H E B) | 1 | 23 | 71,063 | 139,520 | 63 | 2024-01 a 2025-06 |
| FDA (Servicios en Puertos y Terminales) | 47 | 104 | 30,833 | 88,021 | 978 | 2024-01 a 2026-01 |

### Productos (13 SKUs)

| SKU | Nombre |
|-----|--------|
| 7500462417833 | Palomitas Classic White 25g |
| 7500462860004 | Palomitas Street Elote 125g |
| 7500462860042 | Rodajitas de Papa Spicy Limón 30g |
| 7500462417826 | Palomitas Street Elote 25g |
| 7500462860035 | Palomitas Spicy Nopal 25g |
| 7500462860066 | Palomitas Chile Piquín 25g |
| 7503028921317 | Chicharrón de Cerdo 75g |
| 7503028921133 | Palomitas Classic Sweet 25g |
| (y otros más en la tabla productos) |

---

## Estructura de Base de Datos

**PostgreSQL en Railway** - Conexión via Prisma ORM

### Tablas Principales

```
clientes          - Catálogo de clientes (retailers)
productos         - Catálogo de productos 4BUDDIES
tiendas           - Sucursales/tiendas de cada cliente
sell_in           - Pedidos del ERP (órdenes de compra)
sell_out_ventas   - Ventas en tiendas (SELL-OUT)
sell_out_inventario - Inventarios en tiendas (si aplica)
```

### Relaciones Clave

- `sell_out_ventas` tiene constraint único: `(cliente_id, tienda_id, producto_id, fecha)`
- `tiendas` tiene constraint único: `(cliente_id, codigo_tienda)`
- Los productos se relacionan por `sku` (código de barras)

---

## Guía de Asistencia

### Cuando el usuario pida ANÁLISIS de datos:

Puedes hacer consultas directas a la BD usando Prisma. Ejemplos:

```javascript
// Total de ventas por cliente
const ventasPorCliente = await prisma.sell_out_ventas.groupBy({
  by: ['cliente_id'],
  _sum: { unidades: true }
});

// Ventas por producto en un rango de fechas
const ventasProducto = await prisma.sell_out_ventas.groupBy({
  by: ['producto_id'],
  where: {
    cliente_id: 1, // HEB
    fecha: { gte: new Date('2025-01-01'), lte: new Date('2025-06-30') }
  },
  _sum: { unidades: true }
});

// Top 10 tiendas con más ventas
const topTiendas = await prisma.sell_out_ventas.groupBy({
  by: ['tienda_id'],
  where: { cliente_id: 47 }, // FDA
  _sum: { unidades: true },
  orderBy: { _sum: { unidades: 'desc' } },
  take: 10
});
```

### Cuando el usuario pida CARGAR nuevos datos:

Ver sección "Procesos de Carga" más abajo.

### Cuando el usuario tenga DUDAS sobre qué hacer:

Pregunta:
1. ¿Qué cliente/retailer le interesa?
2. ¿Qué período de tiempo?
3. ¿Qué tipo de análisis necesita? (ventas totales, por producto, por tienda, tendencias)

---

## Procesos de Carga de Datos

### SELL-OUT HEB

**Formato de entrada:** Excel (.xlsx) con columnas: fecha, id_tienda, sku, unidades, monto

**Script:** `scripts/cargarHEB.js`

**Proceso:**
1. Colocar archivo en `data/heb/sellout-heb.xlsx`
2. Ejecutar: `node scripts/cargarHEB.js`
3. Si hay registros faltantes (fechas nuevas): usar `scripts/cargarHEBFaltantes.js`

**Notas:**
- Las fechas en Excel son números seriales (convertir con `excelToDate`)
- HEB es cliente ID 1, código "23"

---

### SELL-OUT FDA

**Formato de entrada:** CSV con columnas: fecha, sucursal, producto, unidades, costo

**Archivos necesarios:**
- `data/fda/ventas_fda.csv` - Datos de ventas
- `data/fda/sucursales_fda.csv` - Catálogo de sucursales

**Script:** `scripts/cargarFDA.js`

**Proceso:**
1. Colocar archivos CSV en `data/fda/`
2. Ejecutar: `node scripts/cargarFDA.js`
3. Si hay duplicados (mismo día, tienda, producto): ejecutar `scripts/agregarDuplicadosFDA.js` para sumar las unidades

**Notas importantes:**
- FDA es cliente ID 47, código "104"
- Las fechas vienen en formato DD/MM/YY
- El CSV puede tener registros duplicados que son ventas de diferentes turnos/tickets - se deben SUMAR
- El nombre de sucursal incluye código al inicio (ej: "PEFE FERROCARRILES" → código "PEFE")

---

### SELL-OUT Nuevo Cliente

Para agregar un cliente nuevo con SELL-OUT:

1. **Verificar/crear el cliente** en tabla `clientes`:
   ```javascript
   const cliente = await prisma.clientes.upsert({
     where: { codigo: 'CODIGO_CLIENTE' },
     update: { tiene_sell_out: true },
     create: { codigo: 'CODIGO_CLIENTE', nombre: 'NOMBRE', tiene_sell_out: true }
   });
   ```

2. **Crear script de carga** basándose en `cargarFDA.js` o `cargarHEB.js`:
   - Adaptar el parseador según formato del archivo (CSV, Excel, etc.)
   - Mapear columnas a: fecha, tienda, producto (SKU), unidades, importe
   - Usar upsert o manejar duplicados según lógica del cliente

3. **Cargar tiendas** primero, luego ventas

4. **Verificar** con queries de conteo y rangos de fecha

---

### SELL-IN (Pedidos ERP)

**Script:** `scripts/cargarSellIn.js`

El SELL-IN viene del ERP de 4BUDDIES y contiene:
- Número de orden
- Cliente
- Producto
- Cantidad
- Fecha
- Importe

---

## Análisis Típicos que el Usuario Puede Pedir

1. **"¿Cuánto vendimos en HEB este mes?"**
   → Sumar unidades de sell_out_ventas donde cliente_id=1 y fecha en rango

2. **"¿Cuáles son los productos más vendidos en FDA?"**
   → Agrupar por producto_id, sumar unidades, ordenar descendente

3. **"¿Qué tiendas tienen mejor rotación?"**
   → Agrupar por tienda_id, calcular unidades/día o unidades totales

4. **"Comparar SELL-IN vs SELL-OUT"**
   → Cruzar datos de sell_in con sell_out_ventas por cliente y período

5. **"¿Cómo van las ventas de palomitas vs chicharrón?"**
   → Agrupar por categoría de producto (usar tabla productos)

---

## Conexión a Base de Datos

```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Siempre cerrar conexión al terminar
await prisma.$disconnect();
```

La URL de conexión está en `.env` como `DATABASE_URL` (PostgreSQL en Railway).

---

## Archivos y Estructura del Proyecto

```
Portal-4buddies/
├── prisma/
│   └── schema.prisma      # Esquema de base de datos
├── scripts/
│   ├── cargarSellIn.js    # Carga SELL-IN del ERP
│   ├── cargarHEB.js       # Carga SELL-OUT HEB
│   ├── cargarHEBFaltantes.js
│   ├── cargarFDA.js       # Carga SELL-OUT FDA
│   ├── agregarDuplicadosFDA.js
│   └── analizarDuplicadosFDA.js
├── data/
│   ├── heb/               # Archivos de datos HEB
│   └── fda/               # Archivos de datos FDA
└── CLAUDE.md              # Este archivo
```

---

## Recordatorios Importantes

1. **Antes de cargar datos**, siempre verificar que el cliente exista y esté marcado con `tiene_sell_out: true`

2. **Los SKUs deben existir** en la tabla `productos` antes de cargar ventas

3. **Manejar duplicados**: Cada cliente puede tener diferente lógica
   - HEB: Un registro por día/tienda/producto
   - FDA: Múltiples registros por día (turnos) → sumar unidades

4. **Railway puede ser lento**: Las cargas masivas pueden tardar, usar scripts con progreso visible

5. **Siempre verificar** después de cargar: contar registros, revisar rangos de fecha
