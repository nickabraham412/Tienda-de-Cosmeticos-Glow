import { $, api, esc, money, fecha, renderLayout, requireLogin, errMsg } from '/js/common.js';

await renderLayout();
const user = await requireLogin('/pedidos.html');

if (user) {
  const box = $('#orders');
  try {
    const orders = await api('/orders/mine');
    box.innerHTML = orders.length
      ? orders
          .map(
            (o) => `
      <article class="order">
        <div class="row"><strong>Pedido #${o.id}</strong><span class="tag">${esc(o.estado)}</span></div>
        <small class="muted">${esc(fecha(o.fecha))}</small>
        <ul>${o.items.map((i) => `<li>${i.cantidad} × ${esc(i.producto)} — ${money(i.precio * i.cantidad)}</li>`).join('')}</ul>
        <p class="row"><span>Total</span><strong>${money(o.total)}</strong></p>
      </article>`
          )
          .join('')
      : '<p class="empty">Aún no tienes pedidos. <a href="/index.html">Descubre la tienda</a></p>';
  } catch (e) {
    box.innerHTML = `<p class="empty">${esc(errMsg(e))}</p>`;
  }
}
