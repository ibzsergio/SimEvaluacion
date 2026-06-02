# SimEvaluación

Sistema para que el docente registre actividades y calificaciones, y los alumnos vean su avance con ranking, top 10 e insignias.

**Stack:** React (Vite) + Node (Express) + **MySQL** (XAMPP local / Railway en producción).

## Estructura

```
SimEvaluacion/
├── backend/     API + Prisma + MySQL
├── frontend/    React + Vite
└── docker-compose.yml   (opcional si usas Docker en lugar de XAMPP)
```

---

## 1. MySQL con XAMPP (local)

1. Abre **XAMPP** y enciende **MySQL**.
2. En phpMyAdmin crea la base de datos: `simevaluacion` (utf8mb4).
3. Copia `backend/.env.example` → `backend/.env` y ajusta si tu `root` tiene contraseña:

```env
DATABASE_URL="mysql://root@localhost:3306/simevaluacion"
# Con contraseña:
# DATABASE_URL="mysql://root:TU_PASSWORD@localhost:3306/simevaluacion"
```

---

## Grupos 201 y 202 (matutino)

El docente tiene dos grupos fijos. En el panel:

1. Pestaña **Alumnos (Excel)** → sube **un solo archivo** con hojas **201** y **202**.
2. En cada hoja: **número de control** | **nombre completo** (la primera fila puede ser encabezado).
3. También puedes importar un solo grupo con un archivo de una hoja.
4. Cada alumno entra con su **número de control** y **crea su contraseña** la primera vez.
5. Tú puedes **restablecer** contraseñas si un alumno la olvida.
6. Pestaña **Actividades y calificaciones** → importa un Excel con actividades y puntos, o créalas y califícalas una por una.
7. Importar calificaciones: hojas **201** y **202** (como alumnos), columnas = actividades, filas = alumnos. Si la actividad ya existe (mismo nombre y fecha), solo actualiza calificaciones.

Puedes descargar **plantillas CSV** desde cada pestaña (alumnos y calificaciones).

---

## 2. Backend (terminal 1)

```powershell
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run dev
```

API: **http://localhost:4000**

### Usuarios de prueba

Con el backend corriendo, en el login pulsa **“Crear usuarios de prueba”** o:

```powershell
curl -X POST http://localhost:4000/auth/dev-seed
```

| Rol | Email | Contraseña |
|-----|--------|------------|
| Docente | seribamont@gmail.com | c4l1f1c4c10n3s*** |
| Alumno | ana@demo.local | 1234 |

---

## 3. Frontend (terminal 2)

```powershell
cd frontend
npm install
npm run dev
```

Web: **http://localhost:5173**

En desarrollo las peticiones van a `/api` y Vite las redirige al backend (no necesitas `VITE_API_URL`).

---

## Despliegue: Netlify + Railway

Repo: [github.com/ibzsergio/SimEvaluacion](https://github.com/ibzsergio/SimEvaluacion)

### Orden recomendado

1. **Railway** (MySQL + backend) → obtienes URL del API  
2. **Netlify** (frontend) → obtienes URL del sitio  
3. Actualiza `FRONTEND_URL` en Railway con la URL de Netlify  
4. Crea el docente en producción con el script `seed:teacher`

---

### Paso 1 — Railway: MySQL

1. Entra a [Railway](https://railway.app) → **New Project**.
2. **Add service** → **Database** → **MySQL**.
3. En el servicio MySQL, pestaña **Variables** o **Connect** → copia `DATABASE_URL` (formato `mysql://...`).

---

### Paso 2 — Railway: Backend

1. En el mismo proyecto: **Add service** → **GitHub Repo** → elige `ibzsergio/SimEvaluacion`.
2. En **Settings** del servicio backend:
   - **Root Directory:** `backend`
   - **Build Command:** `npm run railway:build` (o déjalo vacío si usa `railway.toml`)
   - **Start Command:** `npm run railway:start`
3. **Variables** del backend (pestaña Variables):

| Variable | Valor |
|----------|--------|
| `DATABASE_URL` | Referencia al MySQL del mismo proyecto (o pega la URL) |
| `JWT_SECRET` | Cadena larga aleatoria (ej. 32+ caracteres) |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | Por ahora `https://placeholder.netlify.app` (la cambias tras Netlify) |

4. **Networking** → **Generate Domain** → copia la URL pública, ej.  
   `https://simevaluacion-production.up.railway.app`

5. Comprueba: abre `https://TU-BACKEND.up.railway.app/health` → debe responder `{"ok":true}`.

---

### Paso 3 — Netlify: Frontend

1. Entra a [Netlify](https://www.netlify.com) → **Add new site** → **Import from Git** → repo `SimEvaluacion`.
2. Configuración de build:

| Campo | Valor |
|-------|--------|
| Base directory | `frontend` |
| Build command | `npm run build` |
| Publish directory | `frontend/dist` |

3. **Environment variables** (Site settings → Environment variables):

| Variable | Valor |
|----------|--------|
| `VITE_API_URL` | URL del backend Railway **sin** `/` final |

4. **Deploy site**. Copia la URL, ej. `https://simevaluacion.netlify.app`.

5. Vuelve a **Railway** → variables del backend → actualiza:

```
FRONTEND_URL=https://simevaluacion.netlify.app
```

(Si tienes dominio custom, puedes poner varias separadas por coma.)

6. Redeploy del backend en Railway para aplicar CORS.

---

### Paso 4 — Crear docente en producción

`POST /auth/dev-seed` está **deshabilitado** en producción.

**Opción A — Railway CLI** (recomendado):

```powershell
npm i -g @railway/cli
railway login
cd backend
railway link
railway run npm run seed:teacher
```

Cuando pida variables, en Railway añade temporalmente `TEACHER_PASSWORD` o pásala en el comando:

```powershell
railway run -- sh -c "TEACHER_PASSWORD='c4l1f1c4c10n3s***' npm run seed:teacher"
```

**Opción B — Local apuntando a Railway:**

Pega el `DATABASE_URL` de producción en un `.env` local (no lo subas a Git) y:

```powershell
cd backend
$env:TEACHER_PASSWORD="c4l1f1c4c10n3s***"
npm run seed:teacher
```

Variables opcionales: `TEACHER_EMAIL`, `TEACHER_NAME`.

---

### URLs en producción

| Quién | URL |
|-------|-----|
| Alumnos | `https://tu-sitio.netlify.app/` |
| Docente | `https://tu-sitio.netlify.app/ingresar-docente` |

En producción los alumnos **no** ven el botón de docente; tú entras por `/ingresar-docente`.

---

### Checklist rápido

- [ ] MySQL en Railway con `DATABASE_URL`
- [ ] Backend desplegado, `/health` responde OK
- [ ] Netlify con `VITE_API_URL` = URL Railway
- [ ] `FRONTEND_URL` en Railway = URL Netlify
- [ ] Docente creado con `npm run seed:teacher`
- [ ] Login docente en `/ingresar-docente`
- [ ] Importar Excel de alumnos (grupos 201 y 202)

---

## Error `EPERM` al instalar (Windows)

Ocurre si **`npm run dev`** del backend sigue corriendo mientras haces `npm install` o `prisma generate`.

1. En todas las terminales: **Ctrl+C** (backend y frontend).
2. Luego:
   ```powershell
   cd backend
   npm run prisma:generate
   npm install
   ```

---

## Comandos útiles

| Comando | Carpeta | Descripción |
|---------|---------|-------------|
| `npm run dev` | backend / frontend | Desarrollo |
| `npm run prisma:studio` | backend | Ver/editar BD |
| `npm run prisma:migrate` | backend | Migraciones (local) |
| `npm run prisma:deploy` | backend | Migraciones (producción) |
