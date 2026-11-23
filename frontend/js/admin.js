import { $, $$, api, esc, money, fecha, renderLayout, toast, errMsg, validateForm, rule, currentUser } from '/js/common.js';

const ESTADOS = ['pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'];
const STOCK_BAJO = 5;

let categorias = [];
let productos = [];

const dlgProducto = $('#dlg-producto');
const formProducto = $('#form-producto');

/* ---------------- RESUMEN ---------------- */

async function loadStats() {
  try {
    const s = await api('/admin/stats');
    const tarjetas = [
      ['Ventas (sin cancelados)', money(s.ventas)],
      ['Pedidos', s.pedidos],
      ['Clientes', s.clientes],
      ['Productos activos', s.productos],
      [`Stock bajo (≤ ${STOCK_BAJO})`, s.stockBajo]
    ];

    $('#stats').innerHTML = tarjetas
      .map(([titulo, valor]) => `<div class="stat"><span>${esc(titulo)}</span><strong>${esc(valor)}</strong></div>`)
      .join('');
  } catch (e) {
    toast(errMsg(e), 'err');
  }
}

/* ---------------- PRODUCTOS ---------------- */

async function loadProductos() {
  try {
    productos = await api('/admin/products');
    renderProductos();
  } catch (e) {
    toast(errMsg(e), 'err');
  }
}

function renderProductos() {
  const filtro = $('#p-filter').value.trim().toLowerCase();
  const lista = productos.filter((p) => !filtro || `${p.nombre} ${p.marca}`.toLowerCase().includes(filtro));

  if (!lista.length) {
    $('#tbl-productos').innerHTML = `
      <thead><tr><th>ID</th><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Estado</th><th>Acciones</th></tr></thead>
      <tbody><tr><td colspan="7" class="muted">Sin resultados.</td></tr></tbody>`;
    return;
  }

  const filas = lista.map((p) => {
    const claseStock = p.stock <= STOCK_BAJO ? 'low' : '';
    const claseEstado = p.activo ? 'tag-ok' : 'tag-out';
    const textoEstado = p.activo ? 'Activo' : 'Inactivo';
    const textoToggle = p.activo ? 'Desactivar' : 'Activar';

    return `
      <tr class="${p.activo ? '' : 'row-off'}">
        <td>${p.id}</td>
        <td><strong>${esc(p.nombre)}</strong><br><small class="muted">${esc(p.marca)}</small></td>
        <td>${esc(p.categoria)}</td>
        <td>${money(p.precio)}</td>
        <td>
          <div class="stock-edit">
            <input type="number" min="0" max="100000" value="${p.stock}" class="${claseStock}" data-stock-input="${p.id}" aria-label="Stock de ${esc(p.nombre)}">
            <button class="btn btn-ghost btn-sm" type="button" data-stock-save="${p.id}">Guardar</button>
          </div>
        </td>
        <td><span class="tag ${claseEstado}">${textoEstado}</span></td>
        <td class="actions">
          <button class="btn btn-ghost btn-sm" type="button" data-edit="${p.id}">Editar</button>
          <button class="btn btn-ghost btn-sm" type="button" data-toggle="${p.id}">${textoToggle}</button>
        </td>
      </tr>`;
  });

  $('#tbl-productos').innerHTML = `
    <thead><tr><th>ID</th><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock</th><th>Estado</th><th>Acciones</th></tr></thead>
    <tbody>${filas.join('')}</tbody>`;
}

// Abre el formulario para crear un producto nuevo o editar uno existente
function openForm(prod) {
  formProducto.reset();
  $$('.err', formProducto).forEach((s) => (s.textContent = ''));
  $$('.invalid', formProducto).forEach((el) => el.classList.remove('invalid'));

  formProducto.dataset.id = prod ? prod.id : '';
  $('#dlg-producto-titulo').textContent = prod ? `Editar producto #${prod.id}` : 'Nuevo producto';

  if (prod) {
    formProducto.elements.nombre.value = prod.nombre;
    formProducto.elements.marca.value = prod.marca;
    formProducto.elements.categoriaId.value = prod.categoriaId;
    formProducto.elements.precio.value = prod.precio;
    formProducto.elements.stock.value = prod.stock;
    formProducto.elements.tipoPiel.value = prod.tipoPiel;
    formProducto.elements.imagenUrl.value = prod.imagenUrl || '';
    formProducto.elements.descripcion.value = prod.descripcion || '';
    formProducto.elements.activo.checked = Boolean(prod.activo);
  } else {
    formProducto.elements.activo.checked = true;
  }

  dlgProducto.showModal();
}

// Guarda un producto nuevo (POST) o actualiza uno existente (PUT)
formProducto.addEventListener('submit', async (e) => {
  e.preventDefault();

  const datos = validateForm(formProducto, {
    nombre: [rule.required, rule.min(2), rule.max(120)],
    marca: [rule.required, rule.max(60)],
    categoriaId: [rule.required],
    precio: [rule.number(0.01, 100000)],
    stock: [rule.integer(0, 100000)],
    tipoPiel: [rule.required],
    imagenUrl: [rule.imageUrl],
    descripcion: [rule.max(2000)]
  });
  if (!datos) return;

  const cuerpo = {
    nombre: datos.nombre,
    marca: datos.marca,
    categoriaId: Number(datos.categoriaId),
    precio: Number(datos.precio),
    stock: Number(datos.stock),
    tipoPiel: datos.tipoPiel,
    imagenUrl: datos.imagenUrl,
    descripcion: datos.descripcion,
    activo: formProducto.elements.activo.checked
  };

  const id = formProducto.dataset.id;

  try {
    await api(id ? `/admin/products/${id}` : '/admin/products', {
      method: id ? 'PUT' : 'POST',
      body: cuerpo
    });
    dlgProducto.close();
    toast('Producto guardado');
    await Promise.all([loadProductos(), loadStats()]);
  } catch (err) {
    toast(errMsg(err), 'err');
  }
});

function bindProductos() {
  $('#btn-nuevo').addEventListener('click', () => openForm(null));
  $('#p-filter').addEventListener('input', renderProductos);

  $('#tbl-productos').addEventListener('click', async (e) => {
    const boton = e.target.closest('button');
    if (!boton) return;

    try {
      // Botón Editar
      if (boton.dataset.edit) {
        const prod = productos.find((p) => p.id === Number(boton.dataset.edit));
        if (prod) openForm(prod);
        return;
      }

      // Botón Activar / Desactivar
      if (boton.dataset.toggle) {
        const prod = productos.find((p) => p.id === Number(boton.dataset.toggle));
        if (!prod) return;

        await api(`/admin/products/${prod.id}`, {
          method: 'PUT',
          body: {
            nombre: prod.nombre,
            marca: prod.marca,
            categoriaId: prod.categoriaId,
            precio: prod.precio,
            stock: prod.stock,
            tipoPiel: prod.tipoPiel,
            imagenUrl: prod.imagenUrl || '',
            descripcion: prod.descripcion || '',
            activo: !prod.activo
          }
        });

        toast(prod.activo ? 'Producto desactivado' : 'Producto activado');
        await Promise.all([loadProductos(), loadStats()]);
        return;
      }

      // Botón Guardar stock rápido
      if (boton.dataset.stockSave) {
        const id = Number(boton.dataset.stockSave);
        const input = $(`[data-stock-input="${id}"]`);
        const stock = Number(input.value);

        if (!Number.isInteger(stock) || stock < 0 || stock > 100000) {
          toast('El stock debe ser un número entero entre 0 y 100000', 'err');
          return;
        }

        await api(`/admin/products/${id}/stock`, {
          method: 'PATCH',
          body: { stock }
        });

        toast('Stock actualizado');
        await Promise.all([loadProductos(), loadStats()]);
      }
    } catch (err) {
      toast(errMsg(err), 'err');
    }
  });
}

/* ---------------- PEDIDOS ---------------- */

async function loadPedidos() {
  try {
    const orders = await api('/admin/orders');

    if (!orders.length) {
      $('#tbl-pedidos').innerHTML = `
        <thead><tr><th>Pedido</th><th>Cliente</th><th>Fecha</th><th>Artículos</th><th>Total</th><th>Estado</th><th></th></tr></thead>
        <tbody><tr><td colspan="7" class="muted">Aún no hay pedidos.</td></tr></tbody>`;
      return;
    }

    const filas = orders.map((o) => {
      const opcionesEstado = ESTADOS
        .map((estado) => `<option value="${estado}" ${estado === o.estado ? 'selected' : ''}>${estado}</option>`)
        .join('');

      return `
        <tr>
          <td>#${o.id}</td>
          <td>${esc(o.cliente)}<br><small class="muted">${esc(o.email)}</small></td>
          <td>${esc(fecha(o.fecha))}</td>
          <td>${o.articulos}</td>
          <td>${money(o.total)}</td>
          <td>
            <select data-status="${o.id}" aria-label="Estado del pedido ${o.id}" ${o.estado === 'cancelado' ? 'disabled' : ''}>
              ${opcionesEstado}
            </select>
          </td>
          <td><button class="btn btn-ghost btn-sm" type="button" data-detail="${o.id}">Ver detalle</button></td>
        </tr>`;
    });

    $('#tbl-pedidos').innerHTML = `
      <thead><tr><th>Pedido</th><th>Cliente</th><th>Fecha</th><th>Artículos</th><th>Total</th><th>Estado</th><th></th></tr></thead>
      <tbody>${filas.join('')}</tbody>`;
  } catch (e) {
    toast(errMsg(e), 'err');
  }
}

function bindPedidos() {
  const tabla = $('#tbl-pedidos');

  // Cambiar estado de un pedido
  tabla.addEventListener('change', async (e) => {
    const select = e.target.closest('[data-status]');
    if (!select) return;

    if (select.value === 'cancelado') {
      const confirmar = confirm('Cancelar el pedido devolverá el stock y no se podrá revertir. ¿Continuar?');
      if (!confirmar) {
        await loadPedidos();
        return;
      }
    }

    try {
      await api(`/admin/orders/${select.dataset.status}/status`, {
        method: 'PATCH',
        body: { estado: select.value }
      });
      toast('Estado actualizado');
      await Promise.all([loadPedidos(), loadStats(), loadProductos()]);
    } catch (err) {
      toast(errMsg(err), 'err');
    }
  });

  // Ver detalle de un pedido
  tabla.addEventListener('click', async (e) => {
    const boton = e.target.closest('[data-detail]');
    if (!boton) return;

    try {
      const o = await api(`/admin/orders/${boton.dataset.detail}`);
      const filasItems = o.items
        .map((i) => `<tr><td>${esc(i.producto)}</td><td>${i.cantidad}</td><td>${money(i.precio)}</td><td>${money(i.precio * i.cantidad)}</td></tr>`)
        .join('');

      const textoPago = o.referencia
        ? `Tarjeta •••• ${esc(o.ultimos4)} · ${esc(o.referencia)}`
        : 'Sin pago registrado';

      $('#pedido-detalle').innerHTML = `
        <h2>Pedido #${o.id}</h2>
        <dl class="kv">
          <dt>Cliente</dt><dd>${esc(o.cliente)} (${esc(o.email)})</dd>
          <dt>Fecha</dt><dd>${esc(fecha(o.fecha))}</dd>
          <dt>Estado</dt><dd>${esc(o.estado)}</dd>
          <dt>Envío a</dt><dd>${esc(o.direccion)}, ${esc(o.ciudad)} · ${esc(o.telefono)}</dd>
          <dt>Pago</dt><dd>${textoPago}</dd>
        </dl>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Producto</th><th>Cant.</th><th>Precio</th><th>Subtotal</th></tr></thead>
            <tbody>${filasItems}</tbody>
          </table>
        </div>
        <p class="row"><span>Subtotal ${money(o.subtotal)} · Envío ${money(o.envio)}</span><strong>Total ${money(o.total)}</strong></p>`;

      $('#dlg-pedido').showModal();
    } catch (err) {
      toast(errMsg(err), 'err');
    }
  });
}

/* ---------------- CLIENTES ---------------- */

async function loadClientes() {
  try {
    const list = await api('/admin/customers');

    if (!list.length) {
      $('#tbl-clientes').innerHTML = `
        <thead><tr><th>ID</th><th>Cliente</th><th>Teléfono</th><th>Registro</th><th>Pedidos</th><th>Gastado</th><th>Estado</th></tr></thead>
        <tbody><tr><td colspan="7" class="muted">Aún no hay clientes registrados.</td></tr></tbody>`;
      return;
    }

    const filas = list.map((c) => `
      <tr>
        <td>${c.id}</td>
        <td>${esc(c.nombre)}<br><small class="muted">${esc(c.email)}</small></td>
        <td>${esc(c.telefono) || '—'}</td>
        <td>${esc(fecha(c.fechaRegistro))}</td>
        <td>${c.pedidos}</td>
        <td>${money(c.gastado)}</td>
        <td><span class="tag ${c.activo ? 'tag-ok' : 'tag-out'}">${c.activo ? 'Activo' : 'Inactivo'}</span></td>
      </tr>`);

    $('#tbl-clientes').innerHTML = `
      <thead><tr><th>ID</th><th>Cliente</th><th>Teléfono</th><th>Registro</th><th>Pedidos</th><th>Gastado</th><th>Estado</th></tr></thead>
      <tbody>${filas.join('')}</tbody>`;
  } catch (e) {
    toast(errMsg(e), 'err');
  }
}

/* ---------------- PESTAÑAS Y ARRANQUE ---------------- */

function bindTabs() {
  const loaders = {
    productos: loadProductos,
    pedidos: loadPedidos,
    clientes: loadClientes
  };

  $$('.tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      const pestanaActiva = tab.dataset.tab;
      $$('.tab').forEach((t) => {
        const esEsta = t === tab;
        t.classList.toggle('active', esEsta);
        t.setAttribute('aria-selected', esEsta);
      });

      for (const nombre of Object.keys(loaders)) {
        $(`#tab-${nombre}`).hidden = nombre !== pestanaActiva;
      }

      loaders[pestanaActiva]();
    });
  });

  $$('[data-close]').forEach((b) => {
    b.addEventListener('click', () => b.closest('dialog').close());
  });
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

const user = await currentUser();
if (!user || user.rol !== 'admin') {
  location.replace('/login.html?next=' + encodeURIComponent('/admin/'));
} else {
  await main().catch((e) => toast(errMsg(e), 'err'));
}