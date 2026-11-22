import { $, api, renderLayout, toast, errMsg, validateForm, rule, currentUser } from '/js/common.js';

await renderLayout();

// Solo se aceptan rutas internas en ?next= (evita redirecciones abiertas a otros sitios)
function destino(user) {
  const next = new URLSearchParams(location.search).get('next');
  const permitido = next && /^\/(?!\/)[\w\-/.]*$/.test(next) && (user.rol === 'admin' || !next.startsWith('/admin'));
  if (permitido) return next;
  return user.rol === 'admin' ? '/admin/' : '/index.html';
}

const loginForm = $('#login-form');
loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const d = validateForm(loginForm, { email: [rule.required, rule.email], password: [rule.required] });
  if (!d) return;
  try {
    const user = await api('/auth/login', { method: 'POST', body: { email: d.email, password: loginForm.elements.password.value } });
    location.href = destino(user);
  } catch (err) {
    toast(errMsg(err), 'err');
  }
});

const regForm = $('#register-form');
regForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const d = validateForm(regForm, {
    nombre: [rule.required, rule.min(2), rule.max(60)],
    apellido: [rule.required, rule.min(2), rule.max(60)],
    email: [rule.required, rule.email, rule.max(120)],
    telefono: [rule.optional(rule.phone)],
    password: [
      rule.required,
      rule.min(8),
      rule.max(72),
      rule.match(/[a-z]/, 'Incluye una minúscula'),
      rule.match(/[A-Z]/, 'Incluye una mayúscula'),
      rule.match(/\d/, 'Incluye un número')
    ],
    password2: [rule.same('password', 'Las contraseñas no coinciden')]
  });
  if (!d) return;
  try {
    const { password2, ...body } = d;
    const user = await api('/auth/register', { method: 'POST', body: { ...body, password: regForm.elements.password.value } });
    location.href = destino(user);
  } catch (err) {
    toast(errMsg(err), 'err');
  }
});

// Si ya hay sesión, no tiene sentido mostrar estas pantallas
const me = await currentUser();
if (me) location.replace(destino(me));
