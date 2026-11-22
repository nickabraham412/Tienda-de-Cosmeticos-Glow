import { api, renderLayout, toast, errMsg, validateForm, rule, currentUser } from '/js/common.js';

await renderLayout();

// si ya inicio sesion lo saco de aqui para que no vuelva a registrarse o loguearse
async function revisarSesion() {
  const usuarioActual = await currentUser();
  if (usuarioActual) {
    window.location.replace(elegirPaginaDestino(usuarioActual));
  }
}

// decide a donde mandarlo despues de entrar (si es admin o cliente normal)
function elegirPaginaDestino(user) {
  const parametros = new URLSearchParams(window.location.search);
  const siguiente = parametros.get('next');

  // reviso que el link sea interno de mi pagina y no un link raro externo
  if (siguiente && siguiente.startsWith('/') && !siguiente.startsWith('//')) {
    if (user.rol === 'admin' || !siguiente.startsWith('/admin')) {
      return siguiente;
    }
  }

  if (user.rol === 'admin') {
    return '/admin/';
  }
  return '/index.html';
}

// logica para el formulario de iniciar sesion (login.html)
const formLogin = document.getElementById('login-form');
if (formLogin) {
  formLogin.addEventListener('submit', async function(e) {
    e.preventDefault();

    const datos = validateForm(formLogin, {
      email: [rule.required, rule.email],
      password: [rule.required]
    });
    if (!datos) return;

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
    }
  });
}

// logica para el formulario de crear cuenta (registro.html)
const formRegistro = document.getElementById('register-form');
if (formRegistro) {
  formRegistro.addEventListener('submit', async function(e) {
    e.preventDefault();

    // reglas para revisar que los datos y la contraseña esten bien
    const datos = validateForm(formRegistro, {
      nombre: [rule.required, rule.min(2), rule.max(60)],
      apellido: [rule.required, rule.min(2), rule.max(60)],
      email: [rule.required, rule.email, rule.max(120)],
      telefono: [rule.max(20)],
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
    if (!datos) return;

    // armo el paquete de datos para mandarlo al servidor (sin password2)
    const nuevoUsuario = {
      nombre: datos.nombre,
      apellido: datos.apellido,
      email: datos.email,
      telefono: datos.telefono,
      password: formRegistro.elements.password.value
    };

    try {
      const user = await api('/auth/register', {
        method: 'POST',
        body: nuevoUsuario
      });
      window.location.href = elegirPaginaDestino(user);
    } catch (error) {
      toast(errMsg(error), 'err');
    }
  });
}

revisarSesion();
