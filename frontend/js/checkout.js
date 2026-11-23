import { $, api, esc, money, renderLayout, requireLogin, toast, errMsg, cart, calcEnvio, validateForm, rule } from '/js/common.js';

await renderLayout();
const user = await requireLogin('/checkout.html');
if (user) await init();

async function init() {
  const items = cart.get();

  // Si el carrito está vacío, muestra un aviso y detiene la carga
  if (!items.length) {
    $('#checkout').innerHTML = '<p class="empty">Tu carrito está vacío. <a href="/index.html">Volver a la tienda</a></p>';
    return;
  }

  // Pide los precios actuales al servidor para armar el resumen
  try {
    const productos = await api('/products/bulk?ids=' + items.map((i) => i.id).join(','));
    const mapaProductos = new Map(productos.map((p) => [p.id, p]));

    let subtotal = 0;
    const filas = [];

    for (const item of items) {
      const prod = mapaProductos.get(item.id);
      if (!prod) continue;
      const importe = prod.precio * item.cantidad;
      subtotal += importe;
      filas.push(`<div class="row"><span>${item.cantidad} × ${esc(prod.nombre)}</span><span>${money(importe)}</span></div>`);
    }

    const envio = calcEnvio(subtotal);
    $('#summary').innerHTML = `
      <h2>Tu pedido</h2>${filas.join('')}
      <div class="row"><span>Envío</span><span>${envio ? money(envio) : 'Gratis'}</span></div>
      <div class="row total"><span>Total</span><span>${money(subtotal + envio)}</span></div>`;
  } catch (e) {
    $('#summary').textContent = errMsg(e);
  }

  const form = $('#checkout-form');

  // Da formato visual de 4 en 4 números a la tarjeta (máximo 16 números = 19 caracteres con espacios)
  form.elements.numero.addEventListener('input', (e) => {
    const soloNumeros = e.target.value.replace(/\D/g, '').slice(0, 16);
    e.target.value = soloNumeros.replace(/(.{4})/g, '$1 ').trim();
  });

  // Da formato MM/AA a la fecha de vencimiento
  form.elements.vencimiento.addEventListener('input', (e) => {
    const soloNumeros = e.target.value.replace(/\D/g, '').slice(0, 4);
    e.target.value = soloNumeros.length > 2 ? `${soloNumeros.slice(0, 2)}/${soloNumeros.slice(2)}` : soloNumeros;
  });

  // Solo permite números en el CVV
  form.elements.cvv.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
  });

  // Envía la compra al presionar "Confirmar y pagar"
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const datos = validateForm(form, {
      direccion: [rule.required, rule.min(5)],
      ciudad: [rule.required, rule.min(2)],
      telefono: [rule.phone],
      titular: [rule.required, rule.min(3)],
      numero: [rule.required, rule.cardNumber],
      vencimiento: [rule.required, rule.expiry],
      cvv: [rule.required, rule.cvv]
    });
    if (!datos) return;

    const btn = $('#pay-btn');
    btn.disabled = true;
    btn.textContent = 'Procesando pago…';

    try {
      const respuesta = await api('/orders', {
        method: 'POST',
        body: {
          items: cart.get().map((i) => ({ productoId: i.id, cantidad: i.cantidad })),
          envio: {
            direccion: datos.direccion,
            ciudad: datos.ciudad,
            telefono: datos.telefono || '00000000'
          },
          pago: {
            titular: datos.titular,
            numero: datos.numero,
            vencimiento: datos.vencimiento,
            cvv: datos.cvv
          }
        }
      });

      cart.clear();
      $('#checkout').innerHTML = `
        <div class="confirm">
          <h2>¡Gracias por tu compra!</h2>
          <p>Tu pedido <strong>#${esc(respuesta.pedidoId)}</strong> fue pagado por <strong>${money(respuesta.total)}</strong>.</p>
          <p class="muted">Referencia de pago (simulada): ${esc(respuesta.referencia)}</p>
          <p><a class="btn btn-primary" href="/pedidos.html">Ver mis pedidos</a>
             <a class="btn btn-ghost" href="/index.html">Seguir comprando</a></p>
        </div>`;
    } catch (err) {
      toast(errMsg(err), 'err');
      btn.disabled = false;
      btn.textContent = 'Confirmar y pagar';
    }
  });
}