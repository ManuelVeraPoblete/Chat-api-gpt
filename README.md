# ✅ CorpChat Backend API (NestJS)

Backend oficial de **CorpChat**, una API REST construida con **NestJS** que entrega:

✅ Autenticación JWT (Access + Refresh)  
✅ Gestión de usuarios (Prisma + MariaDB/MySQL)  
✅ Chat persistente (MongoDB + Mongoose)  
✅ Integración con **OpenAI** para el “Asistente Corporativo”  
✅ Arquitectura modular y clean code (SRP, DTOs, Guards, Services)

---

## 🧱 Tecnologías

- **Node.js** 20+ (recomendado)
- **NestJS**
- **Prisma 7** + `@prisma/adapter-mariadb`
- **MariaDB/MySQL** (usuarios / auth)
- **MongoDB** (mensajes / conversaciones)
- **OpenAI SDK** (respuestas IA)
- JWT + Passport
- Class Validator (DTO validation)

---

## 📂 Estructura del proyecto

```bash
src/
  config/                 # configuración y validación de env
  common/
    guards/               # guards reutilizables
    util/                 # utilidades (bcrypt)
  modules/
    prisma/               # PrismaService + schema.prisma
    users/                # usuarios públicos para el chat
    auth/                 # login/register/refresh/logout/me
    chat/                 # conversaciones/messages + OpenAI
```

---

## ✅ Requisitos previos

Debes tener instalados y corriendo:

### 1) Base de datos SQL (MariaDB / MySQL)
Ejemplo:
- Host: `localhost`
- Puerto: `3306`
- DB: `corpchat`

### 2) MongoDB
Ejemplo:
- Host: `localhost`
- Puerto: `27017`
- DB: `corpchat`

---

## ⚙️ Variables de entorno

Crea un archivo:

📍 `.env`

```env
# APP
NODE_ENV=development
PORT=3000

# SQL (MariaDB/MySQL)
DATABASE_URL=mysql://root:123456@localhost:3306/corpchat

# JWT
JWT_ACCESS_SECRET=super-access-secret
JWT_REFRESH_SECRET=super-refresh-secret
JWT_ACCESS_TTL_SECONDS=900
JWT_REFRESH_TTL_SECONDS=604800

# Security
BCRYPT_SALT_ROUNDS=12

# MongoDB
MONGO_URI=mongodb://localhost:27017/corpchat

# OpenAI
OPENAI_API_KEY=sk-proj-xxxxxxxxxxxxxxxxxxxxxxxx
OPENAI_MODEL=gpt-4o-mini

# CorpChat Assistant
ASSISTANT_USER_ID=UUID_DEL_USUARIO_ASISTENTE
```

✅ **IMPORTANTE**
- `OPENAI_API_KEY` **solo debe existir en el backend**
- `ASSISTANT_USER_ID` es el **id del usuario “Asistente Corporativo”** (en tu tabla User SQL)

---

## ▶️ Instalación y ejecución

### 1) Instalar dependencias
```bash
npm install
```

### 2) Ejecutar en desarrollo
```bash
npm run start:dev
```

Cuando todo esté OK verás:
```bash
✅ API running on http://localhost:3000
```

---

## 🔐 Autenticación

Esta API usa JWT via:

✅ `Authorization: Bearer <ACCESS_TOKEN>`

---

# ✅ Endpoints disponibles

## 🟢 Auth

### ✅ Register
**POST** `/auth/register`

```bash
curl -X POST http://localhost:3000/auth/register   -H "Content-Type: application/json"   -d '{
    "email": "user1@empresa.cl",
    "displayName": "User 1",
    "password": "123456",
    "phone": "+56911111111",
    "companySection": "TI",
    "jobTitle": "Ingeniero"
  }'
```

---

### ✅ Login
**POST** `/auth/login`

```bash
curl -X POST http://localhost:3000/auth/login   -H "Content-Type: application/json"   -d '{
    "email": "user1@empresa.cl",
    "password": "123456"
  }'
```

📌 Respuesta esperada:
```json
{
  "user": {
    "id": "uuid...",
    "email": "user1@empresa.cl",
    "displayName": "User 1"
  },
  "accessToken": "xxx",
  "refreshToken": "yyy"
}
```

---

### ✅ Refresh Token
**POST** `/auth/refresh`

```bash
curl -X POST http://localhost:3000/auth/refresh   -H "Content-Type: application/json"   -d '{ "refreshToken": "TU_REFRESH_TOKEN" }'
```

---

### ✅ Me (perfil actual)
**GET** `/auth/me`

```bash
curl -X GET http://localhost:3000/auth/me   -H "Authorization: Bearer TU_ACCESS_TOKEN"
```

---

### ✅ Logout
**POST** `/auth/logout`

```bash
curl -X POST http://localhost:3000/auth/logout   -H "Authorization: Bearer TU_ACCESS_TOKEN"
```

---

## 👥 Users

### ✅ Ping público
**GET** `/users/ping`

```bash
curl -X GET http://localhost:3000/users/ping
```

---

### ✅ Listar usuarios para chat (excluye el logeado)
**GET** `/users`

```bash
curl -X GET http://localhost:3000/users   -H "Authorization: Bearer TU_ACCESS_TOKEN"
```

---

### ✅ Perfil público por ID
**GET** `/users/:id`

```bash
curl -X GET http://localhost:3000/users/UUID_USUARIO   -H "Authorization: Bearer TU_ACCESS_TOKEN"
```

---

## 💬 Chat

> Todos los endpoints de chat están protegidos con JWT.

### ✅ Traer historial con un usuario
**GET** `/chat/:peerId/messages?limit=200`

```bash
curl -X GET "http://localhost:3000/chat/UUID_PEER/messages?limit=200"   -H "Authorization: Bearer TU_ACCESS_TOKEN"
```

📌 Respuesta:
```json
{
  "conversationId": "mongoObjectId...",
  "messages": [
    {
      "id": "mongoId...",
      "senderId": "uuid...",
      "role": "user",
      "text": "Hola!",
      "createdAt": "2026-01-21T..."
    }
  ]
}
```

---

### ✅ Enviar mensaje
**POST** `/chat/:peerId/messages`

```bash
curl -X POST "http://localhost:3000/chat/UUID_PEER/messages"   -H "Authorization: Bearer TU_ACCESS_TOKEN"   -H "Content-Type: application/json"   -d '{ "text": "Hola, ¿cómo estás?" }'
```

📌 Respuesta:
```json
{
  "created": [
    {
      "id": "mongoId...",
      "senderId": "uuid...",
      "role": "user",
      "text": "Hola, ¿cómo estás?"
    }
  ]
}
```

---

# 🤖 Asistente Corporativo (OpenAI)

El asistente **responde automáticamente** solo cuando:

✅ `peerId === ASSISTANT_USER_ID`

Es decir, cuando el usuario le habla al **usuario especial del sistema**.

📌 La IA usa:
- un prompt de sistema (“Asistente Corporativo”)
- los últimos **20 mensajes** del historial de la conversación
- `OPENAI_MODEL` configurable (default: `gpt-4o-mini`)

---

## ✅ Cómo configurar el ASSISTANT_USER_ID

1) Registra un usuario “Asistente”:
```bash
curl -X POST http://localhost:3000/auth/register   -H "Content-Type: application/json"   -d '{
    "email": "asistente@empresa.cl",
    "displayName": "Asistente Corporativo",
    "password": "123456"
  }'
```

2) Haz login y copia el `user.id`

3) Pega ese id en tu `.env`:
```env
ASSISTANT_USER_ID=EL_UUID_DEL_USUARIO_ASISTENTE
```

4) Reinicia el backend:
```bash
npm run start:dev
```

---

# 🛠️ Troubleshooting

## ⚠️ Warning Mongoose: Duplicate schema index

Si ves esto:

```
[MONGOOSE] Warning: Duplicate schema index on {"participants":1} found...
```

Significa que el índice `participants` fue declarado 2 veces:
- `index: true` en el campo
- y `schema.index({ participants: 1 })`

✅ Solución: deja solo 1 definición.

---

# 📌 Notas de seguridad

✅ Passwords hasheadas con `bcrypt`  
✅ Refresh tokens se almacenan como hash (rotación)  
✅ JWT via Authorization Header  
✅ `.env` nunca debe subirse al repo

---

## 📄 Licencia
Uso interno / desarrollo privado.
