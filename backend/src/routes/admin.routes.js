const router = require('express').Router();
const { sql, getPool, query } = require('../config/db');
const { authenticate, requireAdmin } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { idParam, productSchema, stockSchema, estadoSchema } = require('../validators/schemas');
const { STOCK_BAJO } = require('../config/constants');
const wrap = require('../utils/asyncHandler');
const { HttpError } = require('../utils/httpError');

router.use(authenticate, requireAdmin); // TODAS las rutas /api/admin exigen sesión + rol admin

const productParams = (b) => ({
  cat: [sql.Int, b.categoriaId],
  nombre: [sql.NVarChar(120), b.nombre],
  descripcion: [sql.NVarChar(2000), b.descripcion],
  marca: [sql.NVarChar(60), b.marca],
  precio: [sql.Decimal(10, 2), Math.round(b.precio * 100) / 100],
  stock: [sql.Int, b.stock],
  piel: [sql.NVarChar(20), b.tipoPiel],
  img: [sql.NVarChar(500), b.imagenUrl || null],
  activo: [sql.Bit, b.activo]
});

/* ----------------------------- Resumen ----------------------------- */
router.get('/stats', wrap(async (req, res) => {
  const r = await query(
    `SELECT
       (SELECT COUNT(*) FROM dbo.Productos WHERE Activo = 1) AS productos,
       (SELECT COUNT(*) FROM dbo.Productos WHERE Activo = 1 AND Stock <= @bajo) AS stockBajo,
       (SELECT COUNT(*) FROM dbo.Pedidos) AS pedidos,
       (SELECT ISNULL(SUM(Total), 0) FROM dbo.Pedidos WHERE Estado <> 'cancelado') AS ventas,
       (SELECT COUNT(*) FROM dbo.Usuarios WHERE Rol = 'cliente') AS clientes`,
    { bajo: [sql.Int, STOCK_BAJO] }
  );
  res.json(r.recordset[0]);
}));

/* ----------------------------- Productos (CRUD) ----------------------------- */
router.get('/products', wrap(async (req, res) => {
  const r = await query(
    `SELECT p.Id AS id, p.Nombre AS nombre, p.Marca AS marca, p.Descripcion AS descripcion, p.Precio AS precio,
            p.Stock AS stock, p.TipoPiel AS tipoPiel, p.ImagenUrl AS imagenUrl, p.Activo AS activo,
            p.CategoriaId AS categoriaId, c.Nombre AS categoria
       FROM dbo.Productos p JOIN dbo.Categorias c ON c.Id = p.CategoriaId
      ORDER BY p.Id DESC`
  );
  res.json(r.recordset);
}));

router.post('/products', validate(productSchema), wrap(async (req, res) => {
  const r = await query(
    `INSERT INTO dbo.Productos (CategoriaId, Nombre, Descripcion, Marca, Precio, Stock, TipoPiel, ImagenUrl, Activo)
     OUTPUT inserted.Id AS id
     VALUES (@cat, @nombre, @descripcion, @marca, @precio, @stock, @piel, @img, @activo)`,
    productParams(req.body)
  );
  res.status(201).json({ id: r.recordset[0].id });
}));

router.put('/products/:id', validate(idParam, 'params'), validate(productSchema), wrap(async (req, res) => {
  const r = await query(
    `UPDATE dbo.Productos
        SET CategoriaId = @cat, Nombre = @nombre, Descripcion = @descripcion, Marca = @marca, Precio = @precio,
            Stock = @stock, TipoPiel = @piel, ImagenUrl = @img, Activo = @activo
      WHERE Id = @id`,
    { id: [sql.Int, req.params.id], ...productParams(req.body) }
  );
  if (!r.rowsAffected[0]) throw new HttpError(404, 'Producto no encontrado');
  res.json({ id: req.params.id });
}));

router.patch('/products/:id/stock', validate(idParam, 'params'), validate(stockSchema), wrap(async (req, res) => {
  const r = await query('UPDATE dbo.Productos SET Stock = @stock WHERE Id = @id', {
    id: [sql.Int, req.params.id],
    stock: [sql.Int, req.body.stock]
  });
  if (!r.rowsAffected[0]) throw new HttpError(404, 'Producto no encontrado');
  res.json({ id: req.params.id, stock: req.body.stock });
}));

// "Eliminar" = baja lógica: los pedidos históricos conservan su referencia al producto.
router.delete('/products/:id', validate(idParam, 'params'), wrap(async (req, res) => {
  const r = await query('UPDATE dbo.Productos SET Activo = 0 WHERE Id = @id', { id: [sql.Int, req.params.id] });
  if (!r.rowsAffected[0]) throw new HttpError(404, 'Producto no encontrado');
  res.status(204).end();
}));

/* ----------------------------- Pedidos ----------------------------- */
router.get('/orders', wrap(async (req, res) => {
  const r = await query(
    `SELECT p.Id AS id, p.Fecha AS fecha, p.Estado AS estado, p.Total AS total,
            u.Nombre + N' ' + u.Apellido AS cliente, u.Email AS email,
            (SELECT SUM(Cantidad) FROM dbo.DetallePedido WHERE PedidoId = p.Id) AS articulos
       FROM dbo.Pedidos p JOIN dbo.Usuarios u ON u.Id = p.UsuarioId
      ORDER BY p.Fecha DESC, p.Id DESC`
  );
  res.json(r.recordset);
}));

router.get('/orders/:id', validate(idParam, 'params'), wrap(async (req, res) => {
  const id = [sql.Int, req.params.id];
  const head = await query(
    `SELECT p.Id AS id, p.Fecha AS fecha, p.Estado AS estado, p.Subtotal AS subtotal, p.Envio AS envio, p.Total AS total,
            p.DireccionEnvio AS direccion, p.Ciudad AS ciudad, p.Telefono AS telefono,
            u.Nombre + N' ' + u.Apellido AS cliente, u.Email AS email,
            pg.Ultimos4 AS ultimos4, pg.TransaccionRef AS referencia
       FROM dbo.Pedidos p
       JOIN dbo.Usuarios u ON u.Id = p.UsuarioId
       LEFT JOIN dbo.Pagos pg ON pg.PedidoId = p.Id
      WHERE p.Id = @id`,
    { id }
  );
  if (!head.recordset[0]) throw new HttpError(404, 'Pedido no encontrado');
  const items = await query(
    `SELECT pr.Nombre AS producto, d.Cantidad AS cantidad, d.PrecioUnitario AS precio
       FROM dbo.DetallePedido d JOIN dbo.Productos pr ON pr.Id = d.ProductoId
      WHERE d.PedidoId = @id`,
    { id }
  );
  res.json({ ...head.recordset[0], items: items.recordset });
}));

// Cambiar estado. Cancelar un pedido devuelve el stock; un pedido cancelado ya no puede cambiar.
router.patch('/orders/:id/status', validate(idParam, 'params'), validate(estadoSchema), wrap(async (req, res) => {
  const tx = new sql.Transaction(await getPool());
  await tx.begin();
  try {
    const cur = await new sql.Request(tx)
      .input('id', sql.Int, req.params.id)
      .query('SELECT Estado FROM dbo.Pedidos WITH (UPDLOCK, ROWLOCK) WHERE Id = @id');
    if (!cur.recordset[0]) throw new HttpError(404, 'Pedido no encontrado');
    if (cur.recordset[0].Estado === 'cancelado') throw new HttpError(409, 'Un pedido cancelado no puede modificarse');

    if (req.body.estado === 'cancelado') {
      await new sql.Request(tx).input('id', sql.Int, req.params.id).query(
        `UPDATE p SET p.Stock = p.Stock + d.Cantidad
           FROM dbo.Productos p JOIN dbo.DetallePedido d ON d.ProductoId = p.Id
          WHERE d.PedidoId = @id`
      );
    }
    await new sql.Request(tx)
      .input('id', sql.Int, req.params.id)
      .input('estado', sql.NVarChar(12), req.body.estado)
      .query('UPDATE dbo.Pedidos SET Estado = @estado WHERE Id = @id');

    await tx.commit();
    res.json({ id: req.params.id, estado: req.body.estado });
  } catch (e) {
    await tx.rollback().catch(() => {});
    throw e;
  }
}));

/* ----------------------------- Clientes ----------------------------- */
router.get('/customers', wrap(async (req, res) => {
  const r = await query(
    `SELECT u.Id AS id, u.Nombre + N' ' + u.Apellido AS nombre, u.Email AS email, ISNULL(u.Telefono, N'') AS telefono,
            u.FechaRegistro AS fechaRegistro, u.Activo AS activo,
            (SELECT COUNT(*) FROM dbo.Pedidos WHERE UsuarioId = u.Id) AS pedidos,
            (SELECT ISNULL(SUM(Total), 0) FROM dbo.Pedidos WHERE UsuarioId = u.Id AND Estado <> 'cancelado') AS gastado
       FROM dbo.Usuarios u
      WHERE u.Rol = 'cliente'
      ORDER BY u.FechaRegistro DESC`
  );
  res.json(r.recordset);
}));

module.exports = router;
