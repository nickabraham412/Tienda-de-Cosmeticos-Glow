const jwt = require('jsonwebtoken');

const COOKIE = 'glow_token';
const TWO_HOURS = 2 * 60 * 60 * 1000;
const secure = () => process.env.NODE_ENV === 'production'; // en producción exige HTTPS

const signToken = (user) => jwt.sign({ sub: user.id, rol: user.rol }, process.env.JWT_SECRET, { expiresIn: '2h' });

// Cookie httpOnly (JavaScript no puede leerla → mitiga robo por XSS) + SameSite=Strict (mitiga CSRF).
const setAuthCookie = (res, token) =>
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: secure(), maxAge: TWO_HOURS });

const clearAuthCookie = (res) => res.clearCookie(COOKIE, { httpOnly: true, sameSite: 'strict', secure: secure() });

function authenticate(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ error: 'Debes iniciar sesión' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Sesión inválida o expirada' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.rol !== 'admin') return res.status(403).json({ error: 'Acceso restringido a administradores' });
  next();
}

module.exports = { signToken, setAuthCookie, clearAuthCookie, authenticate, requireAdmin };
