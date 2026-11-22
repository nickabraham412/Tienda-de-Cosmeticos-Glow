// Valida (y limpia) body / query / params con un esquema Zod. Los campos no declarados se descartan,
// lo que evita "mass assignment" (p. ej. que alguien envíe rol:"admin" al registrarse).
const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    return res.status(400).json({
      error: 'Datos inválidos',
      details: result.error.issues.map((i) => ({ campo: i.path.join('.'), mensaje: i.message }))
    });
  }
  req[source] = result.data;
  next();
};
module.exports = { validate };
