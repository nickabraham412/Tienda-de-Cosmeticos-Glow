import { api, renderLayout, toast, errMsg, validateForm, rule, currentUser } from '/js/common.js';

await renderLayout();

// si ya hay sesion activa, lo mando directo al inicio o al panel
async function revisarSesion() {
  const usuario = await currentUser();
  if (usuario) {
    window.location.replace(elegirPaginaDestino(usuario));
  }
}

// decide a que pagina redirigir segun el rol
function elegirPaginaDestino(user) {
  const params = new URLSearchParams(window.location.search);
  const siguiente = params.get('next');

  // verifico que la ruta sea interna de mi tienda
  if (siguiente && siguiente.startsWith('/') && !siguiente.startsWith('//')) {
    if (user.rol === 'admin' || !siguiente.startsWith('/admin')) {
      return siguiente;
    }
  }

  return user.rol === 'admin' ? '/admin/' : '/index.html';
}

// --- INICIAR SESION ---
const formLogin = document.getElementById('login-form');
if (formLogin) {
  formLogin.addEventListener('submit', async (e) => {
    e.preventDefault();

    const datos = validateForm(formLogin, {
      email: [rule.required, rule.email],
      password: [rule.required]
    });
    if (!datos) return;

    const btn = formLogin.querySelector('button[type="submit"]');
    btn.disabled = true;

    try {
      const user = await api('/auth/login', {
        method: 'POST',
        body: {
          email: datos.email,
          password: formLogin.elements.password.value
        }
      });
      window.location.href = elegirPaginaDestino(user);
    } catch (error) {
      toast(errMsg(error), 'err');
      btn.disabled = false;
    }
  });
}

// --- CREAR CUENTA ---
const formRegistro = document.getElementById('register-form');
if (formRegistro) {
  formRegistro.addEventListener('submit', async (e) => {
    e.preventDefault();

    const datos = validateForm(formRegistro, {
      nombre: [rule.required, rule.min(2), rule.max(60)],
      apellido: [rule.required, rule.min(2), rule.max(60)],
      email: [rule.required, rule.email, rule.max(120)],
      // opcional: si escribe algo, que tenga entre 8 y 20 digitos/guiones
      telefono: [rule.match(/^$|^[0-9+\-\s]{8,20}$/, 'Usa entre 8 y 20 números')],
      password: [
        rule.required,
        rule.min(8),
        rule.max(72),
        rule.match(/[a-z]/, 'Falta una minúscula'),
        rule.match(/[A-Z]/, 'Falta una mayúscula'),
        rule.match(/\d/, 'Falta un número')
      ],
      password2: [rule.same('password', 'Las contraseñas no coinciden')]
    });

    if (!datos) return;

    const btn = formRegistro.querySelector('button[type="submit"]');
    btn.disabled = true;

    try {
      const user = await api('/auth/register', {
        method: 'POST',
        body: {
          nombre: datos.nombre,
          apellido: datos.apellido,
          email: datos.email,
          telefono: datos.telefono,
          password: formRegistro.elements.password.value
        }
      });
      toast('¡Cuenta creada con éxito!', 'ok');
      window.location.href = elegirPaginaDestino(user);
    } catch (error) {
      toast(errMsg(error), 'err');
      btn.disabled = false;
    }
  });
}

revisarSesion();
