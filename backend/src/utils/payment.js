const crypto = require('crypto');

// Algoritmo de Luhn: detecta números de tarjeta mal digitados.
function luhn(num) {
  let sum = 0;
  let dbl = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i]);
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

function expiryOk(mmYY) {
  const [mm, yy] = mmYY.split('/').map(Number);
  return new Date(2000 + yy, mm, 1) > new Date(); // vigente hasta el último día del mes indicado
}

/**
 * PASARELA SIMULADA. No se cobra nada ni se guarda el número completo ni el CVV.
 * Tarjetas de prueba:
 *   4242 4242 4242 4242 → aprobada
 *   4000 0000 0000 0002 → rechazada por el emisor
 *   4000 0000 0000 9995 → fondos insuficientes
 * Para producción sustituye esta función por el SDK de un proveedor real (Stripe, PayPal, etc.),
 * enviando los datos de tarjeta directamente a ese proveedor y nunca a tu servidor.
 */
function simulatePayment({ numero, vencimiento }) {
  const ultimos4 = numero.slice(-4);
  if (!luhn(numero)) return { aprobado: false, motivo: 'Número de tarjeta inválido' };
  if (!expiryOk(vencimiento)) return { aprobado: false, motivo: 'La tarjeta está vencida' };
  if (numero === '4000000000000002') return { aprobado: false, motivo: 'Tarjeta rechazada por el banco emisor', ultimos4 };
  if (numero === '4000000000009995') return { aprobado: false, motivo: 'Fondos insuficientes', ultimos4 };
  return { aprobado: true, ultimos4, referencia: 'SIM-' + crypto.randomBytes(4).toString('hex').toUpperCase() };
}

module.exports = { simulatePayment };
