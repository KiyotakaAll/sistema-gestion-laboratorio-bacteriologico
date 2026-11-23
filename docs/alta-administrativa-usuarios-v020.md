# LabZen v0.2.0 — Fase 5.1: alta administrativa segura

Implementado sobre `feature/labzen-v020-pacientes`, desde
`603d8516eb899417fe795707002dd19e410b9426`. Sin commit ni preparación del índice.

## Flujo y autorización

La pantalla existente **Gestión de usuarios** permite abrir **Crear usuario**,
introducir nombre completo, username, correo, contraseña inicial y confirmación,
y seleccionar un perfil operativo disponible. No se creó una pantalla nueva ni
se cambiaron estilos globales, navegación o permisos clínicos.

La cuenta se crea siempre **inactiva**, sin token ni inicio de sesión automático.
La administración confirma su identidad y usa la acción **Activar usuario** ya
existente. Se conserva el mecanismo de activación, sus restricciones y auditoría.

| Ruta | Resultado | Autorización |
| --- | --- | --- |
| `GET /api/usuarios/capacidades` | `{ data: { roles: [...] } }` con perfiles disponibles | JWT válido, permiso `usuarios.administrar` y administrador vigente en BD |
| `POST /api/usuarios` | HTTP 201 y cuenta sin datos sensibles | Mismos controles; segunda comprobación dentro de la transacción, después del hash |
| `PATCH /api/usuarios/:id/activar` | Activación existente, sin cambiar rol | Se conserva el flujo anterior |

El cuerpo de creación admite exclusivamente `nombreCompleto`, `username`,
`email`, `password`, `confirmacion` y `rol`. El rol debe ser `AUXILIAR` o
`BACTERIOLOGO`. No admite `ADMINISTRADOR`, `RECEPCIONISTA`, `VALIDADOR`, IDs de
rol, permisos ni un estado activo proporcionado por el cliente.

El servicio valida de nuevo el contrato, además del controlador. Antes de
calcular bcrypt consulta que la cuenta responsable esté activa y siga siendo
administrativa según la política vigente. Después del hash abre una transacción
`READ COMMITTED`, bloquea esa cuenta con `FOR SHARE` y repite la comprobación.
Esto protege también el modo histórico, cuyo JWT continúa siendo stateless.
Un rol revocado mientras se calcula el hash no conserva autorización para insertar.
No se confía en capacidades enviadas por el cliente ni se conceden privilegios
administrativos a los perfiles operativos.

## Validación, almacenamiento y auditoría

Se reutilizan las reglas existentes de nombre, correo y contraseña del registro
histórico mediante `camposRegistroSchema`; `registroSchema` conserva la misma
validación y comportamiento. No se cambió el servicio de registro público.

- Nombre completo de 3 a 120 caracteres; correo válido de hasta 120.
- Username de 3 a 40 caracteres: letras ASCII, números, punto, guion o guion bajo;
  debe comenzar con letra o número. Se normaliza a minúsculas y no permite `@`.
- Contraseña sin recortar, al menos 12 caracteres, con mayúscula, minúscula,
  número y símbolo, y como máximo 72 bytes UTF-8; confirmación idéntica.
- Contraseña almacenada exclusivamente en `passwordHash`, mediante bcrypt y el
  coste configurado existente. No se almacena la confirmación.
- Búsqueda de duplicados por username/correo; evita además un correo nuevo igual
  al username histórico de otra cuenta, porque el login prioriza ese campo.
  Las restricciones únicas de BD cubren carreras y `P2002` se convierte en 409.
- El perfil se resuelve por nombre en el catálogo, sin IDs asumidos. Se bloquea
  la fila y se comprueba otra vez su ID antes de insertar.
- Cuenta nueva y evento `USUARIO / CREAR / INACTIVO` se escriben en la misma
  transacción. El detalle del evento contiene únicamente el rol; identifica al
  administrador responsable y a la cuenta creada. Si falla la auditoría se
  revierte la creación.
- La respuesta usa la selección pública del listado: ID, username, nombre,
  correo, activo, fecha de creación y nombre del rol. No devuelve hash,
  contraseña, confirmación, `rolId` ni token. Los errores internos se sanean
  mediante el mecanismo existente; duplicados y conflictos tienen respuestas
  controladas sin detalles de Prisma.

No se implementaron restablecimiento de contraseñas, correo ni invitaciones.
No se crean administradores automáticamente ni se modifican cuentas existentes.

## Compatibilidad con bandera y migración de roles

`BACTERIOLOGO` se puede crear tanto con política histórica como con política
nueva, siempre que exista en el catálogo. La creación queda inactiva en ambos
casos. Se mantienen los permisos clínicos de cada política.

`AUXILIAR` solo se ofrece y acepta cuando:

1. `PERMISOS_OPERATIVOS_HABILITADOS=true`.
2. La fila `AUXILIAR` ya existe en `roles`.
3. `ck_roles_nombre` está aplicado (`ENFORCED=YES`) y tiene una expresión `IN`
   reconocida que incluye `AUXILIAR`.

La comprobación consulta `information_schema.TABLE_CONSTRAINTS` y
`CHECK_CONSTRAINTS` únicamente para AUXILIAR con la bandera activa y fila
presente. No crea roles, no ensaya INSERT en el catálogo ni ejecuta DDL.
Un CHECK ausente, histórico, no aplicado o de forma desconocida bloquea AUXILIAR.
Si no puede comprobarse el esquema, la operación falla cerrada con un error
saneado. La comprobación se repite en el POST: una respuesta anterior de
capacidades no autoriza una creación por sí misma.

Con la bandera apagada no se inspecciona el CHECK para AUXILIAR y no se permite
su alta, aunque una migración previa hubiera dejado su fila en el catálogo.
El registro público conserva recepción inactiva en modo histórico y permanece
bloqueado en modo operativo, incluso presentando un JWT administrativo.

No cambian Prisma, el esquema SQL ni las migraciones. No hay nuevas columnas,
tablas, roles ni banderas. Las tres banderas siguen deshabilitadas por defecto:
`PACIENTES_IDENTIFICACION_HABILITADA`, `MEDICOS_REMITENTES_HABILITADOS` y
`PERMISOS_OPERATIVOS_HABILITADOS`. No se depende de las migraciones de pacientes
o médicos.

## Interfaz

El botón y modal están restringidos a la cuenta administrativa con capacidad
`usuarios.administrar`. Antes de abrir el formulario se consultan los perfiles
actualmente disponibles. Si falla esa consulta o no hay perfiles, se impide el
alta y se permite volver a comprobar mediante **Actualizar lista**.

Se reutilizan Modal, Campo, Input, Select, Button y Alert. Ambos campos de
contraseña son de tipo password y no se guardan en almacenamiento del navegador.
El modal muestra que la cuenta quedará pendiente de activación. Solo ofrece los
dos perfiles operativos y deshabilita los no disponibles. Valida antes de enviar,
muestra detalles del servidor y conserva el formulario ante errores, sin avisos
de éxito falsos. Bloquea envíos duplicados y cierres mientras guarda.

Tras éxito borra los campos de contraseña, cierra el modal, confirma el nombre y
username creados, restablece los filtros y recarga el listado sin recargar la
aplicación ni alterar la sesión administrativa. Cancelar descarta el formulario.

## Pruebas offline y verificaciones

**255 pruebas aprobadas**, sin PrismaClient real, dotenv ni conexiones de red.
Los routers, autenticación, validadores, bcrypt y controladores se ejercitan
con datos sintéticos. Las pruebas de servicios usan transacciones simuladas;
no prueban el aislamiento o rollback real de MySQL.

| Suite | Casos aprobados |
| --- | ---: |
| Backend `usuarios.alta.test.cjs` | 64 |
| Backend `usuarios.activacion.test.cjs` | 35 |
| Backend `permisos.test.cjs` | 75 |
| Backend `registro.test.cjs` | 18 |
| Frontend `usuarios.alta.test.tsx` | 25 |
| Frontend `usuarios.test.tsx` | 12 |
| Frontend `permisos.test.tsx` | 26 |

Se cubren: ausencia de sesión, cuentas inactivas/eliminadas/revocadas, usuarios
no administrativos, escalamiento mediante rol y campos adicionales, duplicados
y P2002, claves débiles y límite UTF-8, secreto ausente en respuesta/auditoría,
revocación durante el hash, error de auditoría, disponibilidad del catálogo y
CHECK, compatibilidad con las dos políticas, alta → activación → login,
registro público y controles del formulario.

Desde `backend`, por cada suite afectada:

```sh
TSX_DISABLE_CACHE=1 node --require tsx/cjs --require ./tests/solo-mocks.cjs tests/usuarios.alta.test.cjs
TSX_DISABLE_CACHE=1 node --require tsx/cjs --require ./tests/solo-mocks.cjs tests/usuarios.activacion.test.cjs
TSX_DISABLE_CACHE=1 node --require tsx/cjs --require ./tests/solo-mocks.cjs tests/permisos.test.cjs
TSX_DISABLE_CACHE=1 node --require tsx/cjs --require ./tests/solo-mocks.cjs tests/registro.test.cjs
node node_modules/typescript/bin/tsc --project tsconfig.json --noEmit --incremental false
```

Desde `frontend`:

```sh
node node_modules/vitest/vitest.mjs run src/__tests__/usuarios.alta.test.tsx src/__tests__/usuarios.test.tsx src/__tests__/permisos.test.tsx --config src/__tests__/vitest.caracterizacion.config.ts --configLoader runner
npm run typecheck
npm run build -- --config /tmp/labzen-51-vite.config.mjs
```

Los tres typechecks pasaron (backend, frontend y configuración frontend).
Una compilación de producción pasó: 1713 módulos, JS 462.80 kB / gzip 148.58 kB.
La configuración temporal importa la configuración Vite del proyecto y usa
`envFile: false`, sin leer `.env`. El inventario del bundle confirma únicamente
los cuatro módulos puros compartidos de `backend/src/domain`, sin servicios ni
configuración de servidor. No se modificó el comando build del proyecto.

## Límites pendientes de verificación real futura

No se conectó a MySQL ni se ejecutó ninguna migración. Queda por verificar en
una base de pruebas autorizada: representación real del CHECK en metadata,
permisos para consultarla, colación de unicidad, bloqueos de cuenta y catálogo,
carreras de duplicados y rollback real si falla la auditoría. Las consultas
preparadas se probaron mediante mocks, sin afirmar que estos demuestren el
comportamiento efectivo de MySQL. Un CHECK con una expresión distinta de `IN`
requiere revisión explícita; no se interpreta de forma permisiva.

## Inventario: 16 archivos

### Nuevos (5)

- `backend/src/services/usuarios-disponibilidad.ts`
- `backend/tests/usuarios.alta.test.cjs`
- `frontend/src/components/usuarios/UsuarioFormModal.tsx`
- `frontend/src/__tests__/usuarios.alta.test.tsx`
- `docs/alta-administrativa-usuarios-v020.md`

### Modificados (11)

- `backend/src/controllers/usuario.controller.ts`
- `backend/src/routes/usuario.routes.ts`
- `backend/src/services/usuario.service.ts`
- `backend/src/validators/auth.validator.ts`
- `backend/src/validators/usuario.validator.ts`
- `backend/tests/permisos.test.cjs`
- `frontend/src/__tests__/permisos.test.tsx`
- `frontend/src/__tests__/usuarios.test.tsx`
- `frontend/src/pages/GestionUsuarios.tsx`
- `frontend/src/services/laboratorio.ts`
- `frontend/src/types/api.ts`

La extracción de campos del validador permite reutilizar las reglas sin cambiar
el contrato público. Los ajustes de pruebas anteriores incorporan las nuevas
rutas y capacidades a sus mocks, conservando la matriz de permisos existente.

Los 604 archivos locales preexistentes permanecen intactos y se contrastan por
SHA-256 con el inventario inicial guardado en `/tmp`. El índice permanece vacío
y HEAD sigue en el commit inicial. No hay commit, push, despliegue, Docker,
conexiones MySQL/Railway ni lectura de secretos.
