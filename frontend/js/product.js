import { api, esc, money, imgFor, stockTag, renderLayout, toast, cart } from '/js/common.js';

await renderLayout();

// agarro el div del html y saco el id que viene en el link
const contenedor = document.getElementById('product');
const parametrosUrl = new URLSearchParams(window.location.search);
const idProducto = Number(parametrosUrl.get('id'));

// pide el producto al servidor apenas abre la pagina
async function iniciarPagina() {
  if (!idProducto || idProducto < 1) {
    contenedor.innerHTML = '<p class="empty">El producto no es válido.</p>';
    return;
  }

  try {
    const producto = await api('/products/' + idProducto);
    mostrarProducto(producto);
  } catch (error) {
    contenedor.innerHTML = '<p class="empty">No se pudo cargar el producto.</p>';
  }
}

// mete los datos de sql en el html
function mostrarProducto(p) {
  document.title = p.nombre + ' · Glow';

  // si no hay stock bloqueo el boton
  let sinStock = '';
  let textoBoton = 'Añadir al carrito';
  if (p.stock < 1) {
    sinStock = 'disabled';
    textoBoton = 'Agotado';
  }

  contenedor.innerHTML = `
    <div class="detail-img">
      <img src="${esc(imgFor(p))}" alt="${esc(p.nombre)}" width="400" height="400">
    </div>
    <div>
      <p class="muted">${esc(p.marca)} · ${esc(p.categoria)}</p>
      <h1>${esc(p.nombre)}</h1>
      <p class="price">${money(p.precio)}</p>
      <p>${esc(p.descripcion) || 'Sin descripción.'}</p>
      <p><span class="tag">Piel ${esc(p.tipoPiel)}</span> ${stockTag(p.stock)}</p>
      
      <div class="buy">
        <input id="qty" type="number" min="1" max="${p.stock}" value="1" ${sinStock}>
        <button class="btn btn-primary" id="btn-agregar" type="button" ${sinStock}>
          ${textoBoton}
        </button>
      </div>
    </div>
  `;

  // evento para cuando le den clic a agregar
  const botonAgregar = document.getElementById('btn-agregar');
  botonAgregar.addEventListener('click', function() {
    agregarAlCarrito(p.id, p.stock);
  });
}

// revisa que la cantidad este bien y lo manda al carrito
function agregarAlCarrito(id, maximo) {
  const inputCantidad = document.getElementById('qty');
  const cantidad = Number(inputCantidad.value);

  if (cantidad < 1 || cantidad > maximo) {
    toast('Elige una cantidad entre 1 y ' + maximo, 'err');
    return;
  }

  cart.add(id, cantidad);
  toast('Producto añadido al carrito');
}

iniciarPagina();
