import { $, $$, api, esc, money, fecha, renderLayout, toast, errMsg, validateForm, rule, currentUser } from '/js/common.js';

const ESTADOS = ['pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'];
const STOCK_BAJO = 5;
let categorias = [];
let productos = [];

// Ejecuta una función async mostrando cualquier error como aviso
const safe = (fn) => async (...args) => {
  try { return await fn(...args); } catch (e) { toast(errMsg(e), 'err'); }
};

/* ---------------- Resumen ---------------- */
const loadStats = safe(async () => {
  const s = await api('/admin/stats');
  $('#stats').innerHTML = [
    ['Ventas (sin cancelados)', money(s.ventas)],
    ['Pedidos', s.pedidos],
    ['Clientes', s.clientes],
    ['Productos activos', s.productos],
    [`Stock bajo (≤ ${STOCK_BAJO})`, s.stockBajo]
  ].map(([k, v]) => `<div class="stat"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('');
});

/* ---------------- Productos ---------------- */
const loadProductos = safe(async () => {
  productos = await api('/admin/products');
  renderProductos();
});

function renderProductos() {
  const f = $('#p-filter').value.trim().toLowerCase();
  const list = productos.filter((p) => !f || `${p.nombre} ${p.marca}`.toLowerCase().includes(f));
  $('#tbl-productos').innerHTML = `
    <thead><tr><th>ID</th><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Estado</th><th>Acciones</th></tr></thead>
    <tbody>${
      list.length
        ? list.map((p) => `
      <tr class="${p.activo ? '' : 'row-off'}">
        <td>${p.id}</td>
        <td><strong>${esc(p.nombre)}</strong><br><small class="muted">${esc(p.marca)}</small></td>
        <td>${esc(p.categoria)}</td>
        <td>${money(p.precio)}</td>
        <td>
          <div class="stock-edit">
            <input type="number" min="0" max="100000" value="${p.stock}" class="${p.stock <= STOCK_BAJO ? 'low' : ''}" data-stock-input="${p.id}" aria-label="Stock de ${esc(p.nombre)}">
            <button class="btn btn-ghost btn-sm" type="button" data-stock-save="${p.id}">Guardar</button>
          </div>
        </td>
        <td><span class="tag ${p.activo ? 'tag-ok' : 'tag-out'}">${p.activo ? 'Activo' : 'Inactivo'}</span></td>
        <td class="actions">
          <button class="btn btn-ghost btn-sm" type="button" data-edit="${p.id}">Editar</button>
          <button class="btn btn-ghost btn-sm" type="button" data-toggle="${p.id}">${p.activo ? 'Desactivar' : 'Activar'}</button>
        </td>
      </tr>`).join('')
        : '<tr><td colspan="7" class="muted">Sin resultados.</td></tr>'
    }</tbody>`;
}

const toBody = (p) => ({
  categoriaId: p.categoriaId, nombre: p.nombre, marca: p.marca, descripcion: p.descripcion,
  precio: p.precio, stock: p.stock, tipoPiel: p.tipoPiel, imagenUrl: p.imagenUrl || '', activo: p.activo
});

const dlg = $('#dlg-producto');
const form = $('#form-producto');

function openForm(p) {
  form.reset();
  $$('.err', form).forEach((s) => (s.textContent = ''));
  $$('.invalid', form).forEach((el) => el.classList.remove('invalid'));
  form.dataset.id = p?.id ?? '';
  $('#dlg-producto-titulo').textContent = p ? `Editar producto #${p.id}` : 'Nuevo producto';
  if (p) {
    for (const k of ['nombre', 'marca', 'categoriaId', 'precio', 'stock', 'tipoPiel', 'descripcion']) form.elements[k].value = p[k];
    form.elements.imagenUrl.value = p.imagenUrl || '';
    form.elements.activo.checked = !!p.activo;
  }
  dlg.showModal();
}

form.addEventListener('submit', safe(async (e) => {
  e.preventDefault();
  const d = validateForm(form, {
    nombre: [rule.required, rule.min(2), rule.max(120)],
    marca: [rule.required, rule.max(60)],
    categoriaId: [rule.required],
    precio: [rule.number(0.01, 100000)],
    stock: [rule.integer(0, 100000)],
    tipoPiel: [rule.required],
    imagenUrl: [rule.optional(rule.match(/^https?:\/\/\S+$/i, 'Debe ser una URL http(s) válida'))],
    descripcion: [rule.max(2000)]
  });
  if (!d) return;
  const body = { ...d, categoriaId: Number(d.categoriaId), precio: Number(d.precio), stock: Number(d.stock), activo: form.elements.activo.checked };
  const id = form.dataset.id;
  await api(id ? `/admin/products/${id}` : '/admin/products', { method: id ? 'PUT' : 'POST', body });
  dlg.close();
  toast('Producto guardado');
  await Promise.all([loadProductos(), loadStats()]);
}));

function bindProductos() {
  $('#btn-nuevo').addEventListener('click', () => openForm(null));
  $('#p-filter').addEventListener('input', renderProductos);
  $('#tbl-productos').addEventListener('click', safe(async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.edit) return openForm(productos.find((p) => p.id === Number(b.dataset.edit)));
    if (b.dataset.toggle) {
      const p = productos.find((x) => x.id === Number(b.dataset.toggle));
      await api(`/admin/products/${p.id}`, { method: 'PUT', body: { ...toBody(p), activo: !p.activo } });
      toast(p.activo ? 'Producto desactivado' : 'Producto activado');
      return Promise.all([loadProductos(), loadStats()]);
    }
    if (b.dataset.stockSave) {
      const id = Number(b.dataset.stockSave);
      const input = $(`[data-stock-input="${id}"]`);
      const stock = Number(input.value);
      if (!Number.isInteger(stock) || stock < 0 || stock > 100000) return toast('El stock debe ser un entero entre 0 y 100000', 'err');
      await api(`/admin/products/${id}/stock`, { method: 'PATCH', body: { stock } });
      toast('Stock actualizado');
      return Promise.all([loadProductos(), loadStats()]);
    }
  }));
}

/* ---------------- Pedidos ---------------- */
const loadPedidos = safe(async () => {
  const orders = await api('/admin/orders');
  $('#tbl-pedidos').innerHTML = `
    <thead><tr><th>Pedido</th><th>Cliente</th><th>Fecha</th><th>Artículos</th><th>Total</th><th>Estado</th><th></th></tr></thead>
    <tbody>${
      orders.length
        ? orders.map((o) => `
      <tr>
        <td>#${o.id}</td>
        <td>${esc(o.cliente)}<br><small class="muted">${esc(o.email)}</small></td>
        <td>${esc(fecha(o.fecha))}</td>
        <td>${o.articulos}</td>
        <td>${money(o.total)}</td>
        <td>
          <select data-status="${o.id}" aria-label="Estado del pedido ${o.id}" ${o.estado === 'cancelado' ? 'disabled' : ''}>
            ${ESTADOS.map((s) => `<option value="${s}" ${s === o.estado ? 'selected' : ''}>${s}</option>`).join('')}
          </select>
        </td>
        <td><button class="btn btn-ghost btn-sm" type="button" data-detail="${o.id}">Ver detalle</button></td>
      </tr>`).join('')
        : '<tr><td colspan="7" class="muted">Aún no hay pedidos.</td></tr>'
    }</tbody>`;
});

function bindPedidos() {
  const tbl = $('#tbl-pedidos');
  tbl.addEventListener('change', safe(async (e) => {
    const sel = e.target.closest('[data-status]');
    if (!sel) return;
    if (sel.value === 'cancelado' && !confirm('Cancelar el pedido devolverá el stock y no se podrá revertir. ¿Continuar?')) {
      return loadPedidos();
    }
    await api(`/admin/orders/${sel.dataset.status}/status`, { method: 'PATCH', body: { estado: sel.value } });
    toast('Estado actualizado');
    await Promise.all([loadPedidos(), loadStats(), loadProductos()]);
  }));
  tbl.addEventListener('click', safe(async (e) => {
    const b = e.target.closest('[data-detail]');
    if (!b) return;
    const o = await api(`/admin/orders/${b.dataset.detail}`);
    $('#pedido-detalle').innerHTML = `
      <h2>Pedido #${o.id}</h2>
      <dl class="kv">
        <dt>Cliente</dt><dd>${esc(o.cliente)} (${esc(o.email)})</dd>
        <dt>Fecha</dt><dd>${esc(fecha(o.fecha))}</dd>
        <dt>Estado</dt><dd>${esc(o.estado)}</dd>
        <dt>Envío a</dt><dd>${esc(o.direccion)}, ${esc(o.ciudad)} · ${esc(o.telefono)}</dd>
        <dt>Pago</dt><dd>${o.referencia ? `Tarjeta •••• ${esc(o.ultimos4)} · ${esc(o.referencia)}` : 'Sin pago registrado'}</dd>
      </dl>
      <div class="table-wrap"><table>
        <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
        <tbody>${o.items.map((i) => `<tr><td>${esc(i.producto)}</td><td>${i.cantidad}</td><td>${money(i.precio)}</td><td>${money(i.precio * i.cantidad)}</td></tr>`).join('')}</tbody>
      </table></div>
      <p class="row"><span>Subtotal ${money(o.subtotal)} · Envío ${money(o.envio)}</span><strong>Total ${money(o.total)}</strong></p>`;
    $('#dlg-pedido').showModal();
  }));
}

/* ---------------- Clientes ---------------- */
const loadClientes = safe(async () => {
  const list = await api('/admin/customers');
  $('#tbl-clientes').innerHTML = `
    <thead><tr><th>ID</th><th>Cliente</th><th>Teléfono</th><th>Registro</th><th>Pedidos</th><th>Gastado</th><th>Estado</th></tr></thead>
    <tbody>${
      list.length
        ? list.map((c) => `
      <tr>
        <td>${c.id}</td>
        <td>${esc(c.nombre)}<br><small class="muted">${esc(c.email)}</small></td>
        <td>${esc(c.telefono) || '—'}</td>
        <td>${esc(fecha(c.fechaRegistro))}</td>
        <td>${c.pedidos}</td>
        <td>${money(c.gastado)}</td>
        <td><span class="tag ${c.activo ? 'tag-ok' : 'tag-out'}">${c.activo ? 'Activo' : 'Inactivo'}</span></td>
      </tr>`).join('')
        : '<tr><td colspan="7" class="muted">Aún no hay clientes registrados.</td></tr>'
    }</tbody>`;
});

/* ---------------- Pestañas y arranque ---------------- */
function bindTabs() {
  const loaders = { productos: loadProductos, pedidos: loadPedidos, clientes: loadClientes };
  $$('.tab').forEach((tab) =>
    tab.addEventListener('click', () => {
      $$('.tab').forEach((t) => { t.classList.toggle('active', t === tab); t.setAttribute('aria-selected', t === tab); });
      for (const name of Object.keys(loaders)) $(`#tab-${name}`).hidden = name !== tab.dataset.tab;
      loaders[tab.dataset.tab]();
    })
  );
  $$('[data-close]').forEach((b) => b.addEventListener('click', () => b.closest('dialog').close()));
}

async function main() {
  await renderLayout();
  categorias = await api('/categories');
  $('#p-cat').innerHTML = categorias.map((c) => `<option value="${c.id}">${esc(c.nombre)}</option>`).join('');
  bindTabs();
  bindProductos();
  bindPedidos();
  await Promise.all([loadStats(), loadProductos()]);
}

// Doble control: esta comprobación es solo de comodidad; la seguridad real está en el servidor (requireAdmin).
const user = await currentUser();
if (!user || user.rol !== 'admin') location.replace('/login.html?next=' + encodeURIComponent('/admin/'));
else await main().catch((e) => toast(errMsg(e), 'err'));
