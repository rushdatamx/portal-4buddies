-- CreateTable
CREATE TABLE "productos" (
    "id" SERIAL NOT NULL,
    "sku" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "categoria" VARCHAR(100),
    "subcategoria" VARCHAR(100),
    "unidad_medida" VARCHAR(20),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "productos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clientes" (
    "id" SERIAL NOT NULL,
    "codigo" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(255) NOT NULL,
    "tipo" VARCHAR(50),
    "tiene_sell_out" BOOLEAN NOT NULL DEFAULT false,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "producto_cliente_mapeo" (
    "id" SERIAL NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "sku_cliente" VARCHAR(100) NOT NULL,
    "nombre_cliente" VARCHAR(255),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "producto_cliente_mapeo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tiendas" (
    "id" SERIAL NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "codigo_tienda" VARCHAR(100) NOT NULL,
    "nombre" VARCHAR(255),
    "plaza" VARCHAR(100),
    "estado" VARCHAR(100),
    "ciudad" VARCHAR(100),
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tiendas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sell_in" (
    "id" SERIAL NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "producto_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "numero_orden" VARCHAR(100),
    "sku_cliente" VARCHAR(100),
    "cantidad" DECIMAL(12,2) NOT NULL,
    "precio_unitario" DECIMAL(12,2),
    "importe_total" DECIMAL(12,2),
    "moneda" VARCHAR(10) NOT NULL DEFAULT 'MXN',
    "estatus" VARCHAR(50),
    "archivo_origen" VARCHAR(255),
    "fila_origen" INTEGER,
    "carga_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sell_in_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sell_out_ventas" (
    "id" SERIAL NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "tienda_id" INTEGER,
    "producto_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "sku_cliente" VARCHAR(100),
    "unidades" DECIMAL(12,2) NOT NULL,
    "importe" DECIMAL(12,2),
    "precio_costo" DECIMAL(12,2),
    "es_dato_mensual" BOOLEAN NOT NULL DEFAULT false,
    "archivo_origen" VARCHAR(255),
    "fila_origen" INTEGER,
    "carga_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sell_out_ventas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sell_out_inventario" (
    "id" SERIAL NOT NULL,
    "cliente_id" INTEGER NOT NULL,
    "tienda_id" INTEGER,
    "producto_id" INTEGER NOT NULL,
    "fecha" DATE NOT NULL,
    "sku_cliente" VARCHAR(100),
    "unidades_inventario" DECIMAL(12,2) NOT NULL,
    "archivo_origen" VARCHAR(255),
    "fila_origen" INTEGER,
    "carga_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sell_out_inventario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cargas" (
    "id" SERIAL NOT NULL,
    "tipo" VARCHAR(50) NOT NULL,
    "cliente_id" INTEGER,
    "nombre_archivo" VARCHAR(255) NOT NULL,
    "fecha_archivo" DATE,
    "registros_totales" INTEGER,
    "registros_nuevos" INTEGER,
    "registros_duplicados" INTEGER,
    "registros_error" INTEGER,
    "estatus" VARCHAR(50) NOT NULL DEFAULT 'pendiente',
    "errores" JSONB,
    "duplicados" JSONB,
    "usuario" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cargas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staging_registros" (
    "id" SERIAL NOT NULL,
    "carga_id" INTEGER NOT NULL,
    "tipo_tabla" VARCHAR(50),
    "datos" JSONB NOT NULL,
    "es_duplicado" BOOLEAN NOT NULL DEFAULT false,
    "duplicado_de" INTEGER,
    "tiene_error" BOOLEAN NOT NULL DEFAULT false,
    "mensaje_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "staging_registros_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "productos_sku_key" ON "productos"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_codigo_key" ON "clientes"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "producto_cliente_mapeo_cliente_id_sku_cliente_key" ON "producto_cliente_mapeo"("cliente_id", "sku_cliente");

-- CreateIndex
CREATE UNIQUE INDEX "tiendas_cliente_id_codigo_tienda_key" ON "tiendas"("cliente_id", "codigo_tienda");

-- CreateIndex
CREATE UNIQUE INDEX "sell_in_cliente_id_numero_orden_producto_id_fecha_key" ON "sell_in"("cliente_id", "numero_orden", "producto_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "sell_out_ventas_cliente_id_tienda_id_producto_id_fecha_key" ON "sell_out_ventas"("cliente_id", "tienda_id", "producto_id", "fecha");

-- CreateIndex
CREATE UNIQUE INDEX "sell_out_inventario_cliente_id_tienda_id_producto_id_fecha_key" ON "sell_out_inventario"("cliente_id", "tienda_id", "producto_id", "fecha");

-- AddForeignKey
ALTER TABLE "producto_cliente_mapeo" ADD CONSTRAINT "producto_cliente_mapeo_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "producto_cliente_mapeo" ADD CONSTRAINT "producto_cliente_mapeo_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tiendas" ADD CONSTRAINT "tiendas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sell_in" ADD CONSTRAINT "sell_in_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sell_in" ADD CONSTRAINT "sell_in_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sell_in" ADD CONSTRAINT "sell_in_carga_id_fkey" FOREIGN KEY ("carga_id") REFERENCES "cargas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sell_out_ventas" ADD CONSTRAINT "sell_out_ventas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sell_out_ventas" ADD CONSTRAINT "sell_out_ventas_tienda_id_fkey" FOREIGN KEY ("tienda_id") REFERENCES "tiendas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sell_out_ventas" ADD CONSTRAINT "sell_out_ventas_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sell_out_ventas" ADD CONSTRAINT "sell_out_ventas_carga_id_fkey" FOREIGN KEY ("carga_id") REFERENCES "cargas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sell_out_inventario" ADD CONSTRAINT "sell_out_inventario_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sell_out_inventario" ADD CONSTRAINT "sell_out_inventario_tienda_id_fkey" FOREIGN KEY ("tienda_id") REFERENCES "tiendas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sell_out_inventario" ADD CONSTRAINT "sell_out_inventario_producto_id_fkey" FOREIGN KEY ("producto_id") REFERENCES "productos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sell_out_inventario" ADD CONSTRAINT "sell_out_inventario_carga_id_fkey" FOREIGN KEY ("carga_id") REFERENCES "cargas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cargas" ADD CONSTRAINT "cargas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staging_registros" ADD CONSTRAINT "staging_registros_carga_id_fkey" FOREIGN KEY ("carga_id") REFERENCES "cargas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
