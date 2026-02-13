# Guía para Replicar con Nuevo Cliente

Esta guía documenta cómo agregar un nuevo cliente al sistema de análisis SELL-IN/SELL-OUT de 4BUDDIES.

---

## Prerrequisitos

- Acceso a la base de datos PostgreSQL (Railway)
- Archivos de datos del nuevo cliente (CSV/XLSX)
- Mapeo de SKUs del cliente → SKUs de 4BUDDIES

---

## Paso 1: Registrar el Cliente en la Base de Datos

### 1.1 Verificar si el cliente ya existe

```javascript
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Buscar por código o nombre
const cliente = await prisma.clientes.findFirst({
  where: { codigo: 'CODIGO_CLIENTE' }
});
```

### 1.2 Crear nuevo cliente si no existe

```javascript
const nuevoCliente = await prisma.clientes.create({
  data: {
    codigo: 'CODIGO_UNICO',      // Código interno del cliente
    nombre: 'Nombre del Cliente',
    tipo: 'retail',              // retail, distribuidor, etc.
    tiene_sell_out: true,        // true si recibirás datos de sell-out
    activo: true
  }
});

console.log('Cliente creado con ID:', nuevoCliente.id);
```

---

## Paso 2: Preparar Mapeo de Productos

### 2.1 Obtener catálogo de productos 4BUDDIES

```javascript
const productos = await prisma.productos.findMany({
  select: { id: true, sku: true, nombre: true }
});
```

### 2.2 Crear mapeo SKU cliente → SKU 4BUDDIES

Crear archivo `data/[cliente]/mapeo_skus.csv`:

```csv
sku_cliente,sku_4buddies,nombre_cliente
SKU-CLI-001,6003,PALOMITAS CLASSIC
SKU-CLI-002,6004,PALOMITAS ELOTE
```

### 2.3 Insertar mapeos en BD

```javascript
// Para cada línea del mapeo
await prisma.producto_cliente_mapeo.create({
  data: {
    cliente_id: CLIENTE_ID,
    producto_id: PRODUCTO_ID,  // ID del producto en 4BUDDIES
    sku_cliente: 'SKU-CLI-001',
    nombre_cliente: 'PALOMITAS CLASSIC',
    activo: true
  }
});
```

---

## Paso 3: Cargar Sucursales/Tiendas

### 3.1 Preparar archivo de sucursales

Crear archivo `data/[cliente]/sucursales.csv`:

```csv
codigo,nombre,plaza,estado,ciudad
001,TIENDA CENTRO,MONTERREY,NL,Monterrey
002,TIENDA NORTE,MONTERREY,NL,San Nicolás
```

### 3.2 Script de carga de sucursales

```javascript
// scripts/cargar[Cliente]Sucursales.js
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

async function cargarSucursales() {
  const prisma = new PrismaClient();
  const CLIENTE_ID = XX; // ID del cliente

  // Leer CSV y parsear
  // Para cada sucursal:
  await prisma.tiendas.upsert({
    where: {
      cliente_id_codigo_tienda: {
        cliente_id: CLIENTE_ID,
        codigo_tienda: 'CODIGO'
      }
    },
    update: {
      nombre: 'NOMBRE',
      plaza: 'PLAZA',
      estado: 'ESTADO',
      ciudad: 'CIUDAD'
    },
    create: {
      cliente_id: CLIENTE_ID,
      codigo_tienda: 'CODIGO',
      nombre: 'NOMBRE',
      plaza: 'PLAZA',
      estado: 'ESTADO',
      ciudad: 'CIUDAD',
      activo: true
    }
  });
}
```

---

## Paso 4: Cargar Datos de Ventas (SELL-OUT)

### 4.1 Preparar archivo de ventas

Formato esperado `data/[cliente]/ventas.csv`:

```csv
fecha,sucursal,producto,unidades,importe
01/01/2024,001,SKU-CLI-001,10,150.00
01/01/2024,002,SKU-CLI-002,5,75.50
```

### 4.2 Script de carga de ventas

Usar como base `scripts/cargarHEB.js` o `scripts/cargarFDA.js`:

```javascript
// scripts/cargar[Cliente].js
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

function parseDate(dateStr) {
  // Adaptar según formato del cliente
  // DD/MM/YY o YYYY-MM-DD, etc.
}

async function cargarVentas() {
  const prisma = new PrismaClient();
  const CLIENTE_ID = XX;

  // Obtener mapas
  const tiendas = await prisma.tiendas.findMany({
    where: { cliente_id: CLIENTE_ID }
  });
  const productos = await prisma.productos.findMany();
  const tiendaMap = new Map(tiendas.map(t => [t.codigo_tienda, t.id]));
  const productoMap = new Map(productos.map(p => [p.sku, p.id]));

  // Para cada venta:
  await prisma.sell_out_ventas.create({
    data: {
      cliente_id: CLIENTE_ID,
      tienda_id: tiendaMap.get(codigo_tienda),
      producto_id: productoMap.get(sku),
      fecha: fecha,
      sku_cliente: sku_original,
      unidades: parseFloat(unidades),
      importe: parseFloat(importe),
      archivo_origen: 'ventas.csv'
    }
  });
}
```

### 4.3 Manejar duplicados

Si el cliente envía datos con duplicados (misma fecha+sucursal+producto):

```javascript
// Opción 1: Rechazar duplicados (constraint ya lo hace)
// Opción 2: Sumar unidades - ver scripts/agregarDuplicadosFDA.js
```

---

## Paso 5: Crear Agente KAM

### 5.1 Crear archivo de comando

Crear `.claude/commands/kam-[cliente].md`:

```markdown
# KAM Especialista en [CLIENTE] (SELL-OUT)

## Tu Identidad
Eres un KAM experto en la cuenta de [CLIENTE].

## Contexto específico
- Cliente ID: [XX]
- Código: "[YY]"
- Total registros: [N] ventas
- Total unidades: [M]
- Sucursales: [Z]

## Consultas automáticas
[Incluir consultas Prisma específicas]

## Enfoque de oportunidades
[Personalizar según tipo de cliente]
```

---

## Paso 6: Agregar al Dashboard

### 6.1 Crear archivo de queries

`web/src/lib/queries/sell-out-[cliente].ts`:

```typescript
import { prisma } from "@/lib/prisma";

const CLIENTE_ID = XX;

export async function get[Cliente]Summary() {
  // Copiar estructura de sell-out-heb.ts o sell-out-fda.ts
}

export async function get[Cliente]Trend() {
  // Adaptar queries
}
```

### 6.2 Crear página del dashboard

`web/src/app/(dashboard)/sell-out/[cliente]/page.tsx`:

```typescript
import { KPICard } from "@/components/cards/kpi-card";
import { TrendChart } from "@/components/charts/trend-chart";
// ... imports

export default async function [Cliente]Page() {
  const [summary, trend, ...] = await Promise.all([
    get[Cliente]Summary(),
    get[Cliente]Trend(),
    // ...
  ]);

  return (
    // ... estructura similar a HEB o FDA
  );
}
```

### 6.3 Actualizar navegación

`web/src/components/layout/sidebar.tsx`:

```typescript
const navigation = [
  // ...
  {
    name: "SELL-OUT",
    icon: Store,
    children: [
      { name: "HEB", href: "/sell-out/heb", ... },
      { name: "FDA", href: "/sell-out/fda", ... },
      { name: "[CLIENTE]", href: "/sell-out/[cliente]", icon: Building2, description: "[N] sucursales" },
    ],
  },
];
```

### 6.4 Actualizar header

`web/src/components/layout/header.tsx`:

```typescript
const pageTitles = {
  // ...
  "/sell-out/[cliente]": {
    title: "[CLIENTE]",
    description: "Ventas en [Descripción del cliente]",
  },
};
```

---

## Paso 7: Validación

### Checklist de validación

- [ ] Cliente registrado en tabla `clientes`
- [ ] Sucursales cargadas en tabla `tiendas`
- [ ] Mapeo de productos configurado
- [ ] Ventas cargadas en `sell_out_ventas`
- [ ] Verificar totales coincidan con archivo fuente
- [ ] Agente KAM creado y funcionando
- [ ] Página de dashboard creada
- [ ] Navegación actualizada
- [ ] Build del frontend sin errores

### Queries de verificación

```javascript
// Contar registros
const count = await prisma.sell_out_ventas.count({
  where: { cliente_id: CLIENTE_ID }
});

// Total unidades
const total = await prisma.sell_out_ventas.aggregate({
  where: { cliente_id: CLIENTE_ID },
  _sum: { unidades: true }
});

// Rango de fechas
const fechas = await prisma.sell_out_ventas.aggregate({
  where: { cliente_id: CLIENTE_ID },
  _min: { fecha: true },
  _max: { fecha: true }
});

console.log('Registros:', count);
console.log('Unidades:', total._sum.unidades);
console.log('Desde:', fechas._min.fecha, 'Hasta:', fechas._max.fecha);
```

---

## Estructura de Archivos por Cliente

```
Portal-4buddies/
├── data/
│   └── [cliente]/
│       ├── sucursales.csv
│       ├── ventas.csv
│       └── mapeo_skus.csv (opcional)
├── scripts/
│   └── cargar[Cliente].js
├── .claude/commands/
│   └── kam-[cliente].md
└── web/src/
    ├── lib/queries/
    │   └── sell-out-[cliente].ts
    └── app/(dashboard)/sell-out/
        └── [cliente]/
            └── page.tsx
```

---

## Clientes Existentes como Referencia

| Cliente | ID | Código | Script | Agente |
|---------|-----|--------|--------|--------|
| HEB | 1 | 23 | cargarHEB.js | kam-heb.md |
| FDA | 47 | 104 | cargarFDA.js | kam-fda.md |

---

## Soporte

Para dudas sobre implementación, consulta:
- `CLAUDE.md` - Memoria operativa del proyecto
- Scripts existentes en `/scripts/`
- Agentes KAM en `/.claude/commands/`
