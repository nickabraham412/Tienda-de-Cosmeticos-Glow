-- borro en orden inverso para no chocar con las claves foraneas
DROP TABLE IF EXISTS dbo.Pagos;
DROP TABLE IF EXISTS dbo.DetallePedido;
DROP TABLE IF EXISTS dbo.Pedidos;
DROP TABLE IF EXISTS dbo.Productos;
DROP TABLE IF EXISTS dbo.Categorias;
DROP TABLE IF EXISTS dbo.Usuarios;
GO

CREATE TABLE dbo.Usuarios (
    Id INT IDENTITY(1,1) CONSTRAINT PK_Usuarios PRIMARY KEY,
    Nombre NVARCHAR(60) NOT NULL,
    Apellido NVARCHAR(60) NOT NULL,
    Email NVARCHAR(120) NOT NULL CONSTRAINT UQ_Usuarios_Email UNIQUE,
    Telefono NVARCHAR(20) NULL,
    PasswordHash NVARCHAR(100) NOT NULL,
    Rol NVARCHAR(10) NOT NULL CONSTRAINT DF_Usuarios_Rol DEFAULT 'cliente',
    Activo BIT NOT NULL CONSTRAINT DF_Usuarios_Activo DEFAULT 1,
    FechaRegistro DATETIME2(0) NOT NULL CONSTRAINT DF_Usuarios_Fecha DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_Usuarios_Rol CHECK (Rol IN ('cliente', 'admin'))
);

CREATE TABLE dbo.Categorias (
    Id INT IDENTITY(1,1) CONSTRAINT PK_Categorias PRIMARY KEY,
    Nombre NVARCHAR(80) NOT NULL CONSTRAINT UQ_Categorias_Nombre UNIQUE,
    Descripcion NVARCHAR(300) NULL
);

-- limite los tipos de piel para que coincidan con los filtros de la tienda
CREATE TABLE dbo.Productos (
    Id INT IDENTITY(1,1) CONSTRAINT PK_Productos PRIMARY KEY,
    CategoriaId INT NOT NULL CONSTRAINT FK_Productos_Categoria REFERENCES dbo.Categorias(Id),
    Nombre NVARCHAR(120) NOT NULL,
    Marca NVARCHAR(60) NOT NULL,
    Descripcion NVARCHAR(2000) NOT NULL CONSTRAINT DF_Productos_Desc DEFAULT N'',
    Precio DECIMAL(10,2) NOT NULL,
    Stock INT NOT NULL CONSTRAINT DF_Productos_Stock DEFAULT 0,
    TipoPiel NVARCHAR(20) NOT NULL CONSTRAINT DF_Productos_Piel DEFAULT 'todo tipo',
    ImagenUrl NVARCHAR(500) NULL,
    Activo BIT NOT NULL CONSTRAINT DF_Productos_Activo DEFAULT 1,
    FechaCreacion DATETIME2(0) NOT NULL CONSTRAINT DF_Productos_Fecha DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_Productos_Precio CHECK (Precio > 0),
    CONSTRAINT CK_Productos_Stock CHECK (Stock >= 0),
    CONSTRAINT CK_Productos_Piel CHECK (TipoPiel IN ('todo tipo', 'seca', 'grasa', 'mixta', 'sensible'))
);

CREATE TABLE dbo.Pedidos (
    Id INT IDENTITY(1,1) CONSTRAINT PK_Pedidos PRIMARY KEY,
    UsuarioId INT NOT NULL CONSTRAINT FK_Pedidos_Usuario REFERENCES dbo.Usuarios(Id),
    Fecha DATETIME2(0) NOT NULL CONSTRAINT DF_Pedidos_Fecha DEFAULT SYSUTCDATETIME(),
    Subtotal DECIMAL(10,2) NOT NULL,
    Envio DECIMAL(10,2) NOT NULL CONSTRAINT DF_Pedidos_Envio DEFAULT 0,
    Total DECIMAL(10,2) NOT NULL,
    Estado NVARCHAR(12) NOT NULL CONSTRAINT DF_Pedidos_Estado DEFAULT 'pendiente',
    DireccionEnvio NVARCHAR(200) NOT NULL,
    Ciudad NVARCHAR(80) NOT NULL,
    Telefono NVARCHAR(20) NOT NULL,
    CONSTRAINT CK_Pedidos_Estado CHECK (Estado IN ('pendiente', 'pagado', 'enviado', 'entregado', 'cancelado')),
    CONSTRAINT CK_Pedidos_Montos CHECK (Subtotal >= 0 AND Envio >= 0 AND Total >= 0)
);

CREATE TABLE dbo.DetallePedido (
    Id INT IDENTITY(1,1) CONSTRAINT PK_DetallePedido PRIMARY KEY,
    PedidoId INT NOT NULL CONSTRAINT FK_Detalle_Pedido REFERENCES dbo.Pedidos(Id) ON DELETE CASCADE,
    ProductoId INT NOT NULL CONSTRAINT FK_Detalle_Producto REFERENCES dbo.Productos(Id),
    Cantidad INT NOT NULL,
    PrecioUnitario DECIMAL(10,2) NOT NULL,
    CONSTRAINT CK_Detalle_Cantidad CHECK (Cantidad > 0),
    CONSTRAINT CK_Detalle_Precio CHECK (PrecioUnitario > 0),
    CONSTRAINT UQ_Detalle_Pedido_Producto UNIQUE (PedidoId, ProductoId)
);

-- solo guardo los ultimos 4 digitos de la tarjeta
CREATE TABLE dbo.Pagos (
    Id INT IDENTITY(1,1) CONSTRAINT PK_Pagos PRIMARY KEY,
    PedidoId INT NOT NULL CONSTRAINT UQ_Pagos_Pedido UNIQUE
                                 CONSTRAINT FK_Pagos_Pedido REFERENCES dbo.Pedidos(Id) ON DELETE CASCADE,
    Metodo NVARCHAR(30) NOT NULL,
    Ultimos4 CHAR(4) NOT NULL,
    Estado NVARCHAR(10) NOT NULL,
    TransaccionRef NVARCHAR(30) NOT NULL,
    Monto DECIMAL(10,2) NOT NULL,
    Fecha DATETIME2(0) NOT NULL CONSTRAINT DF_Pagos_Fecha DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_Pagos_Estado CHECK (Estado IN ('aprobado', 'rechazado')),
    CONSTRAINT CK_Pagos_Monto CHECK (Monto >= 0)
);
GO

CREATE INDEX IX_Productos_Categoria ON dbo.Productos (CategoriaId) INCLUDE (Activo, Precio, Stock);
CREATE INDEX IX_Productos_Activo ON dbo.Productos (Activo, FechaCreacion DESC);
CREATE INDEX IX_Pedidos_Usuario ON dbo.Pedidos (UsuarioId, Fecha DESC);
CREATE INDEX IX_Pedidos_Estado ON dbo.Pedidos (Estado);
CREATE INDEX IX_Detalle_Producto ON dbo.DetallePedido (ProductoId);
GO

INSERT INTO dbo.Categorias (Nombre, Descripcion) VALUES
 (N'Bases y correctores', N'Cobertura y unificación del tono'),
 (N'Polvos y rubores', N'Acabado mate o luminoso para las mejillas'),
 (N'Iluminadores y contornos', N'Luz y definición del rostro'),
 (N'Cuidado facial', N'Limpieza, tratamiento e hidratación'),
 (N'Primers y fijadores', N'Preparación y duración del maquillaje');
GO

-- datos de prueba de productos
INSERT INTO dbo.Productos (CategoriaId, Nombre, Marca, Descripcion, Precio, Stock, TipoPiel) VALUES
 (1, N'Base líquida satinada', N'Aurora', N'Cobertura media modulable con acabado satinado y 16 horas de duración. Fórmula ligera, no transfiere.', 18.90, 40, 'mixta'),
 (1, N'Corrector de cobertura total', N'Aurora', N'Corrector cremoso que disimula ojeras e imperfecciones sin marcar las líneas de expresión.', 12.50, 55, 'todo tipo'),
 (1, N'Base en barra cremosa', N'Lumière', N'Base compacta en barra para retoques rápidos. Textura confortable para pieles secas.', 17.00, 22, 'seca'),
 (2, N'Polvo compacto mate', N'Lumière', N'Control de brillo durante todo el día con un acabado aterciopelado y natural.', 14.00, 60, 'grasa'),
 (2, N'Rubor en crema peonía', N'Rosé Lab', N'Rubor cremoso de color construible que se funde con la piel como un tinte natural.', 11.50, 35, 'todo tipo'),
 (2, N'Rubor en polvo melocotón', N'Rosé Lab', N'Pigmento sedoso en tono melocotón. Fácil de difuminar y de larga duración.', 10.90, 45, 'todo tipo'),
 (3, N'Iluminador líquido perla', N'Lumière', N'Brillo fino y luminoso para pómulos, arco de cupido y lagrimal.', 13.90, 30, 'todo tipo'),
 (3, N'Dúo de contorno', N'Aurora', N'Polvo de contorno y tono de luz en un solo estuche con espejo.', 15.50, 25, 'mixta'),
 (4, N'Gel limpiador suave', N'Rosé Lab', N'Limpia sin resecar. Sin perfume, apto para pieles reactivas.', 9.90, 70, 'sensible'),
 (4, N'Sérum de vitamina C 10%', N'Rosé Lab', N'Antioxidante que unifica el tono y aporta luminosidad. Usar por la mañana bajo el protector solar.', 24.90, 28, 'todo tipo'),
 (4, N'Crema hidratante con ácido hialurónico', N'Aurora', N'Hidratación de 48 horas con textura gel-crema de rápida absorción.', 19.90, 42, 'mixta'),
 (4, N'Protector solar facial SPF 50', N'Aurora', N'Protección alta UVA/UVB con acabado seco y sin residuo blanco. Base ideal para maquillaje.', 17.50, 4, 'todo tipo'),
 (4, N'Mascarilla de arcilla purificante', N'Rosé Lab', N'Limpia poros y regula el exceso de sebo. Usar una vez por semana.', 8.90, 33, 'grasa'),
 (5, N'Primer hidratante piel radiante', N'Lumière', N'Prepara la piel, alisa la textura y mejora la fijación del maquillaje.', 16.00, 38, 'seca'),
 (5, N'Spray fijador larga duración', N'Lumière', N'Sella el maquillaje hasta 24 horas con una bruma ligera y sin pegajosidad.', 14.50, 50, 'todo tipo');
GO