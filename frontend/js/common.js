// Atajos para buscar elementos en el HTML
export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

// Limpia textos antes de mostrarlos en el HTML
export function esc(valor) {
  const texto = String(valor ?? '');
  const reemplazos = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return texto.replace(/[&<>"']/g, (caracter) => reemplazos[caracter]);
}

// Formatea números a dólares (ej: 15 -> $15.00)
const formatoMoneda = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export function money(monto) {
  return formatoMoneda.format(Number(monto) || 0);
}

// Convierte una fecha a texto legible en español
export function fecha(iso) {
  return new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
}

// Espera unos milisegundos antes de ejecutar algo (sirve para el buscador)
export function debounce(fn, ms = 300) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

// Costos de envío (deben coincidir con el backend)
export const ENVIO_COSTO = 4.99;
export const ENVIO_GRATIS_DESDE = 50;

export function calcEnvio(subtotal) {
  if (subtotal <= 0 || subtotal >= ENVIO_GRATIS_DESDE) return 0;
  return ENVIO_COSTO;
}

// ---------------- CONEXIÓN CON EL SERVIDOR ----------------

export async function api(ruta, opciones = {}) {
  const config = { method: opciones.method || 'GET' };

  if (opciones.body) {
    config.headers = { 'Content-Type': 'application/json' };
    config.body = JSON.stringify(opciones.body);
  }

  const respuesta = await fetch('/api' + ruta, config);
  const datos = respuesta.status !== 204 ? await respuesta.json().catch(() => null) : null;

  if (!respuesta.ok) {
    const err = new Error((datos && datos.error) || 'Error de servidor');
    err.status = respuesta.status;
    err.details = datos ? datos.details : null;
    throw err;
  }

  return datos;
}

export function errMsg(err) {
  if (err.details && err.details.length > 0) {
    return `${err.message}: ${err.details.map((d) => d.mensaje).join('; ')}`;
  }
  return err.message || 'Ocurrió un error';
}

// ---------------- SESIÓN DE USUARIO ----------------

let promesaUsuario = null;

export function currentUser(forzar = false) {
  if (!promesaUsuario || forzar) {
    promesaUsuario = api('/auth/me').catch(() => null);
  }
  return promesaUsuario;
}

export async function requireLogin(siguientePagina) {
  const user = await currentUser();
  if (!user) {
    window.location.replace('/login.html?next=' + encodeURIComponent(siguientePagina));
  }
  return user;
}

// ---------------- CARRITO DE COMPRAS ----------------

const CLAVE_CARRITO = 'glow_cart';

export const cart = {
  get() {
    try {
      const raw = JSON.parse(localStorage.getItem(CLAVE_CARRITO));
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((item) => item && Number(item.id) > 0 && Number(item.cantidad) > 0)
        .map((item) => ({ id: Number(item.id), cantidad: Number(item.cantidad) }));
    } catch {
      return [];
    }
  },

  save(items) {
    try {
      localStorage.setItem(CLAVE_CARRITO, JSON.stringify(items));
    } catch {
      // Ignora si el navegador bloquea el almacenamiento
    }
    document.dispatchEvent(new CustomEvent('cart:change'));
  },

  add(id, cantidad = 1) {
    const items = this.get();
    const existente = items.find((i) => i.id === id);
    if (existente) {
      existente.cantidad += cantidad;
    } else {
      items.push({ id, cantidad });
    }
    this.save(items);
  },

  setQty(id, cantidad) {
    const items = this.get()
      .map((item) => (item.id === id ? { id: item.id, cantidad } : item))
      .filter((item) => item.cantidad > 0);
    this.save(items);
  },

  remove(id) {
    this.save(this.get().filter((i) => i.id !== id));
  },

  clear() {
    this.save([]);
  },

  count() {
    return this.get().reduce((acc, item) => acc + item.cantidad, 0);
  }
};

// ---------------- IMÁGENES Y ETIQUETAS ----------------

export function imgFor(producto) {
  if (producto.imagenUrl) return producto.imagenUrl;
  const tono = (330 + ((producto.id * 23) % 70)) % 360;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">` +
    `<rect width="400" height="400" fill="hsl(${tono},45%,89%)"/>` +
    `<circle cx="200" cy="205" r="92" fill="hsl(${tono},40%,80%)"/>` +
    `<circle cx="200" cy="205" r="64" fill="hsl(${tono},48%,72%)"/>` +
    `<circle cx="176" cy="180" r="16" fill="white" fill-opacity=".45"/></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

export function stockTag(stock) {
  if (stock < 1) return '<span class="tag tag-out">Agotado</span>';
  if (stock <= 5) return '<span class="tag tag-low">Últimas unidades</span>';
  return '';
}

// ---------------- NOTIFICACIONES FLOTANTES ----------------

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

  setTimeout(() => aviso.remove(), 4500);
}

// ---------------- VALIDACIONES SENCILLAS ----------------

export const rule = {
  required: (v) => (v ? null : 'Este campo es obligatorio'),
  min: (n) => (v) => (v.length >= n ? null : `Escribe al menos ${n} caracteres`),
  max: (n) => (v) => (v.length <= n ? null : `Máximo ${n} caracteres`),
  same: (campoOtro, msg) => (v, datos) => (v === datos[campoOtro] ? null : msg),
  email: (v) => (v.includes('@') && v.includes('.') ? null : 'Correo inválido'),
  // Teléfono opcional: si va vacío pasa; si escriben algo, debe tener 8 dígitos
  phone: (v) => {
    if (!v) return null;
    const soloNumeros = v.replace(/\D/g, '');
    return soloNumeros.length === 8 ? null : 'Ingresa un teléfono de 8 dígitos';
  },
  // Tarjeta: acepta entre 13 y 16 números (con espacios llega hasta 19 caracteres)
  cardNumber: (v) => {
    const soloNumeros = v.replace(/\s/g, '');
    return soloNumeros.length >= 13 && soloNumeros.length <= 16
      ? null
      : 'Ingresa los dígitos de la tarjeta (16 números)';
  },
  // Fecha MM/AA con mes entre 01 y 12
  expiry: (v) => {
    const partes = v.split('/');
    const mes = Number(partes[0]);
    return partes.length === 2 && partes[0].length === 2 && partes[1].length === 2 && mes >= 1 && mes <= 12
      ? null
      : 'Usa el formato MM/AA';
  },
  cvv: (v) => (v.length >= 3 && v.length <= 4 ? null : 'Ingresa 3 o 4 dígitos de CVV'),
  number: (min, max) => (v) => {
    const n = Number(v);
    return v !== '' && !Number.isNaN(n) && n >= min && n <= max ? null : `Debe estar entre ${min} y ${max}`;
  },
  integer: (min, max) => (v) => {
    const n = Number(v);
    return v !== '' && Number.isInteger(n) && n >= min && n <= max ? null : `Ingresa un entero entre ${min} y ${max}`;
  }
};

export function validateForm(form, reglasPorCampo) {
  const valores = {};
  let esValido = true;
  let primerErrorEl = null;

  for (const [campo, validaciones] of Object.entries(reglasPorCampo)) {
    const input = form.elements[campo];
    const valor = (input ? input.value : '').trim();
    valores[campo] = valor;

    let mensajeError = '';
    for (const validar of validaciones) {
      const error = validar(valor, valores);
      if (error) {
        mensajeError = error;
        break;
      }
    }

    const etiquetaError = form.querySelector(`[data-err-for="${campo}"]`);
    if (etiquetaError) etiquetaError.textContent = mensajeError;

    if (input) {
      input.classList.toggle('invalid', Boolean(mensajeError));
      input.setAttribute('aria-invalid', mensajeError ? 'true' : 'false');
    }

    if (mensajeError) {
      esValido = false;
      if (!primerErrorEl) primerErrorEl = input;
    }
  }

  if (primerErrorEl) primerErrorEl.focus();
  return esValido ? valores : null;
}

// ---------------- ENCABEZADO Y PIE DE PÁGINA ----------------

export async function renderLayout() {
  const user = await currentUser();
  const header = document.getElementById('site-header');

  let enlacesSesion = '<a class="btn btn-ghost btn-sm" href="/login.html">Ingresar</a>';
  let enlacePedidos = '';
  let enlaceAdmin = '';

  if (user) {
    enlacePedidos = '<a href="/pedidos.html">Mis pedidos</a>';
    enlacesSesion = `<span class="hello">Hola, ${esc(user.nombre)}</span><button class="btn btn-ghost btn-sm" id="logout-btn" type="button">Salir</button>`;
    if (user.rol === 'admin') {
      enlaceAdmin = '<a href="/admin/">Administración</a>';
    }
  }

  if (header) {
    header.innerHTML = `
      <div class="container nav">
        <a class="brand" href="/index.html">Glow</a>
        <nav aria-label="Principal">
          <a href="/index.html">Tienda</a>
          ${enlacePedidos}
          ${enlaceAdmin}
          <a href="/carrito.html">Carrito <span class="badge" id="cart-count">0</span></a>
          ${enlacesSesion}
        </nav>
      </div>
    `;
  }

  const actualizarContador = () => {
    const badge = document.getElementById('cart-count');
    if (badge) badge.textContent = cart.count();
  };

  actualizarContador();
  document.addEventListener('cart:change', actualizarContador);

  const botonSalir = document.getElementById('logout-btn');
  if (botonSalir) {
    botonSalir.addEventListener('click', async () => {
      await api('/auth/logout', { method: 'POST' }).catch(() => {});
      window.location.href = '/index.html';
    });
  }

  const footer = document.getElementById('site-footer');
  if (footer) {
    footer.textContent = 'Glow · Proyecto de demostración. Los pagos son simulados y no se realiza ningún cobro.';
  }
}