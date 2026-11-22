const router = require('express').Router();
const { sql, getPool, query } = require('../config/db');
const { authenticate } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { orderSchema } = require('../validators/schemas');
const { simulatePayment } = require('../utils/payment');
const { ENVIO_COSTO, ENVIO_GRATIS_DESDE } = require('../config/constants');
const wrap = require('../utils/asyncHandler');
const { HttpError } = require('../utils/httpError');

const r2 = (n) => Math.round(n * 100) / 100;

/**
 * CHECKOUT. Todo ocurre en UNA transacción:
 *   1) descuenta stock con UPDATE condicional (si dos clientes compran la última unidad, solo uno gana)
 *   2) calcula precios y total con los datos de la BD (jamás con precios enviados por el navegador)
 *   3) simula el pago; si es rechazado → ROLLBACK y el stock vuelve solo
 *   4) guarda pedido, detalle y pago → COMMIT
 */
router.post('/', authenticate, validate(orderSchema), wrap(async (req, res) => {
  const { items, envio, pago } = req.body;

  const merged = new Map(); // une líneas repetidas del mismo producto
  for (const it of items) merged.set(it.productoId, Math.min(20, (merged.get(it.productoId) || 0) + it.cantidad));
  const lines = [...merged.entries()].sort((a, b) => a[0] - b[0]); // orden fijo → evita interbloqueos

  const tx = new sql.Transaction(await getPool());
  await tx.begin();
  try {
    let subtotal = 0;
    const detalle = [];
    for (const [productoId, cantidad] of lines) {
      const r = await new sql.Request(tx)
        .input('id', sql.Int, productoId)
        .input('qty', sql.Int, cantidad)
        .query(`UPDATE dbo.Productos SET Stock = Stock - @qty
                OUTPUT inserted.Precio AS precio
                WHERE Id = @id AND Activo = 1 AND Stock >= @qty`);
      const p = r.recordset[0];
      if (!p) throw new HttpError(409, `Un producto de tu carrito ya no tiene stock suficiente (ID ${productoId}). Actualiza el carrito.`);
      subtotal = r2(subtotal + p.precio * cantidad);
      detalle.push({ productoId, cantidad, precio: p.precio });
    }

    const costoEnvio = subtotal >= ENVIO_GRATIS_DESDE ? 0 : ENVIO_COSTO;
    const total = r2(subtotal + costoEnvio);

    const pay = simulatePayment(pago);
    if (!pay.aprobado) throw new HttpError(402, pay.motivo);

    const ped = await new sql.Request(tx)
      .input('uid', sql.Int, req.user.sub)
      .input('sub', sql.Decimal(10, 2), subtotal)
      .input('env', sql.Decimal(10, 2), costoEnvio)
      .input('tot', sql.Decimal(10, 2), total)
      .input('dir', sql.NVarChar(200), envio.direccion)
      .input('ciu', sql.NVarChar(80), envio.ciudad)
      .input('tel', sql.NVarChar(20), envio.telefono)
      .query(`INSERT INTO dbo.Pedidos (UsuarioId, Subtotal, Envio, Total, Estado, DireccionEnvio, Ciudad, Telefono)
              OUTPUT inserted.Id AS id
              VALUES (@uid, @sub, @env, @tot, 'pagado', @dir, @ciu, @tel)`);
    const pedidoId = ped.recordset[0].id;

    for (const d of detalle) {
      await new sql.Request(tx)
        .input('ped', sql.Int, pedidoId)
        .input('prod', sql.Int, d.productoId)
        .input('qty', sql.Int, d.cantidad)
        .input('precio', sql.Decimal(10, 2), d.precio)
        .query('INSERT INTO dbo.DetallePedido (PedidoId, ProductoId, Cantidad, PrecioUnitario) VALUES (@ped, @prod, @qty, @precio)');
    }

    await new sql.Request(tx)
      .input('ped', sql.Int, pedidoId)
      .input('u4', sql.Char(4), pay.ultimos4)
      .input('ref', sql.NVarChar(30), pay.referencia)
      .input('monto', sql.Decimal(10, 2), total)
      .query(`INSERT INTO dbo.Pagos (PedidoId, Metodo, Ultimos4, Estado, TransaccionRef, Monto)
              VALUES (@ped, N'tarjeta (simulada)', @u4, 'aprobado', @ref, @monto)`);

    await tx.commit();
    res.status(201).json({ pedidoId, subtotal, envio: costoEnvio, total, referencia: pay.referencia });
  } catch (e) {
    await tx.rollback().catch(() => {}); // si ya se revirtió, se ignora
    throw e;
  }
}));

// Pedidos del cliente autenticado (solo los suyos: el filtro usa el id del token, no uno enviado por el cliente)
router.get('/mine', authenticate, wrap(async (req, res) => {
  const r = await query(
    `SELECT p.Id AS id, p.Fecha AS fecha, p.Estado AS estado, p.Total AS total,
            pr.Nombre AS producto, d.Cantidad AS cantidad, d.PrecioUnitario AS precio
       FROM dbo.Pedidos p
       JOIN dbo.DetallePedido d ON d.PedidoId = p.Id
       JOIN dbo.Productos pr ON pr.Id = d.ProductoId
      WHERE p.UsuarioId = @uid
      ORDER BY p.Fecha DESC, p.Id DESC`,
    { uid: [sql.Int, req.user.sub] }
  );
  const map = new Map();
  for (const row of r.recordset) {
    if (!map.has(row.id)) map.set(row.id, { id: row.id, fecha: row.fecha, estado: row.estado, total: row.total, items: [] });
    map.get(row.id).items.push({ producto: row.producto, cantidad: row.cantidad, precio: row.precio });
  }
  res.json([...map.values()]);
}));

module.exports = router;
