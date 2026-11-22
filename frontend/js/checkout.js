import { $, api, esc, money, renderLayout, requireLogin, toast, errMsg, cart, calcEnvio, validateForm, rule } from '/js/common.js';

await renderLayout();
const user = await requireLogin('/checkout.html');
if (user) await init();

async function init() {
  const items = cart.get();
  if (!items.length) {
    $('#checkout').innerHTML = '<p class="empty">Tu carrito está vacío. <a href="/index.html">Volver a la tienda</a></p>';
    return;
  }

  // Resumen con precios actuales del servidor
  try {
    const data = await api('/products/bulk?ids=' + items.map((i) => i.id).join(','));
    const byId = new Map(data.map((p) => [p.id, p]));
    let subtotal = 0;
    const lines = items.filter((i) => byId.has(i.id)).map((i) => {
      const p = byId.get(i.id);
      subtotal += p.precio * i.cantidad;
      return `<div class="row"><span>${i.cantidad} × ${esc(p.nombre)}</span><span>${money(p.precio * i.cantidad)}</span></div>`;
    });
    const envio = calcEnvio(subtotal);
    $('#summary').innerHTML = `
      <h2>Tu pedido</h2>${lines.join('')}
      <div class="row"><span>Envío</span><span>${envio ? money(envio) : 'Gratis'}</span></div>
      <div class="row total"><span>Total</span><span>${money(subtotal + envio)}</span></div>`;
  } catch (e) {
    $('#summary').textContent = errMsg(e);
  }

  const form = $('#checkout-form');

  // Formato amigable mientras se escribe
  form.elements.numero.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 19).replace(/(.{4})/g, '$1 ').trim();
  });
  form.elements.vencimiento.addEventListener('input', (e) => {
    const d = e.target.value.replace(/\D/g, '').slice(0, 4);
    e.target.value = d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  });
  form.elements.cvv.addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const d = validateForm(form, {
      direccion: [rule.required, rule.min(8), rule.max(200)],
      ciudad: [rule.required, rule.min(2), rule.max(80)],
      telefono: [rule.required, rule.phone],
      titular: [rule.required, rule.min(3), rule.max(80)],
      numero: [rule.required, rule.luhn],
      vencimiento: [rule.required, rule.expiry],
      cvv: [rule.required, rule.match(/^\d{3,4}$/, 'CVV de 3 o 4 dígitos')]
    });
    if (!d) return;

    const btn = $('#pay-btn');
    btn.disabled = true; // evita pagos duplicados por doble clic
    btn.textContent = 'Procesando pago…';
    try {
      const r = await api('/orders', {
        method: 'POST',
        body: {
          items: cart.get().map((i) => ({ productoId: i.id, cantidad: i.cantidad })),
          envio: { direccion: d.direccion, ciudad: d.ciudad, telefono: d.telefono },
          pago: { titular: d.titular, numero: d.numero, vencimiento: d.vencimiento, cvv: d.cvv }
        }
      });
      cart.clear();
      $('#checkout').innerHTML = `
        <div class="confirm">
          <h2>¡Gracias por tu compra!</h2>
          <p>Tu pedido <strong>#${esc(r.pedidoId)}</strong> fue pagado por <strong>${money(r.total)}</strong>.</p>
          <p class="muted">Referencia de pago (simulada): ${esc(r.referencia)}</p>
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
