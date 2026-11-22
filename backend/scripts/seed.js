// Crea los usuarios iniciales con contraseña hasheada (bcrypt). Es seguro ejecutarlo varias veces.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { sql, query, getPool } = require('../src/config/db');

async function crearUsuario({ nombre, apellido, email, password, rol }) {
  const hash = await bcrypt.hash(password, 12);
  await query(
    `IF NOT EXISTS (SELECT 1 FROM dbo.Usuarios WHERE Email = @email)
       INSERT INTO dbo.Usuarios (Nombre, Apellido, Email, PasswordHash, Rol)
       VALUES (@nombre, @apellido, @email, @hash, @rol)`,
    {
      nombre: [sql.NVarChar(60), nombre],
      apellido: [sql.NVarChar(60), apellido],
      email: [sql.NVarChar(120), email.toLowerCase()],
      hash: [sql.NVarChar(100), hash],
      rol: [sql.NVarChar(10), rol]
    }
  );
  console.log(`✔ ${rol}: ${email}`);
}

(async () => {
  await crearUsuario({ nombre: 'Admin', apellido: 'Glow', email: process.env.ADMIN_EMAIL || 'admin@glow.test', password: process.env.ADMIN_PASSWORD || 'Admin123!', rol: 'admin' });
  await crearUsuario({ nombre: 'Clienta', apellido: 'Demo', email: 'cliente@glow.test', password: 'Cliente123!', rol: 'cliente' });
  await (await getPool()).close();
})().catch((e) => {
  console.error('Error en el seed:', e.message);
  process.exit(1);
});
