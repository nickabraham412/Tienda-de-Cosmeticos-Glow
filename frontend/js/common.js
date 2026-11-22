/* Utilidades compartidas: API, sesión, carrito, validación de formularios y cabecera/pie. */

export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

// Escapa texto antes de insertarlo en innerHTML (prevención de XSS). Úsalo con TODO dato que venga de la API.
export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const fmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
export const money = (n) => fmt.format(Number(n) || 0);
export const fecha = (iso) => new Date(iso).toLocaleString('es', { dateStyle: 'medium', timeStyle: 'short' });
export const debounce = (fn, ms = 300) => {
  let t;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
};

// Debe coincidir con backend/src/config/constants.js (el servidor siempre recalcula el total real).
export const ENVIO_COSTO = 4.99;
export const ENVIO_GRATIS_DESDE = 50;
export const calcEnvio = (subtotal) => (subtotal <= 0 || subtotal >= ENVIO_GRATIS_DESDE ? 0 : ENVIO_COSTO);

/* ---------------- API ---------------- */
export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const data = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error || 'Error de servidor');
    err.status = res.status;
    err.details = data?.details;
    throw err;
  }
  return data;
}
export const errMsg = (e) =>
  e.details?.length ? `${e.message}: ${e.details.map((d) => d.mensaje).join('; ')}` : e.message || 'Ocurrió un error';

/* ---------------- Sesión ---------------- */
let mePromise;
export function currentUser(force = false) {
  if (!mePromise || force) mePromise = api('/auth/me').catch(() => null);
  return mePromise;
}
export async function requireLogin(next) {
  const user = await currentUser();
  if (!user) location.replace('/login.html?next=' + encodeURIComponent(next));
  return user;
}

/* ---------------- Carrito (localStorage: solo id + cantidad; el precio siempre viene del servidor) ---------------- */
const KEY = 'glow_cart';
const MAX = 20;
export const cart = {
  get() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (!Array.isArray(raw)) return [];
      return raw
        .filter((i) => Number.isInteger(i?.id) && i.id > 0 && Number.isInteger(i?.cantidad) && i.cantidad > 0)
        .map((i) => ({ id: i.id, cantidad: Math.min(i.cantidad, MAX) }));
    } catch { return []; }
  },
  save(items) {
    try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* almacenamiento no disponible */ }
    document.dispatchEvent(new CustomEvent('cart:change'));
  },
  add(id, n = 1) {
    const items = this.get();
    const it = items.find((i) => i.id === id);
    if (it) it.cantidad = Math.min(MAX, it.cantidad + n);
    else items.push({ id, cantidad: Math.min(MAX, n) });
    this.save(items);
  },
  setQty(id, n) {
    const items = this.get().map((i) => (i.id === id ? { ...i, cantidad: Math.min(MAX, n) } : i)).filter((i) => i.cantidad > 0);
    this.save(items);
  },
  remove(id) { this.save(this.get().filter((i) => i.id !== id)); },
  clear() { this.save([]); },
  count() { return this.get().reduce((a, i) => a + i.cantidad, 0); }
};

/* ---------------- Imagen de producto ---------------- */
// Sin imagen: tarjeta de color generada (tonos rosados/piel) para que el catálogo nunca quede vacío.
export function imgFor(p) {
  if (p.imagenUrl) return p.imagenUrl;
  const hue = (330 + ((p.id * 23) % 70)) % 360;
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'>` +
    `<rect width='400' height='400' fill='hsl(${hue},45%,89%)'/>` +
    `<circle cx='200' cy='205' r='92' fill='hsl(${hue},40%,80%)'/>` +
    `<circle cx='200' cy='205' r='64' fill='hsl(${hue},48%,72%)'/>` +
    `<circle cx='176' cy='180' r='16' fill='white' fill-opacity='.45'/></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}
export const stockTag = (s) =>
  s < 1 ? '<span class="tag tag-out">Agotado</span>' : s <= 5 ? '<span class="tag tag-low">Últimas unidades</span>' : '';

/* ---------------- Avisos ---------------- */
export function toast(msg, type = 'ok') {
  let box = $('#toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    box.setAttribute('role', 'status');
    box.setAttribute('aria-live', 'polite');
    document.body.append(box);
  }
  const t = document.createElement('div');
  t.className = 'toast' + (type === 'err' ? ' err' : '');
  t.textContent = msg; // textContent: nunca interpreta HTML
  box.append(t);
  setTimeout(() => t.remove(), 4500);
}

/* ---------------- Validación de formularios ---------------- */
// Cada regla recibe (valor, datosYaLeídos) y devuelve un mensaje de error o null.
export const rule = {
  required: (v) => (v ? null : 'Este campo es obligatorio'),
  min: (n) => (v) => (v.length >= n ? null : `Mínimo ${n} caracteres`),
  max: (n) => (v) => (v.length <= n ? null : `Máximo ${n} caracteres`),
  match: (re, msg) => (v) => (re.test(v) ? null : msg),
  same: (other, msg) => (v, data) => (v === data[other] ? null : msg),
  optional: (fn) => (v, d) => (v === '' ? null : fn(v, d)),
  email: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? null : 'Correo electrónico inválido'),
  phone: (v) => (/^[0-9+\-\s]{8,20}$/.test(v) ? null : 'Teléfono inválido (8 a 20 dígitos)'),
  number: (min, max) => (v) => {
    const n = Number(v);
    return v !== '' && Number.isFinite(n) && n >= min && n <= max ? null : `Ingresa un número entre ${min} y ${max}`;
  },
  integer: (min, max) => (v) => {
    const n = Number(v);
    return v !== '' && Number.isInteger(n) && n >= min && n <= max ? null : `Ingresa un entero entre ${min} y ${max}`;
  },
  luhn: (v) => {
    const num = v.replace(/\s/g, '');
    if (!/^\d{13,19}$/.test(num)) return 'Número de tarjeta inválido';
    let sum = 0, dbl = false;
    for (let i = num.length - 1; i >= 0; i--) {
      let d = Number(num[i]);
      if (dbl) { d *= 2; if (d > 9) d -= 9; }
      sum += d; dbl = !dbl;
    }
    return sum % 10 === 0 ? null : 'Número de tarjeta inválido';
  },
  expiry: (v) => {
    const m = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(v);
    if (!m) return 'Usa el formato MM/AA';
    return new Date(2000 + Number(m[2]), Number(m[1]), 1) > new Date() ? null : 'La tarjeta está vencida';
  }
};

/** Lee y valida un formulario. Pinta los errores junto a cada campo. Devuelve los datos o null. */
export function validateForm(form, rules) {
  const data = {};
  let ok = true;
  let firstBad = null;
  for (const [name, checks] of Object.entries(rules)) {
    const el = form.elements[name];
    const value = (el?.value ?? '').trim();
    data[name] = value;
    const failed = checks.map((c) => c(value, data)).find(Boolean) || '';
    const slot = form.querySelector(`[data-err-for="${name}"]`);
    if (slot) slot.textContent = failed;
    el?.classList.toggle('invalid', !!failed);
    el?.setAttribute('aria-invalid', failed ? 'true' : 'false');
    if (failed) { ok = false; firstBad ??= el; }
  }
  firstBad?.focus();
  return ok ? data : null;
}

/* ---------------- Cabecera y pie ---------------- */
export async function renderLayout() {
  const user = await currentUser();
  const header = $('#site-header');
  header.innerHTML = `
    <div class="container nav">
      <a class="brand" href="/index.html">Glow</a>
      <nav aria-label="Principal">
        <a href="/index.html">Tienda</a>
        ${user ? '<a href="/pedidos.html">Mis pedidos</a>' : ''}
        ${user?.rol === 'admin' ? '<a href="/admin/">Administración</a>' : ''}
        <a href="/carrito.html">Carrito <span class="badge" id="cart-count">0</span></a>
        ${user
          ? `<span class="hello">Hola, ${esc(user.nombre)}</span><button class="btn btn-ghost btn-sm" id="logout-btn" type="button">Salir</button>`
          : '<a class="btn btn-ghost btn-sm" href="/login.html">Ingresar</a>'}
      </nav>
    </div>`;
  const paint = () => { $('#cart-count').textContent = cart.count(); };
  paint();
  document.addEventListener('cart:change', paint);
  $('#logout-btn')?.addEventListener('click', async () => {
    await api('/auth/logout', { method: 'POST' }).catch(() => {});
    location.href = '/index.html';
  });
  const footer = $('#site-footer');
  if (footer) footer.textContent = 'Glow · Proyecto de demostración. Los pagos son simulados y no se realiza ningún cobro.';
}
