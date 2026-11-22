const { z } = require('zod');

const MAX_INT = 2_147_483_647;
const id = z.coerce.number().int().positive().max(MAX_INT);
const TELEFONO_RE = /^[0-9+\-\s]{8,20}$/;
const ESTADOS = ['pendiente', 'pagado', 'enviado', 'entregado', 'cancelado'];

const password = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'La contraseña admite máximo 72 caracteres')
  .regex(/[a-z]/, 'Debe incluir una minúscula')
  .regex(/[A-Z]/, 'Debe incluir una mayúscula')
  .regex(/\d/, 'Debe incluir un número');

const idParam = z.object({ id });

const registerSchema = z.object({
  nombre: z.string().trim().min(2, 'Nombre demasiado corto').max(60),
  apellido: z.string().trim().min(2, 'Apellido demasiado corto').max(60),
  email: z.string().trim().toLowerCase().email('Correo inválido').max(120),
  telefono: z.string().trim().refine((v) => v === '' || TELEFONO_RE.test(v), 'Teléfono inválido').default(''),
  password
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Correo inválido').max(120),
  password: z.string().min(1, 'Ingresa tu contraseña').max(72)
});

const listQuery = z.object({
  q: z.string().trim().max(60).optional(),
  categoria: id.optional(),
  orden: z.enum(['nuevos', 'precio_asc', 'precio_desc', 'nombre']).default('nuevos'),
  pagina: z.coerce.number().int().min(1).max(10000).default(1),
  limite: z.coerce.number().int().min(1).max(48).default(12)
});

const bulkQuery = z.object({ ids: z.string().regex(/^\d{1,9}(,\d{1,9}){0,29}$/, 'Lista de ids inválida') });

const productSchema = z.object({
  categoriaId: id,
  nombre: z.string().trim().min(2, 'Nombre demasiado corto').max(120),
  marca: z.string().trim().min(1, 'Indica la marca').max(60),
  descripcion: z.string().trim().max(2000).default(''),
  precio: z.coerce.number().positive('El precio debe ser mayor que 0').max(100000),
  stock: z.coerce.number().int('El stock debe ser entero').min(0, 'El stock no puede ser negativo').max(100000),
  tipoPiel: z.enum(['todo tipo', 'seca', 'grasa', 'mixta', 'sensible']).default('todo tipo'),
  imagenUrl: z.string().trim().max(500).refine((v) => v === '' || /^https?:\/\/\S+$/i.test(v), 'La imagen debe ser una URL http(s)').default(''),
  activo: z.boolean().default(true)
});

const stockSchema = z.object({ stock: z.coerce.number().int().min(0).max(100000) });
const estadoSchema = z.object({ estado: z.enum(ESTADOS) });

const orderSchema = z.object({
  items: z
    .array(z.object({ productoId: id, cantidad: z.coerce.number().int().min(1).max(20) }))
    .min(1, 'El carrito está vacío')
    .max(30),
  envio: z.object({
    direccion: z.string().trim().min(8, 'Dirección demasiado corta').max(200),
    ciudad: z.string().trim().min(2).max(80),
    telefono: z.string().trim().refine((v) => TELEFONO_RE.test(v), 'Teléfono inválido')
  }),
  pago: z.object({
    titular: z.string().trim().min(3, 'Nombre del titular inválido').max(80),
    numero: z.string().transform((s) => s.replace(/[\s-]/g, '')).pipe(z.string().regex(/^\d{13,19}$/, 'Número de tarjeta inválido')),
    vencimiento: z.string().trim().regex(/^(0[1-9]|1[0-2])\/\d{2}$/, 'Vencimiento con formato MM/AA'),
    cvv: z.string().trim().regex(/^\d{3,4}$/, 'CVV inválido')
  })
});

module.exports = { idParam, registerSchema, loginSchema, listQuery, bulkQuery, productSchema, stockSchema, estadoSchema, orderSchema, ESTADOS };
