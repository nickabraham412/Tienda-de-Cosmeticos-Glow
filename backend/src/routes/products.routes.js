const router = require('express').Router();
const { sql, query } = require('../config/db');
const { validate } = require('../middleware/validate');
const { listQuery, bulkQuery, idParam } = require('../validators/schemas');
const wrap = require('../utils/asyncHandler');
const { HttpError } = require('../utils/httpError');

const COLS = `p.Id AS id, p.Nombre AS nombre, p.Marca AS marca, p.Descripcion AS descripcion, p.Precio AS precio,
              p.Stock AS stock, p.ImagenUrl AS imagenUrl, p.TipoPiel AS tipoPiel, c.Nombre AS categoria`;

// El ORDER BY no admite parámetros → se usa una lista blanca: el texto SQL sale de aquí, nunca del usuario.
const ORDEN = {
  nuevos: 'p.FechaCreacion DESC, p.Id DESC',
  precio_asc: 'p.Precio ASC',
  precio_desc: 'p.Precio DESC',
  nombre: 'p.Nombre ASC'
};

// Escapa comodines de LIKE (% _ [) para que el texto buscado se trate como texto literal.
const escapeLike = (s) => s.replace(/[\\%_[]/g, '\\$&');

router.get('/', validate(listQuery, 'query'), wrap(async (req, res) => {
  const { q, categoria, orden, pagina, limite } = req.query;
  const where = ['p.Activo = 1'];
  const params = {};
  if (q) {
    where.push("(p.Nombre LIKE @q ESCAPE '\\' OR p.Marca LIKE @q ESCAPE '\\' OR p.Descripcion LIKE @q ESCAPE '\\')");
    params.q = [sql.NVarChar(130), `%${escapeLike(q)}%`];
  }
  if (categoria) {
    where.push('p.CategoriaId = @cat');
    params.cat = [sql.Int, categoria];
  }
  const whereSql = where.join(' AND ');

  const total = (await query(`SELECT COUNT(*) AS total FROM dbo.Productos p WHERE ${whereSql}`, params)).recordset[0].total;
  const items = (
    await query(
      `SELECT ${COLS}
         FROM dbo.Productos p JOIN dbo.Categorias c ON c.Id = p.CategoriaId
        WHERE ${whereSql}
        ORDER BY ${ORDEN[orden]}
       OFFSET @off ROWS FETCH NEXT @lim ROWS ONLY`,
      { ...params, off: [sql.Int, (pagina - 1) * limite], lim: [sql.Int, limite] }
    )
  ).recordset;

  res.json({ items, total, pagina, paginas: Math.max(1, Math.ceil(total / limite)) });
}));

// Varios productos por id (carrito). IN (...) seguro: un parámetro por cada id.
router.get('/bulk', validate(bulkQuery, 'query'), wrap(async (req, res) => {
  const ids = [...new Set(req.query.ids.split(',').map(Number))];
  const params = {};
  const names = ids.map((value, i) => {
    params[`p${i}`] = [sql.Int, value];
    return `@p${i}`;
  });
  const r = await query(
    `SELECT ${COLS} FROM dbo.Productos p JOIN dbo.Categorias c ON c.Id = p.CategoriaId
      WHERE p.Activo = 1 AND p.Id IN (${names.join(',')})`,
    params
  );
  res.json(r.recordset);
}));

router.get('/:id', validate(idParam, 'params'), wrap(async (req, res) => {
  const r = await query(
    `SELECT ${COLS} FROM dbo.Productos p JOIN dbo.Categorias c ON c.Id = p.CategoriaId WHERE p.Id = @id AND p.Activo = 1`,
    { id: [sql.Int, req.params.id] }
  );
  if (!r.recordset[0]) throw new HttpError(404, 'Producto no encontrado');
  res.json(r.recordset[0]);
}));

module.exports = router;
