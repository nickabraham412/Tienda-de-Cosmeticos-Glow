import { $, api, esc, money, imgFor, stockTag, renderLayout, toast, errMsg, cart } from '/js/common.js';

await renderLayout();
const root = $('#product');
const id = Number(new URLSearchParams(location.search).get('id'));

function render(p) {
  document.title = `${p.nombre} · Glow`;
  const max = Math.min(20, p.stock);
  root.innerHTML = `
    <div class="detail-img"><img src="${esc(imgFor(p))}" alt="${esc(p.nombre)}" width="400" height="400"></div>
    <div>
      <p class="muted">${esc(p.marca)} · ${esc(p.categoria)}</p>
      <h1>${esc(p.nombre)}</h1>
      <p class="price">${money(p.precio)}</p>
      <p>${esc(p.descripcion) || 'Sin descripción.'}</p>
      <p><span class="tag">Piel ${esc(p.tipoPiel)}</span> ${stockTag(p.stock)}</p>
      <div class="buy">
        <input id="qty" type="number" min="1" max="${max}" value="1" aria-label="Cantidad" ${p.stock < 1 ? 'disabled' : ''}>
        <button class="btn btn-primary" id="add" type="button" ${p.stock < 1 ? 'disabled' : ''}>${p.stock < 1 ? 'Agotado' : 'Añadir al carrito'}</button>
      </div>
    </div>`;
  $('#add')?.addEventListener('click', () => {
    const q = Math.floor(Number($('#qty').value));
    if (!Number.isFinite(q) || q < 1 || q > max) return toast(`Elige una cantidad entre 1 y ${max}`, 'err');
    cart.add(p.id, q);
    toast('Producto añadido al carrito');
  });
}

if (!Number.isInteger(id) || id < 1) {
  root.innerHTML = '<p class="empty">El producto solicitado no es válido.</p>';
} else {
  try {
    render(await api('/products/' + id));
  } catch (e) {
    root.innerHTML = `<p class="empty">${esc(errMsg(e))}</p>`;
  }
}
