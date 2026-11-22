const router = require('express').Router();
const { query } = require('../config/db');
const wrap = require('../utils/asyncHandler');

router.get('/', wrap(async (req, res) => {
  const r = await query('SELECT Id AS id, Nombre AS nombre, Descripcion AS descripcion FROM dbo.Categorias ORDER BY Nombre');
  res.json(r.recordset);
}));

module.exports = router;
