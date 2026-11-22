import { api, esc, money, fecha, renderLayout, requireLogin, errMsg } from '/js/common.js';

await renderLayout();

// pide los pedidos del usuario logueado a sql server
async function cargarPedidos() {
  // si no ha iniciado sesion lo manda al login y despues lo regresa aqui
  const usuario = await requireLogin('/pedidos.html');
  if (!usuario) return;

  const cajaPedidos = document.getElementById('orders');

  try {
    const listaPedidos = await api('/orders/mine');
    mostrarPedidos(listaPedidos, cajaPedidos);
  } catch (error) {
    cajaPedidos.innerHTML = `<p class="empty">${esc(errMsg(error))}</p>`;
  }
}

// recorre cada pedido y arma su tarjeta en el html
function mostrarPedidos(listaPedidos, cajaPedidos) {
  if (listaPedidos.length === 0) {
    cajaPedidos.innerHTML = '<p class="empty">Aún no tienes pedidos. <a href="/index.html">Descubre la tienda</a></p>';
    return;
  }

  let htmlFinal = '';

  // recorro pedido por pedido
  for (const pedido of listaPedidos) {
    // armo la lista de productos de este pedido
    let htmlProductos = '';
    for (const item of pedido.items) {
      const subtotal = item.precio * item.cantidad;
      htmlProductos += `<li>${item.cantidad} × ${esc(item.producto)} — ${money(subtotal)}</li>`;
    }

    // junto toda la tarjeta del pedido
    htmlFinal += `
      <article class="order">
        <div class="row">
          <strong>Pedido #${pedido.id}</strong>
          <span class="tag">${esc(pedido.estado)}</span>
        </div>
        <small class="muted">${esc(fecha(pedido.fecha))}</small>
        <ul>${htmlProductos}</ul>
        <p class="row">
          <span>Total</span>
          <strong>${money(pedido.total)}</strong>
        </p>
      </article>
    `;
  }

  cajaPedidos.innerHTML = htmlFinal;
}

cargarPedidos();
