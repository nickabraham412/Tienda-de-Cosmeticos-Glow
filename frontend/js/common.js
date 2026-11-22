// atajos para buscar elementos en el html (los dejo por si otras paginas los usan)
export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

// limpia textos antes de meterlos al html para evitar que inyecten codigo raro
export function esc(v) {
  const texto = String(v ?? '');
  return texto.replace(/[&<>"']/g, function(c) {
    const mapa = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return mapa[c];
  });
}

// formatea numeros a dolares (ej: 15 -> $15.00)
const formatoMoneda = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export function money(n) {
  return formatoMoneda.format(Number(n) || 0);
}

// convierte la fecha de sql a un formato legible en español
export function fecha(iso) {
  return new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
}

// espera unos milisegundos antes de ejecutar algo (sirve para el buscador de la tienda)
export function debounce(fn, ms = 300) {
  let temporizador;
  return function(...args) {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => fn(...args), ms);
  };
}

// costos de envio (tienen que ser iguales a los del backend)
export const ENVIO_COSTO = 4.99;
export const ENVIO_GRATIS_DESDE = 50;

export function calcEnvio(subtotal) {
  if (subtotal <= 0 || subtotal >= ENVIO_GRATIS_DESDE) {
    return 0;
  }
  return ENVIO_COSTO;
}

// ---------------- CONEXION CON EL SERVIDOR (API) ----------------

// funcion principal que habla con node.js y sql server
export async function api(path, opciones = {}) {
  const metodo = opciones.method || 'GET';
  const cuerpo = opciones.body;

  const config = { method: metodo };
  if (cuerpo) {
    config.headers = { 'Content-Type': 'application/json' };
    config.body = JSON.stringify(cuerpo);
  }

  const respuesta = await fetch('/api' + path, config);
  
  let datos = null;
  if (respuesta.status !== 204) {
    datos = await respuesta.json().catch(() => null);
  }

  // si el servidor responde con error (400, 401, 500...) lanzamos el mensaje
  if (!respuesta.ok) {
    const error = new Error((datos && datos.error) || 'Error de servidor');
    error.status = respuesta.status;
    error.details = datos ? datos.details : null;
    throw error;
  }

  return datos;
}

// saca el texto limpio de un error para mostrarlo en pantalla
export function errMsg(e) {
  if (e.details && e.details.length > 0) {
    const lista = e.details.map((d) => d.mensaje).join('; ');
    return `${e.message}: ${lista}`;
  }
  return e.message || 'Ocurrió un error';
}

// ---------------- SESION DE USUARIO ----------------

let promesaUsuario = null;

// pregunta al backend quien esta logueado ahorita
export function currentUser(forzar = false) {
  if (!promesaUsuario || forzar) {
    promesaUsuario = api('/auth/me').catch(() => null);
  }
  return promesaUsuario;
}

// protege paginas privadas: si no hay sesion te manda al login
export async function requireLogin(siguientePagina) {
  const user = await currentUser();
  if (!user) {
    window.location.replace('/login.html?next=' + encodeURIComponent(siguientePagina));
  }
  return user;
}

// ---------------- CARRITO DE COMPRAS ----------------

const CLAVE_CARRITO = 'glow_cart';

// guarda solo id y cantidad en localStorage del navegador
export const cart = {
  get() {
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE_CARRITO));
      if (!Array.isArray(guardado)) return [];

      const listaLimpia = [];
      for (const item of guardado) {
        if (item && item.id > 0 && item.cantidad > 0) {
          listaLimpia.push({ id: Number(item.id), cantidad: Number(item.cantidad) });
        }
      }
      return listaLimpia;
    } catch {
      return [];
    }
  },

  save(items) {
    try {
      localStorage.setItem(CLAVE_CARRITO, JSON.stringify(items));
    } catch {
      // por si el navegador bloquea el almacenamiento
    }
    // avisa al menu de arriba que el numero del carrito cambio
    document.dispatchEvent(new CustomEvent('cart:change'));
  },

  add(id, cantidadAgregar = 1) {
    const items = this.get();
    const existente = items.find((i) => i.id === id);

    if (existente) {
      existente.cantidad += cantidadAgregar;
    } else {
      items.push({ id: id, cantidad: cantidadAgregar });
    }
    this.save(items);
  },

  setQty(id, nuevaCantidad) {
    const items = this.get();
    const actualizados = [];

    for (const item of items) {
      if (item.id === id) {
        if (nuevaCantidad > 0) actualizados.push({ id: item.id, cantidad: nuevaCantidad });
      } else {
        actualizados.push(item);
      }
    }
    this.save(actualizados);
  },

  remove(id) {
    const filtrados = this.get().filter((i) => i.id !== id);
    this.save(filtrados);
  },

  clear() {
    this.save([]);
  },

  count() {
    let total = 0;
    for (const item of this.get()) {
      total += item.cantidad;
    }
    return total;
  }
};

// ---------------- IMAGENES Y ETIQUETAS ----------------

// si un producto no tiene foto le crea un circulo de color pastel para que no se vea roto
export function imgFor(p) {
  if (p.imagenUrl) return p.imagenUrl;
  const hue = (330 + ((p.id * 23) % 70)) % 360;
  const svg =
    `<svg xmlns='http://w3.org' width='400' height='400'>` +
    `<rect width='400' height='400' fill='hsl(${hue},45%,89%)'/>` +
    `<circle cx='200' cy='205' r='92' fill='hsl(${hue},40%,80%)'/>` +
    `<circle cx='200' cy='205' r='64' fill='hsl(${hue},48%,72%)'/>` +
    `<circle cx='176' cy='180' r='16' fill='white' fill-opacity='.45'/></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

// pone la etiquetita de agotado o ultimas unidades
export function stockTag(stock) {
  if (stock < 1) return '<span class="tag tag-out">Agotado</span>';
  if (stock <= 5) return '<span class="tag tag-low">Últimas unidades</span>';
  return '';
}

// ---------------- NOTIFICACIONES FLOTANTES (TOAST) ----------------

export function toast(mensaje, tipo = 'ok') {
  let caja = document.getElementById('toasts');
  if (!caja) {
    caja = document.createElement('div');
    caja.id = 'toasts';
    caja.setAttribute('role', 'status');
    caja.setAttribute('aria-live', 'polite');
    document.body.append(caja);
  }

  const aviso = document.createElement('div');
  aviso.className = tipo === 'err' ? 'toast err' : 'toast';
  aviso.textContent = mensaje;
  caja.append(aviso);

  // se borra solo despues de 4 segundos y medio
  setTimeout(() => aviso.remove(), 4500);
}

// ---------------- VALIDACION DE FORMULARIOS ----------------

// reglas reutilizables para revisar inputs en registro, login y pago
export const rule = {
  required: (v) => (v ? null : 'Este campo es obligatorio'),
  min: (n) => (v) => (v.length >= n ? null : `Mínimo ${n} caracteres`),
  max: (n) => (v) => (v.length <= n ? null : `Máximo ${n} caracteres`),
  match: (re, msg) => (v) => (re.test(v) ? null : msg),
  same: (other, msg) => (v, data) => (v === data[other] ? null : msg),
  email: (v) => (v.includes('@') && v.includes('.') ? null : 'Correo electrónico inválido'),
  number: (min, max) => (v) => {
    const n = Number(v);
    return v !== '' && n >= min && n <= max ? null : `Ingresa un número entre ${min} y ${max}`;
  },
  integer: (min, max) => (v) => {
    const n = Number(v);
    return v !== '' && Number.isInteger(n) && n >= min && n <= max ? null : `Ingresa un entero entre ${min} y ${max}`;
  },
  // validacion simple de tarjeta: solo revisa que sean 16 numeros (acepta ficticias)
  luhn: (v) => {
    const num = v.replace(/\s/g, '');
    return /^\d{16}$/.test(num) ? null : 'Ingresa los 16 dígitos de la tarjeta';
  },
  // revisa que tenga 5 caracteres con pleca en medio (ej: 08/28)
  expiry: (v) => {
    return v.length === 5 && v.includes('/') ? null : 'Usa el formato MM/AA';
  }
};

// revisa todo un formulario y pinta los errores debajo de cada campo
export function validateForm(form, rules) {
  const data = {};
  let todoBien = true;
  let primerMalo = null;

  for (const [name, checks] of Object.entries(rules)) {
    const el = form.elements[name];
    const value = (el ? el.value : '').trim();
    data[name] = value;

    // busca si alguna regla dio error
    let mensajeError = '';
    for (const check of checks) {
      const res = check(value, data);
      if (res) {
        mensajeError = res;
        break;
      }
    }

    const slot = form.querySelector(`[data-err-for="${name}"]`);
    if (slot) slot.textContent = mensajeError;

    if (el) {
      el.classList.toggle('invalid', Boolean(mensajeError));
      el.setAttribute('aria-invalid', mensajeError ? 'true' : 'false');
    }

    if (mensajeError) {
      todoBien = false;
      if (!primerMalo) primerMalo = el;
    }
  }

  if (primerMalo) primerMalo.focus();
  return todoBien ? data : null;
}

// ---------------- MENU DE ARRIBA Y PIE DE PAGINA ----------------

export async function renderLayout() {
  const user = await currentUser();
  const header = document.getElementById('site-header');

  // armo los enlaces del menu segun si inicio sesion o si es admin
  let linksUsuario = '<a class="btn btn-ghost btn-sm" href="/login.html">Ingresar</a>';
  let linkPedidos = '';
  let linkAdmin = '';

  if (user) {
    linkPedidos = '<a href="/pedidos.html">Mis pedidos</a>';
    linksUsuario = `<span class="hello">Hola, ${esc(user.nombre)}</span><button class="btn btn-ghost btn-sm" id="logout-btn" type="button">Salir</button>`;
    if (user.rol === 'admin') {
      linkAdmin = '<a href="/admin/">Administración</a>';
    }
  }
  header.innerHTML = `
    <div class="container nav">
      <a class="brand" href="/index.html">Glow</a>
      <nav aria-label="Principal">
        <a href="/index.html">Tienda</a>
        ${linkPedidos}
        ${linkAdmin}
        <a href="/carrito.html">Carrito <span class="badge" id="cart-count">0</span></a>
        ${linksUsuario}
      </nav>
    </div>
  `;

  // actualiza el numerito del carrito cada vez que agregas o quitas algo
  function actualizarContadorCarrito() {
    const badge = document.getElementById('cart-count');
    if (badge) badge.textContent = cart.count();
  }
  actualizarContadorCarrito();
  document.addEventListener('cart:change', actualizarContadorCarrito);

  // boton de cerrar sesion
  const botonSalir = document.getElementById('logout-btn');
  if (botonSalir) {
    botonSalir.addEventListener('click', async function() {
      await api('/auth/logout', { method: 'POST' }).catch(() => {});
      window.location.href = '/index.html';
    });
  }

  const footer = document.getElementById('site-footer');
  if (footer) {
    footer.textContent = 'Glow · Proyecto de demostración. Los pagos son simulados y no se realiza ningún cobro.';
  }
}
