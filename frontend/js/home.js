import { api, esc, money, imgFor, stockTag, renderLayout, toast, errMsg, cart, debounce } from '/js/common.js';

await renderLayout();

const cuadricula = document.getElementById('grid');
const paginador = document.getElementById('pager');
const textoResultados = document.getElementById('results-info');

// guarda los filtros actuales que eligio el usuario
const filtros = {
  q: '',
  categoria: '',
  orden: 'nuevos',
  pagina: 1
};

// arma el html de una sola tarjeta de producto
function crearTarjetaProducto(p) {
  let sinStock = '';
  let textoBoton = 'Añadir al carrito';
  if (p.stock < 1) {
    sinStock = 'disabled';
    textoBoton = 'Agotado';
  }

  return `
    <article class="card">
      <a class="card-img" href="/producto.html?id=${p.id}">
        <img src="${esc(imgFor(p))}" alt="${esc(p.nombre)}" loading="lazy" width="400" height="400">
      </a>
      <div class="card-body">
        <small class="muted">${esc(p.marca)} · ${esc(p.categoria)}</small>
        <h3><a href="/producto.html?id=${p.id}">${esc(p.nombre)}</a></h3>
        <div class="row">
          <span class="price">${money(p.precio)}</span>
          ${stockTag(p.stock)}
        </div>
        <button class="btn btn-primary btn-block" type="button" data-add="${p.id}" ${sinStock}>
          ${textoBoton}
        </button>
      </div>
    </article>
  `;
}

// pide los productos filtrados al servidor y los dibuja
async function cargarProductos() {
  const parametros = new URLSearchParams({
    orden: filtros.orden,
    pagina: filtros.pagina,
    limite: 12
  });

  if (filtros.q) parametros.set('q', filtros.q);
  if (filtros.categoria) parametros.set('categoria', filtros.categoria);

  try {
    const respuesta = await api('/products?' + parametros);
    const items = respuesta.items;
    const total = respuesta.total;
    const paginas = respuesta.paginas;

    // muestra cuantos productos encontro
    if (total === 1) {
      textoResultados.textContent = '1 producto';
    } else {
      textoResultados.textContent = total + ' productos';
    }

    // pinta las tarjetas en la cuadricula
    if (items.length === 0) {
      cuadricula.innerHTML = '<p class="empty">No encontramos productos con esos filtros. Prueba con otra búsqueda o categoría.</p>';
    } else {
      let htmlTarjetas = '';
      for (const producto of items) {
        htmlTarjetas += crearTarjetaProducto(producto);
      }
      cuadricula.innerHTML = htmlTarjetas;
    }

    // dibuja los botones de paginacion (1, 2, 3...)
    dibujarPaginacion(paginas);
  } catch (error) {
    toast(errMsg(error), 'err');
  }
}

// crea los botones numericos abajo si hay mas de una pagina
function dibujarPaginacion(totalPaginas) {
  if (totalPaginas <= 1) {
    paginador.innerHTML = '';
    return;
  }

  let htmlBotones = '';
  for (let i = 1; i <= totalPaginas; i++) {
    const clase = i === filtros.pagina ? 'btn-primary' : 'btn-ghost';
    htmlBotones += `<button class="btn btn-sm ${clase}" type="button" data-page="${i}">${i}</button>`;
  }
  paginador.innerHTML = htmlBotones;
}

// llena el select de categorias desde sql server
async function cargarCategorias() {
  try {
    const categorias = await api('/categories');
    const selectCat = document.getElementById('f-cat');
    for (const cat of categorias) {
      selectCat.innerHTML += `<option value="${cat.id}">${esc(cat.nombre)}</option>`;
    }
  } catch {
    // si fallan las categorias igual se muestran los productos
  }
}

// eventos cuando escriben en el buscador o cambian los filtros
const inputBuscar = document.getElementById('f-q');
inputBuscar.addEventListener('input', debounce(function(e) {
  filtros.q = e.target.value.trim();
  filtros.pagina = 1;
  cargarProductos();
}));

const selectCategoria = document.getElementById('f-cat');
selectCategoria.addEventListener('change', function(e) {
  filtros.categoria = e.target.value;
  filtros.pagina = 1;
  cargarProductos();
});

const selectOrden = document.getElementById('f-orden');
selectOrden.addEventListener('change', function(e) {
  filtros.orden = e.target.value;
  filtros.pagina = 1;
  cargarProductos();
});

// clic en los botones de pagina (1, 2, 3...)
paginador.addEventListener('click', function(e) {
  const boton = e.target.closest('[data-page]');
  if (!boton) return;
  filtros.pagina = Number(boton.dataset.page);
  cargarProductos();
  window.scrollTo({ top: 0 });
});

// clic en "Añadir al carrito" desde cualquier tarjeta
cuadricula.addEventListener('click', function(e) {
  const boton = e.target.closest('[data-add]');
  if (!boton) return;
  const idProducto = Number(boton.dataset.add);
  cart.add(idProducto);
  toast('Producto añadido al carrito');
});

// arranca todo al abrir la tienda
await cargarCategorias();
await cargarProductos();
