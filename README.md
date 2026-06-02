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
6. Pestaña **Actividades** → crea prácticas y califica por grupo.

Puedes descargar una **plantilla CSV** desde el mismo panel.

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

### Railway (backend + MySQL)

1. Crea un proyecto en [Railway](https://railway.app).
2. Añade el servicio **MySQL** (plugin). Railway te da `DATABASE_URL` (formato MySQL).
3. Conecta el repo o subcarpeta **`backend`**.
4. Variables de entorno en Railway:

| Variable | Valor |
|----------|--------|
| `DATABASE_URL` | (la que genera MySQL en Railway) |
| `JWT_SECRET` | una cadena larga y aleatoria |
| `PORT` | `4000` (o el que asigne Railway) |
| `FRONTEND_URL` | `https://tu-sitio.netlify.app` |
| `NODE_ENV` | `production` |

5. Build: `npm run railway:build`  
   Start: `npm run railway:start`  
   (ya configurado en `railway.toml`)

6. Copia la URL pública del backend (ej. `https://simevaluacion-production.up.railway.app`).

### Netlify (frontend)

1. Conecta el repo; **Base directory:** `frontend`
2. Build command: `npm run build`
3. Publish directory: `dist`
4. Variable de entorno:

| Variable | Valor |
|----------|--------|
| `VITE_API_URL` | URL del backend en Railway (sin `/` final) |

5. `netlify.toml` ya incluye redirección SPA.

### Datos en producción

`POST /auth/dev-seed` está deshabilitado en producción. Crea usuarios con Prisma Studio o un script:

```powershell
cd backend
npm run prisma:studio
```

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
