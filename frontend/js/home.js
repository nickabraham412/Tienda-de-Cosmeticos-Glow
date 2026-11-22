import { $, api, esc, money, imgFor, stockTag, renderLayout, toast, errMsg, cart, debounce } from '/js/common.js';

await renderLayout();

const grid = $('#grid');
const pager = $('#pager');
const info = $('#results-info');
const state = { q: '', categoria: '', orden: 'nuevos', pagina: 1 };

const card = (p) => `
  <article class="card">
    <a class="card-img" href="/producto.html?id=${p.id}" tabindex="-1" aria-hidden="true">
      <img src="${esc(imgFor(p))}" alt="" loading="lazy" width="400" height="400">
    </a>
    <div class="card-body">
      <small class="muted">${esc(p.marca)} · ${esc(p.categoria)}</small>
      <h3><a href="/producto.html?id=${p.id}">${esc(p.nombre)}</a></h3>
      <div class="row"><span class="price">${money(p.precio)}</span>${stockTag(p.stock)}</div>
      <button class="btn btn-primary btn-block" type="button" data-add="${p.id}" ${p.stock < 1 ? 'disabled' : ''}>
        ${p.stock < 1 ? 'Agotado' : 'Añadir al carrito'}
      </button>
    </div>
  </article>`;

async function load() {
  const qs = new URLSearchParams({ orden: state.orden, pagina: state.pagina, limite: 12 });
  if (state.q) qs.set('q', state.q);
  if (state.categoria) qs.set('categoria', state.categoria);
  try {
    const { items, total, paginas } = await api('/products?' + qs);
    info.textContent = total === 1 ? '1 producto' : `${total} productos`;
    grid.innerHTML = items.length ? items.map(card).join('') : '<p class="empty">No encontramos productos con esos filtros. Prueba con otra búsqueda o categoría.</p>';
    pager.innerHTML =
      paginas > 1
        ? Array.from({ length: paginas }, (_, i) =>
            `<button class="btn btn-sm ${i + 1 === state.pagina ? 'btn-primary' : 'btn-ghost'}" type="button" data-page="${i + 1}">${i + 1}</button>`
          ).join('')
        : '';
  } catch (e) {
    toast(errMsg(e), 'err');
  }
}

try {
  const cats = await api('/categories');
  $('#f-cat').insertAdjacentHTML('beforeend', cats.map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`).join(''));
} catch { /* el catálogo sigue funcionando sin filtro de categorías */ }

$('#f-q').addEventListener('input', debounce((e) => { state.q = e.target.value.trim(); state.pagina = 1; load(); }));
$('#f-cat').addEventListener('change', (e) => { state.categoria = e.target.value; state.pagina = 1; load(); });
$('#f-orden').addEventListener('change', (e) => { state.orden = e.target.value; state.pagina = 1; load(); });
pager.addEventListener('click', (e) => {
  const b = e.target.closest('[data-page]');
  if (!b) return;
  state.pagina = Number(b.dataset.page);
  load();
  window.scrollTo({ top: 0 });
});
grid.addEventListener('click', (e) => {
  const b = e.target.closest('[data-add]');
  if (!b) return;
  cart.add(Number(b.dataset.add));
  toast('Producto añadido al carrito');
});

await load();
