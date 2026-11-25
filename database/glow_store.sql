create database glow_store;
use glow_store;

create table dbo.Usuarios (
    Id int identity(1,1) constraint PK_Usuarios primary key,
    Nombre nvarchar(60) not null,
    Apellido nvarchar(60) not null,
    Email nvarchar(120) not null constraint UQ_Usuarios_Email unique,
    Telefono nvarchar(20) null,
    PasswordHash nvarchar(100) not null,
    Rol nvarchar(10) not null constraint DF_Usuarios_Rol default 'cliente',
    Activo bit not null constraint DF_Usuarios_Activo default 1,
    FechaRegistro datetime2(0) not null constraint DF_Usuarios_Fecha default sysutcdatetime(),
    constraint CK_Usuarios_Rol check (Rol in ('cliente', 'admin'))
);

create table dbo.Categorias (
    Id int identity(1,1) constraint PK_Categorias primary key,
    Nombre nvarchar(80) not null constraint UQ_Categorias_Nombre unique,
    Descripcion nvarchar(300) null
);

create table dbo.Productos (
    Id int identity(1,1) constraint PK_Productos primary key,
    CategoriaId int not null constraint FK_Productos_Categoria references dbo.Categorias(Id),
    Nombre nvarchar(120) not null,
    Marca nvarchar(60) not null,
    Descripcion nvarchar(2000) not null constraint DF_Productos_Desc default N'',
    Precio decimal(10,2) not null,
    Stock int not null constraint DF_Productos_Stock default 0,
    TipoPiel nvarchar(20) not null constraint DF_Productos_Piel default 'todo tipo',
    ImagenUrl nvarchar(500) null,
    Activo bit not null constraint DF_Productos_Activo default 1,
    FechaCreacion datetime2(0) not null constraint DF_Productos_Fecha default sysutcdatetime(),
    constraint CK_Productos_Precio check (Precio > 0),
    constraint CK_Productos_Stock check (Stock >= 0),
    constraint CK_Productos_Piel check (TipoPiel in ('todo tipo', 'seca', 'grasa', 'mixta', 'sensible'))
);

create table dbo.Pedidos (
    Id int identity(1,1) constraint PK_Pedidos primary key,
    UsuarioId int not null constraint FK_Pedidos_Usuario references dbo.Usuarios(Id),
    Fecha datetime2(0) not null constraint DF_Pedidos_Fecha default sysutcdatetime(),
    Subtotal decimal(10,2) not null,
    Envio decimal(10,2) not null constraint DF_Pedidos_Envio default 0,
    Total decimal(10,2) not null,
    Estado nvarchar(12) not null constraint DF_Pedidos_Estado default 'pendiente',
    DireccionEnvio nvarchar(200) not null,
    Ciudad nvarchar(80) not null,
    Telefono nvarchar(20) not null,
    constraint CK_Pedidos_Estado check (Estado in ('pendiente', 'pagado', 'enviado', 'entregado', 'cancelado')),
    constraint CK_Pedidos_Montos check (Subtotal >= 0 and Envio >= 0 and Total >= 0)
);

create table dbo.DetallePedido (
    Id int identity(1,1) constraint PK_DetallePedido primary key,
    PedidoId int not null constraint FK_Detalle_Pedido references dbo.Pedidos(Id) on delete cascade,
    ProductoId int not null constraint FK_Detalle_Producto references dbo.Productos(Id),
    Cantidad int not null,
    PrecioUnitario decimal(10,2) not null,
    constraint CK_Detalle_Cantidad check (Cantidad > 0),
    constraint CK_Detalle_Precio check (PrecioUnitario > 0),
    constraint UQ_Detalle_Pedido_Producto unique (PedidoId, ProductoId)
);

create table dbo.Pagos (
    Id int identity(1,1) constraint PK_Pagos primary key,
    PedidoId int not null constraint UQ_Pagos_Pedido unique
                                 constraint FK_Pagos_Pedido references dbo.Pedidos(Id) on delete cascade,
    Metodo nvarchar(30) not null,
    Ultimos4 char(4) not null,
    Estado nvarchar(10) not null,
    TransaccionRef nvarchar(30) not null,
    Monto decimal(10,2) not null,
    Fecha datetime2(0) not null constraint DF_Pagos_Fecha default sysutcdatetime(),
    constraint CK_Pagos_Estado check (Estado in ('aprobado', 'rechazado')),
    constraint CK_Pagos_Monto check (Monto >= 0)
);
go

create index IX_Productos_Categoria on dbo.Productos (CategoriaId) include (Activo, Precio, Stock);
create index IX_Productos_Activo on dbo.Productos (Activo, FechaCreacion desc);
create index IX_Pedidos_Usuario on dbo.Pedidos (UsuarioId, Fecha desc);
create index IX_Pedidos_Estado on dbo.Pedidos (Estado);
create index IX_Detalle_Producto on dbo.DetallePedido (ProductoId);
go

insert into dbo.Categorias (Nombre, Descripcion) values
 (N'Bases y correctores', N'Cobertura y unificación del tono'),
 (N'Cuidado facial', N'Limpieza, tratamiento e hidratación');
go

insert into dbo.Productos (CategoriaId, Nombre, Marca, Descripcion, Precio, Stock, TipoPiel) values
 (1, N'Base líquida satinada', N'Aurora', N'Cobertura media modulable con acabado satinado y 16 horas de duración.', 18.90, 40, 'mixta'),
 (2, N'Gel limpiador suave', N'Rosé Lab', N'Limpia sin resecar. Sin perfume, apto para pieles reactivas.', 9.90, 70, 'sensible');
go