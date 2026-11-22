# Glow Store · E-commerce de cosméticos faciales

Tienda en línea con **interfaz de cliente** (catálogo, detalle, carrito, pago simulado, registro/login) y **panel de administración** (CRUD de productos, stock, pedidos y clientes).

**Stack:** SQL Server · Node.js 18+ / Express · HTML5 + CSS3 + JavaScript (módulos ES, sin frameworks).

## Estructura

```
glow-store/
├── database/
│   └── glow_store.sql          # Tablas, relaciones, restricciones, índices, datos de prueba, usuario de BD
├── backend/
│   ├── package.json
│   ├── .env.example            # Plantilla de configuración (cópiala a .env)
│   ├── scripts/seed.js         # Crea admin y cliente demo (contraseñas con bcrypt)
│   └── src/
│       ├── app.js              # Servidor Express, seguridad (helmet, rate limit, CSP) y estáticos
│       ├── config/             # db.js (conexión SQL Server), constants.js
│       ├── middleware/         # auth.js (JWT en cookie), validate.js (Zod), errorHandler.js
│       ├── validators/         # schemas.js (todas las validaciones del servidor)
│       ├── utils/              # payment.js (pasarela simulada), asyncHandler.js, httpError.js
│       └── routes/             # auth, categories, products, orders, admin
└── frontend/
    ├── index.html  producto.html  carrito.html  checkout.html
    ├── login.html  registro.html  pedidos.html
    ├── admin/index.html        # Panel de administración
    ├── css/styles.css
    └── js/                     # common.js (API, carrito, validación) + un script por página
```

## Requisitos

- Node.js 18 o superior
- SQL Server 2017+ (Developer, Express o Docker) con **TCP/IP habilitado** y **autenticación mixta** (SQL Server and Windows Authentication)
- SSMS o Azure Data Studio (o `sqlcmd`) para ejecutar el script

## Puesta en marcha

1. **Base de datos.** Abre `database/glow_store.sql` en SSMS y ejecútalo completo (F5). Crea la base `GlowStore`, las tablas, los datos de prueba y el usuario `glow_app` (solo lectura/escritura de datos).
   - Cambia la contraseña de `glow_app` en el script antes de usarlo fuera de tu equipo.
2. **Configuración.**
   ```bash
   cd backend
   cp .env.example .env        # en Windows (cmd): copy .env.example .env
   ```
   Edita `.env`: pon la misma contraseña de `glow_app` en `DB_PASSWORD` y genera `JWT_SECRET`:
   ```bash
   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
   ```
   - SQL Express con instancia con nombre (`localhost\SQLEXPRESS`): `DB_SERVER=localhost` y `DB_INSTANCE=SQLEXPRESS`.
3. **Dependencias y usuarios iniciales.**
   ```bash
   npm install
   npm run seed
   ```
4. **Arrancar.**
   ```bash
   npm run dev      # reinicia solo al guardar cambios (Node 18.11+)
   # o: npm start
   ```
   Abre <http://localhost:3000>.

### Cuentas de prueba

| Rol | Correo | Contraseña |
|---|---|---|
| Administración | `admin@glow.test` | `Admin123!` (o la de `ADMIN_PASSWORD` en `.env`) |
| Cliente | `cliente@glow.test` | `Cliente123!` |

Panel de administración: <http://localhost:3000/admin/>

### Tarjetas de prueba (pago simulado)

| Número | Resultado |
|---|---|
| 4242 4242 4242 4242 | Aprobada |
| 4000 0000 0000 0002 | Rechazada por el emisor |
| 4000 0000 0000 9995 | Fondos insuficientes |

Usa cualquier vencimiento futuro (MM/AA) y 3 dígitos de CVV.

## Seguridad implementada

| Riesgo | Medida |
|---|---|
| Inyección SQL | Todas las consultas usan parámetros tipados (`request.input`). El `ORDER BY` sale de una lista blanca y el `IN (...)` del carrito crea un parámetro por id. Ver `config/db.js`. |
| Credenciales expuestas | Cadena de conexión solo en `.env` (fuera de Git); la API usa un usuario de BD sin permisos de estructura. |
| Contraseñas | bcrypt (coste 12). Política: 8+ caracteres con mayúscula, minúscula y número. |
| Sesión | JWT de 2 h en cookie `httpOnly` + `SameSite=Strict` (+ `Secure` en producción). |
| Autorización | `requireAdmin` en todas las rutas `/api/admin`. Los pedidos del cliente se filtran por el id del token. |
| Validación | Zod en el servidor (nombres, correos, rangos, enums) y validación equivalente en el navegador. Los campos no declarados se descartan (evita asignar `rol`). |
| XSS | Todo dato dinámico se escapa con `esc()` antes de entrar a `innerHTML`; CSP estricta sin scripts ni estilos en línea. |
| Manipulación de precios | El servidor ignora precios del navegador: recalcula todo desde la BD. |
| Stock y concurrencia | Descuento de stock con `UPDATE ... WHERE Stock >= @qty` dentro de una transacción; si el pago falla se hace rollback. |
| Fuerza bruta / abuso | `express-rate-limit` (límite más estricto en `/api/auth`) y respuesta de login que no revela si el correo existe. |
| Datos de tarjeta | Nunca se guardan: solo los últimos 4 dígitos y una referencia simulada. |

## Notas y siguientes pasos

- **Pago real:** reemplaza `utils/payment.js` por un proveedor (Stripe, PayPal, etc.) y envía los datos de tarjeta directamente a él.
- **Producción:** usa HTTPS, `NODE_ENV=production`, `DB_ENCRYPT=true` y un `JWT_SECRET` nuevo.
- **Imágenes:** los productos sin imagen muestran una tarjeta de color generada; el administrador puede pegar una URL de imagen al editar. Para subir archivos, añade `multer`.
- **Eliminar producto** es una baja lógica (se desactiva) para conservar el historial de pedidos.
- Cancelar un pedido desde el panel devuelve el stock automáticamente.

## Problemas frecuentes

- *No se pudo conectar a SQL Server:* habilita TCP/IP en "SQL Server Configuration Manager", reinicia el servicio y confirma el puerto 1433 (o usa `DB_INSTANCE`).
- *Login failed for user 'glow_app':* activa la autenticación mixta en SSMS (Propiedades del servidor → Seguridad) y reinicia SQL Server.
- *Falta JWT_SECRET:* genera uno con el comando de arriba y pégalo en `.env`.
