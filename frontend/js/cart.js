import { $, api, esc, money, imgFor, renderLayout, toast, errMsg, cart, calcEnvio } from '/js/common.js';

await renderLayout();
const box = $('#cart');

async function draw() {
  const items = cart.get();
  if (!items.length) {
    box.innerHTML = '<p class="empty">Tu carrito está vacío. <a href="/index.html">Explorar productos</a></p>';
    return;
  }
  let data;
  try {
    data = await api('/products/bulk?ids=' + items.map((i) => i.id).join(','));
  } catch (e) {
    box.innerHTML = `<p class="empty">${esc(errMsg(e))}</p>`;
    return;
  }
  const byId = new Map(data.map((p) => [p.id, p]));

  // Quita productos que ya no existen y ajusta cantidades al stock real
  const clean = items
    .filter((i) => byId.has(i.id))
    .map((i) => ({ id: i.id, cantidad: Math.min(i.cantidad, byId.get(i.id).stock) }))
    .filter((i) => i.cantidad > 0);
  if (JSON.stringify(clean) !== JSON.stringify(items)) {
    cart.save(clean);
    toast('Actualizamos tu carrito según el stock disponible');
    return draw();
  }

  let subtotal = 0;
  const rows = clean.map((i) => {
    const p = byId.get(i.id);
    const line = p.precio * i.cantidad;
    subtotal += line;
    return `
      <div class="cart-row">
        <img src="${esc(imgFor(p))}" alt="" width="72" height="72">
        <div>
          <a href="/producto.html?id=${p.id}"><strong>${esc(p.nombre)}</strong></a><br>
          <small class="muted">${esc(p.marca)} · ${money(p.precio)} c/u</small><br>
          <button class="btn btn-ghost btn-sm btn-danger" type="button" data-remove="${p.id}">Quitar</button>
        </div>
        <div class="qty">
          <button type="button" data-dec="${p.id}" aria-label="Menos">−</button>
          <span>${i.cantidad}</span>
          <button type="button" data-inc="${p.id}" aria-label="Más" ${i.cantidad >= Math.min(20, p.stock) ? 'disabled' : ''}>+</button>
        </div>
        <strong>${money(line)}</strong>
      </div>`;
  });
  const envio = calcEnvio(subtotal);
  box.innerHTML = `
    <div class="cart-layout">
      <div>${rows.join('')}</div>
      <aside class="summary">
        <h2>Resumen</h2>
        <div class="row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
        <div class="row"><span>Envío</span><span>${envio ? money(envio) : 'Gratis'}</span></div>
        <div class="row total"><span>Total</span><span>${money(subtotal + envio)}</span></div>
        <a class="btn btn-primary btn-block" href="/checkout.html">Continuar al pago</a>
      </aside>
    </div>`;
}

box.addEventListener('click', (e) => {
  const t = e.target.closest('button');
  if (!t) return;
  const items = cart.get();
  const find = (id) => items.find((i) => i.id === Number(id));
  if (t.dataset.remove) cart.remove(Number(t.dataset.remove));
  else if (t.dataset.inc) cart.setQty(Number(t.dataset.inc), (find(t.dataset.inc)?.cantidad || 0) + 1);
  else if (t.dataset.dec) cart.setQty(Number(t.dataset.dec), (find(t.dataset.dec)?.cantidad || 0) - 1);
  else return;
  draw();
});

await draw();
