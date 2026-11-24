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

    // validacion basica usando solo las reglas seguras de common.js
    const datos = validateForm(formRegistro, {
      nombre: [rule.required, rule.min(2), rule.max(60)],
      apellido: [rule.required, rule.min(2), rule.max(60)],
      email: [rule.required, rule.email, rule.max(120)],
      telefono: [rule.required, rule.telefono,rule.max(20)],
      password: [rule.required, rule.min(8), rule.max(72)],
      password2: [rule.same('password', 'Las contraseñas no coinciden')]
    });

    if (!datos) return;

    const pass = formRegistro.elements.password.value;
    const tel = datos.telefono.trim();

    // valido el telefono solo si el usuario escribio algo
    if (tel !== '' && !/^[0-9+\-\s]{8,20}$/.test(tel)) {
      toast('El teléfono debe tener entre 8 y 20 números', 'err');
      return;
    }

    // valido que la contraseña tenga minuscula, mayuscula y numero
    if (!/[a-z]/.test(pass) || !/[A-Z]/.test(pass) || !/\d/.test(pass)) {
      toast('La contraseña debe tener mayúscula, minúscula y número', 'err');
      return;
    }

    const btn = formRegistro.querySelector('button[type="submit"]');
    btn.disabled = true;

    try {
      const user = await api('/auth/register', {
        method: 'POST',
        body: {
          nombre: datos.nombre,
          apellido: datos.apellido,
          email: datos.email,
          telefono: tel,
          password: pass
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
