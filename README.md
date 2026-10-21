# Sistema Web para la Gestión de un Laboratorio Bacteriológico

> Proyecto universitario de **Base de Datos I** · Aplicación web full stack · En desarrollo

## ¿De qué trata el proyecto?

Este proyecto nació como parte de una asignatura universitaria y busca facilitar la organización de algunos procesos de un laboratorio bacteriológico. La idea es que el personal pueda gestionar pacientes, solicitudes de exámenes, muestras y resultados desde una misma aplicación, en lugar de llevar cada parte por separado.

Tomamos como referencia el funcionamiento general de un sistema de información de laboratorio (LIS), con inspiración en ATHENEA LIS, y lo adaptamos al alcance de nuestro proyecto académico. Además de construir la interfaz, nos interesaba aplicar lo aprendido sobre **bases de datos relacionales, reglas de integridad, desarrollo web y control de acceso por roles**.

No es un sistema comercial ni está listo para trabajar con información clínica real. Es un prototipo que seguimos probando y mejorando.

## ¿Qué permite hacer?

- Registrar y consultar pacientes.
- Crear solicitudes de análisis y asociarlas con muestras.
- Registrar y recibir muestras, identificándolas mediante un código de barras.
- Llevar una muestra a procesamiento y registrar hallazgos bacteriológicos.
- Revisar y validar resultados según los permisos del usuario.
- Consultar la trazabilidad de las acciones realizadas durante el proceso.
- Iniciar sesión con distintos roles y restringir operaciones según los permisos definidos.

### Roles del sistema

| Rol | Responsabilidad principal |
| --- | --- |
| **Recepcionista** | Admisión de pacientes, solicitudes y recepción de muestras. |
| **Bacteriólogo** | Procesamiento de muestras y registro de hallazgos. |
| **Validador** | Revisión y validación de resultados. |
| **Administrador** | Consultas y operaciones administrativas permitidas; no firma resultados. |

Una de las reglas del proyecto es la **doble firma**: quien registra un resultado no puede validarlo por sí mismo.

## Tecnologías

| Componente | Herramientas |
| --- | --- |
| **Frontend** | React, TypeScript, Vite, Tailwind CSS |
| **Backend** | Node.js, Express, TypeScript |
| **Base de datos** | MySQL 8, SQL |
| **Acceso a datos** | Prisma ORM |
| **Autenticación y validación** | JWT, bcrypt, Zod |
| **Pruebas** | Vitest, Testing Library y pruebas HTTP del backend |

## Capturas de pantalla

Todavía estamos preparando capturas de las pantallas principales. Las agregaremos usando **pacientes y resultados ficticios**.

## Organización del repositorio

```text
.
├── backend/
│   ├── prisma/            # Modelo de Prisma y datos de prueba
│   ├── src/               # API, servicios, rutas y validaciones
│   └── tests/             # Pruebas HTTP
├── frontend/
│   └── src/               # Pantallas, componentes y pruebas
├── database/
│   ├── schema.sql         # Esquema y datos iniciales de la base de datos
│   └── tests/             # Verificación de restricciones SQL
└── README.md
```

## Cómo ejecutarlo en tu computador

Esta guía está pensada para un **entorno local de desarrollo**, no para producción.

### Requisitos

- Node.js 20 o superior y npm.
- MySQL 8.0.16 o superior (se ha trabajado con MySQL 8.4 en Docker).
- Git.
- Docker, si prefieres ejecutar MySQL en un contenedor.

### 1. Clonar el repositorio

```bash
git clone https://github.com/KiyotakaAll/sistema-gestion-laboratorio-bacteriologico.git
cd sistema-gestion-laboratorio-bacteriologico
```

### 2. Preparar MySQL

Crea una base de datos de **pruebas** utilizando el archivo `database/schema.sql`. Este archivo contiene instrucciones que pueden eliminar y volver a crear tablas: **no lo ejecutes sobre una base de datos que quieras conservar**.

Si ya tienes MySQL 8 funcionando, puedes usar esa instalación. Si utilizas Docker, una alternativa es ejecutar MySQL 8.4 en un puerto local libre, por ejemplo:

```bash
docker run -d --name lab-mysql84 \
  -e MYSQL_ROOT_PASSWORD=CAMBIA_ESTA_CLAVE \
  -p 127.0.0.1:3307:3306 \
  -v lab-mysql84-data:/var/lib/mysql \
  mysql:8.4
```

Después, carga el esquema **solo en una instancia de pruebas nueva**, ajustando el usuario, el puerto y la contraseña a tu entorno:

```bash
mysql -h 127.0.0.1 -P 3307 -u root -p < database/schema.sql
```

> Si usas el puerto predeterminado de MySQL, cambia `3307` por `3306`. En CachyOS puede existir una instalación local de MariaDB; este proyecto se ha probado con **MySQL**, no con MariaDB.

### 3. Configurar y ejecutar el backend

```bash
cd backend
npm ci
cp .env.example .env
```

Edita `backend/.env` con tu propia conexión MySQL y un secreto JWT. Puedes generar el secreto con:

```bash
openssl rand -hex 32
```

No subas el archivo `.env` al repositorio.

Luego ejecuta:

```bash
npm run prisma:generate
npm run seed
npm run dev
```

La API estará disponible en `http://localhost:3000` y su comprobación básica en `http://localhost:3000/api/health`.

### 4. Configurar y ejecutar el frontend

Abre otra terminal desde la raíz del proyecto:

```bash
cd frontend
npm ci
npm run dev
```

Abre `http://localhost:5173` en el navegador. Durante el desarrollo, Vite redirige las solicitudes `/api` al backend.

> El diseño está orientado principalmente a pantallas de escritorio.

### 5. Usuarios de demostración

Al ejecutar el *seed* se crean cuentas para los roles `admin`, `recepcion`, `bacteriologo` y `validador`. Sus credenciales de prueba están definidas en el código de inicialización del proyecto. **Úsalas solo con datos ficticios y en un entorno local**; no deben utilizarse en una instalación pública.

## Recorrido de prueba sugerido

1. Inicia sesión como **recepcionista** y registra un paciente ficticio y una solicitud.
2. Registra la muestra asociada, consulta su código y márcala como recibida.
3. Ingresa como **bacteriólogo**, inicia el procesamiento y registra los hallazgos del análisis.
4. Ingresa como **validador** y revisa el resultado antes de validarlo.
5. Consulta la **trazabilidad** para observar los eventos registrados.

Este recorrido principal se probó localmente con la aplicación y MySQL. No significa que todas las funcionalidades estén verificadas.

## Pruebas y estado actual

- Se ejecutaron satisfactoriamente las pruebas de interfaz disponibles (**15 pruebas**).
- El backend pasó comprobaciones de tipos y compilación en el entorno local.
- Se comprobó manualmente el flujo principal de pacientes, solicitudes, muestras, resultados y validación, incluyendo la persistencia y auditoría en MySQL.
- El registro completo del antibiograma todavía requiere pruebas adicionales.
- Quedan por revisar algunos aspectos de configuración de TypeScript del frontend, dependencias y seguridad antes de pensar en un despliegue público.

Para ejecutar las pruebas de interfaz:

```bash
cd frontend
npm test
```

En algunos entornos de Node.js puede ser necesario utilizar:

```bash
env NODE_OPTIONS='--no-experimental-webstorage' npm test
```

El backend también incluye `npm run test:smoke` para comprobaciones HTTP. Las pruebas de restricciones de `database/tests/` pueden **vaciar tablas**, así que deben ejecutarse únicamente en una base de datos desechable.

## Próximas mejoras

- Ampliar las pruebas de los resultados y el antibiograma.
- Pulir detalles de la interfaz y su adaptación a distintos tamaños de pantalla.
- Revisar dependencias y configuración antes de desplegar la aplicación.
- Completar la documentación y añadir capturas del sistema.

## Autores

Proyecto desarrollado con fines académicos.

- [KiyotakaAll](https://github.com/KiyotakaAll)
- Compañero de desarrollo: por agregar.

---

**Nota:** este repositorio es un ejercicio académico. No está destinado a la atención clínica ni al almacenamiento de información real de pacientes.
