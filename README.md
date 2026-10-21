# Sistema Web de Gestión para Laboratorio Bacteriológico

Base de Datos I. Inspirado en ATHENEA LIS. MySQL + Node/TypeScript/Express/Prisma + React/Vite/Tailwind (solo escritorio).

## Estado del proyecto

| Parte | Estado | Verificado |
|---|---|---|
| `database/schema.sql` | Completo | Cargado en MySQL 8.0.46; 16 pruebas de restricciones pasan |
| Backend (`backend/`) | Completo | `tsc --strict` sin errores; 30 casos HTTP de auth, RBAC y validación pasan |
| Frontend (`frontend/`) | Completo | `tsc --strict` sin errores; build de producción OK; 15 pruebas de interfaz por rol pasan |

**Lo que NO se pudo verificar** (el entorno donde se generó no tiene acceso al motor de Prisma ni a un navegador):

1. Las consultas reales de Prisma contra MySQL: los flujos de punta a punta (registrar muestra, cargar resultado, validar). Su lógica está escrita y tipada, pero no ejecutada.
2. El aspecto visual real en un navegador. Las pruebas de interfaz comprueban comportamiento (qué se muestra, qué se envía al API), no el diseño.

Siga los pasos de abajo y reporte cualquier error o detalle visual a corregir.

## Estructura

```
database/
  schema.sql                       DDL completo + datos semilla (roles, exámenes)
  tests/verificar_restricciones.sh Prueba CHECK / UNIQUE / doble firma contra su MySQL
backend/
  prisma/ schema.prisma, seed.ts
  src/ config · controllers · services · middlewares · routes · validators · types · utils
  tests/smoke.ts                   Auth, RBAC y validación (no requiere datos)
frontend/
  src/ components (UI, admision, muestras, resultados) · pages · context · services · hooks · types · utils
  src/__tests__/flujos.test.tsx    Pruebas de interfaz por rol (API simulado)
```

## Puesta en marcha (Linux / CachyOS)

Requisitos: Node.js 20+ y **MySQL 8.0.16 o superior** (las restricciones CHECK no se aplican en versiones anteriores).
MariaDB no está verificada con este esquema.

Opción A, MySQL con Docker (la más simple):
```bash
docker run -d --name lab-mysql -e MYSQL_ROOT_PASSWORD=password -p 3306:3306 mysql:8.0
```
Opción B, MySQL instalado en el sistema: instale el paquete `mysql` de los repositorios (en Arch/CachyOS el paquete `mariadb` es el predeterminado, no lo use), inicialice el directorio de datos e inicie el servicio.

```bash
# 1) Crear el esquema
mysql -uroot -p < database/schema.sql

# 2) Backend  (terminal 1)
cd backend
cp .env.example .env          # ajuste DATABASE_URL y JWT_SECRET (openssl rand -hex 32)
npm install
npm run prisma:generate
npm run typecheck
npm run seed                  # crea 4 usuarios demo (clave: Lab2026*)
npm run test:smoke            # opcional: 30 verificaciones HTTP
npm run dev                   # http://localhost:3000/api/health

# 3) Frontend  (terminal 2)
cd frontend
npm install
npm test                      # opcional: 15 pruebas de interfaz
npm run dev                   # http://localhost:5173  (Vite hace proxy de /api al backend)

# 4) Verificar restricciones de la BD (opcional; BORRA datos de prueba)
./database/tests/verificar_restricciones.sh root
```

Usuarios demo: `admin`, `recepcion`, `bacteriologo`, `validador` (clave `Lab2026*`, cámbiela fuera de clases).

## Recorrido sugerido para probar el flujo completo

1. Entre como `recepcion`: **Admisión de pacientes**, registre un paciente y cree una solicitud (el sistema ofrece registrar la muestra).
2. **Recepción de muestras**: registre la muestra con sus exámenes (se genera el código de barras), ábrala y pulse *Receptar*.
3. Entre como `bacteriologo`: en **Recepción de muestras** abra la muestra e *Iniciar procesamiento*; luego en **Worklist** cargue Gram, colonias, bacteria y antibiograma S/I/R.
4. Entre como `validador`: en **Validación de resultados** revise y firme. Si intenta validar con `bacteriologo`, el sistema lo impide (doble firma).
5. En el detalle de la muestra, revise la **Trazabilidad** de todos los eventos.

## Flujo del laboratorio y roles

`RECEPCIONISTA` admite pacientes, crea solicitudes y registra/recepta muestras. `BACTERIOLOGO` inicia el procesamiento y carga hallazgos. `VALIDADOR` firma el resultado. `ADMINISTRADOR` consulta y registra, pero no tiene permiso para firmar. Quien registró un resultado no puede validarlo (lo exige el servicio y la BD con `ck_resultados_doble_firma`).

## API principal

`POST /api/auth/login` · `GET /api/auth/me` · `/api/pacientes` · `/api/solicitudes` · `/api/examenes` · `/api/muestras` (+ `PATCH /:id/receptar|procesar|rechazar`, `GET /:id/trazabilidad`, `GET /codigo/:codigoBarras`) · `/api/resultados` (+ `GET /worklist`, `PATCH /:id/validar`).
