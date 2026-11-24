const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { sql, query } = require('../config/db');
const { validate } = require('../middleware/validate');
const { registerSchema, loginSchema } = require('../validators/schemas');
const { signToken, setAuthCookie, clearAuthCookie, authenticate } = require('../middleware/auth');
const wrap = require('../utils/asyncHandler');
const { HttpError } = require('../utils/httpError');

// hash falso para comparar si el correo no existe y evitar que adivinen cuentas por tiempo
const DUMMY_HASH = bcrypt.hashSync('relleno-no-valido', 12);

// CREAR CUENTA
router.post('/register', validate(registerSchema), wrap(async (req, res) => {
  const { nombre, apellido, email, telefono, password } = req.body;

  // encripto la contraseña antes de guardarla en la base de datos
  const hash = await bcrypt.hash(password, 12);

  try {
    const r = await query(
      `INSERT INTO dbo.Usuarios (Nombre, Apellido, Email, Telefono, PasswordHash)
       OUTPUT inserted.Id AS id, inserted.Nombre AS nombre, inserted.Rol AS rol
       VALUES (@nombre, @apellido, @email, @telefono, @hash)`,
      {
        nombre: [sql.NVarChar(60), nombre],
        apellido: [sql.NVarChar(60), apellido],
        email: [sql.NVarChar(120), email],
        telefono: [sql.NVarChar(20), telefono || null],
        hash: [sql.NVarChar(100), hash]
      }
    );

    const user = r.recordset[0];
    setAuthCookie(res, signToken(user));
    res.status(201).json(user);
  } catch (e) {
    // codigos 2627 y 2601 en SQL Server significan dato unico duplicado (correo ya registrado)
    if (e.number === 2627 || e.number === 2601) {
      throw new HttpError(409, 'Ya existe una cuenta con ese correo');
    }
    throw e;
  }
}));

// INICIAR SESION
router.post('/login', validate(loginSchema), wrap(async (req, res) => {
  const { email, password } = req.body;

  const r = await query(
    'SELECT Id AS id, Nombre AS nombre, Rol AS rol, PasswordHash AS hash FROM dbo.Usuarios WHERE Email = @email AND Activo = 1',
    { email: [sql.NVarChar(120), email] }
  );

  const row = r.recordset[0];
  const ok = await bcrypt.compare(password, row ? row.hash : DUMMY_HASH);

  if (!row || !ok) {
    throw new HttpError(401, 'Correo o contraseña incorrectos');
  }

  setAuthCookie(res, signToken(row));
  res.json({ id: row.id, nombre: row.nombre, rol: row.rol });
}));

// CERRAR SESION
router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  res.status(204).end();
});

// OBTENER DATOS DEL USUARIO ACTUAL
router.get('/me', authenticate, wrap(async (req, res) => {
  const r = await query(
    'SELECT Id AS id, Nombre AS nombre, Apellido AS apellido, Email AS email, Rol AS rol FROM dbo.Usuarios WHERE Id = @id AND Activo = 1',
    { id: [sql.Int, req.user.sub] }
  );

  if (!r.recordset[0]) throw new HttpError(401, 'Sesión inválida');
  res.json(r.recordset[0]);
}));

module.exports = router;
