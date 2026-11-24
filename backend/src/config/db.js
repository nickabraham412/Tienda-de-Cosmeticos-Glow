const sql = require('mssql');

// La configuración viene SOLO de variables de entorno (.env): ninguna credencial en el código.
function buildConfig() {
  const cfg = {
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: process.env.DB_TRUST_CERT === 'true'
    },
    pool: { max: 10, min: 0, idleTimeoutMillis: 30000 },
    connectionTimeout: 15000,
    requestTimeout: 15000
  };
  if (process.env.DB_INSTANCE) cfg.options.instanceName = process.env.DB_INSTANCE; // instancia con nombre: sin puerto
  else cfg.port = parseInt(process.env.DB_PORT || '1433', 10);
  return cfg;
}

let poolPromise = null;
function getPool() {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(buildConfig()).connect().catch((err) => {
      poolPromise = null; // permite reintentar
      throw err;
    });
  }
  return poolPromise;
}

/**
 * Ejecuta SIEMPRE consultas parametrizadas.
 * params: { nombre: [tipoSql, valor] }  →  se envían como parámetros tipados (@nombre),
 */
async function query(text, params = {}) {
  const pool = await getPool();
  const request = pool.request();
  for (const [name, [type, value]] of Object.entries(params)) request.input(name, type, value);
  return request.query(text);
}

module.exports = { sql, getPool, query };
