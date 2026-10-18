# Funded Lab · App del curso de trading de futuros

App web instalable (PWA: PC, Mac, Android, iPhone) para vender y dar el curso **Estrategia de ruptura 15:15 – 15:30**.

- **Venta con Stripe**: quien compra recibe acceso al instante durante **3 meses** (si renueva antes, se suman al final).
- **Acceso solo para quien paga**: entrada sin contraseña con un enlace al correo de compra (de un solo uso, caduca en 30 min),
  y como máximo **2 dispositivos abiertos a la vez**; al entrar en un tercero se cierra el más antiguo.
  Un reembolso o una disputa en Stripe retira el acceso y cierra sus sesiones.
- **Marca de agua con el correo del alumno** y su número de licencia (`FL-00042-AB12`) en todo:
  - cada página de la app (capa en diagonal que se vuelve a poner si alguien la borra desde el navegador),
  - cada gráfico (el correo va dentro del propio SVG, también en capturas),
  - cada **vídeo** (grabado en la imagen con ffmpeg para cada alumno, más una marca que cambia de sitio),
  - el **PDF** descargable (en diagonal y en el pie de cada página),
  - el texto copiado (se añade la licencia al pegarlo).
- **Contenido**: los 17 módulos del manual + Parte IV con **7 ejemplos de entrada interactivos** («¿qué harías a las 15:30?»
  y resolución vela a vela), **21 vídeos** (uno por módulo), calculadora de tamaño, reloj de la apertura de Nueva York
  (con el cambio de hora), checklist diaria y plan de trading rellenable, progreso por alumno.

> Ninguna protección impide que alguien grabe la pantalla con otro móvil. Lo que hace la marca de agua es que cualquier
> copia lleve el correo y la licencia de quien la filtró: con `GET /api/admin/license/FL-…` sabes quién es y le retiras el acceso.

## Cómo está montado

| Parte | Qué es |
|---|---|
| `server.js` | Servidor Node (Express): Stripe, acceso, API del curso, PDF y vídeos con marca |
| `lib/` | Base de datos SQLite (`node:sqlite`), gráficos SVG, render de lecciones, correo (Resend), marcas de agua |
| `public/` | Web de venta (`/`), acceso (`/entrar`) y la app del curso (`/app`) |
| `content/` | **El curso cifrado** (AES-256-GCM): textos, PDF y vídeos. El repositorio es público, así que solo se sube cifrado |
| `content-src/` | El curso sin cifrar para editarlo. **No se sube** (está en `.gitignore`) |
| `scripts/` | Cifrar/descifrar el contenido, generar los vídeos, dar acceso a mano |

El servidor descifra `content/` al arrancar con la variable `CONTENT_KEY`. **Guarda esa clave**: sin ella nadie (tampoco tú)
puede leer el curso del repositorio.

## Puesta en marcha

### 1. Stripe
1. **Product catalog → Add product**: «Curso Funded Lab», precio único (p. ej. 197 €). Copia el `price_…` → `STRIPE_PRICE_ID`.
2. **Developers → API keys**: copia la clave secreta → `STRIPE_SECRET_KEY`.
3. **Developers → Webhooks → Add endpoint**: `https://TU_DOMINIO/api/stripe/webhook` con los eventos
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded` y `charge.dispute.created`.
   Copia el *signing secret* → `STRIPE_WEBHOOK_SECRET`.

El botón «Comprar» de la web abre Stripe Checkout. Si prefieres un *Payment Link* de Stripe (para Instagram, por ejemplo),
también funciona: el webhook da el acceso a cualquier pago del precio `STRIPE_PRICE_ID`. Pon como página de confirmación
del Payment Link `https://TU_DOMINIO/gracias?session_id={CHECKOUT_SESSION_ID}` para que entren directamente.

### 2. Correo (Resend)
Crea una cuenta en [resend.com](https://resend.com), verifica tu dominio y copia la API key → `RESEND_API_KEY`;
el remitente en `MAIL_FROM` (p. ej. `Funded Lab <curso@tudominio.com>`). Sin esto los enlaces de acceso solo salen en el log.

### 3. Servidor
Necesita Node 22.13+, **ffmpeg** y un **disco persistente** (alumnos, sesiones y copias de vídeo con marca).

- **Render**: *New → Blueprint* y elige este repositorio (usa `render.yaml` de la raíz del repositorio y el `Dockerfile`). Rellena las variables.
- **Cualquier VPS / Docker**: `docker build -t fundedlab-curso curso && docker run -p 3000:3000 -v fl-data:/data --env-file curso/.env fundedlab-curso`

Variables: mira `.env.example`. Apunta tu dominio (p. ej. `curso.fundedlab.es`) al servidor y pon `BASE_URL` con https.

### 4. Probar una compra
Con claves de prueba de Stripe (`sk_test_…`), compra con la tarjeta `4242 4242 4242 4242`. Debes entrar directamente en
la app y recibir el correo de bienvenida.

## Gestión de alumnos (panel /admin)

Pon tu correo en `ADMIN_EMAILS` y una contraseña en `ADMIN_PASSWORD`. Con eso:

- **Tú entras gratis y sin caducidad** (hasta 6 dispositivos). Entra en `https://TU_DOMINIO/admin` con tu correo y la
  contraseña; desde ahí, «Ir al curso». En la app verás «Acceso: ilimitado» y el botón **Panel de alumnos**.
- En el **panel de alumnos** (funciona en el móvil):
  - **Dar acceso** a un correo (1, 3, 6 o 12 meses; si ya lo tiene, se suma). Te da un **enlace de acceso** para
    copiarlo o **enviarlo por WhatsApp** (no hace falta tener el correo configurado), y opcionalmente se lo envía por correo.
  - **+3 meses**, **Enlace de acceso** nuevo (si cambia de móvil), **Cerrar sesiones** y **Bloquear** (pierde el acceso
    y se cierran sus sesiones al momento; para desbloquearlo, «Dar 3 meses»).
  - Buscar por correo o por **número de licencia** (`FL-…`) para saber de quién es una copia filtrada.

También desde la terminal del servidor:

```bash
npm run grant -- alumno@correo.com        # dar 3 meses
npm run grant -- alumno@correo.com 6      # 6 meses
npm run grant -- --revoke alumno@correo.com
npm run grant -- --list
```

Y por API con `Authorization: Bearer $ADMIN_PASSWORD`: `GET /api/admin/users`, `POST /api/admin/grant {email, months, notify}`,
`POST /api/admin/revoke {email}`, `POST /api/admin/link {email}`, `POST /api/admin/logout-devices {email}` y
`GET /api/admin/license/FL-00042-AB12`.

## Editar el curso

```bash
npm install
CONTENT_KEY=... npm run unseal     # descifra content/ en content-src/
# edita content-src/modules/*.html, content-src/course.json o content-src/videos.js (guiones de los vídeos)
npm run videos                     # regenera todos los vídeos (o: npm run videos -- 08-entrada)
CONTENT_KEY=... npm run seal       # vuelve a cifrar en content/ → commit y push
```

- Un vídeo por módulo: `content-src/videos/<id-del-módulo>.mp4`. Puedes sustituir cualquiera por un vídeo tuyo grabado
  (mismo nombre, MP4 H.264) y volver a cifrar: la marca de agua de cada alumno se añade igual.
- Los vídeos generados son animados (gráficos, tablas y operaciones vela a vela) con texto en pantalla, sin voz.
- Los ejemplos de velas se definen en `lib/charts.js` (`EXAMPLES`); el simulador calcula entradas y salidas para que
  texto y gráfico cuadren.

## Desarrollo

```bash
npm install
npm run dev          # http://localhost:3000 (usa content-src/ si existe, o content/ con CONTENT_KEY)
npm test             # flujo completo: webhook, acceso, marcas, dispositivos, reembolso, admin
```

Material formativo. No constituye asesoramiento financiero. © 2026 Funded Lab · @fundedlab_es
