# LabZen v0.2.0 — Fase 4.1: flujo clínico

Implementación sobre `feature/labzen-v020-pacientes`, desde
`a7504126aaf8a94b73bfd17bc6b930aa859c85ad`. Los cambios se preparan para un
commit independiente de cierre; no hay push ni despliegue.

## Estados existentes y transiciones

No se añadieron estados. La solicitud no tiene un estado clínico propio.
El examen del catálogo tiene `activo`; la asociación `MuestraExamen` no tiene
estado: la ausencia/presencia de su resultado indica si falta registrar hallazgos.
`PROCESADA` significa que todos sus exámenes tienen resultado, no que todos
estén validados. La validación sigue siendo individual por resultado.

| Entidad | Origen | Operación | Destino | Condición |
| --- | --- | --- | --- | --- |
| Muestra | Sin registro | Registrar | REGISTRADA | Solicitud existente y exámenes activos, sin cambiar asociaciones |
| Muestra | REGISTRADA | Receptar | RECEPTADA | Cuenta vigente autorizada, fecha y responsable de recepción |
| Muestra | REGISTRADA o RECEPTADA | Rechazar | RECHAZADA | Motivo obligatorio; preserva recepción previa |
| Muestra | RECEPTADA | Iniciar procesamiento | EN_PROCESAMIENTO | Cuenta vigente con permiso de procesamiento |
| Muestra | EN_PROCESAMIENTO | Completar procesamiento | PROCESADA | Automático al registrar el último resultado; ningún examen pendiente |
| Resultado | Sin resultado | Registrar | PENDIENTE_VALIDACION | Muestra EN_PROCESAMIENTO, examen sin resultado y hallazgos válidos |
| Resultado | PENDIENTE_VALIDACION | Corregir | PENDIENTE_VALIDACION | Muestra EN_PROCESAMIENTO o PROCESADA; versión revisada vigente; cambia autoría |
| Resultado | PENDIENTE_VALIDACION | Validar | VALIDADO | Muestra EN_PROCESAMIENTO o PROCESADA; hallazgos íntegros, versión vigente, permiso y doble firma |
| Muestra/resultado | RECHAZADA, PROCESADA / VALIDADO | Repetir transición o retroceder | No permitido | HTTP 409; una muestra PROCESADA conserva resultados pendientes corregibles/validables |

La política de estados de muestras está centralizada en
`backend/src/domain/flujo-clinico.ts`, compartida con los controles del cliente.
No hay un endpoint manual para cerrar muestras ni para reabrir resultados
validados. Una rectificación posterior a la firma requerirá un procedimiento
explícito futuro; esta fase mantiene esos resultados inmutables.

## Concurrencia

Las escrituras clínicas usan transacciones interactivas Prisma con aislamiento
`READ COMMITTED`. El orden de adquisición es:

1. Cuenta responsable: `SELECT id FROM usuarios ... FOR SHARE`, comprobación
   de actividad y permiso de su rol actual, dentro de la transacción.
2. Muestra: `SELECT id FROM muestras ... FOR UPDATE` antes de leer su estado.
3. Resultado existente: `SELECT id FROM resultados ... FOR UPDATE`, seguido de
   una nueva lectura de su estado, autoría, fecha de actualización y hallazgos.

Las consultas son parametrizadas mediante `$queryRaw` etiquetado. Las
referencias iniciales de examen/resultado solo permiten encontrar la muestra;
los datos clínicos se vuelven a leer después del bloqueo. No se cambian esas
asociaciones desde estos flujos.

El bloqueo común de muestra serializa recepción, rechazo, inicio,
registro, corrección y validación. También serializa registros de exámenes
diferentes de una misma muestra: el último registro cuenta los pendientes
actuales y cierra la muestra con su auditoría. Si el cierre condicional no
actualiza exactamente una muestra, se revierte la operación completa.

Las transiciones de muestra conservan `estado` en el `WHERE`. Las correcciones
y firmas además comparan `updatedAt`; las firmas comparan también el autor.
El cliente debe enviar la versión que abrió/revisó. La nueva fecha es mayor
que la anterior incluso si el reloj retrocede o dos escrituras coinciden en
el mismo milisegundo. Los scripts base ya definen `updated_at` como
`DATETIME(3)`; no hace falta una columna, restricción ni migración nueva.

### Comprobación puntual de cierre: precisión de `updatedAt`

`database/schema.sql` declara `resultados.updated_at DATETIME(3) NOT NULL
DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)`: conserva
milisegundos. Prisma declara `DateTime @default(now()) @updatedAt` y el
mapeo MySQL predeterminado es también `DATETIME(3)`. Se confirmó con el motor
Prisma instalado generando únicamente DDL en `/tmp`, mediante `migrate diff
--from-empty --to-schema-datamodel` de un modelo mínimo con el mismo campo;
no se ejecutó ese DDL ni se usó una conexión o una migración de base de datos.

El timestamp automático por sí solo puede repetirse dentro de un mismo
milisegundo. Aquí las correcciones y firmas escriben explícitamente
`siguienteVersion(actual.updatedAt)` después de releer el resultado bajo
`FOR UPDATE`; no dependen de ese automatismo. Con el esquema declarado,
la versión crece al menos 1 ms, incluso si las operaciones caen en el mismo
segundo/milisegundo o el reloj no avanza. El `WHERE` compara estado y versión
anterior; una copia antigua recibe 409 antes de sobrescribir hallazgos.

Dos pruebas HTTP offline con `Date.now` fijo verifican correcciones
concurrentes (una gana y la otra recibe 409), avances sucesivos `.000 → .001
→ .002`, lectura clínica después de ambos bloqueos y firma frente a corrección
obsoleta. No se encontraron defectos que requieran cambiar código productivo,
Prisma o SQL. Esta conclusión se limita al esquema declarado y a escritores
que usan estos servicios; el esquema desplegado y el comportamiento real de
MySQL siguen pendientes de prueba, como se detalla más abajo.

Una versión antigua o un CAS sin fila afectada produce
`409 CONFLICTO_CONCURRENCIA`. Los conflictos Prisma P2034, expiración de
transacción P2028 y errores de bloqueo SQL 1205/1213 propagados como P2010
se convierten en conflictos controlados. No hay reintento automático de firmas.
Las operaciones repetidas también pueden devolver los conflictos específicos
`TRANSICION_INVALIDA`, `RESULTADO_DUPLICADO` o `RESULTADO_YA_VALIDADO`.

## API y formularios

Se conservan las rutas. Cambia el contrato de escritura de resultados:

- `PUT /api/resultados/:id`: hallazgos y `updatedAt` ISO de la lectura previa.
- `PATCH /api/resultados/:id/validar`: `{ "updatedAt": "..." }` obligatorio.
- `POST /api/resultados`: no requiere versión; el examen único y el bloqueo
  impiden registrar dos resultados para el mismo examen.

Un contrato ausente/mal formado produce 400 y nunca degrada a una escritura
sin control de versión. El servicio también rechaza versiones ausentes.
Las demás rutas, roles y contratos de solicitudes se conservan.

Los formularios usan los estados reales y la política compartida para ocultar
acciones imposibles. Protegen los envíos simultáneos y solo notifican éxito
cuando responde la operación. Tras éxito refrescan sus listas/trazabilidad.
Tras 409 de muestra recargan estado e historial. Tras 409 de corrección conservan
el texto, bloquean reenvío y actualizan la lista para cerrar/reabrir y comparar.
Tras 409 de firma recargan el resultado, retiran la confirmación y exigen una
nueva revisión; si falla esa recarga no permiten firmar la copia antigua.
Se reutilizan los componentes y estilos existentes; no se cambian CSS,
navegación ni diseño visual.

## Auditoría e integridad clínica

Se conserva `registrarLog(tx, ...)`: actualización, antibiograma, cierre de
muestra y auditorías se confirman/revierten en la misma transacción.
Los eventos guardan usuario, entidad, ID, acción, estado anterior/nuevo y fecha
(`LogAuditoria.fechaEvento`, con valor por defecto en la base). En creación
el estado anterior es nulo, porque no existía la entidad. Las correcciones
registran también la versión anterior y el ID de muestra; las firmas conservan
la referencia al autor y la fecha de validación. No se agregan hallazgos,
contraseñas ni tokens al detalle del log.

Antes de firmar se validan de nuevo los hallazgos persistidos con las reglas
existentes: al menos un hallazgo no vacío, antibiograma solo con bacteria,
antibióticos sin duplicados, sensibilidad válida y halo dentro del rango.
Esto verifica integridad de captura, no reemplaza el criterio clínico ni
introduce criterios microbiológicos nuevos.

Una corrección transfiere `usuarioIdRegistra` a quien la guarda. Ese usuario
no puede validar su propio contenido. Se vuelve a comprobar el permiso usando
la cuenta vigente, incluso con la política histórica, sin confiar solo en JWT
ni frontend. El bloqueo compartido de cuenta impide cambiar su actividad o
asignación de rol durante la operación.

Se conserva la matriz de permisos de 3.1: con su bandera apagada firma
`VALIDADOR`; con la política nueva firma `BACTERIOLOGO`. `ADMINISTRADOR` no
recibe permiso de procesamiento, escritura de resultados ni firma por esta
fase. No se alteran roles, registro público, contraseñas ni datos reales.

## Compatibilidad

Las tres banderas siguen con valor por defecto `false` en `config/env.ts`:
`PACIENTES_IDENTIFICACION_HABILITADA`, `MEDICOS_REMITENTES_HABILITADOS` y
`PERMISOS_OPERATIVOS_HABILITADOS`.

Se conservan las selecciones explícitas de pacientes y solicitudes para evitar
consultar sus columnas nuevas con las banderas apagadas. Los bloqueos solo
usan tablas y columnas históricas. No se modificaron Prisma, los SQL base ni
las migraciones pendientes. No se conectó a MySQL/Railway ni se ejecutó SQL,
Docker o migraciones. El esquema real no fue inspeccionado.

El backend y frontend deben actualizarse coordinadamente en un despliegue
futuro: clientes antiguos sin `updatedAt` ya no pueden corregir o firmar a
ciegas. Esta fase no se desplegó.

## Verificación offline

Resultados de implementación: **302 pruebas aprobadas**, sin conexiones reales.
En el cierre se añadieron dos pruebas puntuales y se ejecutó únicamente la
suite backend de flujo clínico: **84/84 aprobadas**. Acumulado de casos: 304;
las demás suites, typechecks y compilación no se repitieron en el cierre.

| Suite | Pruebas |
| --- | ---: |
| Backend `flujo-clinico.test.cjs` (incluye cierre) | 84 |
| Backend `muestras.permisos.test.cjs` | 53 |
| Backend `permisos.test.cjs` | 73 |
| Frontend `flujo-clinico.test.tsx` | 11 |
| Frontend `flujos.test.tsx` | 57 |
| Frontend `permisos.test.tsx` | 26 |

Backend ejecutado desde `backend`, por suite:

```sh
TSX_DISABLE_CACHE=1 node --require tsx/cjs --require ./tests/solo-mocks.cjs tests/flujo-clinico.test.cjs
TSX_DISABLE_CACHE=1 node --require tsx/cjs --require ./tests/solo-mocks.cjs tests/muestras.permisos.test.cjs
TSX_DISABLE_CACHE=1 node --require tsx/cjs --require ./tests/solo-mocks.cjs tests/permisos.test.cjs
node node_modules/typescript/bin/tsc --project tsconfig.json --noEmit --incremental false
```

Frontend ejecutado desde `frontend`:

```sh
node node_modules/vitest/vitest.mjs run src/__tests__/flujo-clinico.test.tsx src/__tests__/flujos.test.tsx src/__tests__/permisos.test.tsx --config src/__tests__/vitest.caracterizacion.config.ts --configLoader runner
npm run typecheck
npm run build -- --config /tmp/labzen-41-vite.config.mjs
```

Los tres typechecks (backend, frontend y configuración frontend) pasaron.
Una compilación de producción pasó: 1712 módulos, JS 458.63 kB / gzip 147.42 kB.
La configuración temporal importó `frontend/vite.config.ts` y estableció
`envFile: false`, sin leer `.env`; agregó únicamente un inventario de módulos
para comprobar que el bundle usa los cuatro módulos puros de `backend/src/domain`
y ningún servicio/configuración de servidor. Los artefactos de compilación
quedan en `dist`, ignorado por Git.

Las pruebas cubren estados y repeticiones, CAS perdedores, conflictos HTTP,
permisos vigentes en ambas políticas, doble firma después de correcciones,
validación de registros incompletos, conservación de asociaciones históricas,
selecciones compatibles y rollback si falla cualquier auditoría crítica.
Las simulaciones de concurrencia se serializan deliberadamente: verifican el
contrato y la lógica del servicio, no prueban el aislamiento real de MySQL.

## Limitaciones que requieren una base de pruebas real futura

Sin ejecutar nada ahora, falta comprobar con dos conexiones MySQL 8/InnoDB:
recepción/rechazo/inicio en carrera; dos últimos resultados de exámenes
diferentes; edición/edición y edición/firma; doble firma simultánea;
revocación de cuenta mientras otra operación espera; deadlock/timeout real;
rollback efectivo ante fallo de auditoría; precisión y round trip de
`DATETIME(3)` a través de Prisma. Debe comprobarse también que la instalación
real conserve los motores, índices y restricciones de los scripts base.

Las protecciones suponen que todos los escritores usan estos servicios; no
controlan modificaciones externas por SQL ni instancias antiguas de la API.
Esta fase no corrige ni reasigna registros históricos automáticamente y no
crea un procedimiento de rectificación de resultados firmados.

## Inventario de fase: 20 archivos

### Nuevos (5)

- `backend/src/domain/flujo-clinico.ts`
- `backend/src/services/flujo-clinico.service.ts`
- `backend/tests/flujo-clinico.test.cjs`
- `frontend/src/__tests__/flujo-clinico.test.tsx`
- `docs/flujo-clinico-v020.md`

### Modificados (15)

- `backend/src/controllers/resultado.controller.ts`
- `backend/src/services/muestra.service.ts`
- `backend/src/services/resultado.service.ts`
- `backend/src/validators/resultado.validator.ts`
- `backend/tests/muestras.permisos.test.cjs`
- `backend/tests/permisos.test.cjs`
- `frontend/src/__tests__/flujos.test.tsx`
- `frontend/src/__tests__/permisos.test.tsx`
- `frontend/src/components/muestras/MuestraDetalleModal.tsx`
- `frontend/src/components/resultados/ResultadoFormModal.tsx`
- `frontend/src/components/resultados/ResultadoRevisionModal.tsx`
- `frontend/src/pages/ValidacionAthenea.tsx`
- `frontend/src/pages/WorklistResultados.tsx`
- `frontend/src/services/api.ts`
- `frontend/src/services/laboratorio.ts`

Los cambios de pruebas de permisos solo adaptan los datos simulados a la
versión obligatoria y a la consulta de cuenta vigente; no alteran su política.
Los 604 archivos locales no rastreados preexistentes fueron verificados por
SHA-256 antes/después y permanecen intactos. El cierre confirma exclusivamente
los 20 archivos de este inventario, sin incluir archivos locales ajenos.
No hay push ni despliegue.
