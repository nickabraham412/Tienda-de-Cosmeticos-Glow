require('dotenv').config();
const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');

const { getPool } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Fallar pronto si falta configuración crítica
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('Falta JWT_SECRET (mínimo 32 caracteres) en backend/.env. Consulta el README.');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');

// Cabeceras de seguridad. CSP estricta: solo scripts/estilos propios (por eso el frontend no usa JS ni CSS en línea).
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'style-src': ["'self'"],
        'img-src': ["'self'", 'data:', 'https:'],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'form-action': ["'self'"],
        'frame-ancestors': ["'none'"],
        'upgrade-insecure-requests': null // evita que Safari fuerce https en localhost
      }
    }
  })
);

app.use(express.json({ limit: '50kb' })); // solo parsea application/json
app.use(cookieParser());

// Límite de peticiones (fuerza bruta / abuso)
app.use('/api', rateLimit({ windowMs: 15 * 60 * 1000, limit: 400, standardHeaders: true, legacyHeaders: false }));
app.use('/api/auth', rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: true, legacyHeaders: false, message: { error: 'Demasiados intentos. Espera unos minutos.' } }));

app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/categories', require('./routes/categories.routes'));
app.use('/api/products', require('./routes/products.routes'));
app.use('/api/orders', require('./routes/orders.routes'));
app.use('/api/admin', require('./routes/admin.routes'));
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Frontend estático
app.use(express.static(path.join(__dirname, '..', '..', 'frontend')));

app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3000;
getPool()
  .then(() => {
    console.log('Conectado a SQL Server');
    app.listen(PORT, () => console.log(`Glow Store en http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('No se pudo conectar a SQL Server:', err.message);
    console.error('Revisa backend/.env, que SQL Server acepte conexiones TCP/IP y la autenticación mixta.');
    process.exit(1);
  });
