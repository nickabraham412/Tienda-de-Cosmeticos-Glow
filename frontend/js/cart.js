import { api, esc, money, imgFor, renderLayout, toast, errMsg, cart, calcEnvio } from '/js/common.js';

await renderLayout();

const contenedorCarrito = document.getElementById('cart');

// pide los datos reales de los productos que estan guardados en localStorage
async function cargarCarrito() {
  const itemsGuardados = cart.get();

  if (itemsGuardados.length === 0) {
    contenedorCarrito.innerHTML = '<p class="empty">Tu carrito está vacío. <a href="/index.html">Explorar productos</a></p>';
    return;
  }

  // junto todos los ids separados por coma (ej: 1,4,7) para pedirlos de un solo golpe
  const listaIds = [];
  for (const item of itemsGuardados) {
    listaIds.push(item.id);
  }

  let productosSql = [];
  try {
    productosSql = await api('/products/bulk?ids=' + listaIds.join(','));
  } catch (error) {
    contenedorCarrito.innerHTML = `<p class="empty">${esc(errMsg(error))}</p>`;
    return;
  }

  // revisa que cada producto siga existiendo y no pase del stock real
  const itemsValidos = [];
  let huboCambios = false;

  for (const item of itemsGuardados) {
    const producto = productosSql.find((p) => p.id === item.id);

    // si el producto ya no existe o se agoto, lo quitamos
    if (!producto || producto.stock < 1) {
      huboCambios = true;
      continue;
    }

    // si pidio mas de lo que hay en inventario, lo bajamos al maximo disponible
    let cantidadFinal = item.cantidad;
    if (cantidadFinal > producto.stock) {
      cantidadFinal = producto.stock;
      huboCambios = true;
    }

    itemsValidos.push({
      id: item.id,
      cantidad: cantidadFinal,
      datosProducto: producto
    });
  }

  // si se tuvo que corregir alguna cantidad, guardamos el carrito limpio
  if (huboCambios) {
    const soloIdsYCantidad = itemsValidos.map((i) => ({ id: i.id, cantidad: i.cantidad }));
    cart.save(soloIdsYCantidad);
    toast('Actualizamos tu carrito según el stock disponible');
  }

  dibujarCarrito(itemsValidos);
}

// arma las filas de productos y el cuadro del total a la derecha
function dibujarCarrito(itemsValidos) {
  if (itemsValidos.length === 0) {
    contenedorCarrito.innerHTML = '<p class="empty">Tu carrito está vacío. <a href="/index.html">Explorar productos</a></p>';
    return;
  }

  let subtotal = 0;
  let htmlFilas = '';

  for (const item of itemsValidos) {
    const p = item.datosProducto;
    const totalLinea = p.precio * item.cantidad;
    subtotal += totalLinea;

    // desactiva el boton + si ya llego al limite del stock
    const topeAlcanzado = item.cantidad >= p.stock ? 'disabled' : '';

    htmlFilas += `
      <div class="cart-row">
        <img src="${esc(imgFor(p))}" alt="" width="72" height="72">
        <div>
          <a href="/producto.html?id=${p.id}"><strong>${esc(p.nombre)}</strong></a><br>
          <small class="muted">${esc(p.marca)} · ${money(p.precio)} c/u</small><br>
          <button class="btn btn-ghost btn-sm btn-danger" type="button" data-remove="${p.id}">Quitar</button>
        </div>
        <div class="qty">
          <button type="button" data-dec="${p.id}">−</button>
          <span>${item.cantidad}</span>
          <button type="button" data-inc="${p.id}" ${topeAlcanzado}>+</button>
        </div>
        <strong>${money(totalLinea)}</strong>
      </div>
    `;
  }

  const envio = calcEnvio(subtotal);
  const textoEnvio = envio > 0 ? money(envio) : 'Gratis';
  const totalPagar = subtotal + envio;

  contenedorCarrito.innerHTML = `
    <div class="cart-layout">
      <div>${htmlFilas}</div>
      <aside class="summary">
        <h2>Resumen</h2>
        <div class="row"><span>Subtotal</span><span>${money(subtotal)}</span></div>
        <div class="row"><span>Envío</span><span>${textoEnvio}</span></div>
        <div class="row total"><span>Total</span><span>${money(totalPagar)}</span></div>
        <a class="btn btn-primary btn-block" href="/checkout.html">Continuar al pago</a>
      </aside>
    </div>
  `;
}

// detecta clics en los botones de +, - o Quitar
contenedorCarrito.addEventListener('click', function(e) {
  const boton = e.target.closest('button');
  if (!boton) return;

  const items = cart.get();

  if (boton.dataset.remove) {
    const id = Number(boton.dataset.remove);
    cart.remove(id);
    cargarCarrito();
    return;
  }

  if (boton.dataset.inc) {
    const id = Number(boton.dataset.inc);
    const actual = items.find((i) => i.id === id);
    const nuevaCant = (actual ? actual.cantidad : 0) + 1;
    cart.setQty(id, nuevaCant);
    cargarCarrito();
    return;
  }

  if (boton.dataset.dec) {
    const id = Number(boton.dataset.dec);
    const actual = items.find((i) => i.id === id);
    const nuevaCant = (actual ? actual.cantidad : 0) - 1;
    cart.setQty(id, nuevaCant);
    cargarCarrito();
  }
});

await cargarCarrito();
