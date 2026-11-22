module.exports = (err, req, res, _next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON inválido' });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Solicitud demasiado grande' });
  if (err.number === 547) return res.status(409).json({ error: 'La operación viola una restricción de datos (referencia o valor no válido)' });

  const status = err.status || 500;
  if (status >= 500) console.error(err); // el detalle técnico queda en el log, nunca en la respuesta
  res.status(status).json({ error: status >= 500 ? 'Error interno del servidor' : err.message });
};
